// The world the suite walks, and the routes through it.
//
// There are no hand-authored levels, so nothing here is a coordinate: every
// route is BFSed out of the real world at load time, which is what keeps the
// tests honest if the noise is ever retuned. See TESTING.md.
//
// Shared by every suite, and imported once, so the searches below are paid for
// once however many suites run.

import { test as browserTest } from './harness.js';
import { tileKey } from '../src/core/light.js';
import {
  BASE_X,
  BASE_Y,
  biomeOf,
  blocksSight,
  canEnter,
  chestApproach,
  chests,
  DEFAULT_SEED,
  isBase,
  isMerchant,
  isWalkable,
  itemAt,
  landmarks,
  pickSeed,
  saltOf,
  sanctums,
  signposts,
} from '../src/core/world.js';
import { KEYS } from '../src/data/items.js';
import { biomeDef } from '../src/data/biomes.js';
import { landmarkDef } from '../src/data/landmarks.js';
import { emptySave } from '../src/core/save.js';
import { LIGHTS, STARTING_LIGHT, STARTING_WATER } from '../src/balance.js';
import { setDefaultPalette } from '../src/config.js';

export const SEED = pickSeed(DEFAULT_SEED);

// Which kind of world that is, and so which colour a page walking it draws
// itself in (src/data/biomes.js). A browser test opens on a browser that has
// never picked a palette in Settings, so the world's own colour is what it
// gets — and a test that says what colour something should be works that out
// from `gemColour` here, in Node. So Node is put into the same world's colours
// on the way past: the suite asserts against the palette the page is actually
// in, whichever world the seed turns out to name.
export const BIOME = biomeOf(SEED);
setDefaultPalette(biomeDef(BIOME).palette);

// Consumables are salted with a nonce a run draws at the start, so the pure
// tests fix one and the browser tests ask the page for its own.
export const NONCE = 20260818;
export const SALT = saltOf(NONCE, 0);

// A run of this world with a known scatter, for tests that only need to read it.
export const scatter = (x, y, gems = 0, salt = SALT) => itemAt(x, y, SEED, { salt, gems });

export const ORTHOGONAL = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// Where a run actually starts (core/rules.js `createRun`): one tile south of
// the hut, not on it, so every route BFSed against it walks the same tiles a
// real run's D-pad taps would.
export const START = [BASE_X, BASE_Y + 1];

// Every key in the game, and the list of them in order — for a route that has
// to walk through a gate, and for the tests that assert what an empty-handed
// walker can and can't open.
export const ALL_KEYS_LIST = KEYS;
export const ALL_KEYS = new Set(KEYS);

// `keys` is what the walker is carrying, because a sanctum gate is only walkable
// to a run holding the key it wants — routing with nothing would send a test
// round the outside of a sanctum it is supposed to walk into. The hut answers
// a step onto it with its own dialog, which freezes every further tap until
// it's dismissed — so a route may only ever end there, never cross it, unless
// the hut is itself what's being routed to.
export function bfs(seed, isGoal, maxDepth = 24, start = START, keys = null) {
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
        if (prev.has(key) || !canEnter(nx, ny, seed, keys)) continue;
        prev.set(key, [tileKey(x, y), name]);
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
        if (!isBase(nx, ny)) next.push([nx, ny]);
      }
    }
    frontier = next;
  }
  throw new Error('no route found in the test world');
}

// The nearest medium torch and the nearest water drop in the pinned world, and
// the nearest spot with a rock to walk into. Terrain doesn't move with the
// nonce; the item routes only hold for a page opened on NONCE (`WORLD` below).
export const TORCH_ROUTE = bfs(SEED, (x, y) => scatter(x, y) === 'torch-medium', 60);
export const WATER_ROUTE = bfs(SEED, (x, y) => scatter(x, y) === 'water-drop', 60);
export const ROCK_ROUTE = bfs(SEED, (x, y) => {
  const into = [['up', 0, -1], ['right', 1, 0], ['down', 0, 1], ['left', -1, 0]].find(
    ([, dx, dy]) => !isWalkable(x + dx, y + dy, SEED)
  );
  return into ? into[0] : null;
});
// The nearest spot to stand where something casts a shadow worth measuring: a
// blocker one step away, with open floor two and three steps along the same
// line behind it. `hit` is the direction it stands in, so a test can name the
// tiles either side of it without writing a coordinate down.
export const SHADOW_ROUTE = bfs(SEED, (x, y) => {
  const found = ORTHOGONAL.find(
    ([dx, dy]) =>
      blocksSight(x + dx, y + dy, SEED) &&
      isWalkable(x + dx * 2, y + dy * 2, SEED) &&
      isWalkable(x + dx * 3, y + dy * 3, SEED)
  );
  return found ? { dx: found[0], dy: found[1] } : null;
});

// The four sanctums of this world, and the walk to the first gem. Sanctum 1's
// arch is the one that stands open, so this route is walkable carrying nothing
// — which is exactly the promise the chain rests on.
export const SANCTUMS = sanctums(SEED);
export const FIRST_GEM = SANCTUMS[0];
export const GEM_ROUTE = bfs(SEED, (x, y) => x === FIRST_GEM.centre.x && y === FIRST_GEM.centre.y, 90);
// The walk to the merchant. The sites don't move with the nonce, so this route
// holds for any page — but it is 20-odd taps, so only one test walks it.
export const MERCHANT_ROUTE = bfs(SEED, (x, y) => isMerchant(x, y, SEED), 60);

// The hall, and the walk to the tile you talk to the sorcerer from (DESIGN.md
// §4.9). His own tile can't be stepped on, so — like a chest — the route stops
// beside him and `hit` is the direction the last input bumps in. It is 110
// tiles out and behind the last gate in the game, so it is routed with every
// key and never actually walked: the browser test plants itself on his doorstep
// (`standingAt`) and takes the one step that matters.
export const HALL = SANCTUMS.find((s) => s.hall);
export const HALL_ROUTE = bfs(
  SEED,
  (x, y) => {
    const into = [['up', 0, -1], ['right', 1, 0], ['down', 0, 1], ['left', -1, 0]].find(
      ([, dx, dy]) => x + dx === HALL.centre.x && y + dy === HALL.centre.y
    );
    return into ? into[0] : null;
  },
  200,
  START,
  ALL_KEYS
);

// The four landmarks of this world, the nearest of them, and the walk to its
// doorstep. A landmark's own tile can't be stepped on — it is walked *into*,
// like a chest — so the route stops on its court and `hit` is the direction the
// last input bumps in (DESIGN.md §4.10).
export const LANDMARKS_HERE = landmarks(SEED);
// Which one the browser tests walk to: the nearest whose own colour is *not*
// the colour this world is drawn in. Every world has exactly one landmark at
// home in it (src/data/landmarks.js), and that is the one whose colour nothing
// on screen could tell apart from the foreground — so a test about a landmark
// gaining its colour has no business being pointed at it.
export const NEAREST_LANDMARK =
  LANDMARKS_HERE.find((l) => landmarkDef(l.id).palette !== biomeDef(BIOME).palette) ||
  LANDMARKS_HERE[0];
export const LANDMARK_ROUTE = bfs(
  SEED,
  (x, y) => {
    const into = [['up', 0, -1], ['right', 1, 0], ['down', 0, 1], ['left', -1, 0]].find(
      ([, dx, dy]) => x + dx === NEAREST_LANDMARK.x && y + dy === NEAREST_LANDMARK.y
    );
    return into ? into[0] : null;
  },
  90
);

// And the post that stands five tiles from the hut, which is the one every
// campaign meets on its first expedition. Read the same way: a bump.
export const FIRST_POST = signposts(SEED).find((post) => post.id === 'post-1');
export const POST_ROUTE = bfs(
  SEED,
  (x, y) => {
    const into = [['up', 0, -1], ['right', 1, 0], ['down', 0, 1], ['left', -1, 0]].find(
      ([, dx, dy]) => x + dx === FIRST_POST.x && y + dy === FIRST_POST.y
    );
    return into ? into[0] : null;
  },
  40
);

// The nearest sanctum whose gate is still shut, and the chest holding the key
// that opens it — the two ends of the chain a test has to walk to prove a gate
// opens (DESIGN.md §4.8).
export const SHUT_GATE = SANCTUMS.find((s) => s.key === 'key-1');
export const KEY_CHEST = chests(SEED).find((c) => c.key === 'key-1');
// The walk to that chest, and the direction the last step of it bumps in — a
// chest is opened by walking *into* it, so the route stops on its apron.
export const KEY_CHEST_ROUTE = (() => {
  const at = chestApproach(KEY_CHEST);
  return bfs(SEED, (x, y) => x === at.x && y === at.y, 90);
})();
export const KEY_CHEST_BUMP = 'left'; // the apron is one tile east of the chest

// Opening the game on a named seed and nonce reproduces an expedition exactly
// (TitleScene reads both off the URL), which is how a browser test can know
// where the coins are before the page has drawn any.
export const WORLD = `seed=${DEFAULT_SEED}&nonce=${NONCE}`;

// Every browser test opens on that world unless it names another. NEW GAME
// draws a world of its own for each slot (core/save.js `startSlot`), so a page
// opened on no seed at all is a page in a world nothing here has BFSed — and
// since there are no authored levels, every route is derived against
// DEFAULT_SEED and has to be walked in DEFAULT_SEED's world.
export const test = (name, fn, opts = {}) => browserTest(name, fn, { query: WORLD, ...opts });

export async function walkPath(game, path) {
  for (const dir of path) {
    await game.tapDpad(dir);
    await game.settle();
  }
}

// --- Standing where a route ends --------------------------------------------
//
// A tap through a real browser costs a couple of hundred milliseconds, and the
// routes above are twenty to forty of them. A test whose claim is what happens
// *at* the far end of a route — a chest's lid, a sanctum's colour, the
// merchant's counter — has no business paying for the walk there: it plants a
// suspended expedition already standing on the doorstep and walks only the last
// leg, which is the input actually under test.
//
// That is prior state, the same as any other planted save (TESTING.md), and it
// costs no coverage: that the whole route is walkable at all is a pure claim,
// asserted for every sanctum and every chest by `campaign.test.js` and
// `terrain.test.js` without a browser in sight.

const STEPS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

// Where a path leaves the walker, and looking which way.
function follow(path, start = START) {
  let [x, y] = start;
  let facing = 'down';
  for (const dir of path) {
    const [dx, dy] = STEPS[dir];
    x += dx;
    y += dy;
    facing = dir;
  }
  return { x, y, facing };
}

// A fresh walk's own numbers, in the shape `suspendRun` writes (core/rules.js).
// Anything a planted run wants different it names.
const FRESH_RUN = {
  seed: SEED,
  facing: 'down',
  water: STARTING_WATER,
  coins: 0,
  coinsFound: 0,
  gems: 0,
  nonce: NONCE,
  epoch: 0,
  tools: [],
  keys: [],
  chests: [],
  inventory: [{ id: STARTING_LIGHT, durability: LIGHTS[STARTING_LIGHT].maxDurability }],
  activeIndex: 0,
  found: {},
  collected: '',
  startExplored: 0,
};

// How many steps of a route are still to come once it has stood on `tile` — so
// a test can say "start me one step outside the arch" without counting taps.
// What a planted run has *not* got is explored ground: masonry it never walked
// past is masonry the viewport does not draw, so a test about what a sanctum
// looks like has to be planted outside its own gate, not next to its prize.
export function stepsAfter(route, tile, start = START) {
  let [x, y] = start;
  for (let i = 0; i < route.path.length; i++) {
    const [dx, dy] = STEPS[route.path[i]];
    x += dx;
    y += dy;
    if (x === tile.x && y === tile.y) return route.path.length - (i + 1);
  }
  throw new Error('the route never stands on that tile');
}

// A slot holding a walk that has already come `route.path.length - back` steps
// along `route`. Returns the save to plant and the legs still to be walked, so
// a test reads:
//
//   const walk = standingAt(CHEST_ROUTE);
//   test('...', async (game) => { await walkPath(game, walk.path); ... },
//     { save: walk.save });
//
// Nothing about the world is stored, so the scatter the run walks out onto is
// the one the seed and salt derive — which is why the nonce here is the same
// NONCE every route above was BFSed against.
export function standingAt(route, { back = 0, save = {}, run = {} } = {}) {
  const walked = back ? route.path.slice(0, route.path.length - back) : route.path;
  const at = follow(walked);
  const steps = walked.length;
  return {
    path: route.path.slice(walked.length),
    save: {
      ...emptySave(),
      ...save,
      started: true,
      seed: SEED,
      run: {
        ...FRESH_RUN,
        ...at,
        steps,
        furthest: Math.max(Math.abs(at.x - BASE_X), Math.abs(at.y - BASE_Y)),
        // A light burns a durability a step, so a run that has walked this far
        // has burned that much of it — planting a full torch on a forty-step
        // walk would be a run that could not exist.
        inventory: [
          { id: STARTING_LIGHT, durability: LIGHTS[STARTING_LIGHT].maxDurability - steps },
        ],
        water: STARTING_WATER - steps,
        ...run,
        banked: { ...emptySave(), ...save, run: null },
      },
    },
  };
}
