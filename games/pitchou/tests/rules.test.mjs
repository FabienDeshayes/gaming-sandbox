// Unit tests for the pure rules. There is no game to drive yet — these exist
// because every number in DESIGN.md §8 comes out of sim/simulate.mjs, and the
// simulator is only as trustworthy as the rules underneath it.
//
//   npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_TUNING,
  allocate,
  beginNight,
  buildTool,
  countTokens,
  createRun,
  drainForNight,
  endNight,
  goHome,
  resourceToken,
  search,
  waveToken,
} from '../src/core/rules.js';

const tune = (overrides) => ({ ...DEFAULT_TUNING, ...overrides });

// The bag is popped from the end, so the last entry is drawn first.
function stackBag(state, tokens) {
  state.bag = tokens.slice().reverse();
}

test('drain rises on the published schedule', () => {
  assert.equal(drainForNight(1), 1);
  assert.equal(drainForNight(4), 1);
  assert.equal(drainForNight(5), 2);
  assert.equal(drainForNight(8), 2);
  assert.equal(drainForNight(9), 3);
  assert.equal(drainForNight(12), 3);
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
  const state = createRun({ seed: 1 });
  beginNight(state);
  stackBag(state, [
    resourceToken('oil', 1),
    resourceToken('oil', 1),
    resourceToken('oil', 1),
    resourceToken('wood', 1),
    waveToken(),
    waveToken(),
    waveToken(),
  ]);
  for (let i = 0; i < 7; i++) search(state);
  assert.equal(state.busted, true);
  assert.equal(state.phase, 'dawn');
  assert.deepEqual(state.basket, { oil: 1, wood: 0, plank: 0 });
});

test('going home before the last wave keeps everything', () => {
  const state = createRun({ seed: 1 });
  beginNight(state);
  stackBag(state, [
    resourceToken('oil', 1),
    waveToken(),
    resourceToken('plank', 2),
    waveToken(),
    resourceToken('wood', 1), // left on the shore — going home leaves it there
  ]);
  for (let i = 0; i < 4; i++) search(state);
  assert.equal(state.busted, false);
  assert.equal(state.strikes, 2);
  goHome(state);
  assert.deepEqual(state.basket, { oil: 1, wood: 0, plank: 2 });
});

test('pouring clamps at the cap and stockpiling does not', () => {
  const state = createRun({ seed: 1 });
  beginNight(state);
  state.meters.lamp = 11;
  state.basket = { oil: 4, wood: 0, plank: 0 };
  goHome(state);
  allocate(state, { oil: 'meter' });
  assert.equal(state.meters.lamp, DEFAULT_TUNING.meterCap);

  const saver = createRun({ seed: 1 });
  beginNight(saver);
  saver.basket = { oil: 0, wood: 4, plank: 0 };
  goHome(saver);
  allocate(saver, { wood: 'stock' });
  assert.equal(saver.stock.wood, 4);
  assert.equal(saver.meters.hearth, 9);
});

test('a tool is paid from the stockpile and rewrites the shore', () => {
  const state = createRun({ seed: 1 });
  beginNight(state);
  goHome(state);
  state.stock.wood = 3;
  const before = state.shore.length;
  buildTool(state, 'gaff');
  assert.equal(state.stock.wood, 0);
  assert.equal(state.shore.length, before + 1);
  assert.equal(countTokens(state.shore).wood, countTokens(state.shore).plank + 2);
  assert.throws(() => buildTool(state, 'gaff'), /already built/);
  assert.throws(() => buildTool(state, 'net'), /cannot afford/);
});

test('a wave removal takes the biggest wave off the shore', () => {
  const state = createRun({ seed: 1, tuning: tune({ startWaves: [1, 1, 2], waveBudget: 4 }) });
  beginNight(state);
  goHome(state);
  state.stock.plank = 6;
  assert.equal(countTokens(state.shore).waveSize, 4);
  buildTool(state, 'wall');
  const after = countTokens(state.shore);
  assert.equal(after.waves, 2);
  assert.equal(after.waveSize, 2);
});

test('the storm adds a wave on its scheduled nights only', () => {
  const state = createRun({ seed: 1 });
  for (let night = 1; night <= 4; night++) {
    beginNight(state);
    goHome(state);
    allocate(state, {});
    const before = countTokens(state.shore).waves;
    endNight(state);
    const expected = DEFAULT_TUNING.stormWaveNights.includes(night) ? before + 1 : before;
    assert.equal(countTokens(state.shore).waves, expected, `night ${night}`);
  }
});

test('surviving the last night wins, and an unallocated basket blocks the night', () => {
  const state = createRun({ seed: 1, tuning: tune({ seasonNights: 2, startMeter: 12 }) });
  beginNight(state);
  stackBag(state, [resourceToken('oil', 1)]);
  search(state);
  assert.throws(() => endNight(state), /must be allocated/);
  allocate(state, {});
  endNight(state);
  assert.equal(state.night, 2);
  beginNight(state);
  goHome(state);
  allocate(state, {});
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
