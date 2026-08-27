// The layer that moves: what is lying on the ground, how thinly it is spread,
// what a gem does to it and what a respawn does. Pure — no browser.

import { assert, assertEqual, runIfMain, unit } from './harness.js';
import { tileKey } from '../src/core/light.js';
import {
  chebyshev,
  consumableAt,
  itemAt,
  sites,
  sanctumAt,
  sanctums,
  saltOf,
  terrainAt,
  uniqueAt,
} from '../src/core/world.js';
import { createRun, itemOnTile, respawn, step } from '../src/core/rules.js';
import { emptySave } from '../src/core/save.js';
import { COIN_VALUE_MAX, COIN_VALUE_MIN, HOARD_PER_KIND, MIN_SEPARATION } from '../src/balance.js';
import { NONCE, SALT, SEED, bfs, scatter } from './world.js';

// The open world in one 141x141 window, bucketed by kind. Sanctum clearings are
// left out throughout: a clearing is a deliberate hoard with its own cap, tested
// on its own below.
const SPAN = 70;
const byKind = new Map();
let floorTiles = 0;
let itemTiles = 0;
for (let y = -SPAN; y <= SPAN; y++)
  for (let x = -SPAN; x <= SPAN; x++) {
    if (sanctumAt(x, y, SEED) || terrainAt(x, y, SEED) !== 'floor') continue;
    floorTiles += 1;
    const id = consumableAt(x, y, SEED, SALT, 0);
    if (!id) continue;
    itemTiles += 1;
    if (!byKind.has(id)) byKind.set(id, []);
    byKind.get(id).push([x, y]);
  }

unit('the ground holds something about one floor tile in 35', () => {
  // The density dial (balance.js MIN_SEPARATION), pinned: playtesting moved it
  // because a walk was crossing screenfuls of lit ground with nothing on any of
  // them, and the thing that regresses silently is this number.
  const share = itemTiles / floorTiles;
  assert(share > 0.025 && share < 0.035, `one floor tile in ${(floorTiles / itemTiles).toFixed(0)}`);
});

unit('no two of the same consumable ever land within the separation distance', () => {
  // The anti-clustering promise, asserted outright rather than sampled: with a
  // Chebyshev minimum of MIN_SEPARATION, no square that wide can hold two of a
  // kind anywhere in the window.
  assert(byKind.size >= 4, 'the sample should contain several kinds');
  for (const [id, points] of byKind) {
    assert(points.length > 10, `${id} should appear often enough to be worth checking`);
    for (let i = 0; i < points.length; i++)
      for (let j = i + 1; j < points.length; j++) {
        const gap = chebyshev(points[i][0], points[i][1], points[j][0], points[j][1]);
        assert(gap >= MIN_SEPARATION, `two ${id} landed ${gap} apart at ${points[i]} and ${points[j]}`);
      }
  }
});

unit('nothing spawns on the base clearing, and the best loot is far out', () => {
  for (let y = -1; y <= 1; y++)
    for (let x = -1; x <= 1; x++) assertEqual(itemAt(x, y, SEED), null, `item at (${x},${y})`);

  const lamps = byKind.get('torch-lamp') || [];
  assert(lamps.length > 0, 'lamp torches should exist somewhere in the window');
  for (const [x, y] of lamps)
    assert(chebyshev(x, y) >= 20, `a lamp torch at (${x},${y}) is inside the near bands`);
});

unit('a gem upgrades what the world spawns, and thins it', () => {
  const count = (gems) => {
    const tally = {};
    let total = 0;
    for (let y = -45; y <= 45; y++)
      for (let x = -45; x <= 45; x++) {
        if (sanctumAt(x, y, SEED)) continue;
        const id = consumableAt(x, y, SEED, SALT, gems);
        if (!id) continue;
        total += 1;
        tally[id] = (tally[id] || 0) + 1;
      }
    return { tally, total };
  };

  const none = count(0);
  assert(none.total > 50, 'the sample window should hold plenty to compare');

  // One kind out, one kind in, at every gem — the swaps never change how many
  // kinds are in play, only which. What does change is how many tiles hold
  // anything: each gem leaves the ground sparser than the last (GEM_DENSITY in
  // balance.js), because what it does hold is worth several times more.
  let previous = none.total;
  const tallies = [none.tally];
  for (const gems of [1, 2, 3]) {
    const after = count(gems);
    assert(after.total < previous, `gem ${gems} thins the ground (${after.total} against ${previous})`);
    previous = after.total;
    tallies.push(after.tally);
    assertEqual(
      Object.keys(after.tally).length,
      Object.keys(none.tally).length,
      `gem ${gems} keeps the same number of kinds in play`
    );
  }

  // Thinner, not empty: three gems still leave over half of what the opening
  // world held, so the late game is quieter rather than barren.
  assert(previous > none.total * 0.45, `three gems leave the ground worth walking (${previous})`);

  // And the swaps themselves, by name: one retired for one arriving, each time.
  for (const [gems, out, arriving] of [
    [1, 'water-drop', 'water-flask'],
    [2, 'torch-medium', 'torch-beacon'],
    [3, 'water-flask', 'spring-vial'],
  ]) {
    assert(tallies[gems - 1][out] > 0, `${out} is in the world before gem ${gems}`);
    assertEqual(tallies[gems][out], undefined, `and retired by it`);
    assert(tallies[gems][arriving] > 0, `${arriving} arrives with gem ${gems}`);
  }
});

unit('a sanctum clearing is a hoard, not a pile', () => {
  for (const sanctum of sanctums(SEED)) {
    const tally = {};
    const span = sanctum.radius - 1;
    for (let dy = -span; dy <= span; dy++)
      for (let dx = -span; dx <= span; dx++) {
        const id = consumableAt(sanctum.centre.x + dx, sanctum.centre.y + dy, SEED, SALT, 0);
        if (id) tally[id] = (tally[id] || 0) + 1;
      }
    for (const [id, count] of Object.entries(tally))
      assert(count <= HOARD_PER_KIND, `sanctum ${sanctum.index} holds ${count} of ${id}`);
    // The hall is the one clearing that is not a hoard at all: what is in it is
    // the sorcerer, and a conversation is the whole of what it pays (DESIGN.md
    // §4.9).
    if (sanctum.hall) assertEqual(Object.keys(tally), [], 'the hall holds nothing to pick up');
    else assert(Object.keys(tally).length >= 3, `sanctum ${sanctum.index} should hold a cache`);
  }
});

unit('a new run relays the consumables and leaves the unique objects alone', () => {
  const other = saltOf(NONCE + 1, 0);
  let moved = 0;
  let same = 0;
  for (let y = -40; y <= 40; y++)
    for (let x = -40; x <= 40; x++) {
      const before = consumableAt(x, y, SEED, SALT, 0);
      const after = consumableAt(x, y, SEED, other, 0);
      if (!before && !after) continue;
      if (before === after) same += 1;
      else moved += 1;
    }
  assert(moved > same, 'a different nonce should lay the consumables out differently');

  // The gems, the merchant and the two tools are exactly where they were: the
  // unique layer is a function of the seed alone, and no salt touches it.
  for (const sanctum of sanctums(SEED))
    if (sanctum.gem)
      assertEqual(uniqueAt(sanctum.centre.x, sanctum.centre.y, SEED), sanctum.gem, 'the gem');
  for (const site of sites(SEED))
    assertEqual(uniqueAt(site.x, site.y, SEED), site.item, `the ${site.id}`);
});

unit('everything on the ground comes back when the world respawns', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  // Consumables only: a gem doesn't respawn, and there is one inside this window.
  const items = () => {
    const found = [];
    for (let y = -25; y <= 25; y++)
      for (let x = -25; x <= 25; x++)
        if (itemOnTile(state, x, y) && !uniqueAt(x, y, SEED)) found.push(tileKey(x, y));
    return found;
  };

  const before = items();
  assert(before.length > 5, 'the window should hold a few items to empty');
  // Empty every one of them, the way a very thorough walk would.
  for (const key of before) state.collected.add(key);
  assertEqual(items().length, 0, 'nothing left to pick up');

  respawn(state);
  const after = items();
  assert(after.length > 5, 'a respawn puts everything back');
  assert(after.some((key) => !before.includes(key)), 'and puts it somewhere new');
  assertEqual(itemOnTile(state, state.x, state.y), null, 'never under the character');
});

unit('a gem and a stop at the hut are what respawn the world', () => {
  const state = createRun(SEED, emptySave(), NONCE);

  // Walking about doesn't.
  for (const dir of ['right', 'right', 'up', 'up']) step(state, dir);
  assertEqual(state.epoch, 0, 'ordinary steps leave the world where it is');

  // Stepping back onto the hut does.
  const home = bfs(SEED, (x, y) => x === 0 && y === 0, 24, [state.x, state.y]);
  let result = null;
  for (const dir of home.path) result = step(state, dir);
  assertEqual(result.atBase, true, 'back at the hut');
  assertEqual(result.respawned, true, 'which relays the world');
  assertEqual(state.epoch, 1, 'one respawn');
});

unit('a coin is a small pile, and it adds up', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  const coin = bfs(SEED, (x, y) => scatter(x, y) === 'coin', 60);
  let result = null;
  for (const dir of coin.path) result = step(state, dir);
  assertEqual(result.picked, 'coin', 'walked onto a coin');
  assert(
    result.coinsGained >= COIN_VALUE_MIN && result.coinsGained <= COIN_VALUE_MAX,
    `a pile is worth ${COIN_VALUE_MIN} to ${COIN_VALUE_MAX}, got ${result.coinsGained}`
  );
  assertEqual(state.coins, result.coinsGained, 'and that is what the run banked');
});

runIfMain(import.meta.url);
