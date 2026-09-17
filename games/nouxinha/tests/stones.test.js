// The four carved stones: where they stand, that reading one is a bump like a
// post's, and that what one says is the campaign's count of finished worlds
// rather than anything about the stone (DESIGN.md §4.12). Pure — no browser.

import { assert, assertEqual, runIfMain, unit } from './harness.js';
import {
  blocksSight,
  chebyshev,
  isWalkable,
  landmarks,
  signposts,
  stoneAt,
  stones,
  terrainAt,
} from '../src/core/world.js';
import {
  bankRun,
  createRun,
  itemOnTile,
  readStone,
  respawn,
  step,
  stoneOnTile,
  turnCycle,
} from '../src/core/rules.js';
import { emptySave, loadSave, writeSave } from '../src/core/save.js';
import { LANDMARK_COURT, STONE_CLEARANCE, STONE_PLAN, STONE_SPACING } from '../src/balance.js';
import { SAY, STONE_TEXT } from '../src/text.js';
import { FIRST_STONE, NONCE, SEED, STONE_ROUTE } from './world.js';

// --- Where they stand --------------------------------------------------------

unit('the four stones stand up, each its own terrain with a floor apron', () => {
  const found = stones(SEED);
  assertEqual(found.length, STONE_PLAN.length, 'all four stood up in this world');
  assertEqual(new Set(found.map((s) => s.id)).size, found.length, 'no two share an id');

  for (const stone of found) {
    const plan = STONE_PLAN.find((p) => p.id === stone.id);
    const distance = chebyshev(stone.x, stone.y);
    const furthest = plan.near + plan.span - 1;
    assert(
      distance >= plan.near && distance <= furthest,
      `${stone.id} stands in its band (${distance}, wanted ${plan.near}-${furthest})`
    );

    assertEqual(terrainAt(stone.x, stone.y, SEED), 'stone', `${stone.id} is its own terrain`);
    assertEqual(isWalkable(stone.x, stone.y, SEED), false, 'you cannot stand on it');
    assertEqual(blocksSight(stone.x, stone.y, SEED), false, 'and it casts no shadow, like a chest');

    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const at = stoneAt(stone.x + dx, stone.y + dy, SEED);
      assertEqual(at && at.part, 'apron', `${stone.id} has floor on every side`);
      assert(isWalkable(stone.x + dx, stone.y + dy, SEED), 'and every side is walkable');
    }
  }
});

unit('the doorstep stone is on the doorstep and the rest are inside the first tank', () => {
  // The whole of the plan's promise: one a first expedition cannot miss, and
  // three more near enough that a fresh tank can reach them and walk back
  // (balance.js `STONE_PLAN`). A ring is not a walk — the ground makes it half
  // again as long — but a ring of 50 is what keeps the walk inside 200 steps.
  const [doorstep, ...rest] = STONE_PLAN;
  assertEqual(
    [doorstep.near, doorstep.near + doorstep.span - 1],
    [5, 8],
    'the first stands five to eight tiles out — outside the hut clearing, inside the opening walk'
  );
  for (const plan of rest)
    assert(plan.near + plan.span - 1 <= 50, `${plan.id} stands inside ring 50`);
});

unit('a stone keeps clear of the posts, the landmarks and the other stones', () => {
  // He cut them to be come across on the way to something, not to stand in its
  // doorway — and four in a huddle would be one stone with four things on it.
  for (const stone of stones(SEED)) {
    for (const landmark of landmarks(SEED))
      assert(
        chebyshev(stone.x, stone.y, landmark.x, landmark.y) > STONE_CLEARANCE,
        `${stone.id} is clear of ${landmark.id}`
      );
    for (const post of signposts(SEED))
      assert(
        chebyshev(stone.x, stone.y, post.x, post.y) > STONE_CLEARANCE,
        `${stone.id} is clear of ${post.id}`
      );
    for (const other of stones(SEED))
      if (other.id !== stone.id)
        assert(
          chebyshev(stone.x, stone.y, other.x, other.y) > STONE_SPACING,
          `${stone.id} is clear of ${other.id}`
        );
  }
  // The court is what a landmark's clearance is measured against, so the rule
  // above has to be worth more than the court it clears.
  assert(STONE_CLEARANCE > LANDMARK_COURT, 'clearance clears more than the court itself');
});

unit('nothing is ever lying on a stone or its apron', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  for (let epoch = 0; epoch < 3; epoch++) {
    for (const stone of stones(SEED))
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]])
        assertEqual(
          itemOnTile(state, stone.x + dx, stone.y + dy),
          null,
          `${stone.id} is bare, epoch ${epoch}`
        );
    respawn(state);
  }
});

// --- Reading one --------------------------------------------------------------

unit('reading a stone writes down nothing but that this world has read it', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  assertEqual(stoneOnTile(state, FIRST_STONE.x, FIRST_STONE.y).read, false, 'not read yet');

  const first = readStone(state, FIRST_STONE);
  assertEqual(first.first, true, 'the first read is the first read');
  assertEqual(first.finished, 0, 'and a campaign that has finished nothing reads the first cut');
  assertEqual(state.stones.has(FIRST_STONE.id), true, 'this world now knows it has been read');

  const again = readStone(state, FIRST_STONE);
  assertEqual(again.first, false, 'a real return visit is not');
});

const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

unit('a stone is bumped like a post: no water, no durability, no facing change', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  for (const dir of STONE_ROUTE.path) assert(step(state, dir).moved, `route step ${dir}`);

  const water = state.water;
  const durability = state.inventory[state.activeIndex].durability;
  const facing = state.facing;

  const bump = step(state, STONE_ROUTE.hit);
  assertEqual(bump.moved, false, 'the step into it does not happen');
  assertEqual(bump.reason, 'stone', 'and it says why');
  assertEqual(bump.stone, FIRST_STONE.id, 'naming the one it bumped');
  assertEqual(bump.first, true, 'the first read');
  assertEqual(bump.fresh, true, 'and a fresh one');
  assertEqual(state.water, water, 'no water spent');
  assertEqual(state.inventory[state.activeIndex].durability, durability, 'no durability burned');
  assertEqual(state.facing, facing, 'and facing is untouched');

  // Bumped again with no step in between reads as the same visit — the
  // debounce every other bumped thing gets.
  assertEqual(step(state, STONE_ROUTE.hit).fresh, false, 'bumping it again with no step between is not fresh');

  const last = STONE_ROUTE.path[STONE_ROUTE.path.length - 1];
  assert(step(state, OPPOSITE[last]).moved, 'a step lands');
  assert(step(state, last).moved, 'and another back to where it was standing');
  assertEqual(step(state, STONE_ROUTE.hit).fresh, true, 'so the next bump is a fresh read again');
  assertEqual(step(state, STONE_ROUTE.hit).first, false, 'though this world has read it before');
});

// --- What it says -------------------------------------------------------------

unit('every stone is cut five ways, one per kind of world finished', () => {
  for (const plan of STONE_PLAN) {
    const cuts = STONE_TEXT[plan.id];
    assert(Array.isArray(cuts), `${plan.id} has copy`);
    assertEqual(cuts.length, 5, `${plan.id} is cut once per count of finished worlds, nought to four`);
    for (const blocks of cuts) {
      assert(blocks.length > 0, `${plan.id} says something in every cut`);
      for (const block of blocks) assertEqual(typeof block, 'string', 'a block is a block of text');
    }
  }
});

unit('which cut you read is how many kinds of world the campaign has finished', () => {
  const cuts = STONE_TEXT['stone-1'];
  for (let finished = 0; finished < cuts.length; finished++)
    assertEqual(SAY.stone('stone-1', finished), cuts[finished], `${finished} finished reads its own cut`);
  // A campaign past the end of the table — there are only four kinds of world,
  // so this is somebody who has finished them all and come back — keeps
  // reading the last one rather than falling off it.
  assertEqual(SAY.stone('stone-1', 9), cuts[cuts.length - 1], 'past the end, the last cut stands');
});

unit('a run in a world it has finished three of reads the third cut', () => {
  const save = { ...emptySave(), seed: SEED, finished: ['frozen', 'desert', 'mystic'] };
  const state = createRun(SEED, save, NONCE);
  const read = readStone(state, FIRST_STONE);
  assertEqual(read.finished, 3, 'the count comes off the campaign, not the stone');
  assertEqual(
    SAY.stone(FIRST_STONE.id, read.finished),
    STONE_TEXT[FIRST_STONE.id][3],
    'and it is the cut written for somebody with one world left'
  );
});

// --- What survives a world ----------------------------------------------------

unit('banking keeps a stone read for this world, and a cycle takes it with the ground', () => {
  writeSave(emptySave());
  const state = createRun(SEED, loadSave(), NONCE);
  readStone(state, FIRST_STONE);
  const banked = bankRun(state);
  assertEqual(banked.stones, [FIRST_STONE.id], 'this world knows you read it');

  // A second expedition into the same world remembers it.
  const same = createRun(undefined, banked, NONCE);
  assertEqual(same.stones.has(FIRST_STONE.id), true, 'the same world, still read');

  // And then the hall takes the world. A stone keeps no standing — what it
  // told you is yours, and having read it is the world's — so the new world
  // owes it nothing, exactly as with the posts.
  const after = turnCycle(same);
  assertEqual(after.stones.size, 0, 'the new world has had none of them read');
});

unit('a stone read on a walk that never got home was never read', () => {
  writeSave(emptySave());
  const state = createRun(SEED, loadSave(), NONCE);
  readStone(state, FIRST_STONE);

  const next = createRun(SEED, loadSave(), NONCE);
  assertEqual(next.stones.size, 0, 'the world does not know you read it');
});

runIfMain(import.meta.url);
