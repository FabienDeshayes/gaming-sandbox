// The Nouxinha suite. `unit(...)` tests exercise the pure core in Node;
// `test(...)` tests each drive a fresh page against the real canvas.
//
// See TESTING.md for how to run these and how to add one.

import { assert, assertEqual, run, test, unit } from './harness.js';
import { visibleTiles, tileKey } from '../src/core/light.js';
import {
  DEFAULT_SEED,
  isWalkable,
  itemAt,
  pickSeed,
  reachableFraction,
  terrainAt,
} from '../src/core/world.js';
import {
  activeLight,
  activeShape,
  createRun,
  equip,
  inventoryStacks,
  isBlackout,
  itemOnTile,
  litTiles,
  runSummary,
  step,
  STARTING_WATER,
} from '../src/core/rules.js';
import { ITEMS } from '../src/data/items.js';

// --- Routes through the real world -----------------------------------------
//
// Derived here rather than hardcoded, so a change to the noise moves the tests
// with it instead of silently invalidating them.

const SEED = pickSeed(DEFAULT_SEED);

function bfs(seed, isGoal, maxDepth = 24, start = [0, 0]) {
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
        if (prev.has(key) || !isWalkable(nx, ny, seed)) continue;
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
function bfsChain(seed, wantId, count, maxDepth = 24) {
  const used = new Set();
  let start = [0, 0];
  const legs = [];
  for (let i = 0; i < count; i++) {
    const found = bfs(seed, (x, y) => itemAt(x, y, seed) === wantId && !used.has(tileKey(x, y)), maxDepth, start);
    used.add(tileKey(found.x, found.y));
    legs.push(found.path);
    start = [found.x, found.y];
  }
  return legs;
}

// The nearest medium torch, the nearest water drop, and the nearest spot with
// a rock to walk into.
const TORCH_ROUTE = bfs(SEED, (x, y) => itemAt(x, y, SEED) === 'torch-medium');
const WATER_ROUTE = bfs(SEED, (x, y) => itemAt(x, y, SEED) === 'water-drop');
const ROCK_ROUTE = bfs(SEED, (x, y) => {
  const into = [['up', 0, -1], ['right', 1, 0], ['down', 0, 1], ['left', -1, 0]].find(
    ([, dx, dy]) => !isWalkable(x + dx, y + dy, SEED)
  );
  return into ? into[0] : null;
});
// Six copies of the same light, chained leg to leg — enough to overflow the
// item card's instance list and force it to scroll.
const MEDIUM_TORCH_CHAIN = bfsChain(SEED, 'torch-medium', 6);

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
  // own tile + 1 + 3 + 5
  assertEqual(lit.length, 10, 'tile count');
  assert(lit.some((t) => t.x === 0 && t.y === -3), 'reaches 3 ahead');
  assert(lit.some((t) => t.x === -2 && t.y === -3), 'is 5 wide at 3 ahead');
  assert(!lit.some((t) => t.y > 0), 'shows nothing behind');
});

unit('lamp torch re-aims with facing', () => {
  const right = visibleTiles(ITEMS['torch-lamp'].shape, 0, 0, 'right');
  assert(right.some((t) => t.x === 3 && t.y === 0), 'reaches 3 to the right');
  assert(!right.some((t) => t.x < 0), 'shows nothing behind');
});

unit('a step burns exactly one durability and sets facing', () => {
  const state = createRun(SEED);
  const before = activeLight(state).durability;
  const result = step(state, ROCK_ROUTE.path[0] || 'up');
  assert(result.moved, 'the first step off the base should be legal');
  assertEqual(activeLight(state).durability, before - 1, 'durability');
  assertEqual(state.steps, 1, 'steps');
});

unit('a step also burns one water, same as durability', () => {
  const state = createRun(SEED);
  const before = state.water;
  const result = step(state, ROCK_ROUTE.path[0] || 'up');
  assert(result.moved, 'the first step off the base should be legal');
  assertEqual(state.water, before - 1, 'water');
});

unit('walking onto a water drop refills water, capped at the starting amount', () => {
  const state = createRun(SEED);
  for (const dir of WATER_ROUTE.path) step(state, dir);
  const plainDepletion = STARTING_WATER - WATER_ROUTE.path.length;
  assert(state.water > plainDepletion, 'the drop topped water back up');
  assert(state.water <= STARTING_WATER, 'refill never exceeds the starting amount');
  assertEqual(itemOnTile(state, state.x, state.y), null, 'the drop is gone now');
});

unit('running out of water ends the run, and nothing else can move it again', () => {
  const state = createRun(SEED);
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
  const state = createRun(SEED);
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
  const state = createRun(SEED);
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
  const state = createRun(SEED);
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

unit('equipping a carried light changes what you can see', () => {
  const state = createRun(SEED);
  assertEqual(litTiles(state).length, 9, 'small torch');
  state.inventory.push({ id: 'torch-medium', durability: 50 });
  assert(equip(state, 1), 'equip should succeed');
  assertEqual(litTiles(state).length, 25, 'medium torch');
});

unit('inventoryStacks groups same-id copies while keeping their flat index', () => {
  const state = createRun(SEED);
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
  const state = createRun(SEED);
  for (const dir of TORCH_ROUTE.path) step(state, dir);
  assertEqual(state.inventory.length, 2, 'the torch is in the inventory');
  assertEqual(itemOnTile(state, state.x, state.y), null, 'the tile is empty now');
  assertEqual(itemAt(state.x, state.y, SEED), 'torch-medium', 'the pristine world still has it');
});

unit('a step reports arriving back at the hut', () => {
  const state = createRun(SEED);
  // The base clearing is forced floor, so stepping out and back is always legal.
  assertEqual(step(state, 'right').atBase, false, 'stepping off the hut');
  assertEqual(step(state, 'left').atBase, true, 'stepping back onto it');
  assertEqual({ x: state.x, y: state.y }, { x: 0, y: 0 }, 'home again');
});

unit('the run summary counts how far out you got and what you found', () => {
  const state = createRun(SEED);
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

// --- The real game in a browser --------------------------------------------

test('the title screen starts a run', async (game) => {
  assert(await game.hasText('NOUXINHA'), 'title');
  await game.clickText('EXPLORE');
  await game.waitForScene('ExploreScene');
  assertEqual(await game.activeScene(), 'ExploreScene', 'scene');
});

test('a button responds across its whole width, not just the left half', async (game) => {
  // EXPLORE is a 240-wide button centred on x=240 (TitleScene.js), so its
  // right edge sits at x=360. Tapping 90px right of centre is still 30px
  // inside the button — Container.displayOriginX shifting the hit area left
  // by half the button's width (the bug this pins) would make this miss.
  await game.clickAt(330, 540);
  await game.waitForScene('ExploreScene');
  assertEqual(await game.activeScene(), 'ExploreScene', 'scene');
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
  await game.clickText('EXPLORE');
  await game.waitForScene('ExploreScene');

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
  await game.clickText('EXPLORE');
  await game.waitForScene('ExploreScene');

  await game.tapDpad('right');
  await game.settle();

  const state = await game.state();
  assertEqual({ x: state.x, y: state.y }, { x: 1, y: 0 }, 'moved one tile east');
  assertEqual(state.facing, 'right', 'facing');
  assertEqual(state.inventory[0].durability, 99, 'one durability spent');
  assertEqual(await game.wizardTexture(), 'wizard-right', 'the wizard turned');
});

test('swiping the map walks', async (game) => {
  await game.clickText('EXPLORE');
  await game.waitForScene('ExploreScene');

  await game.swipe('down');
  await game.settle();

  const state = await game.state();
  assertEqual({ x: state.x, y: state.y }, { x: 0, y: 1 }, 'moved one tile south');
  assertEqual(await game.wizardTexture(), 'wizard-down', 'the wizard turned');
});

test('arrow keys walk', async (game) => {
  await game.clickText('EXPLORE');
  await game.waitForScene('ExploreScene');

  await game.press('ArrowUp');
  await game.settle();

  const state = await game.state();
  assertEqual({ x: state.x, y: state.y }, { x: 0, y: -1 }, 'moved one tile north');
});

test('explored ground stays on screen, dimmed', async (game) => {
  await game.clickText('EXPLORE');
  await game.waitForScene('ExploreScene');

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

test('walking into rock bumps instead of moving', async (game) => {
  await game.clickText('EXPLORE');
  await game.waitForScene('ExploreScene');
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
  await game.clickText('EXPLORE');
  await game.waitForScene('ExploreScene');

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
  await game.clickText('EXPLORE');
  await game.waitForScene('ExploreScene');

  await game.tapCoins();
  assert(await game.hasText('COIN'), 'the coin card');
  assert(await game.hasText(ITEMS.coin.effect), 'effect text');
  await game.clickText('CLOSE');
  assertEqual((await game.state()).cardOpen, false, 'card is closed');
});

test('the HUD tracks water, and the water counter opens its card', async (game) => {
  await game.clickText('EXPLORE');
  await game.waitForScene('ExploreScene');

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
  await game.clickText('EXPLORE');
  await game.waitForScene('ExploreScene');

  for (const dir of TORCH_ROUTE.path) {
    await game.tapDpad(dir);
    await game.settle();
  }

  let state = await game.state();
  assertEqual(state.inventory.length, 2, 'the torch was picked up');
  assertEqual(state.inventory[1].id, 'torch-medium', 'which torch');
  assertEqual(state.activeIndex, 0, 'a found light arrives unequipped');
  assertEqual((await game.visibleTiles()).filter((t) => t.alpha === 1).length, 9, 'still radius 1');

  await game.tapSlot(1);
  await game.clickText('EQUIP');

  state = await game.state();
  assertEqual(state.activeIndex, 1, 'the medium torch is equipped');
  assertEqual(
    (await game.visibleTiles()).filter((t) => t.alpha === 1).length,
    25,
    'the lit shape grew to radius 2'
  );
});

test('collecting two of the same torch stacks them in the HUD, badged with a count', async (game) => {
  await game.clickText('EXPLORE');
  await game.waitForScene('ExploreScene');

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
});

test('the inventory panel lists every stack and opens the tapped one', async (game) => {
  await game.clickText('EXPLORE');
  await game.waitForScene('ExploreScene');

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
});

test('a multi-copy item card lists every instance and equips exactly the one tapped', async (game) => {
  await game.clickText('EXPLORE');
  await game.waitForScene('ExploreScene');

  for (const leg of MEDIUM_TORCH_CHAIN)
    for (const dir of leg) {
      await game.tapDpad(dir);
      await game.settle();
    }

  let state = await game.state();
  assertEqual(state.inventory.length, 7, 'small torch plus six mediums');

  await game.tapSlot(1);
  assertEqual(
    (await game.texts()).filter((t) => t === '50 / 50').length,
    6,
    'all six copies are listed, even though only a few show at once'
  );

  const before = await game.scrollContentY();
  // Drag well past what the list can scroll, to also prove it clamps rather
  // than running the content off past its last row.
  await game.dragCardList(-200);
  const after = await game.scrollContentY();
  assert(after < before, 'the list scrolled');
  assertEqual(before - after, 6 * 40 - 120, 'scroll clamps to the content height, not the drag distance');

  // With the list scrolled all the way down, the bottom of the three visible
  // rows (visual slot 2) is now the sixth and last copy picked up — tapping
  // it should equip that exact copy, not whichever one happened to occupy
  // that screen position before scrolling.
  await game.tapCardInstance(2);
  state = await game.state();
  assertEqual(state.cardOpen, false, 'tapping an instance closes the card');
  assertEqual(state.activeIndex, 6, 'the last copy picked up is now equipped');
  assertEqual(state.inventory[6].id, 'torch-medium', 'sanity: that slot really is a medium torch');
});

test('the menu button returns to the title screen', async (game) => {
  await game.clickText('EXPLORE');
  await game.waitForScene('ExploreScene');
  await game.clickAt(456, 31);
  await game.waitForScene('TitleScene');
  assertEqual(await game.activeScene(), 'TitleScene', 'scene');
});

test('walking back to the hut asks whether to stop', async (game) => {
  await game.clickText('EXPLORE');
  await game.waitForScene('ExploreScene');

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

test('stopping at the hut recaps the run before going home', async (game) => {
  await game.clickText('EXPLORE');
  await game.waitForScene('ExploreScene');

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

run();
