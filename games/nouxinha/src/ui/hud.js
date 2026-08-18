// The bottom quarter of the screen: run counters, the inventory strip, the
// active light's durability, and (built by the scene) the D-pad on the right.

import { FONT, GAME_WIDTH, HUD_Y, gemColour, getPalette, hex } from '../config.js';
import { itemDef } from '../data/items.js';
import { activeLight, inventoryStacks, maxWater } from '../core/rules.js';
import { MAX_GEMS } from '../core/save.js';
import { makeButton } from './button.js';

const PAD = 14;
const SLOT = 56;
const SLOT_GAP = 8;
const SLOT_Y = HUD_Y + 36;
const MAX_SLOTS = 4;
const INV_BUTTON_X = PAD + MAX_SLOTS * (SLOT + SLOT_GAP) + 42;

// The gem row sits under the status line, on the left where the D-pad isn't.
const GEM_Y = HUD_Y + 178;
const GEM_X = PAD + 84;
const GEM_GAP = 30;

export class Hud {
  constructor(scene, { onSlot, onCoins, onWater, onInventory }) {
    this.scene = scene;
    this.onSlot = onSlot;
    this.onCoins = onCoins;
    this.onWater = onWater;

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
    // Water is the run's one hard failure state (DESIGN.md §6), so it gets its
    // own counter in the same row rather than living only in the item card.
    this.water = text(PAD + 260, HUD_Y + 12, 14).setInteractive({ useHandCursor: true });
    this.water.on('pointerdown', () => this.onWater());

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

    // How much colour is back: one pip per gem, each in the colour it gave.
    // The ones still out there are drawn dim rather than left out, so the row
    // always says how many there are to find.
    text(PAD, GEM_Y - 7, 12).setText('COLOURS');
    this.gems = scene.add.container(0, 0);
  }

  update(run) {
    const pal = getPalette();
    this.explored.setText(`EXPLORED ${run.explored.size}`);
    this.coins.setText(`COINS ${run.coins}`);
    this.water.setText(`WATER ${run.water}/${maxWater(run.gems)}`);

    this.gems.removeAll(true);
    for (let i = 1; i <= MAX_GEMS; i++) {
      const held = i <= run.gems;
      this.gems.add(
        this.scene.add
          .image(GEM_X + (i - 1) * GEM_GAP, GEM_Y, 'gem')
          .setScale(1.4)
          .setTint(held ? gemColour(i) : pal.fg)
          .setAlpha(held ? 1 : 0.25)
      );
    }

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
        .setTint(gemColour(def.hue || 0));

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
      this.status.setText('BLACKOUT. ONLY WHAT IS RIGHT AROUND YOU IS VISIBLE.');
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
