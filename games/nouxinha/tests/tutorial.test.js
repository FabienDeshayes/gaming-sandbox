// The tutorial's world and the route through it (DESIGN.md §4.13): that the
// seed is one the game would hand out anyway, that the route really does walk
// from the hut door past every thing a lesson is about, and that every lesson
// is done by doing the thing — read off the run by the real rules, with no
// script keeping score. Pure — no browser; ui-tutorial.test.js drives it.

import { assert, assertEqual, runIfMain, unit } from './harness.js';
import { biomeOf, canEnter, isBase, pickSeed } from '../src/core/world.js';
import { createRun, equip, step } from '../src/core/rules.js';
import { emptySave } from '../src/core/save.js';
import {
  TUTORIAL_STEPS,
  hoardTorch,
  isTutorialWorld,
  onTutorialPath,
  tutorialAllows,
  tutorialDone,
  tutorialPlan,
  tutorialTarget,
} from '../src/core/tutorial.js';
import { STARTING_WATER, TUTORIAL_LEASH, TUTORIAL_SEED } from '../src/balance.js';
import { NONCE, ORTHOGONAL, SEED, START } from './world.js';

const plan = tutorialPlan(TUTORIAL_SEED);
const next = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const toward = (from, to) =>
  to.x > from.x ? 'right' : to.x < from.x ? 'left' : to.y > from.y ? 'down' : 'up';

// A fresh first game in the tutorial's world, the way NEW GAME starts one.
const firstGame = () => createRun(TUTORIAL_SEED, { ...emptySave(), seed: TUTORIAL_SEED }, NONCE);

unit('the tutorial walks a temperate world the game would have handed out anyway', () => {
  assertEqual(pickSeed(TUTORIAL_SEED), TUTORIAL_SEED, 'pickSeed hands it back unbumped');
  assertEqual(biomeOf(TUTORIAL_SEED), 'temperate', 'the world every other number was tuned in');
  assert(isTutorialWorld(firstGame()), 'a first game there is the tutorial');
  assert(
    !isTutorialWorld(createRun(TUTORIAL_SEED, { ...emptySave(), seed: TUTORIAL_SEED }, NONCE, { cheats: true })),
    'a cheat run never is'
  );
  assert(!isTutorialWorld(createRun(SEED, emptySave(), NONCE)), 'and no other world is');
});

unit('the route walks out of the hut door past the post, the chest and the landmark to the gem', () => {
  const { route } = plan;
  assertEqual(`${route[0].x},${route[0].y}`, START.join(','), 'it starts where a run does');
  for (let i = 1; i < route.length; i++) {
    assertEqual(next(route[i - 1], route[i]), 1, `one orthogonal step at a time (at ${i})`);
    assert(canEnter(route[i].x, route[i].y, TUTORIAL_SEED, null), `walkable carrying nothing (at ${i})`);
    assert(!isBase(route[i].x, route[i].y), 'never across the hut, which would stop it with a question');
  }
  // Beside each thing in turn — which is where a bump into it is taken from.
  let from = 0;
  for (const thing of [plan.post, plan.chest, plan.landmark]) {
    const at = route.findIndex((tile, i) => i >= from && next(tile, thing) === 1);
    assert(at >= 0, `it passes beside ${thing.id}, after the one before it`);
    from = at;
  }
  const last = route[route.length - 1];
  assertEqual(`${last.x},${last.y}`, `${plan.gem.x},${plan.gem.y}`, 'and ends on the gem');
  // There and back on a starting tank, with half of it to spare: nobody should
  // run dry in the tutorial for having walked it.
  assert(2 * (route.length - 1) <= STARTING_WATER / 2, `a ${route.length - 1}-step route is too long`);
});

unit('a step off the route is refused, and a walker already off it is never held', () => {
  for (const tile of plan.route) assert(onTutorialPath(plan, tile.x, tile.y), 'the route is on its own path');
  assert(onTutorialPath(plan, 0, 0), 'so is the hut');
  const { centre, radius } = plan.sanctum;
  assert(onTutorialPath(plan, centre.x + radius - 1, centre.y - radius + 1), 'and the whole clearing');

  // A straight line out of the hut door, walked until it leaves the leash.
  let refused = null;
  for (const [dx, dy] of ORTHOGONAL) {
    for (let k = 1; k < 3 * TUTORIAL_LEASH && !refused; k++) {
      const x = START[0] + dx * k;
      const y = START[1] + dy * k;
      if (!canEnter(x, y, TUTORIAL_SEED, null)) break;
      if (!onTutorialPath(plan, x, y)) refused = { from: { x: x - dx, y: y - dy }, to: { x, y } };
    }
  }
  assert(refused, 'somewhere out of the hut door is off the route');
  assert(!tutorialAllows(plan, refused.from, refused.to.x, refused.to.y), 'that step is refused');
  // And from off the route, anything goes — a save carried in from before the
  // tutorial was switched on must never be stuck by it.
  assert(tutorialAllows(plan, refused.to, refused.to.x + 1, refused.to.y), 'nothing holds a walker already off it');
});

unit('every lesson is done by doing the thing, and not before', () => {
  const run = firstGame();
  const done = (id) => tutorialDone(id, plan, run);
  assert(done('intro'), 'the opening lesson is only ever read');
  for (const id of ['post', 'chest', 'landmark', 'torch', 'gem']) assert(!done(id), `${id} is not done yet`);
  assert(done('equip'), 'and there is nothing to equip yet, which never holds a player up');

  // Walk the route with the real rules, bumping each thing the tutorial sends
  // the player to as the route passes it.
  const bumped = [];
  for (let i = 1; i < plan.route.length; i++) {
    for (const [id, thing] of [
      ['post', plan.post],
      ['chest', plan.chest],
      ['landmark', plan.landmark],
    ]) {
      if (bumped.includes(id) || next(run, thing) !== 1) continue;
      assertEqual(tutorialTarget(id, plan, run), thing, `the ${id} lesson points at it`);
      assert(!done(id), `${id} is not done by standing next to it`);
      assert(!step(run, toward(run, thing)).moved, `${id} is bumped, not walked onto`);
      assert(done(id), `${id} is done by walking into it`);
      bumped.push(id);
    }
    assert(step(run, toward(run, plan.route[i])).moved, `the route walks (at ${i})`);
  }
  assertEqual(bumped.join(), 'post,chest,landmark', 'every one of them, in order');
  assert(done('gem'), 'the route ends by picking up the gem');

  // The torch is wherever the hoard put it, somewhere in the clearing.
  const torch = hoardTorch(plan, run);
  assert(torch, 'the first sanctum has a torch in its hoard');
  assertEqual(tutorialTarget('torch', plan, run), torch, 'the torch lesson points at it');
  const { centre, radius } = plan.sanctum;
  for (let guard = 0; guard < 4 * radius && (run.x !== torch.x || run.y !== torch.y); guard++) {
    const dir = run.x !== torch.x ? toward(run, { x: torch.x, y: run.y }) : toward(run, torch);
    assert(step(run, dir).moved, 'the clearing is open floor');
  }
  assert(Math.max(Math.abs(run.x - centre.x), Math.abs(run.y - centre.y)) < radius, 'still inside');
  assert(done('torch'), 'picking it up is the torch lesson');
  assert(!done('equip'), 'carrying it is not equipping it');
  equip(run, run.inventory.length - 1);
  assert(done('equip'), 'equipping it is');
  assertEqual(TUTORIAL_STEPS.filter((id) => !done(id)).length, 0, 'and that is every lesson');
});

runIfMain(import.meta.url);
