// The machine rules (src/core/machine.js), with no browser. Machines and worlds
// here are built inline so each test shows the exact layout it is about.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EXAMPLES, PLAYGROUND, PLAYGROUND_START, TERRAIN } from '../src/data/world.js';
import { MODULES } from '../src/data/modules.js';
import {
  areaTiles,
  causeNamer,
  connect,
  describe,
  describePlayground,
  preview,
  runActions,
  testMachine,
  tileState,
  unitArea,
} from '../src/core/machine.js';

const build = (...types) => types.map((type, i) => ({ id: `m${i}`, type }));
const once = (parts, ground = null) => testMachine(parts, ground).step;
const unit = (id, parts, x, y, rot = 0, name = id) => ({ id, machine: { name, parts }, x, y, rot });
const world = (terrain = {}) => ({ cols: 6, rows: 6, terrain });
const startUnits = () =>
  PLAYGROUND_START.map(([ex, x, y, rot], i) => unit(`u${i}`, build(...EXAMPLES[ex].parts), x, y, rot, EXAMPLES[ex].name));
const startUnit = (units, name) => units.find((u) => u.machine.name === name);

// A tank feeding a sprinkler: wets its own tile and the four round it.
const SPRINKLER = build('tank', 'sprinkler');

test('an input takes the nearest untaken flow of its element from its left', () => {
  const ports = connect(build('tank', 'tank', 'sprinkler', 'sprinkler')).ports;
  assert.equal(ports.get('m2:0').partnerId, 'm1', 'the nearer tank feeds the first sprinkler');
  assert.equal(ports.get('m3:0').partnerId, 'm0', 'and the next sprinkler takes the one left over');

  const passing = connect(build('battery', 'tank', 'boiler')).ports;
  assert.equal(passing.get('m2:1').partnerId, 'm0', 'a flow passes by pieces that do not take it');

  const backwards = connect(build('sprinkler', 'tank')).ports;
  assert.equal(backwards.get('m0:0').status, 'open', 'flow only goes rightwards');
  assert.equal(backwards.get('m1:0').status, 'open', 'and an output nobody takes is open');
});

test('a machine works only when a flow runs unbroken from a source to an effector', () => {
  assert.equal(once(SPRINKLER).active.m1, true);
  assert.equal(once(build('sprinkler', 'tank')).active.m0, undefined);
  assert.equal(once(build('tank', 'sprinkler', 'sprinkler')).active.m2, undefined, 'one tank feeds one sprinkler');
});

test('nothing runs out: a machine does the same thing every time it is made to work', () => {
  const u = unit('u', SPRINKLER, 2, 2);
  const run = runActions(world(), [u], Array(20).fill('u'));
  assert.equal(run.steps.length, 20);
  assert.ok(run.steps.every((s) => s.active.m1), 'the sprinkler works on the twentieth go as on the first');
  assert.deepEqual(runActions(world(), [u], []).steps, [], 'and nothing works until it is made to');
});

test('converters change one element into another', () => {
  assert.ok(once(build('battery', 'boiler', 'torch'), 'puddle').active.m2, 'Liquid and Energy boil into Gas for a torch');
  assert.ok(once(build('bottle', 'condenser', 'sprinkler')).active.m2, 'Gas condenses into Liquid for a sprinkler');
  assert.ok(once(build('hopper', 'battery', 'melter', 'sprinkler')).active.m3, 'a Solid melts into Liquid');
  assert.ok(once(build('tank', 'battery', 'freezer', 'chute')).active.m3, 'Liquid freezes into a Solid');
  assert.ok(once(build('tank', 'wheel', 'fan')).active.m2, 'Liquid turns a wheel for Energy');
  assert.ok(once(build('bottle', 'engine', 'fan')).active.m2, 'Gas drives an engine for Energy');
});

test('one machine draws a different source depending on where it stands', () => {
  // An open Energy input: embers and a draft both give it.
  const fan = build('fan');
  assert.equal(once(fan).active.m0, undefined, 'bare ground gives nothing');
  for (const ground of ['embers', 'draft']) {
    const step = once(fan, ground);
    assert.ok(step.active.m0, `a fan works on ${ground}`);
    assert.deepEqual(step.draws[0].from, { kind: 'terrain', terrain: ground });
  }
  assert.ok(Object.keys(TERRAIN).every((id) => ['liquid', 'solid', 'gas', 'energy'].includes(TERRAIN[id].provides)));
});

test('what a machine leaves on a tile stays, and a machine standing there can draw from it', () => {
  // A sprinkler wets the tile next door; a lone sprinkler there draws that water.
  const w = world();
  const units = [unit('wet', SPRINKLER, 2, 2), unit('dry', build('sprinkler'), 3, 2)];
  const before = runActions(w, units, ['dry']);
  assert.equal(before.steps[0].active.m0, undefined, 'on dry ground it does nothing');
  const after = runActions(w, units, ['wet', 'dry']);
  assert.ok(after.steps[1].active.m0, 'once its tile is wet, it works');
  assert.equal(after.steps[1].draws[0].from.condition, 'wet');
  const { notes } = describe(units[1].machine.parts, after.steps[1], { self: 'dry', nameCause: causeNamer(units) });
  assert.ok(notes.some((l) => /draws Liquid from the water/.test(l.text)), JSON.stringify(notes));
  assert.ok(tileState(w, runActions(w, units, ['wet', 'dry', 'dry']).state.landed, 4, 2).wet.length, 'and the water it spreads stays too');
});

test("an output nobody takes spills its element onto the machine's tile", () => {
  for (const [source, kind] of [['tank', 'wet'], ['hopper', 'sand'], ['bottle', 'fumes'], ['battery', 'hot']]) {
    const { step, tiles, unit: u } = testMachine(build(source), null);
    assert.equal(step.spills.length, 1);
    assert.equal(tiles[`${u.x},${u.y}`][kind].length, 1, `${source} leaves ${kind}`);
  }
});

test('converters heat the pieces either side of them, and hot wood burns down after working once', () => {
  const step = once(build('bottle', 'engine', 'fan'));
  assert.ok(step.cells[2].hot.some((c) => c.kind === 'waste' && c.id === 'm1'));
  assert.ok(step.active.m2, 'the fan works this once');
  assert.deepEqual(step.burns.map((b) => b.id), ['m2'], 'and burns as it does');

  const u = unit('u', build('bottle', 'engine', 'fan'), 2, 2);
  const twice = runActions(world(), [u], ['u', 'u']);
  assert.equal(twice.state.burnt.u.m2, 1, 'burnt in the first action');
  assert.equal(twice.steps[1].active.m2, undefined, 'and gone for the second');

  const spaced = once(build('bottle', 'engine', 'tank', 'fan'));
  assert.equal(spaced.burns.length, 0, 'a piece in between keeps the fan out of the waste heat');
  assert.ok(spaced.active.m3, 'and the Energy still passes by to reach it');
});

test('embers under a machine heat every module in it while it works', () => {
  assert.deepEqual(once(build('wheel'), 'embers').burns.map((b) => b.id), ['m0']);
});

test("water on a machine's tile turns heat inside it to steam, and sand smothers it", () => {
  const wet = once(build('bottle', 'engine', 'fan', 'tank', 'sprinkler'));
  assert.equal(wet.cells[2].steam, true);
  assert.equal(wet.burns.length, 0, 'its own sprinkler keeps the fan from burning');

  const w = world({ '2,2': 'embers' });
  const units = [unit('mill', build('fan'), 2, 2), unit('sand', build('hopper', 'chute'), 2, 3)];
  const run = runActions(w, units, ['sand', 'mill']);
  assert.ok(run.steps[1].cells[0].smothered, 'sand poured over the embers smothers them');
  assert.equal(run.steps[1].burns.length, 0);
  assert.ok(run.steps[1].active.m0, 'and the embers still give the fan its Energy');
});

test('effect areas are measured from the machine’s tile, and face its front', () => {
  const w = world();
  assert.deepEqual(areaTiles(w, 0, 0, 'front2', 'E'), [[1, 0], [2, 0]]);
  assert.equal(areaTiles(w, 0, 0, 'cross', 'N').length, 3, 'cut off at the edge of the world');

  const fan = build('battery', 'fan');
  assert.deepEqual(unitArea(w, unit('u', fan, 2, 2, 0)).map(({ x, y }) => [x, y]), [[2, 1], [2, 0]], 'north at first');
  assert.deepEqual(unitArea(w, unit('u', fan, 2, 2, 1)).map(({ x, y }) => [x, y]), [[3, 2], [4, 2]], 'east turned a quarter');
});

test('a torch heats the tile in front of its machine, and burns the wood of a machine standing there', () => {
  const torch = build('bottle', 'torch');
  const { tiles, step } = testMachine(torch, null);
  assert.ok(tiles['2,1'].isHot, 'heats the tile north of the machine');
  assert.ok(describe(torch, step).result.some((l) => /heats the tile north of the machine/.test(l.text)));

  const w = world();
  const units = [unit('t', torch, 2, 2), unit('mill', build('tank', 'wheel'), 2, 1, 0, 'Mill')];
  const run = runActions(w, units, ['t']);
  assert.deepEqual(run.steps[0].burns, [{ unit: 'mill', id: 'm1', causes: run.steps[0].burns[0].causes }], 'the wheel next door burns');
  const before = runActions(w, units, []);
  const previews = { t: preview(before, 't'), mill: preview(before, 'mill') };
  const { problems } = describePlayground(w, units, before, previews);
  assert.ok(problems.some((l) => /working it now burns down the Water Wheel in Mill \(C2\)/.test(l.text)), JSON.stringify(problems));
});

test('the order the player makes machines work in matters, but the order they are listed in does not', () => {
  const units = startUnits();
  const sprinkler = startUnit(units, 'Tank Sprinkler').id;
  const fan = startUnit(units, 'Steam Fan').id;
  const a = runActions(PLAYGROUND, units, [sprinkler, fan]);
  const b = runActions(PLAYGROUND, [...units].reverse(), [sprinkler, fan]);
  assert.deepEqual(a.state, b.state);
  const c = runActions(PLAYGROUND, units, [fan, sprinkler]);
  assert.notDeepEqual(a.state.burnt, c.state.burnt, 'fan first burns; sprinkler first does not');
});

test('the Steam Fan burns out on its own but survives once the Tank Sprinkler beside it has worked', () => {
  const units = startUnits();
  const fan = startUnit(units, 'Steam Fan');
  const sprinkler = startUnit(units, 'Tank Sprinkler');
  assert.ok(once(fan.machine.parts).burns.length > 0, 'burns on the Workbench');

  const fresh = runActions(PLAYGROUND, units, []);
  assert.ok(preview(fresh, fan.id).burns.length > 0, 'on the Playground too, while its tile is dry');
  const wetted = runActions(PLAYGROUND, units, [sprinkler.id]);
  assert.equal(preview(wetted, fan.id).burns.length, 0, 'not once its tile is wet');
  const previews = Object.fromEntries(units.map((u) => [u.id, preview(wetted, u.id)]));
  const { notes } = describePlayground(PLAYGROUND, units, wetted, previews);
  assert.ok(notes.some((l) => /Steam Fan \(E4\) stands on a tile wetted by Tank Sprinkler \(D4\)/.test(l.text)), JSON.stringify(notes));
});

test('the Puddle Torch boils water from the puddle under it, and from a tile a sprinkler has wetted', () => {
  const parts = build(...EXAMPLES.find((e) => e.name === 'Puddle Torch').parts);
  assert.ok(once(parts, 'puddle').active.m2, 'on a puddle');
  assert.equal(once(parts).active.m2, undefined, 'not on bare ground');
  const units = [unit('torch', parts, 2, 2), unit('wet', SPRINKLER, 3, 2)];
  assert.ok(runActions(world(), units, ['wet', 'torch']).steps[1].active.m2, 'on wet ground');
});

test('every example machine does something on its own test ground', () => {
  for (const example of EXAMPLES) {
    const parts = build(...example.parts);
    const { result } = describe(parts, once(parts, example.ground));
    assert.ok(result.some((line) => line.good), `${example.name} acts on the world`);
    assert.ok(parts.every((p) => MODULES[p.type]), `${example.name} is built from modules that exist`);
  }
});

test('the readout traces an idle effector back to the real cause', () => {
  const parts = build('tank', 'wheel', 'sprinkler');
  const { problems } = describe(parts, once(parts));
  assert.ok(
    problems.some((l) => /Sprinkler can't work: its Liquid input gets nothing: no piece to its left has Liquid to spare, and the bare ground under the machine has none to give/.test(l.text)),
    JSON.stringify(problems)
  );
  const upstream = build('battery', 'boiler', 'torch');
  assert.ok(
    describe(upstream, once(upstream)).problems.some((l) => /Torch can't work: Boiler's Liquid input gets nothing/.test(l.text)),
    'a dry boiler is named, not the torch it feeds'
  );
  const two = build('tank', 'sprinkler', 'sprinkler');
  assert.ok(describe(two, once(two)).problems.some((l) => /^Sprinkler #3 can't work/.test(l.text)), 'two of a kind are told apart by place');
});
