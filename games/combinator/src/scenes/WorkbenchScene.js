// The Workbench: where machines are built, named, saved and deleted. A palette
// of modules, the row a machine is built in, the ground it is tested
// standing on, the small world round it showing what it does there, a readout
// in sentences and a turn-by-turn timeline of its test run. Every edit re-runs
// the test at once, so what the screen shows is always what the machine will
// do — and while a module is being dragged, what it *would* do with it dropped.

import {
  COLORS,
  EFFECT_STYLE,
  FLOW_STYLE,
  FONT,
  FONT_MD,
  FONT_SM,
  GAME_WIDTH,
  LAYOUT,
  MATERIAL_STYLE,
  MOBILE,
  MOBILE_LAYOUT,
  PLAY_STEP_MS,
  ROLE_STYLE,
  TEXT_RESOLUTION,
} from '../config.js';
import { GROUNDS, TERRAIN, WORKBENCH } from '../data/world.js';
import { FLOWS, MODULES, PALETTE } from '../data/modules.js';
import {
  BENCH_UNIT,
  FLOW_NAMES,
  causeNamer,
  describe,
  labelFor,
  portsOf,
  testMachine,
  tileKey,
  tileName,
  unitArea,
  whyIdle,
} from '../core/machine.js';
import * as store from '../store.js';
import { BenchView } from '../ui/BenchView.js';
import { createButton, isDrag } from '../ui/button.js';
import { ListView } from '../ui/ListView.js';
import { PanelTabs } from '../ui/panelTabs.js';
import { drawMachine } from '../ui/machineArt.js';
import { drawModule, flowShape, roleKey } from '../ui/moduleArt.js';
import { Readout } from '../ui/Readout.js';
import { drawHeader } from '../ui/tabs.js';
import { Timeline } from '../ui/Timeline.js';
import { WorldView } from '../ui/WorldView.js';

const HELP = [
  'A machine is a row of modules. Drag one from the left into the row, between two pieces or at the end.',
  'Flow runs left to right. An input (hollow) takes the nearest flow of its kind from a piece to its left that nothing else has taken.',
  'Drag a piece along the row to move it; drag it out of the row (or press Delete) to remove it.',
  'An input with nothing to take draws from the ground; an output nobody takes spills onto the tile. Pick the ground under "Test on".',
  'Effectors act towards the front of the machine, which is north until it is turned on the Playground.',
  'Save the machine, then place it on the Playground.',
];
// The same, for a finger: a tap picks a thing out, and Inspect has buttons to
// move it along the row or remove it.
const HELP_TOUCH = [
  'A machine is a row of modules. Drag one from the shelf into the row, or tap it and then tap the row.',
  'Flow runs left to right. An input (hollow) takes the nearest flow of its kind from a piece to its left.',
  'Tap a piece to inspect it. Drag it along the row to move it, or out of the row to remove it.',
  'An input with nothing to take draws from the ground (pick it under Test run); an output nobody takes spills.',
  'Effectors act towards the front of the machine, which is north until it is turned on the Playground.',
];
// Mouse or finger, in the words the screen uses.
const CLICK = MOBILE ? 'Tap' : 'Click';
const NAME_MAX = 22;
// Where things sit: the stacked mobile layout or the desktop one.
const L = MOBILE ? MOBILE_LAYOUT : LAYOUT;
const CONFIRM_MS = 4000;

export class WorkbenchScene extends Phaser.Scene {
  constructor() {
    super('WorkbenchScene');
  }

  create() {
    const draft = store.draft();
    this.machineId = draft.machineId;
    this.name = draft.name;
    this.ground = draft.ground;
    this.placements = draft.parts;
    this.nextId = 1 + Math.max(0, ...this.placements.map((p) => Number(p.id.slice(1)) || 0));
    this.viewTurn = 1;
    this.drag = null;
    this.armed = null;
    this.hoverId = null;
    this.hoverTile = null;
    this.hoverType = null;
    this.hoverLib = null;
    this.hoverWorld = null;
    this.lineHighlight = [];
    this.playTimer = null;
    this.editing = null;
    this.pending = null;

    this.input.mouse?.disableContextMenu();
    drawHeader(this, 'WorkbenchScene', () => {
      this.finishEdit(true);
      this.stop();
    });
    this.drawActions();
    this.drawMachineBar();
    this.drawPalette();
    this.drawLegend();
    this.view = new BenchView(this, WORKBENCH);
    if (!MOBILE) {
      this.add
        .text(LAYOUT.bench.x - 6, LAYOUT.bench.top + 8, 'THE MACHINE · flow runs left to right ▸', {
          fontFamily: FONT,
          fontSize: `${FONT_SM}px`,
          fontStyle: 'bold',
          color: COLORS.muted,
          resolution: TEXT_RESOLUTION,
        })
        .setOrigin(0, 0.5);
    }
    if (MOBILE) this.drawMobilePanel();
    else this.drawDesktopPanel();
    this.library.reveal(this.machineId);
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

  // Desktop: the test world and the run under the Workbench, the saved
  // machines and the readout down the right.
  drawDesktopPanel() {
    this.preview = new WorldView(this, testMachine([], this.ground).world, { ...LAYOUT.preview, depth: 1 });
    this.add
      .text(LAYOUT.preview.x, LAYOUT.preview.y - 18, 'IN THE WORLD', {
        fontFamily: FONT,
        fontSize: `${FONT_SM}px`,
        fontStyle: 'bold',
        color: COLORS.text,
        resolution: TEXT_RESOLUTION,
      })
      .setOrigin(0, 0.5);
    this.library = new ListView(this, {
      ...LAYOUT.library,
      heading: 'SAVED MACHINES',
      empty: 'Nothing saved yet. Build a machine and press Save.',
      icon: (g, item, cx, cy, size) => drawMachine(g, item.parts, 0, cx, cy, size),
      onPage: () => this.refresh(),
    });
    this.readout = new Readout(this, LAYOUT.panel, (ids) => {
      this.lineHighlight = ids;
      this.refresh();
    });
    const { x, y, w } = LAYOUT.timeline;
    this.drawRunControls(x + w, y + 14);
    this.turnLabel.setX(x);
    this.timeline = new Timeline(this, LAYOUT.timeline);
  }

  // Mobile: everything but the Workbench and its shelf goes under four tabs at
  // the bottom. Test run holds the ground, the run controls, the test world
  // and the timeline together.
  drawMobilePanel() {
    const P = MOBILE_LAYOUT.panel;
    this.tabs = new PanelTabs(this, {
      y: MOBILE_LAYOUT.tabs.y,
      panel: P,
      tabs: [
        { key: 'readout', label: 'Readout' },
        { key: 'inspect', label: 'Inspect' },
        { key: 'test', label: 'Test run' },
        { key: 'saved', label: 'Saved' },
      ],
      onChange: () => this.refresh(),
    });
    this.readout = new Readout(this, { ...P, stacked: false }, () => {});

    const right = P.x + P.w - 12;
    const run = this.drawRunControls(right, P.y + 22);
    this.turnLabel.setX(P.x + 12);
    const ground = this.drawGroundButtons(P.x + 12, P.y + 58);
    const top = P.y + 80;
    const tile = Phaser.Math.Clamp(Math.floor((P.y + P.h - 10 - top) / 5), 14, 28);
    this.preview = new WorldView(this, testMachine([], this.ground).world, { x: P.x + 12, y: top, tile, depth: 1 });
    const tx = P.x + 12 + tile * 5 + 14;
    this.timeline = new Timeline(this, {
      x: tx,
      y: top,
      headerY: top + 8,
      w: right - tx,
      labelW: 96,
      rowH: 20,
      bottom: P.y + P.h - 4,
    });

    this.library = new ListView(this, {
      x: P.x + 12,
      y: P.y + 8,
      w: P.w - 24,
      rowH: 40,
      rows: Math.max(2, Math.floor((P.h - 44) / 46)),
      heading: 'SAVED MACHINES',
      empty: 'Nothing saved yet. Build a machine and tap Save.',
      icon: (g, item, cx, cy, size) => drawMachine(g, item.parts, 0, cx, cy, size),
      onPage: () => this.refresh(),
    });

    // Move and Remove for the piece picked out, beside its name in Inspect.
    const small = { fontSize: FONT_SM, padX: 10, padY: 6 };
    this.focusButtons = [
      createButton(this, 0, P.y + 24, '◀', () => this.actOnFocus('left'), small),
      createButton(this, 0, P.y + 24, '▶', () => this.actOnFocus('right'), small),
      createButton(this, 0, P.y + 24, '✕ Remove', () => this.actOnFocus('remove'), small),
    ];
    let edge = right;
    for (const b of [...this.focusButtons].reverse()) {
      b.moveX(edge - b.width / 2);
      edge -= b.width + 6;
    }

    this.tabs.add('readout', this.readout.summary);
    this.tabs.add('inspect', this.readout.inspector);
    this.tabs.add('test', ...run, this.turnLabel, ...ground, this.preview, this.timeline);
    this.tabs.add('saved', this.library);
  }

  update(time) {
    this.view.animate(time);
  }

  // --- State -----------------------------------------------------------------

  // The machine as it stands, or as it would stand with the dragged module
  // dropped into the row where the pointer is.
  shownPlacements() {
    const d = this.drag;
    if (!d || !d.moved || d.target === null) return { placements: this.placements, ghostId: null };
    const rest = this.placements.filter((p) => p.id !== d.id);
    const piece = d.kind === 'new' ? { id: 'ghost', type: d.type } : this.placements.find((p) => p.id === d.id);
    rest.splice(d.target, 0, piece);
    return { placements: rest, ghostId: piece.id };
  }

  // Where a piece dragged to px would land, or null if it would not: out of
  // the row, or a new one into a full row.
  dropTarget(pointer) {
    const d = this.drag;
    if (!this.view.inBand(pointer.worldX, pointer.worldY)) return null;
    if (d.kind === 'new' && this.placements.length >= WORKBENCH.slots) return null;
    const others = this.placements.filter((p) => p.id !== d.id).length;
    return this.view.insertIndex(pointer.worldX, others);
  }

  saved() {
    return this.machineId ? store.machine(this.machineId) : null;
  }

  isDirty() {
    const saved = this.saved();
    if (!saved) return this.placements.length > 0;
    const mine = { name: this.name, ground: this.ground, parts: this.placements };
    return JSON.stringify(mine) !== JSON.stringify({ name: saved.name, ground: saved.ground, parts: saved.parts });
  }

  // Every edit lands in the stored draft, so flipping screens or reloading the
  // page keeps unsaved work.
  changed() {
    store.setDraft({ machineId: this.machineId, name: this.name, ground: this.ground, parts: this.placements });
    this.refresh();
  }

  refresh() {
    const { placements, ghostId } = this.shownPlacements();
    this.test = testMachine(placements, this.ground);
    this.sim = this.test.sim;
    this.desc = describe(placements, this.sim);
    this.shown = placements;
    this.view.render({
      placements,
      sim: this.sim,
      turn: this.viewTurn,
      ground: this.ground,
      ghostId,
      highlight: new Set(MOBILE && this.hoverId ? [this.hoverId] : this.lineHighlight),
    });
    const hovered = this.shown.find((p) => p.id === (ghostId ?? this.hoverId));
    const area = hovered
      ? unitArea(this.test.world, this.test.unit, hovered.id)
      : this.hoverWorld
        ? unitArea(this.test.world, this.test.unit)
        : [];
    this.preview.setWorld(this.test.world);
    this.preview.render({ units: [this.test.unit], round: this.test.round, turn: this.viewTurn, area });
    this.readout.render(this.desc);
    this.timeline.render(this.timelineRows(), this.sim.turns.length, this.viewTurn, 'Sources and effectors show up here, one row each.');
    this.turnLabel.setText(MOBILE ? `Turn ${this.viewTurn} of ${this.sim.turns.length}` : `TEST RUN · turn ${this.viewTurn} of ${this.sim.turns.length}`);
    this.renderInspect();
    if (MOBILE) {
      const on = this.tabs.shown('inspect') && !!this.placements.find((p) => p.id === this.hoverId);
      for (const b of this.focusButtons) {
        b.setVisible(on);
        b.panel.setVisible(on);
      }
    }
    this.paintPalette();
    this.renderMachineBar();
    this.library.setItems(
      store.machines().map((m) => {
        const n = store.placedCount(m.id);
        return { key: m.id, label: m.name, sub: n ? `${n} placed` : '', parts: m.parts };
      })
    );
    this.library.render({ selected: this.machineId, hover: this.hoverLib });
  }

  timelineRows() {
    const burns = new Set(Object.keys(this.sim.burntAfter));
    const rank = (p) => ({ effector: 0, source: 1 })[MODULES[p.type].role] ?? 2;
    const pos = (p) => this.shown.indexOf(p);
    return this.shown
      .filter((p) => ['source', 'effector'].includes(MODULES[p.type].role) || burns.has(p.id))
      .sort((a, b) => rank(a) - rank(b) || pos(a) - pos(b))
      .map((p) => {
        const def = MODULES[p.type];
        const role = ROLE_STYLE[roleKey(def)];
        return {
          label: `#${pos(p) + 1} ${def.name}`,
          labelColor: role.css,
          onColor: def.effect ? EFFECT_STYLE[def.effect.kind] : role.color,
          cells: this.sim.turns.map((r) => ({
            state: !r.present.includes(p.id) ? 'gone' : r.active[p.id] ? 'on' : 'off',
            mark: r.events.find((e) => e.id === p.id)?.type ?? null,
          })),
        };
      });
  }

  // Puts a new piece into the row at `index` (the end if left out).
  place(type, index = this.placements.length) {
    if (this.placements.length >= WORKBENCH.slots) return null;
    const p = { id: `m${this.nextId++}`, type };
    this.placements.splice(index, 0, p);
    return p;
  }

  remove(id) {
    this.placements = this.placements.filter((p) => p.id !== id);
    if (this.hoverId === id) this.hoverId = null;
  }

  // Moves a piece to `index` in the row, counted without it.
  moveTo(id, index) {
    const p = this.placements.find((q) => q.id === id);
    if (!p) return;
    this.placements = this.placements.filter((q) => q !== p);
    this.placements.splice(Phaser.Math.Clamp(index, 0, this.placements.length), 0, p);
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

  // --- The machine: new, open, save, delete, name, ground ---------------------

  // Something that would lose work, or can't be undone, asks for the same
  // click twice; the status line says what the second click will do.
  confirm(key, message, fn) {
    if (this.pending?.key === key) {
      this.clearPending();
      fn();
      return;
    }
    this.pending = { key, message };
    this.pendingTimer?.remove();
    this.pendingTimer = this.time.delayedCall(CONFIRM_MS, () => {
      this.pending = null;
      this.refresh();
    });
    this.refresh();
  }

  clearPending() {
    this.pending = null;
    this.pendingTimer?.remove();
  }

  loadMachine(m) {
    this.stop();
    this.machineId = m?.id ?? null;
    this.name = m?.name ?? store.freshName();
    this.ground = m?.ground ?? null;
    this.placements = m ? store.copy(m.parts) : [];
    this.nextId = 1 + Math.max(0, ...this.placements.map((p) => Number(p.id.slice(1)) || 0));
    this.viewTurn = 1;
    this.hoverId = null;
    if (m) this.library.reveal(m.id);
    this.changed();
  }

  newMachine() {
    if (!this.isDirty()) return this.loadMachine(null);
    this.confirm('new', `Unsaved changes to ${this.name}. ${CLICK} New again to drop them.`, () => this.loadMachine(null));
  }

  openMachine(id) {
    const m = store.machine(id);
    if (!m || (id === this.machineId && !this.isDirty())) return;
    if (!this.isDirty()) return this.loadMachine(m);
    this.confirm(`open:${id}`, `Unsaved changes to ${this.name}. ${CLICK} ${m.name} again to drop them and open it.`, () => this.loadMachine(m));
  }

  save() {
    this.clearPending();
    this.machineId = store.saveMachine({ machineId: this.machineId, name: this.name, ground: this.ground, parts: this.placements });
    this.library.reveal(this.machineId);
    this.changed();
  }

  deleteMachine() {
    const saved = this.saved();
    if (!saved) {
      if (this.placements.length === 0) return;
      this.confirm('delete', `${CLICK} Delete again to throw this unsaved machine away.`, () => this.loadMachine(null));
      return;
    }
    const n = store.placedCount(saved.id);
    const also = n ? ` It comes off the Playground too (${n} placed).` : '';
    this.confirm('delete', `${CLICK} Delete again to delete ${saved.name}.${also}`, () => {
      store.deleteMachine(saved.id);
      this.loadMachine(store.machines()[0] ?? null);
    });
  }

  setGround(ground) {
    this.ground = ground;
    this.changed();
  }

  startEdit() {
    if (this.editing) return;
    this.stop();
    if (MOBILE) {
      // A phone has no keyboard to type into the canvas with: ask the browser,
      // which brings up the phone's own.
      const text = window.prompt('Name this machine', this.name)?.trim().slice(0, NAME_MAX);
      if (text) {
        this.name = text;
        this.changed();
      }
      return;
    }
    this.editing = { text: this.name };
    this.refresh();
  }

  finishEdit(keep) {
    if (!this.editing) return;
    const text = this.editing.text.trim();
    this.editing = null;
    if (keep && text) this.name = text;
    this.changed();
  }

  editKey(event) {
    const key = event.key;
    if (key === 'Enter') this.finishEdit(true);
    else if (key === 'Escape') this.finishEdit(false);
    else if (key === 'Backspace') this.editing.text = this.editing.text.slice(0, -1);
    else if (key.length === 1 && this.editing.text.length < NAME_MAX) this.editing.text += key;
    else return;
    if (this.editing) this.refresh();
  }

  // --- Input -----------------------------------------------------------------

  paletteAt(px, py) {
    return this.paletteItems.find((it) => px >= it.x && px <= it.x + it.w && py >= it.y && py <= it.y + it.h);
  }

  moduleAt(px, py) {
    const i = this.view.slotAt(px, py);
    return i === null ? null : (this.placements[i] ?? null);
  }

  onDown(pointer, over) {
    if (this.editing && !over.includes(this.nameText)) this.finishEdit(true);
    if (over.some((o) => o.isButton)) return;
    if (pointer.rightButtonDown()) return;
    const lib = this.library.itemAt(pointer.worldX, pointer.worldY);
    if (lib) {
      this.openMachine(lib.key);
      return;
    }
    const item = this.paletteAt(pointer.worldX, pointer.worldY);
    if (item) {
      this.drag = { kind: 'new', type: item.type, moved: false, target: null };
      return;
    }
    const p = this.moduleAt(pointer.worldX, pointer.worldY);
    if (p) {
      this.drag = { kind: 'move', id: p.id, type: p.type, moved: false, target: null };
      return;
    }
    if (this.armed && this.view.inBand(pointer.worldX, pointer.worldY)) {
      this.place(this.armed);
      this.changed();
      return;
    }
    const turn = this.timeline.turnAt(pointer.worldX, pointer.worldY, this.sim.turns.length);
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
        const target = this.dropTarget(pointer);
        const changed = target !== d.target;
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
      // A click, not a drag: on a palette module it picks the module up to
      // tap into the row; on a phone a tap on a piece picks it out.
      if (d.kind === 'new') {
        this.armed = this.armed === d.type ? null : d.type;
        if (MOBILE) this.focus(pointer);
        else this.refresh();
      } else if (MOBILE) this.focus(pointer);
      else this.refresh();
      return;
    }
    if (d.kind === 'new') {
      if (d.target !== null) this.place(d.type, d.target);
    } else if (d.target !== null) {
      this.moveTo(d.id, d.target);
    } else if (!this.view.inBand(pointer.worldX, pointer.worldY)) {
      this.remove(d.id);
    }
    this.updateHover(pointer, false);
    this.changed();
  }

  onKey(event) {
    if (this.editing) {
      this.editKey(event);
      return;
    }
    const key = event.key;
    if ((key === 'Delete' || key === 'Backspace') && this.hoverId && !this.drag) {
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

  // Mobile: a tap on the row, the shelf or the test world picks out what it
  // landed on and shows it in Inspect. A tap anywhere else leaves it be.
  focus(pointer) {
    const [px, py] = [pointer.worldX, pointer.worldY];
    const onBench = this.paletteAt(px, py) || this.view.slotAt(px, py) !== null;
    if (!onBench && !this.preview.tileAt(px, py)) return;
    this.updateHover(pointer, false);
    if (onBench) this.tabs.set('inspect');
    this.refresh();
  }

  actOnFocus(action) {
    const i = this.placements.findIndex((p) => p.id === this.hoverId);
    if (i < 0) return;
    if (action === 'left') this.moveTo(this.hoverId, i - 1);
    else if (action === 'right') this.moveTo(this.hoverId, i + 1);
    else this.remove(this.hoverId);
    this.changed();
  }

  updateHover(pointer, redraw = true) {
    const item = this.paletteAt(pointer.worldX, pointer.worldY);
    const p = this.moduleAt(pointer.worldX, pointer.worldY);
    const slot = this.view.slotAt(pointer.worldX, pointer.worldY);
    const lib = this.library.itemAt(pointer.worldX, pointer.worldY);
    const world = this.preview.tileAt(pointer.worldX, pointer.worldY);
    const next = {
      type: item?.type ?? null,
      id: p?.id ?? null,
      tile: !p && slot !== null ? slot : null,
      lib: lib?.key ?? null,
      world: world ? tileKey(...world) : null,
    };
    const prev = { type: this.hoverType, id: this.hoverId, tile: this.hoverTile, lib: this.hoverLib, world: this.hoverWorld };
    this.hoverType = next.type;
    this.hoverId = next.id;
    this.hoverTile = next.tile;
    this.hoverLib = next.lib;
    this.hoverWorld = next.world;
    if (redraw && JSON.stringify(next) !== JSON.stringify(prev)) this.refresh();
  }

  // --- Drawing ---------------------------------------------------------------

  drawDragged(pointer) {
    const d = this.drag;
    this.dragGfx.clear();
    this.dragLabel.setText('');
    if (d.target !== null) return; // shown as a ghost in the row instead
    const off = !this.view.inBand(pointer.worldX, pointer.worldY);
    drawModule(this.dragGfx, d.type, pointer.worldX, pointer.worldY, 66, { alpha: 0.85 });
    if (d.kind === 'move' && off) {
      this.dragGfx.lineStyle(3, COLORS.badHex, 1);
      this.dragGfx.strokeRoundedRect(pointer.worldX - 36, pointer.worldY - 36, 72, 72, 10);
      this.dragLabel.setText('drop to remove').setPosition(pointer.worldX, pointer.worldY + 50).setColor(COLORS.bad);
    } else if (d.kind === 'new' && !off) {
      this.dragLabel.setText(`the row is full (${WORKBENCH.slots})`).setPosition(pointer.worldX, pointer.worldY + 50).setColor(COLORS.bad);
    } else {
      this.dragLabel.setText(MODULES[d.type].name).setPosition(pointer.worldX, pointer.worldY + 50).setColor(COLORS.text);
    }
  }

  drawActions() {
    let x = GAME_WIDTH - 16;
    const width = MOBILE ? 62 : 76;
    for (const [text, fn] of [['Delete', () => this.deleteMachine()], ['Save', () => this.save()], ['New', () => this.newMachine()]]) {
      const b = createButton(this, 0, MOBILE ? MOBILE_LAYOUT.machineBar.y : 28, text, fn, { fontSize: FONT_SM, width, padY: MOBILE ? 7 : 8 });
      b.moveX(x - Math.max(width, b.width) / 2);
      x -= Math.max(width, b.width) + 8;
    }
    this.actionsLeft = x;
  }

  drawMachineBar() {
    const y = L.machineBar.y;
    const x = MOBILE ? 16 : LAYOUT.bench.x - 20;
    this.nameText = this.add
      .text(x, y, '', {
        fontFamily: FONT,
        fontSize: `${FONT_MD}px`,
        fontStyle: 'bold',
        color: COLORS.text,
        padding: { x: 6, y: 4 },
        resolution: TEXT_RESOLUTION,
      })
      .setOrigin(0, 0.5)
      .setDepth(3)
      .setInteractive({ cursor: 'text' });
    this.nameText.isButton = true;
    this.nameText.on('pointerup', () => this.startEdit());
    this.nameGfx = this.add.graphics().setDepth(2);
    this.statusText = this.add
      .text(x, y, '', { fontFamily: FONT, fontSize: `${MOBILE ? 13 : FONT_SM}px`, color: COLORS.muted, resolution: TEXT_RESOLUTION })
      .setOrigin(0, 0.5)
      .setDepth(3);
    if (MOBILE) {
      // The status gets a line of its own under the name, and the ground
      // buttons live in the Test run tab.
      this.statusText.setOrigin(0, 0).setPosition(x, MOBILE_LAYOUT.machineBar.status).setWordWrapWidth(GAME_WIDTH - 32);
      this.groundButtons = [];
      return;
    }

    const { x: bx, slot, gap } = LAYOUT.bench;
    let right = bx + WORKBENCH.slots * slot + (WORKBENCH.slots - 1) * gap;
    this.groundButtons = [];
    for (const ground of [...GROUNDS].reverse()) {
      const b = createButton(this, 0, y, ground ? TERRAIN[ground].name : 'Bare', () => this.setGround(ground), {
        fontSize: FONT_SM,
        padX: 10,
        padY: 4,
      });
      b.moveX(right - b.width / 2);
      right -= b.width + 6;
      this.groundButtons.push({ ground, button: b });
    }
    this.add
      .text(right - 4, y, 'Test on:', { fontFamily: FONT, fontSize: `${FONT_SM}px`, color: COLORS.muted, resolution: TEXT_RESOLUTION })
      .setOrigin(1, 0.5);
    this.barRight = right - 70;
  }

  // Mobile: "Test on:" and the four grounds, from (x, y). Returns them all.
  drawGroundButtons(x, y) {
    const label = this.add
      .text(x, y, 'Test on:', { fontFamily: FONT, fontSize: `${FONT_SM}px`, color: COLORS.muted, resolution: TEXT_RESOLUTION })
      .setOrigin(0, 0.5);
    let left = x + label.width + 8;
    this.groundButtons = [];
    for (const ground of GROUNDS) {
      const b = createButton(this, 0, y, ground ? TERRAIN[ground].name : 'Bare', () => this.setGround(ground), {
        fontSize: FONT_SM,
        padX: 10,
        padY: 6,
      });
      b.moveX(left + b.width / 2);
      left += b.width + 6;
      this.groundButtons.push({ ground, button: b });
    }
    return [label, ...this.groundButtons.map((g) => g.button)];
  }

  renderMachineBar() {
    const editing = !!this.editing;
    this.nameText.setText(editing ? `${this.editing.text}▏` : `${this.name}  ✎`);
    if (MOBILE) {
      // Long names shrink to stay clear of New, Save and Delete.
      const room = this.actionsLeft - 16 - 8;
      this.nameText.setScale(1);
      if (this.nameText.width > room) this.nameText.setScale(room / this.nameText.width, 1);
    }
    const b = this.nameText.getBounds();
    this.nameGfx.clear();
    this.nameGfx.lineStyle(editing ? 2 : 1, editing ? COLORS.highlightHex : COLORS.panelEdgeHex, 1);
    this.nameGfx.strokeRoundedRect(b.x, b.y, b.width, b.height, 6);

    let status;
    let color = COLORS.muted;
    if (editing) status = 'Type a name · Enter keeps it · Esc cancels';
    else if (this.pending) {
      status = this.pending.message;
      color = COLORS.bad;
    } else if (!this.saved()) status = this.placements.length ? 'Not saved yet' : 'New machine';
    else if (this.isDirty()) {
      status = 'Unsaved changes';
      color = COLORS.warn;
    } else status = 'Saved';
    this.statusText.setText(status).setColor(color);
    if (!MOBILE) this.statusText.setX(b.right + 12).setWordWrapWidth(Math.max(120, this.barRight - b.right - 12));
    for (const { ground, button } of this.groundButtons) {
      button.setBaseFill(ground === this.ground ? COLORS.selectedHex : COLORS.buttonHex);
    }
  }

  drawPalette() {
    if (MOBILE) return this.drawShelves();
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
        const item = { type, key: type, x: x + col * (colW + gap), y: top + row * (rowH + gap), w: colW, h: rowH };
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

  // Mobile: one shelf of the palette at a time, picked by a row of chips in
  // the shelf's colour, its modules in a grid under them.
  drawShelves() {
    const { x, y, w, chipH } = MOBILE_LAYOUT.palette;
    this.paletteGfx = this.add.graphics().setDepth(1);
    this.paletteTexts = [];
    this.shelfChips = [];
    let left = x;
    const gap = 5;
    const widths = PALETTE.map((shelf) => this.add.text(0, 0, shelf.heading, { fontFamily: FONT, fontSize: '13px' }));
    const spare = (w - widths.reduce((n, t) => n + t.width, 0) - gap * (PALETTE.length - 1)) / PALETTE.length;
    PALETTE.forEach((shelf, i) => {
      const cw = widths[i].width + spare;
      widths[i].destroy();
      const b = createButton(this, left + cw / 2, y + chipH / 2, shelf.heading, () => this.showShelf(i), {
        fontSize: 13,
        padX: 0,
        padY: 7,
        width: cw,
      });
      b.setColor(ROLE_STYLE[roleKey(MODULES[shelf.ids[0]])].css);
      this.shelfChips.push(b);
      left += cw + gap;
    });
    this.showShelf(0);
  }

  showShelf(index) {
    const { x, y, w, chipH, rowH, gap, cols } = MOBILE_LAYOUT.palette;
    this.shelf = index;
    this.shelfChips.forEach((b, i) => b.setBaseFill(i === index ? COLORS.selectedHex : COLORS.buttonHex));
    for (const t of this.paletteTexts) t.destroy();
    this.paletteTexts = [];
    const colW = (w - gap * (cols - 1)) / cols;
    const top = y + chipH + 8;
    this.paletteItems = PALETTE[index].ids.map((type, i) => ({
      type,
      key: type,
      x: x + (i % cols) * (colW + gap),
      y: top + Math.floor(i / cols) * (rowH + gap),
      w: colW,
      h: rowH,
    }));
    for (const item of this.paletteItems) {
      this.paletteTexts.push(
        this.add
          .text(item.x + 36, item.y + rowH / 2, MODULES[item.type].name, {
            fontFamily: FONT,
            fontSize: '12px',
            color: COLORS.text,
            wordWrap: { width: colW - 40 },
            resolution: TEXT_RESOLUTION,
          })
          .setOrigin(0, 0.5)
          .setDepth(3)
      );
    }
    if (this.sim) this.paintPalette();
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
      if (MOBILE) drawModule(g, item.type, item.x + 17, item.y + item.h / 2, 24);
      else drawModule(g, item.type, item.x + 20, item.y + item.h / 2, 26);
    }
  }

  drawLegend() {
    const y = L.legend.y;
    const g = this.add.graphics().setDepth(1);
    let x = MOBILE ? 16 : LAYOUT.bench.x - 6;
    const style = { fontFamily: FONT, fontSize: `${FONT_SM}px`, color: COLORS.muted, resolution: TEXT_RESOLUTION };
    for (const flow of FLOWS) {
      flowShape(g, flow, x + 8, y, 7, true);
      const t = this.add
        .text(x + 20, y, FLOW_NAMES[flow], { ...style, color: FLOW_STYLE[flow].css })
        .setOrigin(0, 0.5);
      x += t.width + (MOBILE ? 26 : 32);
    }
    this.add.text(x, y, MOBILE ? 'solid out · hollow in' : 'solid = output · hollow = input', style).setOrigin(0, 0.5);
  }

  // |◀ ▶ Run test ▶|, ending at `right`, and the turn label (placed by the
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
    this.playButton = createButton(this, next.x - 86, y, '▶ Run test', () => this.play(), {
      fontSize: FONT_SM,
      padX: 10,
      padY: pad,
      width: 112,
    });
    const prev = createButton(this, this.playButton.x - 86, y, '|◀', () => {
      this.stop();
      this.setTurn(this.viewTurn - 1);
    }, { fontSize: FONT_SM, padX: 10, padY: pad });
    return [prev, this.playButton, next];
  }

  // --- Inspector -------------------------------------------------------------

  renderInspect() {
    const record = this.sim.turns[this.viewTurn - 1];
    const placed = this.shown.find((p) => p.id === this.hoverId);
    if (placed) return this.readout.inspect(this.moduleInfo(placed.type, placed, record));
    const type = this.hoverType ?? this.armed;
    if (type) return this.readout.inspect(this.moduleInfo(type, null, null));
    if (this.hoverTile !== null) return this.readout.inspect(this.slotInfo(this.hoverTile));
    if (this.hoverWorld) return this.readout.inspect(this.worldInfo(this.hoverWorld));
    if (this.hoverLib) {
      const m = store.machine(this.hoverLib);
      const n = store.placedCount(m.id);
      return this.readout.inspect({
        title: m.name,
        subtitle: `Saved machine · ${m.parts.length} module${m.parts.length === 1 ? '' : 's'}`,
        lines: [
          { text: m.id === this.machineId ? 'Open on the Workbench now.' : `${CLICK} to open it on the Workbench.` },
          { text: n ? `${n} placed on the Playground.` : 'Not on the Playground yet.', color: COLORS.muted },
        ],
      });
    }
    return this.readout.inspect({
      title: 'How to build',
      lines: (MOBILE ? HELP_TOUCH : HELP).map((text) => ({ text, color: COLORS.muted })),
    });
  }

  moduleInfo(type, p, record) {
    const def = MODULES[type];
    const role = ROLE_STYLE[roleKey(def)];
    const lines = [{ text: def.blurb }];
    const labelOf = labelFor(this.shown);
    const ground = this.ground ? TERRAIN[this.ground].name.toLowerCase() : null;
    const ports = p ? portsOf(p) : def.ports.map((port, index) => ({ ...port, index }));
    for (const port of ports) {
      const flow = FLOW_NAMES[port.flow];
      const info = p && this.sim.net.ports.get(port.key);
      const other = info?.status === 'linked' ? this.shown.find((q) => q.id === info.partnerId) : null;
      const where = (q) => `${labelOf(q)} (#${this.shown.indexOf(q) + 1})`;
      let text;
      if (port.dir === 'in') {
        if (!p) text = `Takes ${flow} from a piece to its left.`;
        else if (other) text = `Takes ${flow} from ${where(other)}.`;
        else if (this.sim.ground?.provides === port.flow) text = `Takes ${flow} from the ${ground} under the machine: nothing to its left has any to spare.`;
        else text = `Needs ${flow}, but nothing to its left has any to spare and the ground gives none.`;
      } else if (!p) text = `Gives ${flow} to a piece on its right.`;
      else if (other) text = `Gives ${flow} to ${where(other)}.`;
      else text = `Gives ${flow} that no piece on its right takes: it ${port.flow === 'matter' || port.flow === 'heat' ? "spills onto the machine's tile" : 'goes to waste'}.`;
      lines.push({ text, color: FLOW_STYLE[port.flow].css });
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
        lines.push({ text: `Turn ${turn}: idle, because ${whyIdle(this.shown, this.sim, p.id, turn)}.`, color: COLORS.bad });
      }
    }
    const title = p ? `#${this.shown.indexOf(p) + 1} ${def.name}` : def.name;
    return { title, color: role.css, subtitle: role.label, lines };
  }

  // An empty slot of the row.
  slotInfo(i) {
    const ground = this.ground ? TERRAIN[this.ground] : null;
    const lines = [
      {
        text: ground
          ? `The machine stands on ${ground.name.toLowerCase()}: an input with nothing to its left to take from draws ${FLOW_NAMES[ground.provides]} from it.${ground.hot ? ' Embers are always hot.' : ''}`
          : 'The machine stands on bare ground: an input with nothing to its left to take from gets nothing.',
        color: COLORS.muted,
      },
    ];
    if (this.placements.length >= WORKBENCH.slots) lines.unshift({ text: `The row is full: a machine has at most ${WORKBENCH.slots} pieces.` });
    else lines.unshift({ text: this.armed ? `${CLICK} to add a ${MODULES[this.armed].name} at the end of the row.` : 'Drag a module here to add it at the end of the row.', color: this.armed ? COLORS.good : COLORS.text });
    return { title: `Slot ${i + 1}, empty`, lines };
  }

  worldInfo(key) {
    const [x, y] = key.split(',').map(Number);
    const tile = this.test.round.turns[this.viewTurn - 1].tiles[key];
    const name = causeNamer([this.test.unit]);
    const from = (causes) => [...new Set(causes.map((c) => name(c, BENCH_UNIT)))].join(', ');
    const lines = [{ text: 'The machine on its own, in the middle, with the tiles round it. This is how it acts on the Playground.', color: COLORS.muted }];
    if (tile) {
      if (tile.steam) lines.push({ text: `Steaming: wet from ${from(tile.wet)} and hot from ${from(tile.hot)}.` });
      else {
        if (tile.wet.length) lines.push({ text: `Wet, from ${from(tile.wet)}.`, color: FLOW_STYLE.matter.css });
        if (tile.isHot) lines.push({ text: `Hot, from ${from(tile.hot)}.`, color: FLOW_STYLE.heat.css });
      }
      if (tile.air.length) lines.push({ text: `Air blown by ${from(tile.air)}.` });
      if (tile.alert.length) lines.push({ text: `Alerted by ${from(tile.alert)}.`, color: FLOW_STYLE.signal.css });
    } else lines.push({ text: 'Nothing reaches this tile on this turn.' });
    return { title: `In the world, ${tileName(x, y)}`, subtitle: `Turn ${this.viewTurn}`, lines };
  }

  // Read by the tests.
  testState() {
    return {
      screen: 'workbench',
      placements: this.placements.map((p) => ({ ...p })),
      turn: this.viewTurn,
      armed: this.armed,
      playing: !!this.playTimer,
      active: { ...this.sim.turns[this.viewTurn - 1].active },
      desc: JSON.parse(JSON.stringify(this.desc)),
      machineId: this.machineId,
      name: this.name,
      ground: this.ground,
      dirty: this.isDirty(),
      editing: !!this.editing,
      library: store.machines().map((m) => ({ id: m.id, name: m.name })),
      worldTiles: JSON.parse(JSON.stringify(this.test.round.turns[this.viewTurn - 1].tiles)),
    };
  }
}
