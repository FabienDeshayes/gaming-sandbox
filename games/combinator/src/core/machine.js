// The machine rules: how placed modules connect, how flows run through them
// turn by turn, and what the result does to the bench. Pure functions over
// plain data — no Phaser, no scene state — so the same rules drive the screen,
// the readout and the tests, and a run is always the same for the same build.
//
// A placement is { id, type, x, y, rot }. A port's side is where it sits on its
// tile once the module is rotated; two modules connect when their touching
// ports carry the same flow and one is an output, the other an input.

import { TERRAIN } from '../data/bench.js';
import { MODULES, TUNING } from '../data/modules.js';

export const SIDES = ['N', 'E', 'S', 'W'];
const STEP = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };

export const FLOW_NAMES = { motion: 'Motion', matter: 'Matter', heat: 'Heat', signal: 'Signal' };

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

export function onBench(bench, x, y) {
  return x >= 0 && y >= 0 && x < bench.cols && y < bench.rows;
}

export function terrainAt(bench, x, y) {
  const id = bench.terrain[tileKey(x, y)];
  return id ? { id, ...TERRAIN[id] } : null;
}

export function label(p) {
  return `${MODULES[p.type].name} (${tileName(p.x, p.y)})`;
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

// The tiles an effector acts on: 'cross' is its own tile and the four around
// it; 'front1'/'front2' reach one or two tiles out of its front (north at
// rotation 0, so opposite its input). Off-bench tiles are dropped.
export function effectTiles(bench, p) {
  const def = MODULES[p.type];
  if (!def.effect) return [];
  const tiles = [];
  const front = rotateSide('N', p.rot);
  if (def.effect.area === 'cross') {
    tiles.push([p.x, p.y]);
    for (const side of SIDES) tiles.push(neighbour(p.x, p.y, side));
  } else {
    const reach = def.effect.area === 'front2' ? 2 : 1;
    let [x, y] = [p.x, p.y];
    for (let i = 0; i < reach; i++) {
      [x, y] = neighbour(x, y, front);
      tiles.push([x, y]);
    }
  }
  return tiles.filter(([x, y]) => onBench(bench, x, y));
}

export function canPlace(bench, placements, x, y, ignoreId = null) {
  if (!onBench(bench, x, y)) return false;
  return !placements.some((p) => p.id !== ignoreId && p.x === x && p.y === y);
}

// Every port's link status. 'linked' has a partner port; 'open' faces an empty
// tile, the bench edge or a side of a module with no port there; 'mismatch'
// touches a port it can't connect to. An open or mismatched port behaves the
// same way in a run — it spills or draws on its own tile — the difference is
// only that a mismatch is almost always a mistake, so the screen flags it.
export function connect(bench, placements) {
  const at = new Map(placements.map((p) => [tileKey(p.x, p.y), p]));
  const ports = new Map();
  for (const p of placements) {
    for (const port of portsOf(p)) {
      const [nx, ny] = neighbour(p.x, p.y, port.side);
      const info = { ...port, x: p.x, y: p.y, status: 'open', edge: !onBench(bench, nx, ny) };
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

function addTile(tiles, key, kind, cause) {
  const tile = (tiles[key] ??= { hot: [], wet: [], air: [], alert: [] });
  tile[kind].push(cause);
}

// Run the machine for `tuning.turns` turns. Each turn: flows settle (a fixed
// point that starts with everything off, so a loop with no source in it never
// switches itself on), the result lands on the tiles, then sources spend a
// turn of charge and wooden modules that have stood in heat too long burn.
export function simulate(bench, placements, tuning = TUNING) {
  const net = connect(bench, placements);
  const charge = {};
  const burntAfter = {};
  const streak = {};
  for (const p of placements) {
    const def = MODULES[p.type];
    if (def.role === 'source') charge[p.id] = def.charge;
    streak[p.id] = 0;
  }

  const turns = [];
  for (let turn = 1; turn <= tuning.turns; turn++) {
    const present = placements.filter((p) => burntAfter[p.id] === undefined);
    const presentIds = new Set(present.map((p) => p.id));
    const chargeAtStart = { ...charge };
    const active = {};

    const inputCarries = (p, port) => {
      const info = net.ports.get(port.key);
      if (info.status === 'linked') return presentIds.has(info.partnerId) && !!active[info.partnerId];
      return terrainAt(bench, p.x, p.y)?.provides === port.flow;
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
            : portsOf(p).filter((port) => port.dir === 'in').every((port) => inputCarries(p, port));
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
          carrying[port.key] = inputCarries(p, port);
          if (carrying[port.key] && info.status !== 'linked') draws.push({ key: port.key, id: p.id, flow: port.flow });
        }
      }
    }

    const tiles = {};
    for (const [key, id] of Object.entries(bench.terrain)) {
      if (TERRAIN[id].hot) addTile(tiles, key, 'hot', { kind: 'terrain', terrain: id });
    }
    for (const p of present) {
      if (!active[p.id]) continue;
      const def = MODULES[p.type];
      if (def.kind === 'converter') {
        for (const side of SIDES) {
          const [x, y] = neighbour(p.x, p.y, side);
          if (onBench(bench, x, y)) addTile(tiles, tileKey(x, y), 'hot', { kind: 'waste', id: p.id });
        }
      }
      if (def.effect) {
        for (const [x, y] of effectTiles(bench, p)) {
          addTile(tiles, tileKey(x, y), def.effect.kind, { kind: 'effect', id: p.id });
        }
      }
    }
    const byId = new Map(present.map((p) => [p.id, p]));
    for (const spill of spills) {
      const p = byId.get(spill.id);
      const kind = spill.flow === 'matter' ? 'wet' : spill.flow === 'heat' ? 'hot' : null;
      if (kind) addTile(tiles, tileKey(p.x, p.y), kind, { kind: 'spill', id: p.id });
    }
    // Water puts heat out: a tile that is both wet and hot this turn steams
    // instead of staying hot.
    for (const tile of Object.values(tiles)) {
      tile.steam = tile.hot.length > 0 && tile.wet.length > 0;
      tile.isHot = tile.hot.length > 0 && !tile.steam;
    }

    const events = [];
    for (const p of present) {
      if (MODULES[p.type].role === 'source' && charge[p.id] > 0) {
        charge[p.id] -= 1;
        if (charge[p.id] === 0) events.push({ type: 'empty', id: p.id });
      }
    }
    for (const p of present) {
      if (MODULES[p.type].material !== 'wood') continue;
      const tile = tiles[tileKey(p.x, p.y)];
      streak[p.id] = tile?.isHot ? streak[p.id] + 1 : 0;
      if (streak[p.id] >= tuning.burnTurns) {
        burntAfter[p.id] = turn;
        events.push({ type: 'burn', id: p.id, causes: tile.hot });
      }
    }

    turns.push({
      turn,
      present: [...presentIds],
      active,
      carrying,
      draws,
      spills,
      tiles,
      charge: chargeAtStart,
      events,
      streak: { ...streak },
    });
  }

  return { net, turns, burntAfter };
}

// --- Plain-language readout --------------------------------------------------

const EFFECT_VERB = {
  wet: 'wets',
  air: 'blows air onto',
  heat: 'heats',
  alert: 'rings over',
};

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

function causeText(cause, byId) {
  if (cause.kind === 'terrain') return 'the embers under it';
  const p = byId.get(cause.id);
  if (cause.kind === 'waste') return `waste heat from ${label(p)}`;
  if (cause.kind === 'spill') return `heat spilling out of ${label(p)}`;
  return `${label(p)}`;
}

// Why a module isn't running on a given turn, followed upstream to the first
// thing that is actually wrong, so the answer names the cause rather than the
// next pipe along.
export function whyIdle(bench, placements, sim, id, turn) {
  const byId = new Map(placements.map((p) => [p.id, p]));
  const seen = new Set();
  const walk = (moduleId) => {
    const p = byId.get(moduleId);
    const def = MODULES[p.type];
    const record = sim.turns[turn - 1];
    if (sim.burntAfter[moduleId] !== undefined && sim.burntAfter[moduleId] < turn) {
      return `${label(p)} burnt down after turn ${sim.burntAfter[moduleId]}`;
    }
    if (def.role === 'source') {
      const ranDry = sim.turns.find((t) => t.events.some((e) => e.type === 'empty' && e.id === moduleId));
      return `${label(p)} ran dry after turn ${ranDry.turn}`;
    }
    if (seen.has(moduleId)) return 'its flow only goes round in a loop, with no source feeding it';
    seen.add(moduleId);
    // The module asked about is "its"; anything further upstream is named.
    const whose = moduleId === id ? 'its' : `${label(p)}'s`;
    for (const port of portsOf(p)) {
      if (port.dir !== 'in' || record.carrying[port.key]) continue;
      const info = sim.net.ports.get(port.key);
      const flow = FLOW_NAMES[port.flow];
      if (info.status === 'linked') return walk(info.partnerId);
      if (info.status === 'mismatch') {
        const other = sim.net.ports.get(info.partner);
        return `${whose} ${flow} input touches ${label(byId.get(info.partnerId))}'s ${FLOW_NAMES[other.flow]} ${other.dir}put, and they can't connect`;
      }
      const ground = terrainAt(bench, p.x, p.y);
      const where = ground ? `the ${ground.name.toLowerCase()} under it gives no ${flow}` : `${tileName(p.x, p.y)} has no ${flow} to draw from`;
      return `${whose} ${flow} input isn't connected, and ${where}`;
    }
    return 'it isn\'t getting what it needs';
  };
  return walk(id);
}

// What the machine does, what is wrong with it, and what else is worth knowing,
// as sentences. Each line carries the module ids it is about so the screen can
// point at them.
export function describe(bench, placements, sim) {
  const result = [];
  const problems = [];
  const notes = [];
  const byId = new Map(placements.map((p) => [p.id, p]));
  const last = sim.turns.length;

  if (placements.length === 0) {
    result.push({ text: 'The bench is empty. Drag a module from the left onto a tile to start a machine.', ids: [] });
    return { result, problems, notes };
  }

  const effectors = placements.filter((p) => MODULES[p.type].role === 'effector');
  if (effectors.length === 0) {
    result.push({
      text: 'Nothing acts on the world yet. A machine needs an effector (Sprinkler, Fan, Torch or Bell) fed from a source.',
      ids: [],
    });
  }
  for (const p of effectors) {
    const def = MODULES[p.type];
    const on = sim.turns.filter((t) => t.active[p.id]).map((t) => t.turn);
    const count = effectTiles(bench, p).length;
    const what = `${label(p)} ${EFFECT_VERB[def.effect.kind]} ${count} tile${count === 1 ? '' : 's'}`;
    if (on.length === 0) {
      problems.push({ text: `${label(p)} never runs: ${whyIdle(bench, placements, sim, p.id, 1)}.`, ids: [p.id] });
      continue;
    }
    let text = on.length === last ? `${what} on every turn of the test.` : `${what} on turn${on.length === 1 ? '' : 's'} ${ranges(on)}.`;
    const stop = on[on.length - 1];
    if (stop < last) text += ` Then it stops: ${whyIdle(bench, placements, sim, p.id, stop + 1)}.`;
    result.push({ text, ids: [p.id], good: true });
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
      text: `${label(byId.get(info.id))} and ${label(byId.get(info.partnerId))} touch but can't connect: ${why}.`,
      ids: [info.id, info.partnerId],
    });
  }

  for (const record of sim.turns) {
    for (const event of record.events) {
      const p = byId.get(event.id);
      if (event.type === 'burn') {
        const causes = [...new Set(event.causes.map((c) => causeText(c, byId)))].join(' and ');
        problems.push({
          text: `${label(p)} is wooden and burns down after turn ${record.turn}, from ${causes}.`,
          ids: [p.id],
        });
      } else if (event.type === 'empty') {
        notes.push({ text: `${label(p)} runs dry after turn ${record.turn}.`, ids: [p.id] });
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
        spill.flow === 'matter' ? 'and wets it' : spill.flow === 'heat' ? 'and heats it' : 'where it goes to waste';
      notes.push({ text: `${label(p)} has an open ${flow} output: it spills onto its own tile ${effect}.`, ids: [p.id] });
    }
    for (const draw of record.draws) {
      if (drew.has(draw.key)) continue;
      drew.add(draw.key);
      const p = byId.get(draw.id);
      const ground = terrainAt(bench, p.x, p.y);
      notes.push({
        text: `${label(p)} draws ${FLOW_NAMES[draw.flow]} from the ${ground.name.toLowerCase()} under it, which never runs out.`,
        ids: [p.id],
      });
    }
    for (const p of placements) {
      if (!record.active[p.id] || MODULES[p.type].kind !== 'converter' || wasted.has(p.id)) continue;
      wasted.add(p.id);
      notes.push({ text: `${label(p)} gives off waste heat onto the 4 tiles around it while it runs.`, ids: [p.id] });
    }
  }

  return { result, problems, notes };
}
