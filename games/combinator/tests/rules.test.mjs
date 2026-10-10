// The machine rules (src/core/machine.js), with no browser. Benches here are
// built inline so each test shows the exact ground it is about; numbers the
// rules are tuned on (charges, burn time, run length) are read back from the
// data tables rather than written down twice.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BENCH, EXAMPLES } from '../src/data/bench.js';
import { MODULES, TUNING } from '../src/data/modules.js';
import { connect, describe, effectTiles, portsOf, simulate } from '../src/core/machine.js';

const bare = (terrain = {}) => ({ cols: 7, rows: 5, terrain });
const build = (...parts) => parts.map(([type, x, y, rot = 0], i) => ({ id: `m${i}`, type, x, y, rot }));
const activeTurns = (sim, id) => sim.turns.filter((t) => t.active[id]).map((t) => t.turn);

test('rotation turns the ports clockwise with the module', () => {
  const [pipe] = build(['pipe', 0, 0, 1]);
  assert.deepEqual(
    portsOf(pipe).map((p) => `${p.dir}:${p.side}`),
    ['in:N', 'out:S']
  );
});

test('touching ports link only when they carry the same flow, out to in', () => {
  const bench = bare();
  const linked = connect(bench, build(['tank', 0, 0], ['pipe', 1, 0])).ports;
  assert.equal(linked.get('m0:0').status, 'linked');
  assert.equal(linked.get('m1:0').status, 'linked');

  const wrongFlow = connect(bench, build(['tank', 0, 0], ['shaft', 1, 0])).ports;
  assert.equal(wrongFlow.get('m0:0').status, 'mismatch');
  assert.equal(wrongFlow.get('m0:0').reason, 'flow');

  const bothOut = connect(bench, build(['tank', 0, 0], ['tank', 1, 0, 2])).ports;
  assert.equal(bothOut.get('m0:0').reason, 'both-out');

  const wall = connect(bench, build(['tank', 0, 0], ['sprinkler', 1, 0])).ports;
  assert.equal(wall.get('m0:0').status, 'open', 'a side with no port is just open');
});

test('a machine works only when a flow runs unbroken from a source to an effector', () => {
  const bench = bare();
  const whole = simulate(bench, build(['tank', 0, 1], ['bend', 1, 1], ['sprinkler', 1, 0]));
  assert.equal(whole.turns[0].active.m2, true);

  const broken = simulate(bench, build(['tank', 0, 1], ['sprinkler', 1, 0]));
  assert.equal(broken.turns[0].active.m1, undefined);
});

test('sources run out after their charge', () => {
  const sim = simulate(bare(), build(['tank', 0, 1], ['bend', 1, 1], ['sprinkler', 1, 0]));
  const charge = MODULES.tank.charge;
  assert.deepEqual(activeTurns(sim, 'm2'), Array.from({ length: charge }, (_, i) => i + 1));
  assert.ok(sim.turns[charge - 1].events.some((e) => e.type === 'empty' && e.id === 'm0'));
});

test('an open input draws from the ground under its module, and never runs out', () => {
  const sim = simulate(bare({ '1,1': 'puddle' }), build(['spring', 0, 1], ['pump', 1, 1], ['pipe', 2, 1]));
  assert.deepEqual(activeTurns(sim, 'm1'), Array.from({ length: MODULES.spring.charge }, (_, i) => i + 1));
  assert.ok(sim.turns[0].draws.some((d) => d.id === 'm1' && d.flow === 'matter'));

  const dry = simulate(bare(), build(['spring', 0, 1], ['pump', 1, 1]));
  assert.equal(dry.turns[0].active.m1, undefined, 'no puddle, no water to pump');
});

test('an open output spills onto its own tile', () => {
  const sim = simulate(bare(), build(['tank', 0, 0]));
  assert.deepEqual(sim.turns[0].spills.map((s) => s.flow), ['matter']);
  assert.equal(sim.turns[0].tiles['0,0'].wet.length, 1);
});

test('a control lets its flow through only on a signal', () => {
  const bench = bare();
  const gated = build(['tank', 0, 0], ['valve', 1, 0], ['pipe', 2, 0]);
  assert.equal(simulate(bench, gated).turns[0].active.m1, undefined);

  // Battery at B2 sends its signal up a wire corner into the valve's south port.
  const fed = [...gated, ...build(['battery', 0, 1], ['wireBend', 1, 1]).map((p) => ({ ...p, id: `s${p.id}` }))];
  assert.equal(simulate(bench, fed).turns[0].active.m1, true);
});

test('a loop with no source in it never switches itself on', () => {
  // Four carriers chasing each other round a square: every input is fed by an
  // output, and none of them is a source.
  const loop = build(['bend', 0, 0, 2], ['bend', 0, 1, 1], ['bend', 1, 1, 0], ['bend', 1, 0, 3]);
  const sim = simulate(bare(), loop);
  assert.ok([...sim.net.ports.values()].every((p) => p.status === 'linked'), 'the square is closed');
  assert.deepEqual(sim.turns[0].active, {});
});

test('converters give off waste heat, and wood in heat burns after the set number of turns', () => {
  const sim = simulate(bare(), build(['burner', 0, 0], ['engine', 1, 0], ['shaft', 2, 0], ['fan', 3, 0, 1]));
  assert.ok(sim.turns[0].tiles['2,0'].hot.some((c) => c.kind === 'waste' && c.id === 'm1'));
  assert.equal(sim.burntAfter.m2, TUNING.burnTurns);
  assert.deepEqual(activeTurns(sim, 'm3'), Array.from({ length: TUNING.burnTurns }, (_, i) => i + 1));
});

test('water on a hot tile turns it to steam, which keeps wood from burning', () => {
  const bench = bare({ '2,2': 'embers' });
  const plain = simulate(bench, build(['shaft', 2, 2]));
  assert.equal(plain.burntAfter.m0, TUNING.burnTurns, 'embers burn wood on their own');

  // A sprinkler next door, turned to take water from the west, wets the embers.
  const saved = simulate(bench, build(['shaft', 2, 2], ['tank', 0, 2], ['sprinkler', 1, 2, 1]));
  assert.equal(saved.turns[0].tiles['2,2'].steam, true);
  assert.equal(
    saved.burntAfter.m0,
    MODULES.tank.charge + TUNING.burnTurns,
    'the shaft is safe while the tank lasts, and burns once the water stops'
  );
});

test('effect areas follow the effector’s rotation and stop at the bench edge', () => {
  const bench = bare();
  const [fan] = build(['fan', 0, 0, 1]);
  assert.deepEqual(effectTiles(bench, fan), [[1, 0], [2, 0]]);
  const [corner] = build(['sprinkler', 0, 0]);
  assert.equal(effectTiles(bench, corner).length, 3);
});

test('a run is the same every time', () => {
  for (const example of EXAMPLES) {
    const parts = build(...example.parts);
    assert.deepEqual(simulate(BENCH, parts).turns, simulate(BENCH, parts).turns);
  }
});

test('every example machine does something, and the readout says what stops it', () => {
  for (const example of EXAMPLES) {
    const parts = build(...example.parts);
    const sim = simulate(BENCH, parts);
    const { result } = describe(BENCH, parts, sim);
    assert.ok(result.some((line) => line.good), `${example.name} acts on the world`);
    assert.ok(result.some((line) => /Then it stops: /.test(line.text)), `${example.name} explains its stop`);
  }
});

test('the readout traces an idle effector back to the real cause', () => {
  const parts = build(['tank', 0, 1], ['shaft', 1, 1], ['sprinkler', 2, 1, 3]);
  const sim = simulate(bare(), parts);
  const { problems } = describe(bare(), parts, sim);
  assert.ok(problems.some((l) => /touch but can't connect: Matter meets Motion/.test(l.text)));
  assert.ok(problems.some((l) => /Sprinkler \(C2\) never runs/.test(l.text)));
});
