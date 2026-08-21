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
  buildsLeft,
  bustOdds,
  canAffordFromMeters,
  createRun,
  drainForNight,
  endNight,
  fallOdds,
  goHome,
  search,
} from '../src/core/rules.js';
import { toolCostLabel, toolEffectLabel } from '../src/ui/DawnPanel.js';
import { THROUGHPUT_FIRST, investPlan, stopWithBudget } from '../sim/policies.mjs';
import { assert, assertEqual, run, test, unit } from './harness.js';

// --- picking a seed ---------------------------------------------------------

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
    allocate(state);
    const step = plan(state);
    for (const id of step.builds) {
      const tool = DEFAULT_TOOLS.find((t) => t.id === id);
      if (!tool || state.toolsBuilt.includes(id)) continue;
      if (buildsLeft(state) === 0) break;
      if (canAffordFromMeters(state.meters, tool.cost)) buildTool(state, id);
    }
    endNight(state);
  }
  return state;
}

const CAP_SEED = findSeed((seed) => {
  const state = createRun({ seed });
  for (let night = 0; night < 3 && state.status === 'playing'; night++) {
    beginNight(state);
    if (state.status !== 'playing') break;
    while (state.phase === 'search' && state.strikes < 2) search(state);
    if (state.phase !== 'search') break;
    goHome(state);
    const cap = state.tuning.meterCap;
    const spills = RESOURCES.some(
      (r) => state.basket[r] > cap - state.meters[METER_OF[r]]
    );
    if (spills) return true;
    allocate(state);
    endNight(state);
  }
  return false;
});

const TOOL_SEED = findSeed((seed) => {
  const state = createRun({ seed });
  for (let night = 0; night < 8 && state.status === 'playing'; night++) {
    beginNight(state);
    if (state.status !== 'playing') break;
    while (state.phase === 'search' && state.strikes < 2) search(state);
    if (state.phase === 'search') goHome(state);
    allocate(state);
    if (!state.toolsBuilt.includes('gaff') && canAffordFromMeters(state.meters, { wood: 3 }))
      buildTool(state, 'gaff');
    endNight(state);
  }
  return state.toolsBuilt.includes('gaff') && state.status === 'playing';
});

const RECKLESS = () => true;
const POUR_EVERYTHING = () => ({ builds: [] });
const LOSE_SEED = findSeed((seed) => playSeason(seed, RECKLESS, POUR_EVERYTHING).status === 'lost');

// A season that gets a mixed token onto the shore and then draws it. Rope line
// first because it is tier one and the cheapest way to a two-resource token.
const MIXED_PLAN = investPlan(['line', 'gaff', 'net', 'funnel'], { buffer: 1 });
const MIXED_NIGHTS = 8;
const MIXED_SEED = findSeed((seed) => {
  const state = createRun({ seed });
  for (let night = 0; night < MIXED_NIGHTS && state.status === 'playing'; night++) {
    beginNight(state);
    if (state.status !== 'playing') break;
    while (state.phase === 'search' && stopWithBudget(1)(state)) {
      const token = search(state);
      if (token.kind === 'resource' && token.rolled.length > 1) return true;
    }
    if (state.phase === 'search') goHome(state);
    allocate(state);
    for (const id of MIXED_PLAN(state).builds) {
      if (buildsLeft(state) === 0) break;
      const tool = DEFAULT_TOOLS.find((t) => t.id === id);
      if (!tool || state.toolsBuilt.includes(id)) continue;
      if (canAffordFromMeters(state.meters, tool.cost)) buildTool(state, id);
    }
    endNight(state);
  }
  return false;
});

const WIN_SHOULD_SEARCH = stopWithBudget(1);
const WIN_PLAN = investPlan(THROUGHPUT_FIRST);
const WIN_SEED = findSeed(
  (seed) => playSeason(seed, WIN_SHOULD_SEARCH, WIN_PLAN).status === 'won'
);

// --- driving the UI ---------------------------------------------------------

async function liveState(game) {
  const at = await game.state();
  return at ? { ...at, tuning: DEFAULT_TUNING } : null;
}

async function searchUntil(game, stop) {
  for (let guard = 0; guard < 40; guard++) {
    const at = await liveState(game);
    if (!at || at.phase !== 'search') return at;
    if (stop(at)) return at;
    await game.tapTile();
    await game.settle();
  }
  throw new Error('searched forty times without the night ending');
}

// Recap, then workshop, then sleep — the two taps and whatever build happens
// between them.
//
// The plan is asked for *after* CONTINUE rather than before, because CONTINUE
// is what pours the basket into the meters: a policy that decides what to buy
// off the pre-allocation meters is playing a different game from
// `playSeason` in sim/simulate.mjs, and the whole point of these tests is that
// the screen and the simulator agree. Pass `{ builds }` for a fixed shopping
// list, `{ plan }` for a policy.
async function playDawn(game, { builds = [], plan = null } = {}) {
  const at = await game.state();
  assert(at.dawnOpen, 'the dawn panel should be open');

  await game.clickText('CONTINUE');
  await game.settle();

  const shopping = plan ? plan(await liveState(game)).builds : builds;
  for (const id of shopping) {
    const tool = DEFAULT_TOOLS.find((t) => t.id === id);
    const now = await game.state();
    if (!tool || now.toolsBuilt.includes(id)) continue;
    if (!canAffordFromMeters(now.meters, tool.cost)) continue;
    await game.tapTool(tool.name);
    // One build a night, so there is nothing left to tap after the first one
    // the meters cover.
    break;
  }

  await game.clickText('SLEEP');
  await game.settle();
  return await game.state();
}

async function playUntilRecap(game, shouldSearch, plan) {
  for (let night = 0; night < 14; night++) {
    const at = await liveState(game);
    if (!at) break;
    if (at.phase === 'search') {
      const stopped = await searchUntil(game, (s) => !shouldSearch(s));
      if (stopped && stopped.phase === 'search') {
        await game.tapGoHome();
        await game.settle();
      }
    }
    const dawn = await liveState(game);
    if (!dawn || !dawn.dawnOpen) break;
    await playDawn(game, { plan });
  }
  await game.waitForScene('RecapScene');
}

// --- rules the screen leans on ----------------------------------------------

unit('the odds a night ends on the next draw', () => {
  const state = createRun({ seed: 5 });
  beginNight(state);
  assertEqual(budgetLeft(state), DEFAULT_TUNING.fallBudget, 'a fresh night has the whole budget');
  const shoreSize = state.shore.length;
  const falls = DEFAULT_TUNING.startFalls.length;
  assertEqual(fallOdds(state), falls / shoreSize, 'fall odds are falls over bag');
  assertEqual(bustOdds(state), 0, 'nothing can end a night while two falls are still owed');

  state.strikes = DEFAULT_TUNING.fallBudget - 1;
  assertEqual(budgetLeft(state), 1, 'spending all but one of the budget leaves one');
  assertEqual(bustOdds(state), falls / shoreSize, 'with one owed, every fall left ends it');

  state.bag = [];
  assertEqual(fallOdds(state), 0, 'an empty bag has no odds');
  assertEqual(bustOdds(state), 0, 'an empty bag has no odds');
});

unit('the workshop only offers what the meters cover', () => {
  const state = createRun({ seed: 5 });
  beginNight(state);
  goHome(state);
  allocate(state);

  const zeroState = createRun({ seed: 5, tuning: { ...DEFAULT_TUNING, startMeter: 1 } });
  zeroState.meters = { lamp: 0, hearth: 0, tower: 0 };
  zeroState.phase = 'dawn';
  assertEqual(affordableTools(zeroState), [], 'zero meters afford nothing');

  state.meters = { lamp: 3, hearth: 3, tower: 0 };
  const tierOne = DEFAULT_TOOLS.filter((t) => t.tier === 1).map((t) => t.id);
  assert(
    affordableTools(state).every((t) => tierOne.includes(t.id)),
    'on night one, only tier-one tools are offered'
  );
  assertEqual(
    affordableTools(state).map((t) => t.id),
    ['gaff', 'funnel'],
    'and only the ones three of a single resource covers'
  );

  state.toolsBuilt.push('gaff');
  assert(
    !affordableTools(state).some((t) => t.id === 'gaff'),
    'a tool already built is off the list however rich you are'
  );

  const tierTwoNight = DEFAULT_TUNING.toolTierNights[1];
  state.night = tierTwoNight;
  state.meters = { lamp: 6, hearth: 6, tower: 6 };
  const openAtTierTwo = affordableTools(state).map((t) => t.id);
  assert(
    DEFAULT_TOOLS.filter((t) => t.tier === 2).every((t) => openAtTierTwo.includes(t.id)),
    `night ${tierTwoNight} unlocks every tier-two tool; saw ${JSON.stringify(openAtTierTwo)}`
  );
  assert(
    !openAtTierTwo.some((id) => DEFAULT_TOOLS.find((t) => t.id === id).tier === 3),
    'and none of tier three'
  );

  // One build a night: once a tool is up, the workshop offers nothing else.
  state.builtTonight = DEFAULT_TUNING.buildsPerNight;
  assertEqual(buildsLeft(state), 0, 'the night is spent');
  assertEqual(affordableTools(state), [], 'a spent night offers nothing');
});

// Every card has to fit its card. The tool list is data, so the check is over
// all of it rather than over the two names that happened to be longest when
// the layout was drawn.
unit('every tool card line is short enough to fit a card', () => {
  const LIMIT = 30;
  for (const tool of DEFAULT_TOOLS) {
    assert(
      tool.name.length <= 16,
      `"${tool.name}" is too long a name for a card (${tool.name.length})`
    );
    const cost = toolCostLabel(tool);
    const effect = toolEffectLabel(tool);
    assert(cost.length <= LIMIT, `"${cost}" is ${cost.length} characters, over ${LIMIT}`);
    assert(effect.length <= LIMIT, `"${effect}" is ${effect.length} characters, over ${LIMIT}`);
  }
});

// --- the screen -------------------------------------------------------------

test('a run starts at dusk on night one, with the drain already taken', async (game) => {
  assertEqual(await game.activeScene(), 'TitleScene', 'the game opens on the title');
  assert(await game.hasText('Pitchou'), 'the title screen names the game');

  await game.startRun();
  const at = await game.state();
  assertEqual(at.night, 1, 'the season starts on night one');
  assertEqual(at.phase, 'search', 'dusk resolves straight into the search');
  const start = DEFAULT_TUNING.startMeter - drainForNight(1, DEFAULT_TUNING);
  assertEqual(
    at.meters,
    { lamp: start, hearth: start, tower: start },
    "every meter has already paid night one's drain"
  );
  assertEqual(
    at.bag,
    createRun({ seed: 1 }).shore.length,
    'the whole starting shore is dealt out'
  );
  assertEqual(at.faceUp, 0, 'nothing is face-up before the first search');
  assert(await game.hasText('NIGHT 1 / 12'), 'the header names the night');
  assert(await game.hasText('Pick a tile'), 'the feedback text prompts the player to pick a tile');
});

test('tapping a tile turns it face-up and moves exactly one thing', async (game) => {
  await game.startRun();
  const before = await game.state();
  await game.tapTile();
  await game.settle();
  const after = await game.state();

  assertEqual(after.bag, before.bag - 1, 'the bag is one token lighter');
  assertEqual(after.faceUp, 1, 'the token that was drawn is face-up');
  assertEqual(after.drawn.length, 1, 'exactly one token was drawn');

  const held = RESOURCES.reduce((n, r) => n + after.basket[r], 0);
  if (after.drawn[0] === 'fall') {
    assertEqual(after.strikes, 1, 'a fall costs a strike');
    assertEqual(held, 0, 'a fall with an empty basket takes nothing');
  } else {
    assertEqual(after.strikes, 0, 'a resource costs no strike');
    assert(held > 0, 'a resource lands in the basket');
  }
});

test('going home before the third fall banks the basket intact', async (game) => {
  await game.startRun();
  const at = await searchUntil(
    game,
    (s) => s.strikes >= 1 && RESOURCES.some((r) => s.basket[r] > 0)
  );
  if (at.phase !== 'search') return;

  const carried = { ...at.basket };
  await game.tapGoHome();
  await game.settle();

  const dawn = await game.state();
  assert(dawn.dawnOpen, 'going home opens dawn');
  assert(!dawn.busted, 'walking away is not a fall');
  assertEqual(dawn.basket, carried, 'the basket came home untouched');
});

test(
  'the third fall ends the night and takes half the basket',
  async (game) => {
    await game.startRun();
    let before = null;
    for (let guard = 0; guard < 40; guard++) {
      const at = await game.state();
      if (at.phase !== 'search') break;
      before = { ...at.basket };
      await game.tapTile();
      await game.settle();
    }

    const after = await game.state();
    assert(after.busted, 'drawing the whole shore always reaches the third fall');
    assert(after.dawnOpen, 'a bust opens dawn on its own');
    assertEqual(
      after.strikes,
      DEFAULT_TUNING.fallBudget,
      'the night ended on the last strike the budget allows'
    );
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

test(
  'pouring past the cap says what it threw away',
  async (game) => {
    await game.startRun();

    let dawn;
    for (let night = 0; night < 3; night++) {
      const at = await liveState(game);
      if (!at || at.status !== 'playing') break;
      if (at.phase === 'search') {
        const stopped = await searchUntil(game, (s) => s.strikes >= 2);
        if (stopped && stopped.phase === 'search') {
          const cap = DEFAULT_TUNING.meterCap;
          const spills = RESOURCES.some(
            (r) => stopped.basket[r] > cap - stopped.meters[METER_OF[r]]
          );
          if (spills) {
            await game.tapGoHome();
            await game.settle();
            dawn = await game.state();
            break;
          }
          await game.tapGoHome();
          await game.settle();
        }
      }
      dawn = await liveState(game);
      if (!dawn || !dawn.dawnOpen) break;
      const cap = DEFAULT_TUNING.meterCap;
      const spills = RESOURCES.some(
        (r) => dawn.basket[r] > cap - dawn.meters[METER_OF[r]]
      );
      if (spills) break;
      await playDawn(game);
    }

    assert(dawn && dawn.dawnOpen, 'reached dawn with overflow');
    const over = RESOURCES.find(
      (r) => dawn.basket[r] > DEFAULT_TUNING.meterCap - dawn.meters[METER_OF[r]]
    );
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
    const drainNext = next ? drainForNight(next.night, DEFAULT_TUNING) : 1;
    assertEqual(
      next.meters[meter],
      DEFAULT_TUNING.meterCap - drainNext,
      'the meter filled to the cap and then paid the next drain'
    );
  },
  { seed: CAP_SEED, prefs: { motion: false } }
);

test(
  'a tool is paid from the meters and puts a token on the shore',
  async (game) => {
    await game.startRun();
    const shoreAtStart = (await game.state()).shore;

    for (let night = 0; night < 8; night++) {
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

      const meterBefore = dawn.meters.hearth;
      await playDawn(game, { builds: ['gaff'] });
      const afterState = await game.state();
      if (afterState && afterState.toolsBuilt.includes('gaff')) {
        assert(
          afterState.shore > shoreAtStart,
          `the gaff put a token on the shore (${shoreAtStart} -> ${afterState.shore})`
        );
        break;
      }
    }

    const after = await game.state();
    assert(after.toolsBuilt.includes('gaff'), 'enough nights of searching buys a gaff hook');
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
      texts.includes('Twelve nights, and every meter still burning.'),
      'the win recap says so'
    );
    assert(texts.includes(`seed ${WIN_SEED}`), 'the recap reports the seed it played');
  },
  { seed: WIN_SEED, prefs: { motion: false } }
);

test(
  'dawn recap shows what was found',
  async (game) => {
    await game.startRun();
    const at = await searchUntil(game, (s) => RESOURCES.some((r) => s.basket[r] > 0));
    if (at.phase === 'search') {
      await game.tapGoHome();
      await game.settle();
    }

    const dawn = await game.state();
    const held = RESOURCES.filter((r) => dawn.basket[r] > 0);
    assert(held.length, 'the night found something');

    const texts = await game.texts();
    for (const resource of held) {
      assert(
        texts.includes(`${dawn.basket[resource]}  ${RESOURCE_LABELS[resource]}`),
        `the ${resource} amount is shown in the recap; saw ${JSON.stringify(texts)}`
      );
    }
    assert(
      !texts.includes('Nothing survived the walk home.'),
      'a basket that came home full is not reported as empty'
    );
  },
  { prefs: { motion: false } }
);

test(
  'hard mode takes the whole basket on the third fall',
  async (game) => {
    await game.startRun();
    for (let guard = 0; guard < 40; guard++) {
      const at = await game.state();
      if (at.phase !== 'search') break;
      await game.tapTile();
      await game.settle();
    }
    const after = await game.state();
    assert(after.busted, 'drawing the whole shore reaches the third fall');
    assertEqual(
      after.basket,
      { oil: 0, wood: 0, plank: 0 },
      'with hard falls on, a third fall leaves nothing'
    );
    assert(
      await game.hasText('Nothing survived the walk home.'),
      'and dawn says so'
    );
  },
  { prefs: { motion: false, hard: true } }
);

// The mixed and rolled tokens are the reason the workshop is worth twelve
// cards, so what they pay has to arrive in the basket and be said out loud.
test(
  'a mixed token fills every stack it names, and the screen says which',
  async (game) => {
    await game.startRun();
    for (let night = 0; night < MIXED_NIGHTS; night++) {
      let at = await liveState(game);
      if (!at || at.status !== 'playing') break;

      while (at && at.phase === 'search' && WIN_SHOULD_SEARCH(at)) {
        const before = { ...at.basket };
        await game.tapTile();
        await game.settle();
        at = await liveState(game);
        if (!at) break;
        const drew = at.drawn[at.drawn.length - 1];
        if (!drew || !drew.includes('+')) continue;

        const paid = drew.split('+').map((part) => {
          const [, resource, amount] = /^([a-z]+)(\d+)$/.exec(part);
          return { resource, amount: Number(amount) };
        });
        assert(paid.length > 1, 'a mixed token pays more than one resource');
        for (const gain of paid) {
          assertEqual(
            at.basket[gain.resource],
            before[gain.resource] + gain.amount,
            `the ${gain.resource} stack took its share`
          );
        }
        const line = `You found ${paid.map((g) => `${g.amount} ${RESOURCE_LABELS[g.resource]}`).join(' + ')}`;
        const texts = await game.texts();
        assert(texts.includes(line), `the screen says "${line}"; saw ${JSON.stringify(texts)}`);
        return;
      }

      if (at && at.phase === 'search') {
        await game.tapGoHome();
        await game.settle();
      }
      const dawn = await liveState(game);
      if (!dawn || !dawn.dawnOpen) break;
      await playDawn(game, { plan: MIXED_PLAN });
    }
    assert(false, 'this seed was picked for a season that draws a mixed token');
  },
  { seed: MIXED_SEED, prefs: { motion: false } }
);

// One build a night is a rule the player meets in the workshop, not in the
// tuning object — after the first tool the rest of the cards go quiet.
test(
  'the workshop builds one tool a night and then closes',
  async (game) => {
    await game.startRun();
    await game.tapGoHome();
    await game.settle();

    await game.clickText('CONTINUE');
    await game.settle();

    const dawn = await game.state();
    const affordable = DEFAULT_TOOLS.filter(
      (t) => t.tier === 1 && canAffordFromMeters(dawn.meters, t.cost)
    );
    assert(
      affordable.length >= 2,
      `night one's meters should cover more than one tier-one tool; saw ${affordable.length}`
    );

    await game.tapTool(affordable[0].name);
    await game.settle();
    const built = await game.state();
    assertEqual(built.toolsBuilt, [affordable[0].id], 'the tapped tool went up');
    assert(
      await game.hasText('Built for tonight. Come back tomorrow.'),
      'the workshop says it is done for the night'
    );

    await game.tapTool(affordable[1].name);
    await game.settle();
    const after = await game.state();
    assertEqual(
      after.toolsBuilt,
      [affordable[0].id],
      'a second tap the same night builds nothing'
    );
  },
  { prefs: { motion: false } }
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
