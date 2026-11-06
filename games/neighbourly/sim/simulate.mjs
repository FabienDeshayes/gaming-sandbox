// Plays whole runs headlessly against the real rules, to set the targets.
//
//   npm run sim                  # board score at each level's end, per policy
//   npm run sim -- --seeds 500   # over more offer scripts
//
// Targets are ignored while measuring (every run plays all six levels), so the
// table says what each policy's board is worth at each level's end; then the
// current targets are checked against it as a pass rate. This is a tuning tool,
// not a test: nothing asserts on it.

import { PIECES } from '../src/data/pieces.js';
import { DEFAULT_TUNING } from '../src/data/tuning.js';
import { createRun, currentOffer, nextLevel, place, previewPlacement, rng } from '../src/core/rules.js';

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? Number(args[i + 1]) : dflt;
};
const SEEDS = flag('--seeds', 200);

// A policy picks [offerIndex, tileIndex] for the current turn.
const POLICIES = {
  // Places a random offer on a random tile: the floor.
  random: (state, r) => [Math.floor(r() * state.tuning.offerSize), Math.floor(r() * state.board.length)],
  // Fills the board in reading order with the first offer, then keeps
  // replacing from the top: someone not reading the rules at all.
  naive: (state) => {
    const empty = state.board.indexOf(null);
    const n = state.level * state.tuning.turnsPerLevel + state.turn;
    return [0, empty >= 0 ? empty : n % state.board.length];
  },
  // The best immediate gain over every offer and every tile: a careful player
  // with no plan.
  greedy: (state) => {
    let best = null;
    currentOffer(state).forEach((id, o) => {
      for (let i = 0; i < state.board.length; i++) {
        const d = previewPlacement(state, id, i).delta;
        if (!best || d > best.d) best = { d, o, i };
      }
    });
    return [best.o, best.i];
  },
};

function playThrough(seed, policy) {
  const tuning = { ...DEFAULT_TUNING, targets: DEFAULT_TUNING.targets.map(() => 0) };
  const state = createRun({ seed, tuning });
  const r = rng(seed * 7919 + 13);
  const scores = [];
  while (state.status === 'playing') {
    const [o, i] = policy(state, r);
    place(state, o, i);
    if (state.status !== 'playing') {
      scores.push(state.results[state.results.length - 1].score);
      if (state.status === 'levelEnd') nextLevel(state);
    }
  }
  return scores;
}

const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];

console.log(`${SEEDS} offer scripts, ${PIECES.length} pieces, targets ${DEFAULT_TUNING.targets.join('/')}\n`);
for (const [name, policy] of Object.entries(POLICIES)) {
  const runs = [];
  for (let s = 1; s <= SEEDS; s++) runs.push(playThrough(s, policy));
  console.log(name);
  for (let l = 0; l < DEFAULT_TUNING.levels; l++) {
    const col = runs.map((r) => r[l]).sort((a, b) => a - b);
    const mean = col.reduce((a, b) => a + b, 0) / col.length;
    console.log(
      `  level ${l + 1}: p10 ${pct(col, 0.1)}  median ${pct(col, 0.5)}  p90 ${pct(col, 0.9)}  mean ${mean.toFixed(1)}`
    );
  }
  // Pass rate with the real targets: how many runs clear each level and every
  // level before it.
  const reach = DEFAULT_TUNING.targets.map((_, l) =>
    runs.filter((r) => r.slice(0, l + 1).every((s, k) => s >= DEFAULT_TUNING.targets[k])).length
  );
  console.log(`  clears level n: ${reach.map((c) => ((100 * c) / SEEDS).toFixed(0) + '%').join(' ')}\n`);
}
