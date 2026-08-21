// The merchant's counter: a list of what's for sale, what it costs, and what
// this run can afford.
//
// A modal in the same family as dialog.js, but with a row per line of stock
// rather than a paragraph, because the whole point of the screen is comparing
// six prices against one number. Like every other overlay it owns the screen
// while it's up (DESIGN.md §7).

import { FONT, GAME_HEIGHT, GAME_WIDTH, gemColour, getPalette, hex } from '../config.js';
import { itemDef } from '../data/items.js';
import { PRICES, STOCK, isOneOff } from '../data/shop.js';
import { canBuy, spendable } from '../core/rules.js';
import { makeButton } from './button.js';
import { playTap } from './sfx.js';

const PANEL_W = 420;
const PAD = 22;
const TITLE_H = 40;
const PURSE_H = 30;
const ROW_H = 52;
const BUTTON_H = 44;
const BUTTON_W = 170;

// A row the run can't act on is dimmed rather than hidden, so the shop always
// says what it has and the player can see what they're saving towards.
const DIM = 0.3;

export class Shop {
  constructor(scene, { onBuy, onLeave }) {
    this.scene = scene;
    this.onBuy = onBuy;
    this.onLeave = onLeave;
    this.open = false;
    this.container = scene.add.container(0, 0).setVisible(false).setDepth(200);
  }

  isOpen() {
    return this.open;
  }

  // Re-rendered rather than patched after every purchase: a sale moves the
  // purse, which moves what every other row can do.
  show(run) {
    const pal = getPalette();
    const scene = this.scene;
    this.run = run;
    this.container.removeAll(true);

    const panelH = PAD + TITLE_H + PURSE_H + STOCK.length * ROW_H + 20 + BUTTON_H + PAD;
    const cx = GAME_WIDTH / 2;
    const top = (GAME_HEIGHT - panelH) / 2;
    const left = cx - PANEL_W / 2;

    const backdrop = scene.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, pal.bg, 0.94)
      .setOrigin(0)
      .setInteractive();

    const panel = scene.add.graphics();
    panel.fillStyle(pal.bg, 1);
    panel.fillRect(left, top, PANEL_W, panelH);
    panel.lineStyle(2, pal.fg, 1);
    panel.strokeRect(left, top, PANEL_W, panelH);

    const parts = [backdrop, panel];
    const label = (x, y, text, size, origin = 0) =>
      scene.add
        .text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, color: hex(pal.fg) })
        .setOrigin(origin, 0.5);

    parts.push(label(cx, top + PAD + TITLE_H / 2, 'THE MERCHANT', 20, 0.5));
    parts.push(
      label(cx, top + PAD + TITLE_H + PURSE_H / 2, `YOU HAVE ${spendable(run)} COINS`, 13, 0.5)
    );

    let y = top + PAD + TITLE_H + PURSE_H;
    for (const id of STOCK) {
      const def = itemDef(id);
      const owned = isOneOff(id) && run.tools.has(id);
      const affordable = canBuy(run, id);
      const alpha = affordable ? 1 : DIM;

      const row = scene.add.graphics();
      row.lineStyle(1, pal.fg, alpha * 0.6);
      row.strokeRect(left + PAD, y + 4, PANEL_W - PAD * 2, ROW_H - 8);

      const icon = scene.add
        .image(left + PAD + 26, y + ROW_H / 2, def.sprite)
        .setScale(1.6)
        .setTint(gemColour(def.hue || 0))
        .setAlpha(alpha);

      const name = label(left + PAD + 52, y + ROW_H / 2, def.name, 13).setAlpha(alpha);
      const price = label(
        left + PANEL_W - PAD - 12,
        y + ROW_H / 2,
        owned ? 'OWNED' : `${PRICES[id]}`,
        13,
        1
      ).setAlpha(alpha);

      parts.push(row, icon, name, price);

      if (affordable) {
        const zone = scene.add
          .zone(left + PAD, y + 4, PANEL_W - PAD * 2, ROW_H - 8)
          .setOrigin(0)
          .setInteractive({ useHandCursor: true });
        zone.on('pointerdown', () => {
          playTap();
          this.onBuy(id);
        });
        parts.push(zone);
      }
      y += ROW_H;
    }

    parts.push(
      makeButton(scene, cx, top + panelH - PAD - BUTTON_H / 2, 'LEAVE', () => this.onLeave(), {
        width: BUTTON_W,
        height: BUTTON_H,
        fontSize: 13,
      })
    );

    this.container.add(parts);
    this.container.setVisible(true);
    this.open = true;
  }

  hide() {
    this.container.setVisible(false);
    this.container.removeAll(true);
    this.open = false;
  }
}
