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
  runRound,
  testMachine,
  unitArea,
  unitView,
} from '../src/core/machine.js';

const build = (...types) => types.map((type, i) => ({ id: `m${i}`, type }));
const activeTurns = (sim, id) => sim.turns.filter((t) => t.active[id]).map((t) => t.turn);
const upTo = (n) => Array.from({ length: n }, (_, i) => i + 1);
const test1 = (parts, ground = null) => testMachine(parts, ground).sim;
const unit = (id, parts, x, y, rot = 0, name = id) => ({ id, machine: { name, parts }, x, y, rot });
const world = (terrain = {}) => ({ cols: 6, rows: 6, terrain });

// A tank feeding a sprinkler: wets its own tile and the four round it.
const SPRINKLER = build('tank', 'sprinkler');

test('an input takes the nearest untaken flow of its kind from its left', () => {
  const ports = connect(build('tank', 'tank', 'sprinkler', 'sprinkler')).ports;
  assert.equal(ports.get('m2:0').partnerId, 'm1', 'the nearer tank feeds the first sprinkler');
  assert.equal(ports.get('m3:0').partnerId, 'm0', 'and the next sprinkler takes the one left over');

  const passing = connect(build('battery', 'tank', 'valve')).ports;
  assert.equal(passing.get('m2:1').partnerId, 'm0', 'a flow passes by pieces that do not take it');

  const backwards = connect(build('sprinkler', 'tank')).ports;
  assert.equal(backwards.get('m0:0').status, 'open', 'flow only goes rightwards');
  assert.equal(backwards.get('m1:0').status, 'open', 'and an output nobody takes is open');
});

test('a machine works only when a flow runs unbroken from a source to an effector', () => {
  assert.equal(test1(SPRINKLER).turns[0].active.m1, true);
  assert.equal(test1(build('sprinkler', 'tank')).turns[0].active.m0, undefined);
  assert.equal(test1(build('tank', 'sprinkler', 'sprinkler')).turns[0].active.m2, undefined, 'one tank feeds one sprinkler');
});

test('sources run out after their charge', () => {
  const sim = test1(SPRINKLER);
  assert.deepEqual(activeTurns(sim, 'm1'), upTo(MODULES.tank.charge));
  assert.ok(sim.turns[MODULES.tank.charge - 1].events.some((e) => e.type === 'empty' && e.id === 'm0'));
});

test('an open input draws from the ground under the machine, and never runs out', () => {
  const pump = build('spring', 'pump', 'sprinkler');
  const sim = test1(pump, 'puddle');
  assert.deepEqual(activeTurns(sim, 'm1'), upTo(MODULES.spring.charge));
  assert.ok(sim.turns[0].draws.some((d) => d.id === 'm1' && d.flow === 'matter'));

  assert.equal(test1(pump).turns[0].active.m1, undefined, 'on bare ground there is no water to pump');
});

test("an output nobody takes spills onto the machine's tile", () => {
  const { round, unit: u } = testMachine(build('tank'), null);
  assert.deepEqual(round.turns[0].units[u.id].spills.map((s) => s.flow), ['matter']);
  assert.equal(round.turns[0].tiles[`${u.x},${u.y}`].wet.length, 1);
});

test('a control lets its flow through only on a signal', () => {
  assert.equal(test1(build('tank', 'valve', 'sprinkler')).turns[0].active.m1, undefined);
  const sim = test1(build('battery', 'tank', 'valve', 'sprinkler'));
  assert.equal(sim.turns[0].active.m3, true, 'the battery’s signal passes the tank to reach the valve');
  assert.deepEqual(activeTurns(sim, 'm3'), upTo(Math.min(MODULES.tank.charge, MODULES.battery.charge)));
});

test('converters heat the pieces either side of them, and wood in heat burns after the set number of turns', () => {
  const parts = build('burner', 'engine', 'fan');
  const sim = test1(parts);
  assert.ok(sim.turns[0].cells[2].hot.some((c) => c.kind === 'waste' && c.id === 'm1'));
  assert.equal(sim.burntAfter.m2, TUNING.burnTurns);
  assert.deepEqual(activeTurns(sim, 'm2'), upTo(TUNING.burnTurns));

  const spaced = test1(build('burner', 'engine', 'tank', 'fan'));
  assert.equal(spaced.burntAfter.m3, undefined, 'a piece in between keeps the fan out of the waste heat');
  assert.ok(spaced.turns[0].active.m3, 'and the motion still passes by to reach it');
});

test('embers under a machine heat every module in it', () => {
  const sim = test1(build('wheel'), 'embers');
  assert.equal(sim.burntAfter.m0, TUNING.burnTurns);
});

test("a machine's own sprinkler wets its tile, which turns heat inside it to steam", () => {
  const parts = build('burner', 'engine', 'fan', 'tank', 'sprinkler');
  const sim = test1(parts);
  assert.equal(sim.turns[0].cells[2].steam, true);
  assert.equal(sim.burntAfter.m2, undefined, 'tank and burner run dry together, so the fan never burns');
});

test('effect areas are measured from the machine’s tile, and face its front', () => {
  const w = world();
  assert.deepEqual(areaTiles(w, 0, 0, 'front2', 'E'), [[1, 0], [2, 0]]);
  assert.equal(areaTiles(w, 0, 0, 'cross', 'N').length, 3, 'cut off at the edge of the world');

  const fan = build('spring', 'fan');
  assert.deepEqual(unitArea(w, unit('u', fan, 2, 2, 0)).map(({ x, y }) => [x, y]), [[2, 1], [2, 0]], 'north at first');
  assert.deepEqual(unitArea(w, unit('u', fan, 2, 2, 1)).map(({ x, y }) => [x, y]), [[3, 2], [4, 2]], 'east turned a quarter');
});

test('machines in a round touch each other through the tiles they share', () => {
  // A wooden wheel in embers burns alone, and survives next to a sprinkler.
  const w = world({ '2,2': 'embers' });
  const alone = runRound(w, [unit('a', build('wheel'), 2, 2)]);
  assert.equal(alone.units.a.burntAfter.m0, TUNING.burnTurns);

  const together = runRound(w, [unit('a', build('wheel'), 2, 2), unit('b', SPRINKLER, 1, 2)]);
  assert.equal(together.turns[0].tiles['2,2'].steam, true);
  assert.equal(
    together.units.a.burntAfter.m0,
    MODULES.tank.charge + TUNING.burnTurns,
    'the wheel is safe while the tank lasts, and burns once the water stops'
  );
  const { notes } = describeRound(w, [unit('a', build('wheel'), 2, 2, 0, 'Log'), unit('b', SPRINKLER, 1, 2, 0, 'Wet')], together);
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
  const parts = build('tank', 'wheel', 'sprinkler');
  const { problems } = describe(parts, test1(parts));
  assert.ok(
    problems.some((l) => /Sprinkler never runs: its Matter input gets nothing: no piece to its left has Matter to spare/.test(l.text)),
    JSON.stringify(problems)
  );
  const two = build('tank', 'sprinkler', 'sprinkler');
  assert.ok(describe(two, test1(two)).problems.some((l) => /^Sprinkler #3 never runs/.test(l.text)), 'two of a kind are told apart by place');
});

test('a torch heats the tile in front of its machine', () => {
  const torch = build('burner', 'torch');
  const { round, sim } = testMachine(torch, null);
  assert.ok(round.turns[0].tiles['2,1'].isHot, 'heats the tile north of the machine');
  assert.ok(describe(torch, sim).result.some((l) => /heats the tile north of the machine/.test(l.text)));
});
