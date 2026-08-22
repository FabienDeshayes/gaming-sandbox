// The bottom quarter of the screen: the grouped run counters, the inventory
// strip, the active light's durability, and (built by the scene) the D-pad on
// the right.

import { FONT, GAME_WIDTH, HUD_Y, gemColour, getPalette, hex } from '../config.js';
import { itemDef } from '../data/items.js';
import { activeLight, inventoryStacks, maxWater, spendable } from '../core/rules.js';
import { playTap } from './sfx.js';

const PAD = 14;
const SLOT = 48;
const SLOT_GAP = 6;
const SLOT_Y = HUD_Y + 66;
// The strip shows this many carried-light stacks, plus one more same-sized
// box for ITEMS — anything past that lives in the full panel it opens
// (DESIGN.md §7).
const MAX_SLOTS = 3;
const ITEMS_INDEX = MAX_SLOTS;

// The grouped counters row: explored ground and the coin purse, each with an
// icon off the sheet rather than a bare number.
const COUNTER_Y = HUD_Y + 14;
const EXPLORED_ICON_X = PAD;
const EXPLORED_TEXT_X = PAD + 20;
const COINS_ICON_X = PAD + 138;
const COINS_TEXT_X = PAD + 158;

// Water sits on its own line right under that row, because unlike the other
// two it also gets a bar — the same treatment the active light gets below.
const WATER_Y = HUD_Y + 40;
const WATER_ICON_X = PAD;
const WATER_TEXT_X = PAD + 20;
const WATER_BAR_X = PAD + 128;
const WATER_BAR_W = 96;
const WATER_BAR_H = 8;

export class Hud {
  constructor(scene, { onSlot, onCoins, onWater, onInventory }) {
    this.scene = scene;
    this.onSlot = onSlot;
    this.onCoins = onCoins;
    this.onWater = onWater;
    this.onInventory = onInventory;

    const pal = getPalette();
    const text = (x, y, size) =>
      scene.add.text(x, y, '', { fontFamily: FONT, fontSize: `${size}px`, color: hex(pal.fg) });

    // The rule separating map from HUD.
    const divider = scene.add.graphics();
    divider.lineStyle(2, pal.fg, 1);
    divider.lineBetween(0, HUD_Y, GAME_WIDTH, HUD_Y);

    this.exploredIcon = scene.add.image(EXPLORED_ICON_X, COUNTER_Y + 6, 'map').setOrigin(0, 0.5).setScale(1.1);
    this.explored = text(EXPLORED_TEXT_X, COUNTER_Y, 13);

    // The purse, not this run's haul: it is the number that decides whether the
    // merchant will sell you something, and it is what the counter shows you
    // (DESIGN.md §4.5). What this expedition found on its own is a separate line
    // in the recap.
    this.coinsIcon = scene.add
      .image(COINS_ICON_X, COUNTER_Y + 6, 'coin')
      .setOrigin(0, 0.5)
      .setScale(1.1)
      .setInteractive({ useHandCursor: true });
    this.coins = text(COINS_TEXT_X, COUNTER_Y, 13).setInteractive({ useHandCursor: true });
    for (const obj of [this.coinsIcon, this.coins])
      obj.on('pointerdown', () => {
        playTap();
        this.onCoins();
      });

    // Water is the run's one hard failure state (DESIGN.md §6), so besides the
    // grouped counters it also gets a bar, the same visual language the active
    // light gets below.
    this.waterIcon = scene.add
      .image(WATER_ICON_X, WATER_Y + 6, 'water-drop')
      .setOrigin(0, 0.5)
      .setScale(1.1)
      .setInteractive({ useHandCursor: true });
    this.water = text(WATER_TEXT_X, WATER_Y, 13).setInteractive({ useHandCursor: true });
    this.waterBar = scene.add.graphics();
    for (const obj of [this.waterIcon, this.water])
      obj.on('pointerdown', () => {
        playTap();
        this.onWater();
      });

    this.slots = scene.add.container(0, 0);
    this.lightLabel = text(PAD, SLOT_Y + SLOT + 12, 13);
    this.lightBar = scene.add.graphics();
    this.status = text(PAD, SLOT_Y + SLOT + 54, 12);
  }

  update(run) {
    const pal = getPalette();
    this.explored.setText(`EXPLORED ${run.explored.size}`);
    this.coins.setText(`COINS ${spendable(run)}`);
    this.water.setText(`WATER ${run.water}/${maxWater(run.gems)}`);

    this.waterBar.clear();
    this.waterBar.lineStyle(1, pal.fg, 1);
    this.waterBar.strokeRect(WATER_BAR_X, WATER_Y - WATER_BAR_H / 2, WATER_BAR_W, WATER_BAR_H);
    this.waterBar.fillStyle(pal.fg, 1);
    const waterFilled = Math.max(0, run.water / maxWater(run.gems));
    this.waterBar.fillRect(
      WATER_BAR_X + 1,
      WATER_Y - WATER_BAR_H / 2 + 1,
      (WATER_BAR_W - 2) * waterFilled,
      WATER_BAR_H - 2
    );

    this.slots.removeAll(true);
    const stacks = inventoryStacks(run).slice(0, MAX_SLOTS);
    stacks.forEach((stack, i) => this.slots.add(this.buildStackSlot(stack, i, pal)));
    this.slots.add(this.buildItemsSlot(pal));

    this.drawLight(run, pal);
  }

  // One bordered SLOT×SLOT box per carried-light stack — icon, a durability
  // pip along the bottom edge, and a ×N badge for more than one copy.
  buildStackSlot(stack, i, pal) {
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
    g.fillRect(x + 4, SLOT_Y + SLOT - 7, (SLOT - 8) * left, 3);

    const icon = this.scene.add
      .image(x + SLOT / 2, SLOT_Y + SLOT / 2 - 3, def.sprite)
      .setScale(2.1)
      .setTint(gemColour(def.hue || 0));

    const parts = [g, icon];

    // Several copies of the same light stack into one slot, badged with the
    // count — the durability of each copy still only shows in the item card,
    // since they're rarely identical.
    if (stack.instances.length > 1) {
      parts.push(
        this.scene.add
          .text(x + SLOT - 3, SLOT_Y + SLOT - 7, `x${stack.instances.length}`, {
            fontFamily: FONT,
            fontSize: '11px',
            color: hex(pal.fg),
          })
          .setOrigin(1, 1)
      );
    }

    const zone = this.scene.add
      .zone(x, SLOT_Y, SLOT, SLOT)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => {
      playTap();
      this.onSlot(stack);
    });
    parts.push(zone);

    return parts;
  }

  // ITEMS opens the full scrollable list (inventoryPanel.js) — the strip only
  // ever shows MAX_SLOTS stacks, so this is the only way to browse everything
  // once a run has picked up more kinds of light than that. Drawn as the same
  // bordered box as every other slot, listed right after them, rather than as
  // a button of its own off to one side.
  buildItemsSlot(pal) {
    const x = PAD + ITEMS_INDEX * (SLOT + SLOT_GAP);

    const g = this.scene.add.graphics();
    g.lineStyle(2, pal.fg, 1);
    g.strokeRect(x, SLOT_Y, SLOT, SLOT);

    const label = this.scene.add
      .text(x + SLOT / 2, SLOT_Y + SLOT / 2, 'ITEMS', {
        fontFamily: FONT,
        fontSize: '11px',
        color: hex(pal.fg),
        align: 'center',
        wordWrap: { width: SLOT - 8 },
      })
      .setOrigin(0.5);

    const zone = this.scene.add
      .zone(x, SLOT_Y, SLOT, SLOT)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => {
      playTap();
      this.onInventory();
    });

    return [g, label, zone];
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

    const barW = 220;
    const barY = SLOT_Y + SLOT + 32;
    this.lightBar.lineStyle(2, pal.fg, 1);
    this.lightBar.strokeRect(PAD, barY, barW, 12);
    this.lightBar.fillStyle(pal.fg, 1);
    this.lightBar.fillRect(PAD + 2, barY + 2, (barW - 4) * (light.durability / def.maxDurability), 8);
  }

  // Transient line for the things worth calling out the moment they happen —
  // there is no default message under it any more, so it stays blank between
  // them.
  flash(message) {
    this.status.setText(message);
  }
}
