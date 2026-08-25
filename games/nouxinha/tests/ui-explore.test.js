// Walking the dark: the controls a player actually walks with, and the three
// visibility states the map viewport draws. Each test drives a fresh page
// against the real canvas.
//
// What a step *costs* is not a browser's question. That a step spends one
// durability, one water and one step, and that rock rejects one for nothing, are
// pure claims and live in `rules.test.js` — what is here is that a thumb, a
// swipe and an arrow key each turn into one of those steps, and what the screen
// does about it.

import { assert, assertEqual, runIfMain } from './harness.js';
import { BLACKOUT_MEMORY_RADIUS, STARTING_LIGHT } from '../src/balance.js';
import { HUD } from '../src/text.js';
import { ITEMS } from '../src/data/items.js';
import { TORCH_ROUTE, standingAt, test, walkPath } from './world.js';

test('a run starts one tile south of the base, lit by the torch it set out with', async (game) => {
  await game.startRun();

  const state = await game.state();
  // One tile off the hut, facing further away, so the hut is in view from the
  // first frame instead of hidden under the wizard until the first step off.
  assertEqual({ x: state.x, y: state.y }, { x: 0, y: 1 }, 'starts south of the base');
  assertEqual(state.facing, 'down', 'facing away from the base');
  assertEqual(
    state.inventory,
    [{ id: STARTING_LIGHT, durability: ITEMS[STARTING_LIGHT].maxDurability }],
    'carrying one small torch and nothing else'
  );
  assertEqual(state.explored, 9, 'the 3x3 block around the start tile is lit');
  // Nothing is owned yet, so the navigation rail is empty (DESIGN.md §4.6).
  assertEqual(state.tools, [], 'owning nothing');
  assertEqual(state.compassShown, false, 'means no needle in the corner');

  const tiles = await game.visibleTiles();
  assertEqual(tiles.filter((t) => t.alpha === 1).length, 9, 'nine tiles at full brightness');
  assert(await game.hasText(HUD.explored(9)), 'the explored counter');
  assertEqual(tiles.find((t) => t.x === 0 && t.y === 0).overlay, 'base', 'the hut is drawn from the start');
});

test('the D-pad, a swipe and the arrow keys all walk, and a step burns light and water', async (game) => {
  await game.startRun();
  assert(await game.hasText(HUD.water(200, 200)), 'the tank starts full');

  // Three ways in, one step out: the D-pad a thumb taps, a swipe across the
  // world, and the arrow keys a desk gets. All three are how the game is
  // played, so all three are walked (DESIGN.md §7).
  await game.tapDpad('right');
  await game.settle();
  let state = await game.state();
  assertEqual({ x: state.x, y: state.y }, { x: 1, y: 1 }, 'the D-pad moved one tile east');
  assertEqual(state.facing, 'right', 'facing');
  assertEqual(await game.wizardTexture(), 'wizard-right', 'and the wizard turned with it');
  assertEqual(state.inventory[0].durability, ITEMS[STARTING_LIGHT].maxDurability - 1, 'one durability spent');
  assertEqual(state.water, 199, 'and one mouthful of water');
  assert(await game.hasText(HUD.water(199, 200)), 'which the HUD counter reads back');

  await game.swipe('down');
  await game.settle();
  state = await game.state();
  assertEqual({ x: state.x, y: state.y }, { x: 1, y: 2 }, 'a swipe moved one tile south');
  assertEqual(await game.wizardTexture(), 'wizard-down', 'the wizard turned');

  await game.press('ArrowUp');
  await game.settle();
  state = await game.state();
  assertEqual({ x: state.x, y: state.y }, { x: 1, y: 1 }, 'and an arrow key moved one tile back north');
});

test('holding a D-pad arrow keeps stepping until released', async (game) => {
  await game.startRun();
  const before = await game.state();

  // Hold-to-walk is what makes an expedition of a few hundred tiles playable
  // (DESIGN.md §7). West of the base is clear for several tiles on the default
  // seed, so a held press can take more than one step without hitting rock —
  // the assertion is deliberately "more than one", not a count, because the
  // repeat rate is a Settings slider and not a fact about the game.
  await game.holdDpad('left', 900);
  await game.settle();

  const after = await game.state();
  assert(after.steps - before.steps >= 2, `a held press took more than one step (took ${after.steps - before.steps})`);
  assert(after.x < before.x, 'and actually walked west');

  // And it is the *holding* that repeats: released, the run stands still.
  const justAfter = after.steps;
  await game.page.waitForTimeout(500);
  assertEqual((await game.state()).steps, justAfter, 'and stops the moment the arrow is released');
});

test('explored ground stays on screen, dimmed, and nothing else is drawn', async (game) => {
  await game.startRun();

  await walkPath(game, ['right', 'right']);

  const tiles = await game.visibleTiles();
  const lit = tiles.filter((t) => t.alpha === 1);
  const remembered = tiles.filter((t) => t.alpha === 0.3);
  assertEqual(lit.length, 9, 'the light shape is still 9 tiles');
  assert(remembered.length > 0, 'ground walked past is still drawn, dimmed');
  // Everything drawn is either lit or remembered — unknown tiles are not drawn.
  // Those three states are the whole of what the dark means (DESIGN.md §4).
  assertEqual(lit.length + remembered.length, tiles.length, 'no third state on screen');
  assert(remembered.some((t) => t.x === 0 && t.y === 0), 'the base is remembered from two tiles away');
  // Floor is drawn as one undecorated texture, whatever else is on top of it.
  const floors = tiles.filter((t) => t.ground.startsWith('floor'));
  assert(floors.length > 0 && floors.every((t) => t.ground === 'floor'), 'floor is plain ground');
});

// A walk already out in the dark with one step left in its torch, so the very
// next tap is the one the light goes out on. Burning a full small torch down by
// playing is a hundred taps of a real browser, and what is asserted here is
// what blackout *draws* — that a light runs down at all is `rules.test.js`.
const BLACKOUT = standingAt(TORCH_ROUTE, {
  back: 4,
  run: { inventory: [{ id: STARTING_LIGHT, durability: 1 }] },
});

test('blackout shrinks memory to a fog of war around the character', async (game) => {
  await game.startRun();
  await walkPath(game, BLACKOUT.path.slice(0, 1));

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
}, { save: BLACKOUT.save });

runIfMain(import.meta.url);
