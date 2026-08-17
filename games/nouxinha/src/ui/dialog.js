// A modal panel with a title, some body text, and a row of buttons.
//
// The item card (itemCard.js) is its own thing because it lays out a sprite and
// a durability bar; this is the plain-text modal the run uses to ask a question
// ("stop here?") and to sign a run off (the recap). Both of those block the
// world the same way the card does — the scene checks `isOpen()` before it lets
// a step through.

import { FONT, GAME_HEIGHT, GAME_WIDTH, getPalette, hex } from '../config.js';
import { makeButton } from './button.js';

const PANEL_W = 380;
const PAD = 26;
const TITLE_H = 48;
const LINE_H = 24;
const ROW_H = 28;
const BUTTON_H = 44;
const BUTTON_W = 158;
const BUTTON_GAP = 16;

export class Dialog {
  constructor(scene) {
    this.scene = scene;
    this.open = false;
    // Above the item card, so a dialog opened over one still owns the screen.
    this.container = scene.add.container(0, 0).setVisible(false).setDepth(200);
  }

  isOpen() {
    return this.open;
  }

  // Laid out top to bottom: `lines` and `footer` are centred sentences either
  // side of `rows`, which are [label, value] pairs in a two-column readout, and
  // `buttons` are [{ label, onClick }] across the bottom. A dialog has no close
  // control of its own: every way out is one of its buttons, because both of its
  // uses are decisions rather than inspections.
  show({ title, lines = [], rows = [], footer = null, buttons = [] }) {
    const pal = getPalette();
    const scene = this.scene;
    this.container.removeAll(true);

    const bodyH =
      lines.length * LINE_H +
      (lines.length && rows.length ? 12 : 0) +
      rows.length * ROW_H +
      (footer ? LINE_H + (rows.length ? 8 : 0) : 0);
    const panelH = PAD + TITLE_H + bodyH + 24 + BUTTON_H + PAD;

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const top = cy - panelH / 2;
    const left = cx - PANEL_W / 2;

    // Swallows every tap that isn't a button, so the world behind can't be
    // walked while the question is on screen.
    const backdrop = scene.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, pal.bg, 0.92)
      .setOrigin(0)
      .setInteractive();

    const panel = scene.add.graphics();
    panel.fillStyle(pal.bg, 1);
    panel.fillRect(left, top, PANEL_W, panelH);
    panel.lineStyle(2, pal.fg, 1);
    panel.strokeRect(left, top, PANEL_W, panelH);

    const parts = [backdrop, panel];

    parts.push(
      scene.add
        .text(cx, top + PAD + 12, title, {
          fontFamily: FONT,
          fontSize: '20px',
          color: hex(pal.fg),
        })
        .setOrigin(0.5)
    );

    let y = top + PAD + TITLE_H;
    for (const line of lines) {
      parts.push(
        scene.add
          .text(cx, y, line, {
            fontFamily: FONT,
            fontSize: '14px',
            color: hex(pal.fg),
            align: 'center',
            wordWrap: { width: PANEL_W - PAD * 2 },
          })
          .setOrigin(0.5, 0)
      );
      y += LINE_H;
    }
    if (lines.length && rows.length) y += 12;

    for (const [label, value] of rows) {
      const style = { fontFamily: FONT, fontSize: '14px', color: hex(pal.fg) };
      parts.push(scene.add.text(left + PAD, y, label, style).setOrigin(0, 0));
      parts.push(
        scene.add.text(left + PANEL_W - PAD, y, String(value), style).setOrigin(1, 0)
      );
      y += ROW_H;
    }

    if (footer) {
      if (rows.length) y += 8;
      parts.push(
        scene.add
          .text(cx, y, footer, {
            fontFamily: FONT,
            fontSize: '13px',
            color: hex(pal.fg),
            align: 'center',
            wordWrap: { width: PANEL_W - PAD * 2 },
          })
          .setOrigin(0.5, 0)
      );
    }

    const buttonY = top + panelH - PAD - BUTTON_H / 2;
    const span = buttons.length * BUTTON_W + (buttons.length - 1) * BUTTON_GAP;
    buttons.forEach((button, i) => {
      const bx = cx - span / 2 + BUTTON_W / 2 + i * (BUTTON_W + BUTTON_GAP);
      parts.push(
        makeButton(scene, bx, buttonY, button.label, button.onClick, {
          width: BUTTON_W,
          height: BUTTON_H,
          fontSize: 13,
        })
      );
    });

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
