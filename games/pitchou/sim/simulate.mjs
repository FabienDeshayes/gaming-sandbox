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
  canAfford,
  createRun,
  endNight,
  goHome,
  search,
} from '../src/core/rules.js';
import { POLICIES } from './policies.mjs';

function playSeason(policy, { seed, tuning }) {
  const state = createRun({ seed, tuning });
  let draws = 0;
  let busts = 0;
  let nights = 0;
  let banked = 0;

  while (state.status === 'playing') {
    beginNight(state);
    if (state.status !== 'playing') break;
    nights += 1;

    while (state.phase === 'search' && policy.shouldSearch(state)) {
      search(state);
      draws += 1;
    }
    if (state.phase === 'search') goHome(state);
    if (state.busted) busts += 1;
    banked += state.basket.oil + state.basket.wood + state.basket.plank;

    const plan = policy.plan(state);
    allocate(state, plan.routes);
    for (const id of plan.builds) {
      const tool = state.tuning.tools.find((t) => t.id === id);
      if (!tool || state.toolsBuilt.includes(id)) continue;
      if (canAfford(state.stock, tool.cost)) buildTool(state, id);
    }
    if (!basketIsEmpty(state.basket)) allocate(state, {});
    endNight(state);
  }

  return {
    won: state.status === 'won',
    nightsReached: state.lost ? state.lost.night : tuning.seasonNights,
    killer: state.lost ? state.lost.meter : null,
    draws,
    busts,
    nights,
    banked,
    tools: state.toolsBuilt.length,
  };
}

function evaluate(policy, { runs, tuning, seedBase = 0 }) {
  const totals = { won: 0, nightsReached: 0, draws: 0, busts: 0, nights: 0, banked: 0, tools: 0 };
  const killers = Object.fromEntries(METERS.map((m) => [m, 0]));
  for (let i = 0; i < runs; i++) {
    const result = playSeason(policy, { seed: seedBase + i + 1, tuning });
    if (result.won) totals.won += 1;
    totals.nightsReached += result.nightsReached;
    totals.draws += result.draws;
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
  { label: 'ablation: all-or-nothing bust', tuning: tune({ bustKeeps: 0 }) },
  { label: 'ablation: roomy cap 14', tuning: tune({ meterCap: 14 }) },
  { label: 'ablation: gentler drain', tuning: tune({ drainSteps: GENTLER_DRAIN }) },
  {
    label: 'ablation: original shore 2/2/2, start 8',
    tuning: tune({ startMeter: 8, startShore: { oil: 2, wood: 2, plank: 2 } }),
  },
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

const args = process.argv.slice(2);
const runsFlag = args.indexOf('--runs');
const runs = runsFlag === -1 ? 20000 : Number(args[runsFlag + 1]);

if (args.includes('--search')) {
  gridSearch(args.includes("--runs") ? runs : 3000);
} else if (args.includes('--sweep')) {
  sweep(runs);
} else {
  console.log(`=== current tuning, ${runs} seasons per policy ===`);
  policyTable(DEFAULT_TUNING, runs);
}
