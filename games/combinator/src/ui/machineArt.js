// Drawing a whole machine as one tile: a body with its Workbench layout shrunk
// inside it, one coloured square per module, turned with the machine. While a
// round is shown, running modules are lit, idle ones dim and burnt ones dark,
// so a machine on the Playground still says what is going on inside it.

import { COLORS, EFFECT_STYLE, ROLE_STYLE } from '../config.js';
import { MODULES } from '../data/modules.js';
import { roleKey } from './moduleArt.js';

const MACHINE_EDGE = 0x8b97a8;

// Where cell (x, y) of the Workbench lands inside a machine turned `rot`
// quarter turns, as an offset in cells from the middle of its parts.
function turned(x, y, rot, mid) {
  let dx = x - mid[0];
  let dy = y - mid[1];
  for (let i = 0; i < ((rot % 4) + 4) % 4; i++) [dx, dy] = [-dy, dx];
  return [dx, dy];
}

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

  // The layout is cropped to its parts and fitted to the body, so a small
  // machine reads as big as a sprawling one.
  if (parts.length === 0) return;
  const xs = parts.map((p) => p.x);
  const ys = parts.map((p) => p.y);
  const mid = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) + 1;
  const room = opts.label ? 0.6 : 0.8;
  const cell = Math.min((size * room) / span, size / 4);
  const cy0 = opts.label ? cy - size * 0.14 : cy;
  const pad = Math.max(0.5, cell * 0.1);
  for (const p of parts) {
    const def = MODULES[p.type];
    const [dx, dy] = turned(p.x, p.y, rot, mid);
    const x = cx + dx * cell - cell / 2 + pad;
    const y = cy0 + dy * cell - cell / 2 + pad;
    const w = cell - pad * 2;
    const burnt = record && !record.present.includes(p.id);
    const on = !record || record.active[p.id];
    if (burnt) {
      g.fillStyle(0x3a2a1e, alpha);
      g.fillRect(x, y, w, w);
      continue;
    }
    g.fillStyle(ROLE_STYLE[roleKey(def)].color, (on ? 1 : 0.35) * alpha);
    g.fillRect(x, y, w, w);
    if (def.effect && on) {
      g.lineStyle(Math.max(1, cell * 0.14), EFFECT_STYLE[def.effect.kind], alpha);
      g.strokeRect(x, y, w, w);
    }
  }
}
