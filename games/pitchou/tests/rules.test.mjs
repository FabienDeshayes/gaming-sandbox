import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_TUNING,
  METER_OF,
  affordableTools,
  allocate,
  beginNight,
  buildTool,
  buildsLeft,
  canAffordFromMeters,
  countTokens,
  createRun,
  drainForNight,
  endNight,
  fallToken,
  goHome,
  gainsToken,
  resourceToken,
  rolledToken,
  search,
} from '../src/core/rules.js';

const tune = (overrides) => ({ ...DEFAULT_TUNING, ...overrides });

function stackBag(state, tokens) {
  state.bag = tokens.slice().reverse();
}

test('drain rises on the published schedule', () => {
  assert.equal(drainForNight(1), 1);
  assert.equal(drainForNight(5), 1);
  assert.equal(drainForNight(6), 2);
  assert.equal(drainForNight(9), 2);
  assert.equal(drainForNight(10), 3);
  assert.equal(drainForNight(12), 3);
});

// The workshop only unlocks a tier on the night the drain steps up to match it
// (DESIGN.md §8) — a tier list that drifts off the drain schedule is exactly
// the bug that makes the mid-season squeeze land in the wrong place.
test('every tool tier opens on a night the drain steps up', () => {
  const steps = DEFAULT_TUNING.drainSteps;
  DEFAULT_TUNING.toolTierNights.forEach((night, i) => {
    if (i === 0) {
      assert.equal(night, 1);
      return;
    }
    assert.equal(drainForNight(night), i + 1, `tier ${i + 1} opens on a drain-${i + 1} night`);
    assert.equal(drainForNight(night - 1), i, 'and the night before is still the old drain');
  });
  assert.equal(steps.length, DEFAULT_TUNING.toolTierNights.length);
});

test('dusk drains every meter and a zero ends the run', () => {
  const state = createRun({ seed: 1 });
  beginNight(state);
  assert.deepEqual(state.meters, { lamp: 9, hearth: 9, tower: 9 });
  assert.equal(state.phase, 'search');

  const doomed = createRun({ seed: 1, tuning: tune({ startMeter: 1 }) });
  beginNight(doomed);
  assert.equal(doomed.status, 'lost');
  assert.equal(doomed.lost.meter, 'lamp');
  assert.equal(doomed.lost.night, 1);
});

test('a bust keeps half the basket, rounded down per resource', () => {
  const state = createRun({ seed: 1, tuning: tune({ fallDamage: 0 }) });
  beginNight(state);
  stackBag(state, [
    resourceToken('oil', 1),
    resourceToken('oil', 1),
    resourceToken('oil', 1),
    resourceToken('wood', 1),
    fallToken(),
    fallToken(),
    fallToken(),
  ]);
  for (let i = 0; i < 7; i++) search(state);
  assert.equal(state.busted, true);
  assert.equal(state.phase, 'dawn');
  assert.deepEqual(state.basket, { oil: 1, wood: 0, plank: 0 });
});

test('going home before the last fall banks what survived', () => {
  const state = createRun({ seed: 1, tuning: tune({ fallDamage: 0 }) });
  beginNight(state);
  stackBag(state, [
    resourceToken('oil', 1),
    fallToken(),
    resourceToken('plank', 2),
    fallToken(),
    resourceToken('wood', 1),
  ]);
  for (let i = 0; i < 4; i++) search(state);
  assert.equal(state.busted, false);
  assert.equal(state.strikes, 2);
  goHome(state);
  assert.deepEqual(state.basket, { oil: 1, wood: 0, plank: 2 });
});

test('pouring clamps at the cap', () => {
  const state = createRun({ seed: 1 });
  beginNight(state);
  state.meters.lamp = DEFAULT_TUNING.meterCap - 1;
  state.basket = { oil: 4, wood: 0, plank: 0 };
  goHome(state);
  allocate(state);
  assert.equal(state.meters.lamp, DEFAULT_TUNING.meterCap);
});

test('a tool is paid from the meters and rewrites the shore', () => {
  const state = createRun({ seed: 1 });
  beginNight(state);
  goHome(state);
  allocate(state);
  const before = state.shore.length;
  const meterBefore = state.meters.hearth;
  assert.ok(meterBefore >= 3, 'hearth must be at least 3 to afford the gaff');
  buildTool(state, 'gaff');
  assert.equal(state.meters.hearth, meterBefore - 3);
  assert.equal(state.shore.length, before + 1);
  assert.equal(countTokens(state.shore).wood, countTokens(state.shore).plank + 2);
  assert.throws(() => buildTool(state, 'gaff'), /already built/);
  state.night = DEFAULT_TUNING.toolTierNights[2];
  state.meters.lamp = 2;
  assert.throws(() => buildTool(state, 'breakwater'), /cannot afford/);
});

// One build a night is what keeps twelve tools a choice rather than a shopping
// list — with it lifted, the simulator's best line stops being the one that
// pushes (sim/simulate.mjs, "unlimited builds a night").
test('one dawn builds one tool', () => {
  const state = createRun({ seed: 1 });
  beginNight(state);
  goHome(state);
  allocate(state);
  state.meters = { lamp: 12, hearth: 12, tower: 12 };
  buildTool(state, 'gaff');
  assert.equal(buildsLeft(state), 0);
  assert.deepEqual(affordableTools(state), [], 'nothing else is offered tonight');
  assert.throws(() => buildTool(state, 'net'), /no builds left/);
  endNight(state);
  beginNight(state);
  goHome(state);
  allocate(state);
  assert.equal(buildsLeft(state), 1, 'the next dawn opens the workshop again');
  buildTool(state, 'net');
});

// A mixed token pays every resource it names in one draw; a rolled token pays
// somewhere in its range and reports what it actually rolled.
test('a mixed token fills more than one meter and a rolled token lands in range', () => {
  const state = createRun({ seed: 1 });
  beginNight(state);
  stackBag(state, [gainsToken([
    { resource: 'oil', amount: 1 },
    { resource: 'wood', amount: 2 },
  ])]);
  const mixed = search(state);
  assert.deepEqual(state.basket, { oil: 1, wood: 2, plank: 0 });
  assert.deepEqual(mixed.rolled, [
    { resource: 'oil', amount: 1 },
    { resource: 'wood', amount: 2 },
  ]);

  const seen = new Set();
  for (let seed = 1; seed <= 60; seed++) {
    const run = createRun({ seed });
    beginNight(run);
    stackBag(run, [rolledToken('plank', 1, 3)]);
    const token = search(run);
    const amount = token.rolled[0].amount;
    assert.ok(amount >= 1 && amount <= 3, `rolled ${amount}`);
    assert.equal(run.basket.plank, amount);
    seen.add(amount);
  }
  assert.deepEqual([...seen].sort(), [1, 2, 3], 'the whole 1-3 range comes up');
});

// The shore tally is what a player counts to decide whether to push, so a
// rolled token has to be counted at its ceiling and flagged as a maybe.
test('the shore tally counts a rolled token at its ceiling', () => {
  const counts = countTokens([
    resourceToken('oil', 1),
    rolledToken('oil', 1, 3),
    gainsToken([{ resource: 'wood', amount: 1 }, { resource: 'plank', amount: 1 }]),
    fallToken(),
  ]);
  assert.equal(counts.oil, 4);
  assert.equal(counts.wood, 1);
  assert.equal(counts.plank, 1);
  assert.equal(counts.falls, 1);
  assert.equal(counts.uncertain, 1);
  assert.equal(counts.total, 4);
});

test('a tool is locked until its tier opens', () => {
  const state = createRun({ seed: 1 });
  beginNight(state);
  goHome(state);
  allocate(state);
  state.meters = { lamp: 12, hearth: 12, tower: 12 };
  assert.throws(() => buildTool(state, 'pole'), /not yet unlocked/);
  state.night = DEFAULT_TUNING.toolTierNights[1];
  buildTool(state, 'pole');
  state.builtTonight = 0;
  assert.throws(() => buildTool(state, 'wall'), /not yet unlocked/);
  state.night = DEFAULT_TUNING.toolTierNights[2];
  state.meters.tower = 12;
  buildTool(state, 'wall');
});

test('a fall removal takes the biggest fall off the shore', () => {
  const state = createRun({ seed: 1, tuning: tune({ startFalls: [1, 1, 2], fallBudget: 4 }) });
  beginNight(state);
  goHome(state);
  allocate(state);
  state.meters.tower = 10;
  state.night = DEFAULT_TUNING.toolTierNights[2];
  assert.equal(countTokens(state.shore).fallSize, 4);
  buildTool(state, 'wall');
  assert.equal(state.meters.tower, 4);
  const after = countTokens(state.shore);
  assert.equal(after.falls, 2);
  assert.equal(after.fallSize, 2);
});

test('the shore picks up a fall on its scheduled nights only', () => {
  const state = createRun({ seed: 1 });
  for (let night = 1; night <= 4; night++) {
    beginNight(state);
    goHome(state);
    allocate(state);
    const before = countTokens(state.shore).falls;
    endNight(state);
    const expected = DEFAULT_TUNING.extraFallNights.includes(night) ? before + 1 : before;
    assert.equal(countTokens(state.shore).falls, expected, `night ${night}`);
  }
});

test('surviving the last night wins, and an unallocated basket blocks the night', () => {
  const state = createRun({ seed: 1, tuning: tune({ seasonNights: 2, startMeter: 12 }) });
  beginNight(state);
  stackBag(state, [resourceToken('oil', 1)]);
  search(state);
  assert.throws(() => endNight(state), /must be allocated/);
  allocate(state);
  endNight(state);
  assert.equal(state.night, 2);
  beginNight(state);
  goHome(state);
  allocate(state);
  endNight(state);
  assert.equal(state.status, 'won');
});

test('a seed replays a season exactly', () => {
  const play = (seed) => {
    const state = createRun({ seed });
    const drawn = [];
    beginNight(state);
    while (state.phase === 'search' && state.bag.length > 0) {
      drawn.push(search(state));
    }
    return JSON.stringify(drawn);
  };
  assert.equal(play(42), play(42));
  assert.notEqual(play(42), play(43));
});

test('a fall that does not end the night still costs the biggest stack', () => {
  const state = createRun({ seed: 1, tuning: tune({ fallDamage: 1 }) });
  beginNight(state);
  stackBag(state, [
    resourceToken('oil', 3),
    resourceToken('wood', 1),
    fallToken(),
    fallToken(),
    resourceToken('plank', 1),
  ]);
  for (let i = 0; i < 4; i++) search(state);
  assert.equal(state.busted, false);
  assert.deepEqual(state.basket, { oil: 1, wood: 1, plank: 0 });
});

test('fall damage never drives the basket below empty', () => {
  const state = createRun({ seed: 1, tuning: tune({ fallDamage: 2 }) });
  beginNight(state);
  stackBag(state, [fallToken(), resourceToken('wood', 1), fallToken(), resourceToken('oil', 1)]);
  for (let i = 0; i < 3; i++) search(state);
  assert.deepEqual(state.basket, { oil: 0, wood: 0, plank: 0 });
});

test('canAffordFromMeters checks meter levels via METER_OF', () => {
  const meters = { lamp: 5, hearth: 3, tower: 2 };
  assert.ok(canAffordFromMeters(meters, { oil: 5 }));
  assert.ok(!canAffordFromMeters(meters, { oil: 6 }));
  assert.ok(canAffordFromMeters(meters, { oil: 2, wood: 3 }));
  assert.ok(!canAffordFromMeters(meters, { oil: 2, wood: 4 }));
});
