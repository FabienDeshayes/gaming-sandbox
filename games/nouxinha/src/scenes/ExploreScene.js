// The game: a wizard, a torch burning down a step at a time, and a lot of dark.

import { FONT, GAME_WIDTH, VIEW_H, getPalette, hex } from '../config.js';
import { DIRECTIONS, createRun, equip, step } from '../core/rules.js';
import { DEFAULT_SEED } from '../core/world.js';
import { itemDef } from '../data/items.js';
import { ensureTextures } from '../ui/textures.js';
import { MapView } from '../ui/MapView.js';
import { Hud } from '../ui/hud.js';
import { ItemCard } from '../ui/itemCard.js';
import { makeDpad } from '../ui/dpad.js';

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
      onSlot: (i) => this.openSlot(i),
      onCoins: () => this.card.show({ def: itemDef('coin') }),
    });
    this.card = new ItemCard(this, { onEquip: (i) => this.equipSlot(i) });

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
      .on('pointerdown', () => this.scene.start('TitleScene'));
  }

  bindInput() {
    this.input.on('pointerdown', (p) => {
      // Only the map area swipes; the HUD is buttons, and an open card owns
      // every pointer on screen.
      this.swipeFrom = !this.card.isOpen() && p.y < VIEW_H ? { x: p.x, y: p.y } : null;
    });

    this.input.on('pointerup', (p) => {
      const start = this.swipeFrom;
      this.swipeFrom = null;
      if (!start || this.card.isOpen()) return;
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
    this.input.keyboard.on('keydown-ESC', () => this.card.isOpen() && this.card.hide());
  }

  tryStep(direction) {
    if (this.animating || this.card.isOpen()) return;

    const result = step(this.run, direction);
    if (!result.moved) {
      this.animating = true;
      this.map.bump(this, DIRECTIONS[direction], () => {
        this.animating = false;
      });
      return;
    }

    this.map.refresh(this.run);
    this.hud.update(this.run);
    this.announce(result);

    this.animating = true;
    this.map.slide(this, DIRECTIONS[direction], () => {
      this.animating = false;
    });
  }

  // hud.update() resets the status line, so anything worth saying about the
  // step just taken is said after it.
  announce(result) {
    if (result.burnedOut) {
      const burned = itemDef(result.burnedId).name;
      if (result.blackout) this.hud.flash(`${burned} BURNED OUT. NO LIGHT LEFT.`);
      else this.hud.flash(`${burned} BURNED OUT. SWITCHED TO NEXT LIGHT.`);
      return;
    }
    if (result.picked) this.hud.flash(`FOUND ${itemDef(result.picked).name}.`);
  }

  openSlot(index) {
    const slot = this.run.inventory[index];
    if (!slot) return;
    this.card.show({
      def: itemDef(slot.id),
      durability: slot.durability,
      index,
      isActive: index === this.run.activeIndex,
    });
  }

  equipSlot(index) {
    if (!equip(this.run, index)) return;
    this.map.refresh(this.run);
    this.hud.update(this.run);
  }
}
