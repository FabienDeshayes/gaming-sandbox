// Draws the Workbench: the cells a machine is built on, the ground it is being
// tested on, what each cell feels on the turn being viewed, the modules, their
// links, and the flows moving through them. Holds no machine state — the scene
// hands it the parts, the run and the turn, and it draws that.

import { COLORS, EFFECT_STYLE, FLOW_STYLE, FONT, LAYOUT, MOBILE, MOBILE_LAYOUT, TERRAIN_STYLE, TEXT_RESOLUTION } from '../config.js';
import { MODULES } from '../data/modules.js';
import { neighbour, portsOf } from '../core/machine.js';
import { drawModule, portPoint } from './moduleArt.js';
import { drawTileEffects } from './tileArt.js';

const BODY = 0.8; // module body as a share of the tile

export class BenchView {
  constructor(scene, bench) {
    this.scene = scene;
    this.bench = bench;
    const { x, y, tile } = (MOBILE ? MOBILE_LAYOUT : LAYOUT).bench;
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

  // state: { placements, sim, turn, ground, ghostId, highlight: Set }
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

    // The ground the whole machine stands on: a tint under every cell and a
    // frame round the Workbench.
    const ground = state.ground ? TERRAIN_STYLE[state.ground] : null;
    for (let y = 0; y < this.bench.rows; y++) {
      for (let x = 0; x < this.bench.cols; x++) {
        const px = this.x0 + x * this.tile;
        const py = this.y0 + y * this.tile;
        this.ground.fillStyle(COLORS.tileHex, 1);
        this.ground.fillRect(px + 1, py + 1, this.tile - 2, this.tile - 2);
        if (ground !== null) {
          this.ground.fillStyle(ground, 0.12);
          this.ground.fillRect(px + 1, py + 1, this.tile - 2, this.tile - 2);
        }
      }
    }
    this.ground.lineStyle(ground !== null ? 5 : 1, ground ?? COLORS.tileEdgeHex, 1);
    this.ground.strokeRect(this.x0 - (ground !== null ? 3 : 0), this.y0 - (ground !== null ? 3 : 0), this.width + (ground !== null ? 6 : 0), this.height + (ground !== null ? 6 : 0));

    // What each cell feels this turn: waste heat, and whatever lands on the
    // machine's tile in the world.
    const byId = new Map(placements.map((p) => [p.id, p]));
    for (const [key, cell] of Object.entries(record.tiles)) {
      const [x, y] = key.split(',').map(Number);
      drawTileEffects(this.ground, cell, this.x0 + x * this.tile, this.y0 + y * this.tile, this.tile);
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
          fontSize: MOBILE ? '10px' : '13px',
          fontStyle: 'bold',
          color: burnt ? '#8a7a6a' : COLORS.text,
          align: 'center',
          wordWrap: { width: size - (MOBILE ? 6 : 18) },
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
