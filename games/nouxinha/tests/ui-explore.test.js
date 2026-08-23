// Walking the dark: the controls, and the three visibility states the map
// viewport draws. Each test drives a fresh page against the real canvas.

import { assert, assertEqual, runIfMain } from './harness.js';
import { terrainAt, variantAt } from '../src/core/world.js';
import { variantKey } from '../src/data/tiles.js';
import { BLACKOUT_MEMORY_RADIUS } from '../src/balance.js';
import { ITEMS } from '../src/data/items.js';
import { ORTHOGONAL, ROCK_ROUTE, SEED, TREE_ROUTE, test, walkPath } from './world.js';

test('a run starts at the base with the small torch lit, and no tools in the corner', async (game) => {
  await game.startRun();

  const state = await game.state();
  assertEqual({ x: state.x, y: state.y }, { x: 0, y: 0 }, 'starts on the base');
  assertEqual(
    state.inventory,
    [{ id: 'torch-small', durability: ITEMS['torch-small'].maxDurability }],
    'inventory'
  );
  assertEqual(state.explored, 9, 'the 3x3 block around the base is lit');
  // Nothing is owned yet, so the navigation rail is empty (DESIGN.md §4.6).
  assertEqual(state.tools, [], 'owning nothing');
  assertEqual(state.compassShown, false, 'means no needle in the corner');

  const tiles = await game.visibleTiles();
  assertEqual(tiles.filter((t) => t.alpha === 1).length, 9, 'nine tiles at full brightness');
  assert(await game.hasText('EXPLORED 9'), 'the explored counter');

  // The wizard stands in the base's doorway, so the hut itself is only drawn
  // once they step off it — two dense sprites on one tile read as a blob.
  assert(!tiles.some((t) => t.overlay === 'base'), 'the hut is hidden under the wizard');
  await game.tapDpad('right');
  await game.settle();
  const after = await game.visibleTiles();
  assertEqual(after.find((t) => t.x === 0 && t.y === 0).overlay, 'base', 'the hut is drawn once you step off it');
});

test('the d-pad walks and burns the torch', async (game) => {
  await game.startRun();

  await game.tapDpad('right');
  await game.settle();

  const state = await game.state();
  assertEqual({ x: state.x, y: state.y }, { x: 1, y: 0 }, 'moved one tile east');
  assertEqual(state.facing, 'right', 'facing');
  assertEqual(state.inventory[0].durability, ITEMS['torch-small'].maxDurability - 1, 'one durability spent');
  assertEqual(await game.wizardTexture(), 'wizard-right', 'the wizard turned');
});

test('holding a D-pad arrow keeps stepping until released', async (game) => {
  await game.startRun();
  const before = await game.state();

  // West of the base is clear for several tiles on the default seed, so a
  // held press can take more than one step without hitting rock.
  await game.holdDpad('left', 900);
  await game.settle();

  const after = await game.state();
  assert(after.steps - before.steps >= 2, `a held press took more than one step (took ${after.steps - before.steps})`);
  assert(after.x < before.x, 'and actually walked west');

  const justAfter = after.steps;
  await game.page.waitForTimeout(500);
  assertEqual((await game.state()).steps, justAfter, 'and stops the moment the arrow is released');
});

test('swiping the map and the arrow keys both walk', async (game) => {
  await game.startRun();

  await game.swipe('down');
  await game.settle();
  let state = await game.state();
  assertEqual({ x: state.x, y: state.y }, { x: 0, y: 1 }, 'a swipe moved one tile south');
  assertEqual(await game.wizardTexture(), 'wizard-down', 'the wizard turned');

  await game.press('ArrowUp');
  await game.settle();
  state = await game.state();
  assertEqual({ x: state.x, y: state.y }, { x: 0, y: 0 }, 'and an arrow key moved one tile back north');
});

test('walking into rock bumps instead of moving', async (game) => {
  await game.startRun();
  await walkPath(game, ROCK_ROUTE.path);

  const before = await game.state();
  await game.tapDpad(ROCK_ROUTE.hit);
  await game.settle();
  const after = await game.state();

  assertEqual({ x: after.x, y: after.y }, { x: before.x, y: before.y }, 'did not move');
  assertEqual(after.inventory[0].durability, before.inventory[0].durability, 'no durability spent');
});

test('explored ground stays on screen, dimmed, and nothing else is drawn', async (game) => {
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
  assert(remembered.some((t) => t.x === 0 && t.y === 0), 'the base is remembered from two tiles away');
  // Floor is drawn as one undecorated texture, whatever else is on top of it.
  const floors = tiles.filter((t) => t.ground.startsWith('floor'));
  assert(floors.length > 0 && floors.every((t) => t.ground === 'floor'), 'floor is plain ground');
});

test('blackout shrinks memory to a fog of war around the character', async (game) => {
  await game.startRun();

  // One step off the base, then pace back and forth inside its forced-floor
  // neighbourhood (DESIGN.md §4.3) — never back onto the hut itself, so its
  // dialog never interrupts the loop — until the starting small torch burns
  // all the way out.
  await game.tapDpad('right');
  await game.settle();
  for (let i = 0; i < ITEMS['torch-small'].maxDurability - 1; i++) {
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
      (t) => Math.max(Math.abs(t.x - state.x), Math.abs(t.y - state.y)) <= BLACKOUT_MEMORY_RADIUS
    ),
    'nothing further out is drawn as remembered any more'
  );
});

test('a grove is drawn as trees, not as more rock', async (game) => {
  await game.startRun();
  await walkPath(game, TREE_ROUTE.path);

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

runIfMain(import.meta.url);
