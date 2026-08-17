// The item card: an overlay opened from an inventory slot showing what an item
// is, how much of it is left, and what it does (DESIGN.md §7).
//
// Opening one costs no step — the game is turn-based on movement only.

import { FONT, GAME_HEIGHT, GAME_WIDTH, getPalette, hex } from '../config.js';
import { makeButton } from './button.js';

const PANEL_W = 380;
const PANEL_H = 340;

export class ItemCard {
  constructor(scene, { onEquip }) {
    this.scene = scene;
    this.onEquip = onEquip;
    this.open = false;
    this.container = scene.add.container(0, 0).setVisible(false).setDepth(100);
  }

  isOpen() {
    return this.open;
  }

  // `slot` is { def, durability, index, isActive } — durability/index/isActive
  // are absent for the coin card, which is opened from the HUD counter.
  show(slot) {
    const pal = getPalette();
    const scene = this.scene;
    this.container.removeAll(true);

    // A full-screen backdrop that also swallows taps: anywhere outside the panel closes.
    const backdrop = scene.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, pal.bg, 0.88)
      .setOrigin(0)
      .setInteractive();
    backdrop.on('pointerdown', () => this.hide());

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2 - 40;

    const panel = scene.add.graphics();
    panel.fillStyle(pal.bg, 1);
    panel.fillRect(cx - PANEL_W / 2, cy - PANEL_H / 2, PANEL_W, PANEL_H);
    panel.lineStyle(2, pal.fg, 1);
    panel.strokeRect(cx - PANEL_W / 2, cy - PANEL_H / 2, PANEL_W, PANEL_H);
    // Taps on the panel itself must not reach the backdrop and close the card.
    const panelZone = scene.add
      .zone(cx, cy, PANEL_W, PANEL_H)
      .setOrigin(0.5)
      .setInteractive();
    panelZone.on('pointerdown', (p, x, y, event) => event.stopPropagation());

    const title = scene.add
      .text(cx, cy - PANEL_H / 2 + 26, slot.def.name, {
        fontFamily: FONT,
        fontSize: '20px',
        color: hex(pal.fg),
      })
      .setOrigin(0.5);

    const sprite = scene.add
      .image(cx, cy - 64, slot.def.sprite)
      .setScale(6)
      .setTint(pal.fg);

    const parts = [backdrop, panel, panelZone, title, sprite];

    let y = cy + 16;
    if (slot.def.isLight) {
      const value = `${slot.durability} / ${slot.def.maxDurability}`;
      parts.push(
        scene.add
          .text(cx, y, `DURABILITY  ${value}`, {
            fontFamily: FONT,
            fontSize: '16px',
            color: hex(pal.fg),
          })
          .setOrigin(0.5)
      );

      const barW = 260;
      const filled = Math.max(0, slot.durability / slot.def.maxDurability);
      const bar = scene.add.graphics();
      bar.lineStyle(2, pal.fg, 1);
      bar.strokeRect(cx - barW / 2, y + 18, barW, 12);
      bar.fillStyle(pal.fg, 1);
      bar.fillRect(cx - barW / 2 + 2, y + 20, (barW - 4) * filled, 8);
      parts.push(bar);
      y += 48;
    }

    parts.push(
      scene.add
        .text(cx, y + 6, slot.def.effect, {
          fontFamily: FONT,
          fontSize: '14px',
          color: hex(pal.fg),
          align: 'center',
          wordWrap: { width: PANEL_W - 48 },
        })
        .setOrigin(0.5, 0)
    );

    const buttonY = cy + PANEL_H / 2 + 44;
    if (slot.def.isLight) {
      const equip = makeButton(
        scene,
        cx - 96,
        buttonY,
        slot.isActive ? 'EQUIPPED' : 'EQUIP',
        () => {
          this.onEquip(slot.index);
          this.hide();
        },
        { width: 160, height: 44, enabled: !slot.isActive }
      );
      parts.push(equip);
    }

    parts.push(
      makeButton(scene, slot.def.isLight ? cx + 96 : cx, buttonY, 'CLOSE', () => this.hide(), {
        width: 160,
        height: 44,
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
