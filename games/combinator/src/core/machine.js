// The machine rules: how the modules inside a machine connect, how flows run
// through them turn by turn, what each machine does to the tiles of the world
// it stands in, and the plain-language readout. Pure functions over plain data
// — no Phaser, no scene state — so the same rules drive both screens, the
// readouts and the tests, and a round is always the same for the same layout.
//
// Two grids, two kinds of placement:
//  - a part is a module inside a machine, on the Workbench grid:
//    { id, type, x, y, rot }. A port's side is where it sits on its cell once
//    the module is rotated; two parts connect when their touching ports carry
//    the same flow and one is an output, the other an input.
//  - a unit is a whole machine standing on one tile of a world (the
//    Playground, or the small test world round the Workbench):
//    { id, machine: { name, parts }, x, y, rot }.

import { TERRAIN, WORKBENCH } from '../data/world.js';
import { MODULES, TUNING } from '../data/modules.js';

export const SIDES = ['N', 'E', 'S', 'W'];
const STEP = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };

export const FLOW_NAMES = { motion: 'Motion', matter: 'Matter', heat: 'Heat', signal: 'Signal' };
export const SIDE_WORDS = { N: 'north', E: 'east', S: 'south', W: 'west' };

export const tileKey = (x, y) => `${x},${y}`;
export const tileName = (x, y) => `${String.fromCharCode(65 + x)}${y + 1}`;

export function rotateSide(side, rot) {
  return SIDES[(SIDES.indexOf(side) + (((rot % 4) + 4) % 4)) % 4];
}

export function opposite(side) {
  return SIDES[(SIDES.indexOf(side) + 2) % 4];
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

// A part named by where it sits on the Workbench.
export function label(p) {
  return `${MODULES[p.type].name} (${tileName(p.x, p.y)})`;
}

// A machine named by where it stands in the world.
export function unitLabel(unit) {
  return `${unit.machine.name} (${tileName(unit.x, unit.y)})`;
}

// The module's ports with their sides turned to where they actually face.
export function portsOf(p) {
  return MODULES[p.type].ports.map((port, index) => ({
    key: `${p.id}:${index}`,
    id: p.id,
    index,
    side: rotateSide(port.side, p.rot),
    dir: port.dir,
    flow: port.flow,
  }));
}

export function canPlace(grid, placements, x, y, ignoreId = null) {
  if (!onGrid(grid, x, y)) return false;
  return !placements.some((p) => p.id !== ignoreId && p.x === x && p.y === y);
}

// --- Effects in the world ----------------------------------------------------

// Which way an effector inside a machine faces in the world: its own turn on
// the Workbench plus the machine's turn on its tile. At rotation 0 an effector
// faces north, away from its input.
export function effectFront(part, machineRot = 0) {
  return rotateSide('N', part.rot + machineRot);
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
    for (const [x, y] of areaTiles(world, unit.x, unit.y, def.effect.area, effectFront(part, unit.rot))) {
      out.push({ x, y, kind: def.effect.kind });
    }
  }
  return out;
}

// --- Connections inside a machine --------------------------------------------

// Every port's link status. 'linked' has a partner port; 'open' faces an empty
// cell, the edge of the Workbench or a side of a module with no port there;
// 'mismatch' touches a port it can't connect to. An open or mismatched port
// behaves the same way in a run — it spills or draws on the machine's tile —
// the difference is only that a mismatch is almost always a mistake, so the
// screen flags it.
export function connect(parts, grid = WORKBENCH) {
  const at = new Map(parts.map((p) => [tileKey(p.x, p.y), p]));
  const ports = new Map();
  for (const p of parts) {
    for (const port of portsOf(p)) {
      const [nx, ny] = neighbour(p.x, p.y, port.side);
      const info = { ...port, x: p.x, y: p.y, status: 'open', edge: !onGrid(grid, nx, ny) };
      const q = info.edge ? null : at.get(tileKey(nx, ny));
      const other = q && portsOf(q).find((o) => o.side === opposite(port.side));
      if (other) {
        info.partner = other.key;
        info.partnerId = q.id;
        if (other.flow === port.flow && other.dir !== port.dir) {
          info.status = 'linked';
        } else {
          info.status = 'mismatch';
          info.reason = other.flow !== port.flow ? 'flow' : `both-${port.dir}`;
        }
      }
      ports.set(port.key, info);
    }
  }
  return { ports };
}

// --- The round ---------------------------------------------------------------

function addCause(tiles, key, kind, cause) {
  const tile = (tiles[key] ??= { hot: [], wet: [], air: [], alert: [] });
  tile[kind].push(cause);
}

// One machine's flows for one turn, settled as a fixed point that starts with
// everything off, so a loop with no source in it never switches itself on and
// the order modules are listed in can't change the result. Effects land on the
// world's tiles; waste heat stays inside the machine, on the cells round the
// converter.
function settle(unit, state, tiles, world) {
  const { parts, net, charge, ground } = state;
  const present = parts.filter((p) => state.burntAfter[p.id] === undefined);
  const presentIds = new Set(present.map((p) => p.id));
  const active = {};

  const inputCarries = (port) => {
    const info = net.ports.get(port.key);
    if (info.status === 'linked') return presentIds.has(info.partnerId) && !!active[info.partnerId];
    return ground?.provides === port.flow;
  };

  let changed = true;
  while (changed) {
    changed = false;
    for (const p of present) {
      if (active[p.id]) continue;
      const def = MODULES[p.type];
      const on =
        def.role === 'source'
          ? charge[p.id] > 0
          : portsOf(p).filter((port) => port.dir === 'in').every(inputCarries);
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
        if (carrying[port.key] && info.status !== 'linked') draws.push({ key: port.key, id: p.id, flow: port.flow });
      }
    }
  }

  const inner = {};
  const here = tileKey(unit.x, unit.y);
  for (const p of present) {
    if (!active[p.id]) continue;
    const def = MODULES[p.type];
    if (def.kind === 'converter') {
      for (const side of SIDES) {
        const [x, y] = neighbour(p.x, p.y, side);
        if (onGrid(WORKBENCH, x, y)) (inner[tileKey(x, y)] ??= []).push({ kind: 'waste', unit: unit.id, id: p.id });
      }
    }
    if (def.effect) {
      const front = effectFront(p, unit.rot);
      for (const [x, y] of areaTiles(world, unit.x, unit.y, def.effect.area, front)) {
        addCause(tiles, tileKey(x, y), def.effect.kind, { kind: 'effect', unit: unit.id, id: p.id, front });
      }
    }
  }
  for (const spill of spills) {
    const kind = spill.flow === 'matter' ? 'wet' : spill.flow === 'heat' ? 'hot' : null;
    if (kind) addCause(tiles, here, kind, { kind: 'spill', unit: unit.id, id: spill.id });
  }

  return { present: [...presentIds], active, carrying, draws, spills, inner, charge: { ...charge } };
}

// What each cell inside a machine feels this turn: its own waste heat, plus
// whatever lands on the machine's tile in the world. Water on the tile wets
// every module in the machine, which is how a sprinkler cools its neighbours.
function cellsOf(unit, inner, tiles) {
  const world = tiles[tileKey(unit.x, unit.y)];
  const cells = {};
  for (let y = 0; y < WORKBENCH.rows; y++) {
    for (let x = 0; x < WORKBENCH.cols; x++) {
      const key = tileKey(x, y);
      const hot = [...(inner[key] ?? []), ...(world?.hot ?? [])];
      const wet = world?.wet ?? [];
      if (hot.length === 0 && wet.length === 0) continue;
      const steam = hot.length > 0 && wet.length > 0;
      cells[key] = { hot, wet, steam, isHot: hot.length > 0 && !steam };
    }
  }
  return cells;
}

// Play a round: every unit in the world, `tuning.turns` turns. Each turn the
// machines settle their flows and act on the world, the world's tiles settle
// (a tile both wet and hot steams instead of being hot), and then sources
// spend a turn of charge and wooden modules that have stood in heat too long
// burn. Machines touch each other only through the world's tiles.
export function runRound(world, units, tuning = TUNING) {
  const states = new Map();
  for (const unit of units) {
    const charge = {};
    const streak = {};
    for (const p of unit.machine.parts) {
      const def = MODULES[p.type];
      if (def.role === 'source') charge[p.id] = def.charge;
      streak[p.id] = 0;
    }
    states.set(unit.id, {
      parts: unit.machine.parts,
      net: connect(unit.machine.parts),
      ground: terrainAt(world, unit.x, unit.y),
      charge,
      streak,
      burntAfter: {},
    });
  }

  const turns = [];
  for (let turn = 1; turn <= tuning.turns; turn++) {
    const tiles = {};
    for (const [key, id] of Object.entries(world.terrain ?? {})) {
      if (TERRAIN[id].hot) addCause(tiles, key, 'hot', { kind: 'terrain', terrain: id });
    }
    const records = {};
    for (const unit of units) records[unit.id] = settle(unit, states.get(unit.id), tiles, world);
    // Water puts heat out: a tile that is both wet and hot this turn steams
    // instead of staying hot.
    for (const tile of Object.values(tiles)) {
      tile.steam = tile.hot.length > 0 && tile.wet.length > 0;
      tile.isHot = tile.hot.length > 0 && !tile.steam;
    }

    for (const unit of units) {
      const state = states.get(unit.id);
      const record = records[unit.id];
      record.turn = turn;
      record.tiles = cellsOf(unit, record.inner, tiles);
      delete record.inner;
      record.events = [];
      for (const p of state.parts) {
        if (!record.present.includes(p.id)) continue;
        if (MODULES[p.type].role === 'source' && state.charge[p.id] > 0) {
          state.charge[p.id] -= 1;
          if (state.charge[p.id] === 0) record.events.push({ type: 'empty', id: p.id });
        }
      }
      for (const p of state.parts) {
        if (!record.present.includes(p.id) || MODULES[p.type].material !== 'wood') continue;
        const cell = record.tiles[tileKey(p.x, p.y)];
        state.streak[p.id] = cell?.isHot ? state.streak[p.id] + 1 : 0;
        if (state.streak[p.id] >= tuning.burnTurns) {
          state.burntAfter[p.id] = turn;
          record.events.push({ type: 'burn', id: p.id, causes: cell.hot });
        }
      }
      record.streak = { ...state.streak };
    }
    turns.push({ turn, tiles, units: records });
  }

  const out = {};
  for (const [id, s] of states) out[id] = { net: s.net, burntAfter: s.burntAfter, ground: s.ground };
  return { turns, units: out };
}

// One machine's side of a round, turn by turn: { net, burntAfter, ground,
// turns: [record] }, where each record says which parts are present and
// running, what each port carries, and what each cell feels.
export function unitView(round, unitId) {
  const u = round.units[unitId];
  return { ...u, turns: round.turns.map((t) => t.units[unitId]) };
}

// The Workbench tests a machine on its own, standing on one chosen ground in
// the middle of a small world, so the screen can show what it does round it.
export const BENCH_UNIT = 'bench';
export const TEST_WORLD = { cols: 5, rows: 5, at: [2, 2] };

export function testWorld(ground) {
  const [x, y] = TEST_WORLD.at;
  return { cols: TEST_WORLD.cols, rows: TEST_WORLD.rows, terrain: ground ? { [tileKey(x, y)]: ground } : {} };
}

export function testMachine(parts, ground, tuning = TUNING) {
  const world = testWorld(ground);
  const [x, y] = TEST_WORLD.at;
  const unit = { id: BENCH_UNIT, machine: { name: 'This machine', parts }, x, y, rot: 0 };
  const round = runRound(world, [unit], tuning);
  return { world, unit, round, sim: unitView(round, BENCH_UNIT) };
}

// --- Plain-language readout --------------------------------------------------

const EFFECT_VERB = {
  wet: 'wets',
  air: 'blows air onto',
  hot: 'heats',
  alert: 'rings over',
};

export function areaText(area, front) {
  if (area === 'cross') return "the machine's tile and the 4 around it";
  if (area === 'front1') return `the tile ${SIDE_WORDS[front]} of the machine`;
  return `the 2 tiles ${SIDE_WORDS[front]} of the machine`;
}

function ranges(list) {
  const out = [];
  let start = null;
  let prev = null;
  for (const n of list) {
    if (start === null) start = n;
    else if (n !== prev + 1) {
      out.push(start === prev ? `${start}` : `${start}–${prev}`);
      start = n;
    }
    prev = n;
  }
  if (start !== null) out.push(start === prev ? `${start}` : `${start}–${prev}`);
  return out.join(', ');
}

export function turnsText(list, last) {
  if (list.length === last) return 'on every turn';
  return `on turn${list.length === 1 ? '' : 's'} ${ranges(list)}`;
}

// Names whatever made a tile hot or wet, as seen from inside unit `selfId`:
// its own modules by name, anyone else's as "Torch in Hot Box (C4)".
export function causeNamer(units, labelOf = label) {
  const byUnit = new Map(units.map((u) => [u.id, u]));
  return (cause, selfId) => {
    if (cause.kind === 'terrain') return `the ${TERRAIN[cause.terrain].name.toLowerCase()} under the machine`;
    const unit = byUnit.get(cause.unit);
    const part = unit.machine.parts.find((p) => p.id === cause.id);
    const own = cause.unit === selfId;
    const who = own ? labelOf(part) : `${MODULES[part.type].name} in ${unitLabel(unit)}`;
    if (cause.kind === 'waste') return `waste heat from ${who}`;
    if (cause.kind === 'spill') return `heat spilling out of ${who}`;
    return who;
  };
}

// Why a part isn't running on a given turn, followed upstream to the first
// thing that is actually wrong, so the answer names the cause rather than the
// next pipe along.
export function whyIdle(parts, sim, id, turn, labelOf = label) {
  const byId = new Map(parts.map((p) => [p.id, p]));
  const seen = new Set();
  const walk = (partId) => {
    const p = byId.get(partId);
    const def = MODULES[p.type];
    const record = sim.turns[turn - 1];
    if (sim.burntAfter[partId] !== undefined && sim.burntAfter[partId] < turn) {
      return `${labelOf(p)} burnt down after turn ${sim.burntAfter[partId]}`;
    }
    if (def.role === 'source') {
      const ranDry = sim.turns.find((t) => t.events.some((e) => e.type === 'empty' && e.id === partId));
      return `${labelOf(p)} ran dry after turn ${ranDry.turn}`;
    }
    if (seen.has(partId)) return 'its flow only goes round in a loop, with no source feeding it';
    seen.add(partId);
    // The part asked about is "its"; anything further upstream is named.
    const whose = partId === id ? 'its' : `${labelOf(p)}'s`;
    for (const port of portsOf(p)) {
      if (port.dir !== 'in' || record.carrying[port.key]) continue;
      const info = sim.net.ports.get(port.key);
      const flow = FLOW_NAMES[port.flow];
      if (info.status === 'linked') return walk(info.partnerId);
      if (info.status === 'mismatch') {
        const other = sim.net.ports.get(info.partner);
        return `${whose} ${flow} input touches ${labelOf(byId.get(info.partnerId))}'s ${FLOW_NAMES[other.flow]} ${other.dir}put, and they can't connect`;
      }
      const ground = sim.ground;
      const where = ground
        ? `the ${ground.name.toLowerCase()} under the machine gives no ${flow}`
        : `the bare ground under the machine has no ${flow} to give`;
      return `${whose} ${flow} input isn't connected, and ${where}`;
    }
    return "it isn't getting what it needs";
  };
  return walk(id);
}

// What one machine does, what is wrong with it, and what else is worth
// knowing, as sentences. Each line carries the part ids it is about so the
// Workbench can point at them.
//   opts.rot      the machine's turn in the world (directions in the text)
//   opts.labelOf  how a part is named
//   opts.nameCause, opts.self  how a burn's causes are named (causeNamer)
export function describe(parts, sim, opts = {}) {
  const { rot = 0, labelOf = label, self = BENCH_UNIT } = opts;
  const nameCause =
    opts.nameCause ?? causeNamer([{ id: self, machine: { parts }, x: 0, y: 0 }], labelOf);
  const result = [];
  const problems = [];
  const notes = [];
  const byId = new Map(parts.map((p) => [p.id, p]));
  const last = sim.turns.length;

  if (parts.length === 0) {
    result.push({ text: 'The Workbench is empty. Drag a module from the left onto a cell to start a machine.', ids: [] });
    return { result, problems, notes };
  }

  const effectors = parts.filter((p) => MODULES[p.type].role === 'effector');
  if (effectors.length === 0) {
    result.push({
      text: 'Nothing acts on the world yet. A machine needs an effector (Sprinkler, Fan, Torch or Bell) fed from a source.',
      ids: [],
    });
  }
  for (const p of effectors) {
    const def = MODULES[p.type];
    const on = sim.turns.filter((t) => t.active[p.id]).map((t) => t.turn);
    const what = `${labelOf(p)} ${EFFECT_VERB[def.effect.kind]} ${areaText(def.effect.area, effectFront(p, rot))}`;
    if (on.length === 0) {
      problems.push({ text: `${labelOf(p)} never runs: ${whyIdle(parts, sim, p.id, 1, labelOf)}.`, ids: [p.id] });
      continue;
    }
    let text = `${what} ${turnsText(on, last)}.`;
    const stop = on[on.length - 1];
    if (stop < last) text += ` Then it stops: ${whyIdle(parts, sim, p.id, stop + 1, labelOf)}.`;
    result.push({ text, ids: [p.id], good: true, on });
  }

  const pairs = new Set();
  for (const info of sim.net.ports.values()) {
    if (info.status !== 'mismatch') continue;
    const pair = [info.key, info.partner].sort().join('|');
    if (pairs.has(pair)) continue;
    pairs.add(pair);
    const other = sim.net.ports.get(info.partner);
    const why =
      info.reason === 'flow'
        ? `${FLOW_NAMES[info.flow]} meets ${FLOW_NAMES[other.flow]}`
        : `two ${info.dir}puts face each other`;
    problems.push({
      text: `${labelOf(byId.get(info.id))} and ${labelOf(byId.get(info.partnerId))} touch but can't connect: ${why}.`,
      ids: [info.id, info.partnerId],
      kind: 'mismatch',
    });
  }

  for (const record of sim.turns) {
    for (const event of record.events) {
      const p = byId.get(event.id);
      if (event.type === 'burn') {
        const causes = [...new Set(event.causes.map((c) => nameCause(c, self)))].join(' and ');
        problems.push({
          text: `${labelOf(p)} is wooden and burns down after turn ${record.turn}, from ${causes}.`,
          ids: [p.id],
          kind: 'burn',
        });
      } else if (event.type === 'empty') {
        notes.push({ text: `${labelOf(p)} runs dry after turn ${record.turn}.`, ids: [p.id], kind: 'empty' });
      }
    }
  }

  const spilled = new Set();
  const drew = new Set();
  const wasted = new Set();
  for (const record of sim.turns) {
    for (const spill of record.spills) {
      if (spilled.has(spill.key)) continue;
      spilled.add(spill.key);
      const p = byId.get(spill.id);
      const flow = FLOW_NAMES[spill.flow];
      const effect =
        spill.flow === 'matter'
          ? "onto the machine's tile and wets it"
          : spill.flow === 'heat'
            ? "onto the machine's tile and heats it"
            : 'and goes to waste';
      notes.push({ text: `${labelOf(p)} has an open ${flow} output: it spills ${effect}.`, ids: [p.id], kind: 'spill' });
    }
    for (const draw of record.draws) {
      if (drew.has(draw.key)) continue;
      drew.add(draw.key);
      const p = byId.get(draw.id);
      notes.push({
        text: `${labelOf(p)} draws ${FLOW_NAMES[draw.flow]} from the ${sim.ground.name.toLowerCase()} under the machine, which never runs out.`,
        ids: [p.id],
        kind: 'draw',
      });
    }
    for (const p of parts) {
      if (!record.active[p.id] || MODULES[p.type].kind !== 'converter' || wasted.has(p.id)) continue;
      wasted.add(p.id);
      notes.push({
        text: `${labelOf(p)} gives off waste heat onto the cells around it while it runs.`,
        ids: [p.id],
        kind: 'waste',
      });
    }
  }

  return { result, problems, notes };
}

const TOUCH_VERB = { wet: 'is wetted by', hot: 'is heated by' };

// The whole round in the world, machine by machine. Lines carry unit ids. The
// Workbench's own concerns (ports that don't meet, spills, waste heat) are
// left to the Workbench; what is said here is what each machine does where it
// stands, what wrecks it, and what the machines do to each other.
export function describeRound(world, units, round) {
  const result = [];
  const problems = [];
  const notes = [];
  if (units.length === 0) {
    result.push({ text: 'The Playground is empty. Drag a saved machine from the left onto a tile.', ids: [] });
    return { result, problems, notes };
  }
  const name = (p) => MODULES[p.type].name;
  const nameCause = causeNamer(units, name);
  const last = round.turns.length;

  for (const unit of units) {
    const sim = unitView(round, unit.id);
    const who = unitLabel(unit);
    const desc = describe(unit.machine.parts, sim, { rot: unit.rot, labelOf: name, nameCause, self: unit.id });
    for (const line of desc.result) {
      (line.good ? result : notes).push({ text: `${who}: ${line.text}`, ids: [unit.id], good: line.good });
    }
    for (const line of desc.problems) {
      if (line.kind === 'mismatch') continue;
      problems.push({ text: `${who}: ${line.text}`, ids: [unit.id] });
    }
    for (const line of desc.notes) {
      if (line.kind === 'draw') notes.push({ text: `${who}: ${line.text}`, ids: [unit.id] });
    }

    // What the other machines do to this one's tile.
    const touched = new Map();
    for (const t of round.turns) {
      const tile = t.tiles[tileKey(unit.x, unit.y)];
      if (!tile) continue;
      for (const kind of ['wet', 'hot']) {
        for (const cause of tile[kind]) {
          if (cause.kind === 'terrain' || cause.unit === unit.id) continue;
          const key = `${kind}|${cause.unit}`;
          if (!touched.has(key)) touched.set(key, { kind, unit: cause.unit, turns: new Set() });
          touched.get(key).turns.add(t.turn);
        }
      }
    }
    for (const { kind, unit: otherId, turns } of touched.values()) {
      const other = units.find((u) => u.id === otherId);
      notes.push({
        text: `${who} ${TOUCH_VERB[kind]} ${unitLabel(other)} ${turnsText([...turns].sort((a, b) => a - b), last)}.`,
        ids: [unit.id, otherId],
      });
    }
    if (sim.ground?.hot) {
      notes.push({
        text: `${who} stands on embers: every module in it is hot unless its tile is wet.`,
        ids: [unit.id],
      });
    }
  }
  return { result, problems, notes };
}
