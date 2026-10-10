// Draws the Workbench: the row a machine is built in, the ground it is being
// tested on, what each piece feels on the turn being viewed, the modules, the
// links along the row, the flows moving through them, and a few words under
// each piece saying what it takes, what it gives and how it is doing. Holds no
// machine state — the scene hands it the parts, the run and the turn, and it
// draws that.

import { COLORS, EFFECT_STYLE, FLOW_STYLE, FONT, LAYOUT, MOBILE, MOBILE_LAYOUT, TERRAIN_STYLE, TEXT_RESOLUTION } from '../config.js';
import { MODULES, TUNING } from '../data/modules.js';
import { TERRAIN } from '../data/world.js';
import { FLOW_NAMES, labelFor, portsOf } from '../core/machine.js';
import { drawModule, portAnchor } from './moduleArt.js';
import { drawTileEffects } from './tileArt.js';

const BODY = 0.86; // module body as a share of the slot
const LANE = MOBILE ? 6 : 8; // how far apart links over the row run

// What an effector does, in a few words under it.
const EFFECT_SHORT = {
  wet: 'Wets 5 tiles',
  air: 'Air on 2 tiles ahead',
  hot: 'Heats the tile ahead',
  alert: 'Rings over 5 tiles',
};

export class BenchView {
  constructor(scene, bench) {
    this.scene = scene;
    this.slots = bench.slots;
    const { x, y, slot, gap, captionH, top } = (MOBILE ? MOBILE_LAYOUT : LAYOUT).bench;
    this.x0 = x;
    this.y0 = y;
    this.slot = slot;
    this.gap = gap;
    this.top = top;
    this.captionH = captionH;
    this.width = this.slots * slot + (this.slots - 1) * gap;
    this.bottom = y + slot + captionH;

    this.ground = scene.add.graphics().setDepth(1);
    this.links = scene.add.graphics().setDepth(3);
    this.modules = scene.add.graphics().setDepth(4);
    this.overlay = scene.add.graphics().setDepth(6);
    this.anim = scene.add.graphics().setDepth(7);
    this.labels = [];
    this.flowing = [];
    this.spilling = [];
    this.drawing = [];
  }

  slotX(i) {
    return this.x0 + i * (this.slot + this.gap);
  }

  center(i) {
    return { x: this.slotX(i) + this.slot / 2, y: this.y0 + this.slot / 2 };
  }

  // The slot whose column (the piece and the words under it) is under a point.
  slotAt(px, py) {
    if (py < this.y0 || py > this.bottom) return null;
    for (let i = 0; i < this.slots; i++) {
      const x = this.slotX(i);
      if (px >= x - this.gap / 2 && px <= x + this.slot + this.gap / 2) return i;
    }
    return null;
  }

  // Close enough to the row to drop something into it.
  inBand(px, py) {
    return px >= this.x0 - 30 && px <= this.x0 + this.width + 30 && py >= this.top && py <= this.bottom;
  }

  // Where a piece dropped at px would go, among `count` pieces sitting in the
  // first slots: before the first piece whose middle is right of px.
  insertIndex(px, count) {
    let i = 0;
    while (i < count && this.center(i).x < px) i++;
    return i;
  }

  // state: { placements, sim, turn, ground, ghostId, highlight: Set }
  render(state) {
    const { placements, sim, turn } = state;
    const record = sim.turns[turn - 1];
    const size = this.slot * BODY;
    const present = new Set(record.present);
    const labelOf = labelFor(placements);
    this.order = placements;

    this.ground.clear();
    this.links.clear();
    this.modules.clear();
    this.overlay.clear();
    for (const t of this.labels) t.destroy();
    this.labels = [];

    // The ground the whole machine stands on: a band under the row, framed in
    // its colour.
    const ground = state.ground ? TERRAIN_STYLE[state.ground] : null;
    const pad = 8;
    const band = [this.x0 - pad, this.y0 - pad, this.width + pad * 2, this.slot + pad * 2];
    this.ground.fillStyle(ground ?? COLORS.tileHex, ground !== null ? 0.16 : 0.5);
    this.ground.fillRoundedRect(...band, 12);
    this.ground.lineStyle(ground !== null ? 4 : 1, ground ?? COLORS.tileEdgeHex, 1);
    this.ground.strokeRoundedRect(...band, 12);
    for (let i = 0; i < this.slots; i++) {
      const x = this.slotX(i);
      const filled = i < placements.length;
      this.ground.fillStyle(COLORS.tileHex, filled ? 1 : 0.6);
      this.ground.fillRoundedRect(x, this.y0, this.slot, this.slot, 10);
      if (!filled) {
        this.ground.lineStyle(1, COLORS.tileEdgeHex, 1);
        this.ground.strokeRoundedRect(x + 3, this.y0 + 3, this.slot - 6, this.slot - 6, 8);
      }
    }
    if (placements.length < this.slots) {
      const c = this.center(placements.length);
      this.text(c.x, c.y, '+', { fontSize: MOBILE ? '20px' : '26px', color: COLORS.muted }, 2);
    }

    // What each piece feels this turn: waste heat, and whatever lands on the
    // machine's tile in the world.
    for (const [pos, cell] of Object.entries(record.cells)) {
      drawTileEffects(this.ground, cell, this.slotX(Number(pos)), this.y0, this.slot);
    }

    // Links along the row. Neighbours join straight across the gap; a link
    // that skips pieces runs over the top of them, one lane per link so
    // overlapping ones stay apart.
    const byId = new Map(placements.map((p, i) => [p.id, { p, i }]));
    const anchor = (info) => {
      const { p, i } = byId.get(info.id);
      const c = this.center(i);
      return portAnchor(p.type, info.index, c.x, c.y, size);
    };
    const pairs = [];
    for (const info of sim.net.ports.values()) {
      if (info.dir === 'out' && info.status === 'linked') pairs.push([info, sim.net.ports.get(info.partner)]);
    }
    pairs.sort((a, b) => a[1].pos - a[0].pos - (b[1].pos - b[0].pos));
    const lanes = [];
    this.flowing = [];
    for (const [out, inn] of pairs) {
      const a = anchor(out);
      const b = anchor(inn);
      let path;
      if (inn.pos === out.pos + 1) path = [a, b];
      else {
        let lane = 0;
        while ((lanes[lane] ?? []).some(([s, e]) => s < inn.pos && out.pos < e)) lane++;
        (lanes[lane] ??= []).push([out.pos, inn.pos]);
        const y = this.y0 - 6 - lane * LANE;
        const ax = a.x + 3 + lane * 1.5;
        const bx = b.x - 3 - lane * 1.5;
        path = [a, { x: ax, y: a.y }, { x: ax, y }, { x: bx, y }, { x: bx, y: b.y }, b];
      }
      const carrying = present.has(out.id) && present.has(inn.id) && record.carrying[out.key];
      const color = FLOW_STYLE[out.flow].color;
      this.links.lineStyle(MOBILE ? 3 : 4, color, carrying ? 1 : 0.3);
      for (let k = 1; k < path.length; k++) this.links.lineBetween(path[k - 1].x, path[k - 1].y, path[k].x, path[k].y);
      if (carrying) this.flowing.push({ path, color });
    }

    // Outputs nobody takes spilling, inputs drawing from the ground.
    const at = (key) => anchor(sim.net.ports.get(key));
    this.spilling = record.spills.map((s) => ({ ...at(s.key), color: FLOW_STYLE[s.flow].color }));
    this.drawing = record.draws.map((d) => ({ ...at(d.key), color: FLOW_STYLE[d.flow].color }));

    placements.forEach((p, i) => {
      const c = this.center(i);
      const def = MODULES[p.type];
      const burnt = !present.has(p.id);
      const carrying = {};
      for (const port of portsOf(p)) carrying[port.index] = !!record.carrying[port.key];
      const ghost = p.id === state.ghostId;
      drawModule(this.modules, p.type, c.x, c.y, size, {
        carrying,
        dim: !burnt && !record.active[p.id],
        burnt,
        alpha: ghost ? 0.7 : 1,
      });
      this.text(c.x, c.y, burnt ? 'burnt' : def.name, {
        fontSize: MOBILE ? '9px' : '13px',
        fontStyle: 'bold',
        color: burnt ? '#8a7a6a' : COLORS.text,
        align: 'center',
        wordWrap: { width: size - (MOBILE ? 4 : 16) },
        backgroundColor: burnt ? null : 'rgba(18,21,27,0.78)',
        padding: { x: 2, y: 1 },
      }).setAlpha(ghost ? 0.8 : 1);

      this.caption(p, i, labelOf, sim, record, state.ground);
      if (burnt) return;
      if (def.role === 'source') this.drawCharge(record.charge[p.id], def.charge, c, size);
      const streak = record.streak[p.id];
      if (def.material === 'wood' && streak > 0) this.drawFlame(c.x + size / 2 - 8, c.y - size / 2 + 8, streak);
    });

    const outline = (i, alpha, width) => {
      const x = this.slotX(i);
      this.overlay.lineStyle(width, COLORS.highlightHex, alpha);
      this.overlay.strokeRoundedRect(x - 2, this.y0 - 2, this.slot + 4, this.slot + 4, 12);
    };
    for (const id of state.highlight ?? []) if (byId.has(id)) outline(byId.get(id).i, 0.95, 3);
    if (state.ghostId) outline(byId.get(state.ghostId).i, 0.8, 2);
  }

  text(x, y, s, style, depth = 5) {
    const t = this.scene.add
      .text(x, y, s, { fontFamily: FONT, color: COLORS.text, resolution: TEXT_RESOLUTION, ...style })
      .setOrigin(0.5)
      .setDepth(depth);
    this.labels.push(t);
    return t;
  }

  // A few words under a piece, one line each: its place and how it is doing,
  // where each input comes from, where each output goes, what it does to the
  // world, and what it is feeling.
  caption(p, i, labelOf, sim, record, groundId) {
    const def = MODULES[p.type];
    const muted = COLORS.muted;
    const lines = [];
    const burnt = !record.present.includes(p.id);
    const active = !!record.active[p.id];
    let status;
    if (burnt) status = { text: 'Burnt', color: '#b08a6a' };
    else if (active) status = { text: 'Running', color: COLORS.good };
    else if (def.role === 'source') status = { text: 'Empty', color: COLORS.warn };
    else status = { text: 'Idle', color: COLORS.bad };
    lines.push({ text: `#${i + 1} ${status.text}`, color: status.color, bold: true });

    const ground = groundId ? TERRAIN[groundId].name.toLowerCase() : null;
    const short = (id) => `#${this.order.findIndex((q) => q.id === id) + 1}`;
    for (const port of portsOf(p)) {
      const info = sim.net.ports.get(port.key);
      const flow = FLOW_NAMES[port.flow];
      const on = !burnt && !!record.carrying[port.key];
      const color = on ? FLOW_STYLE[port.flow].css : muted;
      const other = info.status === 'linked' ? this.order.find((q) => q.id === info.partnerId) : null;
      if (port.dir === 'in') {
        if (other) lines.push({ text: MOBILE ? `◂ ${flow} ${short(other.id)}` : `◂ ${flow} from ${labelOf(other)}`, color });
        else if (on) lines.push({ text: MOBILE ? `◂ ${flow} ground` : `◂ ${flow} from the ${ground}`, color });
        else lines.push({ text: `◂ no ${flow}`, color: burnt ? muted : COLORS.bad });
      } else if (other) {
        lines.push({ text: MOBILE ? `${flow} ▸ ${short(other.id)}` : `${flow} ▸ ${labelOf(other)}`, color });
      } else {
        const lands = port.flow === 'matter' || port.flow === 'heat';
        lines.push({ text: `${flow} ${lands ? 'spills' : 'wasted'}`, color });
      }
    }
    if (def.effect) {
      lines.push({ text: EFFECT_SHORT[def.effect.kind], color: active ? `#${EFFECT_STYLE[def.effect.kind].toString(16).padStart(6, '0')}` : muted });
    }
    const cell = record.cells[i];
    if (!burnt && cell) {
      if (cell.steam) lines.push({ text: 'Steaming', color: '#dfe8f0' });
      else if (cell.isHot) {
        const wood = def.material === 'wood';
        lines.push({ text: wood ? `Hot ${record.streak[p.id]}/${TUNING.burnTurns}, wood` : 'Hot, metal', color: FLOW_STYLE.heat.css });
      } else if (cell.wet.length) lines.push({ text: 'Wet', color: FLOW_STYLE.matter.css });
    }

    const x = this.slotX(i) + this.slot / 2;
    let y = this.y0 + this.slot + (MOBILE ? 6 : 10);
    for (const line of lines) {
      const t = this.scene.add
        .text(x, y, line.text, {
          fontFamily: FONT,
          fontSize: MOBILE ? '10px' : '12px',
          fontStyle: line.bold ? 'bold' : 'normal',
          color: line.color,
          align: 'center',
          wordWrap: { width: this.slot + this.gap - 2 },
          lineSpacing: 0,
          resolution: TEXT_RESOLUTION,
        })
        .setOrigin(0.5, 0)
        .setDepth(5);
      this.labels.push(t);
      y += t.height + (MOBILE ? 1 : 3);
    }
  }

  drawCharge(left, full, c, size) {
    const w = MOBILE ? 5 : 7;
    const gap = MOBILE ? 2 : 3;
    const total = full * w + (full - 1) * gap;
    const x = c.x - total / 2;
    const y = c.y + size / 2 - (MOBILE ? 8 : 11);
    for (let i = 0; i < full; i++) {
      this.modules.fillStyle(i < left ? 0x9ff0b8 : 0x3a414d, 1);
      this.modules.fillRect(x + i * (w + gap), y, w, MOBILE ? 4 : 6);
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

  // Flow on the move: dots running along every live link, puffs where an
  // output nobody takes spills, and dots rising out of the ground into an
  // input that draws from it.
  animate(time) {
    const g = this.anim;
    g.clear();
    const phase = (time % 900) / 900;
    for (const f of this.flowing) {
      const legs = [];
      let total = 0;
      for (let k = 1; k < f.path.length; k++) {
        const len = Math.hypot(f.path[k].x - f.path[k - 1].x, f.path[k].y - f.path[k - 1].y);
        legs.push(len);
        total += len;
      }
      const dots = Math.max(2, Math.round(total / 40));
      for (let i = 0; i < dots; i++) {
        let d = ((phase + i / dots) % 1) * total;
        let k = 0;
        while (k < legs.length - 1 && d > legs[k]) d -= legs[k++];
        const from = f.path[k];
        const to = f.path[k + 1];
        const t = legs[k] ? d / legs[k] : 0;
        g.fillStyle(f.color, 1);
        g.fillCircle(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, MOBILE ? 3 : 4);
      }
    }
    for (const s of this.spilling) {
      g.lineStyle(2, s.color, 1 - phase);
      g.strokeCircle(s.x + 6, s.y, 4 + phase * 12);
    }
    const rise = this.slot * 0.5;
    for (const d of this.drawing) {
      g.fillStyle(d.color, 0.9);
      g.fillCircle(d.x - 6, d.y + rise * (1 - phase), 3.5);
    }
  }
}
