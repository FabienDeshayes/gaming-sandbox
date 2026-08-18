// The game: a wizard, a torch burning down a step at a time, and a lot of dark.

import { FONT, GAME_WIDTH, VIEW_H, getPalette, hex } from '../config.js';
import {
  DIRECTIONS,
  bankRun,
  createRun,
  equip,
  inventoryStacks,
  refillWater,
  runSummary,
  step,
} from '../core/rules.js';
import { DEFAULT_SEED } from '../core/world.js';
import { MAX_GEMS } from '../core/save.js';
import { itemDef } from '../data/items.js';
import { ensureTextures } from '../ui/textures.js';
import { MapView } from '../ui/MapView.js';
import { Hud } from '../ui/hud.js';
import { ItemCard } from '../ui/itemCard.js';
import { InventoryPanel } from '../ui/inventoryPanel.js';
import { Dialog } from '../ui/dialog.js';
import { makeDpad } from '../ui/dpad.js';
import { playPickup, unlockAudio } from '../ui/sfx.js';

const DPAD_CX = 388;
const DPAD_CY = 748;

// Below this, a drag is a tap that wandered rather than a swipe.
const SWIPE_MIN = 24;

export class ExploreScene extends Phaser.Scene {
  constructor() {
    super('ExploreScene');
  }

  create(data) {
    ensureTextures(this);
    const pal = getPalette();
    this.cameras.main.setBackgroundColor(pal.bg);

    this.run = createRun(data && data.seed !== undefined ? data.seed : DEFAULT_SEED);
    // Blocks input while the world is sliding, so a fast tapper can't queue
    // steps the renderer hasn't caught up with.
    this.animating = false;

    this.map = new MapView(this);
    this.hud = new Hud(this, {
      onSlot: (stack) => this.openStack(stack),
      onCoins: () => !this.modalOpen() && this.card.show({ def: itemDef('coin') }),
      onWater: () => !this.modalOpen() && this.card.show({ def: itemDef('water-drop') }),
      onInventory: () => !this.modalOpen() && this.inventory.show(inventoryStacks(this.run)),
    });
    this.card = new ItemCard(this, { onEquip: (i) => this.equipSlot(i) });
    this.inventory = new InventoryPanel(this, { onOpenStack: (stack) => this.openStack(stack) });
    this.dialog = new Dialog(this);

    makeDpad(this, DPAD_CX, DPAD_CY, (dir) => this.tryStep(dir));
    this.buildMenuButton(pal);
    this.bindInput();

    this.map.refresh(this.run);
    this.hud.update(this.run);
  }

  buildMenuButton(pal) {
    const g = this.add.graphics();
    g.lineStyle(2, pal.fg, 1);
    g.strokeRect(GAME_WIDTH - 62, 14, 48, 34);
    this.add
      .text(GAME_WIDTH - 38, 31, 'X', { fontFamily: FONT, fontSize: '16px', color: hex(pal.fg) })
      .setOrigin(0.5);
    this.add
      .zone(GAME_WIDTH - 62, 14, 48, 34)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => !this.modalOpen() && this.scene.start('TitleScene'));
  }

  // The card, the inventory panel, and the hut's dialog all own the whole
  // screen while they're up: nothing behind them steps, swipes, or reacts to a key.
  modalOpen() {
    return this.card.isOpen() || this.inventory.isOpen() || this.dialog.isOpen();
  }

  bindInput() {
    this.input.on('pointerdown', (p) => {
      // The player has touched the page, which is what lets the pickup blip
      // through the browser's autoplay policy.
      unlockAudio();
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
      if (this.card.isOpen()) this.card.hide();
      if (this.inventory.isOpen()) this.inventory.hide();
    });
  }

  tryStep(direction) {
    if (this.animating || this.modalOpen()) return;
    unlockAudio();

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
    this.announce(result);
    if (result.picked) playPickup(result.picked);

    this.animating = true;
    this.map.slide(this, DIRECTIONS[direction], () => {
      this.animating = false;
      // Asked/shown once the world has finished moving, so the question or the
      // death screen doesn't land over a sliding map. Death takes priority over
      // the hut's question — dying in the doorway is still dying.
      if (result.died) this.showDeath();
      else if (result.atBase) this.askToStop();
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
    const carrying = runSummary(this.run).gemsCarried;
    this.dialog.show({
      title: 'BACK AT THE HUT',
      lines: carrying
        ? [
            `Stopping here saves ${carrying === 1 ? 'the colour' : `all ${carrying} colours`} you are carrying.`,
            'Head back out and you carry them at your own risk.',
          ]
        : ['Call it here, or head back out?'],
      buttons: [
        { label: 'KEEP GOING', onClick: () => this.resupply() },
        { label: 'STOP HERE', onClick: () => this.showRecap() },
      ],
    });
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
    const carried = summary.lights.length
      ? summary.lights
          .map((light) => `${itemDef(light.id).name} ${light.durability}`)
          .join(', ')
      : 'NOTHING';
    this.dialog.show({
      title: 'EXPEDITION OVER',
      rows: [
        ['TILES EXPLORED', summary.explored],
        ['COINS', summary.coins],
        ['LIGHTS FOUND', summary.lightsFound],
        ['COLOURS SAVED', `${saved.gems}/${MAX_GEMS}`],
        ['FURTHEST OUT', summary.furthest],
        ['STEPS TAKEN', summary.steps],
      ],
      footer: `CARRYING ${carried}`,
      buttons: [{ label: 'HOME', onClick: () => this.scene.start('TitleScene') }],
    });
  }

  // Running out of water is the run's one hard failure state (DESIGN.md §6):
  // unlike the hut's recap, there's nothing to carry home from it, and nothing
  // is written — a gem that never made it back to the hut is still out there.
  showDeath() {
    if (this.card.isOpen()) this.card.hide();
    if (this.inventory.isOpen()) this.inventory.hide();
    const summary = runSummary(this.run);
    this.dialog.show({
      title: 'OUT OF WATER',
      lines: [
        summary.gemsCarried
          ? 'You collapsed in the dark. The colour you were carrying is back where you found it.'
          : 'You collapsed in the dark. Everything you carried is lost.',
      ],
      rows: [
        ['TILES EXPLORED', summary.explored],
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
    if (result.burnedOut) {
      const burned = itemDef(result.burnedId).name;
      if (result.blackout) this.hud.flash(`${burned} BURNED OUT. NO LIGHT LEFT.`);
      else this.hud.flash(`${burned} BURNED OUT. SWITCHED TO NEXT LIGHT.`);
      return;
    }
    if (result.picked) this.hud.flash(`FOUND ${itemDef(result.picked).name}.`);
  }

  // `stack` is one entry of `inventoryStacks(run)` — see core/rules.js. Called
  // from both a tapped HUD slot and a tapped row in the inventory panel.
  openStack(stack) {
    if (this.modalOpen()) return;
    this.card.show({ def: itemDef(stack.id), instances: stack.instances });
  }

  equipSlot(index) {
    if (!equip(this.run, index)) return;
    this.map.refresh(this.run);
    this.hud.update(this.run);
  }
}
