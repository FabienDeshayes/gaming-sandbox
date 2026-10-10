// The Playground: saved machines placed on a world, one per tile, and the
// round they play out together. Machines don't connect to each other; they
// meet through the tiles — one machine's sprinkler wets its neighbour's tile,
// a torch heats the next tile over, embers heat whatever stands on them. As on
// the Workbench, every change re-runs the round at once, and a machine being
// dragged is shown as if dropped where it hovers.

import {
  COLORS,
  EFFECT_STYLE,
  FLOW_STYLE,
  FONT,
  FONT_SM,
  GAME_WIDTH,
  MOBILE,
  MOBILE_PLAY_LAYOUT,
  PLAY_LAYOUT,
  PLAY_STEP_MS,
  ROLE_STYLE,
  TEXT_RESOLUTION,
} from '../config.js';
import { PLAYGROUND, TERRAIN } from '../data/world.js';
import { MODULES } from '../data/modules.js';
import {
  FLOW_NAMES,
  SIDE_WORDS,
  canPlace,
  causeNamer,
  describe,
  describeRound,
  runRound,
  terrainAt,
  testMachine,
  tileKey,
  tileName,
  unitArea,
  unitLabel,
  unitView,
  whyIdle,
} from '../core/machine.js';
import * as store from '../store.js';
import { createButton, isDrag } from '../ui/button.js';
import { ListView } from '../ui/ListView.js';
import { PanelTabs } from '../ui/panelTabs.js';
import { drawMachine } from '../ui/machineArt.js';
import { Readout } from '../ui/Readout.js';
import { drawHeader } from '../ui/tabs.js';
import { Timeline } from '../ui/Timeline.js';
import { WorldView } from '../ui/WorldView.js';

const HELP = [
  'Drag a saved machine from the left onto a tile, or click it and then click a tile.',
  'Click a placed machine to turn it. R turns whatever is under the pointer, or the one you are dragging.',
  'Drag a machine to move it; drag it off the Playground (or press Delete) to remove it.',
  'Machines act on the tiles round them, and on each other through those tiles. Open inputs draw from the ground a machine stands on.',
  'Change a machine on the Workbench and save it: every copy here changes with it.',
];
// Mouse or finger, in the words the screen uses.
const CLICK = MOBILE ? 'Tap' : 'Click';
const HELP_TOUCH = [
  'Drag a saved machine from the list onto a tile, or tap it and then tap tiles.',
  'Tap a placed machine to inspect it; tap it again (or Turn) to turn it.',
  'Drag a machine to move it; drag it off the Playground (or tap Remove) to remove it.',
  'Machines act on the tiles round them, and on each other through those tiles. Open inputs draw from the ground a machine stands on.',
  'Change a machine on the Workbench and save it: every copy here changes with it.',
];
// Where things sit: the stacked mobile layout or the desktop one.
const L = MOBILE ? MOBILE_PLAY_LAYOUT : PLAY_LAYOUT;
const EFFECT_WORDS = { wet: 'Wet', hot: 'Hot', steam: 'Steam', air: 'Air', alert: 'Alert' };

export class PlaygroundScene extends Phaser.Scene {
  constructor() {
    super('PlaygroundScene');
  }

  create() {
    this.placed = store.copy(store.placed());
    this.viewTurn = 1;
    this.drag = null;
    this.armed = null;
    this.hoverId = null;
    this.hoverTile = null;
    this.hoverMachine = null;
    this.lineHighlight = [];
    this.playTimer = null;

    this.input.mouse?.disableContextMenu();
    drawHeader(this, 'PlaygroundScene', () => this.stop());

    this.palette = new ListView(this, {
      ...L.machines,
      heading: 'SAVED MACHINES',
      empty: `No saved machines. Build one on the Workbench and ${MOBILE ? 'tap' : 'press'} Save.`,
      icon: (g, item, cx, cy, size) => drawMachine(g, item.parts, 0, cx, cy, size),
      onPage: () => this.refresh(),
    });
    this.view = new WorldView(this, PLAYGROUND, { ...L.world, coords: true, names: true });
    this.drawLegend();
    if (MOBILE) this.drawMobilePanel();
    else this.drawDesktopPanel();
    this.dragGfx = this.add.graphics().setDepth(20);
    this.dragLabel = this.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: COLORS.text, resolution: TEXT_RESOLUTION })
      .setOrigin(0.5)
      .setDepth(21);

    this.input.on('pointerdown', (pointer, over) => this.onDown(pointer, over));
    this.input.on('pointermove', (pointer) => this.onMove(pointer));
    this.input.on('pointerup', (pointer, over) => this.onUp(pointer, over));
    this.input.keyboard?.on('keydown', (event) => this.onKey(event));

    this.refresh();
  }

  // Desktop: the round under the world, the readout down the right.
  drawDesktopPanel() {
    const clear = createButton(this, 0, 28, 'Clear playground', () => this.clear(), { fontSize: FONT_SM });
    clear.moveX(GAME_WIDTH - 16 - clear.width / 2);
    this.readout = new Readout(
      this,
      PLAY_LAYOUT.panel,
      (ids) => {
        this.lineHighlight = ids;
        this.refresh();
      },
      ['What happens this round', 'Problems', 'Notes']
    );
    const { x, y, w } = PLAY_LAYOUT.timeline;
    this.drawRunControls(x + w, y + 14);
    this.turnLabel.setX(x);
    this.timeline = new Timeline(this, PLAY_LAYOUT.timeline);
  }

  // Mobile: the readout, the inspector and the round (its controls, Clear and
  // the timeline) under three tabs at the bottom.
  drawMobilePanel() {
    const P = MOBILE_PLAY_LAYOUT.panel;
    this.tabs = new PanelTabs(this, {
      y: MOBILE_PLAY_LAYOUT.tabs.y,
      panel: P,
      tabs: [
        { key: 'readout', label: 'Readout' },
        { key: 'inspect', label: 'Inspect' },
        { key: 'round', label: 'Round' },
      ],
      onChange: () => this.refresh(),
    });
    this.readout = new Readout(this, { ...P, stacked: false }, () => {}, ['What happens this round', 'Problems', 'Notes']);

    const right = P.x + P.w - 12;
    const clear = createButton(this, 0, P.y + 22, 'Clear', () => this.clear(), { fontSize: FONT_SM, padX: 10, padY: 7 });
    clear.moveX(right - clear.width / 2);
    const run = this.drawRunControls(clear.x - clear.width / 2 - 12, P.y + 22);
    this.turnLabel.setX(P.x + 12);
    this.timeline = new Timeline(this, {
      x: P.x + 12,
      y: P.y + 44,
      headerY: P.y + 56,
      w: P.w - 24,
      labelW: 150,
      rowH: 24,
      bottom: P.y + P.h - 4,
    });

    this.turnButton = createButton(this, 0, P.y + 24, '⟳ Turn', () => this.actOnFocus('turn'), { fontSize: FONT_SM, padX: 10, padY: 6 });
    this.removeButton = createButton(this, 0, P.y + 24, '✕ Remove', () => this.actOnFocus('remove'), { fontSize: FONT_SM, padX: 10, padY: 6 });
    this.removeButton.moveX(right - this.removeButton.width / 2);
    this.turnButton.moveX(this.removeButton.x - this.removeButton.width / 2 - 8 - this.turnButton.width / 2);

    this.tabs.add('readout', this.readout.summary);
    this.tabs.add('inspect', this.readout.inspector);
    this.tabs.add('round', clear, ...run, this.turnLabel, this.timeline);
  }

  // --- State -----------------------------------------------------------------

  // Placements resolved to the machines they show, as last saved. A placement
  // whose machine is gone is dropped (the store already does this on delete).
  unitsOf(list) {
    return list
      .map((p) => ({ ...p, machine: store.machine(p.machineId) }))
      .filter((u) => u.machine);
  }

  shownUnits() {
    const d = this.drag;
    const units = this.unitsOf(this.placed);
    if (!d || !d.moved || !d.target) return { units, ghostId: null };
    const [x, y] = d.target;
    if (d.kind === 'new') {
      return { units: [...units, ...this.unitsOf([{ id: 'ghost', machineId: d.machineId, x, y, rot: d.rot }])], ghostId: 'ghost' };
    }
    return { units: units.map((u) => (u.id === d.id ? { ...u, x, y, rot: d.rot } : u)), ghostId: d.id };
  }

  changed() {
    store.setPlaced(this.placed);
    this.refresh();
  }

  refresh() {
    const { units, ghostId } = this.shownUnits();
    this.units = units;
    this.round = runRound(PLAYGROUND, units);
    this.desc = describeRound(PLAYGROUND, units, this.round);
    const hovered = units.find((u) => u.id === (ghostId ?? this.hoverId));
    this.view.render({
      units,
      round: this.round,
      turn: this.viewTurn,
      ghostId,
      highlight: new Set(MOBILE && this.hoverId ? [this.hoverId] : this.lineHighlight),
      area: hovered ? unitArea(PLAYGROUND, hovered) : [],
    });
    this.readout.render(this.desc);
    this.timeline.render(this.timelineRows(), this.round.turns.length, this.viewTurn, 'Every machine on the Playground gets a row.');
    this.turnLabel.setText(MOBILE ? `Turn ${this.viewTurn}/${this.round.turns.length}` : `ROUND · turn ${this.viewTurn} of ${this.round.turns.length}`);
    this.palette.setItems(
      store.machines().map((m) => {
        const n = this.placed.filter((p) => p.machineId === m.id).length;
        return { key: m.id, label: m.name, sub: n ? `×${n}` : '', parts: m.parts };
      })
    );
    this.palette.render({ selected: this.armed, hover: this.hoverMachine });
    this.renderInspect();
    if (MOBILE) {
      const on = this.tabs.shown('inspect') && this.placed.some((p) => p.id === this.hoverId);
      for (const b of [this.turnButton, this.removeButton]) {
        b.setVisible(on);
        b.panel.setVisible(on);
      }
    }
  }

  timelineRows() {
    return this.units.map((unit) => {
      const sim = unitView(this.round, unit.id);
      const effectors = unit.machine.parts.filter((p) => MODULES[p.type].effect);
      const watched = effectors.length ? effectors : unit.machine.parts;
      const first = effectors[0] && MODULES[effectors[0].type].effect.kind;
      return {
        label: unitLabel(unit),
        labelColor: COLORS.text,
        onColor: first ? EFFECT_STYLE[first] : ROLE_STYLE.source.color,
        cells: sim.turns.map((r) => ({
          state: r.present.length === 0 && unit.machine.parts.length ? 'gone' : watched.some((p) => r.active[p.id]) ? 'on' : 'off',
          mark: r.events.some((e) => e.type === 'burn') ? 'burn' : r.events.some((e) => e.type === 'empty') ? 'empty' : null,
        })),
      };
    });
  }

  place(machineId, x, y, rot = 0) {
    this.placed.push({ id: store.newPlacedId(), machineId, x, y, rot });
  }

  remove(id) {
    this.placed = this.placed.filter((p) => p.id !== id);
    if (this.hoverId === id) this.hoverId = null;
  }

  rotate(id) {
    const p = this.placed.find((q) => q.id === id);
    if (p) p.rot = (p.rot + 1) % 4;
  }

  clear() {
    this.stop();
    this.placed = [];
    this.viewTurn = 1;
    this.changed();
  }

  setTurn(turn) {
    this.viewTurn = Phaser.Math.Clamp(turn, 1, this.round.turns.length);
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
        if (this.viewTurn >= this.round.turns.length) {
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
    this.playButton?.setLabel('▶ Run round');
  }

  // --- Input -----------------------------------------------------------------

  placedAt(px, py) {
    const tile = this.view.tileAt(px, py);
    if (!tile) return null;
    return this.placed.find((p) => p.x === tile[0] && p.y === tile[1]) ?? null;
  }

  onDown(pointer, over) {
    if (over.some((o) => o.isButton)) return;
    if (pointer.rightButtonDown()) {
      const p = this.placedAt(pointer.worldX, pointer.worldY);
      if (p) {
        this.rotate(p.id);
        this.changed();
      }
      return;
    }
    const item = this.palette.itemAt(pointer.worldX, pointer.worldY);
    if (item) {
      this.drag = { kind: 'new', machineId: item.key, rot: 0, moved: false, target: null };
      return;
    }
    const p = this.placedAt(pointer.worldX, pointer.worldY);
    if (p) {
      this.drag = { kind: 'move', id: p.id, machineId: p.machineId, rot: p.rot, moved: false, target: null };
      return;
    }
    const tile = this.view.tileAt(pointer.worldX, pointer.worldY);
    if (tile && this.armed) {
      this.place(this.armed, tile[0], tile[1]);
      this.changed();
      return;
    }
    const turn = this.timeline.turnAt(pointer.worldX, pointer.worldY, this.round.turns.length);
    if (turn) {
      this.stop();
      this.setTurn(turn);
    }
  }

  onMove(pointer) {
    const d = this.drag;
    if (d) {
      if (!d.moved && isDrag(pointer)) {
        d.moved = true;
        this.armed = null;
      }
      if (d.moved) {
        const tile = this.view.tileAt(pointer.worldX, pointer.worldY);
        const ok = tile && canPlace(PLAYGROUND, this.placed, tile[0], tile[1], d.kind === 'move' ? d.id : null);
        const target = ok ? tile : null;
        const changed = String(target) !== String(d.target);
        d.target = target;
        this.drawDragged(pointer);
        if (changed) this.refresh();
        return;
      }
    }
    // A finger doesn't hover: on a phone the inspector follows taps instead.
    if (!MOBILE) this.updateHover(pointer);
  }

  onUp(pointer, over = []) {
    const d = this.drag;
    this.drag = null;
    this.dragGfx.clear();
    this.dragLabel.setText('');
    if (!d) {
      if (MOBILE && !over.some((o) => o.isButton)) this.focus(pointer);
      return;
    }
    if (!d.moved) {
      // On a phone the first tap on a placed machine picks it out; tapping
      // it again turns it.
      if (d.kind === 'new') {
        this.armed = this.armed === d.machineId ? null : d.machineId;
        if (MOBILE) this.focus(pointer);
        else this.refresh();
      } else if (MOBILE && this.hoverId !== d.id) {
        this.focus(pointer);
      } else {
        this.rotate(d.id);
        this.changed();
      }
      return;
    }
    const tile = this.view.tileAt(pointer.worldX, pointer.worldY);
    if (d.kind === 'new') {
      if (d.target) this.place(d.machineId, d.target[0], d.target[1], d.rot);
    } else if (d.target) {
      const p = this.placed.find((q) => q.id === d.id);
      [p.x, p.y] = d.target;
      p.rot = d.rot;
    } else if (!tile) {
      this.remove(d.id);
    }
    this.updateHover(pointer, false);
    this.changed();
  }

  onKey(event) {
    const key = event.key;
    if (key === 'r' || key === 'R') {
      if (this.drag) {
        this.drag.rot = (this.drag.rot + 1) % 4;
        this.drawDragged(this.input.activePointer);
        this.refresh();
      } else if (this.hoverId) {
        this.rotate(this.hoverId);
        this.changed();
      }
    } else if ((key === 'Delete' || key === 'Backspace') && this.hoverId && !this.drag) {
      this.remove(this.hoverId);
      this.changed();
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

  // Mobile: a tap on the world or the machine list picks out what it landed on
  // and shows it in Inspect. A tap anywhere else leaves it be.
  focus(pointer) {
    const [px, py] = [pointer.worldX, pointer.worldY];
    if (!this.palette.itemAt(px, py) && !this.view.tileAt(px, py)) return;
    this.updateHover(pointer, false);
    this.tabs.set('inspect');
    this.refresh();
  }

  actOnFocus(action) {
    if (!this.placed.some((p) => p.id === this.hoverId)) return;
    if (action === 'turn') this.rotate(this.hoverId);
    else this.remove(this.hoverId);
    this.changed();
  }

  updateHover(pointer, redraw = true) {
    const item = this.palette.itemAt(pointer.worldX, pointer.worldY);
    const p = this.placedAt(pointer.worldX, pointer.worldY);
    const tile = this.view.tileAt(pointer.worldX, pointer.worldY);
    const next = { machine: item?.key ?? null, id: p?.id ?? null, tile: !p && tile ? tileKey(...tile) : null };
    const prev = { machine: this.hoverMachine, id: this.hoverId, tile: this.hoverTile };
    this.hoverMachine = next.machine;
    this.hoverId = next.id;
    this.hoverTile = next.tile;
    if (redraw && JSON.stringify(next) !== JSON.stringify(prev)) this.refresh();
  }

  // --- Drawing ---------------------------------------------------------------

  drawDragged(pointer) {
    const d = this.drag;
    this.dragGfx.clear();
    this.dragLabel.setText('');
    if (d.target) return; // shown as a ghost on the Playground instead
    const m = store.machine(d.machineId);
    const off = !this.view.tileAt(pointer.worldX, pointer.worldY);
    drawMachine(this.dragGfx, m.parts, d.rot, pointer.worldX, pointer.worldY, 56, { alpha: 0.85 });
    if (d.kind === 'move' && off) {
      this.dragGfx.lineStyle(3, COLORS.badHex, 1);
      this.dragGfx.strokeRoundedRect(pointer.worldX - 32, pointer.worldY - 32, 64, 64, 10);
      this.dragLabel.setText('drop to remove').setPosition(pointer.worldX, pointer.worldY + 44).setColor(COLORS.bad);
    } else {
      this.dragLabel.setText(m.name).setPosition(pointer.worldX, pointer.worldY + 44).setColor(COLORS.text);
    }
  }

  drawLegend() {
    const y = L.legend.y;
    const g = this.add.graphics().setDepth(1);
    let x = MOBILE ? 16 : PLAY_LAYOUT.world.x - 20;
    const style = { fontFamily: FONT, fontSize: `${FONT_SM}px`, color: COLORS.muted, resolution: TEXT_RESOLUTION };
    for (const [kind, word] of Object.entries(EFFECT_WORDS)) {
      g.fillStyle(EFFECT_STYLE[kind], kind === 'steam' ? 0.6 : 0.85);
      g.fillRect(x, y - 7, 14, 14);
      const t = this.add.text(x + 20, y, word, style).setOrigin(0, 0.5);
      x += t.width + (MOBILE ? 32 : 36);
    }
    this.add.text(x, y, MOBILE ? 'Lit: running' : 'Lit squares: modules running', style).setOrigin(0, 0.5);
  }

  // |◀ ▶ Run round ▶|, ending at `right`, and the turn label (placed by the
  // caller). Returns the buttons.
  drawRunControls(right, y) {
    this.turnLabel = this.add
      .text(0, y, '', {
        fontFamily: FONT,
        fontSize: `${FONT_SM}px`,
        fontStyle: 'bold',
        color: COLORS.text,
        resolution: TEXT_RESOLUTION,
      })
      .setOrigin(0, 0.5);
    const pad = MOBILE ? 7 : 5;
    const next = createButton(this, right - 22, y, '▶|', () => {
      this.stop();
      this.setTurn(this.viewTurn + 1);
    }, { fontSize: FONT_SM, padX: 10, padY: pad });
    this.playButton = createButton(this, next.x - 92, y, '▶ Run round', () => this.play(), {
      fontSize: FONT_SM,
      padX: 10,
      padY: pad,
      width: 120,
    });
    const prev = createButton(this, this.playButton.x - 92, y, '|◀', () => {
      this.stop();
      this.setTurn(this.viewTurn - 1);
    }, { fontSize: FONT_SM, padX: 10, padY: pad });
    return [prev, this.playButton, next];
  }

  // --- Inspector -------------------------------------------------------------

  renderInspect() {
    const unit = this.units.find((u) => u.id === this.hoverId);
    if (unit) return this.readout.inspect(this.unitInfo(unit));
    const machineId = this.hoverMachine ?? this.armed;
    if (machineId) return this.readout.inspect(this.machineInfo(store.machine(machineId)));
    if (this.hoverTile) return this.readout.inspect(this.tileInfo(this.hoverTile));
    return this.readout.inspect({ title: 'How to play a round', lines: (MOBILE ? HELP_TOUCH : HELP).map((text) => ({ text, color: COLORS.muted })) });
  }

  unitInfo(unit) {
    const sim = unitView(this.round, unit.id);
    const record = sim.turns[this.viewTurn - 1];
    const name = (p) => MODULES[p.type].name;
    const lines = [];
    for (const p of unit.machine.parts) {
      const def = MODULES[p.type];
      if (def.role !== 'effector' && def.role !== 'source' && sim.burntAfter[p.id] === undefined) continue;
      if (!record.present.includes(p.id)) {
        lines.push({ text: `${name(p)}: burnt down after turn ${sim.burntAfter[p.id]}.`, color: COLORS.bad });
      } else if (record.active[p.id]) {
        const charge = def.role === 'source' ? `, ${record.charge[p.id]} of ${def.charge} turns of charge left` : '';
        lines.push({ text: `${name(p)}: running${charge}.`, color: COLORS.good });
      } else {
        lines.push({ text: `${name(p)}: idle, because ${whyIdle(unit.machine.parts, sim, p.id, this.viewTurn, name)}.`, color: COLORS.bad });
      }
    }
    const ground = terrainAt(PLAYGROUND, unit.x, unit.y);
    lines.push({ text: `Stands on ${ground ? ground.name.toLowerCase() : 'bare ground'}. ${CLICK} to turn it.`, color: COLORS.muted });
    return {
      title: unitLabel(unit),
      subtitle: `Turn ${this.viewTurn} · facing ${SIDE_WORDS[['N', 'E', 'S', 'W'][unit.rot]]} · ${unit.machine.parts.length} modules`,
      lines,
    };
  }

  machineInfo(m) {
    const test = testMachine(m.parts, m.ground);
    const desc = describe(m.parts, test.sim);
    const lines = desc.result.map((l) => ({ text: l.text, color: l.good ? COLORS.text : COLORS.muted }));
    for (const l of desc.problems) lines.push({ text: l.text, color: COLORS.bad });
    const on = m.ground ? TERRAIN[m.ground].name.toLowerCase() : 'bare ground';
    return { title: m.name, subtitle: `Saved machine · as tested on ${on}`, lines };
  }

  tileInfo(key) {
    const [x, y] = key.split(',').map(Number);
    const terrain = terrainAt(PLAYGROUND, x, y);
    const lines = [];
    if (terrain) {
      lines.push({
        text: `${terrain.name}: an open ${FLOW_NAMES[terrain.provides]} input in a machine standing here draws from it, and it never runs out.${terrain.hot ? ' Always hot.' : ''}`,
      });
    } else lines.push({ text: 'Bare ground. Nothing to draw from.', color: COLORS.muted });
    const tile = this.round.turns[this.viewTurn - 1].tiles[key];
    const name = causeNamer(this.units);
    const from = (causes) => [...new Set(causes.map((c) => name(c, null)))].join(', ');
    if (tile) {
      if (tile.steam) lines.push({ text: `Steaming: water from ${from(tile.wet)} cools the heat from ${from(tile.hot)}.` });
      else {
        if (tile.wet.length) lines.push({ text: `Wet, from ${from(tile.wet)}.`, color: FLOW_STYLE.matter.css });
        if (tile.isHot) lines.push({ text: `Hot, from ${from(tile.hot)}.`, color: FLOW_STYLE.heat.css });
      }
      if (tile.air.length) lines.push({ text: `Air blown by ${from(tile.air)}.` });
      if (tile.alert.length) lines.push({ text: `Alerted by ${from(tile.alert)}.`, color: FLOW_STYLE.signal.css });
    }
    if (this.armed) lines.push({ text: `${CLICK} to place ${store.machine(this.armed).name} here.`, color: COLORS.good });
    return { title: `Tile ${tileName(x, y)}`, subtitle: `Turn ${this.viewTurn}`, lines };
  }

  // Read by the tests.
  testState() {
    const record = this.round.turns[this.viewTurn - 1];
    return {
      screen: 'playground',
      placed: this.placed.map((p) => ({ ...p })),
      turn: this.viewTurn,
      armed: this.armed,
      playing: !!this.playTimer,
      desc: JSON.parse(JSON.stringify(this.desc)),
      machines: store.machines().map((m) => ({ id: m.id, name: m.name })),
      burnt: Object.fromEntries(this.units.map((u) => [u.id, Object.keys(this.round.units[u.id].burntAfter)])),
      running: Object.fromEntries(this.units.map((u) => [u.id, Object.keys(record.units[u.id].active)])),
      tiles: JSON.parse(JSON.stringify(record.tiles)),
    };
  }
}
