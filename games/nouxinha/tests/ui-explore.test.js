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
import { HUD, MENU, SETTINGS } from '../src/text.js';
import { PARTICLE_ALPHA } from '../src/config.js';
import { ITEMS } from '../src/data/items.js';
import { createRun } from '../src/core/rules.js';
import { emptySave } from '../src/core/save.js';
import { ANIMATIONS } from '../src/data/tiles.js';
import { FIRST_WISP, NONCE, SEED, TORCH_ROUTE, WISP_ROUTE, standingAt, test, walkPath } from './world.js';

// The 3x3 block a small torch shows is no longer the whole of what a fresh
// run has lit: every wisp in the world lights its own little clearing
// unconditionally (DESIGN.md §4.11), wherever it stands, so a run's starting
// count of explored tiles is the torch's block plus however many wisps this
// seed happens to have and whatever their discs come to once shadow has cut
// them back. Read off the pure engine rather than hardcoded, so a change to
// either shape moves this test with it instead of breaking it.
const FRESH_EXPLORED = createRun(SEED, emptySave(), NONCE).explored.size;

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
  assertEqual(state.explored, FRESH_EXPLORED, 'the 3x3 block around the start tile, plus every wisp, is lit');
  // Nothing is owned yet, so the navigation rail is empty (DESIGN.md §4.6).
  assertEqual(state.tools, [], 'owning nothing');
  assertEqual(state.compassShown, false, 'means no needle in the corner');

  const tiles = await game.visibleTiles();
  const lit = tiles.filter((t) => t.alpha === 1);
  // The torch's own 3x3 is still exactly what it always was — asserted tile
  // by tile, since other lit tiles on screen may now belong to a wisp.
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++)
      assert(lit.some((t) => t.x === dx && t.y === 1 + dy), `(${dx}, ${1 + dy}) is lit by the torch`);
  assert(await game.hasText(HUD.explored(FRESH_EXPLORED)), 'the explored counter');
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
  //
  // The hold is far longer than the ~500ms the pad nominally needs to repeat
  // once (`HOLD_DELAY_MS` plus one interval at the default speed, src/ui/dpad.js).
  // The repeat rides Phaser's clock, which advances with the frame delta, so on
  // a loaded machine drawing well under 60fps it runs slower than wall time —
  // a budget sized to the nominal timings fails there for no reason the game is
  // responsible for.
  await game.holdDpad('left', 1800);
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
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++)
      assert(lit.some((t) => t.x === 2 + dx && t.y === 1 + dy), `(${2 + dx}, ${1 + dy}) is lit by the torch`);
  assert(remembered.length > 0, 'ground walked past is still drawn, dimmed');
  // Everything drawn is either lit or remembered — unknown tiles are not drawn.
  // Those three states are the whole of what the dark means (DESIGN.md §4).
  assertEqual(lit.length + remembered.length, tiles.length, 'no third state on screen');
  assert(remembered.some((t) => t.x === 0 && t.y === 0), 'the base is remembered from two tiles away');
  // Floor is drawn as one undecorated texture, whatever else is on top of it —
  // the world's own floor tile, or a biome's own version of it, and nothing
  // more (no variant or zone suffix riding along).
  const floors = tiles.filter((t) => t.ground.startsWith('floor'));
  assert(
    floors.length > 0 && floors.every((t) => /^floor(@[a-z]+)?(-\d+)?$/.test(t.ground)),
    'floor is plain ground'
  );
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


// A wisp flickers (`ANIMATIONS` in src/data/tiles.js): standing still next to
// one, the tile it is drawn on goes round every frame of its loop and nothing
// else, with nobody pressing anything. Planted on the doorstep — the walk
// there is `wisps.test.js`'s claim, and what is here is the frame loop.
const AT_WISP = standingAt(WISP_ROUTE);

test('a wisp flickers on its own while nothing moves', async (game) => {
  await game.startRun();
  const { frames } = ANIMATIONS.wisp;
  const seen = await game.watchGround(FIRST_WISP.x, FIRST_WISP.y, frames);
  assertEqual([...seen].sort(), [...frames].sort(), 'every frame of the loop, and nothing but');
  const state = await game.state();
  const { x, y } = AT_WISP.save.run;
  assertEqual({ x: state.x, y: state.y }, { x, y }, 'without a step taken');
}, { save: AT_WISP.save });

// Weather fills the whole view rather than only the light — it is weather —
// but over ground the run has never seen it is drawn no stronger than the
// faint strength config.js allows, so the light is still the only thing that
// shows the world. And PARTICLES in Settings, turned off, draws none at all.
test('weather crosses the whole view, faintly over the dark, and the switch turns it off', async (game) => {
  await game.startRun();
  const on = await game.particles();
  assert(on.dark > 0, 'weather is drawn over ground nobody has seen');
  assert(on.darkMax <= PARTICLE_ALPHA.dark + 1e-6, 'and never stronger than the dark allows there');

  await game.tapMenuButton();
  await game.clickText(MENU.settings);
  await game.waitForScene('SettingsScene');
  await game.clickText(SETTINGS.particles(true));
  assert(await game.hasText(SETTINGS.particles(false)), 'the switch says it is off');
  await game.clickText(SETTINGS.back);
  await game.waitForScene('ExploreScene');
  const off = await game.particles();
  assertEqual(off.lit + off.remembered + off.dark, 0, 'and nothing is drawn');
  assertEqual(await game.pref('nouxinha.particles'), '0', 'kept beside the saves like the music');
});

runIfMain(import.meta.url);
