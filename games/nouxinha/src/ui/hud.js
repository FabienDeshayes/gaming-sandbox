// The bottom quarter of the screen: run counters, the inventory strip, the
// active light's durability, and (built by the scene) the D-pad on the right.

import { FONT, GAME_WIDTH, HUD_Y, getPalette, hex } from '../config.js';
import { itemDef } from '../data/items.js';
import { activeLight } from '../core/rules.js';

const PAD = 14;
const SLOT = 56;
const SLOT_GAP = 8;
const SLOT_Y = HUD_Y + 36;
const MAX_SLOTS = 4;

export class Hud {
  constructor(scene, { onSlot, onCoins }) {
    this.scene = scene;
    this.onSlot = onSlot;
    this.onCoins = onCoins;

    const pal = getPalette();
    const text = (x, y, size) =>
      scene.add.text(x, y, '', { fontFamily: FONT, fontSize: `${size}px`, color: hex(pal.fg) });

    // The rule separating map from HUD.
    const divider = scene.add.graphics();
    divider.lineStyle(2, pal.fg, 1);
    divider.lineBetween(0, HUD_Y, GAME_WIDTH, HUD_Y);

    this.explored = text(PAD, HUD_Y + 12, 14);
    this.coins = text(PAD + 170, HUD_Y + 12, 14).setInteractive({ useHandCursor: true });
    this.coins.on('pointerdown', () => this.onCoins());

    this.slots = scene.add.container(0, 0);
    this.lightLabel = text(PAD, SLOT_Y + SLOT + 12, 13);
    this.lightBar = scene.add.graphics();
    this.status = text(PAD, SLOT_Y + SLOT + 52, 12);
  }

  update(run) {
    const pal = getPalette();
    this.explored.setText(`EXPLORED ${run.explored.size}`);
    this.coins.setText(`COINS ${run.coins}`);

    this.slots.removeAll(true);
    const shown = run.inventory.slice(0, MAX_SLOTS);
    shown.forEach((slot, i) => {
      const def = itemDef(slot.id);
      const x = PAD + i * (SLOT + SLOT_GAP);
      const isActive = i === run.activeIndex;

      const g = this.scene.add.graphics();
      g.lineStyle(2, pal.fg, 1);
      g.strokeRect(x, SLOT_Y, SLOT, SLOT);
      // The equipped light is the one burning down, so it gets the filled slot.
      if (isActive) {
        g.fillStyle(pal.fg, 0.18);
        g.fillRect(x, SLOT_Y, SLOT, SLOT);
      }
      // A pip of remaining durability along the bottom edge of the slot.
      const left = Math.max(0, slot.durability / def.maxDurability);
      g.fillStyle(pal.fg, 1);
      g.fillRect(x + 4, SLOT_Y + SLOT - 8, (SLOT - 8) * left, 4);

      const icon = this.scene.add
        .image(x + SLOT / 2, SLOT_Y + SLOT / 2 - 4, def.sprite)
        .setScale(2.5)
        .setTint(pal.fg);

      const zone = this.scene.add
        .zone(x, SLOT_Y, SLOT, SLOT)
        .setOrigin(0)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.onSlot(i));

      this.slots.add([g, icon, zone]);
    });

    if (run.inventory.length > MAX_SLOTS) {
      const x = PAD + MAX_SLOTS * (SLOT + SLOT_GAP);
      this.slots.add(
        this.scene.add.text(x, SLOT_Y + SLOT / 2 - 8, `+${run.inventory.length - MAX_SLOTS}`, {
          fontFamily: FONT,
          fontSize: '14px',
          color: hex(pal.fg),
        })
      );
    }

    this.drawLight(run, pal);
  }

  drawLight(run, pal) {
    const light = activeLight(run);
    this.lightBar.clear();

    if (!light) {
      this.lightLabel.setText('NO LIGHT');
      this.status.setText('BLACKOUT. WALK HOME ON WHAT YOU REMEMBER.');
      return;
    }

    const def = itemDef(light.id);
    this.lightLabel.setText(`${def.name}  ${light.durability}/${def.maxDurability}`);
    this.status.setText('TAP AN ITEM FOR DETAILS.');

    const barW = 240;
    const barY = SLOT_Y + SLOT + 32;
    this.lightBar.lineStyle(2, pal.fg, 1);
    this.lightBar.strokeRect(PAD, barY, barW, 12);
    this.lightBar.fillStyle(pal.fg, 1);
    this.lightBar.fillRect(PAD + 2, barY + 2, (barW - 4) * (light.durability / def.maxDurability), 8);
  }

  // Transient line for the things worth calling out the moment they happen.
  flash(message) {
    this.status.setText(message);
  }
}
