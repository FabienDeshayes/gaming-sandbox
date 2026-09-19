// The landmarks and the fourteen posts that point at them: where they stand,
// what putting a hand on one hands over, and which of that survives a world
// being moulded away (DESIGN.md §4.10). Pure — no browser.
//
// The split this file is mostly about is the one that is easy to get wrong in
// both directions: a **gift** is the run's and comes back every world, a
// **standing** is the campaign's and never comes back at all. On top of that
// there is now a second split — the seven that stand in every world, and the
// one each kind of world keeps to itself, which has neither of those things.

import { assert, assertEqual, runIfMain, unit } from './harness.js';
import {
  biomeOf,
  chebyshev,
  chests,
  isWalkable,
  landmarkAt,
  landmarkNamed,
  landmarks,
  pickSeed,
  signpostBand,
  signpostBearing,
  signpostHutBearing,
  signpostReadings,
  sanctums,
  signpostTargets,
  signposts,
  terrainAt,
  blocksSight,
  chokeAt,
} from '../src/core/world.js';
import {
  chokeGrace,
  createRun,
  bankRun,
  hasStanding,
  canBuy,
  maxWater,
  priceFor,
  tankCeiling,
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
  tileKey,
} from '../src/core/rules.js';
import { emptySave, loadSave, writeSave } from '../src/core/save.js';
import {
  AQUEDUCT_TANK,
  CHOKE_STEP,
  EDGE_RADIUS,
  LANDMARK_CHEST_NEAR,
  LANDMARK_CHEST_SPAN,
  LANDMARK_GIFTS,
  LANDMARK_PLAN,
  PRICES,
  WATCHTOWER_GRACE,
  WEIGHHOUSE_DISCOUNT,
  SIGNPOST_BANDS,
  SIGNPOST_CLEARANCE,
  SIGNPOST_PLAN,
  STARTING_WATER,
} from '../src/balance.js';
import { BIOME_LANDMARK_IDS, LANDMARK_IDS, biomeLandmark, landmarkDef } from '../src/data/landmarks.js';
import { BIOMES } from '../src/data/biomes.js';
import { PALETTES } from '../src/config.js';
import { FIRST_POST, NONCE, POST_ROUTE, ringOf, SANCTUMS, SEED } from './world.js';

// --- Where they stand --------------------------------------------------------

unit('there are eight landmarks, spread round the rose, and none of them far out', () => {
  const found = landmarks(SEED);
  assertEqual(found.length, LANDMARK_PLAN.length, 'one per slot in the plan');
  assertEqual(
    found.filter((l) => !l.biome).map((l) => l.id),
    LANDMARK_IDS,
    'the same seven, in ring order'
  );

  // And the eighth, which is not one of the seven at all: it is whichever one
  // this kind of world keeps, derived off the seed exactly like the ground.
  const own = found.find((l) => l.biome);
  assertEqual(own.id, biomeLandmark(biomeOf(SEED)), "this world's own landmark");
  assert(!LANDMARK_IDS.includes(own.id), 'and it is never one of the seven');

  const angles = [];
  found.forEach((landmark, i) => {
    const plan = LANDMARK_PLAN[i];
    const distance = ringOf(landmark.x, landmark.y);
    assert(
      distance >= plan.near && distance <= plan.near + plan.span,
      `${landmark.id} stands in its band (${distance}, wanted ${plan.near}-${plan.near + plan.span})`
    );
    angles.push(Math.atan2(landmark.y, landmark.x));
  });

  // The furthest is nearer than the third sanctum: a landmark is on the way to
  // somewhere, never a walk of its own. The bound is the furthest any plan in
  // LANDMARK_PLAN reaches rather than a number restated here.
  const outermost = Math.max(...LANDMARK_PLAN.map((p) => p.near + p.span));
  assert(
    Math.max(...found.map((l) => ringOf(l.x, l.y))) <= outermost,
    `and the last one is inside ${outermost}`
  );

  // One to an eighth of the rose, and the rose itself is turned by the seed — so
  // what a player can rely on across worlds is not "the Mint is north", it is
  // "there is one in every direction". The claim that survives that is the
  // spread: the eight bearings are never bunched, whichever way the rose fell.
  // Measured across sixty worlds the tightest pair is about 21 degrees apart,
  // which is the jitter and the bad-ground dodge eating into a 45-degree slot.
  const apart = [];
  for (let a = 0; a < angles.length; a++)
    for (let b = a + 1; b < angles.length; b++) {
      const d = Math.abs(angles[a] - angles[b]);
      apart.push(((d > Math.PI ? Math.PI * 2 - d : d) * 180) / Math.PI);
    }
  assert(Math.min(...apart) > 15, `no two of them bunch (${Math.min(...apart).toFixed(0)}° apart)`);
});

unit('a landmark stands on a spoke of the sanctums\' rose, or halfway between two', () => {
  // The rose the eight take an eighth of each is the *sanctums'* (DESIGN.md
  // §4.10.2): a plan's `heading` is either a sanctum's index, and then the
  // landmark stands on that sanctum's own bearing and inside its distance, or a
  // pair of them, and then it stands on the bearing halfway between the two.
  // That is what the gifts are worth anything for — a full tank at the Bell is a
  // waystation on a route the campaign is walking anyway, where on a rose of its
  // own it was a detour in some other direction.
  //
  // Walked across many worlds rather than one, because what is being checked is
  // the placement rule and not where one seed happened to put things. Measured,
  // a spoke landmark sits within about 18 degrees of its sanctum's bearing and a
  // gap landmark within about 6 of the midpoint; the bounds here are loose
  // enough that the search which dodges bad ground can do its job.
  //
  // Raw seeds rather than `pickSeed`ed ones, deliberately: what a seed has to
  // clear to be picked is that the spawn isn't sealed in and everything is
  // walkable-to, and none of that touches where a landmark stands. The ground
  // is real either way, so the bad-ground dodge is exercised either way — and
  // a flood fill per world would make this the slowest test in the suite by an
  // order of magnitude for nothing (TESTING.md).
  const degrees = (a, b) => {
    let off = Math.abs(a - b);
    if (off > Math.PI) off = Math.PI * 2 - off;
    return (off * 180) / Math.PI;
  };

  for (let i = 1; i < 60; i++) {
    const seed = (Math.imul(i, 2654435761) ^ 0x5bf03635) | 0;
    const built = sanctums(seed);
    const bearing = (index) => Math.atan2(built[index].centre.y, built[index].centre.x);

    landmarks(seed).forEach((landmark, index) => {
      const { heading } = LANDMARK_PLAN[index];
      const mine = Math.atan2(landmark.y, landmark.x);

      if (!Array.isArray(heading)) {
        assert(
          degrees(mine, bearing(heading)) < 45,
          `${landmark.id} is ${degrees(mine, bearing(heading)).toFixed(0)}° off sanctum ${heading}`
        );
      } else {
        const from = bearing(heading[0]);
        let arc = bearing(heading[1]) - from;
        while (arc > Math.PI) arc -= Math.PI * 2;
        while (arc < -Math.PI) arc += Math.PI * 2;
        assert(
          degrees(mine, from + arc / 2) < 25,
          `${landmark.id} is not in the gap between sanctums ${heading[0]} and ${heading[1]}`
        );
      }

      // And inside the sanctum it is headed towards, so it is passed on the way
      // out rather than found beyond the thing it was meant to be on the way to.
      // The world's own landmark is the exception and is meant to be: it is not
      // on the way to anything, because it is not his signage and there is
      // nothing behind it.
      if (landmark.biome) return;
      const outer = Array.isArray(heading) ? heading[1] : heading;
      assert(
        ringOf(landmark.x, landmark.y) < built[outer].distance,
        `${landmark.id} stands outside sanctum ${outer}`
      );
    });
  }
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

unit('a colour is a family of landmarks, and a world\'s own is the world\'s colour', () => {
  // Seven landmarks and four palettes, so a colour cannot be a name any more
  // (src/data/landmarks.js). It is a family: the two about water are both
  // cathode, the two about seeing both amber, the two about money both magenta,
  // and the Gnomon keeps phosphor on its own. Two to a colour at most, which is
  // what keeps a colour readable as meaning something.
  const count = {};
  for (const id of LANDMARK_IDS) {
    const def = landmarkDef(id);
    assert(
      PALETTES.some((p) => p.id === def.palette),
      `${id} keeps one of the four palettes (${def.palette})`
    );
    count[def.palette] = (count[def.palette] || 0) + 1;
    assert(count[def.palette] <= 2, `${def.palette} belongs to no more than two of them`);
  }
  assertEqual(Object.keys(count).sort(), PALETTES.map((p) => p.id).sort(), 'and all four are used');

  // The four that belong to a single world take that world's own palette, which
  // is the same as saying they are never drawn in a colour at all: they hold no
  // standing, and a landmark reads plain until the campaign holds its standing.
  for (const biome of BIOMES) {
    const def = landmarkDef(biomeLandmark(biome.id));
    assertEqual(def.palette, biome.palette, `${def.id} is the colour of the world it is in`);
    assertEqual(def.standing, null, `and ${def.id} hands over no standing`);
  }
  assertEqual(new Set(BIOME_LANDMARK_IDS).size, BIOMES.length, 'one apiece, and no two the same');
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
    // The chest's own little ring round its landmark, which is placed on the
    // same rose as everything else (`LANDMARK_CHEST_NEAR`/`SPAN` in balance.js).
    const distance = ringOf(chest.x, chest.y, landmark.x, landmark.y);
    const furthest = LANDMARK_CHEST_NEAR + LANDMARK_CHEST_SPAN - 1;
    assert(
      distance >= LANDMARK_CHEST_NEAR && distance <= furthest,
      `${chest.id} stands just off ${chest.at} (${distance}, wanted ${LANDMARK_CHEST_NEAR}-${furthest})`
    );
  }

  // Each key is still well inside the gate it opens, which is the pacing the
  // chain has always rested on (DESIGN.md §4.4).
  for (const chest of chests(SEED).filter((c) => c.key)) {
    // Read off the sanctum that wants this key rather than written down, so
    // retuning SANCTUM_PLAN moves the claim with it.
    const gate = SANCTUMS.find((s) => s.key === chest.key).distance;
    assert(ringOf(chest.x, chest.y) < gate, `${chest.key} lies inside the gate it opens (${gate})`);
  }
});

// --- The posts ---------------------------------------------------------------

unit('the posts spread out, stay clear of what they point at, and one is at five', () => {
  const posts = signposts(SEED);
  assert(posts.length >= 11, `most of the fourteen stood up (${posts.length})`);

  const first = posts.find((post) => post.id === 'post-1');
  assert(first, 'the near post is one of them');
  const nearest = SIGNPOST_PLAN.find((p) => p.id === 'post-1');
  assertEqual(ringOf(first.x, first.y), nearest.near, `and it stands exactly ${nearest.near} tiles out`);
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

  // Two apiece, so every one of the seven is pointed at from both sides of
  // itself — one post nearer the hut than it is and one further out.
  for (const id of LANDMARK_IDS)
    assert(
      SIGNPOST_PLAN.filter((plan) => plan.target === id).length === 2,
      `${id} is assigned two posts`
    );

  // And the world's own landmark is assigned none of them, which is the point:
  // the posts are his signage, and the thing this ground kept is not his to
  // have written down (DESIGN.md §4.10.3). A post only ever names it by
  // happening to land close enough (`signpostTargets`).
  for (const id of BIOME_LANDMARK_IDS)
    assertEqual(
      SIGNPOST_PLAN.filter((plan) => plan.target === id).length,
      0,
      `no post is put up for ${id}`
    );
});

unit('what a post says is worked out from where it stands, sometimes about two landmarks', () => {
  for (const post of signposts(SEED)) {
    const targets = signpostTargets(post, SEED);
    assertEqual(targets[0], post.target, `${post.id} always names its assigned landmark first`);
    assertEqual(new Set(targets).size, targets.length, `${post.id} never names a landmark twice`);
    // Any name beyond the assigned one is only there because this post
    // genuinely landed close enough to it to be worth mentioning too.
    for (const id of targets.slice(1)) {
      const extra = landmarkNamed(id, SEED);
      assert(
        chebyshev(post.x, post.y, extra.x, extra.y) < SIGNPOST_BANDS[0],
        `${post.id} only names ${id} because it is nearby`
      );
    }

    const readings = signpostReadings(post, SEED);
    assertEqual(
      readings.map((r) => r.target),
      targets,
      `${post.id} has exactly one reading per target, in the same order`
    );
    for (const reading of readings) {
      const target = landmarkNamed(reading.target, SEED);
      assertEqual(reading.distance, chebyshev(post.x, post.y, target.x, target.y), 'and how far it is');
      assert(reading.bearing >= 0 && reading.bearing < 8, 'on one of the eight headings');
      assert(reading.band >= 0 && reading.band <= SIGNPOST_BANDS.length, 'in one of the bands');
    }

    // The cryptic hut heading is always one of the eight, and is never mixed
    // into the landmark readings above.
    const hutBearing = signpostHutBearing(post);
    assert(hutBearing >= 0 && hutBearing < 8, `${post.id}'s blank stub still points somewhere`);
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

unit('a landmark pays its gift on every fresh touch, not just the first', () => {
  const { state, landmark } = atLandmark('mint');
  assertEqual(landmarkOnTile(state, landmark.x, landmark.y).touched, false, 'not been here yet');

  const first = touchLandmark(state, landmark);
  assertEqual(first.already, false, 'the first touch lands');
  assertEqual(first.gift.coins, LANDMARK_GIFTS.mint.coins, 'and it strikes you blanks');
  assertEqual(state.coins, LANDMARK_GIFTS.mint.coins, 'which go in the pocket');

  // A real return visit — fresh, the default — pays again.
  const again = touchLandmark(state, landmark);
  assertEqual(again.already, true, 'this world has had it off you before');
  assertEqual(again.gift.coins, LANDMARK_GIFTS.mint.coins, 'but the gift lands again anyway');
  assertEqual(state.coins, LANDMARK_GIFTS.mint.coins * 2, 'and pays into the same purse');

  // What does not repeat is a direction key held against the same bump — no
  // step landed in between, so it is not a fresh touch.
  const held = touchLandmark(state, landmark, false);
  assertEqual(held.gift, null, 'held against it again pays nothing');
  assertEqual(state.coins, LANDMARK_GIFTS.mint.coins * 2, 'the purse is where it was');
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

unit('the three later gifts are the shapes their places are', () => {
  // The Aqueduct draws a *band* rather than a clearing: the ground along the
  // line it runs on, which is the ray out from the hut through the landmark
  // itself. That is the whole of what makes it worth having next to the
  // Gnomon's block of ground.
  const aqueduct = atLandmark('aqueduct');
  const given = touchLandmark(aqueduct.state, aqueduct.landmark);
  const { on } = LANDMARK_GIFTS.aqueduct.corridor;
  const reach = Math.hypot(aqueduct.landmark.x, aqueduct.landmark.y);
  const ux = aqueduct.landmark.x / reach;
  const uy = aqueduct.landmark.y / reach;
  const along = {
    x: Math.round(aqueduct.landmark.x + ux * on),
    y: Math.round(aqueduct.landmark.y + uy * on),
  };
  const beside = {
    x: Math.round(aqueduct.landmark.x - uy * on),
    y: Math.round(aqueduct.landmark.y + ux * on),
  };
  assert(given.gift.revealed > 150, 'it draws a good deal of ground');
  assert(aqueduct.state.explored.has(tileKey(along.x, along.y)), 'the far end of the channel is drawn');
  assert(
    !aqueduct.state.explored.has(tileKey(beside.x, beside.y)),
    'and the ground the same distance off to the side is not — this is a direction, not a clearing'
  );

  // The Watchtower is the one thing in the game that is for seeing a long way,
  // so what it draws dwarfs the dial's.
  const tower = atLandmark('watchtower');
  const seen = touchLandmark(tower.state, tower.landmark).gift.revealed;
  const gnomon = atLandmark('gnomon');
  assert(
    seen > touchLandmark(gnomon.state, gnomon.landmark).gift.revealed * 3,
    `the tower shows you more than the dial does (${seen})`
  );

  // The Weighhouse hands things over outright, and they land exactly as walking
  // onto them would: the drop is drunk, the candle goes in the pack unlit.
  const scales = atLandmark('weighhouse');
  scales.state.water = 40;
  const lights = scales.state.inventory.length;
  const paid = touchLandmark(scales.state, scales.landmark);
  assertEqual(paid.gift.stocked, LANDMARK_GIFTS.weighhouse.stock, 'it names what it handed over');
  assert(scales.state.water > 40, 'the water went in the tank');
  assertEqual(scales.state.inventory.length, lights + 1, 'and the light in the pack');
});

unit('the Aqueduct widens the tank for good, and the hall cannot take it back', () => {
  writeSave(emptySave());
  const { state, landmark } = atLandmark('aqueduct');
  assertEqual(tankCeiling(state), maxWater(state.gems), 'the plain ceiling to begin with');

  touchLandmark(state, landmark);
  assertEqual(
    tankCeiling(state),
    maxWater(state.gems) + AQUEDUCT_TANK,
    'and a wider one once the campaign has stood under it'
  );

  // A gem widens the tank too and the hall takes every gem back. This is the
  // one widening it cannot, because a standing is not a thing you are carrying
  // (DESIGN.md §4.10).
  const banked = bankRun(state);
  const next = createRun(undefined, banked, NONCE);
  assertEqual(next.water, maxWater(0) + AQUEDUCT_TANK, 'a fresh walk sets out on the wider tank');
  assertEqual(turnCycle(next).water, maxWater(0) + AQUEDUCT_TANK, 'and so does one in the next world');
});

unit('the Watchtower pushes the dark back, without moving the rim', () => {
  const { state, landmark } = atLandmark('watchtower');
  assertEqual(chokeGrace(state), 0, 'the dark eats a light where it always did');

  touchLandmark(state, landmark);
  assertEqual(chokeGrace(state), WATCHTOWER_GRACE, 'and waits longer once you have been up it');

  // Two more steps of reach out where the choke is actually biting, and not one
  // tile of world either way: the rim is where it was.
  const out = EDGE_RADIUS - 10;
  assertEqual(
    chokeAt(out, 0, WATCHTOWER_GRACE) - chokeAt(out, 0),
    WATCHTOWER_GRACE / CHOKE_STEP,
    'the curve moved outward by exactly the grace'
  );
  assertEqual(chokeAt(0, 0, WATCHTOWER_GRACE) > 3, true, 'and nothing is eating your light at home either way');
});

unit('the Weighhouse takes a quarter off every price, for good', () => {
  const { state, landmark } = atLandmark('weighhouse');
  for (const id of Object.keys(PRICES))
    assertEqual(priceFor(state, id), PRICES[id], `${id} is the shelf price to begin with`);

  touchLandmark(state, landmark);
  for (const id of Object.keys(PRICES))
    assertEqual(
      priceFor(state, id),
      Math.ceil(PRICES[id] * (1 - WEIGHHOUSE_DISCOUNT)),
      `${id} is a quarter off`
    );

  // And it is what you are charged rather than only what the shelf says: a
  // purse holding exactly the discounted price can buy.
  state.coins = priceFor(state, 'map');
  state.banked.coins = 0;
  assert(canBuy(state, 'map'), 'the discounted price is a price you can pay');
  assert(state.coins < PRICES.map, 'on less than the shelf ever asked for');
});

unit("the world's own landmark hands over nothing, and keeps nothing", () => {
  writeSave(emptySave());
  const id = biomeLandmark(biomeOf(SEED));
  const { state, landmark } = atLandmark(id);

  const result = touchLandmark(state, landmark);
  assertEqual(result.gift, null, 'there is nothing to take');
  assertEqual(result.firstEver, false, 'and no standing to hold, ever');
  assertEqual(hasStanding(state, id), false, 'so the campaign holds none');
  assertEqual(standings(state), [], 'and knows nothing new');

  // Banked like any landmark all the same — this world knows you stood there —
  // and gone with the world when the hall takes it, exactly as a post is.
  const banked = bankRun(state);
  assertEqual(banked.landmarks, [id], 'this world knows you were there');
  assertEqual(banked.standings, [], 'and the campaign keeps nothing of it');
  const same = createRun(undefined, banked, NONCE);
  assertEqual(same.landmarks.has(id), true, 'the same world, still stood at');
  assertEqual(turnCycle(same).landmarks.size, 0, 'and the new world has never been walked');
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

unit('a post occasionally lands close enough to name a second landmark', () => {
  // SEED never happens to put a post within naming distance of a landmark it
  // wasn't assigned, so the general sweep above never exercises that branch.
  // Seed 2 is picked because it does, on the world it actually derives — this
  // checks the real thing happening at least once rather than only the shape
  // of the rule.
  const seed = pickSeed(2);
  const multi = signposts(seed).filter((post) => signpostTargets(post, seed).length > 1);
  assert(multi.length > 0, 'at least one post on this seed names two landmarks');
  for (const post of multi) {
    const targets = signpostTargets(post, seed);
    const readings = signpostReadings(post, seed);
    assertEqual(targets[0], post.target, `${post.id} still names its assigned landmark first`);
    assertEqual(
      readings.map((r) => r.target),
      targets,
      `${post.id} has one reading per name it gives`
    );
  }
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

  // post-1 stands only 5 tiles out, far too close to any landmark but the one
  // it is assigned (mint) to ever also land within naming distance of another
  // — see the ring gaps in SIGNPOST_PLAN/LANDMARK_PLAN — so it is always a
  // single, deterministic reading to check against.
  const post = signposts(SEED).find((one) => one.id === 'post-1');
  const reading = readSignpost(state, post);
  assertEqual(reading.first, true, 'the first read');
  assertEqual(reading.readings.length, 1, 'post-1 only ever names the one landmark');
  assertEqual(reading.readings[0].target, post.target, 'names its landmark');
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
