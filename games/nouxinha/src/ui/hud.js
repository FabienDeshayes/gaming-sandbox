// The bottom quarter of the screen: run counters, the inventory strip, the
// active light's durability, and (built by the scene) the D-pad on the right.

import { FONT, GAME_WIDTH, HUD_Y, getPalette, hex } from '../config.js';
import { itemDef } from '../data/items.js';
import { activeLight, inventoryStacks } from '../core/rules.js';
import { makeButton } from './button.js';

const PAD = 14;
const SLOT = 56;
const SLOT_GAP = 8;
const SLOT_Y = HUD_Y + 36;
const MAX_SLOTS = 4;
const INV_BUTTON_X = PAD + MAX_SLOTS * (SLOT + SLOT_GAP) + 42;

export class Hud {
  constructor(scene, { onSlot, onCoins, onInventory }) {
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
    // Opens the full scrollable list (inventoryPanel.js) — the strip only ever
    // shows MAX_SLOTS stacks, so this is the only way to browse everything once
    // a run has picked up more kinds of light than that.
    makeButton(scene, INV_BUTTON_X, SLOT_Y + SLOT / 2, 'ITEMS', onInventory, {
      width: 76,
      height: SLOT,
      fontSize: 12,
    });
    this.lightLabel = text(PAD, SLOT_Y + SLOT + 12, 13);
    this.lightBar = scene.add.graphics();
    this.status = text(PAD, SLOT_Y + SLOT + 52, 12);
  }

  update(run) {
    const pal = getPalette();
    this.explored.setText(`EXPLORED ${run.explored.size}`);
    this.coins.setText(`COINS ${run.coins}`);

    this.slots.removeAll(true);
    const stacks = inventoryStacks(run).slice(0, MAX_SLOTS);
    stacks.forEach((stack, i) => {
      const def = itemDef(stack.id);
      const x = PAD + i * (SLOT + SLOT_GAP);
      const active = stack.instances.find((inst) => inst.isActive);
      // The bar reflects the equipped copy when this stack is active, since
      // that's the durability actually burning; otherwise the freshest copy,
      // which is the one equipping next would pick by default.
      const shown = active || stack.instances.reduce((a, b) => (b.durability > a.durability ? b : a));

      const g = this.scene.add.graphics();
      g.lineStyle(2, pal.fg, 1);
      g.strokeRect(x, SLOT_Y, SLOT, SLOT);
      // The equipped light is the one burning down, so it gets the filled slot.
      if (active) {
        g.fillStyle(pal.fg, 0.18);
        g.fillRect(x, SLOT_Y, SLOT, SLOT);
      }
      // A pip of remaining durability along the bottom edge of the slot.
      const left = Math.max(0, shown.durability / def.maxDurability);
      g.fillStyle(pal.fg, 1);
      g.fillRect(x + 4, SLOT_Y + SLOT - 8, (SLOT - 8) * left, 4);

      const icon = this.scene.add
        .image(x + SLOT / 2, SLOT_Y + SLOT / 2 - 4, def.sprite)
        .setScale(2.5)
        .setTint(pal.fg);

      const parts = [g, icon];

      // Several copies of the same light stack into one slot, badged with the
      // count — the durability of each copy still only shows in the item card,
      // since they're rarely identical.
      if (stack.instances.length > 1) {
        parts.push(
          this.scene.add
            .text(x + SLOT - 4, SLOT_Y + SLOT - 8, `x${stack.instances.length}`, {
              fontFamily: FONT,
              fontSize: '12px',
              color: hex(pal.fg),
            })
            .setOrigin(1, 1)
        );
      }

      const zone = this.scene.add
        .zone(x, SLOT_Y, SLOT, SLOT)
        .setOrigin(0)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.onSlot(stack));
      parts.push(zone);

      this.slots.add(parts);
    });

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
