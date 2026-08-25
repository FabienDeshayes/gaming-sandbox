// The game: a wizard, a torch burning down a step at a time, and a lot of dark.

import { FONT, GAME_WIDTH, VIEW_H, getCheats, getPalette, hex } from '../config.js';
import {
  DIRECTIONS,
  abandonRun,
  bankRun,
  buy,
  createRun,
  depositRun,
  equip,
  hasSuspendedRun,
  isBlackout,
  rememberGround,
  resumeRun,
  runSummary,
  spendable,
  step,
  suspendRun,
} from '../core/rules.js';
import { activeSlot, loadSave, MAX_GEMS } from '../core/save.js';
import { itemDef } from '../data/items.js';
import {
  CARRIED,
  DEATH,
  EDGE,
  FLASH,
  HUT,
  LEAVING,
  MENU,
  RECAP,
  SAVED,
  SAY,
  WORLD_MAP,
} from '../text.js';
import { ensureTextures, preloadTiles } from '../ui/textures.js';
import { MapView } from '../ui/MapView.js';
import { Hud } from '../ui/hud.js';
import { ItemCard } from '../ui/itemCard.js';
import { InventoryPanel } from '../ui/inventoryPanel.js';
import { Dialog } from '../ui/dialog.js';
import { TextPanel } from '../ui/textPanel.js';
import { Shop } from '../ui/shop.js';
import { WorldMap } from '../ui/worldMap.js';
import { CompassBadge, BADGE_H, BADGE_W } from '../ui/compassBadge.js';
import { makeDpad } from '../ui/dpad.js';
import {
  playChest,
  playDeath,
  playPickup,
  playTap,
  playTorch,
  playUnlock,
  unlockAudio,
} from '../ui/sfx.js';
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

// The list of things a run is carrying, joined and capitalised into the opening
// of a sentence. The words themselves — and the joining — are copy (text.js);
// this is only the capital letter.
function sentence(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// What this run would lose by not making it back: gems it hasn't banked, and
// tools it bought or found on the way. The death screen and the menu's way out
// both name them, because a player who doesn't know the rule can lose an hour
// to it.
function carriedAtRisk(summary) {
  return [
    ...(summary.gemsCarried
      ? [summary.gemsCarried === 1 ? CARRIED.oneGem : CARRIED.manyGems(summary.gemsCarried)]
      : []),
    ...summary.keysCarried.map((id) => CARRIED.key(itemDef(id).name)),
    ...summary.toolsCarried.map((id) => CARRIED.tool(itemDef(id).name)),
  ];
}

// The same list read the other way round, for the hut: what arriving there just
// wrote down. Coins ride along here and not above, because they are the one
// thing a bad walk home costs you in *part* rather than whole.
function carriedHome(summary) {
  return [
    ...carriedAtRisk(summary),
    ...(summary.coinsCarried ? [CARRIED.coins(summary.coinsCarried)] : []),
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
    const handed = asked.run;
    const carriedOn = handed ? null : cheats ? null : resumeRun(loadSave());
    this.run = handed || carriedOn || createRun(asked.seed, undefined, asked.nonce, { cheats });
    // Which of the three it was, because only the third is a character walking
    // out of the door for the first time — and that is the one the text panel
    // has something to say about (`show` at the end of `create`).
    const settingOut = !handed && !carriedOn;
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
    this.textPanel = new TextPanel(this);
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

    // Last, over a screen that is already drawn: the panel leaves the viewport
    // showing, so what it covers has to be there to be covered.
    if (settingOut) this.textPanel.show(SAY.expeditionStart);
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
      .text(BADGE_W / 2, MAP_BUTTON_H / 2, WORLD_MAP.button, {
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

  // The one thing in the game that explains itself rather than being explained
  // by the HUD: the world's edge is invisible by design — what you see is the
  // ground running out — so walking into it once earns a sentence about why.
  showEdge() {
    playTap();
    this.dialog.show({
      title: EDGE.title,
      lines: EDGE.lines,
      buttons: [{ label: EDGE.back, onClick: () => this.dialog.hide() }],
    });
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
      title: MENU.title,
      lines: [MENU.line],
      buttons: [
        { label: MENU.settings, onClick: () => this.openSettings() },
        { label: MENU.save, onClick: () => this.saveGame() },
        { label: MENU.exit, onClick: () => this.confirmExit() },
        { label: MENU.keepPlaying, onClick: () => this.closeMenu() },
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
      title: summary.cheats ? SAVED.titleCheats : SAVED.title,
      lines: summary.cheats ? [SAVED.lineCheats] : SAVED.lines(activeSlot()),
      rows: summary.cheats
        ? []
        : [
            [SAVED.rowFurthest, summary.furthest],
            [SAVED.rowSteps, summary.steps],
            [SAVED.rowCoins, summary.coinsCarried],
          ],
      buttons: [
        { label: SAVED.keepPlaying, onClick: () => this.dialog.hide() },
        { label: SAVED.exit, onClick: () => this.leave() },
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
      title: LEAVING.title,
      lines: [
        // Precise about what leaving costs, which depends on whether there is
        // anything in the slot to fall back to (DESIGN.md §6.1).
        hasSuspendedRun() ? LEAVING.fallsBackToSave : LEAVING.savesNothing,
        atRisk.length
          ? LEAVING.atRisk(sentence(CARRIED.list(atRisk)), atRisk.length > 1)
          : LEAVING.groundKept,
      ],
      buttons: [
        { label: LEAVING.keepPlaying, onClick: () => this.closeMenu() },
        { label: LEAVING.leave, onClick: () => this.leave() },
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
      this.textPanel.isOpen() ||
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
      // The panel's one control, on the keyboard: Esc reads it on rather than
      // closing it, because there is nothing behind it to go back to yet.
      if (this.textPanel.isOpen()) {
        this.textPanel.advance();
        return;
      }
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
      // Walking into a chest is what opens it (DESIGN.md §4.8). The bump still
      // plays — the step really didn't happen — but what it says depends on
      // whether the lid moved, and a lid that moved is the game's own voice
      // rather than a line in the HUD.
      if (result.reason === 'chest') this.openedChest(result);
      // A shut gate bumps like rock, but says what it wants — otherwise it
      // reads as a wall with a pattern on it and the player walks away.
      if (result.reason === 'locked')
        this.hud.flash(FLASH.gateLocked(itemDef(result.needs).name));
      // The end of the world bumps like rock too, and a bump against nothing
      // visible is exactly the thing that reads as a bug — so the first time a
      // campaign reaches it, the dark says what it is (DESIGN.md §4.7). After
      // that it is a line in the HUD, because by then the player knows.
      if (result.reason === 'edge') {
        if (result.firstTime) this.showEdge();
        else this.hud.flash(FLASH.edge);
      }
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
    // The key turning under you as you walk through: the one moment a gate is
    // anything other than scenery.
    if (result.unlocked) playUnlock();
    if (result.picked) playPickup(result.picked);
    // The dark equipping a light for you: the torch that took over is the same
    // event as one you chose off the item card, and it sounds the same.
    if (result.burnedOut && !result.blackout) playTorch();
    // The hut handing back a light out of blackout is the same catching sound
    // as buying one out of blackout at the merchant (core/rules.js `restockLight`).
    if (result.relit) playTorch();

    this.animating = true;
    this.map.slide(this, DIRECTIONS[direction], () => {
      this.animating = false;
      // Asked/shown once the world has finished moving, so the question or the
      // death screen doesn't land over a sliding map. Getting home takes
      // priority over dying, because the hut filled the tank on the way in
      // (`step` in core/rules.js): a walk that reaches its own doorstep on the
      // last drop of water has got home, and there is water at home.
      if (result.atBase) this.arriveHome();
      else if (result.died) this.showDeath();
      else if (result.atMerchant) this.openShop();
    });
  }

  // A chest, opened by walking into it. What was inside gets the text panel
  // rather than a line in the HUD, because a chest is the only thing in this
  // world that somebody else left behind on purpose — and the panel leaves the
  // world on screen, so the lid is visibly up behind it while it is read.
  //
  // A chest that was already open does nothing at all, which is the whole of the
  // rule: no second hoard, no second key, and the status line says so rather
  // than the panel, because it is a non-event.
  openedChest(result) {
    this.map.refresh(this.run);
    this.hud.update(this.run);
    this.layOutRail();
    if (result.already) {
      this.hud.flash(FLASH.chestEmpty);
      return;
    }
    playChest();
    if (result.key) {
      this.hud.flash(FLASH.keyFound(itemDef(result.key).name));
      this.textPanel.show(SAY.chestKey(itemDef(result.key).name));
      return;
    }
    this.hud.flash(FLASH.chestCoins(result.coins));
    this.textPanel.show(SAY.chestCoins(result.coins));
  }

  // Reaching the hut is what banks a run (DESIGN.md §6.1), so arriving writes
  // the walk down before it says anything — and then the only question left is
  // whether the expedition goes on, which is a question with two real answers
  // rather than a trap.
  arriveHome() {
    // An item card or the inventory panel opened during the step's 90ms slide
    // would otherwise swallow the question; arriving home is the more
    // important of the two.
    if (this.card.isOpen()) this.card.hide();
    if (this.inventory.isOpen()) this.inventory.hide();

    // Read before depositing: afterwards nothing is carried, which is the point.
    const summary = runSummary(this.run);
    const saved = carriedHome(summary);
    depositRun(this.run);
    this.hud.update(this.run);
    this.layOutRail();

    // Said plainly, because the game spent its whole life until now teaching the
    // opposite: that stopping was what saved and walking on was what risked it.
    // Whichever button is tapped, what is written down is already written.
    const both = summary.cheats ? HUT.bothWaysCheats : HUT.bothWays;
    this.dialog.show({
      title: HUT.title,
      lines: [
        summary.cheats
          ? HUT.cheats
          : saved.length
            ? HUT.written(sentence(CARRIED.list(saved)))
            : HUT.nothingNew,
        ...both,
      ],
      buttons: [
        { label: HUT.headBackOut, onClick: () => this.headBackOut() },
        { label: HUT.endHere, onClick: () => this.showRecap() },
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
    this.hud.flash(FLASH.bought(itemDef(id).name, spendable(this.run)));
  }

  // Both the water and the writing-down happened on arrival, so heading back out
  // is only closing the dialog — the hut is a base to push out from again, not a
  // decision to make.
  headBackOut() {
    this.dialog.hide();
    this.hud.update(this.run);
    this.hud.flash(FLASH.headBackOut);
  }

  // Closing the expedition down. The walk was already written into the slot on
  // arrival (`arriveHome`); what `bankRun` adds is counting the run as finished
  // and clearing any suspended walk, since this one has come home (DESIGN.md §6).
  showRecap() {
    const summary = runSummary(this.run);
    const saved = bankRun(this.run);
    // What's coming home, and how much walking is left in it.
    const carried = [
      ...summary.lights.map((light) => RECAP.carriedLight(itemDef(light.id).name, light.durability)),
      ...summary.keys.map((id) => itemDef(id).name),
      ...summary.tools.map((id) => itemDef(id).name),
    ];
    this.dialog.show({
      title: RECAP.title,
      rows: [
        [RECAP.rowExplored, summary.explored],
        [RECAP.rowNewGround, summary.newGround],
        [RECAP.rowCoins, summary.coins],
        [RECAP.rowLights, summary.lightsFound],
        [RECAP.rowColours, RECAP.colours(saved.gems, MAX_GEMS)],
        [RECAP.rowFurthest, summary.furthest],
        [RECAP.rowSteps, summary.steps],
      ],
      footer: summary.cheats
        ? RECAP.cheats
        : carried.length
          ? RECAP.carrying(carried.join(', '))
          : RECAP.carryingNothing,
      buttons: [{ label: RECAP.home, onClick: () => this.scene.start('TitleScene') }],
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
      title: DEATH.title,
      lines: [
        atRisk.length
          ? DEATH.collapsed(sentence(CARRIED.list(atRisk)), atRisk.length > 1)
          : DEATH.collapsedEmptyHanded,
        DEATH.groundKept,
      ],
      rows: [
        [DEATH.rowExplored, summary.explored],
        [DEATH.rowNewGround, summary.newGround],
        [DEATH.rowFurthest, summary.furthest],
        [DEATH.rowSteps, summary.steps],
      ],
      buttons: [{ label: DEATH.home, onClick: () => this.scene.start('TitleScene') }],
    });
  }

  // hud.update() resets the status line, so anything worth saying about the
  // step just taken is said after it.
  announce(result) {
    // A gem outranks everything else that could have happened on the step: it
    // is the only pickup that repaints the world.
    if (result.gemFound) {
      this.hud.flash(FLASH.gemFound(itemDef(result.picked).name));
      return;
    }
    // A tool is the other pickup worth its own line: it changes what is on
    // screen, and it is only kept by walking it home.
    if (result.picked && itemDef(result.picked).tool) {
      this.hud.flash(FLASH.toolFound(itemDef(result.picked).name));
      return;
    }
    if (result.burnedOut) {
      const burned = itemDef(result.burnedId).name;
      if (result.blackout) this.hud.flash(FLASH.burnedOutBlackout(burned));
      else this.hud.flash(FLASH.burnedOutSwapped(burned));
      return;
    }
    if (result.picked === 'coin') {
      this.hud.flash(FLASH.coins(result.coinsGained));
      return;
    }
    if (result.picked) this.hud.flash(FLASH.picked(itemDef(result.picked).name));
    // Nothing was picked up, but a gate gave way, which is the other thing a
    // step can be worth saying something about.
    else if (result.unlocked) this.hud.flash(FLASH.gateOpened(itemDef(result.unlocked).name));
    // Walking back onto the hut relays everything on the ground (DESIGN.md
    // §4.3), which is worth saying — otherwise the world quietly changing under
    // a player who was heading somewhere specific reads as a bug.
    else if (result.respawned) this.hud.flash(FLASH.respawned);
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
