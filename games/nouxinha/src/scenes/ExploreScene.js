// The game: a wizard, a torch burning down a step at a time, and a lot of dark.

import { FONT, GAME_WIDTH, VIEW_H, getCheats, getPalette, hex } from '../config.js';
import {
  DIRECTIONS,
  abandonRun,
  bankRun,
  buy,
  createRun,
  equip,
  hasSuspendedRun,
  isBlackout,
  refillWater,
  rememberGround,
  resumeRun,
  runSummary,
  spendable,
  step,
  suspendRun,
} from '../core/rules.js';
import { activeSlot, loadSave, MAX_GEMS } from '../core/save.js';
import { itemDef } from '../data/items.js';
import { ensureTextures, preloadTiles } from '../ui/textures.js';
import { MapView } from '../ui/MapView.js';
import { Hud } from '../ui/hud.js';
import { ItemCard } from '../ui/itemCard.js';
import { InventoryPanel } from '../ui/inventoryPanel.js';
import { Dialog } from '../ui/dialog.js';
import { Shop } from '../ui/shop.js';
import { WorldMap } from '../ui/worldMap.js';
import { CompassBadge, BADGE_H, BADGE_W } from '../ui/compassBadge.js';
import { makeDpad } from '../ui/dpad.js';
import { playDeath, playPickup, playTap, playTorch, unlockAudio } from '../ui/sfx.js';
import { startMusic, stopMusic } from '../ui/music.js';

const DPAD_CX = 361;
const DPAD_CY = 737;

// The right edge of the map viewport is the navigation rail: the cogwheel at the
// top, then whichever of the two tools this run owns, stacked under it. Both
// tools can be bought mid-run, so the rail lays itself out again on every
// change rather than being positioned once.
const RAIL_X = GAME_WIDTH - 62;
const RAIL_TOP = 58;
const RAIL_GAP = 10;
const MAP_BUTTON_H = 34;

// Below this, a drag is a tap that wandered rather than a swipe.
const SWIPE_MIN = 24;

// "a, b and c" — the hut's warning reads as a sentence, not a list.
function joinWords(words) {
  if (words.length < 2) return words[0] || '';
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

function sentence(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// What this run would lose by not making it back: gems it hasn't banked, and
// tools it bought or found on the way. Both the hut and the death screen name
// them, because a player who doesn't know the rule can lose an hour to it.
function carriedAtRisk(summary) {
  return [
    ...(summary.gemsCarried
      ? [summary.gemsCarried === 1 ? 'the colour' : `all ${summary.gemsCarried} colours`]
      : []),
    ...summary.toolsCarried.map((id) => `the ${itemDef(id).name.toLowerCase()}`),
  ];
}

export class ExploreScene extends Phaser.Scene {
  constructor() {
    super('ExploreScene');
  }

  preload() {
    preloadTiles(this);
  }

  create(data) {
    ensureTextures(this);
    const pal = getPalette();
    this.cameras.main.setBackgroundColor(pal.bg);

    // The expedition's own loop, in place of the menus' (ui/music.js). Started
    // here so a run entered with the audio already unlocked picks it straight
    // up, and again on the first input for the run that opened the page. It is
    // not stopped on the way out: whichever screen comes next asks for its own
    // track, and the swap crossfades.
    startMusic('explore');

    // A run can be handed a seed and a nonce (SlotScene reads them off the URL),
    // which is what makes an expedition reproducible; without them it walks the
    // world its slot was given at NEW GAME and draws its own nonce.
    const asked = data || {};
    // The cheat switch is a setting rather than run state (config.js), so the
    // scene reads it and hands it over — core/rules.js never asks.
    const cheats = getCheats();
    // Three ways a run reaches this scene, in order of precedence:
    //
    //   1. handed straight over, still walking — the scene was re-entered to
    //      repaint it in a palette just picked in Settings, and the run object
    //      is the same one, untouched;
    //   2. resumed off the slot, because the cogwheel menu suspended an
    //      expedition there and LOAD GAME came back for it (DESIGN.md §6.1);
    //   3. a fresh expedition out of the hut.
    //
    // A cheat run only ever takes the third: it is a sandbox rather than a
    // campaign, so it neither writes a slot nor reads one (DESIGN.md §6.2).
    this.run =
      asked.run ||
      (cheats ? null : resumeRun(loadSave())) ||
      createRun(asked.seed, undefined, asked.nonce, { cheats });
    // Blocks input while the world is sliding, so a fast tapper can't queue
    // steps the renderer hasn't caught up with.
    this.animating = false;
    // Whether the dialog currently showing is the cogwheel menu. The hut's
    // question and the death screen are decisions that have to be answered, so
    // Esc closes this one and leaves those alone.
    this.menuOpen = false;

    this.map = new MapView(this);
    this.hud = new Hud(this, {
      onSlot: (stack) => this.openStack(stack),
      onCoins: () => !this.modalOpen() && this.card.show({ def: itemDef('coin') }),
      onWater: () => !this.modalOpen() && this.card.show({ def: itemDef('water-drop') }),
      onInventory: () => !this.modalOpen() && this.inventory.show(this.run),
    });
    this.card = new ItemCard(this, { onEquip: (i) => this.equipSlot(i) });
    this.inventory = new InventoryPanel(this, { onOpenStack: (stack) => this.openStack(stack) });
    this.dialog = new Dialog(this);
    this.shop = new Shop(this, {
      onBuy: (id) => this.buyFromMerchant(id),
      onLeave: () => this.shop.hide(),
    });
    this.worldMap = new WorldMap(this, { onClose: () => this.worldMap.hide() });

    makeDpad(this, DPAD_CX, DPAD_CY, (dir) => this.tryStep(dir));
    this.buildMenuButton(pal);
    this.buildRail(pal);
    this.bindInput();

    this.map.refresh(this.run);
    this.hud.update(this.run);
    this.layOutRail();
  }

  // The compass badge and the map button, both built once and shown only for the
  // tools the run actually owns.
  buildRail(pal) {
    this.compass = new CompassBadge(this, RAIL_X, RAIL_TOP);

    this.mapButton = this.add.container(RAIL_X, RAIL_TOP).setVisible(false).setDepth(50);
    const frame = this.add.graphics();
    frame.lineStyle(2, pal.fg, 1);
    frame.strokeRect(0, 0, BADGE_W, MAP_BUTTON_H);
    const label = this.add
      .text(BADGE_W / 2, MAP_BUTTON_H / 2, 'MAP', {
        fontFamily: FONT,
        fontSize: '13px',
        color: hex(pal.fg),
      })
      .setOrigin(0.5);
    const zone = this.add
      .zone(0, 0, BADGE_W, MAP_BUTTON_H)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => {
      if (this.modalOpen()) return;
      playTap();
      this.worldMap.show(this.run);
    });
    this.mapButton.add([frame, label, zone]);
  }

  layOutRail() {
    let y = RAIL_TOP;
    this.compass.update(this.run);
    if (this.run.tools.has('compass')) {
      this.compass.setPosition(RAIL_X, y);
      y += BADGE_H + RAIL_GAP;
    }
    this.mapButton.setVisible(this.run.tools.has('map')).setPosition(RAIL_X, y);
  }

  // The cogwheel, and everything that hangs off it (DESIGN.md §7). It is the
  // only control in the corner: settings, saving and leaving are all one tap
  // in rather than three buttons competing for the same 48 pixels.
  buildMenuButton(pal) {
    const g = this.add.graphics();
    g.lineStyle(2, pal.fg, 1);
    g.strokeRect(GAME_WIDTH - 62, 14, 48, 34);
    this.add.image(GAME_WIDTH - 38, 31, 'cog').setScale(1.5).setTint(pal.fg);
    this.add
      .zone(GAME_WIDTH - 62, 14, 48, 34)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        if (this.modalOpen()) return;
        playTap();
        this.openMenu();
      });
  }

  // The menu itself. It rides on the scene's one dialog rather than a second
  // overlay, because only one modal can ever be up: the cogwheel is deaf while
  // anything else is open, and nothing else can open behind the menu.
  openMenu() {
    this.menuOpen = true;
    this.dialog.show({
      title: 'MENU',
      lines: ['Saving keeps this expedition exactly as it stands. Leaving without it does not.'],
      buttons: [
        { label: 'SETTINGS', onClick: () => this.openSettings() },
        { label: 'SAVE GAME', onClick: () => this.saveGame() },
        { label: 'EXIT GAME', onClick: () => this.confirmExit() },
        { label: 'KEEP PLAYING', onClick: () => this.closeMenu() },
      ],
    });
  }

  closeMenu() {
    this.menuOpen = false;
    this.dialog.hide();
  }

  // Settings mid-run. A palette is picked by tinting everything on screen at
  // create time, so coming back re-enters this scene rather than resuming a
  // paused one — and the live run object rides along in the scene data, which
  // is what makes the round trip cost the expedition nothing.
  openSettings() {
    this.menuOpen = false;
    this.dialog.hide();
    this.scene.start('SettingsScene', { run: this.run });
  }

  // SAVE GAME: the expedition goes into the slot as it stands, still unbanked,
  // and the player is asked the one question that follows from having just
  // saved (DESIGN.md §6.1).
  saveGame() {
    this.menuOpen = false;
    suspendRun(this.run);
    const summary = runSummary(this.run);
    this.dialog.show({
      title: summary.cheats ? 'NOTHING SAVED' : 'EXPEDITION SAVED',
      lines: summary.cheats
        ? ['Cheats are on, so this run was never a campaign and nothing was written.']
        : [
            `Slot ${activeSlot()} is holding this walk exactly where you are standing.`,
            'LOAD GAME picks it up from here.',
          ],
      rows: summary.cheats
        ? []
        : [
            ['FURTHEST OUT', summary.furthest],
            ['STEPS TAKEN', summary.steps],
            ['COINS CARRIED', summary.coins],
          ],
      buttons: [
        { label: 'KEEP PLAYING', onClick: () => this.dialog.hide() },
        { label: 'EXIT GAME', onClick: () => this.leave() },
      ],
    });
  }

  // Leaving banks nothing and saves nothing, which can cost an hour's walk —
  // so it asks, and says what it is about to cost.
  confirmExit() {
    this.menuOpen = false;
    const summary = runSummary(this.run);
    const atRisk = carriedAtRisk(summary);
    this.dialog.show({
      title: 'LEAVE THE DARK',
      lines: [
        // Precise about what leaving costs, which depends on whether there is
        // anything in the slot to fall back to (DESIGN.md §6.1).
        hasSuspendedRun()
          ? 'Leaving does not save. This slot goes back to the walk you last saved.'
          : 'Leaving now saves nothing of this expedition.',
        atRisk.length
          ? `${sentence(joinWords(atRisk))} you are carrying ${
              atRisk.length > 1 ? 'go' : 'goes'
            } back where you found ${atRisk.length > 1 ? 'them' : 'it'}.`
          : 'The ground you lit stays on your map.',
      ],
      buttons: [
        { label: 'KEEP PLAYING', onClick: () => this.closeMenu() },
        { label: 'LEAVE', onClick: () => this.leave() },
      ],
    });
  }

  // Leaving abandons the expedition — nothing it was carrying is banked
  // (DESIGN.md §6.1) — but the ground it lit is kept, the same as when a run
  // dies out there. Cartography is not progress.
  //
  // A slot's suspended expedition is left exactly as it was, whether that is
  // the save just made or one from an hour ago: not saving is not the same as
  // unsaving (`rememberGround` in core/rules.js).
  leave() {
    rememberGround(this.run);
    this.scene.start('TitleScene');
  }

  // The card, the inventory panel, and the hut's dialog all own the whole
  // screen while they're up: nothing behind them steps, swipes, or reacts to a key.
  modalOpen() {
    return (
      this.card.isOpen() ||
      this.inventory.isOpen() ||
      this.dialog.isOpen() ||
      this.shop.isOpen() ||
      this.worldMap.isOpen()
    );
  }

  bindInput() {
    this.input.on('pointerdown', (p) => {
      // The player has touched the page, which is what lets the pickup blip and
      // the music through the browser's autoplay policy.
      unlockAudio();
      this.resumeMusic();
      // Only the map area swipes; the HUD is buttons, and an open overlay owns
      // every pointer on screen.
      this.swipeFrom = !this.modalOpen() && p.y < VIEW_H ? { x: p.x, y: p.y } : null;
    });

    this.input.on('pointerup', (p) => {
      const start = this.swipeFrom;
      this.swipeFrom = null;
      if (!start || this.modalOpen()) return;
      const dx = p.x - start.x;
      const dy = p.y - start.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return;
      const dir =
        Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
      this.tryStep(dir);
    });

    const keys = {
      'keydown-UP': 'up',
      'keydown-DOWN': 'down',
      'keydown-LEFT': 'left',
      'keydown-RIGHT': 'right',
      'keydown-W': 'up',
      'keydown-S': 'down',
      'keydown-A': 'left',
      'keydown-D': 'right',
    };
    for (const [event, dir] of Object.entries(keys))
      this.input.keyboard.on(event, () => this.tryStep(dir));
    this.input.keyboard.on('keydown-ESC', () => {
      if (this.menuOpen) {
        this.closeMenu();
        return;
      }
      if (this.card.isOpen()) this.card.hide();
      if (this.inventory.isOpen()) this.inventory.hide();
      if (this.shop.isOpen()) this.shop.hide();
      if (this.worldMap.isOpen()) this.worldMap.hide();
      // Nothing was open, so Esc is the keyboard's cogwheel.
      if (!this.modalOpen()) this.openMenu();
    });
  }

  // Every input starts the loop as well as unlocking the audio, because the
  // first tap of a run is usually the one that opens the audio at all — except
  // once the run has run dry, where the silence under the death screen is the
  // point (showDeath).
  resumeMusic() {
    if (this.run && this.run.water > 0) startMusic('explore');
  }

  tryStep(direction) {
    if (this.animating || this.modalOpen()) return;
    unlockAudio();
    this.resumeMusic();

    const result = step(this.run, direction);
    if (!result.moved) {
      // A shut gate bumps like rock, but says what it wants — otherwise it
      // reads as a wall with a pattern on it and the player walks away.
      if (result.reason === 'locked')
        this.hud.flash(
          `THE GATE WANTS ${result.needs} COLOUR${result.needs === 1 ? '' : 'S'}. YOU HAVE ${this.run.gems}.`
        );
      this.animating = true;
      this.map.bump(this, DIRECTIONS[direction], () => {
        this.animating = false;
      });
      return;
    }

    this.map.refresh(this.run);
    this.hud.update(this.run);
    this.layOutRail();
    this.announce(result);
    if (result.picked) playPickup(result.picked);
    // The dark equipping a light for you: the torch that took over is the same
    // event as one you chose off the item card, and it sounds the same.
    if (result.burnedOut && !result.blackout) playTorch();

    this.animating = true;
    this.map.slide(this, DIRECTIONS[direction], () => {
      this.animating = false;
      // Asked/shown once the world has finished moving, so the question or the
      // death screen doesn't land over a sliding map. Death takes priority over
      // the hut's question — dying in the doorway is still dying.
      if (result.died) this.showDeath();
      else if (result.atBase) this.askToStop();
      else if (result.atMerchant) this.openShop();
    });
  }

  // Walking back onto the hut is the only place a run can be signed off, so
  // arriving there asks rather than assumes — the hut is also just a landmark to
  // cross on the way somewhere else.
  askToStop() {
    // An item card or the inventory panel opened during the step's 90ms slide
    // would otherwise swallow the question; arriving home is the more
    // important of the two.
    if (this.card.isOpen()) this.card.hide();
    if (this.inventory.isOpen()) this.inventory.hide();
    // The hut is the only place a run can be written down, so a player carrying
    // a gem needs telling that this is the moment it stops being at risk.
    const summary = runSummary(this.run);
    const atRisk = carriedAtRisk(summary);
    this.dialog.show({
      title: 'BACK AT THE HUT',
      lines: atRisk.length
        ? [
            `Stopping here saves ${joinWords(atRisk)} you are carrying.`,
            'Head back out and you carry it at your own risk.',
          ]
        : ['Call it here, or head back out?'],
      buttons: [
        { label: 'KEEP GOING', onClick: () => this.resupply() },
        { label: 'STOP HERE', onClick: () => this.showRecap() },
      ],
    });
  }

  // The merchant is the only place coins go (DESIGN.md §4.5). Arriving opens the
  // counter the same way arriving at the hut asks its question — after the slide,
  // and over anything the player opened during it.
  openShop() {
    if (this.card.isOpen()) this.card.hide();
    if (this.inventory.isOpen()) this.inventory.hide();
    this.shop.show(this.run);
  }

  buyFromMerchant(id) {
    const rescue = isBlackout(this.run) && itemDef(id).isLight;
    const bought = buy(this.run, id);
    if (!bought) return;
    // Buying a light out of blackout equips it on the spot (core/rules.js), so
    // it is the torch catching that is worth hearing, not the purchase.
    if (rescue) playTorch();
    else playPickup(bought);
    this.map.refresh(this.run);
    this.hud.update(this.run);
    this.layOutRail();
    // Re-rendered rather than closed: a purchase moves the purse, which moves
    // what every other row on the counter can do.
    this.shop.show(this.run);
    this.hud.flash(`BOUGHT ${itemDef(id).name}. ${spendable(this.run)} COINS LEFT.`);
  }

  // The hut tops water back up on the way out, not just on the way home —
  // it's a base, not just a save point, so a run that doubles back can push
  // out again on a full tank.
  resupply() {
    const refilled = refillWater(this.run);
    this.dialog.hide();
    this.hud.update(this.run);
    if (refilled) this.hud.flash('WATER REFILLED AT THE HUT.');
  }

  // Stopping at the hut is the only thing that writes the save (DESIGN.md §6),
  // which is what makes the walk home the decision the run is really about.
  showRecap() {
    const summary = runSummary(this.run);
    const saved = bankRun(this.run);
    // What's coming home, and how much walking is left in it.
    const carried = [
      ...summary.lights.map((light) => `${itemDef(light.id).name} ${light.durability}`),
      ...summary.tools.map((id) => itemDef(id).name),
    ];
    this.dialog.show({
      title: 'EXPEDITION OVER',
      rows: [
        ['TILES EXPLORED', summary.explored],
        ['NEW GROUND', summary.newGround],
        ['COINS', summary.coins],
        ['LIGHTS FOUND', summary.lightsFound],
        ['COLOURS SAVED', `${saved.gems}/${MAX_GEMS}`],
        ['FURTHEST OUT', summary.furthest],
        ['STEPS TAKEN', summary.steps],
      ],
      footer: summary.cheats
        ? 'CHEATS ON — NOTHING WAS WRITTEN TO THE SLOT'
        : `CARRYING ${carried.length ? carried.join(', ') : 'NOTHING'}`,
      buttons: [{ label: 'HOME', onClick: () => this.scene.start('TitleScene') }],
    });
  }

  // Running out of water is the run's one hard failure state (DESIGN.md §6):
  // unlike the hut's recap, there's nothing to carry home from it, and nothing
  // is written — a gem that never made it back to the hut is still out there.
  showDeath() {
    if (this.card.isOpen()) this.card.hide();
    if (this.inventory.isOpen()) this.inventory.hide();
    // The one place the loop stops before the scene does: running dry is the
    // run's only hard failure, and the tune that says so gets the silence.
    stopMusic();
    playDeath();
    const summary = runSummary(this.run);
    const atRisk = carriedAtRisk(summary);
    // Nothing this run was carrying is banked, but the ground it lit is kept —
    // written here rather than on the way out, so closing the tab on the death
    // screen doesn't cost the walk (DESIGN.md §6.1). Death also takes the slot's
    // saved expedition with it: this was that walk, and it is over.
    abandonRun(this.run);
    this.dialog.show({
      title: 'OUT OF WATER',
      lines: [
        atRisk.length
          ? `You collapsed in the dark. ${sentence(joinWords(atRisk))} you were carrying ${
              atRisk.length > 1 ? 'are' : 'is'
            } back where you found ${atRisk.length > 1 ? 'them' : 'it'}.`
          : 'You collapsed in the dark. Everything you carried is lost.',
        'The ground you lit stays on your map.',
      ],
      rows: [
        ['TILES EXPLORED', summary.explored],
        ['NEW GROUND', summary.newGround],
        ['FURTHEST OUT', summary.furthest],
        ['STEPS TAKEN', summary.steps],
      ],
      buttons: [{ label: 'HOME', onClick: () => this.scene.start('TitleScene') }],
    });
  }

  // hud.update() resets the status line, so anything worth saying about the
  // step just taken is said after it.
  announce(result) {
    // A gem outranks everything else that could have happened on the step: it
    // is the only pickup that repaints the world.
    if (result.gemFound) {
      this.hud.flash(`${itemDef(result.picked).name} IS BACK. CARRY IT HOME TO KEEP IT.`);
      return;
    }
    // A tool is the other pickup worth its own line: it changes what is on
    // screen, and it is only kept by walking it home.
    if (result.picked && itemDef(result.picked).tool) {
      this.hud.flash(`FOUND THE ${itemDef(result.picked).name}. CARRY IT HOME TO KEEP IT.`);
      return;
    }
    if (result.burnedOut) {
      const burned = itemDef(result.burnedId).name;
      if (result.blackout) this.hud.flash(`${burned} BURNED OUT. NO LIGHT LEFT.`);
      else this.hud.flash(`${burned} BURNED OUT. SWITCHED TO NEXT LIGHT.`);
      return;
    }
    if (result.picked === 'coin') {
      this.hud.flash(`FOUND ${result.coinsGained} COIN${result.coinsGained === 1 ? '' : 'S'}.`);
      return;
    }
    if (result.picked) this.hud.flash(`FOUND ${itemDef(result.picked).name}.`);
    // Walking back onto the hut relays everything on the ground (DESIGN.md
    // §4.3), which is worth saying — otherwise the world quietly changing under
    // a player who was heading somewhere specific reads as a bug.
    else if (result.respawned) this.hud.flash('THE DARK HAS PUT EVERYTHING BACK SOMEWHERE NEW.');
  }

  // `stack` is one entry of `inventoryStacks(run)` — see core/rules.js. Called
  // from both a tapped HUD slot and a tapped row in the inventory panel.
  openStack(stack) {
    if (this.modalOpen()) return;
    this.card.show({ def: itemDef(stack.id), instances: stack.instances });
  }

  equipSlot(index) {
    const was = this.run.activeIndex;
    if (!equip(this.run, index)) return;
    // Only when a different light actually took over: re-equipping the one
    // already burning is a no-op, and it should sound like one.
    if (this.run.activeIndex !== was) playTorch();
    this.map.refresh(this.run);
    this.hud.update(this.run);
  }
}
