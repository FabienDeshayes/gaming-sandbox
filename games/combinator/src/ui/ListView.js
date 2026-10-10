// A paged list of rows that can be clicked, hovered or dragged from: the saved
// machines on the Workbench, and the machines to place on the Playground. The
// scene does the hit-testing through `itemAt`, so a row can start a drag the
// same way a palette module does.

import { COLORS, FONT, FONT_SM, TEXT_RESOLUTION } from '../config.js';
import { createButton } from './button.js';

export class ListView {
  // opts: { x, y, w, rowH, gap, rows, cols (rows across, default 1), heading,
  // headingColor, empty, icon(g, item, cx, cy, size) }
  constructor(scene, opts) {
    this.scene = scene;
    this.opts = { gap: 6, cols: 1, iconSize: opts.rowH - 10, ...opts };
    this.items = [];
    this.page = 0;
    this.visible = [];
    this.shown = true;
    this.g = scene.add.graphics().setDepth(1);
    this.texts = [];
    const { x, y, w, heading, headingColor } = this.opts;
    this.heading = scene.add
      .text(x, y + 4, heading, {
        fontFamily: FONT,
        fontSize: `${FONT_SM}px`,
        fontStyle: 'bold',
        color: headingColor ?? COLORS.text,
        resolution: TEXT_RESOLUTION,
      })
      .setDepth(2);
    const small = { fontSize: FONT_SM, padX: 8, padY: 2 };
    this.down = createButton(scene, x + w - 14, y + 13, '▼', () => this.turnPage(1), small);
    this.up = createButton(scene, x + w - 46, y + 13, '▲', () => this.turnPage(-1), small);
    this.top = y + 30;
  }

  get perPage() {
    return this.opts.rows * this.opts.cols;
  }

  get pages() {
    return Math.max(1, Math.ceil(this.items.length / this.perPage));
  }

  setShown(on) {
    this.shown = on;
    this.heading.setVisible(on);
    this.g.setVisible(on);
    for (const t of this.texts) t.setVisible(on);
    const paged = on && this.pages > 1;
    for (const b of [this.up, this.down]) {
      b.setVisible(paged);
      b.panel.setVisible(paged);
    }
  }

  setItems(items) {
    this.items = items;
    this.page = Math.min(this.page, this.pages - 1);
  }

  // Shows the page holding `key`.
  reveal(key) {
    const i = this.items.findIndex((it) => it.key === key);
    if (i >= 0) this.page = Math.floor(i / this.perPage);
  }

  turnPage(delta) {
    this.page = Math.max(0, Math.min(this.pages - 1, this.page + delta));
    this.opts.onPage?.();
  }

  itemAt(px, py) {
    if (!this.shown) return null;
    return this.visible.find((it) => px >= it.x && px <= it.x + it.w && py >= it.y && py <= it.y + it.h) ?? null;
  }

  // state: { selected: key, hover: key }
  render(state = {}) {
    const { x, w, rowH, gap, cols, iconSize, icon, empty } = this.opts;
    const colW = (w - gap * (cols - 1)) / cols;
    const g = this.g;
    g.clear();
    for (const t of this.texts) t.destroy();
    this.texts = [];
    const paged = this.shown && this.pages > 1;
    for (const b of [this.up, this.down]) {
      b.setVisible(paged);
      b.panel.setVisible(paged);
    }

    const start = this.page * this.perPage;
    this.visible = this.items.slice(start, start + this.perPage).map((item, i) => ({
      ...item,
      x: x + (i % cols) * (colW + gap),
      y: this.top + Math.floor(i / cols) * (rowH + gap),
      w: colW,
      h: rowH,
    }));
    if (this.visible.length === 0) {
      this.texts.push(
        this.scene.add
          .text(x, this.top + 4, empty, {
            fontFamily: FONT,
            fontSize: `${FONT_SM}px`,
            color: COLORS.muted,
            wordWrap: { width: w },
            resolution: TEXT_RESOLUTION,
          })
          .setDepth(2)
      );
    }
    const label = (item) => item.w - (icon ? iconSize + 14 : 10) - (item.sub ? 56 : 8);
    for (const item of this.visible) {
      const on = item.key === state.selected;
      const hover = item.key === state.hover;
      g.fillStyle(on ? COLORS.selectedHex : hover ? COLORS.buttonHoverHex : COLORS.panelHex, 1);
      g.fillRoundedRect(item.x, item.y, item.w, item.h, 6);
      g.lineStyle(on ? 2 : 1, on ? COLORS.highlightHex : COLORS.panelEdgeHex, 1);
      g.strokeRoundedRect(item.x, item.y, item.w, item.h, 6);
      icon?.(g, item, item.x + 6 + iconSize / 2, item.y + rowH / 2, iconSize);
      const left = icon ? iconSize + 14 : 10;
      this.texts.push(
        this.scene.add
          .text(item.x + left, item.y + rowH / 2, item.label, {
            fontFamily: FONT,
            fontSize: '14px',
            color: COLORS.text,
            resolution: TEXT_RESOLUTION,
          })
          .setOrigin(0, 0.5)
          .setDepth(3)
      );
      const name = this.texts[this.texts.length - 1];
      if (name.width > label(item)) name.setScale(label(item) / name.width, 1);
      if (item.sub) {
        this.texts.push(
          this.scene.add
            .text(item.x + item.w - 8, item.y + rowH / 2, item.sub, {
              fontFamily: FONT,
              fontSize: '12px',
              color: COLORS.muted,
              resolution: TEXT_RESOLUTION,
            })
            .setOrigin(1, 0.5)
            .setDepth(3)
        );
      }
    }
    if (paged) {
      this.texts.push(
        this.scene.add
          .text(this.up.x - 22, this.up.y, `${this.page + 1}/${this.pages}`, {
            fontFamily: FONT,
            fontSize: '12px',
            color: COLORS.muted,
            resolution: TEXT_RESOLUTION,
          })
          .setOrigin(1, 0.5)
          .setDepth(3)
      );
    }
    for (const t of this.texts) t.setVisible(this.shown);
  }
}
