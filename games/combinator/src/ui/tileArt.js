// Drawing a tile's ground and what a turn does to it. Shared by the Workbench
// (its cells, and the small test world round it) and the Playground, so wet,
// sand, fumes, wind, hot and steam look the same everywhere.

import { EFFECT_STYLE, TERRAIN_STYLE } from '../config.js';
import { neighbour } from '../core/machine.js';

export function drawTerrain(g, id, px, py, t) {
  const color = TERRAIN_STYLE[id];
  const dot = Math.max(2, t / 22);
  if (id === 'puddle') {
    g.fillStyle(color, 0.55);
    g.fillEllipse(px + t * 0.42, py + t * 0.55, t * 0.62, t * 0.36);
    g.fillEllipse(px + t * 0.66, py + t * 0.4, t * 0.36, t * 0.22);
  } else if (id === 'embers') {
    g.fillStyle(0x3a1a12, 1);
    g.fillRect(px + 1, py + 1, t - 2, t - 2);
    g.fillStyle(color, 0.9);
    for (const [fx, fy] of [[0.25, 0.3], [0.6, 0.22], [0.42, 0.55], [0.75, 0.62], [0.3, 0.78], [0.62, 0.84]]) {
      g.fillCircle(px + t * fx, py + t * fy, dot);
    }
  } else if (id === 'sand') {
    g.fillStyle(color, 0.35);
    g.fillRect(px + 1, py + 1, t - 2, t - 2);
    g.fillStyle(color, 0.9);
    for (const [fx, fy] of [[0.22, 0.28], [0.55, 0.2], [0.8, 0.38], [0.35, 0.55], [0.68, 0.66], [0.2, 0.8], [0.5, 0.84]]) {
      g.fillCircle(px + t * fx, py + t * fy, dot * 0.8);
    }
  } else if (id === 'vent') {
    g.fillStyle(0x1d2a26, 1);
    g.fillEllipse(px + t * 0.5, py + t * 0.62, t * 0.42, t * 0.2);
    g.lineStyle(2, color, 0.75);
    for (const [fx, r] of [[0.42, 0.08], [0.56, 0.11], [0.46, 0.14]]) {
      g.strokeCircle(px + t * fx, py + t * (0.48 - r * 1.6), t * r);
    }
  } else if (id === 'draft') {
    g.lineStyle(2, color, 0.6);
    for (const fy of [0.3, 0.5, 0.7]) {
      g.beginPath();
      g.moveTo(px + t * 0.15, py + t * fy);
      for (let i = 1; i <= 8; i++) {
        g.lineTo(px + t * (0.15 + i * 0.09), py + t * fy + Math.sin(i * 1.4) * (t / 22));
      }
      g.strokePath();
    }
  }
  // A frame, so the ground still shows round a module or machine on it.
  g.lineStyle(Math.max(2, t / 22), color, 0.9);
  g.strokeRect(px + 3, py + 3, t - 6, t - 6);
}

// tile: { wet, hot, steam, isHot, sand?, fumes?, wind? } — wind causes carry
// `front`.
export function drawTileEffects(g, tile, px, py, t) {
  const s = t / 88; // drawn at the Workbench's cell size, scaled
  if (tile.sand?.length) {
    g.fillStyle(EFFECT_STYLE.sand, 0.3);
    g.fillRect(px + 1, py + 1, t - 2, t - 2);
    g.fillStyle(EFFECT_STYLE.sand, 0.95);
    for (const [fx, fy] of [[0.1, 0.5], [0.9, 0.5], [0.5, 0.1], [0.5, 0.9]]) {
      g.fillRect(px + t * fx - 2.5 * s - 1, py + t * fy - 2.5 * s - 1, 5 * s + 2, 5 * s + 2);
    }
  }
  if (tile.fumes?.length) {
    g.fillStyle(EFFECT_STYLE.fumes, 0.18);
    g.fillRect(px + 1, py + 1, t - 2, t - 2);
    g.lineStyle(2, EFFECT_STYLE.fumes, 0.8);
    for (const [fx, fy] of [[0.3, 0.3], [0.7, 0.7]]) {
      const r = Math.max(3, 7 * s);
      g.strokePoints([
        { x: px + t * fx, y: py + t * fy - r },
        { x: px + t * fx + r, y: py + t * fy },
        { x: px + t * fx, y: py + t * fy + r },
        { x: px + t * fx - r, y: py + t * fy },
      ], true);
    }
  }
  if (tile.steam) {
    g.fillStyle(EFFECT_STYLE.steam, 0.22);
    g.fillRect(px + 1, py + 1, t - 2, t - 2);
  } else if (tile.wet.length) {
    g.fillStyle(EFFECT_STYLE.wet, 0.3);
    g.fillRect(px + 1, py + 1, t - 2, t - 2);
  }
  if (tile.isHot) {
    g.fillStyle(EFFECT_STYLE.hot, 0.28);
    g.fillRect(px + 1, py + 1, t - 2, t - 2);
    g.lineStyle(2, EFFECT_STYLE.hot, 0.7);
    for (const fx of [0.2, 0.8]) {
      g.beginPath();
      g.moveTo(px + t * fx, py + t * 0.85);
      g.lineTo(px + t * fx - 4 * s, py + t * 0.7);
      g.lineTo(px + t * fx + 4 * s, py + t * 0.55);
      g.lineTo(px + t * fx, py + t * 0.4);
      g.strokePath();
    }
  }
  if (tile.wet.length && !tile.steam) {
    g.fillStyle(EFFECT_STYLE.wet, 0.9);
    for (const [fx, fy] of [[0.12, 0.14], [0.88, 0.14], [0.12, 0.88], [0.88, 0.88]]) {
      g.fillCircle(px + t * fx, py + t * fy, Math.max(1.5, 3 * s));
    }
  }
  if (tile.steam) {
    g.lineStyle(2, EFFECT_STYLE.steam, 0.8);
    for (const fx of [0.12, 0.88]) {
      g.strokeCircle(px + t * fx, py + t * 0.15, Math.max(2, 4 * s));
      g.strokeCircle(px + t * fx + 3 * s, py + t * 0.1, Math.max(1.5, 3 * s));
    }
  }
  const fronts = new Set((tile.wind ?? []).map((c) => c.front));
  for (const side of fronts) {
    const [nx, ny] = neighbour(0, 0, side);
    const len = 14 * s;
    const head = 6 * s;
    g.lineStyle(2, EFFECT_STYLE.wind, 0.85);
    for (const off of [-0.25, 0.25]) {
      const cx = px + t / 2 + (ny !== 0 ? off * t : 0);
      const cy = py + t / 2 + (nx !== 0 ? off * t : 0);
      const ex = cx + nx * len;
      const ey = cy + ny * len;
      g.lineBetween(cx - nx * len, cy - ny * len, ex, ey);
      g.lineBetween(ex, ey, ex - nx * head - ny * head * 0.8, ey - ny * head - nx * head * 0.8);
      g.lineBetween(ex, ey, ex - nx * head + ny * head * 0.8, ey - ny * head + nx * head * 0.8);
    }
  }
}
