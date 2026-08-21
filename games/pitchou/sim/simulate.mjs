// Season simulator for Pitchou. Plays thousands of seasons under dumb policies
// so tuning is settled with numbers instead of argument.
//
//   node sim/simulate.mjs           # policy table for the current tuning
//   node sim/simulate.mjs --sweep   # candidate tunings, scored by policy spread
//   node sim/simulate.mjs --falls   # whole fall structures, --fair to match difficulty
//   node sim/simulate.mjs --search  # grid-search tunings
//   node sim/simulate.mjs --runs N  # seasons per policy (default 20000)
//
// What a good tuning looks like: the careless policies lose most of the time,
// the thoughtful ones win often but not always, and the gap between them is
// wide — that gap is the part of the game the player is actually playing.

import {
  DEFAULT_TUNING,
  METERS,
  allocate,
  basketIsEmpty,
  beginNight,
  buildTool,
  buildsLeft,
  canAffordFromMeters,
  bustOdds,
  createRun,
  endNight,
  goHome,
  search,
  fallDamageFor,
} from '../src/core/rules.js';
import { POLICIES, FALL_POLICIES } from './policies.mjs';

// A draw is "live" when it can cost the player something: either a fall in the
// bag could end the night, or falls damage the basket so any fall hurts. A draw
// that is neither is not a decision — it is a button the player presses because
// there is no reason not to.
function drawIsLive(state) {
  if (!state.bag.some((token) => token.kind === 'fall')) return false;
  return fallDamageFor(state.tuning, state.strikes) > 0 || bustOdds(state) > 0;
}

function playSeason(policy, { seed, tuning }) {
  const state = createRun({ seed, tuning });
  let draws = 0;
  let liveDraws = 0;
  let busts = 0;
  let nights = 0;
  let banked = 0;

  while (state.status === 'playing') {
    beginNight(state);
    if (state.status !== 'playing') break;
    nights += 1;

    while (state.phase === 'search' && policy.shouldSearch(state)) {
      if (drawIsLive(state)) liveDraws += 1;
      search(state);
      draws += 1;
    }
    if (state.phase === 'search') goHome(state);
    if (state.busted) busts += 1;
    banked += state.basket.oil + state.basket.wood + state.basket.plank;

    allocate(state);
    const plan = policy.plan(state);
    for (const id of plan.builds) {
      const tool = state.tuning.tools.find((t) => t.id === id);
      if (!tool || state.toolsBuilt.includes(id)) continue;
      if (buildsLeft(state) === 0) break;
      if (canAffordFromMeters(state.meters, tool.cost)) buildTool(state, id);
    }
    endNight(state);
  }

  return {
    won: state.status === 'won',
    nightsReached: state.lost ? state.lost.night : tuning.seasonNights,
    killer: state.lost ? state.lost.meter : null,
    draws,
    liveDraws,
    busts,
    nights,
    banked,
    tools: state.toolsBuilt.length,
  };
}

function evaluate(policy, { runs, tuning, seedBase = 0 }) {
  const totals = { won: 0, nightsReached: 0, draws: 0, liveDraws: 0, busts: 0, nights: 0, banked: 0, tools: 0 };
  const killers = Object.fromEntries(METERS.map((m) => [m, 0]));
  for (let i = 0; i < runs; i++) {
    const result = playSeason(policy, { seed: seedBase + i + 1, tuning });
    if (result.won) totals.won += 1;
    totals.nightsReached += result.nightsReached;
    totals.draws += result.draws;
    totals.liveDraws += result.liveDraws;
    totals.busts += result.busts;
    totals.nights += result.nights;
    totals.banked += result.banked;
    totals.tools += result.tools;
    if (result.killer) killers[result.killer] += 1;
  }
  return {
    name: policy.name,
    winRate: totals.won / runs,
    avgNight: totals.nightsReached / runs,
    drawsPerNight: totals.draws / totals.nights,
    liveShare: totals.draws === 0 ? 0 : totals.liveDraws / totals.draws,
    bustRate: totals.busts / totals.nights,
    bankedPerNight: totals.banked / totals.nights,
    tools: totals.tools / runs,
    killers,
  };
}

const pct = (n) => `${(n * 100).toFixed(1)}%`;
const num = (n, d = 2) => n.toFixed(d);

function policyTable(tuning, runs) {
  const rows = POLICIES.map((policy) => evaluate(policy, { runs, tuning }));
  const width = Math.max(...rows.map((r) => r.name.length));
  console.log(
    `${'policy'.padEnd(width)}  ${'win'.padStart(6)}  ${'night'.padStart(6)}  ${'draws'.padStart(6)}  ${'bust'.padStart(6)}  ${'banked'.padStart(7)}  ${'tools'.padStart(5)}`,
  );
  console.log('-'.repeat(width + 46));
  for (const row of rows) {
    console.log(
      `${row.name.padEnd(width)}  ${pct(row.winRate).padStart(6)}  ${num(row.avgNight, 1).padStart(6)}  ${num(row.drawsPerNight, 1).padStart(6)}  ${pct(row.bustRate).padStart(6)}  ${num(row.bankedPerNight, 1).padStart(7)}  ${num(row.tools, 1).padStart(5)}`,
    );
  }
  const best = rows.reduce((a, b) => (b.winRate > a.winRate ? b : a));
  const worst = rows.reduce((a, b) => (b.winRate < a.winRate ? b : a));
  console.log(
    `\nbest: ${best.name} at ${pct(best.winRate)} — spread over worst (${worst.name}) is ${pct(best.winRate - worst.winRate)}`,
  );
  console.log(
    `killed by: ${METERS.map((m) => `${m} ${pct(best.killers[m] / runs)}`).join(', ')} (best policy)`,
  );
  return rows;
}

// --- tuning candidates ------------------------------------------------------

const tune = (overrides) => ({ ...DEFAULT_TUNING, ...overrides });

// The drain the season ran on before the twelve-tool workshop: a step every
// four nights instead of every five, which is two more units off every meter
// across a season.
const STEEPER_DRAIN = [
  { through: 4, drain: 1 },
  { through: 8, drain: 2 },
  { through: 12, drain: 3 },
];

// The pre-playtest workshop: two tools a tier, every one of them a plain
// doubler or a fall removal.
const PLAIN_TOOLS = [
  { id: 'gaff', name: 'Gaff hook', tier: 1, cost: { wood: 3 }, add: { gains: [{ resource: 'wood', amount: 2 }] } },
  { id: 'net', name: 'Tide net', tier: 1, cost: { plank: 3 }, add: { gains: [{ resource: 'plank', amount: 2 }] } },
  { id: 'funnel', name: 'Oil funnel', tier: 2, cost: { oil: 3 }, add: { gains: [{ resource: 'oil', amount: 2 }] } },
  { id: 'pole', name: 'Lantern pole', tier: 2, cost: { oil: 2, wood: 2 }, add: { gains: [{ resource: 'oil', amount: 2 }] } },
  { id: 'wall', name: 'Storm wall', tier: 3, cost: { plank: 6 }, removeFall: true },
  { id: 'breakwater', name: 'Breakwater', tier: 3, cost: { oil: 4, wood: 4 }, removeFall: true },
];

// Ablations against the current tuning. Each one turns a single number back to
// what it was before the search, so the sweep is a standing record of why the
// numbers in DESIGN.md §8 are what they are.
const CANDIDATES = [
  { label: 'current tuning (DESIGN.md §8)', tuning: DEFAULT_TUNING },
  { label: 'ablation: falls free until the third', tuning: tune({ fallDamage: 0 }) },
  { label: 'ablation: all-or-nothing fall', tuning: tune({ bustKeeps: 0 }) },
  { label: 'ablation: hoardable cap 18', tuning: tune({ meterCap: 18 }) },
  { label: 'ablation: steeper drain', tuning: tune({ drainSteps: STEEPER_DRAIN }) },
  { label: 'ablation: thinner shore 3/3/3', tuning: tune({ startShore: { oil: 3, wood: 3, plank: 3 } }) },
  { label: 'ablation: richer shore 5/5/5', tuning: tune({ startShore: { oil: 5, wood: 5, plank: 5 } }) },
  // Build as many tools a night as the meters cover. The workshop stops being
  // a choice and becomes a shopping list you work through.
  { label: 'ablation: unlimited builds a night', tuning: tune({ buildsPerNight: 99 }) },
  // The workshop the playtest replaced: six tools, all of them plain doublers
  // or fall removals, and no mixed or rolled token anywhere. It is here so the
  // sweep says what the expanded shop is worth rather than only asserting it.
  { label: 'ablation: the old six-tool workshop', tuning: tune({ tools: PLAIN_TOOLS }) },
];

function sweep(runs) {
  for (const candidate of CANDIDATES) {
    console.log(`\n=== ${candidate.label} ===`);
    policyTable(candidate.tuning, runs);
  }
}

// --- grid search ------------------------------------------------------------

// A tuning is only interesting if the three things the player actually decides
// all matter: building has to beat not building, pushing has to beat never
// pushing, and careless play has to lose. Win rate alone says nothing.
const SEARCH_POLICIES = {
  reckless: POLICIES.find((p) => p.name === 'reckless (never stop)'),
  timid: POLICIES.find((p) => p.name === 'timid (home at 1 fall)'),
  safe: POLICIES.find((p) => p.name === 'safe, no tools'),
  tools: POLICIES.find((p) => p.name === 'safe + tools (buf 3)'),
  push: POLICIES.find((p) => p.name === 'push 25% + tools'),
};

// Three genuinely different schedules. `baseline` is whatever the tuning
// currently runs; the other two have to be a step either side of it, or the
// grid spends a third of its rows re-measuring the same numbers.
const DRAIN_SCHEDULES = {
  gentle: [
    { through: 6, drain: 1 },
    { through: 10, drain: 2 },
    { through: 12, drain: 3 },
  ],
  baseline: DEFAULT_TUNING.drainSteps,
  steep: [
    { through: 4, drain: 1 },
    { through: 8, drain: 2 },
    { through: 12, drain: 3 },
  ],
};

function scoreTuning(tuning, runs) {
  const wins = {};
  for (const [key, policy] of Object.entries(SEARCH_POLICIES)) {
    wins[key] = evaluate(policy, { runs, tuning }).winRate;
  }
  const best = Math.max(wins.safe, wins.tools, wins.push);
  const toolGap = wins.tools - wins.safe;
  const riskGap = wins.push - Math.max(wins.safe, wins.tools);
  const feasible = best >= 0.3 && best <= 0.7 && wins.reckless < 0.02 && wins.timid < 0.2;
  return { wins, best, toolGap, riskGap, feasible, score: toolGap * 2 + riskGap };
}

function gridSearch(runs) {
  const results = [];
  const CASKS = {
    none: [],
    cask: [{ resource: 'oil', amount: 3 }, { resource: 'wood', amount: 3 }, { resource: 'plank', amount: 3 }],
  };
  for (const startMeter of [8, 10]) {
    for (const headroom of [4, 6]) {
      for (const shore of [4, 5]) {
        for (const [drainName, drainSteps] of Object.entries(DRAIN_SCHEDULES)) {
          for (const bustKeeps of [0, 0.5]) {
            for (const [caskName, extraTokens] of Object.entries(CASKS)) {
              const tuning = {
                ...DEFAULT_TUNING,
                startMeter,
                meterCap: startMeter + headroom,
                startShore: { oil: shore, wood: shore, plank: shore },
                drainSteps,
                bustKeeps,
                extraTokens,
              };
              const scored = scoreTuning(tuning, runs);
              results.push({
                label: `start ${startMeter} cap ${startMeter + headroom} shore ${shore} ${drainName} bust-keeps-${bustKeeps} ${caskName}`,
                tuning,
                ...scored,
              });
            }
          }
        }
      }
    }
  }
  const feasible = results.filter((r) => r.feasible).sort((a, b) => b.score - a.score);
  console.log(`${results.length} tunings, ${feasible.length} feasible (best policy 30-70%, careless play loses)\n`);
  const head = `${'tuning'.padEnd(56)}  ${'safe'.padStart(6)}  ${'tools'.padStart(6)}  ${'push'.padStart(6)}  ${'toolgap'.padStart(7)}  ${'riskgap'.padStart(7)}`;
  console.log(head);
  console.log('-'.repeat(head.length));
  const show = (row) =>
    console.log(
      `${row.label.padEnd(56)}  ${pct(row.wins.safe).padStart(6)}  ${pct(row.wins.tools).padStart(6)}  ${pct(row.wins.push).padStart(6)}  ${pct(row.toolGap).padStart(7)}  ${pct(row.riskGap).padStart(7)}`,
    );
  for (const row of feasible.slice(0, 20)) show(row);
  const byRisk = results.slice().sort((a, b) => b.riskGap - a.riskGap).slice(0, 8);
  console.log('\nbest riskgap in the whole grid (does pushing ever pay?):');
  for (const row of byRisk) show(row);
  return feasible;
}

// --- fall structure comparison ---------------------------------------------

// What are the early falls for? Each structure is measured on the same three
// things: can you win, how often does a night end badly, and — the point of the
// exercise — what share of the taps are actually a decision. A draw is "live"
// when something in the bag could end the night; anything else is the player
// pressing a button because there is no reason not to.
const FALL_STRUCTURES = [
  { label: 'current: 3 falls, budget 3', tuning: tune({}) },
  { label: 'budget 2, 3 falls', tuning: tune({ fallBudget: 2 }) },
  { label: 'budget 2, 4 falls', tuning: tune({ fallBudget: 2, startFalls: [1, 1, 1, 1] }) },
  { label: 'budget 1, 2 falls (any fall ends it)', tuning: tune({ fallBudget: 1, startFalls: [1, 1] }) },
  { label: 'budget 1, 3 falls (any fall ends it)', tuning: tune({ fallBudget: 1 }) },
  { label: 'budget 1, ONE fall, no added falls', tuning: tune({ fallBudget: 1, startFalls: [1], extraFallNights: [] }) },
  { label: 'budget 1, ONE fall, falls still added', tuning: tune({ fallBudget: 1, startFalls: [1] }) },
  { label: 'budget 2, 2 falls', tuning: tune({ fallBudget: 2, startFalls: [1, 1] }) },
  { label: 'falls cost 1 loot, budget 3', tuning: tune({ fallDamage: 1 }) },
  { label: 'escalating damage 1 then 2', tuning: tune({ fallDamage: [1, 2] }) },
  { label: 'escalating damage 0 then 2', tuning: tune({ fallDamage: [0, 2] }) },
  { label: 'escalating damage 1 then 3', tuning: tune({ fallDamage: [1, 3] }) },
  { label: 'falls cost 2 loot, budget 3', tuning: tune({ fallDamage: 2 }) },
  { label: 'falls cost 1 loot, budget 3, 4 falls', tuning: tune({ fallDamage: 1, startFalls: [1, 1, 1, 1] }) },
  { label: 'graded 1/1/2, budget 3', tuning: tune({ startFalls: [1, 1, 2] }) },
  { label: 'graded 1/2/2, budget 3', tuning: tune({ startFalls: [1, 2, 2] }) },
];

// Comparing structures at a fixed shore is unfair — a harsher fall rule simply
// loses more. Instead give each structure the shore richness that lands it
// closest to the same win rate, then compare how many taps are decisions.
function fairestShore(tuning, runs, target = 0.5) {
  let best = null;
  for (const shore of [4, 5, 6, 7, 8]) {
    const candidate = { ...tuning, startShore: { oil: shore, wood: shore, plank: shore } };
    const rows = FALL_POLICIES.map((policy) => evaluate(policy, { runs, tuning: candidate }));
    const top = rows.reduce((a, b) => (b.winRate > a.winRate ? b : a));
    const distance = Math.abs(top.winRate - target);
    if (best === null || distance < best.distance) best = { shore, top, distance, candidate };
  }
  return best;
}

function fairFallReport(runs) {
  const head = `${'structure'.padEnd(38)}  ${'shore'.padStart(5)}  ${'best policy'.padEnd(14)}  ${'win'.padStart(6)}  ${'live taps'.padStart(9)}  ${'bust'.padStart(6)}  ${'draws'.padStart(6)}`;
  console.log('each structure given the shore that puts it nearest a 50% win rate\n');
  console.log(head);
  console.log('-'.repeat(head.length));
  for (const structure of FALL_STRUCTURES) {
    const fit = fairestShore(structure.tuning, runs);
    console.log(
      `${structure.label.padEnd(38)}  ${String(fit.shore).padStart(5)}  ${fit.top.name.padEnd(14)}  ${pct(fit.top.winRate).padStart(6)}  ${pct(fit.top.liveShare).padStart(9)}  ${pct(fit.top.bustRate).padStart(6)}  ${num(fit.top.drawsPerNight, 1).padStart(6)}`,
    );
  }
}

function fallReport(runs) {
  const head = `${'structure'.padEnd(38)}  ${'best policy'.padEnd(14)}  ${'win'.padStart(6)}  ${'live taps'.padStart(9)}  ${'bust'.padStart(6)}  ${'draws'.padStart(6)}`;
  console.log(head);
  console.log('-'.repeat(head.length));
  for (const structure of FALL_STRUCTURES) {
    const rows = FALL_POLICIES.map((policy) => evaluate(policy, { runs, tuning: structure.tuning }));
    const best = rows.reduce((a, b) => (b.winRate > a.winRate ? b : a));
    console.log(
      `${structure.label.padEnd(38)}  ${best.name.padEnd(14)}  ${pct(best.winRate).padStart(6)}  ${pct(best.liveShare).padStart(9)}  ${pct(best.bustRate).padStart(6)}  ${num(best.drawsPerNight, 1).padStart(6)}`,
    );
  }
}

const args = process.argv.slice(2);
const runsFlag = args.indexOf('--runs');
const runs = runsFlag === -1 ? 20000 : Number(args[runsFlag + 1]);

if (args.includes('--falls')) {
  const n = args.includes('--runs') ? runs : 20000;
  if (args.includes('--fair')) fairFallReport(n);
  else fallReport(n);
} else if (args.includes('--search')) {
  gridSearch(args.includes('--runs') ? runs : 3000);
} else if (args.includes('--sweep')) {
  sweep(runs);
} else {
  console.log(`=== current tuning, ${runs} seasons per policy ===`);
  policyTable(DEFAULT_TUNING, runs);
}
