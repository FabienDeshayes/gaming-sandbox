// The tutorial on screen (DESIGN.md §4.13): a first game walks its world and
// opens on its first lesson, a step off the route is refused and the status
// line says which way to go instead, and reading the last lesson turns the
// tutorial off for good. The route and the lessons themselves are pure claims,
// held by tutorial.test.js.
//
// Neither test opens on the suite's own world: the tutorial is a world of its
// own, and a `?seed=` in the URL would walk any other one.

import { assert, assertEqual, runIfMain, test } from './harness.js';
import { canEnter } from '../src/core/world.js';
import { TUTORIAL_STEPS, onTutorialPath, tutorialBearing, tutorialPlan } from '../src/core/tutorial.js';
import { TUTORIAL_SEED } from '../src/balance.js';
import { SIGNPOST, TUTORIAL } from '../src/text.js';
import { START, standingAt } from './world.js';

const plan = tutorialPlan(TUTORIAL_SEED);
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

// A straight walk out of the hut door that stays on the route and then tries
// to leave it: the taps that stay on, and the one that is refused.
const offRoute = (() => {
  for (const [dir, [dx, dy]] of Object.entries(DIRS)) {
    const taps = [];
    for (let k = 1; k < 10; k++) {
      const x = START[0] + dx * k;
      const y = START[1] + dy * k;
      if (!canEnter(x, y, TUTORIAL_SEED, null) || (x === 0 && y === 0)) break;
      if (!onTutorialPath(plan, x, y))
        return { taps, dir, at: { x: x - dx, y: y - dy } };
      taps.push(dir);
    }
  }
  return null;
})();

// The route as the D-pad taps that walk it, so a walk can be planted on it.
const ROUTE = {
  path: plan.route.slice(1).map((to, i) => {
    const from = plan.route[i];
    return to.x > from.x ? 'right' : to.x < from.x ? 'left' : to.y > from.y ? 'down' : 'up';
  }),
};

// The panel's own words, with the wrapping it types them out with taken back
// out again.
const reading = async (game) => {
  const panel = await game.textPanel();
  return panel && panel.full.replace(/\n/g, ' ');
};

test(
  'a first game walks the tutorial, and a step off its route is refused',
  async (game) => {
    await game.clickText('NEW GAME');
    await game.waitForScene('SlotScene');
    await game.clickText('SLOT 1');
    await game.waitForScene('ExploreScene');

    assertEqual((await game.state()).seed, TUTORIAL_SEED, 'NEW GAME claimed the tutorial world');
    assertEqual(await reading(game), TUTORIAL.intro[0], 'and it opens on the first lesson, not the usual three blocks');
    await game.readPanel();
    assertEqual((await game.tutorial()).step, 'post', 'read out, it sends the player to the post');

    assert(offRoute, 'somewhere out of the hut door leaves the route');
    for (const dir of offRoute.taps) {
      await game.tapDpad(dir);
      await game.settle();
    }
    const before = await game.state();
    assertEqual(`${before.x},${before.y}`, `${offRoute.at.x},${offRoute.at.y}`, 'walking the route is walking');
    await game.tapDpad(offRoute.dir);
    await game.settle();
    const after = await game.state();
    assertEqual(`${after.x},${after.y}`, `${before.x},${before.y}`, 'the step off it did not happen');
    assertEqual(after.steps, before.steps, 'and cost nothing');
    const line = TUTORIAL.offPath(TUTORIAL.things.post, SIGNPOST.bearings[tutorialBearing(before, plan.post)]);
    assert(await game.hasText(line), `the status line says where to go instead: ${line}`);
  },
  { tutorial: true }
);

// One step short of the gem, on the last lesson.
const lastStep = standingAt(ROUTE, { back: 1, seed: TUTORIAL_SEED });

test(
  'reading the last lesson turns the tutorial off',
  async (game) => {
    await game.startRun();
    assertEqual((await game.tutorial()).step, 'gem', 'carried on at the lesson it was on');
    await game.tapDpad(lastStep.path[0]);
    await game.settle();
    await game.page.waitForFunction(() => {
      const s = window.__game.scene.getScene('ExploreScene');
      return s.textPanel.isOpen();
    });
    assertEqual(await reading(game), TUTORIAL.end[0], 'the gem is the end of it');
    assertEqual(await game.pref('nouxinha.tutorial'), '1', 'still on while it is being read');
    await game.readPanel();
    assert((await game.tutorial()).finished, 'read out, it is over');
    assertEqual(await game.pref('nouxinha.tutorial'), '0', 'and off, until Settings turns it on again');
  },
  { save: lastStep.save, tutorial: TUTORIAL_STEPS.indexOf('gem') }
);

runIfMain(import.meta.url);
