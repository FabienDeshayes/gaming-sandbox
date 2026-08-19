// The browser suite: every test drives the real canvas with real pointer
// events and reads state back out.
//
// There are no hand-authored levels in this game — a night is whatever the
// shuffled shore gives you — so no test hardcodes a draw. Where a test needs a
// particular kind of night (one that overfills a meter, a season that is
// winnable, a season that is not), it finds the seed by replaying seasons
// against src/core/rules.js first, then plays that same seed through the UI.
// The rules module is the reference; the screen is what is being checked.

import { METER_LABELS, RESOURCE_LABELS } from '../src/config.js';
import {
  DEFAULT_TOOLS,
  DEFAULT_TUNING,
  METER_OF,
  RESOURCES,
  affordableTools,
  allocate,
  beginNight,
  budgetLeft,
  buildTool,
  bustOdds,
  canAfford,
  createRun,
  endNight,
  goHome,
  search,
  waveOdds,
} from '../src/core/rules.js';
import { THROUGHPUT_FIRST, investPlan, stopWithBudget } from '../sim/policies.mjs';
import { assert, assertEqual, run, test, unit } from './harness.js';

// --- picking a seed ---------------------------------------------------------
//
// These replay the rules headlessly to find a season of the right shape. They
// never assert; the seed they return is handed to the browser, which then plays
// the same shore for real.

function findSeed(predicate, limit = 800) {
  for (let seed = 1; seed <= limit; seed++) if (predicate(seed)) return seed;
  throw new Error(`no seed satisfied the predicate in the first ${limit}`);
}

function playSeason(seed, shouldSearch, plan) {
  const state = createRun({ seed });
  while (state.status === 'playing') {
    beginNight(state);
    if (state.status !== 'playing') break;
    while (state.phase === 'search' && shouldSearch(state)) search(state);
    if (state.phase === 'search') goHome(state);
    const step = plan(state);
    allocate(state, step.routes);
    for (const id of step.builds) {
      const tool = DEFAULT_TOOLS.find((t) => t.id === id);
      if (!tool || state.toolsBuilt.includes(id)) continue;
      if (canAfford(state.stock, tool.cost)) buildTool(state, id);
    }
    endNight(state);
  }
  return state;
}

// A night that hands the player more of one resource than its meter can take.
const CAP_SEED = findSeed((seed) => {
  const state = createRun({ seed });
  beginNight(state);
  const enough = () => RESOURCES.some((r) => state.basket[r] >= 4);
  while (state.phase === 'search' && !enough()) search(state);
  return state.phase === 'search' && enough();
});

// Six nights of hoarding driftwood and coming home at the second wave, which
// is enough to pay for a gaff hook and still be alive.
const TOOL_SEED = findSeed((seed) => {
  const state = createRun({ seed });
  for (let night = 0; night < 6 && state.status === 'playing'; night++) {
    beginNight(state);
    if (state.status !== 'playing') break;
    while (state.phase === 'search' && state.strikes < 2) search(state);
    if (state.phase === 'search') goHome(state);
    allocate(state, { wood: 'stock' });
    if (!state.toolsBuilt.includes('gaff') && canAfford(state.stock, { wood: 3 }))
      buildTool(state, 'gaff');
    endNight(state);
  }
  return state.toolsBuilt.includes('gaff') && state.status === 'playing';
});

const RECKLESS = () => true;
const POUR_EVERYTHING = () => ({ routes: {}, builds: [] });
const LOSE_SEED = findSeed((seed) => playSeason(seed, RECKLESS, POUR_EVERYTHING).status === 'lost');

const WIN_SHOULD_SEARCH = stopWithBudget(1);
const WIN_PLAN = investPlan(THROUGHPUT_FIRST);
const WIN_SEED = findSeed(
  (seed) => playSeason(seed, WIN_SHOULD_SEARCH, WIN_PLAN).status === 'won'
);

// --- driving the UI ---------------------------------------------------------

// The policies want the shape createRun returns, and the snapshot the page
// hands back has no tuning in it (a function and a tool table are not worth
// serialising across). Refit it here rather than widening the snapshot, which
// every other test reads as plain data.
async function liveState(game) {
  const at = await game.state();
  return at ? { ...at, tuning: DEFAULT_TUNING } : null;
}

// Taps SEARCH until `stop` says otherwise, or until the night ends on its own.
async function searchUntil(game, stop) {
  for (let guard = 0; guard < 40; guard++) {
    const at = await liveState(game);
    if (!at || at.phase !== 'search') return at;
    if (stop(at)) return at;
    await game.tapSearch();
    await game.settle();
  }
  throw new Error('searched forty times without the night ending');
}

// Works the dawn panel the way a player would: route the stacks, stow, build,
// sleep. `routes` names where each stack goes; `builds` is an ordered list of
// tool ids to try, skipping any the stockpile does not cover — the same order
// the simulator attempts them in.
// Returns the state as it stood once the basket was stowed and before anything
// was built, which is the only moment a test can see what a tool actually cost.
async function playDawn(game, { routes = {}, builds = [] } = {}) {
  const at = await game.state();
  assert(at.dawnOpen, 'the dawn panel should be open');
  for (const resource of RESOURCES) {
    if (routes[resource] === 'stock' && at.basket[resource] > 0) await game.tapStack(resource);
  }
  const held = RESOURCES.some((r) => at.basket[r] > 0);
  await game.clickText(held ? 'STOW' : 'NOTHING TO STOW');
  const stowed = await game.state();

  for (const id of builds) {
    const tool = DEFAULT_TOOLS.find((t) => t.id === id);
    const now = await game.state();
    if (!tool || now.toolsBuilt.includes(id)) continue;
    if (!canAfford(now.stock, tool.cost)) continue;
    await game.tapTool(tool.name);
  }

  await game.clickText('SLEEP');
  await game.settle();
  return stowed;
}

// Plays whole seasons through the canvas under a policy, until the recap.
async function playUntilRecap(game, shouldSearch, plan) {
  for (let night = 0; night < 14; night++) {
    const at = await liveState(game);
    if (!at) break; // the run is over and the recap has taken the screen
    if (at.phase === 'search') {
      const stopped = await searchUntil(game, (s) => !shouldSearch(s));
      // Stopping on purpose leaves the night open — the policy said "go home",
      // and that is a tap, not a state change.
      if (stopped && stopped.phase === 'search') {
        await game.tapGoHome();
        await game.settle();
      }
    }
    const dawn = await liveState(game);
    if (!dawn || !dawn.dawnOpen) break;
    const step = plan(dawn);
    await playDawn(game, step);
  }
  await game.waitForScene('RecapScene');
}

// --- rules the screen leans on ----------------------------------------------
//
// tests/rules.test.mjs covers the rules the tuning rests on. These are the four
// the view reads to draw the risk line and the workshop, and nothing was
// covering them.

unit('the odds a night ends on the next draw', () => {
  const state = createRun({ seed: 5 });
  beginNight(state);
  assertEqual(budgetLeft(state), 3, 'a fresh night has the whole budget');
  assertEqual(waveOdds(state), 3 / 18, 'wave odds are waves over bag');
  assertEqual(bustOdds(state), 0, 'nothing can end a night while two waves are still owed');

  state.strikes = 2;
  assertEqual(budgetLeft(state), 1, 'two strikes leaves one');
  assertEqual(bustOdds(state), 3 / 18, 'with one owed, every wave left ends it');

  state.bag = [];
  assertEqual(waveOdds(state), 0, 'an empty bag has no odds');
  assertEqual(bustOdds(state), 0, 'an empty bag has no odds');
});

unit('the workshop only offers what the stockpile covers', () => {
  const state = createRun({ seed: 5 });
  assertEqual(affordableTools(state), [], 'an empty stockpile affords nothing');

  state.stock = { oil: 3, wood: 3, plank: 0 };
  assertEqual(
    affordableTools(state).map((t) => t.id),
    ['gaff', 'funnel', 'pole'],
    'three tools are covered by three oil and three driftwood'
  );

  state.toolsBuilt.push('gaff');
  assert(
    !affordableTools(state).some((t) => t.id === 'gaff'),
    'a tool already built is off the list however rich you are'
  );
});

// --- the screen -------------------------------------------------------------

test('a run starts at dusk on night one, with the drain already taken', async (game) => {
  assertEqual(await game.activeScene(), 'TitleScene', 'the game opens on the title');
  assert(await game.hasText('Pitchou'), 'the title screen names the game');

  await game.startRun();
  const at = await game.state();
  assertEqual(at.night, 1, 'the season starts on night one');
  assertEqual(at.phase, 'search', 'dusk resolves straight into the search');
  assertEqual(
    at.meters,
    { lamp: 9, hearth: 9, tower: 9 },
    "every meter has already paid night one's drain"
  );
  assertEqual(at.bag, 18, 'the starting shore is eighteen tokens');
  assertEqual(at.faceUp, 0, 'nothing is face-up before the first search');
  assert(await game.hasText('NIGHT 1 / 12'), 'the header names the night');
});

test('one search turns one token face-up and moves exactly one thing', async (game) => {
  await game.startRun();
  const before = await game.state();
  await game.tapSearch();
  await game.settle();
  const after = await game.state();

  assertEqual(after.bag, before.bag - 1, 'the bag is one token lighter');
  assertEqual(after.faceUp, 1, 'the token that was drawn is face-up');
  assertEqual(after.drawn.length, 1, 'exactly one token was drawn');

  const held = RESOURCES.reduce((n, r) => n + after.basket[r], 0);
  if (after.drawn[0] === 'wave') {
    assertEqual(after.strikes, 1, 'a wave costs a strike');
    assertEqual(held, 0, 'a wave off an empty basket takes nothing');
  } else {
    assertEqual(after.strikes, 0, 'a resource costs no strike');
    assert(held > 0, 'a resource lands in the basket');
  }
});

test('going home before the third wave banks the basket intact', async (game) => {
  await game.startRun();
  // Home once a wave has landed and there is something to lose — the point in
  // a night where the decision is real.
  const at = await searchUntil(
    game,
    (s) => s.strikes >= 1 && RESOURCES.some((r) => s.basket[r] > 0)
  );
  if (at.phase !== 'search') return; // the night ended on its own; nothing to check

  const carried = { ...at.basket };
  await game.tapGoHome();
  await game.settle();

  const dawn = await game.state();
  assert(dawn.dawnOpen, 'going home opens dawn');
  assert(!dawn.busted, 'walking away is not a bust');
  assertEqual(dawn.basket, carried, 'the basket came home untouched');
});

test(
  'the third wave ends the night and takes half the basket',
  async (game) => {
    await game.startRun();
    let before = null;
    // Never stop: the bust is what is under test.
    for (let guard = 0; guard < 40; guard++) {
      const at = await game.state();
      if (at.phase !== 'search') break;
      before = { ...at.basket };
      await game.tapSearch();
      await game.settle();
    }

    const after = await game.state();
    assert(after.busted, 'drawing the whole shore always reaches the third wave');
    assert(after.dawnOpen, 'a bust opens dawn on its own');
    assertEqual(after.strikes, 3, 'the night ended on the third strike');
    for (const resource of RESOURCES) {
      assertEqual(
        after.basket[resource],
        Math.floor(before[resource] / 2),
        `half the ${resource}, rounded down`
      );
    }
  },
  { prefs: { motion: false } }
);

test('a stack routed to the workshop reaches the stockpile, not its meter', async (game) => {
  await game.startRun();
  const at = await searchUntil(game, (s) => RESOURCES.some((r) => s.basket[r] > 0));
  if (at.phase === 'search') {
    await game.tapGoHome();
    await game.settle();
  }

  const dawn = await game.state();
  const held = RESOURCES.find((r) => dawn.basket[r] > 0);
  assert(held, 'the night found something');
  const amount = dawn.basket[held];
  const before = { ...dawn.meters };

  await playDawn(game, { routes: { [held]: 'stock' } });

  const next = await game.state();
  assertEqual(next.stock[held], amount, 'the whole stack went to the workshop');
  assertEqual(
    next.meters[METER_OF[held]],
    before[METER_OF[held]] - 1,
    'its meter was not fed — it only moved by the next drain'
  );
});

test(
  'pouring past the cap says what it threw away',
  async (game) => {
    await game.startRun();
    const at = await searchUntil(game, (s) => RESOURCES.some((r) => s.basket[r] >= 4));
    if (at.phase === 'search') {
      await game.tapGoHome();
      await game.settle();
    }

    const dawn = await game.state();
    const over = RESOURCES.find((r) => dawn.basket[r] >= 4);
    assert(over, 'this seed was picked for a night that overfills a meter');
    const meter = METER_OF[over];
    const spill = dawn.basket[over] - (DEFAULT_TUNING.meterCap - dawn.meters[meter]);
    assert(spill > 0, 'the stack really is bigger than the meter can hold');

    const texts = await game.texts();
    assert(
      texts.includes(`${spill} over the brim, lost`),
      `dawn should name the ${spill} units the cap refuses; saw ${JSON.stringify(texts)}`
    );

    await playDawn(game);
    const next = await game.state();
    assertEqual(
      next.meters[meter],
      DEFAULT_TUNING.meterCap - 1,
      'the meter filled to the cap and then paid the next drain'
    );
  },
  { seed: CAP_SEED }
);

test(
  'a tool is paid from the stockpile and puts a token on the shore',
  async (game) => {
    await game.startRun();
    const shoreAtStart = (await game.state()).shore;
    let banked = null;

    for (let night = 0; night < 6; night++) {
      const at = await game.state();
      if (!at || at.status !== 'playing') break;
      if (at.phase === 'search') {
        const stopped = await searchUntil(game, (s) => s.strikes >= 2);
        if (stopped && stopped.phase === 'search') {
          await game.tapGoHome();
          await game.settle();
        }
      }
      const dawn = await game.state();
      if (!dawn || !dawn.dawnOpen) break;
      // Hold the driftwood back; everything else goes into its meter, or the
      // lamp and the tower starve while the workshop fills.
      banked = await playDawn(game, { routes: { wood: 'stock' }, builds: ['gaff'] });
      if ((await game.state()).toolsBuilt.includes('gaff')) break;
    }

    const after = await game.state();
    assert(after.toolsBuilt.includes('gaff'), 'six nights of hoarding driftwood buys a gaff hook');
    assert(
      after.shore > shoreAtStart,
      `the gaff put a token on the shore (${shoreAtStart} -> ${after.shore})`
    );
    assertEqual(
      after.stock.wood,
      banked.stock.wood - 3,
      'the gaff took its three driftwood out of the stockpile and no more'
    );
  },
  { seed: TOOL_SEED, prefs: { motion: false } }
);

test(
  'a season that runs the meters dry names the night and the meter',
  async (game) => {
    await game.startRun();
    await playUntilRecap(game, RECKLESS, POUR_EVERYTHING);

    const texts = await game.texts();
    assert(
      texts.includes('THE LIGHT WENT OUT'),
      `never stopping loses the season; saw ${JSON.stringify(texts)}`
    );
    assert(
      texts.some((t) => /^Night \d+: the (lamp|hearth|tower) ran dry at dusk\.$/.test(t)),
      `the recap names the night and the meter; saw ${JSON.stringify(texts)}`
    );
  },
  { seed: LOSE_SEED, prefs: { motion: false } }
);

test(
  'a season played well reaches night twelve with the light still on',
  async (game) => {
    await game.startRun();
    await playUntilRecap(game, WIN_SHOULD_SEARCH, WIN_PLAN);

    const texts = await game.texts();
    assert(
      texts.includes('THE LIGHT HELD'),
      `this seed was picked to be winnable; saw ${JSON.stringify(texts)}`
    );
    assert(
      texts.includes('Twelve nights of storm, and every meter still burning.'),
      'the win recap says so'
    );
    assert(texts.includes(`seed ${WIN_SEED}`), 'the recap reports the seed it played');
  },
  { seed: WIN_SEED, prefs: { motion: false } }
);

test(
  'a stowed basket still says where it went',
  async (game) => {
    // Regression: the panel used to re-read the run's basket after stowing it,
    // and `allocate` had just emptied that — so a night's whole haul was
    // reported as "nothing survived the walk home".
    await game.startRun();
    const at = await searchUntil(game, (s) => RESOURCES.some((r) => s.basket[r] > 0));
    if (at.phase === 'search') {
      await game.tapGoHome();
      await game.settle();
    }

    const dawn = await game.state();
    const held = RESOURCES.filter((r) => dawn.basket[r] > 0);
    assert(held.length, 'the night found something');
    await game.clickText('STOW');

    const texts = await game.texts();
    assert(
      !texts.includes('Nothing survived the walk home.'),
      'a basket that came home full is not reported as empty'
    );
    for (const resource of held) {
      const meter = METER_OF[resource];
      const to = Math.min(DEFAULT_TUNING.meterCap, dawn.meters[meter] + dawn.basket[resource]);
      assert(
        texts.includes(`${dawn.basket[resource]}  ${RESOURCE_LABELS[resource]}`),
        `the ${resource} stack is still named after stowing; saw ${JSON.stringify(texts)}`
      );
      assert(
        texts.includes(`${METER_LABELS[meter]}  ${dawn.meters[meter]} \u2192 ${to}`),
        `the ${meter} shows what the pour did; saw ${JSON.stringify(texts)}`
      );
    }
  },
  { prefs: { motion: false } }
);

test(
  'hard mode takes the whole basket on the third wave',
  async (game) => {
    await game.startRun();
    for (let guard = 0; guard < 40; guard++) {
      const at = await game.state();
      if (at.phase !== 'search') break;
      await game.tapSearch();
      await game.settle();
    }
    const after = await game.state();
    assert(after.busted, 'drawing the whole shore reaches the third wave');
    assertEqual(
      after.basket,
      { oil: 0, wood: 0, plank: 0 },
      'with the hard bust on, a third wave leaves nothing'
    );
    assert(
      await game.hasText('Nothing survived the walk home.'),
      'and dawn says so'
    );
  },
  { prefs: { motion: false, hard: true } }
);

test(
  'the whole board is reachable on a small phone',
  async (game) => {
    await game.startRun();
    const fit = await game.canvasFit();
    assert(!fit.pageScrollsX && !fit.pageScrollsY, 'the page itself never scrolls');
    assert(fit.left >= 0 && fit.top >= 0, 'the canvas is not pushed off the top or left');
    assert(
      fit.right <= fit.viewport.width + 1 && fit.bottom <= fit.viewport.height + 1,
      `the canvas fits inside ${fit.viewport.width}x${fit.viewport.height}`
    );
  },
  { viewport: { width: 360, height: 640 } }
);

run();
