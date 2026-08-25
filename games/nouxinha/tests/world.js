// The world the suite walks, and the routes through it.
//
// There are no hand-authored levels, so nothing here is a coordinate: every
// route is BFSed out of the real world at load time, which is what keeps the
// tests honest if the noise is ever retuned. See TESTING.md.
//
// Shared by every suite, and imported once — a `*.test.js` file that only needs
// the seed pays for the seed, and the one expensive derivation (four chained
// legs to four copies of the same torch) is worked out on request.

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
  pickSeed,
  saltOf,
  sanctums,
  terrainAt,
} from '../src/core/world.js';
import { KEYS } from '../src/data/items.js';
import { biomeDef } from '../src/data/biomes.js';
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

// A chain of `count` routes to distinct copies of `wantId`, each leg starting
// where the previous one left off — for tests that need to actually collect
// several of the same item by playing, rather than one.
//
// Every tile a leg *walks over* is struck off, not just the one it stops on: a
// later leg aimed at an item an earlier leg already picked up in passing would
// walk to an empty tile, which is a flake rather than a failure.
function bfsChain(seed, wantId, count, maxDepth = 24) {
  const used = new Set();
  let start = START;
  const legs = [];
  for (let i = 0; i < count; i++) {
    const found = bfs(
      seed,
      (x, y) => scatter(x, y) === wantId && !used.has(tileKey(x, y)),
      maxDepth,
      start
    );
    let [x, y] = start;
    for (const dir of found.path) {
      const [dx, dy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
      x += dx;
      y += dy;
      used.add(tileKey(x, y));
    }
    legs.push(found.path);
    start = [found.x, found.y];
  }
  return legs;
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

// The nearest spot with a tree next to it, for the test that a grove is drawn as
// foliage rather than as more rock.
export const TREE_ROUTE = bfs(SEED, (x, y) =>
  ORTHOGONAL.some(([dx, dy]) => terrainAt(x + dx, y + dy, SEED) === 'tree')
);

// Four copies of the same light, chained leg to leg — one more than the item
// card's instance list shows at once, so it has to scroll. Four rather than
// more because the world spreads its items out (balance.js MIN_SEPARATION),
// and every extra copy is another twenty taps through a real browser. Only
// valid for a page opened on NONCE, which is what `WORLD` below pins.
//
// Worked out on request rather than at load: it is four chained searches, and
// only the inventory suite walks it.
export const MEDIUM_TORCH_COPIES = 4;
let chain = null;
export function mediumTorchChain() {
  if (!chain) chain = bfsChain(SEED, 'torch-medium', MEDIUM_TORCH_COPIES, 60);
  return chain;
}

// The four sanctums of this world, and the walk to the first gem. Sanctum 1's
// arch is the one that stands open, so this route is walkable carrying nothing
// — which is exactly the promise the chain rests on.
export const SANCTUMS = sanctums(SEED);
export const FIRST_GEM = SANCTUMS[0];
export const GEM_ROUTE = bfs(SEED, (x, y) => x === FIRST_GEM.centre.x && y === FIRST_GEM.centre.y, 90);
// The walk to the merchant. Landmarks don't move with the nonce, so this route
// holds for any page — but it is 20-odd taps, so only one test walks it.
export const MERCHANT_ROUTE = bfs(SEED, (x, y) => isMerchant(x, y, SEED), 60);

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
