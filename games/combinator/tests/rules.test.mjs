// The machine rules (src/core/machine.js), with no browser. Machines and worlds
// here are built inline so each test shows the exact layout it is about;
// numbers the rules are tuned on (charges, burn time, run length) are read back
// from the data tables rather than written down twice.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EXAMPLES, PLAYGROUND, PLAYGROUND_START } from '../src/data/world.js';
import { MODULES, TUNING } from '../src/data/modules.js';
import {
  areaTiles,
  connect,
  describe,
  describeRound,
  portsOf,
  runRound,
  testMachine,
  unitArea,
  unitView,
} from '../src/core/machine.js';

const build = (...parts) => parts.map(([type, x, y, rot = 0], i) => ({ id: `m${i}`, type, x, y, rot }));
const activeTurns = (sim, id) => sim.turns.filter((t) => t.active[id]).map((t) => t.turn);
const upTo = (n) => Array.from({ length: n }, (_, i) => i + 1);
const test1 = (parts, ground = null) => testMachine(parts, ground).sim;
const unit = (id, parts, x, y, rot = 0, name = id) => ({ id, machine: { name, parts }, x, y, rot });
const world = (terrain = {}) => ({ cols: 6, rows: 6, terrain });

// A tank feeding a sprinkler: wets its own tile and the four round it.
const SPRINKLER = build(['tank', 0, 1], ['bend', 1, 1], ['sprinkler', 1, 0]);

test('rotation turns the ports clockwise with the module', () => {
  const [pipe] = build(['pipe', 0, 0, 1]);
  assert.deepEqual(
    portsOf(pipe).map((p) => `${p.dir}:${p.side}`),
    ['in:N', 'out:S']
  );
});

test('touching ports link only when they carry the same flow, out to in', () => {
  const linked = connect(build(['tank', 0, 0], ['pipe', 1, 0])).ports;
  assert.equal(linked.get('m0:0').status, 'linked');
  assert.equal(linked.get('m1:0').status, 'linked');

  const wrongFlow = connect(build(['tank', 0, 0], ['shaft', 1, 0])).ports;
  assert.equal(wrongFlow.get('m0:0').status, 'mismatch');
  assert.equal(wrongFlow.get('m0:0').reason, 'flow');

  const bothOut = connect(build(['tank', 0, 0], ['tank', 1, 0, 2])).ports;
  assert.equal(bothOut.get('m0:0').reason, 'both-out');

  const wall = connect(build(['tank', 0, 0], ['sprinkler', 1, 0])).ports;
  assert.equal(wall.get('m0:0').status, 'open', 'a side with no port is just open');
});

test('a machine works only when a flow runs unbroken from a source to an effector', () => {
  assert.equal(test1(SPRINKLER).turns[0].active.m2, true);
  assert.equal(test1(build(['tank', 0, 1], ['sprinkler', 1, 0])).turns[0].active.m1, undefined);
});

test('sources run out after their charge', () => {
  const sim = test1(SPRINKLER);
  assert.deepEqual(activeTurns(sim, 'm2'), upTo(MODULES.tank.charge));
  assert.ok(sim.turns[MODULES.tank.charge - 1].events.some((e) => e.type === 'empty' && e.id === 'm0'));
});

test('an open input draws from the ground under the machine, and never runs out', () => {
  const pump = build(['spring', 0, 1], ['pump', 1, 1], ['pipe', 2, 1]);
  const sim = test1(pump, 'puddle');
  assert.deepEqual(activeTurns(sim, 'm1'), upTo(MODULES.spring.charge));
  assert.ok(sim.turns[0].draws.some((d) => d.id === 'm1' && d.flow === 'matter'));

  assert.equal(test1(pump).turns[0].active.m1, undefined, 'on bare ground there is no water to pump');
});

test("an open output spills onto the machine's tile", () => {
  const { round, unit: u } = testMachine(build(['tank', 0, 0]), null);
  assert.deepEqual(round.turns[0].units[u.id].spills.map((s) => s.flow), ['matter']);
  assert.equal(round.turns[0].tiles[`${u.x},${u.y}`].wet.length, 1);
});

test('a control lets its flow through only on a signal', () => {
  const gated = build(['tank', 0, 0], ['valve', 1, 0], ['pipe', 2, 0]);
  assert.equal(test1(gated).turns[0].active.m1, undefined);

  // Battery at A2 sends its signal up a wire corner into the valve's south port.
  const fed = [...gated, ...build(['battery', 0, 1], ['wireBend', 1, 1]).map((p) => ({ ...p, id: `s${p.id}` }))];
  assert.equal(test1(fed).turns[0].active.m1, true);
});

test('a loop with no source in it never switches itself on', () => {
  // Four carriers chasing each other round a square: every input is fed by an
  // output, and none of them is a source.
  const loop = build(['bend', 0, 0, 2], ['bend', 0, 1, 1], ['bend', 1, 1, 0], ['bend', 1, 0, 3]);
  const sim = test1(loop);
  assert.ok([...sim.net.ports.values()].every((p) => p.status === 'linked'), 'the square is closed');
  assert.deepEqual(sim.turns[0].active, {});
});

test('converters heat the cells round them, and wood in heat burns after the set number of turns', () => {
  const parts = build(['burner', 0, 1], ['engine', 1, 1], ['shaft', 2, 1], ['gear', 3, 1], ['fan', 3, 0]);
  const sim = test1(parts);
  assert.ok(sim.turns[0].tiles['2,1'].hot.some((c) => c.kind === 'waste' && c.id === 'm1'));
  assert.equal(sim.burntAfter.m2, TUNING.burnTurns);
  assert.deepEqual(activeTurns(sim, 'm4'), upTo(TUNING.burnTurns));
});

test('embers under a machine heat every module in it', () => {
  const sim = test1(build(['shaft', 5, 4]), 'embers');
  assert.equal(sim.burntAfter.m0, TUNING.burnTurns);
});

test("a machine's own sprinkler wets its tile, which turns heat inside it to steam", () => {
  // The shaft stands next to the engine's waste heat; the sprinkler wets the
  // whole machine while the tank lasts.
  const parts = build(
    ['burner', 0, 1], ['engine', 1, 1], ['shaft', 2, 1],
    ['tank', 4, 3], ['bend', 5, 3], ['sprinkler', 5, 2]
  );
  const sim = test1(parts);
  assert.equal(sim.turns[0].tiles['2,1'].steam, true);
  assert.equal(sim.burntAfter.m2, undefined, 'tank and burner run dry together, so the shaft never burns');
});

test('effect areas are measured from the machine’s tile, turned with module and machine', () => {
  const w = world();
  assert.deepEqual(areaTiles(w, 0, 0, 'front2', 'E'), [[1, 0], [2, 0]]);
  assert.equal(areaTiles(w, 0, 0, 'cross', 'N').length, 3, 'cut off at the edge of the world');

  // A fan turned east inside a machine that is itself turned a quarter: south.
  const fan = build(['fan', 0, 0, 1]);
  assert.deepEqual(unitArea(w, unit('u', fan, 2, 2, 1)).map(({ x, y }) => [x, y]), [[2, 3], [2, 4]]);
});

test('machines in a round touch each other through the tiles they share', () => {
  // A wooden shaft in embers burns alone, and survives next to a sprinkler.
  const w = world({ '2,2': 'embers' });
  const alone = runRound(w, [unit('a', build(['shaft', 0, 0]), 2, 2)]);
  assert.equal(alone.units.a.burntAfter.m0, TUNING.burnTurns);

  const together = runRound(w, [unit('a', build(['shaft', 0, 0]), 2, 2), unit('b', SPRINKLER, 1, 2)]);
  assert.equal(together.turns[0].tiles['2,2'].steam, true);
  assert.equal(
    together.units.a.burntAfter.m0,
    MODULES.tank.charge + TUNING.burnTurns,
    'the shaft is safe while the tank lasts, and burns once the water stops'
  );
  const { notes } = describeRound(w, [unit('a', build(['shaft', 0, 0]), 2, 2, 0, 'Log'), unit('b', SPRINKLER, 1, 2, 0, 'Wet')], together);
  assert.ok(notes.some((l) => /Log \(C3\) is wetted by Wet \(B3\) on turns 1–4/.test(l.text)), JSON.stringify(notes));
});

test('a round is the same every time, whatever order the machines are listed in', () => {
  const units = PLAYGROUND_START.map(([ex, x, y, rot], i) => unit(`u${i}`, build(...EXAMPLES[ex].parts), x, y, rot));
  const a = runRound(PLAYGROUND, units);
  const b = runRound(PLAYGROUND, [...units].reverse());
  for (const u of units) assert.deepEqual(unitView(a, u.id).turns, unitView(b, u.id).turns);
  assert.deepEqual(a.turns.map((t) => t.tiles), b.turns.map((t) => t.tiles));
});

test('every example machine does something on its own test ground, and the readout says what stops it', () => {
  for (const example of EXAMPLES) {
    const parts = build(...example.parts);
    const { result } = describe(parts, test1(parts, example.ground));
    assert.ok(result.some((line) => line.good), `${example.name} acts on the world`);
    assert.ok(result.some((line) => /Then it stops: /.test(line.text)), `${example.name} explains its stop`);
  }
});

test('the Steam Fan burns out on the Workbench but not beside the Tank Sprinkler on the Playground', () => {
  const fan = EXAMPLES.findIndex((e) => e.name === 'Steam Fan');
  const parts = build(...EXAMPLES[fan].parts);
  assert.ok(Object.keys(test1(parts).burntAfter).length > 0, 'burns on its own');

  const units = PLAYGROUND_START.map(([ex, x, y, rot], i) => unit(`u${i}`, build(...EXAMPLES[ex].parts), x, y, rot, EXAMPLES[ex].name));
  const round = runRound(PLAYGROUND, units);
  const placed = units[PLAYGROUND_START.findIndex(([ex]) => ex === fan)];
  assert.deepEqual(round.units[placed.id].burntAfter, {}, 'nothing burns next to the sprinkler');
  const { result } = describeRound(PLAYGROUND, units, round);
  assert.ok(result.some((l) => l.text.startsWith('Steam Fan') && /on turns 1–4/.test(l.text)), JSON.stringify(result));
});

test('the readout traces an idle effector back to the real cause', () => {
  const parts = build(['tank', 0, 1], ['shaft', 1, 1], ['sprinkler', 2, 1, 3]);
  const { problems } = describe(parts, test1(parts));
  assert.ok(problems.some((l) => /touch but can't connect: Matter meets Motion/.test(l.text)));
  assert.ok(problems.some((l) => /Sprinkler \(C2\) never runs/.test(l.text)));
});

test('a torch heats the tile in front of its machine', () => {
  // Turned a quarter, the torch takes heat from the west and faces east.
  const torch = build(['burner', 0, 1], ['torch', 1, 1, 1]);
  const { round, sim } = testMachine(torch, null);
  assert.ok(round.turns[0].tiles['3,2'].isHot, 'heats the tile east of the machine');
  assert.ok(describe(torch, sim).result.some((l) => /heats the tile east of the machine/.test(l.text)));
});
