// The test run, turn by turn: one row per source and effector (and any module
// that burns), one column per turn. A lit cell means it was running. Clicking a
// column shows that turn on the bench.

import { COLORS, EFFECT_STYLE, FONT, FONT_SM, LAYOUT, ROLE_STYLE, TEXT_RESOLUTION } from '../config.js';
import { MODULES } from '../data/modules.js';
import { tileName } from '../core/machine.js';

export class Timeline {
  constructor(scene, onPickTurn) {
    this.scene = scene;
    this.onPickTurn = onPickTurn;
    const { x, y, w, labelW, rowH } = LAYOUT.timeline;
    this.x = x;
    this.y = y;
    this.w = w;
    this.labelW = labelW;
    this.rowH = rowH;
    this.g = scene.add.graphics().setDepth(1);
    this.texts = [];
    this.headerY = y + 44;
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

  render(placements, sim, viewTurn) {
    const g = this.g;
    g.clear();
    for (const t of this.texts) t.destroy();
    this.texts = [];
    const turns = sim.turns.length;
    const cw = (this.w - this.labelW) / turns;

    const burns = new Set(Object.keys(sim.burntAfter));
    const rows = placements.filter((p) => {
      const role = MODULES[p.type].role;
      return role === 'source' || role === 'effector' || burns.has(p.id);
    });
    // Effectors first: they are the point of the machine.
    rows.sort((a, b) => rank(a) - rank(b));
    const maxRows = Math.floor((LAYOUT.panel.y + LAYOUT.panel.h - this.headerY - 16) / this.rowH);
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
      this.text(this.x, this.headerY + 22, 'Sources and effectors show up here, one row each.', {
        color: COLORS.muted,
      });
    }

    shown.forEach((p, i) => {
      const def = MODULES[p.type];
      const top = this.headerY + 14 + i * this.rowH;
      const role = def.role === 'transmission' ? def.kind : def.role;
      this.text(this.x, top + this.rowH / 2, `${def.name} ${tileName(p.x, p.y)}`, {
        color: ROLE_STYLE[role].css,
      }).setOrigin(0, 0.5);
      for (const record of sim.turns) {
        const cx = this.colX(record.turn, turns);
        const present = record.present.includes(p.id);
        g.fillStyle(0x262d38, 1);
        g.fillRect(cx + 2, top + 3, cw - 4, this.rowH - 6);
        if (!present) {
          g.lineStyle(2, 0x5a4636, 1);
          g.lineBetween(cx + 6, top + this.rowH / 2, cx + cw - 6, top + this.rowH / 2);
          continue;
        }
        if (record.active[p.id]) {
          const color = def.effect ? EFFECT_STYLE[def.effect.kind] : ROLE_STYLE[role].color;
          g.fillStyle(color, 0.95);
          g.fillRect(cx + 2, top + 3, cw - 4, this.rowH - 6);
        }
        for (const e of record.events) {
          if (e.id !== p.id) continue;
          if (e.type === 'burn') {
            g.fillStyle(EFFECT_STYLE.hot, 1);
            const fx = cx + cw - 9;
            g.fillTriangle(fx - 5, top + this.rowH - 5, fx + 5, top + this.rowH - 5, fx, top + 4);
          } else {
            g.lineStyle(2, COLORS.highlightHex, 0.9);
            g.strokeCircle(cx + cw - 9, top + this.rowH / 2, 4);
          }
        }
      }
    });
    if (rows.length > shown.length) {
      this.text(this.x, this.headerY + 14 + shown.length * this.rowH, `+${rows.length - shown.length} more`, {
        color: COLORS.muted,
      });
    }
  }
}

function rank(p) {
  const def = MODULES[p.type];
  if (def.role === 'effector') return 0;
  if (def.role === 'source') return 1;
  return 2;
}
