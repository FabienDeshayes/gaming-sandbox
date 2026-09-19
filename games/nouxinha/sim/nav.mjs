// How the bot gets from one tile to another, knowing only what it has lit.
//
// Two things make this cheap enough to run thousands of expeditions through.
//
// The first is that terrain is memoised per world. `entryKey` in core/world.js
// is a pure function of the tile, but it costs a structure lookup and two
// octaves of noise, and a single expedition asks about the same few thousand
// tiles hundreds of times.
//
// The second is that the search is A* with a Manhattan heuristic rather than a
// flood fill. On a four-connected grid of unit steps that heuristic is
// admissible and consistent, so the path is still the shortest one — but where
// the way is open it walks almost straight at the target instead of expanding a
// disc around the walker, which is the difference between a few hundred nodes
// and forty thousand.
//
// **The bot routes optimistically.** A tile it has never lit is assumed to be
// floor, because that is what a player heading somewhere assumes: you walk at
// the thing and find out. When the next tile turns out to be rock the walk
// re-plans, which is what produces wall-following without anything here
// knowing what a wall is. The one charity is the edge of the world, which
// counts as blocked whether or not the bot has bumped it — a route that only
// exists through the dark outside the world can never be walked, and a bot
// re-planning into it forever would measure nothing.

import { DIRECTIONS, tileKey } from '../src/core/light.js';
import { beyondEdge, entryKey, ENTRY_BLOCKED } from '../src/core/world.js';

export const STEPS = [
  ['up', 0, -1],
  ['right', 1, 0],
  ['down', 0, 1],
  ['left', -1, 0],
];

export function manhattan(x, y, ox = 0, oy = 0) {
  return Math.abs(x - ox) + Math.abs(y - oy);
}

// The world's own answer about a tile, worked out once and kept: `false` for
// anything impassable, `null` for open ground, a key id for a gate.
export function createNav(seed) {
  const gates = new Map();
  return {
    seed,
    tiles: gates,
    needs(x, y) {
      const key = tileKey(x, y);
      let value = gates.get(key);
      if (value === undefined) {
        value = beyondEdge(x, y) ? ENTRY_BLOCKED : entryKey(x, y, seed);
        gates.set(key, value);
      }
      return value;
    },
  };
}

// The hut, which a route may end on and may never cross: standing on it is how
// an expedition ends (DESIGN.md §6.1), so a path that went through it on the
// way somewhere else is a path that stops there. `tests/world.js` routes under
// the same rule, for the same reason.
const HUT_KEY = '0,0';

// Whether the bot believes it can step here: what it has lit, it knows; what it
// has not, it assumes is floor — except outside the world, which is blocked for
// everyone, and anything it has walked into and found solid on a walk too dark
// to light it.
function passable(nav, x, y, keys, known, blocked, throughHut) {
  if (beyondEdge(x, y)) return false;
  const key = tileKey(x, y);
  if (!throughHut && key === HUT_KEY) return false;
  if (blocked && blocked.has(key)) return false;
  if (known && !known.has(key)) return true;
  const needs = nav.needs(x, y);
  if (needs === ENTRY_BLOCKED) return false;
  return !needs || !!(keys && keys.has(needs));
}

// --- A binary heap, because a sorted insert is most of the cost --------------

function heapPush(heap, node) {
  heap.push(node);
  let i = heap.length - 1;
  while (i > 0) {
    const parent = (i - 1) >> 1;
    if (heap[parent].f <= heap[i].f) break;
    [heap[parent], heap[i]] = [heap[i], heap[parent]];
    i = parent;
  }
}

function heapPop(heap) {
  const top = heap[0];
  const last = heap.pop();
  if (heap.length) {
    heap[0] = last;
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let small = i;
      if (l < heap.length && heap[l].f < heap[small].f) small = l;
      if (r < heap.length && heap[r].f < heap[small].f) small = r;
      if (small === i) break;
      [heap[small], heap[i]] = [heap[i], heap[small]];
      i = small;
    }
  }
  return top;
}

// --- The search ---------------------------------------------------------------
//
// `goal` says which tile ends the search and `heuristic` estimates the steps
// left from any tile. Returns the list of directions to walk and how many steps
// that is, or null where nothing inside the node budget reached it.
//
// `weight` above 1 leans on the heuristic: the path found may be a few steps
// longer than the shortest one, and it is found for a fraction of the nodes.
// The bot walks on weighted paths because a player does not walk optimal ones
// either — but it works out the distance *home* unweighted, because that number
// is what it bets its water on.
export function route(
  nav,
  from,
  { goal, heuristic, keys = null, known = null, blocked = null, maxNodes = 30000, weight = 1 }
) {
  const startKey = tileKey(from.x, from.y);
  if (goal(from.x, from.y)) return { path: [], steps: 0, nodes: 0 };
  // The hut is a wall to every route but the one that is going there.
  const throughHut = goal(0, 0);

  const came = new Map([[startKey, null]]);
  const cost = new Map([[startKey, 0]]);
  const heap = [];
  heapPush(heap, { x: from.x, y: from.y, key: startKey, f: heuristic(from.x, from.y) * weight });
  let nodes = 0;

  while (heap.length && nodes < maxNodes) {
    const here = heapPop(heap);
    nodes += 1;
    const g = cost.get(here.key);
    for (const [name, dx, dy] of STEPS) {
      const nx = here.x + dx;
      const ny = here.y + dy;
      const key = tileKey(nx, ny);
      if (cost.has(key)) continue;
      const reached = goal(nx, ny);
      // The goal tile itself may be a thing you bump rather than stand on — a
      // chest, a landmark, the sorcerer — so it is allowed to be impassable,
      // and nothing past it is ever expanded.
      if (!reached && !passable(nav, nx, ny, keys, known, blocked, throughHut)) continue;
      cost.set(key, g + 1);
      came.set(key, [here.key, name]);
      if (reached) {
        const path = [];
        let cur = key;
        while (came.get(cur)) {
          const [prev, dir] = came.get(cur);
          path.unshift(dir);
          cur = prev;
        }
        return { path, steps: path.length, nodes };
      }
      heapPush(heap, { x: nx, y: ny, key, f: g + 1 + heuristic(nx, ny) * weight });
    }
  }
  return null;
}

// Walk to a tile. The same call whether the tile is one to stand on or one to
// walk *into* — a chest, a landmark, a post, a stone, a wisp, the sorcerer:
// the goal tile is allowed to be impassable and nothing past it is expanded,
// so the last direction in the path is the step onto it or the bump against
// it, whichever the tile turns out to want.
export function routeTo(nav, from, to, opts = {}) {
  return route(nav, from, {
    goal: (x, y) => x === to.x && y === to.y,
    heuristic: (x, y) => manhattan(x, y, to.x, to.y),
    ...opts,
  });
}

// How many steps home over what the bot believes the ground to be. The number
// every decision about turning back rests on, so it is worth the search rather
// than a guess — but it is only asked for every few steps (`autoplay.mjs`).
export function stepsHome(nav, from, opts = {}) {
  const found = routeTo(nav, from, { x: 0, y: 0 }, opts);
  // Nothing inside the budget got there, which on an optimistic map means a very
  // long way through known rock. Fall back to the straight-line walk, which is
  // the floor on any real answer and so never makes the bot bolder than it is.
  return found ? found.steps : manhattan(from.x, from.y);
}

export { DIRECTIONS };
