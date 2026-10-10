// Drawing a whole machine as one tile: a body with its row of modules shrunk
// inside it, one coloured square per module, and a notch on the side it faces.
// The row runs across the machine at rotation 0 and turns with it. While a
// round is shown, running modules are lit, idle ones dim and burnt ones dark,
// so a machine on the Playground still says what is going on inside it.

import { COLORS, EFFECT_STYLE, ROLE_STYLE } from '../config.js';
import { MODULES } from '../data/modules.js';
import { roleKey } from './moduleArt.js';

const MACHINE_EDGE = 0x8b97a8;

// opts.record: this machine's turn record, or nothing to draw it neutrally.
// opts.alpha: for a ghost being dragged.
// opts.label: leave the bottom of the body clear for a name.
export function drawMachine(g, parts, rot, cx, cy, size, opts = {}) {
  const alpha = opts.alpha ?? 1;
  const half = size / 2;
  const record = opts.record;
  const running = record ? parts.some((p) => record.active[p.id]) : true;

  g.fillStyle(0x161a22, alpha);
  g.fillRoundedRect(cx - half, cy - half, size, size, size * 0.14);
  g.fillStyle(COLORS.panelEdgeHex, (running ? 0.7 : 0.4) * alpha);
  g.fillRoundedRect(cx - half, cy - half, size, size, size * 0.14);
  g.lineStyle(Math.max(2, size / 24), MACHINE_EDGE, (running ? 1 : 0.6) * alpha);
  g.strokeRoundedRect(cx - half, cy - half, size, size, size * 0.14);

  // The front: a notch on the edge the effectors face.
  const r = ((rot % 4) + 4) % 4;
  const turn = (dx, dy) => {
    for (let i = 0; i < r; i++) [dx, dy] = [-dy, dx];
    return [dx, dy];
  };
  const notch = size * 0.09;
  const tri = [[-notch, -half + 1], [notch, -half + 1], [0, -half + 1 + notch]].map(([dx, dy]) => turn(dx, dy));
  g.fillStyle(MACHINE_EDGE, (running ? 1 : 0.6) * alpha);
  g.fillTriangle(cx + tri[0][0], cy + tri[0][1], cx + tri[1][0], cy + tri[1][1], cx + tri[2][0], cy + tri[2][1]);

  if (parts.length === 0) return;
  // Leave the bottom clear for a name: a turned row runs up the body, so it
  // gets less room.
  const room = opts.label && r % 2 ? 0.6 : 0.84;
  const cell = Math.min((size * room) / parts.length, size / 3.2);
  const cy0 = opts.label ? cy - size * 0.12 : cy;
  const pad = Math.max(0.5, cell * 0.1);
  parts.forEach((p, i) => {
    const def = MODULES[p.type];
    const [dx, dy] = turn((i - (parts.length - 1) / 2) * cell, 0);
    const w = cell - pad * 2;
    const x = cx + dx - w / 2;
    const y = cy0 + dy - w / 2;
    const burnt = record && !record.present.includes(p.id);
    const on = !record || record.active[p.id];
    if (burnt) {
      g.fillStyle(0x3a2a1e, alpha);
      g.fillRect(x, y, w, w);
      return;
    }
    g.fillStyle(ROLE_STYLE[roleKey(def)].color, (on ? 1 : 0.35) * alpha);
    g.fillRect(x, y, w, w);
    if (def.effect && on) {
      g.lineStyle(Math.max(1, cell * 0.14), EFFECT_STYLE[def.effect.kind], alpha);
      g.strokeRect(x, y, w, w);
    }
  });
}
