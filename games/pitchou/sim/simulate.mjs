// Season simulator for Pitchou. Plays thousands of seasons under dumb policies
// so tuning is settled with numbers instead of argument.
//
//   node sim/simulate.mjs           # policy table for the current tuning
//   node sim/simulate.mjs --sweep   # candidate tunings, scored by policy spread
//   node sim/simulate.mjs --runs N  # seasons per policy (default 20000)
//
// What a good tuning looks like: the careless policies lose most of the time,
// the thoughtful ones win often but not always, and the gap between them is
// wide — that gap is the part of the game the player is actually playing.

import {
  DEFAULT_TUNING,
  DEFAULT_TOOLS,
  METERS,
  allocate,
  basketIsEmpty,
  beginNight,
  buildTool,
  canAffordFromMeters,
  bustOdds,
  createRun,
  endNight,
  goHome,
  search,
  waveDamageFor,
} from '../src/core/rules.js';
import { POLICIES, WAVE_POLICIES } from './policies.mjs';

// A draw is "live" when it can cost the player something: either a wave in the
// bag could end the night, or waves damage the basket so any wave hurts. A draw
// that is neither is not a decision — it is a button the player presses because
// there is no reason not to.
function drawIsLive(state) {
  if (!state.bag.some((token) => token.kind === 'wave')) return false;
  return waveDamageFor(state.tuning, state.strikes) > 0 || bustOdds(state) > 0;
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

const withTools = (overrides) =>
  DEFAULT_TOOLS.map((tool) => (overrides[tool.id] ? { ...tool, ...overrides[tool.id] } : tool));

const tune = (overrides) => ({ ...DEFAULT_TUNING, ...overrides });

const GENTLER_DRAIN = [
  { through: 5, drain: 1 },
  { through: 9, drain: 2 },
  { through: 12, drain: 3 },
];

// Ablations against the current tuning. Each one turns a single number back to
// what it was before the search, so the sweep is a standing record of why the
// numbers in DESIGN.md §8 are what they are.
const CANDIDATES = [
  { label: 'current tuning (DESIGN.md §8)', tuning: DEFAULT_TUNING },
  { label: 'ablation: waves free until the third', tuning: tune({ waveDamage: 0 }) },
  { label: 'ablation: all-or-nothing bust', tuning: tune({ bustKeeps: 0 }) },
  { label: 'ablation: roomy cap 14', tuning: tune({ meterCap: 14 }) },
  { label: 'ablation: gentler drain', tuning: tune({ drainSteps: GENTLER_DRAIN }) },
  { label: 'ablation: thinner shore 4/4/4', tuning: tune({ startShore: { oil: 4, wood: 4, plank: 4 } }) },
  { label: 'ablation: richer shore 6/6/6', tuning: tune({ startShore: { oil: 6, wood: 6, plank: 6 } }) },
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
  timid: POLICIES.find((p) => p.name === 'timid (home at 1 wave)'),
  safe: POLICIES.find((p) => p.name === 'safe, no tools'),
  tools: POLICIES.find((p) => p.name === 'safe + tools (buf 3)'),
  push: POLICIES.find((p) => p.name === 'push 25% + tools'),
};

const DRAIN_SCHEDULES = {
  gentle: [
    { through: 5, drain: 1 },
    { through: 9, drain: 2 },
    { through: 12, drain: 3 },
  ],
  baseline: DEFAULT_TUNING.drainSteps,
  steep: [
    { through: 3, drain: 1 },
    { through: 6, drain: 2 },
    { through: 9, drain: 3 },
    { through: 12, drain: 4 },
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
    for (const headroom of [2, 3]) {
      for (const shore of [3, 4]) {
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

// --- wave structure comparison ---------------------------------------------

// What are the early waves for? Each structure is measured on the same three
// things: can you win, how often does a night end badly, and — the point of the
// exercise — what share of the taps are actually a decision. A draw is "live"
// when something in the bag could end the night; anything else is the player
// pressing a button because there is no reason not to.
const WAVE_STRUCTURES = [
  { label: 'current: 3 waves, budget 3', tuning: tune({}) },
  { label: 'budget 2, 3 waves', tuning: tune({ waveBudget: 2 }) },
  { label: 'budget 2, 4 waves', tuning: tune({ waveBudget: 2, startWaves: [1, 1, 1, 1] }) },
  { label: 'budget 1, 2 waves (any wave ends it)', tuning: tune({ waveBudget: 1, startWaves: [1, 1] }) },
  { label: 'budget 1, 3 waves (any wave ends it)', tuning: tune({ waveBudget: 1 }) },
  { label: 'budget 1, ONE wave, no storm waves', tuning: tune({ waveBudget: 1, startWaves: [1], stormWaveNights: [] }) },
  { label: 'budget 1, ONE wave, storm adds waves', tuning: tune({ waveBudget: 1, startWaves: [1] }) },
  { label: 'budget 2, 2 waves', tuning: tune({ waveBudget: 2, startWaves: [1, 1] }) },
  { label: 'waves cost 1 loot, budget 3', tuning: tune({ waveDamage: 1 }) },
  { label: 'escalating damage 1 then 2', tuning: tune({ waveDamage: [1, 2] }) },
  { label: 'escalating damage 0 then 2', tuning: tune({ waveDamage: [0, 2] }) },
  { label: 'escalating damage 1 then 3', tuning: tune({ waveDamage: [1, 3] }) },
  { label: 'waves cost 2 loot, budget 3', tuning: tune({ waveDamage: 2 }) },
  { label: 'waves cost 1 loot, budget 3, 4 waves', tuning: tune({ waveDamage: 1, startWaves: [1, 1, 1, 1] }) },
  { label: 'graded 1/1/2, budget 3', tuning: tune({ startWaves: [1, 1, 2] }) },
  { label: 'graded 1/2/2, budget 3', tuning: tune({ startWaves: [1, 2, 2] }) },
];

// Comparing structures at a fixed shore is unfair — a harsher wave rule simply
// loses more. Instead give each structure the shore richness that lands it
// closest to the same win rate, then compare how many taps are decisions.
function fairestShore(tuning, runs, target = 0.5) {
  let best = null;
  for (const shore of [4, 5, 6, 7, 8]) {
    const candidate = { ...tuning, startShore: { oil: shore, wood: shore, plank: shore } };
    const rows = WAVE_POLICIES.map((policy) => evaluate(policy, { runs, tuning: candidate }));
    const top = rows.reduce((a, b) => (b.winRate > a.winRate ? b : a));
    const distance = Math.abs(top.winRate - target);
    if (best === null || distance < best.distance) best = { shore, top, distance, candidate };
  }
  return best;
}

function fairWaveReport(runs) {
  const head = `${'structure'.padEnd(38)}  ${'shore'.padStart(5)}  ${'best policy'.padEnd(14)}  ${'win'.padStart(6)}  ${'live taps'.padStart(9)}  ${'bust'.padStart(6)}  ${'draws'.padStart(6)}`;
  console.log('each structure given the shore that puts it nearest a 50% win rate\n');
  console.log(head);
  console.log('-'.repeat(head.length));
  for (const structure of WAVE_STRUCTURES) {
    const fit = fairestShore(structure.tuning, runs);
    console.log(
      `${structure.label.padEnd(38)}  ${String(fit.shore).padStart(5)}  ${fit.top.name.padEnd(14)}  ${pct(fit.top.winRate).padStart(6)}  ${pct(fit.top.liveShare).padStart(9)}  ${pct(fit.top.bustRate).padStart(6)}  ${num(fit.top.drawsPerNight, 1).padStart(6)}`,
    );
  }
}

function waveReport(runs) {
  const head = `${'structure'.padEnd(38)}  ${'best policy'.padEnd(14)}  ${'win'.padStart(6)}  ${'live taps'.padStart(9)}  ${'bust'.padStart(6)}  ${'draws'.padStart(6)}`;
  console.log(head);
  console.log('-'.repeat(head.length));
  for (const structure of WAVE_STRUCTURES) {
    const rows = WAVE_POLICIES.map((policy) => evaluate(policy, { runs, tuning: structure.tuning }));
    const best = rows.reduce((a, b) => (b.winRate > a.winRate ? b : a));
    console.log(
      `${structure.label.padEnd(38)}  ${best.name.padEnd(14)}  ${pct(best.winRate).padStart(6)}  ${pct(best.liveShare).padStart(9)}  ${pct(best.bustRate).padStart(6)}  ${num(best.drawsPerNight, 1).padStart(6)}`,
    );
  }
}

const args = process.argv.slice(2);
const runsFlag = args.indexOf('--runs');
const runs = runsFlag === -1 ? 20000 : Number(args[runsFlag + 1]);

if (args.includes('--waves')) {
  const n = args.includes('--runs') ? runs : 20000;
  if (args.includes('--fair')) fairWaveReport(n);
  else waveReport(n);
} else if (args.includes('--search')) {
  gridSearch(args.includes("--runs") ? runs : 3000);
} else if (args.includes('--sweep')) {
  sweep(runs);
} else {
  console.log(`=== current tuning, ${runs} seasons per policy ===`);
  policyTable(DEFAULT_TUNING, runs);
}
