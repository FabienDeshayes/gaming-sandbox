// The ten wisps: where they stand, that touching one hands back nothing, and
// that a wisp lights its own little clearing whatever the character is
// carrying (DESIGN.md §4.11). Pure — no browser.

import { assert, assertEqual, runIfMain, unit } from './harness.js';
import { blocksSight, chebyshev, isWalkable, terrainAt, wispAt, wisps } from '../src/core/world.js';
import {
  bankRun,
  createRun,
  itemOnTile,
  litTiles,
  respawn,
  step,
  touchWisp,
  turnCycle,
  wispOnTile,
} from '../src/core/rules.js';
import { emptySave, loadSave, writeSave } from '../src/core/save.js';
import { WISP_PLAN, WISP_SHAPE } from '../src/balance.js';
import { FIRST_WISP, NONCE, SEED, WISP_ROUTE } from './world.js';

// --- Where they stand --------------------------------------------------------

unit('most of the ten wisps stand up, each its own terrain with a floor apron', () => {
  const found = wisps(SEED);
  assert(found.length >= 8, `most of the ten stood up (${found.length})`);
  assertEqual(new Set(found.map((w) => w.id)).size, found.length, 'no two share an id');

  for (const wisp of found) {
    const plan = WISP_PLAN.find((p) => p.id === wisp.id);
    const distance = chebyshev(wisp.x, wisp.y);
    assert(
      distance >= plan.near && distance <= plan.near + plan.span,
      `${wisp.id} stands in its band (${distance}, wanted ${plan.near}-${plan.near + plan.span})`
    );

    assertEqual(terrainAt(wisp.x, wisp.y, SEED), 'wisp', `${wisp.id} is its own terrain`);
    assertEqual(isWalkable(wisp.x, wisp.y, SEED), false, 'you cannot stand on it');
    assertEqual(blocksSight(wisp.x, wisp.y, SEED), false, 'and it casts no shadow, like a chest');

    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const at = wispAt(wisp.x + dx, wisp.y + dy, SEED);
      assertEqual(at && at.part, 'apron', `${wisp.id} has floor on every side`);
      assert(isWalkable(wisp.x + dx, wisp.y + dy, SEED), 'and every side is walkable');
    }
  }
});

unit('nothing is ever lying on a wisp or its apron', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  for (let epoch = 0; epoch < 3; epoch++) {
    for (const wisp of wisps(SEED))
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]])
        assertEqual(itemOnTile(state, wisp.x + dx, wisp.y + dy), null, `${wisp.id} is bare, epoch ${epoch}`);
    respawn(state);
  }
});

// --- Touching one -------------------------------------------------------------

unit('putting a hand on a wisp hands back nothing but whether this is the first time', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  const wisp = FIRST_WISP;
  assertEqual(wispOnTile(state, wisp.x, wisp.y).touched, false, 'not been here yet');

  const first = touchWisp(state, wisp);
  assertEqual(first.first, true, 'the first touch is the first touch');
  assertEqual(state.wisps.has(wisp.id), true, 'and this world now knows it');

  const again = touchWisp(state, wisp);
  assertEqual(again.first, false, 'a real return visit is not');
});

const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

unit('a wisp is bumped like a chest: no water, no durability, no facing change', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  for (const dir of WISP_ROUTE.path) assert(step(state, dir).moved, `route step ${dir}`);

  const water = state.water;
  const durability = state.inventory[state.activeIndex].durability;
  const facing = state.facing;

  const bump = step(state, WISP_ROUTE.hit);
  assertEqual(bump.moved, false, 'the step into it does not happen');
  assertEqual(bump.reason, 'wisp', 'and it says why');
  assertEqual(bump.wisp, FIRST_WISP.id, 'naming the one it bumped');
  assertEqual(bump.first, true, 'the first touch');
  assertEqual(bump.fresh, true, 'and a fresh one');
  assertEqual(state.water, water, 'no water spent');
  assertEqual(state.inventory[state.activeIndex].durability, durability, 'no durability burned');
  assertEqual(state.facing, facing, 'and facing is untouched');

  // Bumped again with no step in between reads as the same visit, exactly like
  // a landmark or a post.
  assertEqual(step(state, WISP_ROUTE.hit).fresh, false, 'bumping it again with no step between is not fresh');

  const last = WISP_ROUTE.path[WISP_ROUTE.path.length - 1];
  assert(step(state, OPPOSITE[last]).moved, 'a step lands');
  assert(step(state, last).moved, 'and another back to where it was standing');
  assertEqual(step(state, WISP_ROUTE.hit).fresh, true, 'so the next bump is a fresh visit again');
  assertEqual(step(state, WISP_ROUTE.hit).first, false, 'though the world has had it off you before');
});

// --- What survives a world ----------------------------------------------------

unit('banking keeps a wisp for this world, and a cycle takes it with the ground', () => {
  writeSave(emptySave());
  const state = createRun(SEED, loadSave(), NONCE);
  touchWisp(state, FIRST_WISP);
  const banked = bankRun(state);
  assertEqual(banked.wisps, [FIRST_WISP.id], 'this world knows you stood there');

  // A second expedition into the same world remembers it.
  const same = createRun(undefined, banked, NONCE);
  assertEqual(same.wisps.has(FIRST_WISP.id), true, 'the same world, still touched');

  // And then the hall takes the world. Unlike a landmark, a wisp keeps no
  // standing at all — there is nothing here for `turnCycle` to carry over, so
  // the new world owes it nothing.
  const after = turnCycle(same);
  assertEqual(after.wisps.size, 0, 'the new world has never had a hand on any of them');
});

unit('a wisp walked to and not walked home from was never touched', () => {
  writeSave(emptySave());
  const state = createRun(SEED, loadSave(), NONCE);
  touchWisp(state, FIRST_WISP);

  const next = createRun(SEED, loadSave(), NONCE);
  assertEqual(next.wisps.size, 0, 'the world does not know you were there');
});

// --- The light it burns on its own --------------------------------------------

unit('a wisp lights its own clearing whatever the character is carrying or wherever they stand', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  const wisp = FIRST_WISP;

  // Blackout: nothing in the inventory at all, so the character's own light
  // shows only the tile underfoot.
  state.inventory = [];
  state.activeIndex = -1;

  // Standing right beside the wisp: its own disc is in the lit set even
  // though nothing is equipped.
  state.x = wisp.x + 1;
  state.y = wisp.y;
  const near = new Set(litTiles(state).map((t) => `${t.x},${t.y}`));
  assert(near.has(`${wisp.x},${wisp.y}`), "the wisp's own tile is lit");
  assert(near.has(`${wisp.x - 1},${wisp.y}`), "and the tile beyond it, in the wisp's own disc");

  // A hundred tiles away, in the same blackout: a wisp does not wait for the
  // character to approach it at all — every one is composed in always.
  state.x = wisp.x + 100;
  state.y = wisp.y;
  const far = new Set(litTiles(state).map((t) => `${t.x},${t.y}`));
  assert(far.has(`${wisp.x},${wisp.y}`), 'a hundred tiles out, the wisp is lit exactly the same');
});

unit("a wisp's own light is wider than a small torch's", () => {
  // WISP_SHAPE is a round disc rather than the Chebyshev block every carried
  // light draws (core/light.js `visibleTiles` covers the shape math itself);
  // this only pins today's radius, since that is the number "how big is a
  // wisp" actually means.
  assertEqual(WISP_SHAPE, { kind: 'round', radius: 2 }, "today's wisp is a radius-2 disc");
});

runIfMain(import.meta.url);
