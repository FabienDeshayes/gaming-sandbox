// The whole prototype is this one screen: a palette of modules, the test bench
// they are built on, a readout of what the machine does, and a turn-by-turn
// timeline of the test run. Every edit re-runs the machine at once, so what
// the screen shows is always what the build will do — and while a module is
// being dragged, it shows what the build *would* do with it dropped there.

import {
  COLORS,
  DRAG_THRESHOLD,
  FLOW_STYLE,
  FONT,
  FONT_LG,
  FONT_RG,
  FONT_SM,
  GAME_WIDTH,
  LAYOUT,
  MATERIAL_STYLE,
  PLAY_STEP_MS,
  ROLE_STYLE,
  TEXT_RESOLUTION,
} from '../config.js';
import { BENCH, EXAMPLES } from '../data/bench.js';
import { FLOWS, MODULES, PALETTE } from '../data/modules.js';
import {
  FLOW_NAMES,
  canPlace,
  describe,
  label,
  portsOf,
  simulate,
  terrainAt,
  tileKey,
  tileName,
  whyIdle,
} from '../core/machine.js';
import { BenchView } from '../ui/BenchView.js';
import { createButton } from '../ui/button.js';
import { drawModule, flowShape, roleKey } from '../ui/moduleArt.js';
import { Readout } from '../ui/Readout.js';
import { Timeline } from '../ui/Timeline.js';

const SIDE_WORDS = { N: 'north', E: 'east', S: 'south', W: 'west' };
const HELP = [
  'Drag a module from the left onto a tile.',
  'Click a placed module to turn it. R turns whatever is under the pointer, or the one you are dragging.',
  'Drag a module to move it; drag it off the bench (or press Delete) to remove it.',
  'Touching ports connect when they carry the same flow, one out (solid) and one in (hollow).',
  'Hover anything to inspect it.',
];

export class BenchScene extends Phaser.Scene {
  constructor() {
    super('BenchScene');
  }

  create() {
    this.placements = [];
    this.nextId = 1;
    this.viewTurn = 1;
    this.drag = null;
    this.armed = null;
    this.hoverId = null;
    this.hoverTile = null;
    this.hoverType = null;
    this.lineHighlight = [];
    this.playTimer = null;

    this.input.mouse?.disableContextMenu();
    this.drawHeader();
    this.drawPalette();
    this.drawLegend();
    this.view = new BenchView(this, BENCH);
    this.readout = new Readout(this, (ids) => {
      this.lineHighlight = ids;
      this.refresh();
    });
    this.drawTimelineHeader();
    this.timeline = new Timeline(this);
    this.dragGfx = this.add.graphics().setDepth(20);
    this.dragLabel = this.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: COLORS.text, resolution: TEXT_RESOLUTION })
      .setOrigin(0.5)
      .setDepth(21);

    this.input.on('pointerdown', (pointer, over) => this.onDown(pointer, over));
    this.input.on('pointermove', (pointer) => this.onMove(pointer));
    this.input.on('pointerup', (pointer) => this.onUp(pointer));
    this.input.keyboard?.on('keydown', (event) => this.onKey(event));

    this.loadExample(0);
  }

  update(time) {
    this.view.animate(time);
  }

  // --- State -----------------------------------------------------------------

  // The build as it stands, or as it would stand with the dragged module
  // dropped on the tile under the pointer.
  shownPlacements() {
    const d = this.drag;
    if (!d || !d.moved || !d.target) return { placements: this.placements, ghostId: null };
    const [x, y] = d.target;
    if (d.kind === 'new') {
      return { placements: [...this.placements, { id: 'ghost', type: d.type, x, y, rot: d.rot }], ghostId: 'ghost' };
    }
    return {
      placements: this.placements.map((p) => (p.id === d.id ? { ...p, x, y, rot: d.rot } : p)),
      ghostId: d.id,
    };
  }

  refresh() {
    const { placements, ghostId } = this.shownPlacements();
    this.sim = simulate(BENCH, placements);
    this.desc = describe(BENCH, placements, this.sim);
    this.shown = placements;
    const highlight = new Set(this.lineHighlight);
    this.view.render({
      placements,
      sim: this.sim,
      turn: this.viewTurn,
      ghostId,
      highlight,
      hoverId: ghostId ?? this.hoverId,
    });
    this.readout.render(this.desc);
    this.timeline.render(placements, this.sim, this.viewTurn);
    this.turnLabel.setText(`TEST RUN · turn ${this.viewTurn} of ${this.sim.turns.length}`);
    this.renderInspect();
    this.paintPalette();
  }

  place(type, x, y, rot = 0) {
    const p = { id: `m${this.nextId++}`, type, x, y, rot };
    this.placements.push(p);
    return p;
  }

  remove(id) {
    this.placements = this.placements.filter((p) => p.id !== id);
    if (this.hoverId === id) this.hoverId = null;
  }

  rotate(id) {
    const p = this.placements.find((q) => q.id === id);
    if (p) p.rot = (p.rot + 1) % 4;
  }

  loadExample(index) {
    this.stop();
    this.placements = [];
    for (const [type, x, y, rot] of EXAMPLES[index].parts) this.place(type, x, y, rot);
    this.viewTurn = 1;
    this.refresh();
  }

  clear() {
    this.stop();
    this.placements = [];
    this.viewTurn = 1;
    this.refresh();
  }

  setTurn(turn) {
    this.viewTurn = Phaser.Math.Clamp(turn, 1, this.sim.turns.length);
    this.refresh();
  }

  play() {
    if (this.playTimer) {
      this.stop();
      return;
    }
    this.viewTurn = 1;
    this.playButton.setLabel('❚❚ Pause');
    this.refresh();
    this.playTimer = this.time.addEvent({
      delay: PLAY_STEP_MS,
      loop: true,
      callback: () => {
        if (this.viewTurn >= this.sim.turns.length) {
          this.stop();
          return;
        }
        this.setTurn(this.viewTurn + 1);
      },
    });
  }

  stop() {
    this.playTimer?.remove();
    this.playTimer = null;
    this.playButton?.setLabel('▶ Run test');
  }

  // --- Input -----------------------------------------------------------------

  paletteAt(px, py) {
    return this.paletteItems.find((it) => px >= it.x && px <= it.x + it.w && py >= it.y && py <= it.y + it.h);
  }

  moduleAt(px, py) {
    const tile = this.view.tileAt(px, py);
    if (!tile) return null;
    return this.placements.find((p) => p.x === tile[0] && p.y === tile[1]) ?? null;
  }

  onDown(pointer, over) {
    if (over.some((o) => o.isButton)) return;
    if (pointer.rightButtonDown()) {
      const p = this.moduleAt(pointer.x, pointer.y);
      if (p) {
        this.rotate(p.id);
        this.refresh();
      }
      return;
    }
    const item = this.paletteAt(pointer.x, pointer.y);
    if (item) {
      this.drag = { kind: 'new', type: item.type, rot: 0, moved: false, target: null };
      return;
    }
    const p = this.moduleAt(pointer.x, pointer.y);
    if (p) {
      this.drag = { kind: 'move', id: p.id, type: p.type, rot: p.rot, moved: false, target: null };
      return;
    }
    const tile = this.view.tileAt(pointer.x, pointer.y);
    if (tile && this.armed) {
      this.place(this.armed, tile[0], tile[1]);
      this.refresh();
      return;
    }
    const turn = this.timeline.turnAt(pointer.x, pointer.y, this.sim.turns.length);
    if (turn) {
      this.stop();
      this.setTurn(turn);
    }
  }

  onMove(pointer) {
    const d = this.drag;
    if (d) {
      if (!d.moved && pointer.getDistance() >= DRAG_THRESHOLD) {
        d.moved = true;
        this.armed = null;
      }
      if (d.moved) {
        const tile = this.view.tileAt(pointer.x, pointer.y);
        const ok = tile && canPlace(BENCH, this.placements, tile[0], tile[1], d.kind === 'move' ? d.id : null);
        const target = ok ? tile : null;
        const changed = String(target) !== String(d.target);
        d.target = target;
        this.drawDragged(pointer);
        if (changed) this.refresh();
        return;
      }
    }
    this.updateHover(pointer);
  }

  onUp(pointer) {
    const d = this.drag;
    this.drag = null;
    this.dragGfx.clear();
    this.dragLabel.setText('');
    if (!d) return;
    if (!d.moved) {
      // A click, not a drag.
      if (d.kind === 'new') this.armed = this.armed === d.type ? null : d.type;
      else this.rotate(d.id);
      this.refresh();
      return;
    }
    const tile = this.view.tileAt(pointer.x, pointer.y);
    if (d.kind === 'new') {
      if (d.target) this.place(d.type, d.target[0], d.target[1], d.rot);
    } else if (d.target) {
      const p = this.placements.find((q) => q.id === d.id);
      [p.x, p.y] = d.target;
      p.rot = d.rot;
    } else if (!tile) {
      this.remove(d.id);
    }
    this.updateHover(pointer);
    this.refresh();
  }

  onKey(event) {
    const key = event.key;
    if (key === 'r' || key === 'R') {
      if (this.drag) {
        this.drag.rot = (this.drag.rot + 1) % 4;
        this.drawDragged(this.input.activePointer);
      } else if (this.hoverId) {
        this.rotate(this.hoverId);
      }
      this.refresh();
    } else if ((key === 'Delete' || key === 'Backspace') && this.hoverId && !this.drag) {
      this.remove(this.hoverId);
      this.refresh();
    } else if (key === 'Escape') {
      this.armed = null;
      this.refresh();
    } else if (key === ' ') {
      this.play();
    } else if (key === 'ArrowRight') {
      this.stop();
      this.setTurn(this.viewTurn + 1);
    } else if (key === 'ArrowLeft') {
      this.stop();
      this.setTurn(this.viewTurn - 1);
    }
  }

  updateHover(pointer) {
    const item = this.paletteAt(pointer.x, pointer.y);
    const p = this.moduleAt(pointer.x, pointer.y);
    const tile = this.view.tileAt(pointer.x, pointer.y);
    const next = { type: item?.type ?? null, id: p?.id ?? null, tile: !p && tile ? tileKey(...tile) : null };
    const prev = { type: this.hoverType, id: this.hoverId, tile: this.hoverTile };
    this.hoverType = next.type;
    this.hoverId = next.id;
    this.hoverTile = next.tile;
    if (JSON.stringify(next) !== JSON.stringify(prev)) this.refresh();
  }

  // --- Drawing ---------------------------------------------------------------

  drawDragged(pointer) {
    const d = this.drag;
    this.dragGfx.clear();
    this.dragLabel.setText('');
    if (d.target) return; // shown as a ghost on the bench instead
    const off = !this.view.tileAt(pointer.x, pointer.y);
    drawModule(this.dragGfx, d.type, d.rot, pointer.x, pointer.y, 66, { alpha: 0.85 });
    if (d.kind === 'move' && off) {
      this.dragGfx.lineStyle(3, COLORS.badHex, 1);
      this.dragGfx.strokeRoundedRect(pointer.x - 36, pointer.y - 36, 72, 72, 10);
      this.dragLabel.setText('drop to remove').setPosition(pointer.x, pointer.y + 50).setColor(COLORS.bad);
    } else {
      this.dragLabel.setText(MODULES[d.type].name).setPosition(pointer.x, pointer.y + 50).setColor(COLORS.text);
    }
  }

  drawHeader() {
    this.add
      .text(LAYOUT.palette.x, 28, 'COMBINATOR', {
        fontFamily: FONT,
        fontSize: `${FONT_LG}px`,
        fontStyle: 'bold',
        color: COLORS.text,
        resolution: TEXT_RESOLUTION,
      })
      .setOrigin(0, 0.5);
    this.add
      .text(LAYOUT.palette.x + 168, 30, 'machine test bench', {
        fontFamily: FONT,
        fontSize: `${FONT_RG}px`,
        color: COLORS.muted,
        resolution: TEXT_RESOLUTION,
      })
      .setOrigin(0, 0.5);

    let x = GAME_WIDTH - 16;
    const clear = createButton(this, 0, 28, 'Clear bench', () => this.clear(), { fontSize: FONT_SM });
    clear.moveX(x - clear.width / 2);
    x -= clear.width + 24;
    for (let i = EXAMPLES.length - 1; i >= 0; i--) {
      const b = createButton(this, 0, 28, EXAMPLES[i].name, () => this.loadExample(i), { fontSize: FONT_SM });
      b.moveX(x - b.width / 2);
      x -= b.width + 8;
    }
    this.add
      .text(x, 28, 'Examples:', { fontFamily: FONT, fontSize: `${FONT_SM}px`, color: COLORS.muted, resolution: TEXT_RESOLUTION })
      .setOrigin(1, 0.5);
  }

  drawPalette() {
    const { x, y, w, rowH, headingH, gap } = LAYOUT.palette;
    const colW = (w - gap) / 2;
    this.paletteItems = [];
    this.paletteGfx = this.add.graphics().setDepth(1);
    let top = y;
    for (const shelf of PALETTE) {
      const role = ROLE_STYLE[roleKey(MODULES[shelf.ids[0]])];
      this.add
        .text(x, top + 4, shelf.heading.toUpperCase(), {
          fontFamily: FONT,
          fontSize: `${FONT_SM}px`,
          fontStyle: 'bold',
          color: role.css,
          resolution: TEXT_RESOLUTION,
        })
        .setDepth(2);
      top += headingH;
      shelf.ids.forEach((type, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const item = { type, x: x + col * (colW + gap), y: top + row * (rowH + gap), w: colW, h: rowH };
        this.paletteItems.push(item);
        this.add
          .text(item.x + 40, item.y + rowH / 2, MODULES[type].name, {
            fontFamily: FONT,
            fontSize: '13px',
            color: COLORS.text,
            wordWrap: { width: colW - 44 },
            resolution: TEXT_RESOLUTION,
          })
          .setOrigin(0, 0.5)
          .setDepth(3);
      });
      top += Math.ceil(shelf.ids.length / 2) * (rowH + gap) + 4;
    }
  }

  paintPalette() {
    const g = this.paletteGfx;
    g.clear();
    for (const item of this.paletteItems) {
      const on = item.type === this.armed;
      const hover = item.type === this.hoverType;
      g.fillStyle(on ? COLORS.selectedHex : hover ? COLORS.buttonHoverHex : COLORS.panelHex, 1);
      g.fillRoundedRect(item.x, item.y, item.w, item.h, 6);
      g.lineStyle(on ? 2 : 1, on ? COLORS.highlightHex : COLORS.panelEdgeHex, 1);
      g.strokeRoundedRect(item.x, item.y, item.w, item.h, 6);
      drawModule(g, item.type, 0, item.x + 20, item.y + item.h / 2, 26);
    }
  }

  drawLegend() {
    const y = LAYOUT.legend.y;
    const g = this.add.graphics().setDepth(1);
    let x = LAYOUT.bench.x - 20;
    const style = { fontFamily: FONT, fontSize: `${FONT_SM}px`, color: COLORS.muted, resolution: TEXT_RESOLUTION };
    for (const flow of FLOWS) {
      flowShape(g, flow, x + 8, y, 7, true);
      const t = this.add
        .text(x + 20, y, FLOW_NAMES[flow], { ...style, color: FLOW_STYLE[flow].css })
        .setOrigin(0, 0.5);
      x += t.width + 40;
    }
    this.add.text(x, y, 'solid = output · hollow = input', style).setOrigin(0, 0.5);
  }

  drawTimelineHeader() {
    const { x, y, w } = LAYOUT.timeline;
    this.turnLabel = this.add
      .text(x, y + 14, '', {
        fontFamily: FONT,
        fontSize: `${FONT_SM}px`,
        fontStyle: 'bold',
        color: COLORS.text,
        resolution: TEXT_RESOLUTION,
      })
      .setOrigin(0, 0.5);
    const next = createButton(this, x + w - 22, y + 14, '▶|', () => {
      this.stop();
      this.setTurn(this.viewTurn + 1);
    }, { fontSize: FONT_SM, padX: 10, padY: 5 });
    this.playButton = createButton(this, next.x - 92, y + 14, '▶ Run test', () => this.play(), {
      fontSize: FONT_SM,
      padX: 10,
      padY: 5,
      width: 120,
    });
    createButton(this, this.playButton.x - 92, y + 14, '|◀', () => {
      this.stop();
      this.setTurn(this.viewTurn - 1);
    }, { fontSize: FONT_SM, padX: 10, padY: 5 });
  }

  // --- Inspector -------------------------------------------------------------

  renderInspect() {
    const record = this.sim.turns[this.viewTurn - 1];
    const placed = this.shown.find((p) => p.id === this.hoverId);
    if (placed) return this.readout.inspect(this.moduleInfo(placed.type, placed, record));
    const type = this.hoverType ?? this.armed;
    if (type) return this.readout.inspect(this.moduleInfo(type, null, null));
    if (this.hoverTile) return this.readout.inspect(this.tileInfo(this.hoverTile, record));
    return this.readout.inspect({
      title: 'How to build',
      lines: HELP.map((text) => ({ text, color: COLORS.muted })),
    });
  }

  moduleInfo(type, p, record) {
    const def = MODULES[type];
    const role = ROLE_STYLE[roleKey(def)];
    const lines = [{ text: def.blurb }];
    const ports = p
      ? portsOf(p)
      : def.ports.map((port, index) => ({ ...port, index }));
    for (const port of ports) {
      lines.push({
        text: `${port.dir === 'in' ? 'In' : 'Out'}: ${FLOW_NAMES[port.flow]} ${port.dir === 'in' ? 'from the' : 'to the'} ${SIDE_WORDS[port.side]}`,
        color: FLOW_STYLE[port.flow].css,
      });
    }
    lines.push({ text: MATERIAL_STYLE[def.material].label, color: COLORS.muted });
    if (p && record) {
      const turn = record.turn;
      if (!record.present.includes(p.id)) {
        lines.push({ text: `Turn ${turn}: burnt down after turn ${this.sim.burntAfter[p.id]}.`, color: COLORS.bad });
      } else if (record.active[p.id]) {
        const charge = def.role === 'source' ? ` ${record.charge[p.id]} of ${def.charge} turns of charge left.` : '';
        lines.push({ text: `Turn ${turn}: running.${charge}`, color: COLORS.good });
      } else {
        lines.push({ text: `Turn ${turn}: idle, because ${whyIdle(BENCH, this.shown, this.sim, p.id, turn)}.`, color: COLORS.bad });
      }
    }
    return { title: p ? label(p) : def.name, color: role.css, subtitle: role.label, lines };
  }

  tileInfo(key, record) {
    const [x, y] = key.split(',').map(Number);
    const terrain = terrainAt(BENCH, x, y);
    const lines = [];
    if (terrain) {
      lines.push({
        text: `${terrain.name}: an open ${FLOW_NAMES[terrain.provides]} input on a module standing here draws from it, and it never runs out.${terrain.hot ? ' Always hot.' : ''}`,
      });
    } else {
      lines.push({ text: 'Bare ground. Nothing to draw from.', color: COLORS.muted });
    }
    const tile = record.tiles[key];
    const byId = new Map(this.shown.map((p) => [p.id, p]));
    const from = (causes) =>
      [...new Set(causes.map((c) => (c.kind === 'terrain' ? 'the embers' : `${c.kind === 'waste' ? 'waste heat from ' : ''}${label(byId.get(c.id))}`)))].join(', ');
    if (tile) {
      if (tile.steam) lines.push({ text: `Steaming: water from ${from(tile.wet)} cools the heat from ${from(tile.hot)}.` });
      else {
        if (tile.wet.length) lines.push({ text: `Wet, from ${from(tile.wet)}.`, color: FLOW_STYLE.matter.css });
        if (tile.isHot) lines.push({ text: `Hot, from ${from(tile.hot)}. Wood here burns after 2 hot turns.`, color: FLOW_STYLE.heat.css });
      }
      if (tile.air.length) lines.push({ text: `Air blown by ${from(tile.air)}.` });
      if (tile.alert.length) lines.push({ text: `Alerted by ${from(tile.alert)}.`, color: FLOW_STYLE.signal.css });
    }
    if (this.armed) lines.push({ text: `Click to place a ${MODULES[this.armed].name} here.`, color: COLORS.good });
    return { title: `Tile ${tileName(x, y)}`, subtitle: `Turn ${record.turn}`, lines };
  }
}
