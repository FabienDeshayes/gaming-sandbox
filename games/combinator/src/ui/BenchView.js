// Draws the test bench: tiles and terrain, what the machine does to each tile
// on the turn being viewed, the modules, their links, and the flows moving
// through them. Holds no machine state — the scene hands it a placement list,
// the run and the turn, and it draws that.

import { COLORS, EFFECT_STYLE, FLOW_STYLE, FONT, LAYOUT, TERRAIN_STYLE, TEXT_RESOLUTION } from '../config.js';
import { MODULES } from '../data/modules.js';
import { effectTiles, neighbour, portsOf, rotateSide, terrainAt } from '../core/machine.js';
import { drawModule, portPoint } from './moduleArt.js';

const BODY = 0.8; // module body as a share of the tile

export class BenchView {
  constructor(scene, bench) {
    this.scene = scene;
    this.bench = bench;
    const { x, y, tile } = LAYOUT.bench;
    this.x0 = x;
    this.y0 = y;
    this.tile = tile;
    this.width = bench.cols * tile;
    this.height = bench.rows * tile;

    this.ground = scene.add.graphics().setDepth(1);
    this.links = scene.add.graphics().setDepth(3);
    this.modules = scene.add.graphics().setDepth(4);
    this.overlay = scene.add.graphics().setDepth(6);
    this.anim = scene.add.graphics().setDepth(7);
    this.labels = [];
    this.flowing = [];
    this.spilling = [];
    this.drawing = [];

    const style = { fontFamily: FONT, fontSize: '14px', color: COLORS.muted, resolution: TEXT_RESOLUTION };
    for (let c = 0; c < bench.cols; c++) {
      scene.add.text(x + c * tile + tile / 2, y - 14, String.fromCharCode(65 + c), style).setOrigin(0.5);
    }
    for (let r = 0; r < bench.rows; r++) {
      scene.add.text(x - 14, y + r * tile + tile / 2, `${r + 1}`, style).setOrigin(0.5);
    }
  }

  center(x, y) {
    return { x: this.x0 + x * this.tile + this.tile / 2, y: this.y0 + y * this.tile + this.tile / 2 };
  }

  tileAt(px, py) {
    const x = Math.floor((px - this.x0) / this.tile);
    const y = Math.floor((py - this.y0) / this.tile);
    if (x < 0 || y < 0 || x >= this.bench.cols || y >= this.bench.rows) return null;
    return [x, y];
  }

  // state: { placements, sim, turn, ghostId, highlight: Set, hoverId, selectedId }
  render(state) {
    const { placements, sim, turn } = state;
    const record = sim.turns[turn - 1];
    const size = this.tile * BODY;
    const present = new Set(record.present);

    this.ground.clear();
    this.links.clear();
    this.modules.clear();
    this.overlay.clear();
    for (const t of this.labels) t.destroy();
    this.labels = [];

    // Tiles and terrain.
    for (let y = 0; y < this.bench.rows; y++) {
      for (let x = 0; x < this.bench.cols; x++) {
        const px = this.x0 + x * this.tile;
        const py = this.y0 + y * this.tile;
        this.ground.fillStyle(COLORS.tileHex, 1);
        this.ground.fillRect(px + 1, py + 1, this.tile - 2, this.tile - 2);
        const terrain = terrainAt(this.bench, x, y);
        if (terrain) this.drawTerrain(terrain.id, px, py);
      }
    }
    this.ground.lineStyle(1, COLORS.tileEdgeHex, 1);
    this.ground.strokeRect(this.x0, this.y0, this.width, this.height);

    // What the machine does to each tile this turn.
    const byId = new Map(placements.map((p) => [p.id, p]));
    for (const [key, tile] of Object.entries(record.tiles)) {
      const [x, y] = key.split(',').map(Number);
      this.drawEffects(tile, x, y, byId);
    }

    // Terrain also gets a frame, so it still shows round a module standing on it.
    for (const [key, id] of Object.entries(this.bench.terrain)) {
      const [x, y] = key.split(',').map(Number);
      this.ground.lineStyle(4, TERRAIN_STYLE[id], 0.9);
      this.ground.strokeRect(this.x0 + x * this.tile + 3, this.y0 + y * this.tile + 3, this.tile - 6, this.tile - 6);
    }

    // Links between modules, and the edges where ports touch but can't link.
    const seen = new Set();
    this.flowing = [];
    for (const info of sim.net.ports.values()) {
      if (!info.partner) continue;
      const pair = [info.key, info.partner].sort().join('|');
      if (seen.has(pair)) continue;
      seen.add(pair);
      const c = this.center(info.x, info.y);
      const edge = portPoint(info.side, c.x, c.y, this.tile);
      if (info.status === 'mismatch') {
        this.links.lineStyle(4, COLORS.badHex, 1);
        const r = 9;
        this.links.lineBetween(edge.x - r, edge.y - r, edge.x + r, edge.y + r);
        this.links.lineBetween(edge.x - r, edge.y + r, edge.x + r, edge.y - r);
        continue;
      }
      const out = info.dir === 'out' ? info : sim.net.ports.get(info.partner);
      const inn = info.dir === 'out' ? sim.net.ports.get(info.partner) : info;
      const carrying = present.has(out.id) && present.has(inn.id) && record.carrying[out.key];
      const color = FLOW_STYLE[info.flow].color;
      const along = info.side === 'E' || info.side === 'W';
      this.links.fillStyle(color, carrying ? 1 : 0.35);
      if (along) this.links.fillRect(edge.x - 10, edge.y - 4, 20, 8);
      else this.links.fillRect(edge.x - 4, edge.y - 10, 8, 20);
      if (carrying) {
        this.flowing.push({ from: this.center(out.x, out.y), to: this.center(inn.x, inn.y), color });
      }
    }

    // Open outputs spilling, open inputs drawing from the ground.
    this.spilling = record.spills.map((s) => {
      const info = sim.net.ports.get(s.key);
      return { ...this.center(info.x, info.y), side: info.side, color: FLOW_STYLE[s.flow].color };
    });
    this.drawing = record.draws.map((d) => {
      const info = sim.net.ports.get(d.key);
      return { ...this.center(info.x, info.y), side: info.side, color: FLOW_STYLE[d.flow].color };
    });

    // Modules.
    for (const p of placements) {
      const c = this.center(p.x, p.y);
      const def = MODULES[p.type];
      const burnt = !present.has(p.id);
      const carrying = {};
      for (const port of portsOf(p)) carrying[port.index] = !!record.carrying[port.key];
      const ghost = p.id === state.ghostId;
      drawModule(this.modules, p.type, p.rot, c.x, c.y, size, {
        carrying,
        dim: !burnt && !record.active[p.id],
        burnt,
        alpha: ghost ? 0.7 : 1,
      });

      const name = this.scene.add
        .text(c.x, c.y, burnt ? 'burnt' : def.name, {
          fontFamily: FONT,
          fontSize: '13px',
          fontStyle: 'bold',
          color: burnt ? '#8a7a6a' : COLORS.text,
          align: 'center',
          wordWrap: { width: size - 18 },
          backgroundColor: burnt ? null : 'rgba(18,21,27,0.78)',
          padding: { x: 3, y: 1 },
          resolution: TEXT_RESOLUTION,
        })
        .setOrigin(0.5)
        .setDepth(5)
        .setAlpha(ghost ? 0.8 : 1);
      this.labels.push(name);

      if (burnt) continue;
      if (def.role === 'source') this.drawCharge(p, record.charge[p.id], def.charge, c, size);
      const streak = record.streak[p.id];
      if (def.material === 'wood' && streak > 0) this.drawFlame(c.x + size / 2 - 8, c.y - size / 2 + 8, streak);
    }

    // Effect area of the module under the pointer, so an effector shows where
    // it reaches before it is even fed.
    const hover = state.hoverId && byId.get(state.hoverId);
    if (hover && MODULES[hover.type].effect) {
      const kind = MODULES[hover.type].effect.kind;
      this.overlay.lineStyle(3, EFFECT_STYLE[kind], 0.9);
      for (const [x, y] of effectTiles(this.bench, hover)) {
        const px = this.x0 + x * this.tile;
        const py = this.y0 + y * this.tile;
        this.overlay.strokeRect(px + 5, py + 5, this.tile - 10, this.tile - 10);
      }
    }

    for (const id of state.highlight ?? []) {
      const p = byId.get(id);
      if (!p) continue;
      const c = this.center(p.x, p.y);
      this.overlay.lineStyle(3, COLORS.highlightHex, 0.95);
      this.overlay.strokeRoundedRect(c.x - this.tile / 2 + 2, c.y - this.tile / 2 + 2, this.tile - 4, this.tile - 4, 12);
    }
    if (state.ghostId) {
      const p = byId.get(state.ghostId);
      const c = this.center(p.x, p.y);
      this.overlay.lineStyle(2, COLORS.highlightHex, 0.8);
      this.overlay.strokeRoundedRect(c.x - this.tile / 2 + 3, c.y - this.tile / 2 + 3, this.tile - 6, this.tile - 6, 12);
    }
  }

  drawTerrain(id, px, py) {
    const g = this.ground;
    const t = this.tile;
    const color = TERRAIN_STYLE[id];
    if (id === 'puddle') {
      g.fillStyle(color, 0.55);
      g.fillEllipse(px + t * 0.42, py + t * 0.55, t * 0.62, t * 0.36);
      g.fillEllipse(px + t * 0.66, py + t * 0.4, t * 0.36, t * 0.22);
    } else if (id === 'embers') {
      g.fillStyle(0x3a1a12, 1);
      g.fillRect(px + 1, py + 1, t - 2, t - 2);
      g.fillStyle(color, 0.9);
      for (const [fx, fy] of [[0.25, 0.3], [0.6, 0.22], [0.42, 0.55], [0.75, 0.62], [0.3, 0.78], [0.62, 0.84]]) {
        g.fillCircle(px + t * fx, py + t * fy, 4);
      }
    } else if (id === 'draft') {
      g.lineStyle(2, color, 0.6);
      for (const fy of [0.3, 0.5, 0.7]) {
        g.beginPath();
        g.moveTo(px + t * 0.15, py + t * fy);
        for (let i = 1; i <= 8; i++) {
          g.lineTo(px + t * (0.15 + i * 0.09), py + t * fy + Math.sin(i * 1.4) * 4);
        }
        g.strokePath();
      }
    }
  }

  drawEffects(tile, x, y, byId) {
    const g = this.ground;
    const t = this.tile;
    const px = this.x0 + x * t;
    const py = this.y0 + y * t;
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
        g.lineTo(px + t * fx - 4, py + t * 0.7);
        g.lineTo(px + t * fx + 4, py + t * 0.55);
        g.lineTo(px + t * fx, py + t * 0.4);
        g.strokePath();
      }
    }
    if (tile.wet.length && !tile.steam) {
      g.fillStyle(EFFECT_STYLE.wet, 0.9);
      for (const [fx, fy] of [[0.12, 0.14], [0.88, 0.14], [0.12, 0.88], [0.88, 0.88]]) {
        g.fillCircle(px + t * fx, py + t * fy, 3);
      }
    }
    if (tile.steam) {
      g.lineStyle(2, EFFECT_STYLE.steam, 0.8);
      for (const fx of [0.12, 0.88]) {
        g.strokeCircle(px + t * fx, py + t * 0.15, 4);
        g.strokeCircle(px + t * fx + 3, py + t * 0.1, 3);
      }
    }
    for (const cause of tile.air) {
      const fan = byId.get(cause.id);
      const side = rotateSide('N', fan.rot);
      const [nx, ny] = neighbour(0, 0, side);
      g.lineStyle(2, EFFECT_STYLE.air, 0.85);
      for (const off of [-0.25, 0.25]) {
        const cx = px + t / 2 + (ny !== 0 ? off * t : 0);
        const cy = py + t / 2 + (nx !== 0 ? off * t : 0);
        const ex = cx + nx * 14;
        const ey = cy + ny * 14;
        g.lineBetween(cx - nx * 14, cy - ny * 14, ex, ey);
        g.lineBetween(ex, ey, ex - nx * 6 - ny * 5, ey - ny * 6 - nx * 5);
        g.lineBetween(ex, ey, ex - nx * 6 + ny * 5, ey - ny * 6 + nx * 5);
      }
    }
    if (tile.alert.length) {
      g.lineStyle(2, EFFECT_STYLE.alert, 0.85);
      for (const [fx, fy] of [[0.12, 0.12], [0.88, 0.12], [0.12, 0.88], [0.88, 0.88]]) {
        g.strokeCircle(px + t * fx, py + t * fy, 5);
      }
    }
  }

  drawCharge(p, left, full, c, size) {
    const w = 7;
    const gap = 3;
    const total = full * w + (full - 1) * gap;
    const x = c.x - total / 2;
    const y = c.y + size / 2 - 11;
    for (let i = 0; i < full; i++) {
      this.modules.fillStyle(i < left ? 0x9ff0b8 : 0x3a414d, 1);
      this.modules.fillRect(x + i * (w + gap), y, w, 6);
    }
  }

  drawFlame(x, y, streak) {
    const g = this.modules;
    g.fillStyle(EFFECT_STYLE.hot, 1);
    g.fillTriangle(x - 6, y + 7, x + 6, y + 7, x, y - 9);
    g.fillStyle(0xffd27a, 1);
    g.fillTriangle(x - 3, y + 7, x + 3, y + 7, x, y - 2);
    if (streak > 1) g.fillCircle(x + 8, y - 6, 3);
  }

  // Flow on the move: dots crossing every live link, puffs where an open
  // output spills, and arrows where an open input pulls from the ground.
  animate(time) {
    const g = this.anim;
    g.clear();
    const phase = (time % 900) / 900;
    for (const f of this.flowing) {
      for (let i = 0; i < 3; i++) {
        const k = (phase + i / 3) % 1;
        g.fillStyle(f.color, 1);
        g.fillCircle(f.from.x + (f.to.x - f.from.x) * k, f.from.y + (f.to.y - f.from.y) * k, 4);
      }
    }
    const reach = this.tile / 2;
    for (const s of this.spilling) {
      const [dx, dy] = neighbour(0, 0, s.side);
      const ex = s.x + dx * reach;
      const ey = s.y + dy * reach;
      g.lineStyle(2, s.color, 1 - phase);
      g.strokeCircle(ex, ey, 4 + phase * 14);
    }
    for (const d of this.drawing) {
      const [dx, dy] = neighbour(0, 0, d.side);
      const k = 1 - phase;
      g.fillStyle(d.color, 0.9);
      g.fillCircle(d.x + dx * reach * (0.6 + k * 0.4), d.y + dy * reach * (0.6 + k * 0.4) + 12 * k, 3.5);
    }
  }
}
