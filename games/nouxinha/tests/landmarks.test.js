// The four landmarks and the eight posts that point at them: where they stand,
// what putting a hand on one hands over, and which of that survives a world
// being moulded away (DESIGN.md §4.10). Pure — no browser.
//
// The split this file is mostly about is the one that is easy to get wrong in
// both directions: a **gift** is the run's and comes back every world, a
// **standing** is the campaign's and never comes back at all.

import { assert, assertEqual, runIfMain, unit } from './harness.js';
import {
  chebyshev,
  chests,
  isWalkable,
  landmarkAt,
  landmarkNamed,
  landmarks,
  signpostBand,
  signpostBearing,
  signpostReading,
  signposts,
  terrainAt,
  blocksSight,
} from '../src/core/world.js';
import {
  createRun,
  bankRun,
  hasStanding,
  itemOnTile,
  landmarkOnTile,
  markedLandmarks,
  readSignpost,
  respawn,
  runSummary,
  step,
  touchLandmark,
  turnCycle,
  standings,
} from '../src/core/rules.js';
import { emptySave, loadSave, writeSave } from '../src/core/save.js';
import {
  LANDMARK_GIFTS,
  LANDMARK_PLAN,
  SIGNPOST_BANDS,
  SIGNPOST_CLEARANCE,
  SIGNPOST_PLAN,
  STARTING_WATER,
} from '../src/balance.js';
import { LANDMARK_IDS, landmarkDef } from '../src/data/landmarks.js';
import { PALETTES } from '../src/config.js';
import { FIRST_POST, NONCE, POST_ROUTE, SEED } from './world.js';

// --- Where they stand --------------------------------------------------------

unit('there are four landmarks, one to a quarter, and none of them far out', () => {
  const found = landmarks(SEED);
  assertEqual(found.length, 4, 'four of them');
  assertEqual(found.map((l) => l.id), LANDMARK_IDS, 'the same four, in ring order');

  const angles = [];
  found.forEach((landmark, i) => {
    const plan = LANDMARK_PLAN[i];
    const distance = chebyshev(landmark.x, landmark.y);
    assert(
      distance >= plan.near && distance <= plan.near + plan.span,
      `${landmark.id} stands in its band (${distance}, wanted ${plan.near}-${plan.near + plan.span})`
    );
    angles.push(Math.atan2(landmark.y, landmark.x));
  });

  // The furthest is nearer than the third sanctum: a landmark is on the way to
  // somewhere, never a walk of its own.
  assert(Math.max(...found.map((l) => chebyshev(l.x, l.y))) <= 75, 'and the last one is inside 75');

  // One to a quarter of the rose, and the rose itself is turned by the seed — so
  // what a player can rely on across worlds is not "the Mint is north", it is
  // "there is one in every direction". The claim that survives that is the
  // spread: the four bearings are never bunched, whichever way the rose fell.
  // (Each takes a quarter jittered inside itself, and the search that dodges bad
  // ground stays inside that quarter, so the worst case is well over 45°.)
  const apart = [];
  for (let a = 0; a < angles.length; a++)
    for (let b = a + 1; b < angles.length; b++) {
      const d = Math.abs(angles[a] - angles[b]);
      apart.push(((d > Math.PI ? Math.PI * 2 - d : d) * 180) / Math.PI);
    }
  assert(Math.min(...apart) > 45, `no two of them bunch (${Math.min(...apart).toFixed(0)}° apart)`);
});

unit('a landmark blocks a step, never a light, and stands in a court', () => {
  for (const landmark of landmarks(SEED)) {
    assertEqual(terrainAt(landmark.x, landmark.y, SEED), 'landmark', `${landmark.id} is its own terrain`);
    assertEqual(isWalkable(landmark.x, landmark.y, SEED), false, 'you cannot stand on it');
    assertEqual(blocksSight(landmark.x, landmark.y, SEED), false, 'and it casts no shadow');

    // The court: eight tiles of its own paving, walkable all the way round, so
    // there is always a way in whatever the noise did.
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const at = landmarkAt(landmark.x + dx, landmark.y + dy, SEED);
        assertEqual(at && at.part, 'court', 'the tiles around it are its court');
        assert(isWalkable(landmark.x + dx, landmark.y + dy, SEED), 'and every one of them is floor');
      }
  }
});

unit('each landmark keeps a colour of its own, and no two share one', () => {
  const used = new Set();
  for (const id of LANDMARK_IDS) {
    const def = landmarkDef(id);
    assert(
      PALETTES.some((p) => p.id === def.palette),
      `${id} keeps one of the four palettes (${def.palette})`
    );
    assert(!used.has(def.palette), `and ${def.palette} belongs to ${id} alone`);
    used.add(def.palette);
  }
});

unit('three landmarks have a key chest beside them, and the nearest a hoard', () => {
  const beside = chests(SEED).filter((chest) => chest.at);
  assertEqual(beside.length, 4, 'four chests belong to a landmark');
  assertEqual(
    beside.filter((chest) => chest.key).map((chest) => chest.key).sort(),
    ['key-1', 'key-2', 'key-3'],
    'three of them hold the three keys'
  );
  assertEqual(beside.find((chest) => !chest.key).at, 'mint', 'and the Mint pays in coins');

  for (const chest of beside) {
    const landmark = landmarkNamed(chest.at, SEED);
    const distance = chebyshev(chest.x, chest.y, landmark.x, landmark.y);
    assert(distance > 1 && distance <= 6, `${chest.id} stands just off ${chest.at} (${distance})`);
  }

  // Each key is still well inside the gate it opens, which is the pacing the
  // chain has always rested on (DESIGN.md §4.4).
  for (const chest of chests(SEED).filter((c) => c.key)) {
    const gate = { 'key-1': 45, 'key-2': 80, 'key-3': 110 }[chest.key];
    assert(chebyshev(chest.x, chest.y) < gate, `${chest.key} lies inside the gate it opens`);
  }
});

// --- The posts ---------------------------------------------------------------

unit('the posts spread out, stay clear of what they point at, and one is at five', () => {
  const posts = signposts(SEED);
  assert(posts.length >= 6, `most of the eight stood up (${posts.length})`);

  const first = posts.find((post) => post.id === 'post-1');
  assert(first, 'the near post is one of them');
  assertEqual(chebyshev(first.x, first.y), 5, 'and it stands exactly five tiles out');
  assertEqual(first.target, 'mint', 'pointing at the nearest landmark there is');

  for (const post of posts) {
    assertEqual(terrainAt(post.x, post.y, SEED), 'signpost', `${post.id} is its own terrain`);
    assertEqual(blocksSight(post.x, post.y, SEED), false, 'and stops no light');
    for (const landmark of landmarks(SEED))
      assert(
        chebyshev(post.x, post.y, landmark.x, landmark.y) >= SIGNPOST_CLEARANCE,
        `${post.id} keeps its distance from ${landmark.id}`
      );
  }

  // Two apiece, so every landmark is named from two directions.
  for (const id of LANDMARK_IDS)
    assert(
      SIGNPOST_PLAN.filter((plan) => plan.target === id).length === 2,
      `${id} is named by two posts`
    );
});

unit('what a post says is worked out from where it stands', () => {
  for (const post of signposts(SEED)) {
    const reading = signpostReading(post, SEED);
    const target = landmarkNamed(post.target, SEED);
    assertEqual(reading.target, post.target, `${post.id} names its landmark`);
    assertEqual(reading.distance, chebyshev(post.x, post.y, target.x, target.y), 'and how far it is');
    assert(reading.bearing >= 0 && reading.bearing < 8, 'on one of the eight headings');
    assert(reading.band >= 0 && reading.band <= SIGNPOST_BANDS.length, 'in one of the bands');
  }

  // North is 0 and it goes clockwise, which is the order the words are in
  // (`SIGNPOST.bearings` in src/text.js).
  const post = { x: 0, y: 0 };
  assertEqual(signpostBearing(post, { x: 0, y: -10 }), 0, 'north');
  assertEqual(signpostBearing(post, { x: 10, y: -10 }), 1, 'north-east');
  assertEqual(signpostBearing(post, { x: 10, y: 0 }), 2, 'east');
  assertEqual(signpostBearing(post, { x: 0, y: 10 }), 4, 'south');
  assertEqual(signpostBearing(post, { x: -10, y: 0 }), 6, 'west');

  assertEqual(signpostBand(1), 0, 'nearby');
  assertEqual(signpostBand(SIGNPOST_BANDS[0]), 1, 'a walk');
  assertEqual(signpostBand(SIGNPOST_BANDS[SIGNPOST_BANDS.length - 1]), SIGNPOST_BANDS.length, 'far');
});

// --- Touching one ------------------------------------------------------------

// A run standing at a landmark, with the tile it is about to touch in hand.
function atLandmark(id, save = emptySave()) {
  const state = createRun(SEED, save, NONCE);
  const landmark = landmarkNamed(id, SEED);
  state.x = landmark.x + 1;
  state.y = landmark.y;
  return { state, landmark };
}

unit('a landmark pays a gift the first time each world, and nothing after', () => {
  const { state, landmark } = atLandmark('mint');
  assertEqual(landmarkOnTile(state, landmark.x, landmark.y).touched, false, 'not been here yet');

  const first = touchLandmark(state, landmark);
  assertEqual(first.already, false, 'the first touch lands');
  assertEqual(first.gift.coins, LANDMARK_GIFTS.mint.coins, 'and it strikes you blanks');
  assertEqual(state.coins, LANDMARK_GIFTS.mint.coins, 'which go in the pocket');

  const again = touchLandmark(state, landmark);
  assertEqual(again.already, true, 'the second does nothing');
  assertEqual(again.gift, null, 'and pays nothing');
  assertEqual(state.coins, LANDMARK_GIFTS.mint.coins, 'the purse is where it was');
});

unit('a landmark bumped again reads as fresh once a step has landed', () => {
  const { state } = atLandmark('mint');
  assertEqual(step(state, 'left').fresh, true, 'the first bump is a fresh one');
  assertEqual(step(state, 'left').fresh, false, 'bumping it again with no step between is not');

  assert(step(state, 'up').moved, 'a step lands');
  assert(step(state, 'down').moved, 'and another back to where it was standing');
  assertEqual(step(state, 'left').fresh, true, 'so the next bump is a fresh visit again');
});

const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

unit('a signpost bumped again reads as fresh once a step has landed', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  for (const dir of POST_ROUTE.path) assert(step(state, dir).moved, `route step ${dir}`);
  assertEqual(step(state, POST_ROUTE.hit).fresh, true, 'the first bump is a fresh one');
  assertEqual(
    step(state, POST_ROUTE.hit).fresh,
    false,
    'bumping it again with no step between is not'
  );

  // Retrace the route's last leg and back — ground the BFS already proved
  // walkable, so the step away and the step back are both guaranteed to land.
  const last = POST_ROUTE.path[POST_ROUTE.path.length - 1];
  assert(step(state, OPPOSITE[last]).moved, 'a step lands');
  assert(step(state, last).moved, 'and another back to where it was standing');
  assertEqual(step(state, POST_ROUTE.hit).fresh, true, 'so the next bump is a fresh visit again');
  assertEqual(FIRST_POST.id, 'post-1', 'sanity: this is the post the route was BFSed to');
});

unit('each landmark gives what it is about', () => {
  // Water: the bell is drowned, so it fills the tank however far out it is.
  const bell = atLandmark('bell');
  bell.state.water = 12;
  touchLandmark(bell.state, bell.landmark);
  assertEqual(bell.state.water, STARTING_WATER, 'the bell fills the tank');

  // Light: the tree burns whatever you are carrying back up to full.
  const tree = atLandmark('lantern-tree');
  tree.state.inventory[0].durability = 3;
  touchLandmark(tree.state, tree.landmark);
  assertEqual(tree.state.inventory[0].durability, 100, 'the tree relights your light');

  // And in blackout there is nothing to relight, so it hands one over.
  const dark = atLandmark('lantern-tree');
  dark.state.inventory = [];
  dark.state.activeIndex = -1;
  touchLandmark(dark.state, dark.landmark);
  assertEqual(dark.state.inventory.length, 1, 'and hands one over to a run with none');

  // Ground: the gnomon shows you how far you came.
  const gnomon = atLandmark('gnomon');
  const before = gnomon.state.explored.size;
  const given = touchLandmark(gnomon.state, gnomon.landmark);
  assert(given.gift.revealed > 100, 'the gnomon reveals the ground around it');
  assert(gnomon.state.explored.size > before, 'and it stays drawn');
});

unit('a standing is the campaign\'s, and the world it was won in is not', () => {
  const { state, landmark } = atLandmark('bell');
  assertEqual(hasStanding(state, 'bell'), false, 'nothing held yet');

  const first = touchLandmark(state, landmark);
  assertEqual(first.firstEver, true, 'the first time the campaign has ever stood here');
  assertEqual(hasStanding(state, 'bell'), true, 'so the standing is held');
  assertEqual(standings(state), ['bell'], 'and it is the only one');

  // Still only the run's, though: what makes it the campaign's is the hut.
  const summary = runSummary(state);
  assertEqual(summary.landmarksCarried, ['bell'], 'until it is banked, it is at risk');
});

unit('a landmark walked to and not walked home from was never reached', () => {
  writeSave(emptySave());
  const { state, landmark } = atLandmark('bell');
  touchLandmark(state, landmark);

  // The run dies out there: nothing is written, so the next run walks back out
  // to a landmark it has never stood at — exactly the chest's rule.
  const next = createRun(SEED, loadSave(), NONCE);
  assertEqual(next.landmarks.size, 0, 'the world does not know you were there');
  assertEqual(hasStanding(next, 'bell'), false, 'and neither does the campaign');
});

unit('banking is what keeps a landmark, and a cycle keeps only the standing', () => {
  writeSave(emptySave());
  const { state, landmark } = atLandmark('bell');
  touchLandmark(state, landmark);
  const banked = bankRun(state);
  assertEqual(banked.landmarks, ['bell'], 'this world knows you stood there');
  assertEqual(banked.standings, ['bell-heard'], 'and the campaign keeps the standing');

  // A second expedition into the same world remembers both, and gets no second
  // gift out of it.
  const same = createRun(undefined, banked, NONCE);
  assertEqual(same.landmarks.has('bell'), true, 'the same world, still stood at');
  assertEqual(hasStanding(same, 'bell'), true, 'still known');

  // And then the hall takes the world. The standing survives; the world's own
  // record of it does not, because there is a new bell to find.
  const after = turnCycle(same);
  assertEqual(after.landmarks.size, 0, 'the new world has never been walked');
  assertEqual(hasStanding(after, 'bell'), true, 'but the campaign has stood at a bell before');
  assertEqual(after.cycles, 1, 'and the cycle counted');
});

unit('the Lantern Tree is the one standing that changes what a run sets out with', () => {
  const plain = createRun(SEED, emptySave(), NONCE);
  assertEqual(plain.inventory.length, 1, 'one candle, as it always was');

  const known = createRun(SEED, { ...emptySave(), standings: ['second-light'] }, NONCE);
  assertEqual(known.inventory.length, 2, 'and two for a campaign that has stood at the tree');
  assertEqual(known.activeIndex, 0, 'the first of them lit');
});

// --- What the map is allowed to know -----------------------------------------

unit('reading a post marks what it names, without going there', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  assertEqual(markedLandmarks(state).size, 0, 'nothing marked to begin with');

  const post = signposts(SEED).find((one) => one.id === 'post-1');
  const reading = readSignpost(state, post);
  assertEqual(reading.first, true, 'the first read');
  assertEqual(reading.target, post.target, 'names its landmark');
  assert(markedLandmarks(state).has(post.target), 'which is now on the map');
  assertEqual(state.landmarks.has(post.target), false, 'though you have still never been');

  assertEqual(readSignpost(state, post).first, false, 'reading it again is not the first read');
});

unit('nothing is ever lying on a landmark or its court', () => {
  // A landmark is a place, not a pickup: walking into it is the whole of it, so
  // neither the unique layer nor the scatter is allowed to put anything on its
  // nine tiles — however many times the world puts everything back somewhere
  // new (DESIGN.md §4.3).
  const state = createRun(SEED, emptySave(), NONCE);
  for (let epoch = 0; epoch < 4; epoch++) {
    for (const landmark of landmarks(SEED))
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          assertEqual(
            itemOnTile(state, landmark.x + dx, landmark.y + dy),
            null,
            `${landmark.id} is bare, epoch ${epoch}`
          );
    respawn(state);
  }
});

runIfMain(import.meta.url);
