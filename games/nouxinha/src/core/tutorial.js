// The tutorial's world, the one route through it, and what counts as having
// done each thing it asks (DESIGN.md §4.13).
//
// Nothing here is authored beyond the seed. The route is BFSed out of the real
// world the same way every test route is — hut door, the doorstep post, the
// Mint's chest, the Mint, the first gem — and the lesson a step teaches is
// judged off the run itself: a post read, a lid lifted, a landmark stood at, a
// gem in hand. So the tutorial can never disagree with the game about whether
// something happened, and a walk that dies halfway picks up where the world
// says it is rather than where a script thought it was.
//
// Pure, like the rest of core/: the scene drives it (ui/tutorial.js), the words
// are src/text.js's, and the numbers are balance.js's.

import { STARTING_LIGHT, TUTORIAL_LEASH, TUTORIAL_SEED } from '../balance.js';
import {
  BASE_X,
  BASE_Y,
  canEnter,
  chebyshev,
  chests,
  isBase,
  landmarks,
  sanctums,
  signpostBearing,
  signposts,
} from './world.js';
import { activeLight, itemOnTile, tileKey } from './rules.js';

// The lessons, in the order they are walked. Each is one thing to go and do —
// or, for the first, one thing to be told — and the scene reads each one's
// words out of `TUTORIAL` in src/text.js by the same id.
export const TUTORIAL_STEPS = ['intro', 'post', 'chest', 'landmark', 'torch', 'equip', 'gem'];

// What the tutorial walks the player to: the doorstep post, which always names
// the Mint; the chest that stands beside the Mint; the Mint itself; and the
// first sanctum, whose arch is open and whose hoard has a torch in it. Every
// world has all four in that arrangement (balance.js), which is what makes the
// route a property of the plan rather than of one lucky seed — the seed only
// decides how tidy it is.
const POST_ID = 'post-1';
const CHEST_ID = 'chest-mint';
const LANDMARK_ID = 'mint';
// The light the first sanctum's hoard is built holding (balance.js
// `SANCTUM_PLAN`), and so the one the lesson on equipping is taught with.
const TORCH_ID = 'torch-medium';

const ORTHOGONAL = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

// Whether a run is walking the tutorial's world at all. A cheat run never is:
// it is handed everything the tutorial would walk it to.
export function isTutorialWorld(run) {
  return !!run && !run.cheats && run.seed === TUTORIAL_SEED;
}

// The shortest walk from `from` to any tile `isGoal` accepts, as the list of
// tiles stood on — `from` first. Carrying no keys, which is all the route ever
// needs: the first sanctum's arch stands open. Never across the hut, which
// answers a step onto it with a question and is nowhere the route is going.
function walk(seed, from, isGoal) {
  const prev = new Map([[tileKey(from.x, from.y), null]]);
  let frontier = [from];
  while (frontier.length) {
    const next = [];
    for (const at of frontier)
      for (const [dx, dy] of ORTHOGONAL) {
        const to = { x: at.x + dx, y: at.y + dy };
        const key = tileKey(to.x, to.y);
        if (prev.has(key) || isBase(to.x, to.y) || !canEnter(to.x, to.y, seed, null)) continue;
        prev.set(key, at);
        if (isGoal(to.x, to.y)) {
          const path = [to];
          for (let back = at; back; back = prev.get(tileKey(back.x, back.y))) path.unshift(back);
          return path;
        }
        // The tutorial's stops are all within a few dozen steps of the hut, so
        // a search that has got this far out has lost its way.
        if (chebyshev(to.x, to.y) < 60) next.push(to);
      }
    frontier = next;
  }
  return null;
}

// Beside a tile: where you stand to bump into it.
const beside = (thing) => (x, y) => Math.abs(x - thing.x) + Math.abs(y - thing.y) === 1;

const planCache = new Map();

// Everything the tutorial needs to know about a world, worked out once: the
// four things it walks to, the route through them, and the band of ground
// either side of that route a step may land on.
export function tutorialPlan(seed = TUTORIAL_SEED) {
  const cached = planCache.get(seed);
  if (cached) return cached;

  const post = signposts(seed).find((p) => p.id === POST_ID);
  const chest = chests(seed).find((c) => c.id === CHEST_ID);
  const landmark = landmarks(seed).find((l) => l.id === LANDMARK_ID);
  const sanctum = sanctums(seed)[0];
  const gem = sanctum.centre;

  // Out of the hut door and on through the four, each leg starting where the
  // last one stopped.
  const route = [];
  let from = { x: BASE_X, y: BASE_Y + 1 };
  for (const isGoal of [beside(post), beside(chest), beside(landmark), (x, y) => x === gem.x && y === gem.y]) {
    const leg = walk(seed, from, isGoal);
    if (!leg) break;
    route.push(...(route.length ? leg.slice(1) : leg));
    from = leg[leg.length - 1];
  }

  // The ground a step may land on: the leash either side of every tile of the
  // route, the hut itself, and the whole of the sanctum's clearing — its hoard
  // is what the lesson on lights is taught with.
  const corridor = new Set([tileKey(BASE_X, BASE_Y)]);
  for (const at of route)
    for (let dy = -TUTORIAL_LEASH; dy <= TUTORIAL_LEASH; dy++)
      for (let dx = -TUTORIAL_LEASH; dx <= TUTORIAL_LEASH; dx++)
        corridor.add(tileKey(at.x + dx, at.y + dy));
  for (let dy = -sanctum.radius; dy <= sanctum.radius; dy++)
    for (let dx = -sanctum.radius; dx <= sanctum.radius; dx++)
      corridor.add(tileKey(gem.x + dx, gem.y + dy));

  const plan = { seed, post, chest, landmark, sanctum, gem, route, corridor };
  planCache.set(seed, plan);
  return plan;
}

// Whether a tile is on the tutorial's route, give or take the leash.
export function onTutorialPath(plan, x, y) {
  return plan.corridor.has(tileKey(x, y));
}

// Whether a step from where the run stands onto (x, y) is one the tutorial
// lets through. A run standing off the path already — a save carried into the
// tutorial from before it was switched on — is never held: the tutorial may
// keep a walk on its route, but it must never be what leaves one stuck
// (DESIGN.md §5).
export function tutorialAllows(plan, run, x, y) {
  return !onTutorialPath(plan, run.x, run.y) || onTutorialPath(plan, x, y);
}

// The nearest torch the first sanctum's hoard still has lying in it, or null
// once it has none this run can see — the lesson on equipping is taught with
// whichever one the player walks to.
export function hoardTorch(plan, run) {
  const { gem, sanctum } = plan;
  let best = null;
  const span = sanctum.radius - 1;
  for (let dy = -span; dy <= span; dy++)
    for (let dx = -span; dx <= span; dx++) {
      const x = gem.x + dx;
      const y = gem.y + dy;
      if (itemOnTile(run, x, y) !== TORCH_ID) continue;
      const far = Math.abs(x - run.x) + Math.abs(y - run.y);
      if (!best || far < best.far) best = { x, y, far };
    }
  return best && { x: best.x, y: best.y };
}

// Where a lesson sends the player, as a world tile — or null for the lessons
// that are about the HUD rather than the ground.
export function tutorialTarget(id, plan, run) {
  switch (id) {
    case 'post':
      return plan.post;
    case 'chest':
      return plan.chest;
    case 'landmark':
      return plan.landmark;
    case 'torch':
      return hoardTorch(plan, run) || plan.gem;
    case 'gem':
      return plan.gem;
    default:
      return null;
  }
}

// Whether a lesson has been done, read off the run. `noted.equipped` is the
// one thing the run cannot answer for itself — that the player chose a light
// off its card rather than merely carrying two — so the scene says so.
export function tutorialDone(id, plan, run, noted = {}) {
  switch (id) {
    case 'intro':
      return true;
    case 'post':
      return run.posts.has(plan.post.id);
    case 'chest':
      return run.chests.has(plan.chest.id);
    case 'landmark':
      return run.landmarks.has(plan.landmark.id);
    case 'torch':
      // Carrying a second light, or with no torch left in the hoard to pick up.
      return run.inventory.length > 1 || !hoardTorch(plan, run);
    case 'equip': {
      // Equipped one, or has nothing to equip: a lesson that can't be done must
      // never be the thing standing between a player and their gem.
      const light = activeLight(run);
      return !!noted.equipped || run.inventory.length < 2 || (!!light && light.id !== STARTING_LIGHT);
    }
    case 'gem':
      return run.gems >= 1;
    default:
      return true;
  }
}

// Which of the eight headings a tile lies on from another, counted the way a
// signpost counts them (`SIGNPOST.bearings` in src/text.js reads them out).
export function tutorialBearing(from, to) {
  return signpostBearing(from, to);
}
