// The Playground: saved machines placed on a world, one per tile, each made
// to work when the player decides. Machines don't connect to each other; they
// meet through the tiles — one machine's sprinkler wets its neighbour's tile,
// which keeps it cool and gives it water to draw; a torch heats the next tile
// over; embers heat whatever works on them. The run is the list of machines
// made to work so far, in order, and replays from the start whenever the
// layout changes, so what the screen shows is always the real outcome — and a
// machine being dragged is shown as if dropped where it hovers.

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
  TEXT_RESOLUTION,
} from '../config.js';
import { CONDITIONS, PLAYGROUND, TERRAIN } from '../data/world.js';
import { MODULES } from '../data/modules.js';
import {
  FLOW_NAMES,
  SIDE_WORDS,
  allTiles,
  canPlace,
  causeNamer,
  describe,
  describePlayground,
  preview,
  runActions,
  testMachine,
  tileKey,
  tileName,
  tileState,
  unitArea,
  unitLabel,
  whyIdle,
} from '../core/machine.js';
import * as store from '../store.js';
import { createButton, isDrag } from '../ui/button.js';
import { ListView } from '../ui/ListView.js';
import { PanelTabs } from '../ui/panelTabs.js';
import { drawMachine } from '../ui/machineArt.js';
import { Readout } from '../ui/Readout.js';
import { drawHeader } from '../ui/tabs.js';
import { WorldView } from '../ui/WorldView.js';

const HELP = [
  'Drag a saved machine from the left onto a tile, or click it and then click a tile.',
  'Click a placed machine to make it work once. Nothing works until you say so.',
  'R turns whatever is under the pointer (or the one you are dragging); right-click turns too.',
  'Drag a machine to move it; drag it off the Playground (or press Delete) to remove it.',
  'What a machine leaves on a tile stays there: water, sand, fumes, wind or heat. A machine standing on it can draw that element.',
  'Undo takes back the last action; Reset starts the run again with clean tiles.',
];
// Mouse or finger, in the words the screen uses.
const CLICK = MOBILE ? 'Tap' : 'Click';
const HELP_TOUCH = [
  'Drag a saved machine from the list onto a tile, or tap it and then tap tiles.',
  'Tap a placed machine to inspect it; tap it again (or Work) to make it work once.',
  'Drag a machine to move it, or off the Playground to remove it. Turn and Remove are in Inspect.',
  'What a machine leaves on a tile stays there. A machine standing on it can draw that element.',
  'Undo and Reset are under Run.',
];
// Where things sit: the stacked mobile layout or the desktop one.
const L = MOBILE ? MOBILE_PLAY_LAYOUT : PLAY_LAYOUT;
const LEGEND = ['wet', 'sand', 'fumes', 'wind', 'hot', 'steam'];
const READOUT_TITLES = ['What each machine does', 'Problems', 'Notes'];

export class PlaygroundScene extends Phaser.Scene {
  constructor() {
    super('PlaygroundScene');
  }

  create() {
    this.placed = store.copy(store.placed());
    this.actions = [...store.actions()];
    this.drag = null;
    this.armed = null;
    this.hoverId = null;
    this.hoverTile = null;
    this.hoverMachine = null;
    this.lineHighlight = [];

    this.input.mouse?.disableContextMenu();
    drawHeader(this, 'PlaygroundScene');

    this.palette = new ListView(this, {
      ...L.machines,
      heading: 'SAVED MACHINES',
      empty: `No saved machines. Build one on the Workbench and ${MOBILE ? 'tap' : 'press'} Save.`,
      icon: (g, item, cx, cy, size) => drawMachine(g, item.parts, 0, cx, cy, size),
      onPage: () => this.refresh(),
    });
    this.view = new WorldView(this, PLAYGROUND, { ...L.world, coords: true, names: true });
    this.flashGfx = this.add.graphics().setDepth(8);
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

  // Desktop: the run under the world, the readout down the right.
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
      READOUT_TITLES
    );
    const { x, y, w } = PLAY_LAYOUT.run;
    this.drawRunControls(x, x + w, y + 14, w);
  }

  // Mobile: the readout, the inspector and the run (its log, Undo, Reset and
  // Clear) under three tabs at the bottom.
  drawMobilePanel() {
    const P = MOBILE_PLAY_LAYOUT.panel;
    this.tabs = new PanelTabs(this, {
      y: MOBILE_PLAY_LAYOUT.tabs.y,
      panel: P,
      tabs: [
        { key: 'readout', label: 'Readout' },
        { key: 'inspect', label: 'Inspect' },
        { key: 'run', label: 'Run' },
      ],
      onChange: () => this.refresh(),
    });
    this.readout = new Readout(this, { ...P, stacked: false }, () => {}, READOUT_TITLES);

    const right = P.x + P.w - 12;
    const clear = createButton(this, 0, P.y + 22, 'Clear', () => this.clear(), { fontSize: FONT_SM, padX: 10, padY: 7 });
    clear.moveX(right - clear.width / 2);
    const run = this.drawRunControls(P.x + 12, clear.x - clear.width / 2 - 8, P.y + 22, P.w - 24);

    const small = { fontSize: FONT_SM, padX: 10, padY: 6 };
    this.focusButtons = [
      createButton(this, 0, P.y + 24, '▶ Work', () => this.actOnFocus('work'), small),
      createButton(this, 0, P.y + 24, '⟳ Turn', () => this.actOnFocus('turn'), small),
      createButton(this, 0, P.y + 24, '✕ Remove', () => this.actOnFocus('remove'), small),
    ];
    let edge = right;
    for (const b of [...this.focusButtons].reverse()) {
      b.moveX(edge - b.width / 2);
      edge -= b.width + 6;
    }

    this.tabs.add('readout', this.readout.summary);
    this.tabs.add('inspect', this.readout.inspector);
    this.tabs.add('run', clear, ...run);
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
    this.actions = [...store.actions()];
    this.refresh();
  }

  refresh() {
    const { units, ghostId } = this.shownUnits();
    this.units = units;
    this.run = runActions(PLAYGROUND, units, this.actions);
    this.previews = Object.fromEntries(units.map((u) => [u.id, preview(this.run, u.id)]));
    this.desc = describePlayground(PLAYGROUND, units, this.run, this.previews);
    const hovered = units.find((u) => u.id === (ghostId ?? this.hoverId));
    this.view.render({
      units,
      tiles: allTiles(PLAYGROUND, this.run.state.landed),
      records: this.previews,
      ghostId,
      highlight: new Set(MOBILE && this.hoverId ? [this.hoverId] : this.lineHighlight),
      area: hovered ? unitArea(PLAYGROUND, hovered) : [],
    });
    this.readout.render(this.desc);
    this.renderRun();
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
      for (const b of this.focusButtons) {
        b.setVisible(on);
        b.panel.setVisible(on);
      }
    }
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
    this.placed = [];
    this.changed();
  }

  // --- The run ---------------------------------------------------------------

  // Makes a placed machine work once: it is added to the end of the run.
  work(id) {
    if (!this.placed.some((p) => p.id === id)) return;
    this.actions.push(id);
    store.setActions(this.actions);
    this.refresh();
    this.flash(id);
  }

  undo() {
    if (this.actions.length === 0) return;
    this.actions.pop();
    store.setActions(this.actions);
    this.refresh();
  }

  reset() {
    this.actions = [];
    store.setActions(this.actions);
    this.refresh();
  }

  // A ring that fades round a machine that has just worked.
  flash(id) {
    const unit = this.units.find((u) => u.id === id);
    if (!unit) return;
    const t = this.view.tile;
    const c = this.view.center(unit.x, unit.y);
    this.flashTween?.remove();
    this.flashGfx.clear().setAlpha(1);
    this.flashGfx.lineStyle(4, COLORS.goodHex, 1);
    this.flashGfx.strokeRoundedRect(c.x - t / 2 - 2, c.y - t / 2 - 2, t + 4, t + 4, 12);
    this.flashTween = this.tweens.add({ targets: this.flashGfx, alpha: 0, duration: 700, ease: 'Quad.easeIn' });
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
      // A click on a placed machine makes it work. On a phone the first tap
      // picks it out and the next one makes it work.
      if (d.kind === 'new') {
        this.armed = this.armed === d.machineId ? null : d.machineId;
        if (MOBILE) this.focus(pointer);
        else this.refresh();
      } else if (MOBILE && this.hoverId !== d.id) {
        this.focus(pointer);
      } else {
        this.work(d.id);
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
    } else if ((key === ' ' || key === 'Enter') && this.hoverId && !this.drag) {
      this.work(this.hoverId);
    } else if (key === 'z' || key === 'Z' || key === 'u' || key === 'U') {
      this.undo();
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
    if (action === 'work') return this.work(this.hoverId);
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
    for (const kind of LEGEND) {
      g.fillStyle(EFFECT_STYLE[kind], kind === 'steam' ? 0.6 : 0.85);
      g.fillRect(x, y - 7, 14, 14);
      const word = kind === 'steam' ? 'Steam' : CONDITIONS[kind].name;
      const t = this.add.text(x + 19, y, word, style).setOrigin(0, 0.5);
      x += t.width + (MOBILE ? 29 : 34);
    }
    if (!MOBILE) this.add.text(x, y, 'Lit: ready to work', style).setOrigin(0, 0.5);
  }

  // RUN · how many actions, Undo and Reset ending at `right`, and the log of
  // what has worked under them, from `left`. Returns everything drawn.
  drawRunControls(left, right, y, w) {
    const style = { fontFamily: FONT, fontSize: `${FONT_SM}px`, color: COLORS.text, resolution: TEXT_RESOLUTION };
    this.runLabel = this.add.text(left, y, '', { ...style, fontStyle: 'bold' }).setOrigin(0, 0.5);
    const pad = MOBILE ? 7 : 5;
    const reset = createButton(this, 0, y, 'Reset', () => this.reset(), { fontSize: FONT_SM, padX: 10, padY: pad });
    reset.moveX(right - reset.width / 2);
    const undo = createButton(this, 0, y, '↶ Undo', () => this.undo(), { fontSize: FONT_SM, padX: 10, padY: pad });
    undo.moveX(reset.x - reset.width / 2 - 8 - undo.width / 2);
    this.runLog = this.add
      .text(left, y + 24, '', { ...style, color: COLORS.muted, wordWrap: { width: w }, lineSpacing: 4 })
      .setOrigin(0, 0);
    return [this.runLabel, undo, reset, this.runLog];
  }

  renderRun() {
    const n = this.run.steps.length;
    this.runLabel.setText(MOBILE ? `Run · ${n} action${n === 1 ? '' : 's'}` : `RUN · ${n} action${n === 1 ? '' : 's'} so far`);
    if (n === 0) {
      this.runLog.setText(`Nothing has worked yet. ${CLICK} a machine on the Playground to make it work once; what it leaves on the tiles stays there for the next.`);
      return;
    }
    const shown = MOBILE ? 8 : 12;
    const lines = this.run.steps.slice(-shown).map((s) => {
      const unit = this.run.byId.get(s.unit);
      const burnt = s.burns.length ? ` · burnt ${s.burns.map((b) => MODULES[this.run.byId.get(b.unit).machine.parts.find((p) => p.id === b.id).type].name).join(', ')}` : '';
      return `${s.n}. ${unitLabel(unit)}${burnt}`;
    });
    if (n > shown) lines.unshift(`… ${n - shown} earlier`);
    this.runLog.setText(lines.join(MOBILE ? '\n' : '   '));
  }

  // --- Inspector -------------------------------------------------------------

  renderInspect() {
    const unit = this.units.find((u) => u.id === this.hoverId);
    if (unit) return this.readout.inspect(this.unitInfo(unit));
    const machineId = this.hoverMachine ?? this.armed;
    if (machineId) return this.readout.inspect(this.machineInfo(store.machine(machineId)));
    if (this.hoverTile) return this.readout.inspect(this.tileInfo(this.hoverTile));
    return this.readout.inspect({ title: 'How to play', lines: (MOBILE ? HELP_TOUCH : HELP).map((text) => ({ text, color: COLORS.muted })) });
  }

  unitInfo(unit) {
    const step = this.previews[unit.id];
    const name = (p) => MODULES[p.type].name;
    const lines = [];
    for (const p of unit.machine.parts) {
      const def = MODULES[p.type];
      const burnt = !step.present.includes(p.id);
      if (def.role !== 'effector' && !burnt) continue;
      if (burnt) {
        lines.push({ text: `${name(p)}: burnt down in action ${this.run.state.burnt[unit.id][p.id]}.`, color: COLORS.bad });
      } else if (step.active[p.id]) {
        lines.push({ text: `${name(p)}: ready to work.`, color: COLORS.good });
      } else {
        lines.push({ text: `${name(p)}: can't work, because ${whyIdle(unit.machine.parts, step, p.id, name)}.`, color: COLORS.bad });
      }
    }
    for (const b of step.burns) {
      const part = this.run.byId.get(b.unit).machine.parts.find((p) => p.id === b.id);
      const where = b.unit === unit.id ? '' : ` in ${unitLabel(this.run.byId.get(b.unit))}`;
      lines.push({ text: `Working it now burns down the ${name(part)}${where}.`, color: COLORS.warn });
    }
    const ground = tileState(PLAYGROUND, this.run.state.landed, unit.x, unit.y).terrain;
    const how = MOBILE ? (this.hoverId === unit.id ? 'Tap it again to make it work.' : 'Tap to pick it out.') : 'Click to make it work, R to turn it.';
    lines.push({ text: `Stands on ${ground ? ground.name.toLowerCase() : 'bare ground'}. ${how}`, color: COLORS.muted });
    const worked = this.run.steps.filter((s) => s.unit === unit.id).length;
    return {
      title: unitLabel(unit),
      subtitle: `Facing ${SIDE_WORDS[['N', 'E', 'S', 'W'][unit.rot]]} · ${unit.machine.parts.length} modules · worked ${worked} time${worked === 1 ? '' : 's'}`,
      lines,
    };
  }

  machineInfo(m) {
    const test = testMachine(m.parts, m.ground);
    const desc = describe(m.parts, test.step);
    const lines = desc.result.map((l) => ({ text: l.text, color: l.good ? COLORS.text : COLORS.muted }));
    for (const l of desc.problems) lines.push({ text: l.text, color: COLORS.bad });
    const on = m.ground ? TERRAIN[m.ground].name.toLowerCase() : 'bare ground';
    return { title: m.name, subtitle: `Saved machine · as tested on ${on}`, lines };
  }

  tileInfo(key) {
    const [x, y] = key.split(',').map(Number);
    const tile = tileState(PLAYGROUND, this.run.state.landed, x, y);
    const lines = [];
    const name = causeNamer(this.units);
    const from = (causes) => [...new Set(causes.map((c) => name(c, null)))].join(', ');
    if (tile.terrain) {
      lines.push({
        text: `${tile.terrain.name}: gives ${FLOW_NAMES[tile.terrain.provides]} to an open input of a machine working here, and never runs out.${tile.terrain.hot ? ' Always hot.' : ''}`,
      });
    } else if (tile.blank) lines.push({ text: 'Bare ground. Nothing to draw from yet.', color: COLORS.muted });
    for (const kind of ['wet', 'sand', 'fumes', 'wind']) {
      const causes = tile[kind];
      if (causes.length === 0) continue;
      const c = CONDITIONS[kind];
      lines.push({ text: `${c.name}, from ${from(causes)}: gives ${FLOW_NAMES[c.gives]}.`, color: FLOW_STYLE[c.gives].css });
    }
    const heat = tile.hot.filter((c) => c.kind !== 'terrain');
    if (tile.steam) lines.push({ text: `Steaming: the water puts out the heat${heat.length ? ` from ${from(heat)}` : ''}.` });
    else if (tile.smothered) lines.push({ text: `The sand smothers the heat${heat.length ? ` from ${from(heat)}` : ''}.` });
    else if (heat.length) lines.push({ text: `Hot, from ${from(heat)}: gives Energy, and burns wood.`, color: FLOW_STYLE.energy.css });
    if (this.armed) lines.push({ text: `${CLICK} to place ${store.machine(this.armed).name} here.`, color: COLORS.good });
    return { title: `Tile ${tileName(x, y)}`, subtitle: `After ${this.run.steps.length} action${this.run.steps.length === 1 ? '' : 's'}`, lines };
  }

  // Read by the tests.
  testState() {
    return {
      screen: 'playground',
      placed: this.placed.map((p) => ({ ...p })),
      actions: [...this.actions],
      armed: this.armed,
      desc: JSON.parse(JSON.stringify(this.desc)),
      machines: store.machines().map((m) => ({ id: m.id, name: m.name })),
      burnt: Object.fromEntries(this.units.map((u) => [u.id, Object.keys(this.run.state.burnt[u.id])])),
      ready: Object.fromEntries(this.units.map((u) => [u.id, Object.keys(this.previews[u.id].active)])),
      tiles: JSON.parse(JSON.stringify(allTiles(PLAYGROUND, this.run.state.landed))),
    };
  }
}
