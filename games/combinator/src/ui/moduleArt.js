// Drawing a module: a body tinted by role and edged by material, the paths a
// flow takes through it, and its ports. Shared by the palette and the bench so
// a module looks the same in both. Draws into a Graphics; the caller owns the
// name label.

import { FLOW_STYLE, MATERIAL_STYLE, ROLE_STYLE } from '../config.js';
import { MODULES } from '../data/modules.js';
import { rotateSide } from '../core/machine.js';

const DIR = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };

export function roleKey(def) {
  return def.role === 'transmission' ? def.kind : def.role;
}

export function flowShape(g, flow, x, y, r, filled) {
  const { color, shape } = FLOW_STYLE[flow];
  if (filled) g.fillStyle(color, 1);
  g.lineStyle(Math.max(2, r * 0.35), color, 1);
  const paint = (fn) => {
    if (filled) fn('fill');
    else fn('stroke');
  };
  if (shape === 'circle') {
    paint((m) => (m === 'fill' ? g.fillCircle(x, y, r) : g.strokeCircle(x, y, r * 0.85)));
  } else if (shape === 'square') {
    const s = r * 1.6;
    paint((m) => (m === 'fill' ? g.fillRect(x - s / 2, y - s / 2, s, s) : g.strokeRect(x - s / 2 + 1, y - s / 2 + 1, s - 2, s - 2)));
  } else if (shape === 'triangle') {
    const pts = [x, y - r * 1.05, x + r, y + r * 0.8, x - r, y + r * 0.8];
    paint((m) => (m === 'fill' ? g.fillTriangle(...pts) : g.strokeTriangle(...pts)));
  } else {
    const pts = [
      { x, y: y - r * 1.15 },
      { x: x + r * 1.15, y },
      { x, y: y + r * 1.15 },
      { x: x - r * 1.15, y },
    ];
    paint((m) => (m === 'fill' ? g.fillPoints(pts, true) : g.strokePoints(pts, true)));
  }
}

// Where a port sits on a module drawn at (cx, cy) with body size `size`.
export function portPoint(side, cx, cy, size) {
  const [dx, dy] = DIR[side];
  return { x: cx + (dx * size) / 2, y: cy + (dy * size) / 2, dx, dy };
}

// opts.carrying: { [portIndex]: bool } — lit paths and ports for a running
// machine; omitted means "draw it neutrally" (the palette).
// opts.dim: the module isn't running this turn.
// opts.burnt: the module has burnt down.
export function drawModule(g, type, rot, cx, cy, size, opts = {}) {
  const def = MODULES[type];
  const role = ROLE_STYLE[roleKey(def)];
  const edge = MATERIAL_STYLE[def.material].color;
  const half = size / 2;
  const alpha = opts.alpha ?? 1;

  if (opts.burnt) {
    g.fillStyle(0x1b1b1b, 0.9 * alpha);
    g.fillRoundedRect(cx - half, cy - half, size, size, 10);
    g.lineStyle(3, 0x4a3a2a, alpha);
    g.strokeRoundedRect(cx - half, cy - half, size, size, 10);
    g.lineStyle(2, 0x6b4a2a, alpha);
    g.lineBetween(cx - half + 10, cy - half + 12, cx + half - 14, cy + half - 10);
    g.lineBetween(cx - half + 16, cy + half - 12, cx + half - 10, cy - half + 16);
    return;
  }

  const bodyAlpha = (opts.dim ? 0.55 : 1) * alpha;
  g.fillStyle(0x161a22, alpha);
  g.fillRoundedRect(cx - half, cy - half, size, size, 10);
  g.fillStyle(role.color, 0.55 * bodyAlpha);
  g.fillRoundedRect(cx - half, cy - half, size, size, 10);
  g.lineStyle(def.material === 'wood' ? 4 : 3, edge, bodyAlpha);
  g.strokeRoundedRect(cx - half, cy - half, size, size, 10);
  if (def.material === 'wood') {
    // A couple of grain lines so wood reads as wood at a glance.
    g.lineStyle(1, edge, 0.45 * bodyAlpha);
    g.lineBetween(cx - half + 6, cy - half + 8, cx - half + 6, cy + half - 8);
    g.lineBetween(cx + half - 6, cy - half + 8, cx + half - 6, cy + half - 8);
  }

  const ports = def.ports.map((port, index) => ({ ...port, index, side: rotateSide(port.side, rot) }));
  const lit = (index) => (opts.carrying ? !!opts.carrying[index] : true);
  const pathW = Math.max(3, size * 0.07);

  // Flow paths: every port runs to the hub, so a carrier reads as a line, a
  // corner as an L, and a converter as two colours meeting in the middle.
  for (const port of ports) {
    const p = portPoint(port.side, cx, cy, size);
    const on = lit(port.index);
    g.lineStyle(pathW, FLOW_STYLE[port.flow].color, (on ? 0.95 : 0.22) * bodyAlpha);
    g.lineBetween(p.x - p.dx * 4, p.y - p.dy * 4, cx, cy);
  }
  const hubColor = def.kind === 'converter' ? 0xffffff : role.color;
  g.fillStyle(hubColor, (opts.dim ? 0.3 : 0.85) * alpha);
  g.fillCircle(cx, cy, size * 0.08);

  for (const port of ports) {
    const p = portPoint(port.side, cx, cy, size);
    const r = Math.max(4, size * 0.1);
    const on = lit(port.index);
    const out = port.dir === 'out';
    // Outputs are solid, inputs hollow; the little arrow says which way the
    // flow goes through the side.
    const sx = p.x - p.dx * r * 1.2;
    const sy = p.y - p.dy * r * 1.2;
    flowShape(g, port.flow, sx, sy, r, out);
    const color = FLOW_STYLE[port.flow].color;
    g.fillStyle(color, on ? 1 : 0.6);
    const tip = out ? r * 1.5 : r * 0.1;
    const base = out ? r * 0.3 : r * 1.3;
    const ax = p.x + p.dx * tip;
    const ay = p.y + p.dy * tip;
    const bx = p.x + p.dx * base;
    const by = p.y + p.dy * base;
    const w = r * 0.8;
    g.fillTriangle(ax, ay, bx - p.dy * w, by + p.dx * w, bx + p.dy * w, by - p.dx * w);
  }
}
