// The ground: what the noise grows, where the world stops, and the promise that
// every bit of it can be walked to. Pure — no browser.

import { assert, assertEqual, runIfMain, unit } from './harness.js';
import {
  DEFAULT_SEED,
  beyondEdge,
  biomeOf,
  blocksSight,
  chestAt,
  chests,
  chokeAt,
  entryKey,
  isWalkable,
  itemAt,
  landmarkAt,
  landmarks,
  landmarksReachable,
  pickSeed,
  reachableFraction,
  sanctumAt,
  sanctums,
  terrainAt,
} from '../src/core/world.js';
import { activeShape, createRun, litTiles, reveal, step, EDGE_SEEN } from '../src/core/rules.js';
import { emptySave, normaliseSave } from '../src/core/save.js';
import { CHEST_COIN_VALUES, EDGE_RADIUS, SEED_MIN_FRACTION } from '../src/balance.js';
import { BIOME_IDS } from '../src/data/biomes.js';
import { ALL_KEYS, ALL_KEYS_LIST, NONCE, ORTHOGONAL, SEED, SHUT_GATE } from './world.js';

// One window, walked once, for the three distribution tests below — the whole
// cost of them is `terrainAt`, and asking it 20,000 times per test is the only
// slow thing in this file.
const SPAN = 70;
const survey = (() => {
  const counts = { floor: 0, rock: 0, tree: 0, wall: 0, gate: 0, dark: 0 };
  let open = 0;
  let looseRock = 0;
  let treesInAStand = 0;
  for (let y = -SPAN; y <= SPAN; y++)
    for (let x = -SPAN; x <= SPAN; x++) {
      if (sanctumAt(x, y, SEED) || landmarkAt(x, y, SEED)) continue;
      open += 1;
      const at = terrainAt(x, y, SEED);
      counts[at] += 1;
      if (at === 'rock' && ORTHOGONAL.every(([dx, dy]) => terrainAt(x + dx, y + dy, SEED) !== 'rock'))
        looseRock += 1;
      if (at === 'tree' && ORTHOGONAL.some(([dx, dy]) => terrainAt(x + dx, y + dy, SEED) === 'tree'))
        treesInAStand += 1;
    }
  return { counts, open, looseRock, treesInAStand };
})();

unit('the world is derived, so walking through it never changes it', () => {
  // Terrain and items are pure functions of (x, y, seed), but they are read
  // through caches (the structures per seed, the accepted scatter per salt) and
  // a run moves the salt on. So the honest check is to read the world, play
  // through it, and read it again.
  const window = [];
  for (let y = -12; y <= 12; y++)
    for (let x = -12; x <= 12; x++) window.push([x, y, terrainAt(x, y, SEED), itemAt(x, y, SEED)]);

  const state = createRun(SEED, emptySave(), NONCE);
  for (let i = 0; i < 40; i++) step(state, i % 2 === 0 ? 'right' : 'left');

  for (const [x, y, was, had] of window) {
    assertEqual(terrainAt(x, y, SEED), was, `terrain at (${x},${y})`);
    assertEqual(itemAt(x, y, SEED), had, `pristine item at (${x},${y})`);
  }

  // And a different seed is a different world.
  let differences = 0;
  for (let i = 0; i < 200; i++)
    if (terrainAt(i, 3, SEED) !== terrainAt(i, 3, SEED + 1)) differences++;
  assert(differences > 20, `seeds should differ, got ${differences} differing tiles`);
});

unit('a world is one biome, and which one is the seed the world is', () => {
  // A biome is a property of the world rather than of any tile in it — a
  // campaign never walks from one into another (DESIGN.md §4.3) — so the only
  // thing there is to check about *where* it applies is that it takes a seed
  // and nothing else.
  assert(BIOME_IDS.includes(biomeOf(SEED)), 'the suite walks one of the four');
  assertEqual(biomeOf(SEED), biomeOf(SEED), 'and the answer never moves');

  // Every kind of world turns up, and roughly as often as the others: a player
  // starting over should not have to draw ten campaigns to see a desert.
  const tally = {};
  const worlds = 800;
  for (let i = 0; i < worlds; i++) {
    const biome = biomeOf(pickSeed((i * 2654435761) | 0));
    tally[biome] = (tally[biome] || 0) + 1;
  }
  for (const id of BIOME_IDS) {
    const share = (tally[id] || 0) / worlds;
    assert(share > 0.15, `${id} comes up about as often as the rest (${(share * 100).toFixed(0)}%)`);
  }

  // A run is walking that world, and says so — which is what the renderer asks
  // to know which tiles to draw the ground with (src/data/tiles.js).
  const state = createRun(SEED, emptySave(), NONCE);
  assertEqual(state.biome, biomeOf(SEED), 'the run knows what kind of world it is in');
  const elsewhere = createRun(SEED + 1, emptySave(), NONCE);
  assertEqual(elsewhere.biome, biomeOf(elsewhere.seed), 'and so does a run in another world');
});

unit('the base clearing is always walkable', () => {
  for (let y = -1; y <= 1; y++)
    for (let x = -1; x <= 1; x++)
      for (const seed of [SEED, 5, 8, 999]) assert(isWalkable(x, y, seed), `(${x},${y}) seed ${seed}`);
});

unit('rock covers about a fifth of the world, in masses and loose boulders', () => {
  const share = survey.counts.rock / survey.open;
  // Enough to grow caves worth navigating, few enough that the world reads as
  // floor with rock in it rather than the other way round.
  assert(share > 0.15 && share < 0.26, `rock covers ${(share * 100).toFixed(1)}% of the world`);

  // Two formations, same terrain and so the same sprite: masses grown on a
  // lattice, and boulders thrown as white noise into the open ground between
  // them. The second is what keeps a wide stretch of floor from being an empty
  // screen.
  assert(survey.looseRock > 150, `only ${survey.looseRock} boulders stand on their own`);
  assert(
    survey.counts.rock - survey.looseRock > survey.looseRock * 5,
    'the masses should still be most of the rock in the world'
  );
});

unit('trees grow in groves and stop a step the way rock does', () => {
  const trees = survey.counts.tree;
  const share = trees / survey.open;
  // Enough that a walk meets one, few enough that the world is still mostly
  // ground: trees block, so every one of them is floor the player lost.
  assert(share > 0.04 && share < 0.1, `trees cover ${(share * 100).toFixed(1)}% of the world`);
  // Groves, not scattered trunks — that is what the coarse lattice buys.
  assert(survey.treesInAStand / trees > 0.9, 'nearly every tree should have another beside it');

  // Blocking, and blocking absolutely: no key opens a tree.
  const tree = (() => {
    for (let y = -SPAN; y <= SPAN; y++)
      for (let x = -SPAN; x <= SPAN; x++) if (terrainAt(x, y, SEED) === 'tree') return [x, y];
    throw new Error('the survey found trees but the sweep did not');
  })();
  assert(!isWalkable(tree[0], tree[1], SEED), 'a tree blocks');
  assertEqual(entryKey(tree[0], tree[1], SEED), false, 'and nothing carried opens it');
});

unit('the world ends at a fixed radius, and the dark there is solid', () => {
  // Bounded, and bounded as a circle rather than as a box: the edge is a shape
  // the player sees on the map, and a square one reads as an authored wall
  // (DESIGN.md §4.7).
  assert(!beyondEdge(EDGE_RADIUS, 0), 'the rim itself is inside');
  assert(beyondEdge(EDGE_RADIUS + 1, 0), 'and one tile further out is not');
  // On the diagonal too, which a Chebyshev bound would get wrong.
  const diag = Math.ceil(EDGE_RADIUS / Math.SQRT2) + 2;
  assert(beyondEdge(diag, diag), `the diagonal is bounded at the same radius (${diag})`);

  assertEqual(terrainAt(EDGE_RADIUS + 5, 0, SEED), 'dark', 'outside is its own terrain');
  assert(!isWalkable(EDGE_RADIUS + 5, 0, SEED), 'and nothing walks on it');
  assertEqual(entryKey(EDGE_RADIUS + 5, 0, SEED), false, 'nothing carried opens it');

  // Everything the campaign is currently about is comfortably inside, with room
  // left over — the outermost sanctum wall against the rim.
  for (const sanctum of sanctums(SEED)) {
    const out = Math.hypot(sanctum.centre.x, sanctum.centre.y) + sanctum.radius;
    assert(out < EDGE_RADIUS * 0.75, `sanctum ${sanctum.index} sits well inside (${out.toFixed(0)})`);
  }
});

unit('the dark eats into the light as you approach the edge', () => {
  // A tile of reach for every ten walked, and never all the way to nothing:
  // the boundary is read by seeing the ground stop, which needs a lit tile to
  // see it from (DESIGN.md §4.7).
  assert(chokeAt(0, 0) > 3, 'nothing is eating your light at home');
  assertEqual(chokeAt(EDGE_RADIUS, 0), 1, 'and a single tile is left at the rim');
  assert(chokeAt(EDGE_RADIUS - 40, 0) > chokeAt(EDGE_RADIUS - 10, 0), 'closer in is brighter');

  // The choke is where you stand, not what you carry: it costs the light
  // nothing, so walking back in restores it.
  const state = createRun(SEED, emptySave(), NONCE);
  const home = activeShape(state).radius;
  state.x = EDGE_RADIUS - 2;
  assertEqual(activeShape(state).radius, 1, 'guttering at the rim');
  state.x = 0;
  assertEqual(activeShape(state).radius, home, 'and as wide as ever back home');
});

unit('what stops a step mostly stops a light, and a gate stops one until it opens', () => {
  // Sight and passage are two different questions the terrain answers, and the
  // gate is the tile where they come apart (DESIGN.md §4.1).
  const gate = SHUT_GATE.gate;
  assertEqual(terrainAt(gate.x, gate.y, SEED), 'gate', 'the route found a gate');
  assert(blocksSight(gate.x, gate.y, SEED, null), 'shut, it stops a light like the wall it sits in');
  assert(
    !blocksSight(gate.x, gate.y, SEED, new Set([SHUT_GATE.key])),
    'and the key that opens it opens a window in the same moment'
  );

  // The ring it stands in never opens, however much is being carried.
  const wall = (() => {
    for (let dy = -SHUT_GATE.radius; dy <= SHUT_GATE.radius; dy++)
      for (let dx = -SHUT_GATE.radius; dx <= SHUT_GATE.radius; dx++) {
        const x = SHUT_GATE.centre.x + dx;
        const y = SHUT_GATE.centre.y + dy;
        if (terrainAt(x, y, SEED) === 'wall') return [x, y];
      }
    throw new Error('a sanctum with no wall around it');
  })();
  assert(blocksSight(wall[0], wall[1], SEED, ALL_KEYS), 'masonry stops a light whatever you hold');

  // And the ordinary cases, so the one rule covers the whole terrain table.
  assert(!blocksSight(0, 0, SEED, null), 'the hut, and floor generally, is see-through');
  assert(blocksSight(EDGE_RADIUS + 5, 0, SEED, ALL_KEYS), 'so is the dark outside the world');
});

unit('a chest blocks a step, never a light, and stands on ground you can reach', () => {
  // The one thing in the world you meet by failing to walk onto it (DESIGN.md
  // §4.8) — so it has to be solid to a step and transparent to a light, or a
  // box would be a wall the shadow rules never accounted for.
  for (const chest of chests(SEED)) {
    assertEqual(terrainAt(chest.x, chest.y, SEED), 'chest', `${chest.id} is its own terrain`);
    assert(!isWalkable(chest.x, chest.y, SEED), `${chest.id} cannot be stepped on`);
    assertEqual(entryKey(chest.x, chest.y, SEED), false, `${chest.id} opens for no key`);
    assert(!blocksSight(chest.x, chest.y, SEED, null), `${chest.id} casts no shadow`);
    // Forced-floor apron all the way round, so whichever side you come from
    // there is somewhere to stand and open it.
    for (const [dx, dy] of ORTHOGONAL)
      assert(
        isWalkable(chest.x + dx, chest.y + dy, SEED),
        `${chest.id} has floor on every side of it`
      );
    assertEqual(chestAt(chest.x, chest.y, SEED).part, 'site', `${chest.id} knows its own tile`);
  }

  // And they stay off each other and off everything else that was placed first.
  const sites = chests(SEED);
  for (const a of sites)
    for (const b of sites)
      if (a !== b)
        assert(
          Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) > 2,
          `${a.id} and ${b.id} stand clear of each other`
        );
});

unit('the three keys are in three chests, each inside the gate it opens', () => {
  // The pacing rests on this: a gate is only shut until you have walked to the
  // chest that holds its key, and that chest is always the nearer of the two
  // (DESIGN.md §4.8).
  const keyChests = chests(SEED).filter((chest) => chest.key);
  assertEqual(keyChests.map((chest) => chest.key), ALL_KEYS_LIST, 'one chest per shut gate');
  for (const sanctum of sanctums(SEED)) {
    if (!sanctum.key) continue;
    const chest = keyChests.find((c) => c.key === sanctum.key);
    const out = Math.max(Math.abs(chest.x), Math.abs(chest.y));
    assert(
      out < sanctum.distance,
      `${chest.id} (${out} out) is inside the gate it opens (${sanctum.distance})`
    );
  }

  // Everything else in a chest is a hoard of coins, and one of the three sizes
  // balance.js offers.
  for (const chest of chests(SEED))
    if (!chest.key)
      assert(CHEST_COIN_VALUES.includes(chest.coins), `${chest.id} holds a hoard the table names`);
});

unit('light never reveals what is outside the world', () => {
  // Otherwise the explored set would carry tiles that are not there, and both
  // maps draw off that set.
  const state = createRun(SEED, emptySave(), NONCE);
  state.x = EDGE_RADIUS;
  state.y = 0;
  reveal(state);
  for (const { x, y } of litTiles(state)) assert(!beyondEdge(x, y), `lit (${x},${y}) is inside`);
  for (const key of state.explored) {
    const [x, y] = key.split(',').map(Number);
    assert(!beyondEdge(x, y), `explored (${x},${y}) is inside`);
  }
});

unit('walking into the end of the world says so, once', () => {
  const state = createRun(SEED, emptySave(), NONCE);

  // Derived, not hardcoded: find a tile you can stand on whose next step
  // outward is off the end of the world. Most of the rim is rock, so this walks
  // the boundary looking for open ground against it.
  let spot = null;
  for (let y = -EDGE_RADIUS; y <= EDGE_RADIUS && !spot; y++) {
    const x = Math.floor(Math.sqrt(EDGE_RADIUS * EDGE_RADIUS - y * y));
    if (isWalkable(x, y, state.seed) && beyondEdge(x + 1, y)) spot = { x, y };
  }
  assert(spot, 'there is open ground standing against the rim somewhere');
  state.x = spot.x;
  state.y = spot.y;

  const result = step(state, 'right');
  assertEqual(result.moved, false, 'the world stops the walk');
  assertEqual(result.reason, 'edge', 'and says it was the edge, not a rock');
  assertEqual(result.firstTime, true, 'the first bump earns the explanation');
  assertEqual(step(state, 'right').firstTime, false, 'the second one does not');

  // Filed with the things the campaign has laid eyes on, so it is written down
  // whichever way the expedition ends and not offered again next time out.
  assert(state.seenUnique.has(EDGE_SEEN), 'the campaign remembers reaching it');
});

unit('a saved walk from outside the world comes home instead of stranding', () => {
  // Not reachable by playing — you cannot walk out there — but a hand-edited or
  // corrupted slot could name such a tile, and every neighbour of one is also
  // outside it. Restoring that position would leave a character who can neither
  // step nor die (DESIGN.md §5).
  const outside = normaliseSave({
    ...emptySave(),
    run: { seed: SEED, x: EDGE_RADIUS + 40, y: 0, water: 50, nonce: NONCE },
  });
  assertEqual({ x: outside.run.x, y: outside.run.y }, { x: 0, y: 0 }, 'put back at the hut');

  const inside = normaliseSave({
    ...emptySave(),
    run: { seed: SEED, x: 12, y: -7, water: 50, nonce: NONCE },
  });
  assertEqual({ x: inside.run.x, y: inside.run.y }, { x: 12, y: -7 }, 'a real one is untouched');
});

unit('the whole world is one place, out to the rim', () => {
  // The point of an edge you can walk to is that you can walk to it. If the
  // noise sealed the outer band off, the rim would be a promise the world never
  // keeps — so this floods the entire thing from the hut with every gate shut.
  const limit = EDGE_RADIUS + 2;
  const seen = new Set(['0,0']);
  const stack = [[0, 0]];
  let furthest = 0;
  while (stack.length) {
    const [x, y] = stack.pop();
    furthest = Math.max(furthest, Math.hypot(x, y));
    for (const [dx, dy] of ORTHOGONAL) {
      const nx = x + dx;
      const ny = y + dy;
      if (Math.abs(nx) > limit || Math.abs(ny) > limit) continue;
      const key = `${nx},${ny}`;
      if (seen.has(key) || !isWalkable(nx, ny, SEED)) continue;
      seen.add(key);
      stack.push([nx, ny]);
    }
  }
  let walkable = 0;
  for (let y = -limit; y <= limit; y++)
    for (let x = -limit; x <= limit; x++) if (isWalkable(x, y, SEED)) walkable++;

  assert(walkable > 50000, `the world is a large place (${walkable} tiles)`);
  assert(seen.size / walkable > 0.95, `and nearly all of it connects (${seen.size}/${walkable})`);
  assert(furthest >= EDGE_RADIUS - 1, `including the rim itself (reached ${furthest.toFixed(1)})`);
});

unit('pickSeed rejects a world nobody could explore', () => {
  // Two bars, and a seed has to clear both: the spawn must not be sealed into a
  // pocket, and every sanctum door and landmark must be walkable-to with
  // nothing in hand (DESIGN.md §5). Seed 5 fails the first outright.
  assert(reachableFraction(5) < SEED_MIN_FRACTION, 'seed 5 should be a stranding seed');
  const replacement = pickSeed(5);
  assert(replacement !== 5, 'a stranding seed should be rejected');

  for (const preferred of [5, 1, 77, 12345, DEFAULT_SEED, (DEFAULT_SEED + 7919) | 0]) {
    const picked = pickSeed(preferred);
    assert(reachableFraction(picked) >= SEED_MIN_FRACTION, `seed picked from ${preferred} is a pocket`);
    assert(landmarksReachable(picked), `seed picked from ${preferred} seals a door or a landmark off`);
    // And every landmark sits on ground, with a clearing around it.
    for (const landmark of landmarks(picked))
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          assert(
            isWalkable(landmark.x + dx, landmark.y + dy, picked),
            `${landmark.id}'s apron is walkable on the seed picked from ${preferred}`
          );
  }
});

runIfMain(import.meta.url);
