// A run, turn by turn: one row per thing worth following, one column per
// turn. A lit cell means it was running; a struck-through one that it is gone.
// The scene decides the rows (modules on the Workbench, machines on the
// Playground) and picks a turn by clicking a column.

import { COLORS, EFFECT_STYLE, FONT, FONT_SM, TEXT_RESOLUTION } from '../config.js';

export class Timeline {
  // layout: { x, y, w, labelW, rowH, bottom }
  constructor(scene, layout) {
    this.scene = scene;
    Object.assign(this, layout);
    this.maxBottom = layout.bottom;
    this.g = scene.add.graphics().setDepth(1);
    this.texts = [];
    this.headerY = layout.y + 44;
    this.bottom = this.headerY + 14;
  }

  colX(turn, turns) {
    const cw = (this.w - this.labelW) / turns;
    return this.x + this.labelW + (turn - 1) * cw;
  }

  turnAt(px, py, turns) {
    const cw = (this.w - this.labelW) / turns;
    if (py < this.headerY - 12 || py > this.bottom || px < this.x + this.labelW || px > this.x + this.w) return null;
    return Math.min(turns, Math.floor((px - this.x - this.labelW) / cw) + 1);
  }

  text(x, y, s, style = {}) {
    const t = this.scene.add
      .text(x, y, s, {
        fontFamily: FONT,
        fontSize: `${FONT_SM}px`,
        color: COLORS.text,
        resolution: TEXT_RESOLUTION,
        ...style,
      })
      .setDepth(2);
    this.texts.push(t);
    return t;
  }

  // rows: [{ label, labelColor, onColor, cells: [{ state: 'on'|'off'|'gone', mark: null|'burn'|'empty' }] }]
  render(rows, turns, viewTurn, emptyText) {
    const g = this.g;
    g.clear();
    for (const t of this.texts) t.destroy();
    this.texts = [];
    const cw = (this.w - this.labelW) / turns;
    const maxRows = Math.floor((this.maxBottom - this.headerY - 16) / this.rowH);
    const shown = rows.slice(0, maxRows);
    this.bottom = this.headerY + 14 + Math.max(1, shown.length) * this.rowH;

    // Column for the turn being viewed.
    g.fillStyle(COLORS.selectedHex, 0.45);
    g.fillRect(this.colX(viewTurn, turns), this.headerY - 12, cw, 24 + shown.length * this.rowH);

    for (let t = 1; t <= turns; t++) {
      this.text(this.colX(t, turns) + cw / 2, this.headerY, `${t}`, {
        color: t === viewTurn ? COLORS.text : COLORS.muted,
        fontStyle: t === viewTurn ? 'bold' : 'normal',
      }).setOrigin(0.5);
    }
    this.text(this.x, this.headerY, 'Turn', { color: COLORS.muted }).setOrigin(0, 0.5);

    if (rows.length === 0) {
      this.text(this.x, this.headerY + 22, emptyText, { color: COLORS.muted });
    }

    shown.forEach((row, i) => {
      const top = this.headerY + 14 + i * this.rowH;
      const name = this.text(this.x, top + this.rowH / 2, row.label, { color: row.labelColor }).setOrigin(0, 0.5);
      if (name.width > this.labelW - 8) name.setScale((this.labelW - 8) / name.width, 1);
      row.cells.forEach((cell, index) => {
        const cx = this.colX(index + 1, turns);
        g.fillStyle(0x262d38, 1);
        g.fillRect(cx + 2, top + 3, cw - 4, this.rowH - 6);
        if (cell.state === 'gone') {
          g.lineStyle(2, 0x5a4636, 1);
          g.lineBetween(cx + 6, top + this.rowH / 2, cx + cw - 6, top + this.rowH / 2);
          return;
        }
        if (cell.state === 'on') {
          g.fillStyle(row.onColor, 0.95);
          g.fillRect(cx + 2, top + 3, cw - 4, this.rowH - 6);
        }
        if (cell.mark === 'burn') {
          g.fillStyle(EFFECT_STYLE.hot, 1);
          const fx = cx + cw - 9;
          g.fillTriangle(fx - 5, top + this.rowH - 5, fx + 5, top + this.rowH - 5, fx, top + 4);
        } else if (cell.mark === 'empty') {
          g.lineStyle(2, COLORS.highlightHex, 0.9);
          g.strokeCircle(cx + cw - 9, top + this.rowH / 2, 4);
        }
      });
    });
    if (rows.length > shown.length) {
      this.text(this.x, this.headerY + 14 + shown.length * this.rowH, `+${rows.length - shown.length} more`, {
        color: COLORS.muted,
      });
    }
  }
}
