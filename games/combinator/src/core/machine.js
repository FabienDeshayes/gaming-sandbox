// The machine rules: how the modules inside a machine connect, what a machine
// does when it is made to work, what that leaves on the tiles of the world it
// stands in, and the plain-language readout. Pure functions over plain data —
// no Phaser, no scene state — so the same rules drive both screens, the
// readouts and the tests, and the same actions on the same layout always end
// the same way.
//
// Two kinds of placement:
//  - a part is a module inside a machine: { id, type }. A machine's parts are
//    a row, read left to right, and a part's place is its place in the list.
//    The row is a line that carries flows rightwards: each input takes the
//    nearest flow of its element offered by a piece to its left that no other
//    piece has taken yet, and each output offers its flow to the pieces on its
//    right. A flow nobody takes is left open, and so is an input with nothing
//    to take.
//  - a unit is a whole machine standing on one tile of a world (the
//    Playground, or the small test world round the Workbench):
//    { id, machine: { name, parts }, x, y, rot }.
//
// Nothing happens on its own. A run is the list of actions the player has
// taken, each one a unit made to work once, in order. Every module works for
// the whole run; what a machine does when it works depends on what it is
// built from and on what its tile offers at that moment.

import { CONDITIONS, SPILL, TERRAIN } from '../data/world.js';
import { MODULES } from '../data/modules.js';

export const SIDES = ['N', 'E', 'S', 'W'];
const STEP = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };

export const FLOW_NAMES = { liquid: 'Liquid', solid: 'Solid', gas: 'Gas', energy: 'Energy' };
export const SIDE_WORDS = { N: 'north', E: 'east', S: 'south', W: 'west' };
const LEFT = ['wet', 'sand', 'fumes', 'wind', 'hot'];

export const tileKey = (x, y) => `${x},${y}`;
export const tileName = (x, y) => `${String.fromCharCode(65 + x)}${y + 1}`;

export function rotateSide(side, rot) {
  return SIDES[(SIDES.indexOf(side) + (((rot % 4) + 4) % 4)) % 4];
}

export function neighbour(x, y, side) {
  const [dx, dy] = STEP[side];
  return [x + dx, y + dy];
}

export function onGrid(grid, x, y) {
  return x >= 0 && y >= 0 && x < grid.cols && y < grid.rows;
}

export function terrainAt(world, x, y) {
  const id = world.terrain?.[tileKey(x, y)];
  return id ? { id, ...TERRAIN[id] } : null;
}

// How the parts of one machine are named: by their module's name, with their
// place in the row ("Sprinkler #3") when the machine has more than one of it.
export function labelFor(parts) {
  const count = {};
  for (const p of parts) count[p.type] = (count[p.type] ?? 0) + 1;
  return (p) => {
    const name = MODULES[p.type].name;
    return count[p.type] > 1 ? `${name} #${parts.findIndex((q) => q.id === p.id) + 1}` : name;
  };
}

// A machine named by where it stands in the world.
export function unitLabel(unit) {
  return `${unit.machine.name} (${tileName(unit.x, unit.y)})`;
}

export function portsOf(p) {
  return MODULES[p.type].ports.map((port, index) => ({
    key: `${p.id}:${index}`,
    id: p.id,
    index,
    dir: port.dir,
    flow: port.flow,
  }));
}

// Whether a machine can stand on tile (x, y) of a world, one machine per tile.
export function canPlace(grid, placements, x, y, ignoreId = null) {
  if (!onGrid(grid, x, y)) return false;
  return !placements.some((p) => p.id !== ignoreId && p.x === x && p.y === y);
}

// --- Effects in the world ----------------------------------------------------

// Which way a machine's effectors face in the world: its front, which is north
// until the machine is turned on its tile.
export function effectFront(machineRot = 0) {
  return rotateSide('N', machineRot);
}

// The world tiles an effect reaches from a machine at (x, y): 'cross' is the
// machine's own tile and the four around it; 'front1'/'front2' reach one or
// two tiles out of the front. Tiles off the world are dropped.
export function areaTiles(world, x, y, area, front) {
  const tiles = [];
  if (area === 'cross') {
    tiles.push([x, y]);
    for (const side of SIDES) tiles.push(neighbour(x, y, side));
  } else {
    const reach = area === 'front2' ? 2 : 1;
    let [cx, cy] = [x, y];
    for (let i = 0; i < reach; i++) {
      [cx, cy] = neighbour(cx, cy, front);
      tiles.push([cx, cy]);
    }
  }
  return tiles.filter(([tx, ty]) => onGrid(world, tx, ty));
}

// Every tile a unit's effectors reach, with what they do there. Pass `partId`
// for one effector only.
export function unitArea(world, unit, partId = null) {
  const out = [];
  for (const part of unit.machine.parts) {
    const def = MODULES[part.type];
    if (!def.effect || (partId && part.id !== partId)) continue;
    for (const [x, y] of areaTiles(world, unit.x, unit.y, def.effect.area, effectFront(unit.rot))) {
      out.push({ x, y, kind: def.effect.kind });
    }
  }
  return out;
}

// --- Connections inside a machine --------------------------------------------

// Every port's link status, worked out along the row from left to right. An
// input takes the nearest output of its element to its left that nothing
// nearer has taken; it is then 'linked' to it. An input with nothing to take,
// and an output nobody takes, are 'open': when the machine works an open input
// draws from the tile under the machine and an open output spills onto it.
export function connect(parts) {
  const ports = new Map();
  const offered = []; // outputs to the left still untaken, nearest last
  parts.forEach((p, pos) => {
    const mine = portsOf(p).map((port) => ({ ...port, pos, status: 'open' }));
    for (const info of mine) {
      if (info.dir !== 'in') continue;
      const k = offered.findLastIndex((o) => o.flow === info.flow);
      if (k < 0) continue;
      const [out] = offered.splice(k, 1);
      Object.assign(info, { status: 'linked', partner: out.key, partnerId: out.id });
      Object.assign(out, { status: 'linked', partner: info.key, partnerId: info.id });
    }
    for (const info of mine) {
      if (info.dir === 'out') offered.push(info);
      ports.set(info.key, info);
    }
  });
  return { ports };
}

// --- Tiles -------------------------------------------------------------------

// A tile as it stands: its ground, what machines have left on it (each with
// the causes that left it), whether it is hot, and which elements an open
// input of a machine standing on it can draw. Water on a hot tile turns the
// heat to steam and sand smothers it: either way the tile is not hot.
//   landed: { [tileKey]: { wet: [cause], sand: [...], ... } }
export function tileState(world, landed, x, y) {
  const terrain = terrainAt(world, x, y);
  const left = landed[tileKey(x, y)] ?? {};
  const tile = { terrain };
  for (const kind of LEFT) tile[kind] = [...(left[kind] ?? [])];
  if (terrain?.hot) tile.hot.unshift({ kind: 'terrain', terrain: terrain.id });
  tile.steam = tile.hot.length > 0 && tile.wet.length > 0;
  tile.smothered = tile.hot.length > 0 && !tile.steam && tile.sand.length > 0;
  tile.isHot = tile.hot.length > 0 && !tile.steam && !tile.smothered;

  // Where each element on offer comes from: the ground first, then what has
  // been left there. Heat that is put out offers nothing.
  const offers = {};
  if (terrain) (offers[terrain.provides] ??= []).push({ kind: 'terrain', terrain: terrain.id });
  for (const kind of LEFT) {
    const causes = left[kind] ?? [];
    if (causes.length === 0 || (kind === 'hot' && !tile.isHot)) continue;
    (offers[CONDITIONS[kind].gives] ??= []).push({ kind: 'left', condition: kind, causes });
  }
  tile.offers = offers;
  tile.blank = !terrain && LEFT.every((kind) => tile[kind].length === 0);
  return tile;
}

// Every tile worth drawing: those with ground or with something left on them.
export function allTiles(world, landed) {
  const keys = new Set([...Object.keys(world.terrain ?? {}), ...Object.keys(landed)]);
  const out = {};
  for (const key of keys) {
    const [x, y] = key.split(',').map(Number);
    const tile = tileState(world, landed, x, y);
    if (!tile.blank) out[key] = tile;
  }
  return out;
}

// --- Making a machine work -----------------------------------------------------

// One machine's flows as it works, settled as a fixed point that starts with
// everything off, so a loop with no source in it never switches itself on and
// the order modules are listed in can't change the result. Every module that
// hasn't burnt down takes part; a source always gives.
function settle(parts, net, burnt, offers) {
  const present = parts.filter((p) => burnt[p.id] === undefined);
  const presentIds = new Set(present.map((p) => p.id));
  const active = {};

  const inputCarries = (port) => {
    const info = net.ports.get(port.key);
    if (info.status === 'linked') return presentIds.has(info.partnerId) && !!active[info.partnerId];
    return !!offers[port.flow];
  };

  let changed = true;
  while (changed) {
    changed = false;
    for (const p of present) {
      if (active[p.id]) continue;
      const def = MODULES[p.type];
      const on = def.role === 'source' || portsOf(p).filter((port) => port.dir === 'in').every(inputCarries);
      if (on) {
        active[p.id] = true;
        changed = true;
      }
    }
  }

  const carrying = {};
  const draws = [];
  const spills = [];
  for (const p of present) {
    for (const port of portsOf(p)) {
      const info = net.ports.get(port.key);
      if (port.dir === 'out') {
        carrying[port.key] = !!active[p.id];
        if (active[p.id] && info.status !== 'linked') spills.push({ key: port.key, id: p.id, flow: port.flow });
      } else {
        carrying[port.key] = inputCarries(port);
        if (carrying[port.key] && info.status !== 'linked') {
          draws.push({ key: port.key, id: p.id, flow: port.flow, from: offers[port.flow][0] });
        }
      }
    }
  }
  return { present: [...presentIds], active, carrying, draws, spills };
}

// What each piece of a machine feels, by its place in the row: waste heat
// from a working converter beside it, plus whatever is on the machine's tile.
// Water on the tile wets every module in the machine, which is how a
// sprinkler cools its neighbours.
function cellsOf(parts, inner, tile) {
  const cells = {};
  parts.forEach((p, pos) => {
    const hot = [...(inner[pos] ?? []), ...tile.hot];
    const wet = tile.wet;
    const sand = tile.sand;
    if (hot.length === 0 && wet.length === 0 && sand.length === 0) return;
    const steam = hot.length > 0 && wet.length > 0;
    const smothered = hot.length > 0 && !steam && sand.length > 0;
    cells[pos] = { hot, wet, sand, steam, smothered, isHot: hot.length > 0 && !steam && !smothered };
  });
  return cells;
}

function leave(landed, key, kind, cause) {
  const list = ((landed[key] ??= {})[kind] ??= []);
  if (!list.some((c) => c.kind === cause.kind && c.unit === cause.unit && c.id === cause.id)) list.push(cause);
}

// Unit `unitId` works once. Its flows settle against what its tile offers
// right now; its effectors leave their mark on the tiles they reach and its
// open outputs spill onto its own tile; then every wooden module that is hot
// burns down — in the working machine (waste heat beside a converter, or a
// hot tile), and in any machine whose tile this action has just heated.
// Changes `state` and returns what happened.
function act(world, byId, nets, state, unitId, n) {
  const unit = byId.get(unitId);
  const parts = unit.machine.parts;
  const net = nets[unitId];
  const here = tileState(world, state.landed, unit.x, unit.y);
  const record = { unit: unitId, n, net, ground: here.terrain, offers: here.offers };
  Object.assign(record, settle(parts, net, state.burnt[unitId], here.offers));

  const inner = {};
  const effects = [];
  const front = effectFront(unit.rot);
  for (const p of parts) {
    if (!record.active[p.id]) continue;
    const def = MODULES[p.type];
    if (def.kind === 'converter') {
      const pos = parts.indexOf(p);
      for (const at of [pos - 1, pos + 1]) {
        if (at >= 0 && at < parts.length) (inner[at] ??= []).push({ kind: 'waste', unit: unitId, id: p.id });
      }
    }
    if (def.effect) {
      for (const [x, y] of areaTiles(world, unit.x, unit.y, def.effect.area, front)) {
        effects.push({ key: tileKey(x, y), kind: def.effect.kind, cause: { kind: 'effect', unit: unitId, id: p.id, front } });
      }
    }
  }
  for (const spill of record.spills) {
    effects.push({ key: tileKey(unit.x, unit.y), kind: SPILL[spill.flow], cause: { kind: 'spill', unit: unitId, id: spill.id } });
  }
  for (const e of effects) leave(state.landed, e.key, e.kind, e.cause);
  record.effects = effects;

  record.cells = cellsOf(parts, inner, tileState(world, state.landed, unit.x, unit.y));
  record.burns = [];
  const burn = (u, p, causes) => {
    state.burnt[u.id][p.id] = n;
    record.burns.push({ unit: u.id, id: p.id, causes });
  };
  parts.forEach((p, pos) => {
    if (!record.present.includes(p.id) || MODULES[p.type].material !== 'wood') return;
    if (record.cells[pos]?.isHot) burn(unit, p, record.cells[pos].hot);
  });
  const heated = new Set(effects.filter((e) => e.kind === 'hot').map((e) => e.key));
  for (const other of byId.values()) {
    if (other.id === unitId || !heated.has(tileKey(other.x, other.y))) continue;
    const tile = tileState(world, state.landed, other.x, other.y);
    if (!tile.isHot) continue;
    for (const p of other.machine.parts) {
      if (MODULES[p.type].material === 'wood' && state.burnt[other.id][p.id] === undefined) burn(other, p, tile.hot);
    }
  }
  return record;
}

// Play a run: the actions taken so far, in order, each the id of a unit made
// to work. Actions of units no longer in the world are skipped. Returns every
// action's record, what is left on the tiles, and which modules have burnt
// down (with the number of the action that burnt them).
export function runActions(world, units, actions = []) {
  const byId = new Map(units.map((u) => [u.id, u]));
  const nets = {};
  const state = { landed: {}, burnt: {} };
  for (const unit of units) {
    nets[unit.id] = connect(unit.machine.parts);
    state.burnt[unit.id] = {};
  }
  const steps = [];
  for (const id of actions) {
    if (byId.has(id)) steps.push(act(world, byId, nets, state, id, steps.length + 1));
  }
  return { world, units, byId, nets, state, steps };
}

// What unit `unitId` would do if it were made to work next, without doing it.
export function preview(run, unitId) {
  const state = { landed: JSON.parse(JSON.stringify(run.state.landed)), burnt: JSON.parse(JSON.stringify(run.state.burnt)) };
  return act(run.world, run.byId, run.nets, state, unitId, run.steps.length + 1);
}

// The Workbench tests a machine on its own, standing on one chosen ground in
// the middle of a small world, made to work once, so the screen can show what
// it does round it.
export const BENCH_UNIT = 'bench';
export const TEST_WORLD = { cols: 5, rows: 5, at: [2, 2] };

export function testWorld(ground) {
  const [x, y] = TEST_WORLD.at;
  return { cols: TEST_WORLD.cols, rows: TEST_WORLD.rows, terrain: ground ? { [tileKey(x, y)]: ground } : {} };
}

export function testMachine(parts, ground) {
  const world = testWorld(ground);
  const [x, y] = TEST_WORLD.at;
  const unit = { id: BENCH_UNIT, machine: { name: 'This machine', parts }, x, y, rot: 0 };
  const run = runActions(world, [unit], [BENCH_UNIT]);
  return { world, unit, run, step: run.steps[0], tiles: allTiles(world, run.state.landed) };
}

// --- Plain-language readout --------------------------------------------------

const EFFECT_VERB = {
  wet: 'wets',
  sand: 'pours sand over',
  wind: 'blows wind onto',
  hot: 'heats',
};

export function areaText(area, front) {
  if (area === 'cross') return "the machine's tile and the 4 around it";
  if (area === 'front1') return `the tile ${SIDE_WORDS[front]} of the machine`;
  return `the 2 tiles ${SIDE_WORDS[front]} of the machine`;
}

// Names whatever made a tile hot, wet and so on, as seen from inside unit
// `selfId`: its own modules by name, anyone else's as "Torch in Hot Box (C4)".
export function causeNamer(units, labelOf = null) {
  const byUnit = new Map(units.map((u) => [u.id, u]));
  return (cause, selfId) => {
    if (cause.kind === 'terrain') return `the ${TERRAIN[cause.terrain].name.toLowerCase()} under the machine`;
    const unit = byUnit.get(cause.unit);
    const part = unit.machine.parts.find((p) => p.id === cause.id);
    const own = cause.unit === selfId;
    const who = own ? (labelOf ?? labelFor(unit.machine.parts))(part) : `${MODULES[part.type].name} in ${unitLabel(unit)}`;
    if (cause.kind === 'waste') return `waste heat from ${who}`;
    if (cause.kind === 'spill') return `what spills out of ${who}`;
    return who;
  };
}

const list = (names) => [...new Set(names)].join(' and ');

// Where a machine's tile gets an element from, in words: "the puddle under the
// machine", "the water Sprinkler in Tank Sprinkler (D4) left on its tile".
export function offerText(source, nameCause, selfId) {
  if (source.kind === 'terrain') return `the ${TERRAIN[source.terrain].name.toLowerCase()} under the machine`;
  const who = list(source.causes.map((c) => nameCause(c, selfId)));
  return `the ${CONDITIONS[source.condition].what} ${who} left on its tile`;
}

// What the tile under a machine has to give, for a sentence about an input
// that gets nothing from it.
function groundText(step) {
  const elements = Object.keys(step.offers).map((f) => FLOW_NAMES[f]);
  if (elements.length === 0) {
    return step.ground ? `the ${step.ground.name.toLowerCase()} under the machine gives none` : 'the bare ground under the machine has none to give';
  }
  return `its tile only gives ${elements.join(' and ')}`;
}

// Why a part isn't working in an action, followed upstream to the first thing
// that is actually wrong, so the answer names the cause rather than the next
// pipe along.
export function whyIdle(parts, step, id, labelOf = labelFor(parts)) {
  const byId = new Map(parts.map((p) => [p.id, p]));
  const seen = new Set();
  const walk = (partId) => {
    const p = byId.get(partId);
    if (!step.present.includes(partId)) return `${labelOf(p)} has burnt down`;
    if (seen.has(partId)) return 'its flow only goes round in a loop, with no source feeding it';
    seen.add(partId);
    // The part asked about is "its"; anything further upstream is named.
    const whose = partId === id ? 'its' : `${labelOf(p)}'s`;
    for (const port of portsOf(p)) {
      if (port.dir !== 'in' || step.carrying[port.key]) continue;
      const info = step.net.ports.get(port.key);
      const flow = FLOW_NAMES[port.flow];
      if (info.status === 'linked') return walk(info.partnerId);
      return `${whose} ${flow} input gets nothing: no piece to its left has ${flow} to spare, and ${groundText(step)}`;
    }
    return "it isn't getting what it needs";
  };
  return walk(id);
}

// What one machine does when it works, what is wrong with it, and what else is
// worth knowing, as sentences. `step` is the record of one action of it (from
// runActions or preview). Each line carries the part ids it is about so the
// Workbench can point at them.
//   opts.rot      the machine's turn in the world (directions in the text)
//   opts.labelOf  how a part is named
//   opts.nameCause, opts.self  how causes are named (causeNamer)
export function describe(parts, step, opts = {}) {
  const { rot = 0, labelOf = labelFor(parts), self = BENCH_UNIT } = opts;
  const nameCause = opts.nameCause ?? causeNamer([{ id: self, machine: { parts }, x: 0, y: 0 }], labelOf);
  const result = [];
  const problems = [];
  const notes = [];
  const byId = new Map(parts.map((p) => [p.id, p]));

  if (parts.length === 0) {
    result.push({ text: 'The Workbench is empty. Drag a module into the row to start a machine.', ids: [] });
    return { result, problems, notes };
  }

  const effectors = parts.filter((p) => MODULES[p.type].role === 'effector');
  if (effectors.length === 0) {
    result.push({
      text: 'Nothing acts on the world yet. A machine needs an effector (Sprinkler, Sand Chute, Fan or Torch) fed with its element.',
      ids: [],
    });
  }
  for (const p of effectors) {
    const def = MODULES[p.type];
    if (!step.present.includes(p.id)) {
      problems.push({ text: `${labelOf(p)} has burnt down: it does nothing any more.`, ids: [p.id] });
    } else if (step.active[p.id]) {
      result.push({ text: `${labelOf(p)} ${EFFECT_VERB[def.effect.kind]} ${areaText(def.effect.area, effectFront(rot))}.`, ids: [p.id], good: true });
    } else {
      problems.push({ text: `${labelOf(p)} can't work: ${whyIdle(parts, step, p.id, labelOf)}.`, ids: [p.id] });
    }
  }

  for (const b of step.burns) {
    if (b.unit !== self) continue;
    const p = byId.get(b.id);
    problems.push({
      text: `${labelOf(p)} is wooden and burns down as the machine works, from ${list(b.causes.map((c) => nameCause(c, self)))}. It works this once, then it is gone.`,
      ids: [p.id],
      kind: 'burn',
    });
  }

  for (const spill of step.spills) {
    const p = byId.get(spill.id);
    const flow = FLOW_NAMES[spill.flow];
    const condition = CONDITIONS[SPILL[spill.flow]];
    notes.push({
      text: `${labelOf(p)} gives ${flow} that no piece to its right takes: it spills onto the machine's tile, which is left with ${condition.what}.`,
      ids: [p.id],
      kind: 'spill',
    });
  }
  for (const draw of step.draws) {
    const p = byId.get(draw.id);
    notes.push({
      text: `${labelOf(p)} draws ${FLOW_NAMES[draw.flow]} from ${offerText(draw.from, nameCause, self)}.`,
      ids: [p.id],
      kind: 'draw',
    });
  }
  for (const p of parts) {
    if (!step.active[p.id] || MODULES[p.type].kind !== 'converter') continue;
    notes.push({ text: `${labelOf(p)} gives off waste heat onto the pieces either side of it while it works.`, ids: [p.id], kind: 'waste' });
  }

  return { result, problems, notes };
}

const LEFT_VERB = { wet: 'wetted', sand: 'sanded', fumes: 'filled with fumes', wind: 'blown on', hot: 'heated' };

// The whole Playground, machine by machine: what each one would do if it were
// made to work now, what is wrong, and what the machines have done to each
// other's tiles so far. Lines carry unit ids. The Workbench's own concerns
// (spills, waste heat) are left to the Workbench.
//   previews: { [unitId]: record } from preview(run, unitId)
export function describePlayground(world, units, run, previews) {
  const result = [];
  const problems = [];
  const notes = [];
  if (units.length === 0) {
    result.push({ text: 'The Playground is empty. Drag a saved machine onto a tile.', ids: [] });
    return { result, problems, notes };
  }
  const name = (p) => MODULES[p.type].name;
  const nameCause = causeNamer(units, name);

  for (const unit of units) {
    const step = previews[unit.id];
    const who = unitLabel(unit);
    const desc = describe(unit.machine.parts, step, { rot: unit.rot, labelOf: name, nameCause, self: unit.id });
    for (const line of desc.result) {
      (line.good ? result : notes).push({ text: `${who}: ${line.text}`, ids: [unit.id], good: line.good });
    }
    for (const line of desc.problems) problems.push({ text: `${who}: ${line.text}`, ids: [unit.id] });
    for (const line of desc.notes) {
      if (line.kind === 'draw') notes.push({ text: `${who}: ${line.text}`, ids: [unit.id] });
    }
    for (const b of step.burns) {
      if (b.unit === unit.id) continue;
      const other = run.byId.get(b.unit);
      const part = other.machine.parts.find((p) => p.id === b.id);
      problems.push({ text: `${who}: working it now burns down the ${name(part)} in ${unitLabel(other)}.`, ids: [unit.id, other.id] });
    }

    // What the other machines have left on this one's tile.
    const tile = tileState(world, run.state.landed, unit.x, unit.y);
    for (const kind of LEFT) {
      const others = tile[kind].filter((c) => c.kind !== 'terrain' && c.unit !== unit.id).map((c) => c.unit);
      if (others.length === 0) continue;
      const by = list(others.map((id) => unitLabel(run.byId.get(id))));
      notes.push({ text: `${who} stands on a tile ${LEFT_VERB[kind]} by ${by}.`, ids: [unit.id, ...new Set(others)] });
    }
    if (tile.terrain?.hot) {
      notes.push({ text: `${who} stands on embers: every module in it is hot while it works, unless its tile is wet or sanded.`, ids: [unit.id] });
    }
  }
  return { result, problems, notes };
}
