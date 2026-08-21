// The Nouxinha suite. `unit(...)` tests exercise the pure core in Node;
// `test(...)` tests each drive a fresh page against the real canvas.
//
// See TESTING.md for how to run these and how to add one.

import { assert, assertEqual, run, test, unit } from './harness.js';
import { visibleTiles, tileKey } from '../src/core/light.js';
import {
  canEnter,
  chebyshev,
  consumableAt,
  DEFAULT_SEED,
  entryCost,
  isMerchant,
  isWalkable,
  landmarkAt,
  itemAt,
  landmarkNamed,
  landmarks,
  landmarksReachable,
  MIN_SEPARATION,
  pickSeed,
  reachableFraction,
  saltOf,
  sanctumAt,
  sanctums,
  terrainAt,
  uniqueAt,
  variantAt,
} from '../src/core/world.js';
import {
  activeLight,
  activeShape,
  bankRun,
  buy,
  canBuy,
  createRun,
  equip,
  gateOnTile,
  inventoryStacks,
  isBlackout,
  itemOnTile,
  litTiles,
  maxWater,
  refillWater,
  rememberGround,
  respawn,
  runSummary,
  spendable,
  step,
  CHEAT_COINS,
  CHEAT_REVEAL_RADIUS,
  STARTING_WATER,
  WATER_PER_GEM,
} from '../src/core/rules.js';
import { compassTarget } from '../src/core/compass.js';
import { decodeExplored, encodeExplored } from '../src/core/cartography.js';
import { clampSlot, emptySave, MAX_GEMS, normaliseSave, SLOT_COUNT } from '../src/core/save.js';
import { PRICES } from '../src/data/shop.js';
import { BLACKOUT_MEMORY_RADIUS, gemColour } from '../src/config.js';
import { ITEMS } from '../src/data/items.js';
import { zoneColours } from '../src/ui/wizard.js';
import { DIM, LIT, buildSprites, WIZARD_ZONES } from '../src/data/sprites.js';
import {
  SHEET_COLS,
  SHEET_ROWS,
  TILES,
  variantCount,
  variantKey,
  wallSprite,
} from '../src/data/tiles.js';

// --- Routes through the real world -----------------------------------------
//
// Derived here rather than hardcoded, so a change to the noise moves the tests
// with it instead of silently invalidating them.

const SEED = pickSeed(DEFAULT_SEED);

// Consumables are salted with a nonce a run draws at the start, so the pure
// tests fix one and the browser tests ask the page for its own (`itemRoute`).
const NONCE = 20260818;
const SALT = saltOf(NONCE, 0);

// A run of this world with a known scatter, for tests that only need to read it.
const scatter = (x, y, gems = 0, salt = SALT) => itemAt(x, y, SEED, { salt, gems });

// `gems` is what the walker is carrying, because a sanctum gate is only
// walkable to a run holding the gem it wants — routing with 0 would send a test
// round the outside of a sanctum it is supposed to walk into.
const ORTHOGONAL = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function bfs(seed, isGoal, maxDepth = 24, start = [0, 0], gems = 0) {
  const [sx, sy] = start;
  const prev = new Map([[tileKey(sx, sy), null]]);
  let frontier = [[sx, sy]];
  for (let d = 0; d < maxDepth; d++) {
    const next = [];
    for (const [x, y] of frontier) {
      for (const [dx, dy, name] of [[0, -1, 'up'], [1, 0, 'right'], [0, 1, 'down'], [-1, 0, 'left']]) {
        const nx = x + dx;
        const ny = y + dy;
        const key = tileKey(nx, ny);
        if (prev.has(key) || !canEnter(nx, ny, seed, gems)) continue;
        prev.set(key, [tileKey(x, y), name]);
        next.push([nx, ny]);
        const hit = isGoal(nx, ny);
        if (hit) {
          const path = [];
          let cur = key;
          while (prev.get(cur)) {
            const [p, dir] = prev.get(cur);
            path.unshift(dir);
            cur = p;
          }
          return { x: nx, y: ny, path, hit };
        }
      }
    }
    frontier = next;
  }
  throw new Error('no route found in the test world');
}

// A chain of `count` routes to distinct copies of `wantId`, each leg starting
// where the previous one left off — for tests that need to actually collect
// several of the same item by playing, rather than one.
//
// Every tile a leg *walks over* is struck off, not just the one it stops on: a
// later leg aimed at an item an earlier leg already picked up in passing would
// walk to an empty tile, which is a flake rather than a failure.
function bfsChain(seed, wantId, count, maxDepth = 24) {
  const used = new Set();
  let start = [0, 0];
  const legs = [];
  for (let i = 0; i < count; i++) {
    const found = bfs(
      seed,
      (x, y) => scatter(x, y) === wantId && !used.has(tileKey(x, y)),
      maxDepth,
      start
    );
    let [x, y] = start;
    for (const dir of found.path) {
      const [dx, dy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
      x += dx;
      y += dy;
      used.add(tileKey(x, y));
    }
    legs.push(found.path);
    start = [found.x, found.y];
  }
  return legs;
}

// The nearest medium torch and the nearest water drop in the pinned world, and
// the nearest spot with a rock to walk into. Terrain doesn't move with the
// nonce; the item routes only hold for a page opened on NONCE (`WORLD` below).
const TORCH_ROUTE = bfs(SEED, (x, y) => scatter(x, y) === 'torch-medium', 60);
const WATER_ROUTE = bfs(SEED, (x, y) => scatter(x, y) === 'water-drop', 60);
const ROCK_ROUTE = bfs(SEED, (x, y) => {
  const into = [['up', 0, -1], ['right', 1, 0], ['down', 0, 1], ['left', -1, 0]].find(
    ([, dx, dy]) => !isWalkable(x + dx, y + dy, SEED)
  );
  return into ? into[0] : null;
});
// The nearest spot with a tree next to it, for the test that a grove is drawn as
// foliage rather than as more rock.
const TREE_ROUTE = bfs(SEED, (x, y) =>
  ORTHOGONAL.some(([dx, dy]) => terrainAt(x + dx, y + dy, SEED) === 'tree')
);

// Four copies of the same light, chained leg to leg — one more than the item
// card's instance list shows at once, so it has to scroll. Four rather than
// more because the world spreads its items out (core/world.js MIN_SEPARATION),
// and every extra copy is another twenty taps through a real browser. Only
// valid for a page opened on NONCE, which is what `WORLD` below pins.
const MEDIUM_TORCH_COPIES = 4;
const MEDIUM_TORCH_CHAIN = bfsChain(SEED, 'torch-medium', MEDIUM_TORCH_COPIES, 60);

// Opening the game on a named seed and nonce reproduces an expedition exactly
// (TitleScene reads both off the URL), which is how a browser test can know
// where the coins are before the page has drawn any.
const WORLD = `seed=${DEFAULT_SEED}&nonce=${NONCE}`;

async function walkPath(game, path) {
  for (const dir of path) {
    await game.tapDpad(dir);
    await game.settle();
  }
}

// The four sanctums of this world, and the walk to the first gem. Sanctum 1's
// arch is the one that stands open, so this route is walkable carrying nothing
// — which is exactly the promise the chain rests on.
const SANCTUMS = sanctums(SEED);
const FIRST_GEM = SANCTUMS[0];
const GEM_ROUTE = bfs(
  SEED,
  (x, y) => x === FIRST_GEM.centre.x && y === FIRST_GEM.centre.y,
  90
);
// The walk to the merchant. Landmarks don't move with the nonce, so this route
// holds for any page — but it is 20-odd taps, so only one test walks it.
const MERCHANT_ROUTE = bfs(SEED, (x, y) => isMerchant(x, y, SEED), 60);

// The nearest tile from which a step walks into a gate that is still shut.
const SHUT_GATE = SANCTUMS.find((s) => s.requires === 1);

// --- Pure rules -------------------------------------------------------------

unit('small torch lights the 3x3 block around you', () => {
  const lit = visibleTiles(ITEMS['torch-small'].shape, 0, 0, 'up');
  assertEqual(lit.length, 9, 'tile count');
  assert(lit.some((t) => t.x === 1 && t.y === 1), 'includes the diagonal');
});

unit('medium torch lights 2 tiles in every direction', () => {
  assertEqual(visibleTiles(ITEMS['torch-medium'].shape, 0, 0, 'up').length, 25, 'tile count');
});

unit('lamp torch is a cone that widens with distance', () => {
  const lit = visibleTiles(ITEMS['torch-lamp'].shape, 0, 0, 'up');
  // own tile + 3 + 5 + 7 + 9
  assertEqual(lit.length, 25, 'tile count');
  assert(lit.some((t) => t.x === 0 && t.y === -4), 'reaches 4 ahead');
  assert(lit.some((t) => t.x === -4 && t.y === -4), 'is 9 wide at 4 ahead');
  assert(!lit.some((t) => t.y > 0), 'shows nothing behind');
});

unit('lamp torch re-aims with facing', () => {
  const right = visibleTiles(ITEMS['torch-lamp'].shape, 0, 0, 'right');
  assert(right.some((t) => t.x === 4 && t.y === 0), 'reaches 4 to the right');
  assert(!right.some((t) => t.x < 0), 'shows nothing behind');
});

unit('a step burns exactly one durability and sets facing', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  const before = activeLight(state).durability;
  const result = step(state, ROCK_ROUTE.path[0] || 'up');
  assert(result.moved, 'the first step off the base should be legal');
  assertEqual(activeLight(state).durability, before - 1, 'durability');
  assertEqual(state.steps, 1, 'steps');
});

unit('a step also burns one water, same as durability', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  const before = state.water;
  const result = step(state, ROCK_ROUTE.path[0] || 'up');
  assert(result.moved, 'the first step off the base should be legal');
  assertEqual(state.water, before - 1, 'water');
});

unit('refillWater tops the tank back up to the ceiling, once', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  state.water = 5;
  assert(refillWater(state), 'reports a refill happened');
  assertEqual(state.water, maxWater(state.gems), 'topped back up to the ceiling');
  assertEqual(refillWater(state), false, 'nothing to refill once already full');
});

unit('walking onto a water drop refills water, capped at the starting amount', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  for (const dir of WATER_ROUTE.path) step(state, dir);
  const plainDepletion = STARTING_WATER - WATER_ROUTE.path.length;
  assert(state.water > plainDepletion, 'the drop topped water back up');
  assert(state.water <= STARTING_WATER, 'refill never exceeds the starting amount');
  assertEqual(itemOnTile(state, state.x, state.y), null, 'the drop is gone now');
});

unit('running out of water ends the run, and nothing else can move it again', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  const first = ROCK_ROUTE.path[0] || 'up';
  const back = { up: 'down', down: 'up', left: 'right', right: 'left' }[first];
  let i = 0;
  while (state.water > 0 && i < 5000) {
    step(state, i % 2 === 0 ? first : back);
    i += 1;
  }
  assertEqual(state.water, 0, 'water ran all the way out');

  const result = step(state, first);
  assertEqual(result.moved, false, 'a dead run cannot move');
  assertEqual(result.reason, 'dead', 'reason');
});

unit('walking into rock is rejected and costs nothing', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  for (const dir of ROCK_ROUTE.path) assert(step(state, dir).moved, 'route step');
  const durability = activeLight(state).durability;
  const facing = state.facing;
  const steps = state.steps;

  const result = step(state, ROCK_ROUTE.hit);
  assert(!result.moved, 'the step into rock should be rejected');
  assertEqual(result.reason, 'blocked', 'reason');
  assertEqual(activeLight(state).durability, durability, 'durability unchanged');
  assertEqual(state.facing, facing, 'facing unchanged');
  assertEqual(state.steps, steps, 'step count unchanged');
});

unit('a spent light is removed and the next one auto-equips', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  state.inventory.push({ id: 'torch-medium', durability: 50 });

  let burnout = null;
  // Rock is impassable, so pace back and forth on tiles known to be walkable.
  const first = ROCK_ROUTE.path[0] || 'up';
  const back = { up: 'down', down: 'up', left: 'right', right: 'left' }[first];
  for (let i = 0; i < 100 && !burnout; i++) {
    const result = step(state, i % 2 === 0 ? first : back);
    if (result.burnedOut) burnout = result;
  }

  assert(burnout, 'the small torch should burn out within 100 steps');
  assertEqual(burnout.burnedId, 'torch-small', 'which light burned out');
  assertEqual(burnout.blackout, false, 'a spare light means no blackout');
  assertEqual(state.inventory.length, 1, 'the spent light is gone');
  assertEqual(activeLight(state).id, 'torch-medium', 'the spare is now equipped');
});

unit('with no lights left you see only your own tile', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  const first = ROCK_ROUTE.path[0] || 'up';
  const back = { up: 'down', down: 'up', left: 'right', right: 'left' }[first];
  for (let i = 0; i < 100; i++) step(state, i % 2 === 0 ? first : back);

  assert(isBlackout(state), 'should be in blackout');
  assertEqual(activeShape(state), null, 'no active shape');
  assertEqual(litTiles(state).length, 1, 'only the tile underfoot');
  // Blackout is a setback, not a death: you can still walk.
  const before = state.steps;
  step(state, back);
  assertEqual(state.steps, before + 1, 'still able to move');
});

unit('the wizard accumulates one colour per gem, keeping the base band', () => {
  const fg = gemColour(0);
  assertEqual(zoneColours(0), [fg, fg, fg, fg], 'no gems: every band is the palette foreground');
  assertEqual(zoneColours(1), [fg, gemColour(1), fg, fg], 'one gem lights only its own band');
  assertEqual(zoneColours(2), [fg, gemColour(1), gemColour(2), fg], 'a second gem adds a band, keeping the first');
  assertEqual(
    zoneColours(3),
    [fg, gemColour(1), gemColour(2), gemColour(3)],
    'a third gem lights every band'
  );
});

unit('equipping a carried light changes what you can see', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  assertEqual(litTiles(state).length, 9, 'small torch');
  state.inventory.push({ id: 'torch-medium', durability: 50 });
  assert(equip(state, 1), 'equip should succeed');
  assertEqual(litTiles(state).length, 25, 'medium torch');
});

unit('inventoryStacks groups same-id copies while keeping their flat index', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  state.inventory.push({ id: 'torch-medium', durability: 50 });
  state.inventory.push({ id: 'torch-medium', durability: 12 });
  state.inventory.push({ id: 'torch-lamp', durability: 60 });

  const stacks = inventoryStacks(state);
  assertEqual(stacks.map((s) => s.id), ['torch-small', 'torch-medium', 'torch-lamp'], 'one stack per id, in pickup order');

  const medium = stacks.find((s) => s.id === 'torch-medium');
  assertEqual(medium.instances.length, 2, 'both copies land in the same stack');
  assertEqual(medium.instances.map((i) => i.durability), [50, 12], 'each copy keeps its own durability');
  assertEqual(medium.instances.map((i) => i.index), [1, 2], 'each copy keeps its flat inventory index for equip()');

  const small = stacks.find((s) => s.id === 'torch-small');
  assertEqual(small.instances[0].isActive, true, 'the equipped copy is flagged active');
  assertEqual(medium.instances[0].isActive, false, 'an unequipped copy is not');
});

unit('the world is the same every time you walk back to it', () => {
  for (const [x, y] of [[3, 7], [-12, 4], [40, -40]]) {
    assertEqual(terrainAt(x, y, SEED), terrainAt(x, y, SEED), 'terrain is stable');
    assertEqual(itemAt(x, y, SEED), itemAt(x, y, SEED), 'items are stable');
  }
  // A different seed is a different world.
  let differences = 0;
  for (let i = 0; i < 200; i++)
    if (terrainAt(i, 3, SEED) !== terrainAt(i, 3, SEED + 1)) differences++;
  assert(differences > 20, `seeds should differ, got ${differences} differing tiles`);
});

unit('the base clearing is always walkable', () => {
  for (let y = -1; y <= 1; y++)
    for (let x = -1; x <= 1; x++)
      for (const seed of [SEED, 5, 8, 999]) assert(isWalkable(x, y, seed), `(${x},${y}) seed ${seed}`);
});

unit('pickSeed rejects a seed that walls the base in', () => {
  // Seed 5 seals the spawn into a pocket of a couple of tiles.
  assert(reachableFraction(5) < 0.6, 'seed 5 should be a stranding seed');
  const picked = pickSeed(5);
  assert(picked !== 5, 'a stranding seed should be rejected');
  assert(reachableFraction(picked) >= 0.6, 'the replacement should open up');
});

unit('nothing spawns on the base clearing, and the best loot is far out', () => {
  for (let y = -1; y <= 1; y++)
    for (let x = -1; x <= 1; x++) assertEqual(itemAt(x, y, SEED), null, `item at (${x},${y})`);

  let nearLamps = 0;
  let farLamps = 0;
  for (let y = -30; y <= 30; y++)
    for (let x = -30; x <= 30; x++) {
      if (itemAt(x, y, SEED) !== 'torch-lamp') continue;
      if (Math.max(Math.abs(x), Math.abs(y)) < 20) nearLamps++;
      else farLamps++;
    }
  assertEqual(nearLamps, 0, 'no lamp torches inside the near bands');
  assert(farLamps > 0, 'lamp torches should exist further out');
});

unit('a picked-up item does not come back', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  for (const dir of TORCH_ROUTE.path) step(state, dir);
  assertEqual(state.inventory.length, 2, 'the torch is in the inventory');
  assertEqual(itemOnTile(state, state.x, state.y), null, 'the tile is empty now');
  assertEqual(scatter(state.x, state.y), 'torch-medium', 'the pristine world still has it');
});

unit('a step reports arriving back at the hut', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  // The base clearing is forced floor, so stepping out and back is always legal.
  assertEqual(step(state, 'right').atBase, false, 'stepping off the hut');
  assertEqual(step(state, 'left').atBase, true, 'stepping back onto it');
  assertEqual({ x: state.x, y: state.y }, { x: 0, y: 0 }, 'home again');
});

unit('the run summary counts how far out you got and what you found', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  assertEqual(runSummary(state).furthest, 0, 'a fresh run has been nowhere');

  for (const dir of TORCH_ROUTE.path) step(state, dir);
  const summary = runSummary(state);

  assertEqual(summary.steps, TORCH_ROUTE.path.length, 'steps taken');
  assertEqual(summary.lightsFound, 1, 'the torch on the route');
  assertEqual(summary.coins, state.coins, 'coins match the run');
  assertEqual(summary.explored, state.explored.size, 'tiles explored match the run');
  // Furthest is the high-water mark, not where you happen to be standing.
  assert(summary.furthest > 0, 'the walk got somewhere');
  const furthest = summary.furthest;
  for (let i = 0; i < TORCH_ROUTE.path.length; i++) step(state, 'left');
  assert(runSummary(state).furthest >= furthest, 'walking back does not shrink it');
});

// --- Sanctums, gates and gems ----------------------------------------------

unit('every sanctum is a sealed ring with one gate and its gem at the centre', () => {
  for (const s of SANCTUMS) {
    const holes = [];
    for (let dy = -s.radius; dy <= s.radius; dy++)
      for (let dx = -s.radius; dx <= s.radius; dx++) {
        const at = terrainAt(s.centre.x + dx, s.centre.y + dy, SEED);
        const ring = Math.max(Math.abs(dx), Math.abs(dy)) === s.radius;
        if (ring && at !== 'wall') holes.push(`(${dx},${dy})=${at}`);
        // The clearing is forced floor, so the gem is always reachable from the
        // gate — that's what lets the seed check only test the door.
        if (!ring) assertEqual(at, 'floor', `inside sanctum ${s.index} at (${dx},${dy})`);
      }
    assertEqual(holes, [`(${s.gate.x - s.centre.x},${s.gate.y - s.centre.y})=gate`],
      `sanctum ${s.index} ring is solid but for its gate`);
    assertEqual(itemAt(s.centre.x, s.centre.y, SEED), s.gem || 'spring-vial',
      `sanctum ${s.index} centre holds its prize`);
  }
});

unit('a gate sits on a wall face, never a corner, with its approach adjacent', () => {
  for (const s of SANCTUMS) {
    const offX = Math.abs(s.gate.x - s.centre.x);
    const offY = Math.abs(s.gate.y - s.centre.y);
    assert(!(offX === s.radius && offY === s.radius), `sanctum ${s.index} gate is on a corner`);
    // There are no diagonal steps, so the tile you approach from has to be
    // orthogonally adjacent or the gate can never be walked through at all.
    const walk = Math.abs(s.gate.x - s.approach.x) + Math.abs(s.gate.y - s.approach.y);
    assertEqual(walk, 1, `sanctum ${s.index} approach is one step from its gate`);
    assertEqual(terrainAt(s.approach.x, s.approach.y, SEED), 'floor',
      `sanctum ${s.index} approach is standable`);
  }
});

unit('the sanctums sit at different distances and in different directions', () => {
  assertEqual(SANCTUMS.map((s) => chebyshev(s.centre.x, s.centre.y)), [20, 45, 80, 110],
    'each sanctum lands exactly on its planned ring');

  // Three gems in three directions is what makes collecting them exploring
  // rather than one long walk out and back.
  const headings = SANCTUMS.map((s) => Math.atan2(s.centre.y, s.centre.x));
  for (let a = 0; a < headings.length; a++)
    for (let b = a + 1; b < headings.length; b++) {
      let apart = Math.abs(headings[a] - headings[b]) * (180 / Math.PI);
      if (apart > 180) apart = 360 - apart;
      assert(apart > 45, `sanctums ${a} and ${b} are only ${apart.toFixed(0)} degrees apart`);
    }
});

unit('pickSeed guarantees every sanctum door can be walked to from the hut', () => {
  assert(landmarksReachable(SEED), 'the chosen seed opens all four doors');
  // And it holds for seeds picked from elsewhere, not just the default one.
  for (const preferred of [1, 5, 77, 12345]) {
    const picked = pickSeed(preferred);
    assert(landmarksReachable(picked), `seed picked from ${preferred} leaves a door sealed`);
  }
});

unit('a gate stays shut until you hold the gem it wants', () => {
  const { gate, approach, requires } = SHUT_GATE;
  assertEqual(requires, 1, 'the second sanctum wants one gem');

  const empty = createRun(SEED, emptySave(), NONCE);
  assertEqual(canEnter(gate.x, gate.y, SEED, 0), false, 'shut with no gems');
  assertEqual(gateOnTile(empty, gate.x, gate.y), { requires: 1, open: false }, 'and reads as shut');

  // Walking into it is rejected the way rock is, but with a reason that says
  // there is something behind it.
  empty.x = approach.x;
  empty.y = approach.y;
  const dir = { '1,0': 'right', '-1,0': 'left', '0,1': 'down', '0,-1': 'up' }[
    `${gate.x - approach.x},${gate.y - approach.y}`
  ];
  const blocked = step(empty, dir);
  assertEqual(blocked.moved, false, 'the step is rejected');
  assertEqual(blocked.reason, 'locked', 'and named as a locked gate, not a wall');
  assertEqual(blocked.needs, 1, 'saying how many gems it wants');

  // The same tile, for a run that has carried a gem home, is just a doorway.
  const armed = createRun(SEED, { ...emptySave(), gems: 1 }, NONCE);
  assertEqual(canEnter(gate.x, gate.y, SEED, 1), true, 'open with one gem');
  armed.x = approach.x;
  armed.y = approach.y;
  assertEqual(step(armed, dir).moved, true, 'and it can be walked through');
});

unit('a gem upgrades what the world spawns without spawning more of it', () => {
  // Sanctum clearings are skipped: a sanctum's cache is a hoard fixed at what
  // it was built holding, and doesn't follow the open world's swaps.
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

  // One kind out, one kind in, at every gem — so the map never fills up and
  // never empties out. Not exactly equal, because thinning is per kind and the
  // swap moves which kind is crowding itself, but within a few percent.
  for (const gems of [1, 2, 3]) {
    const after = count(gems);
    const drift = Math.abs(after.total - none.total) / none.total;
    assert(drift < 0.12, `gem ${gems} leaves the map about as full (drifted ${drift})`);
    assertEqual(
      Object.keys(after.tally).length,
      Object.keys(none.tally).length,
      `gem ${gems} keeps the same number of kinds in play`
    );
  }

  assert(none.tally['water-drop'] > 0, 'water drops before the first gem');
  assertEqual(none.tally['water-flask'], undefined, 'and no flasks');
  const one = count(1);
  assert(one.tally['water-flask'] > 0, 'flasks after it');
  assertEqual(one.tally['water-drop'], undefined, 'and the drop it replaced is retired');

  const two = count(2);
  assert(two.tally['torch-beacon'] > 0, 'beacons after the second gem');
  assertEqual(two.tally['torch-medium'], undefined, 'the medium torch it replaced is retired');

  const three = count(3);
  assert(three.tally['spring-vial'] > 0, 'spring vials after the third gem');
  assertEqual(three.tally['water-flask'], undefined, 'the flask it replaced is retired');
});

unit('each gem carried raises the water ceiling', () => {
  assertEqual(maxWater(0), STARTING_WATER, 'no gems');
  assertEqual(maxWater(3), STARTING_WATER + 3 * WATER_PER_GEM, 'all three');
  // The furthest sanctum is 110 out, so 220 steps of walking — more than a
  // gemless run could survive even in a straight line. The ladder has to reach.
  const round = 2 * SANCTUMS[SANCTUMS.length - 1].distance;
  assert(maxWater(MAX_GEMS) > round, `${maxWater(MAX_GEMS)} water cannot cover a ${round}-step round trip`);
  assertEqual(createRun(SEED, { ...emptySave(), gems: 2 }, NONCE).water, maxWater(2), 'a run starts topped up');
});

unit('walking onto a gem restores a colour and opens the next gate', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  assertEqual(state.gems, 0, 'a fresh save has no colour');
  let found = null;
  for (const dir of GEM_ROUTE.path) {
    const result = step(state, dir);
    assert(result.moved, `route step ${dir} should be legal`);
    if (result.gemFound) found = result;
  }

  assertEqual({ x: state.x, y: state.y }, FIRST_GEM.centre, 'arrived at the gem');
  assertEqual(state.gems, 1, 'and picked it up');
  assertEqual(found.picked, 'gem-1', 'the step reported which gem');
  assertEqual(found.gemFound, 1, 'and that it was the first colour');
  // The gate that was shut a moment ago is now a doorway.
  assertEqual(gateOnTile(state, SHUT_GATE.gate.x, SHUT_GATE.gate.y), { requires: 1, open: true },
    'the second sanctum has opened');
});

unit('a gem is only kept if the run banks it at the hut', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  for (const dir of GEM_ROUTE.path) step(state, dir);
  assertEqual(runSummary(state).gemsCarried, 1, 'carrying one that was not already banked');

  // Banking is what writes it down; dying simply never calls this, which is the
  // whole reason the walk home is a decision (DESIGN.md §6).
  const saved = bankRun(state);
  assertEqual(saved.gems, 1, 'the gem is in the save');
  assertEqual(saved.runs, 1, 'and the run is counted');

  // A later run that starts from that save opens the gate without walking back.
  const next = createRun(SEED, saved, NONCE);
  assertEqual(next.gems, 1, 'the next run starts holding it');
  assertEqual(runSummary(next).gemsCarried, 0, 'and is no longer carrying it at risk');
});

unit('every sanctum can be walked to and back on the water its gate implies', () => {
  // The chain only works if the gem that opens a gate is also what makes the
  // walk to it survivable (DESIGN.md §4.4). This is the invariant that keeps
  // that true, and the one a retune of the distances or the water is most
  // likely to break silently — a sanctum nobody can return from is a gem the
  // player can never bank, and the game would just quietly dead-end there.
  for (const s of SANCTUMS) {
    const route = bfs(
      SEED,
      (x, y) => x === s.centre.x && y === s.centre.y,
      200,
      [0, 0],
      s.requires
    );
    const round = route.path.length * 2;
    const cap = maxWater(s.requires);
    assert(
      round <= cap,
      `sanctum ${s.index} is a ${round}-step round trip on ${cap} water — unreturnable`
    );
    // And it has to leave room to actually *find* the place, not just to walk a
    // route you already knew.
    assert(
      cap - round >= 50,
      `sanctum ${s.index} leaves only ${cap - round} steps of slack to search with`
    );
  }
});

unit('each gem gets a colour the world did not already have', () => {
  const base = gemColour(0);
  const colours = [1, 2, 3].map(gemColour);
  assert(!colours.includes(base), 'no gem hands back the colour already on screen');
  assertEqual(new Set(colours).size, 3, 'and the three differ from each other');
  // This is the rule the renderer paints an opened gate with: a gate wanting
  // gem N is drawn in gem N's colour once it opens (MapView.refresh).
  assertEqual(gemColour(SHUT_GATE.requires), colours[0], "gate 1 opens in gem 1's colour");
});

unit('a slot number is always one of the three', () => {
  assertEqual(SLOT_COUNT, 3, 'three campaigns can be walked at once');
  assertEqual(clampSlot(0), 1, 'below the first is the first');
  assertEqual(clampSlot(9), SLOT_COUNT, 'past the last is the last');
  assertEqual(clampSlot('x'), 1, 'and nonsense is the first');
});

unit('a slot counts as in use the moment there is anything in it', () => {
  assertEqual(normaliseSave(emptySave()).started, false, 'an empty save is an empty slot');
  assertEqual(normaliseSave({ ...emptySave(), started: true }).started, true, 'a claimed one is not');
  // The flag is belt and braces: a save with progress in it is somebody's
  // campaign whether or not the flag survived being hand-edited.
  for (const field of [{ runs: 2 }, { coins: 5 }, { gems: 1 }, { map: true }, { mapped: '0,0,1' }])
    assertEqual(normaliseSave({ ...emptySave(), ...field }).started, true, `${Object.keys(field)[0]} means used`);
});

unit('cheats hand a run the whole late game, and bank none of it', () => {
  const state = createRun(SEED, emptySave(), NONCE, { cheats: true });

  assertEqual(state.gems, MAX_GEMS, 'every colour is back');
  assertEqual(state.water, maxWater(MAX_GEMS), 'on the widest tank');
  assertEqual(state.coins, CHEAT_COINS, 'with a purse the merchant cannot exhaust');
  assertEqual([...state.tools].sort(), ['compass', 'map'], 'and both tools');

  const lights = Object.values(ITEMS).filter((def) => def.isLight).map((def) => def.id);
  assertEqual(state.inventory.length, lights.length, 'one of every light');
  for (const id of lights)
    assert(state.inventory.some((slot) => slot.id === id), `carrying the ${id}`);
  assertEqual(activeLight(state).id, 'torch-beacon', 'lit by the longest-burning one');

  // Far enough out to cover the fourth sanctum's ring and every landmark, which
  // is the whole point: the late game can be looked at without walking to it.
  const furthest = sanctums(SEED)[3];
  assert(
    state.explored.has(tileKey(furthest.centre.x, furthest.centre.y)),
    'the furthest sanctum is already drawn'
  );
  assert(state.explored.has(tileKey(CHEAT_REVEAL_RADIUS, CHEAT_REVEAL_RADIUS)), 'out to the corner');
  assert(state.seenUnique.has('gem-3'), 'and every unique object is markable on the map');

  // A run handed its gems is a sandbox, not a campaign, so nothing it does
  // reaches a slot (DESIGN.md §6.2).
  step(state, 'right');
  assertEqual(bankRun(state).gems, 0, 'stopping at the hut banks nothing');
  assertEqual(rememberGround(state).mapped, '', 'and not even the ground it was handed');
});

unit('a corrupt or hand-edited save cannot break a run', () => {
  for (const bad of [null, 'nonsense', { gems: 99 }, { gems: -4 }, { gems: 'two', coins: NaN }]) {
    const state = createRun(SEED, bad, NONCE);
    assert(state.gems >= 0 && state.gems <= MAX_GEMS, `gems clamped for ${JSON.stringify(bad)}`);
    assertEqual(state.water, maxWater(state.gems), 'water matches whatever gem count survived');
  }
});

// --- The world's three layers ------------------------------------------------

unit('rock thins out to about a fifth of the world', () => {
  let rock = 0;
  let total = 0;
  for (let y = -70; y <= 70; y++)
    for (let x = -70; x <= 70; x++) {
      if (sanctumAt(x, y, SEED) || landmarkAt(x, y, SEED)) continue;
      total += 1;
      if (terrainAt(x, y, SEED) === 'rock') rock += 1;
    }
  const share = rock / total;
  // Enough to grow caves worth navigating, few enough that the world reads as
  // floor with rock in it rather than the other way round.
  assert(share > 0.15 && share < 0.26, `rock covers ${(share * 100).toFixed(1)}% of the world`);
});

unit('rock comes in two formations that draw the same tile', () => {
  // Masses grown on a lattice, and boulders thrown as white noise into the open
  // ground between them. They are the same terrain and so the same sprite —
  // what a player meets is a wall to walk round or a stone to step past, and
  // the second is what keeps a wide stretch of floor from being an empty screen.
  let masses = 0;
  let loose = 0;
  for (let y = -70; y <= 70; y++)
    for (let x = -70; x <= 70; x++) {
      if (sanctumAt(x, y, SEED) || landmarkAt(x, y, SEED)) continue;
      if (terrainAt(x, y, SEED) !== 'rock') continue;
      const alone = ORTHOGONAL.every(([dx, dy]) => terrainAt(x + dx, y + dy, SEED) !== 'rock');
      if (alone) loose += 1;
      else masses += 1;
    }
  assert(loose > 150, `only ${loose} boulders stand on their own`);
  assert(masses > loose * 5, 'the masses should still be most of the rock in the world');
});

unit('trees grow in groves and stop a step the way rock does', () => {
  let trees = 0;
  let total = 0;
  let inAStand = 0;
  for (let y = -70; y <= 70; y++)
    for (let x = -70; x <= 70; x++) {
      if (sanctumAt(x, y, SEED) || landmarkAt(x, y, SEED)) continue;
      total += 1;
      if (terrainAt(x, y, SEED) !== 'tree') continue;
      trees += 1;
      assert(!isWalkable(x, y, SEED), `(${x},${y}) is a tree and should block`);
      assertEqual(entryCost(x, y, SEED), null, 'no number of gems opens a tree');
      if (ORTHOGONAL.some(([dx, dy]) => terrainAt(x + dx, y + dy, SEED) === 'tree')) inAStand += 1;
    }
  const share = trees / total;
  // Enough that a walk meets one, few enough that the world is still mostly
  // ground: trees block, so every one of them is floor the player lost.
  assert(share > 0.04 && share < 0.1, `trees cover ${(share * 100).toFixed(1)}% of the world`);
  // Groves, not scattered trunks — that is what the coarse lattice buys.
  assert(inAStand / trees > 0.9, 'nearly every tree should have another beside it');
});

unit('the ground holds something about one floor tile in 35', () => {
  // The density dial (core/world.js MIN_SEPARATION), pinned: playtesting moved
  // it because a walk was crossing screenfuls of lit ground with nothing on
  // any of them, and the thing that regresses silently is this number.
  let items = 0;
  let floor = 0;
  for (let y = -70; y <= 70; y++)
    for (let x = -70; x <= 70; x++) {
      if (sanctumAt(x, y, SEED) || terrainAt(x, y, SEED) !== 'floor') continue;
      floor += 1;
      if (consumableAt(x, y, SEED, SALT, 0)) items += 1;
    }
  const share = items / floor;
  assert(share > 0.025 && share < 0.035, `one floor tile in ${(floor / items).toFixed(0)}`);
});

unit('no two of the same consumable ever land within the separation distance', () => {
  // The anti-clustering promise, asserted outright rather than sampled: with a
  // Chebyshev minimum of MIN_SEPARATION, no square that wide can hold two of a
  // kind anywhere in the sample.
  const byKind = new Map();
  for (let y = -70; y <= 70; y++)
    for (let x = -70; x <= 70; x++) {
      // A sanctum clearing is a deliberate hoard and has its own rule below.
      if (sanctumAt(x, y, SEED)) continue;
      const id = consumableAt(x, y, SEED, SALT, 0);
      if (!id) continue;
      if (!byKind.has(id)) byKind.set(id, []);
      byKind.get(id).push([x, y]);
    }
  assert(byKind.size >= 4, 'the sample should contain several kinds');

  for (const [id, points] of byKind) {
    assert(points.length > 10, `${id} should appear often enough to be worth checking`);
    for (let i = 0; i < points.length; i++)
      for (let j = i + 1; j < points.length; j++) {
        const gap = chebyshev(points[i][0], points[i][1], points[j][0], points[j][1]);
        assert(
          gap >= MIN_SEPARATION,
          `two ${id} landed ${gap} apart at ${points[i]} and ${points[j]}`
        );
      }
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
      assert(count <= 2, `sanctum ${sanctum.index} holds ${count} of ${id}`);
    assert(Object.keys(tally).length >= 3, `sanctum ${sanctum.index} should hold a cache`);
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
      if (before || after) {
        if (before === after) same += 1;
        else moved += 1;
      }
      assertEqual(uniqueAt(x, y, SEED), uniqueAt(x, y, SEED), 'unique objects are seed-only');
    }
  assert(moved > same, 'a different nonce should lay the consumables out differently');

  // The gems, the merchant and the two tools are exactly where they were.
  for (const sanctum of sanctums(SEED))
    if (sanctum.gem)
      assertEqual(uniqueAt(sanctum.centre.x, sanctum.centre.y, SEED), sanctum.gem, 'the gem');
  for (const landmark of landmarks(SEED))
    assertEqual(uniqueAt(landmark.x, landmark.y, SEED), landmark.item, `the ${landmark.id}`);
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
  assert(
    after.some((key) => !before.includes(key)),
    'and puts it somewhere new'
  );
  assertEqual(itemOnTile(state, state.x, state.y), null, 'never under the character');
});

unit('a gem and a stop at the hut are what respawn the world', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  const start = state.epoch;

  // Walking about doesn't.
  for (const dir of ['right', 'right', 'up', 'up']) step(state, dir);
  assertEqual(state.epoch, start, 'ordinary steps leave the world where it is');

  // Stepping back onto the hut does.
  const home = bfs(SEED, (x, y) => x === 0 && y === 0, 24, [state.x, state.y]);
  let result = null;
  for (const dir of home.path) result = step(state, dir);
  assertEqual(result.atBase, true, 'back at the hut');
  assertEqual(result.respawned, true, 'which relays the world');
  assertEqual(state.epoch, start + 1, 'one respawn');

  // And so does a gem: the first sanctum's arch stands open.
  const gemRun = createRun(SEED, emptySave(), NONCE);
  let last = null;
  for (const dir of GEM_ROUTE.path) last = step(gemRun, dir);
  assertEqual(last.gemFound, 1, 'the first colour');
  assertEqual(last.respawned, true, 'a gem relays the world too');
  assertEqual(gemRun.epoch, 1, 'one respawn');
});

unit('a coin is a small pile, and it adds up', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  const coin = bfs(SEED, (x, y) => scatter(x, y) === 'coin', 60);
  let result = null;
  for (const dir of coin.path) result = step(state, dir);
  assertEqual(result.picked, 'coin', 'walked onto a coin');
  assert(result.coinsGained >= 1 && result.coinsGained <= 5, 'a pile is worth one to five');
  assertEqual(state.coins, result.coinsGained, 'and that is what the run banked');
});

// --- Landmarks: the merchant and the two tools -------------------------------

unit('the merchant stands one walk from the hut, and there is only one', () => {
  const found = landmarks(SEED).filter((l) => l.id === 'merchant');
  assertEqual(found.length, 1, 'exactly one merchant');
  const distance = chebyshev(found[0].x, found[0].y);
  assert(distance >= 20 && distance <= 25, `the merchant sits ${distance} tiles out`);
  assertEqual(isMerchant(found[0].x, found[0].y, SEED), true, 'and the tile says so');
  assertEqual(terrainAt(found[0].x, found[0].y, SEED), 'floor', 'you can stand on it');
});

unit('every landmark can be walked to from the hut, on any seed', () => {
  for (let i = 0; i < 8; i++) {
    const picked = pickSeed((DEFAULT_SEED + i * 7919) | 0);
    assert(landmarksReachable(picked), `seed ${picked} seals a landmark off`);
    // And each sits on ground, with a clearing around it.
    for (const landmark of landmarks(picked))
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          assertEqual(
            isWalkable(landmark.x + dx, landmark.y + dy, picked),
            true,
            `${landmark.id}'s apron is walkable`
          );
  }
});

unit('the compass and the map lie out in the dark, one of each', () => {
  for (const id of ['compass', 'map']) {
    const landmark = landmarkNamed(id, SEED);
    assert(landmark, `the world places a ${id}`);
    assertEqual(uniqueAt(landmark.x, landmark.y, SEED), id, 'and it is lying on its tile');
    assert(chebyshev(landmark.x, landmark.y) > 25, `the ${id} is a proper walk out`);
  }

  // Owning one takes it off the ground: it was the same object.
  const compass = landmarkNamed('compass', SEED);
  const without = createRun(SEED, emptySave(), NONCE);
  assertEqual(itemOnTile(without, compass.x, compass.y), 'compass', 'there for a run without one');
  const with_ = createRun(SEED, { ...emptySave(), compass: true }, NONCE);
  assertEqual(itemOnTile(with_, compass.x, compass.y), null, 'gone for a run that owns one');
});

// --- The merchant's counter ---------------------------------------------------

unit('the merchant spends banked coins before the ones you are carrying', () => {
  const state = createRun(SEED, { ...emptySave(), coins: 30 }, NONCE);
  state.coins = 10; // as if this run had found a pile
  assertEqual(spendable(state), 40, 'the purse is both');

  assertEqual(buy(state, 'torch-medium'), 'torch-medium', 'bought');
  assertEqual(state.banked.coins, 5, 'the bank paid first');
  assertEqual(state.coins, 10, 'and the pocket is untouched');
  assertEqual(spendable(state), 15, 'the purse is down by the price');
  assertEqual(state.inventory.length, 2, 'the torch arrived');
  assertEqual(state.activeIndex, 0, 'unequipped, like any other light');

  // Once the bank is empty the pocket pays the rest.
  assertEqual(buy(state, 'torch-small'), 'torch-small', 'bought the cheap one');
  assertEqual(state.banked.coins, 0, 'bank drained');
  assertEqual(state.coins, 5, 'the rest came out of the pocket');
});

unit('the merchant refuses what you cannot afford and sells one compass', () => {
  const state = createRun(SEED, { ...emptySave(), coins: PRICES.compass }, NONCE);
  assertEqual(canBuy(state, 'map'), false, 'the map is out of reach');
  assertEqual(buy(state, 'map'), null, 'and refuses to sell');

  assertEqual(buy(state, 'compass'), 'compass', 'the compass is affordable');
  assertEqual(state.tools.has('compass'), true, 'and owned');
  assertEqual(canBuy(state, 'compass'), false, 'there is only one');
  assertEqual(buy(state, 'compass'), null, 'so it will not sell a second');

  // Water and lights have no such limit.
  const rich = createRun(SEED, { ...emptySave(), coins: 1000 }, NONCE);
  rich.water = 10;
  for (let i = 0; i < 4; i++) assertEqual(buy(rich, 'water-drop'), 'water-drop', 'water again');
  assertEqual(rich.water, 10 + 4 * ITEMS['water-drop'].water, 'each one refilled');
  for (let i = 0; i < 3; i++) assertEqual(buy(rich, 'torch-lamp'), 'torch-lamp', 'lights again');
  assertEqual(rich.inventory.length, 4, 'three lamps on top of the starting torch');
});

unit('a tool is only kept if the run banks it at the hut', () => {
  const bought = createRun(SEED, { ...emptySave(), coins: 200 }, NONCE);
  buy(bought, 'compass');
  assertEqual(runSummary(bought).toolsCarried, ['compass'], 'carrying it home is the risk');

  // Dying writes nothing, so the compass — and the coins that paid for it — are
  // both still where they were.
  const banked = bankRun(createRun(SEED, { ...emptySave(), coins: 200 }, NONCE));
  assertEqual(banked.compass, false, 'a run that never bought one banks none');

  const kept = bankRun(bought);
  assertEqual(kept.compass, true, 'stopping at the hut keeps it');
  assertEqual(kept.coins, 200 - PRICES.compass, 'and the coins really were spent');

  // The next run starts owning it.
  assertEqual(createRun(SEED, kept, NONCE).tools.has('compass'), true, 'yours from now on');
});

// --- The compass ---------------------------------------------------------------

unit('the compass points at the nearest thing it can actually reach', () => {
  const state = createRun(SEED, { ...emptySave(), compass: true }, NONCE);

  // From the hut, everything is available except the gems behind shut gates.
  const first = compassTarget(state);
  const reachable = sanctums(SEED)
    .filter((s) => s.gem && s.requires <= 0)
    .concat(landmarks(SEED).map((l) => ({ centre: { x: l.x, y: l.y } })));
  const nearest = Math.min(
    ...reachable.map((t) => chebyshev(t.centre.x, t.centre.y, state.x, state.y))
  );
  assertEqual(first.distance, nearest, 'it points at the nearest of them');

  // A gem behind a gate this run cannot open is not a target.
  const shut = sanctums(SEED).find((s) => s.requires > 0);
  const targets = [];
  for (let g = 0; g <= 3; g++) {
    const run = createRun(SEED, { ...emptySave(), gems: g, compass: true }, NONCE);
    targets.push(compassTarget(run).id);
  }
  assert(!targets[0].startsWith('gem-2'), 'the second gem is not offered with no gems');
  assert(shut, 'the world has a gated sanctum');

  // With everything taken and both tools owned, only the hut is left.
  const done = createRun(
    SEED,
    { ...emptySave(), gems: MAX_GEMS, compass: true, map: true },
    NONCE
  );
  done.x = 30;
  done.y = 30;
  assertEqual(compassTarget(done).id, 'hut', 'and then it points home');
  assertEqual(compassTarget(done).distance, 30, 'from wherever you are');
});

// --- The map -------------------------------------------------------------------

unit('the ground a run lit carries into the next one, map or no map', () => {
  const walked = new Set(['0,0', '1,0', '2,0', '3,0', '-4,7', '-3,7']);
  const encoded = encodeExplored(walked);
  const back = decodeExplored(encoded);
  assertEqual(back.size, walked.size, 'round trip keeps every tile');
  for (const key of walked) assert(back.has(key), `kept ${key}`);
  assertEqual(decodeExplored('not a map;4,x,2').size, 0, 'and a corrupt one costs the drawing');

  // Cartography is not progress (DESIGN.md §6.1): owning the map changes what
  // you can look at, never what the slot remembers.
  const plain = createRun(SEED, emptySave(), NONCE);
  for (const dir of ['right', 'right', 'right', 'up', 'up']) step(plain, dir);
  const saved = bankRun(plain);
  assert(saved.mapped.length > 0, 'a run without the map still writes its ground');
  assertEqual(saved.mappedSeed, SEED, 'against the world it belongs to');

  const next = createRun(SEED, saved, NONCE);
  assertEqual(next.explored.size, plain.explored.size, 'the next run opens with it drawn');

  // Ground drawn in another world is discarded rather than drawn wrong.
  const elsewhere = createRun(SEED, { ...saved, mappedSeed: (SEED + 1) | 0 }, NONCE);
  assert(elsewhere.explored.size < next.explored.size, 'a stale drawing is dropped');
});

unit('a run that never gets home keeps its ground and nothing else', () => {
  // `rememberGround` writes to the active slot, which is localStorage — absent
  // in Node, so what it hands back is the normalised save it would have stored.
  const state = createRun(SEED, { ...emptySave(), coins: 40, runs: 3 }, NONCE);
  for (const dir of ['right', 'right', 'up']) step(state, dir);
  state.coins = 25;
  state.tools.add('compass');

  const kept = rememberGround(state);
  assert(kept.mapped.length > 0, 'the walk is written down');
  assertEqual(kept.mappedSeed, SEED, 'against the world it belongs to');
  assertEqual(kept.coins, 0, 'but nothing the run was carrying is banked');
  assertEqual(kept.compass, false, 'not even a tool it found on the way');
  assertEqual(kept.runs, 0, 'and a run that never got home is not a run completed');
});

unit('the map only marks unique objects the run has actually seen', () => {
  const state = createRun(SEED, { ...emptySave(), map: true }, NONCE);
  assertEqual(state.seenUnique.size, 0, 'nothing seen from the doorway');

  // Walk to the first gem: its sanctum and the gem itself become markable.
  for (const dir of GEM_ROUTE.path) step(state, dir);
  assert(state.seenUnique.has('gem-1'), 'the gem it walked onto is on the map');
  assert(!state.seenUnique.has('map'), 'and the map lying 90 tiles out is not');
});

// --- The tile sheet ---------------------------------------------------------

// A stand-in for the sheet: every tile is its own coordinate written into the
// mask — the first four rows spell out the column and the row, low nibble then
// high — so no two tiles come out alike and a sprite can be traced back to the
// tile it was cut from without a browser.
function fakeSheet(col, row) {
  const lit = [col % 16, Math.floor(col / 16), row % 16, Math.floor(row / 16)];
  return Array.from({ length: 16 }, (_, y) =>
    Array.from({ length: 16 }, (_, x) => (y < lit.length && x === lit[y] ? '#' : '.')).join('')
  );
}

unit('every tile the table names is on the sheet', () => {
  for (const [key, tile] of Object.entries(TILES)) {
    // A key names one [col, row], or a list of them to alternate between.
    const pairs = Array.isArray(tile[0]) ? tile : [tile];
    assert(pairs.length === variantCount(key), `${key}: the variant count matches the table`);
    for (const pair of pairs) {
      assert(Array.isArray(pair) && pair.length === 2, `${key} is a [col, row] pair`);
      const [col, row] = pair;
      assert(
        Number.isInteger(col) && col >= 0 && col < SHEET_COLS,
        `${key}: column ${col} is on the sheet`
      );
      assert(
        Number.isInteger(row) && row >= 0 && row < SHEET_ROWS,
        `${key}: row ${row} is on the sheet`
      );
    }
  }
});

unit('every sprite is 16x16 and comes from the tile it was pointed at', () => {
  const sprites = buildSprites(fakeSheet);

  for (const [key, mask] of Object.entries(sprites)) {
    assertEqual(mask.length, 16, `${key} row count`);
    for (const row of mask) assertEqual(row.length, 16, `${key} row width`);
  }

  // Nothing the table names goes missing on the way through.
  for (const key of Object.keys(TILES)) assert(sprites[key], `${key} was cut from the sheet`);

  // A tile repointed in the table is what the sprite is drawn from: the gem is
  // the tile at its own coordinates and not, say, the coin's.
  assertEqual(sprites.gem, fakeSheet(...TILES.gem), 'the gem is its own tile');
  assert(sprites.gem !== sprites.coin, 'and not the coin next to it');
});

unit('a terrain that alternates gets one sprite per tile, and the bare key is the first', () => {
  const sprites = buildSprites(fakeSheet);

  for (const key of ['rock', 'tree']) {
    const count = variantCount(key);
    assert(count > 1, `${key} alternates`);
    TILES[key].forEach((tile, n) =>
      assertEqual(sprites[`${key}-${n}`], fakeSheet(...tile), `${key}-${n} is the tile it names`)
    );
    assertEqual(sprites[key], sprites[`${key}-0`], `bare ${key} is the first of them`);

    // A roll anywhere in [0, 1) lands on one of them, and 1 would too if a
    // caller ever handed one over.
    const rolled = new Set();
    for (let i = 0; i <= 100; i++) rolled.add(variantKey(key, i / 100));
    assertEqual(rolled.size, count, `${key}: every tile is reachable`);
    for (const chosen of rolled) assert(sprites[chosen], `${chosen} exists`);
  }

  // A single-tile key is left alone: no suffix, no second texture.
  assertEqual(variantKey('coin', 0.99), 'coin', 'a single-tile key keeps its name');
});

unit('a sanctum ring draws corners on its corners and runs down its sides', () => {
  const radius = 4;
  // Walk the whole ring and check every tile against where it sits: the four
  // corners, then the runs between them.
  const seen = new Map();
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
      const piece = wallSprite(dx, dy, radius);
      seen.set(piece, (seen.get(piece) || 0) + 1);
    }
  }

  assertEqual(wallSprite(-radius, -radius, radius), 'wall-tl', 'top-left');
  assertEqual(wallSprite(radius, -radius, radius), 'wall-tr', 'top-right');
  assertEqual(wallSprite(-radius, radius, radius), 'wall-bl', 'bottom-left');
  assertEqual(wallSprite(radius, radius, radius), 'wall-br', 'bottom-right');
  assertEqual(wallSprite(0, -radius, radius), 'wall-t', 'the top run');
  assertEqual(wallSprite(0, radius, radius), 'wall-b', 'the bottom run');
  assertEqual(wallSprite(-radius, 0, radius), 'wall-l', 'the left run');
  assertEqual(wallSprite(radius, 0, radius), 'wall-r', 'the right run');

  // Each corner exactly once, and each run the length of a side between them.
  for (const corner of ['wall-tl', 'wall-tr', 'wall-bl', 'wall-br'])
    assertEqual(seen.get(corner), 1, `${corner} is a corner, so there is one`);
  for (const run of ['wall-t', 'wall-b', 'wall-l', 'wall-r'])
    assertEqual(seen.get(run), radius * 2 - 1, `${run} spans its side`);
  assertEqual(seen.get('wall'), undefined, 'and nothing on a ring needs the standalone piece');

  // Which is what the standalone piece is for.
  assertEqual(wallSprite(0, 0, radius), 'wall', 'a wall tile on no ring');

  // Every piece the ring asks for has to exist as a sprite.
  const sprites = buildSprites(fakeSheet);
  for (const piece of [...seen.keys(), 'wall']) assert(sprites[piece], `${piece} was cut`);
});

unit('each wizard facing is split into colour bands that rebuild the whole sprite', () => {
  const sprites = buildSprites(fakeSheet);
  for (const facing of ['down', 'up', 'right', 'left']) {
    const whole = sprites[`wizard-${facing}`];
    const bands = Array.from({ length: WIZARD_ZONES }, (_, z) => sprites[`wizard-${facing}-${z}`]);
    // Stacking the bands back up has to give exactly the silhouette they were
    // cut from — a band that drops a row loses pixels off the character.
    const stacked = whole.map((_, y) =>
      Array.from(whole[y], (_, x) => (bands.some((b) => b[y][x] !== '.') ? whole[y][x] : '.')).join('')
    );
    assertEqual(stacked, whole, `${facing}: the bands are the whole wizard`);
  }
});

unit('a floor tile draws its top and left edges, and closes the frontier', () => {
  const blank = () => Array.from({ length: 16 }, () => '.'.repeat(16));
  const sprites = buildSprites(blank);
  const dots = '#.#.#.#.#.#.#.#.';

  assertEqual(sprites.floor[0], dots, 'the top edge is always drawn');
  assert(
    sprites.floor.every((row, y) => (y % 2 === 0 ? row[0] === LIT : row[0] === '.')),
    'and so is the left one'
  );
  assertEqual(sprites.floor[15], '.'.repeat(16), 'the bottom is left to the neighbour below');
  assert(
    sprites.floor.every((row) => row[15] === '.'),
    'and the right to the neighbour beside'
  );

  // The frontier variants close the edges the plain tile leaves open.
  assert(
    sprites['floor-r'].every((row, y) => (y % 2 === 0 ? row[15] === LIT : row[15] === '.')),
    'floor-r closes the right edge'
  );
  assertEqual(sprites['floor-b'][15], dots, 'floor-b closes the bottom edge');
  assertEqual(sprites['floor-rb'][15], dots, 'floor-rb closes both');
  assertEqual(sprites['floor-rb'][0], dots.slice(0, 15) + '#', 'including the corner they share');
});

unit('floor texture is drawn at half strength, its border at full', () => {
  const solid = () => Array.from({ length: 16 }, () => '#'.repeat(16));
  const sprites = buildSprites(solid);

  // Row 1 is interior: all ground, none of it border.
  assertEqual(sprites.floor[1], DIM.repeat(16), 'the ground the tile stands on is dimmed');
  // Row 2 is interior with the left edge on it.
  assertEqual(sprites.floor[2], LIT + DIM.repeat(15), 'and the border over it is not');
  assertEqual(sprites.floor[0], '#.#.#.#.#.#.#.#.', 'the top edge replaces the texture under it');

  // Nothing else on the sheet is dimmed — a dim pixel anywhere but the floor
  // would be a second weight on an object, which the palette rule doesn't have.
  for (const [key, mask] of Object.entries(sprites)) {
    if (key.startsWith('floor')) continue;
    assert(!mask.join('').includes(DIM), `${key} is drawn at one strength`);
  }
});

// --- The real game in a browser --------------------------------------------

test('the title screen starts a run', async (game) => {
  assert(await game.hasText('NOUXINHA'), 'title');
  await game.startRun();
  assertEqual(await game.activeScene(), 'ExploreScene', 'scene');
});

test('a button responds across its whole width, not just the left half', async (game) => {
  // NEW GAME is a 240-wide button centred on (240, 566) (TitleScene.js), so its
  // right edge sits at x=360. Tapping 90px right of centre is still 30px
  // inside the button — Container.displayOriginX shifting the hit area left
  // by half the button's width (the bug this pins) would make this miss.
  await game.clickAt(330, 566);
  await game.waitForScene('SlotScene');
  assertEqual(await game.activeScene(), 'SlotScene', 'scene');
});

test('settings: picking a palette and going back both work on a single tap', async (game) => {
  await game.clickText('SETTINGS');
  await game.waitForScene('SettingsScene');
  assertEqual(await game.activeScene(), 'SettingsScene', 'scene');

  // Picking a row restarts the scene in the new palette — one tap, not several.
  await game.clickText('AMBER');
  await game.waitForScene('SettingsScene');
  assert(await game.hasText('AMBER'), 'still on the palette list, repainted');

  // Restore the default so this test doesn't change what every other test sees.
  await game.clickText('PHOSPHOR');
  await game.waitForScene('SettingsScene');

  await game.clickText('BACK');
  await game.waitForScene('TitleScene');
  assertEqual(await game.activeScene(), 'TitleScene', 'back to the title screen');
});

test('a run starts at the base with the small torch lit', async (game) => {
  await game.startRun();

  const state = await game.state();
  assertEqual({ x: state.x, y: state.y }, { x: 0, y: 0 }, 'starts on the base');
  assertEqual(state.inventory, [{ id: 'torch-small', durability: 100 }], 'inventory');
  assertEqual(state.explored, 9, 'the 3x3 block around the base is lit');

  const tiles = await game.visibleTiles();
  assertEqual(tiles.filter((t) => t.alpha === 1).length, 9, 'nine tiles at full brightness');
  assert(await game.hasText('EXPLORED 9'), 'the explored counter');

  // The wizard stands in the base's doorway, so the hut itself is only drawn
  // once they step off it — two dense sprites on one tile read as a blob.
  assert(!tiles.some((t) => t.overlay === 'base'), 'the hut is hidden under the wizard');
  await game.tapDpad('right');
  await game.settle();
  const after = await game.visibleTiles();
  const base = after.find((t) => t.x === 0 && t.y === 0);
  assertEqual(base.overlay, 'base', 'the hut is drawn once you step off it');
});

test('the d-pad walks and burns the torch', async (game) => {
  await game.startRun();

  await game.tapDpad('right');
  await game.settle();

  const state = await game.state();
  assertEqual({ x: state.x, y: state.y }, { x: 1, y: 0 }, 'moved one tile east');
  assertEqual(state.facing, 'right', 'facing');
  assertEqual(state.inventory[0].durability, 99, 'one durability spent');
  assertEqual(await game.wizardTexture(), 'wizard-right', 'the wizard turned');
});

test('swiping the map walks', async (game) => {
  await game.startRun();

  await game.swipe('down');
  await game.settle();

  const state = await game.state();
  assertEqual({ x: state.x, y: state.y }, { x: 0, y: 1 }, 'moved one tile south');
  assertEqual(await game.wizardTexture(), 'wizard-down', 'the wizard turned');
});

test('arrow keys walk', async (game) => {
  await game.startRun();

  await game.press('ArrowUp');
  await game.settle();

  const state = await game.state();
  assertEqual({ x: state.x, y: state.y }, { x: 0, y: -1 }, 'moved one tile north');
});

test('explored ground stays on screen, dimmed', async (game) => {
  await game.startRun();

  await game.tapDpad('right');
  await game.settle();
  await game.tapDpad('right');
  await game.settle();

  const tiles = await game.visibleTiles();
  const lit = tiles.filter((t) => t.alpha === 1);
  const remembered = tiles.filter((t) => t.alpha === 0.3);
  assertEqual(lit.length, 9, 'the light shape is still 9 tiles');
  assert(remembered.length > 0, 'ground walked past is still drawn, dimmed');
  // Everything drawn is either lit or remembered — unknown tiles are not drawn.
  assertEqual(lit.length + remembered.length, tiles.length, 'no third state on screen');
  assert(
    remembered.some((t) => t.x === 0 && t.y === 0),
    'the base is remembered from two tiles away'
  );
});

test('blackout shrinks memory to a fog of war around the character', async (game) => {
  await game.startRun();

  // One step off the base, then pace back and forth inside its forced-floor
  // neighbourhood (DESIGN.md §4.3) — never back onto the hut itself, so its
  // dialog never interrupts the loop — until the starting small torch (100
  // durability) burns all the way out.
  await game.tapDpad('right');
  await game.settle();
  for (let i = 0; i < 99; i++) {
    await game.tapDpad(i % 2 === 0 ? 'down' : 'up');
    await game.settle();
  }
  const state = await game.state();
  assertEqual(state.inventory.length, 0, 'the small torch is spent');

  const tiles = await game.visibleTiles();
  const lit = tiles.filter((t) => t.alpha === 1);
  const remembered = tiles.filter((t) => t.alpha === 0.3);
  assertEqual(lit.length, 1, 'only the tile underfoot is lit');
  assert(remembered.length > 0, 'a small ring of memory still shows around the character');
  assert(
    remembered.every(
      (t) =>
        Math.max(Math.abs(t.x - state.x), Math.abs(t.y - state.y)) <= BLACKOUT_MEMORY_RADIUS
    ),
    'nothing further out is drawn as remembered any more'
  );
});

test('a grove is drawn as trees, not as more rock', async (game) => {
  await game.startRun();
  for (const dir of TREE_ROUTE.path) {
    await game.tapDpad(dir);
    await game.settle();
  }

  const tiles = await game.visibleTiles();
  const drawn = tiles.filter((t) => terrainAt(t.x, t.y, SEED) === 'tree');
  assert(drawn.length > 0, 'the walk should end with a grove in the light');
  // Trees alternate between several tiles, so what is asserted is that the tile
  // drawn is one of the tree ones — never a rock one — and that it is the one
  // the world says belongs there, which is what keeps a grove from shimmering.
  for (const tile of drawn)
    assertEqual(
      tile.ground,
      variantKey('tree', variantAt(tile.x, tile.y, SEED)),
      `(${tile.x},${tile.y}) should be drawn as the tree the world put there`
    );
  // Terrain is the constant the gem colours read against (DESIGN.md §9), so a
  // tree is the palette's own foreground like the rock beside it.
  const rock = tiles.find((t) => t.ground.startsWith('rock'));
  if (rock) assertEqual(drawn[0].tint, rock.tint, 'trees are terrain, tinted like rock');

  // And they stop a step the way rock does.
  const into = ORTHOGONAL.map(([dx, dy], i) => [['right', 'left', 'down', 'up'][i], dx, dy]).find(
    ([, dx, dy]) => terrainAt(TREE_ROUTE.x + dx, TREE_ROUTE.y + dy, SEED) === 'tree'
  );
  const before = await game.state();
  await game.tapDpad(into[0]);
  await game.settle();
  const after = await game.state();
  assertEqual({ x: after.x, y: after.y }, { x: before.x, y: before.y }, 'did not move');
});

test('the music follows the scene: the menus get one loop, the dark another', async (game) => {
  assertEqual(await game.musicTrack(), 'menu', 'the title screen has its own small loop');
  await game.clickText('SETTINGS');
  await game.waitForScene('SettingsScene');
  assertEqual(await game.musicTrack(), 'menu', 'and it carries on across the menus');
  await game.clickText('BACK');
  await game.waitForScene('TitleScene');

  await game.startRun();
  // The loop is started by the scene and again by the first input, because a
  // page the player has not touched yet has no clock to schedule against.
  await game.tapDpad('right');
  await game.settle();
  assertEqual(await game.musicTrack(), 'explore', 'the dark gets the longer loop');

  // The X in the corner of the map, which is the way out of a run.
  await game.clickAt(456, 31);
  await game.waitForScene('TitleScene');
  assertEqual(await game.musicTrack(), 'menu', 'and the menus take theirs back');
});

test('every button taps back, and the D-pad does not', async (game) => {
  const taps = async () => (await game.sounds()).filter((s) => s === 'tap').length;
  assertEqual(await taps(), 0, 'nothing has been touched yet');

  await game.clickText('SETTINGS');
  await game.waitForScene('SettingsScene');
  assertEqual(await taps(), 1, 'a button makes a sound');
  await game.clickText('BACK');
  await game.waitForScene('TitleScene');
  assertEqual(await taps(), 2, 'so does the one that comes back');

  await game.startRun();
  // Walking is the one control tapped often enough that a sound on it would
  // turn an expedition into a rattle, so the D-pad is the exception.
  const before = await taps();
  for (const dir of ['right', 'up', 'left']) {
    await game.tapDpad(dir);
    await game.settle();
  }
  assertEqual(await taps(), before, 'the D-pad walks silently');

  // The HUD is buttons again, so it is audible again.
  await game.tapCoins();
  assertEqual(await taps(), before + 1, 'the coin counter is a button like any other');
});

test('the music switch turns the loop off and keeps it off', async (game) => {
  await game.clickText('SETTINGS');
  await game.waitForScene('SettingsScene');
  assert(await game.hasText('MUSIC: ON'), 'on by default');
  await game.clickText('MUSIC: ON');
  assert(await game.hasText('MUSIC: OFF'), 'and the button says so once tapped');
  await game.clickText('BACK');
  await game.waitForScene('TitleScene');

  await game.startRun();
  await game.tapDpad('right');
  await game.settle();
  assertEqual(await game.music(), false, 'a run started with it off stays silent');
});

test('the tile border switch turns the dotted line off, and back on', async (game) => {
  await game.startRun();
  await game.tapDpad('right');
  await game.settle();

  const bordered = (await game.visibleTiles()).filter((t) => t.ground.startsWith('floor'));
  assert(bordered.length > 0, 'floor tiles are on screen');
  assert(
    bordered.every((t) => t.ground === 'floor' || /^floor-[rb]+$/.test(t.ground)),
    'and drawn with the border by default'
  );

  await game.clickAt(456, 31);
  await game.waitForScene('TitleScene');
  await game.clickText('SETTINGS');
  await game.waitForScene('SettingsScene');
  assert(await game.hasText('TILE BORDER: ON'), 'on by default');
  await game.clickText('TILE BORDER: ON');
  assert(await game.hasText('TILE BORDER: OFF'), 'and the button says so once tapped');
  await game.clickText('BACK');
  await game.waitForScene('TitleScene');

  await game.startRun();
  await game.tapDpad('right');
  await game.settle();
  const plain = (await game.visibleTiles()).filter((t) => t.ground.startsWith('floor'));
  assert(plain.length > 0, 'floor tiles are still on screen');
  assert(plain.every((t) => t.ground === 'floor-plain'), 'and none of them draw the border');

  // Leaves the switch as it found it, so it doesn't change what every other
  // test sees.
  await game.clickAt(456, 31);
  await game.waitForScene('TitleScene');
  await game.clickText('SETTINGS');
  await game.waitForScene('SettingsScene');
  await game.clickText('TILE BORDER: OFF');
  assert(await game.hasText('TILE BORDER: ON'), 'restored');
  await game.clickText('BACK');
});

test('walking into rock bumps instead of moving', async (game) => {
  await game.startRun();
  for (const dir of ROCK_ROUTE.path) {
    await game.tapDpad(dir);
    await game.settle();
  }

  const before = await game.state();
  await game.tapDpad(ROCK_ROUTE.hit);
  await game.settle();
  const after = await game.state();

  assertEqual({ x: after.x, y: after.y }, { x: before.x, y: before.y }, 'did not move');
  assertEqual(after.inventory[0].durability, before.inventory[0].durability, 'no durability spent');
});

test('the item card shows what a torch does', async (game) => {
  await game.startRun();

  await game.tapSlot(0);
  assert(await game.hasText('SMALL TORCH'), 'the item name');
  assert(await game.hasText('DURABILITY  100 / 100'), 'durability readout');
  assert(await game.hasText(ITEMS['torch-small'].effect), 'effect text');
  assert(await game.hasText('EQUIPPED'), 'the active light reads as equipped');
  assertEqual((await game.state()).cardOpen, true, 'card is open');

  await game.clickText('CLOSE');
  assertEqual((await game.state()).cardOpen, false, 'card is closed');
});

test('the coin counter opens the coin card', async (game) => {
  await game.startRun();

  await game.tapCoins();
  assert(await game.hasText('COINS'), 'the coin card');
  assert(await game.hasText(ITEMS.coin.effect), 'effect text');
  await game.clickText('CLOSE');
  assertEqual((await game.state()).cardOpen, false, 'card is closed');
});

test('the HUD tracks water, and the water counter opens its card', async (game) => {
  await game.startRun();

  assert(await game.hasText('WATER 200/200'), 'starts full');

  await game.tapDpad('right');
  await game.settle();
  assert(await game.hasText('WATER 199/200'), 'a step burns one water, same as durability');
  assertEqual((await game.state()).water, 199, 'the model agrees');

  await game.tapWater();
  assert(await game.hasText('WATER DROP'), 'the water drop card');
  assert(await game.hasText(ITEMS['water-drop'].effect), 'effect text');
  await game.clickText('CLOSE');
  assertEqual((await game.state()).cardOpen, false, 'card is closed');
});

test('finding a torch and equipping it widens the light', async (game) => {
  await game.startRun();

  for (const dir of TORCH_ROUTE.path) {
    await game.tapDpad(dir);
    await game.settle();
  }

  let state = await game.state();
  assertEqual(state.inventory.length, 2, 'the torch was picked up');
  assertEqual(state.inventory[1].id, 'torch-medium', 'which torch');
  assertEqual(state.activeIndex, 0, 'a found light arrives unequipped');
  assertEqual((await game.visibleTiles()).filter((t) => t.alpha === 1).length, 9, 'still radius 1');

  assert((await game.sounds()).includes('pickup'), 'picking the torch up blipped');

  await game.tapSlot(1);
  await game.clickText('EQUIP');

  state = await game.state();
  assertEqual(state.activeIndex, 1, 'the medium torch is equipped');
  assertEqual((await game.sounds()).slice(-1)[0], 'torch', 'and it is heard catching');
  assertEqual(
    (await game.visibleTiles()).filter((t) => t.alpha === 1).length,
    25,
    'the lit shape grew to radius 2'
  );
}, { query: WORLD });

test('collecting two of the same torch stacks them in the HUD, badged with a count', async (game) => {
  await game.startRun();

  for (const leg of MEDIUM_TORCH_CHAIN.slice(0, 2))
    for (const dir of leg) {
      await game.tapDpad(dir);
      await game.settle();
    }

  const state = await game.state();
  assertEqual(state.inventory.length, 3, 'small torch plus two mediums');
  assert(await game.hasText('x2'), 'the medium torch slot is badged with its count');

  // The HUD strip still only shows one slot for the stack.
  await game.tapSlot(1);
  assertEqual((await game.state()).cardOpen, true, 'the stack opens one card');
  assert(await game.hasText('MEDIUM TORCH'), 'the stacked item\'s name');
}, { query: WORLD });

test('the inventory panel lists every stack and opens the tapped one', async (game) => {
  await game.startRun();

  for (const leg of MEDIUM_TORCH_CHAIN.slice(0, 2))
    for (const dir of leg) {
      await game.tapDpad(dir);
      await game.settle();
    }

  await game.tapInventory();
  assertEqual((await game.state()).inventoryOpen, true, 'the panel is open');
  assert(await game.hasText('INVENTORY'), 'panel title');
  assert(await game.hasText('SMALL TORCH'), 'lists the small torch stack');
  assert(await game.hasText('MEDIUM TORCH'), 'lists the medium torch stack');
  assert(await game.hasText('CARRYING 2'), 'the medium stack shows its count');

  await game.tapInventoryRow(1);
  const state = await game.state();
  assertEqual(state.inventoryOpen, false, 'tapping a row closes the panel');
  assertEqual(state.cardOpen, true, 'and opens that stack\'s item card');
  assert(await game.hasText('MEDIUM TORCH'), 'the right stack\'s card');
}, { query: WORLD });

test('a multi-copy item card lists every instance and equips exactly the one tapped', async (game) => {
  await game.startRun();

  for (const leg of MEDIUM_TORCH_CHAIN)
    for (const dir of leg) {
      await game.tapDpad(dir);
      await game.settle();
    }

  let state = await game.state();
  assertEqual(state.inventory.length, MEDIUM_TORCH_COPIES + 1, 'small torch plus every medium');

  await game.tapSlot(1);
  assertEqual(
    (await game.texts()).filter((t) => t === '50 / 50').length,
    MEDIUM_TORCH_COPIES,
    'every copy is listed, even though only a few show at once'
  );

  const before = await game.scrollContentY();
  // Drag well past what the list can scroll, to also prove it clamps rather
  // than running the content off past its last row.
  await game.dragCardList(-200);
  const after = await game.scrollContentY();
  assert(after < before, 'the list scrolled');
  assertEqual(
    before - after,
    MEDIUM_TORCH_COPIES * 40 - 120,
    'scroll clamps to the content height, not the drag distance'
  );

  // With the list scrolled all the way down, the bottom of the three visible
  // rows (visual slot 2) is now the last copy picked up — tapping it should
  // equip that exact copy, not whichever one happened to occupy that screen
  // position before scrolling.
  await game.tapCardInstance(2);
  state = await game.state();
  const last = MEDIUM_TORCH_COPIES; // the small torch holds flat index 0
  assertEqual(state.cardOpen, false, 'tapping an instance closes the card');
  assertEqual(state.activeIndex, last, 'the last copy picked up is now equipped');
  assertEqual(state.inventory[last].id, 'torch-medium', 'sanity: that slot really is a medium torch');
}, { query: WORLD });

test('the menu button returns to the title screen', async (game) => {
  await game.startRun();
  await game.clickAt(456, 31);
  await game.waitForScene('TitleScene');
  assertEqual(await game.activeScene(), 'TitleScene', 'scene');
});

test('walking back to the hut asks whether to stop', async (game) => {
  await game.startRun();

  await game.tapDpad('right');
  await game.settle();
  assertEqual((await game.state()).dialogOpen, false, 'nothing asks while you are out');

  await game.tapDpad('left');
  await game.settle();
  assertEqual((await game.state()).dialogOpen, true, 'the hut asks on arrival');
  assert(await game.hasText('BACK AT THE HUT'), 'the prompt');

  // The world is frozen behind the question.
  await game.tapDpad('right');
  assertEqual((await game.state()).x, 0, 'no stepping out from under the dialog');

  await game.clickText('KEEP GOING');
  assertEqual((await game.state()).dialogOpen, false, 'dismissed');

  await game.tapDpad('right');
  await game.settle();
  const state = await game.state();
  assertEqual({ x: state.x, y: state.y }, { x: 1, y: 0 }, 'and the run carries on');
});

test('keeping going at the hut refills water to the ceiling', async (game) => {
  await game.startRun();

  // A loop through the base's guaranteed-floor neighbourhood that only lands
  // back on the hut at the very end, so the water spend is real before the
  // dialog interrupts anything.
  for (const dir of ['right', 'up', 'left', 'down']) {
    await game.tapDpad(dir);
    await game.settle();
  }
  const before = await game.state();
  assertEqual({ x: before.x, y: before.y }, { x: 0, y: 0 }, 'back at the hut');
  assert(before.water < 200, 'water spent walking the loop');
  assertEqual(before.dialogOpen, true, 'the hut asks on arrival');

  await game.clickText('KEEP GOING');
  assert(await game.hasText('WATER REFILLED AT THE HUT.'), 'the status line says so');
  const after = await game.state();
  assertEqual(after.water, 200, 'topped back up to the ceiling');
  assert((await game.texts()).includes('WATER 200/200'), 'the HUD counter agrees');
});

test('stopping at the hut recaps the run before going home', async (game) => {
  await game.startRun();

  await game.tapDpad('right');
  await game.settle();
  await game.tapDpad('left');
  await game.settle();
  await game.clickText('STOP HERE');

  assert(await game.hasText('EXPEDITION OVER'), 'the recap');
  const texts = await game.texts();
  for (const label of ['TILES EXPLORED', 'COINS', 'LIGHTS FOUND', 'FURTHEST OUT', 'STEPS TAKEN'])
    assert(texts.includes(label), `the recap reports ${label}`);
  // One tile out and back: the 3x3 around the base plus the three tiles the
  // step east added, in two steps.
  assert(texts.includes('12'), 'the tiles-explored figure');
  assert(texts.includes('2'), 'the step count');
  assert(
    texts.some((t) => t.startsWith('CARRYING SMALL TORCH')),
    'what is still in hand'
  );

  await game.clickText('HOME');
  await game.waitForScene('TitleScene');
  assertEqual(await game.activeScene(), 'TitleScene', 'back to the title screen');
});

test('walking into the first sanctum restores a colour to the world', async (game) => {
  await game.startRun();

  assertEqual(
    (await game.wizardZoneTints())[1],
    gemColour(0),
    'the wizard starts in the palette foreground'
  );
  assertEqual((await game.state()).gems, 0, 'and with no colour to their name');

  for (const dir of GEM_ROUTE.path) {
    await game.tapDpad(dir);
    await game.settle();
  }

  const state = await game.state();
  assertEqual({ x: state.x, y: state.y }, FIRST_GEM.centre, 'standing on the gem');
  assertEqual(state.gems, 1, 'which is now in hand');
  // A gem gets the fanfare, not the two-note blip every other pickup gets.
  assert((await game.sounds()).includes('gem'), 'and it announced itself');
  assert(await game.hasText('FIRST COLOUR IS BACK. CARRY IT HOME TO KEEP IT.'), 'the status line');

  // The colour actually reached the screen — this is the whole point of a gem,
  // and it is only observable in the render.
  const zoneTints = await game.wizardZoneTints();
  assertEqual(zoneTints[0], gemColour(0), 'the base band stays the palette foreground');
  assertEqual(zoneTints[1], gemColour(1), 'the first gem band wears the colour it gave back');
  const tiles = await game.visibleTiles();
  assert(
    tiles.some((t) => t.ground.startsWith('wall')),
    'the sanctum around them is drawn as masonry, not as rock'
  );
  // The arch they walked in through is drawn open, in the palette's own colour
  // — this first sanctum is the one that never wanted a gem.
  const arch = tiles.find((t) => t.x === FIRST_GEM.gate.x && t.y === FIRST_GEM.gate.y);
  assertEqual(arch.ground, 'gate-open', 'the gateway is drawn as an open arch');
  assertEqual(arch.tint, gemColour(FIRST_GEM.requires), 'in the colour of whatever opened it');
  // Water rises with the gem, so the HUD's ceiling moves too.
  assert(await game.hasText(`WATER ${state.water}/${maxWater(1)}`), 'the water ceiling rose');
});

test('stopping at the hut writes the save, leaving by the X keeps only the ground', async (game) => {
  await game.startRun();
  // NEW GAME claims the slot, so there is a save — an empty one, with nothing
  // banked into it yet.
  assertEqual((await game.save()).runs, 0, 'a first run starts with nothing banked');

  // Out one tile and straight back, so the run banks without finding anything.
  await game.tapDpad('right');
  await game.settle();
  await game.tapDpad('left');
  await game.settle();
  await game.clickText('STOP HERE');

  assert(await game.hasText('COLOURS SAVED'), 'the recap reports what was banked');
  const saved = await game.save();
  assertEqual(saved.runs, 1, 'the run was written down');
  assertEqual(saved.gems, 0, 'with no colour on it');
  assert(saved.mapped.length > 0, 'and the ground it lit came home with it');

  await game.clickText('HOME');
  await game.waitForScene('TitleScene');
  assert(await game.hasText('0/3 COLOURS  0 COINS  1 RUNS'), 'and the title screen reads it back');

  // Abandoning by the map's X banks nothing — only the hut does (DESIGN.md §6)
  // — but the dark this run lit stays lit for the next one (§6.1).
  await game.startRun();
  const opened = await game.state();
  assert(opened.explored > 9, 'the next run opens on the ground already drawn');
  await game.tapDpad('right');
  await game.settle();
  await game.tapDpad('up');
  await game.settle();
  const abandoned = await game.state();
  await game.clickAt(456, 31);
  await game.waitForScene('TitleScene');

  const after = await game.save();
  assertEqual(after.runs, 1, 'the abandoned run was not counted');
  assertEqual(decodeExplored(after.mapped).size, abandoned.explored, 'but its walk was kept');
});

test('new game picks a slot, and load game brings that campaign back', async (game) => {
  // Three campaigns, and the picker says what is in all three (DESIGN.md §6.1).
  await game.clickText('NEW GAME');
  await game.waitForScene('SlotScene');
  for (const slot of ['SLOT 1', 'SLOT 2', 'SLOT 3'])
    assert(await game.hasText(slot), `${slot} is offered`);
  assertEqual((await game.texts()).filter((t) => t === 'EMPTY').length, 3, 'all three empty');

  // Bank a run in slot 2: out one tile, back, and stop at the hut.
  await game.clickText('SLOT 2');
  await game.waitForScene('ExploreScene');
  await game.tapDpad('right');
  await game.settle();
  await game.tapDpad('left');
  await game.settle();
  await game.clickText('STOP HERE');
  await game.clickText('HOME');
  await game.waitForScene('TitleScene');

  assertEqual(await game.save(1), null, 'slot 1 was never touched');
  assertEqual((await game.save(2)).runs, 1, 'and slot 2 has the campaign');

  await game.clickText('LOAD GAME');
  await game.waitForScene('SlotScene');
  assert(await game.hasText('0/3 COLOURS  0 COINS  1 RUNS'), 'the picker reads the slot back');
  assertEqual((await game.texts()).filter((t) => t === 'EMPTY').length, 2, 'the other two are free');

  await game.clickText('SLOT 2');
  await game.waitForScene('ExploreScene');
  const state = await game.state();
  assertEqual(state.banked.runs, 1, 'and loading it carries on where it left off');
  assert(state.explored > 9, 'on the ground that campaign had already lit');
});

test('cheats reveal the map, hand you everything, and save nothing', async (game) => {
  // The switch is in Settings, and the title screen says it is on, because a
  // run under it banks nothing (DESIGN.md §6.2).
  await game.clickText('SETTINGS');
  await game.waitForScene('SettingsScene');
  assert(await game.hasText('CHEATS: OFF'), 'off by default');
  await game.clickText('CHEATS: OFF');
  assert(await game.hasText('CHEATS: ON'), 'and the button says so once tapped');
  await game.clickText('BACK');
  await game.waitForScene('TitleScene');
  assert(await game.hasText('CHEATS ON — NOTHING WILL BE SAVED'), 'the title screen warns');

  await game.startRun();
  const state = await game.state();
  assertEqual(state.gems, 3, 'every colour is back');
  assertEqual(state.tools.sort(), ['compass', 'map'], 'both tools are in the corner');
  assertEqual(state.compassShown, true, 'the needle is there to read');
  assert(state.explored > 10000, 'and the world is drawn out past the last sanctum');

  // Straight back onto the hut, which is the one place a run can write itself.
  await game.tapDpad('right');
  await game.settle();
  await game.tapDpad('left');
  await game.settle();
  await game.clickText('STOP HERE');
  assert(await game.hasText('CHEATS ON — NOTHING WAS WRITTEN TO THE SLOT'), 'the recap says so');
  assertEqual((await game.save()).runs, 0, 'and the slot is untouched');
});

test('the whole game fits a portrait phone screen', async (game) => {
  // Phaser fits the canvas to #game, so if #game is not the viewport the canvas
  // overflows it — which used to push the map's X button off the side and let
  // the page pan sideways, swallowing taps.
  const phone = await game.openAnother({ viewport: { width: 390, height: 844 } });
  const fit = await phone.canvasFit();
  const where = JSON.stringify(fit);

  assert(fit.left >= -1 && fit.top >= -1, `canvas starts off screen: ${where}`);
  assert(fit.right <= fit.viewport.width + 1, `canvas runs off the side: ${where}`);
  assert(fit.bottom <= fit.viewport.height + 1, `canvas runs off the bottom: ${where}`);
  assert(!fit.pageScrollsX && !fit.pageScrollsY, `the page scrolls behind the canvas: ${where}`);
});


test('walking onto the merchant opens the counter, and buying spends the purse', async (game) => {
  await game.startRun();

  await walkPath(game, MERCHANT_ROUTE.path);

  let state = await game.state();
  assertEqual(state.shopOpen, true, 'arriving at the stall opens it');
  assert(await game.hasText('THE MERCHANT'), 'the counter');
  assert(await game.hasText(`YOU HAVE ${spendable(state)} COINS`), 'and what you can spend');

  // The first row is the water drop (src/data/shop.js STOCK).
  const before = { water: state.water, coins: spendable(state) };
  await game.tapShopRow(0);
  state = await game.state();
  assert(state.water > before.water, 'the drop refilled the tank');
  assertEqual(spendable(state), before.coins - PRICES['water-drop'], 'and cost its price');
  assertEqual(state.shopOpen, true, 'the counter stays open for another purchase');

  await game.clickText('LEAVE');
  assertEqual((await game.state()).shopOpen, false, 'and closes when you leave');
}, { query: WORLD, save: { ...emptySave(), coins: 200 } });

test('the coin counter shows the purse the merchant spends, not just this run', async (game) => {
  await game.startRun();

  const state = await game.state();
  assertEqual(state.coins, 0, 'this run has found nothing yet');
  assertEqual(state.banked.coins, 120, 'but there is a fortune banked');
  assert(await game.hasText('COINS 120'), 'and the counter says what can be spent');
}, { query: WORLD, save: { ...emptySave(), coins: 120 } });

test('the compass sits in the corner and points where the rules say', async (game) => {
  await game.startRun();

  const state = await game.state();
  assertEqual(state.compassShown, true, 'a run that owns one sees it');
  assertEqual(state.tools, ['compass'], 'and owns exactly that');

  const expected = compassTarget(createRun(SEED, { ...emptySave(), compass: true }, NONCE));
  assertEqual(state.compassTarget.sprite, expected.sprite, 'the icon is what it is pointing at');
  assert(
    ['arrow-up', 'arrow-right', 'arrow-down', 'arrow-left'].includes(state.compassTarget.arrow),
    'and the needle is one of the four headings'
  );
}, { query: WORLD, save: { ...emptySave(), compass: true } });

test('a run without the compass has no needle and no map button', async (game) => {
  await game.startRun();
  const state = await game.state();
  assertEqual(state.compassShown, false, 'nothing in the corner');
  assertEqual(state.tools, [], 'because nothing is owned');
});

test('the map draws the ground this run has walked', async (game) => {
  await game.startRun();

  for (const dir of ['right', 'right', 'up', 'up', 'up']) {
    await game.tapDpad(dir);
    await game.settle();
  }

  const before = await game.state();
  await game.tapMapButton();
  const open = await game.state();
  assertEqual(open.mapOpen, true, 'the map button opens it');
  assert(await game.hasText('THE MAP'), 'the overlay');
  assert(await game.hasText(`${before.explored} TILES WALKED`), 'and it draws what was lit');

  await game.clickText('CLOSE');
  assertEqual((await game.state()).mapOpen, false, 'and closes again');
}, { query: WORLD, save: { ...emptySave(), map: true } });

test('the tile sheet is loaded and cut into every sprite the game draws', async (game) => {
  const cut = await game.page.evaluate(async () => {
    const textures = await import('/src/ui/textures.js');
    const { SHEET_KEY } = await import('/src/data/tiles.js');
    const manager = window.__game.textures;
    const sheet = manager.get(SHEET_KEY).getSourceImage();
    return {
      sheet: { width: sheet.width, height: sheet.height },
      sprites: textures.spriteKeys().map((key) => {
        const frame = manager.getFrame(key);
        return { key, width: frame && frame.width, height: frame && frame.height };
      }),
    };
  });

  // 49x22 tiles of 16px, one transparent pixel apart (src/data/tiles.js).
  assertEqual(cut.sheet, { width: 832, height: 373 }, 'the sheet the page actually loaded');
  assert(cut.sprites.length > 0, 'and it was cut into sprites');
  for (const sprite of cut.sprites)
    assertEqual(
      { width: sprite.width, height: sprite.height },
      { width: 16, height: 16 },
      `${sprite.key} is one tile`
    );

  // The keys the renderer names have to be among them, or a tile draws blank.
  for (const key of ['floor', 'floor-rb', 'rock-2', 'tree-7', 'wall-tl', 'base', 'wizard-down-0'])
    assert(cut.sprites.some((s) => s.key === key), `${key} was cut`);
});

run();
