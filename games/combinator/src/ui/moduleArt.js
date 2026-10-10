// Drawing a module: a body tinted by role and edged by material, the paths a
// flow takes through it, and its ports — inputs down its left side, outputs
// down its right, the way flow runs along a machine's row. Shared by the
// palette and the bench so a module looks the same in both. Draws into a
// Graphics; the caller owns the name label.

import { FLOW_STYLE, MATERIAL_STYLE, ROLE_STYLE } from '../config.js';
import { MODULES } from '../data/modules.js';

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

// Where port `index` of a module drawn at (cx, cy) with body size `size`
// sits: on the left edge for an input, the right for an output, spread down
// the side when there are several. dx is the way out of the body.
export function portAnchor(type, index, cx, cy, size) {
  const ports = MODULES[type].ports;
  const { dir } = ports[index];
  const same = ports.map((p, i) => ({ ...p, i })).filter((p) => p.dir === dir);
  const k = same.findIndex((p) => p.i === index);
  const dx = dir === 'in' ? -1 : 1;
  return { x: cx + (dx * size) / 2, y: cy + ((k + 1) / (same.length + 1) - 0.5) * size * 0.9, dx };
}

// opts.carrying: { [portIndex]: bool } — lit paths and ports for a running
// machine; omitted means "draw it neutrally" (the palette).
// opts.dim: the module isn't running this turn.
// opts.burnt: the module has burnt down.
export function drawModule(g, type, cx, cy, size, opts = {}) {
  const def = MODULES[type];
  const role = ROLE_STYLE[roleKey(def)];
  const edge = MATERIAL_STYLE[def.material].color;
  const half = size / 2;
  const alpha = opts.alpha ?? 1;
  const corner = Math.min(10, size * 0.16);

  if (opts.burnt) {
    g.fillStyle(0x1b1b1b, 0.9 * alpha);
    g.fillRoundedRect(cx - half, cy - half, size, size, corner);
    g.lineStyle(3, 0x4a3a2a, alpha);
    g.strokeRoundedRect(cx - half, cy - half, size, size, corner);
    g.lineStyle(2, 0x6b4a2a, alpha);
    g.lineBetween(cx - half * 0.7, cy - half * 0.6, cx + half * 0.6, cy + half * 0.7);
    g.lineBetween(cx - half * 0.6, cy + half * 0.7, cx + half * 0.7, cy - half * 0.6);
    return;
  }

  const bodyAlpha = (opts.dim ? 0.55 : 1) * alpha;
  g.fillStyle(0x161a22, alpha);
  g.fillRoundedRect(cx - half, cy - half, size, size, corner);
  g.fillStyle(role.color, 0.55 * bodyAlpha);
  g.fillRoundedRect(cx - half, cy - half, size, size, corner);
  g.lineStyle(def.material === 'wood' ? 4 : 3, edge, bodyAlpha);
  g.strokeRoundedRect(cx - half, cy - half, size, size, corner);
  if (def.material === 'wood') {
    // A couple of grain lines so wood reads as wood at a glance.
    g.lineStyle(1, edge, 0.45 * bodyAlpha);
    g.lineBetween(cx - half * 0.6, cy - half + 5, cx + half * 0.6, cy - half + 5);
    g.lineBetween(cx - half * 0.6, cy + half - 5, cx + half * 0.6, cy + half - 5);
  }

  const lit = (index) => (opts.carrying ? !!opts.carrying[index] : true);
  const pathW = Math.max(3, size * 0.07);
  const ports = def.ports.map((port, index) => ({ ...port, index, at: portAnchor(type, index, cx, cy, size) }));

  // Flow paths: every port runs to the hub, so a converter reads as the
  // colours of what it takes and gives meeting in the middle.
  for (const port of ports) {
    const on = lit(port.index);
    g.lineStyle(pathW, FLOW_STYLE[port.flow].color, (on ? 0.95 : 0.22) * bodyAlpha);
    g.lineBetween(port.at.x - port.at.dx * 4, port.at.y, cx, cy);
  }
  const hubColor = def.kind === 'converter' ? 0xffffff : role.color;
  g.fillStyle(hubColor, (opts.dim ? 0.3 : 0.85) * alpha);
  g.fillCircle(cx, cy, size * 0.08);

  for (const port of ports) {
    const { x, y, dx } = port.at;
    const r = Math.max(4, size * 0.1);
    const on = lit(port.index);
    const out = port.dir === 'out';
    // Outputs are solid, inputs hollow; the arrow on the edge points right,
    // the way flow runs along the row.
    flowShape(g, port.flow, x - dx * r * 1.2, y, r, out);
    g.fillStyle(FLOW_STYLE[port.flow].color, on ? 1 : 0.6);
    const ax = out ? x + r * 0.2 : x - r * 0.8;
    const w = r * 0.75;
    g.fillTriangle(ax + r * 1.1, y, ax, y - w, ax, y + w);
  }
}
