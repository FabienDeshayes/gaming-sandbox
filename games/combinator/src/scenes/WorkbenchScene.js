// The Workbench: where machines are built, named, saved and deleted. A palette
// of modules, the grid a machine is built on, the ground it is tested
// standing on, the small world round it showing what it does there, a readout
// in sentences and a turn-by-turn timeline of its test run. Every edit re-runs
// the test at once, so what the screen shows is always what the machine will
// do — and while a module is being dragged, what it *would* do with it dropped.

import {
  COLORS,
  DRAG_THRESHOLD,
  EFFECT_STYLE,
  FLOW_STYLE,
  FONT,
  FONT_MD,
  FONT_SM,
  GAME_WIDTH,
  LAYOUT,
  MATERIAL_STYLE,
  PLAY_STEP_MS,
  ROLE_STYLE,
  TEXT_RESOLUTION,
} from '../config.js';
import { GROUNDS, TERRAIN, WORKBENCH } from '../data/world.js';
import { FLOWS, MODULES, PALETTE } from '../data/modules.js';
import {
  BENCH_UNIT,
  FLOW_NAMES,
  SIDE_WORDS,
  canPlace,
  causeNamer,
  describe,
  label,
  portsOf,
  testMachine,
  tileKey,
  tileName,
  unitArea,
  whyIdle,
} from '../core/machine.js';
import * as store from '../store.js';
import { BenchView } from '../ui/BenchView.js';
import { createButton } from '../ui/button.js';
import { ListView } from '../ui/ListView.js';
import { drawMachine } from '../ui/machineArt.js';
import { drawModule, flowShape, roleKey } from '../ui/moduleArt.js';
import { Readout } from '../ui/Readout.js';
import { drawHeader } from '../ui/tabs.js';
import { Timeline } from '../ui/Timeline.js';
import { WorldView } from '../ui/WorldView.js';

const HELP = [
  'Drag a module from the left onto a cell.',
  'Click a placed module to turn it. R turns whatever is under the pointer, or the one you are dragging.',
  'Drag a module to move it; drag it off the Workbench (or press Delete) to remove it.',
  'Touching ports connect when they carry the same flow, one out (solid) and one in (hollow).',
  'The whole machine stands on one tile. Open inputs draw from its ground; pick it under "Test on".',
  'Save the machine, then place it on the Playground.',
];
const NAME_MAX = 22;
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
    this.library.reveal(this.machineId);
    this.readout = new Readout(this, LAYOUT.panel, (ids) => {
      this.lineHighlight = ids;
      this.refresh();
    });
    this.drawTimelineHeader();
    this.timeline = new Timeline(this, LAYOUT.timeline);
    this.dragGfx = this.add.graphics().setDepth(20);
    this.dragLabel = this.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: COLORS.text, resolution: TEXT_RESOLUTION })
      .setOrigin(0.5)
      .setDepth(21);

    this.input.on('pointerdown', (pointer, over) => this.onDown(pointer, over));
    this.input.on('pointermove', (pointer) => this.onMove(pointer));
    this.input.on('pointerup', (pointer) => this.onUp(pointer));
    this.input.keyboard?.on('keydown', (event) => this.onKey(event));

    this.refresh();
  }

  update(time) {
    this.view.animate(time);
  }

  // --- State -----------------------------------------------------------------

  // The machine as it stands, or as it would stand with the dragged module
  // dropped on the cell under the pointer.
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
      highlight: new Set(this.lineHighlight),
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
    this.turnLabel.setText(`TEST RUN · turn ${this.viewTurn} of ${this.sim.turns.length}`);
    this.renderInspect();
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
    return this.shown
      .filter((p) => ['source', 'effector'].includes(MODULES[p.type].role) || burns.has(p.id))
      .sort((a, b) => rank(a) - rank(b))
      .map((p) => {
        const def = MODULES[p.type];
        const role = ROLE_STYLE[roleKey(def)];
        return {
          label: `${def.name} ${tileName(p.x, p.y)}`,
          labelColor: role.css,
          onColor: def.effect ? EFFECT_STYLE[def.effect.kind] : role.color,
          cells: this.sim.turns.map((r) => ({
            state: !r.present.includes(p.id) ? 'gone' : r.active[p.id] ? 'on' : 'off',
            mark: r.events.find((e) => e.id === p.id)?.type ?? null,
          })),
        };
      });
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
    this.confirm('new', `Unsaved changes to ${this.name}. Click New again to drop them.`, () => this.loadMachine(null));
  }

  openMachine(id) {
    const m = store.machine(id);
    if (!m || (id === this.machineId && !this.isDirty())) return;
    if (!this.isDirty()) return this.loadMachine(m);
    this.confirm(`open:${id}`, `Unsaved changes to ${this.name}. Click ${m.name} again to drop them and open it.`, () => this.loadMachine(m));
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
      this.confirm('delete', 'Click Delete again to throw this unsaved machine away.', () => this.loadMachine(null));
      return;
    }
    const n = store.placedCount(saved.id);
    const also = n ? ` It comes off the Playground too (${n} placed).` : '';
    this.confirm('delete', `Click Delete again to delete ${saved.name}.${also}`, () => {
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
    const tile = this.view.tileAt(px, py);
    if (!tile) return null;
    return this.placements.find((p) => p.x === tile[0] && p.y === tile[1]) ?? null;
  }

  onDown(pointer, over) {
    if (this.editing && !over.includes(this.nameText)) this.finishEdit(true);
    if (over.some((o) => o.isButton)) return;
    if (pointer.rightButtonDown()) {
      const p = this.moduleAt(pointer.x, pointer.y);
      if (p) {
        this.rotate(p.id);
        this.changed();
      }
      return;
    }
    const lib = this.library.itemAt(pointer.x, pointer.y);
    if (lib) {
      this.openMachine(lib.key);
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
      this.changed();
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
        const ok = tile && canPlace(WORKBENCH, this.placements, tile[0], tile[1], d.kind === 'move' ? d.id : null);
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
      if (d.kind === 'new') {
        this.armed = this.armed === d.type ? null : d.type;
        this.refresh();
      } else {
        this.rotate(d.id);
        this.changed();
      }
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
    this.updateHover(pointer, false);
    this.changed();
  }

  onKey(event) {
    if (this.editing) {
      this.editKey(event);
      return;
    }
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

  updateHover(pointer, redraw = true) {
    const item = this.paletteAt(pointer.x, pointer.y);
    const p = this.moduleAt(pointer.x, pointer.y);
    const tile = this.view.tileAt(pointer.x, pointer.y);
    const lib = this.library.itemAt(pointer.x, pointer.y);
    const world = this.preview.tileAt(pointer.x, pointer.y);
    const next = {
      type: item?.type ?? null,
      id: p?.id ?? null,
      tile: !p && tile ? tileKey(...tile) : null,
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
    if (d.target) return; // shown as a ghost on the Workbench instead
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

  drawActions() {
    let x = GAME_WIDTH - 16;
    for (const [text, fn] of [['Delete', () => this.deleteMachine()], ['Save', () => this.save()], ['New', () => this.newMachine()]]) {
      const b = createButton(this, 0, 28, text, fn, { fontSize: FONT_SM, width: 76 });
      b.moveX(x - Math.max(76, b.width) / 2);
      x -= Math.max(76, b.width) + 8;
    }
  }

  drawMachineBar() {
    const y = LAYOUT.machineBar.y;
    const x = LAYOUT.bench.x - 20;
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
      .text(x, y, '', { fontFamily: FONT, fontSize: `${FONT_SM}px`, color: COLORS.muted, resolution: TEXT_RESOLUTION })
      .setOrigin(0, 0.5)
      .setDepth(3);

    let right = LAYOUT.bench.x + WORKBENCH.cols * LAYOUT.bench.tile + 24;
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

  renderMachineBar() {
    const editing = !!this.editing;
    this.nameText.setText(editing ? `${this.editing.text}▏` : `${this.name}  ✎`);
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
    this.statusText
      .setText(status)
      .setColor(color)
      .setX(b.right + 12)
      .setWordWrapWidth(Math.max(120, this.barRight - b.right - 12));
    for (const { ground, button } of this.groundButtons) {
      button.setBaseFill(ground === this.ground ? COLORS.selectedHex : COLORS.buttonHex);
    }
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
    this.playButton = createButton(this, next.x - 86, y + 14, '▶ Run test', () => this.play(), {
      fontSize: FONT_SM,
      padX: 10,
      padY: 5,
      width: 112,
    });
    createButton(this, this.playButton.x - 86, y + 14, '|◀', () => {
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
    if (this.hoverTile) return this.readout.inspect(this.cellInfo(this.hoverTile, record));
    if (this.hoverWorld) return this.readout.inspect(this.worldInfo(this.hoverWorld));
    if (this.hoverLib) {
      const m = store.machine(this.hoverLib);
      const n = store.placedCount(m.id);
      return this.readout.inspect({
        title: m.name,
        subtitle: `Saved machine · ${m.parts.length} module${m.parts.length === 1 ? '' : 's'}`,
        lines: [
          { text: m.id === this.machineId ? 'Open on the Workbench now.' : 'Click to open it on the Workbench.' },
          { text: n ? `${n} placed on the Playground.` : 'Not on the Playground yet.', color: COLORS.muted },
        ],
      });
    }
    return this.readout.inspect({
      title: 'How to build',
      lines: HELP.map((text) => ({ text, color: COLORS.muted })),
    });
  }

  moduleInfo(type, p, record) {
    const def = MODULES[type];
    const role = ROLE_STYLE[roleKey(def)];
    const lines = [{ text: def.blurb }];
    const ports = p ? portsOf(p) : def.ports.map((port, index) => ({ ...port, index }));
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
        lines.push({ text: `Turn ${turn}: idle, because ${whyIdle(this.shown, this.sim, p.id, turn)}.`, color: COLORS.bad });
      }
    }
    return { title: p ? label(p) : def.name, color: role.css, subtitle: role.label, lines };
  }

  cellInfo(key, record) {
    const [x, y] = key.split(',').map(Number);
    const ground = this.ground ? TERRAIN[this.ground] : null;
    const lines = [
      {
        text: ground
          ? `The machine stands on ${ground.name.toLowerCase()}: an open ${FLOW_NAMES[ground.provides]} input anywhere in it draws from it.${ground.hot ? ' Embers are always hot.' : ''}`
          : 'The machine stands on bare ground. Open inputs have nothing to draw from.',
        color: COLORS.muted,
      },
    ];
    const cell = record.tiles[key];
    const name = causeNamer([this.test.unit]);
    const from = (causes) => [...new Set(causes.map((c) => name(c, BENCH_UNIT)))].join(', ');
    if (cell) {
      if (cell.steam) lines.push({ text: `Steaming: water from ${from(cell.wet)} cools the heat from ${from(cell.hot)}.` });
      else {
        if (cell.wet.length) lines.push({ text: `Wet, from ${from(cell.wet)}.`, color: FLOW_STYLE.matter.css });
        if (cell.isHot) lines.push({ text: `Hot, from ${from(cell.hot)}. Wood here burns after 2 hot turns.`, color: FLOW_STYLE.heat.css });
      }
    }
    if (this.armed) lines.push({ text: `Click to place a ${MODULES[this.armed].name} here.`, color: COLORS.good });
    return { title: `Cell ${tileName(x, y)}`, subtitle: `Turn ${record.turn}`, lines };
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
