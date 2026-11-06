// Plays whole runs headlessly against the real rules, with the personas in
// sim/personas.mjs standing in for players. A tuning tool, not a test: nothing
// asserts on it. See sim/README.md.
//
//   npm run sim                         every persona, every special set
//   npm run sim -- --seeds 300 --persona greedy,planner --set kin
//   npm run sim -- --suggest 0.8        targets the reference persona meets that often
//   npm run sim:pieces                  how each piece fares when it is offered

import { PIECES } from '../src/data/pieces.js';
import { SPECIAL_SETS } from '../src/data/catalogue.js';
import { DEFAULT_TUNING } from '../src/data/tuning.js';
import { createRun, currentOffer, nextLevel, place, rng, scoreBoard } from '../src/core/rules.js';
import { PERSONAS } from './personas.mjs';

const args = process.argv.slice(2);
const mode = args[0] && !args[0].startsWith('--') ? args.shift() : 'play';
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const SEEDS = Number(opt('seeds', 100));
const BASE = Number(opt('base', 1));
const personas = opt('persona', Object.keys(PERSONAS).join(',')).split(',');
const sets = opt('set', SPECIAL_SETS.join(',')).split(',');
const SUGGEST = opt('suggest', null);
const REFERENCE = opt('reference', 'greedy');
for (const p of personas) if (!PERSONAS[p]) throw new Error(`no persona "${p}" (have ${Object.keys(PERSONAS).join(', ')})`);
for (const s of sets) if (!SPECIAL_SETS.includes(s)) throw new Error(`no special set "${s}" (have ${SPECIAL_SETS.join(', ')})`);

const T = DEFAULT_TUNING;

// One whole run with the targets switched off, so every run plays all five
// levels and says what its board was worth at each level's end. `onTurn` sees
// every decision, for the per-piece report.
function playThrough(seed, set, persona, onTurn = null) {
  const tuning = { ...T, targets: T.targets.map(() => 0) };
  const state = createRun({ seed, tuning, special: [set] });
  const r = rng(seed * 7919 + 13);
  const scores = [];
  while (state.status === 'playing') {
    const offer = currentOffer(state);
    const [o, i] = PERSONAS[persona].pick(state, r);
    if (onTurn) onTurn(offer, offer[o]);
    place(state, o, i);
    if (state.status !== 'playing') {
      scores.push(state.results[state.results.length - 1].score);
      if (state.status === 'levelEnd') nextLevel(state);
    }
  }
  return { scores, board: state.board };
}

const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
const seeds = () => Array.from({ length: SEEDS }, (_, k) => BASE + k);
// How many runs clear each level and every level before it.
const clears = (runs, targets) =>
  targets.map((_, l) => runs.filter((r) => r.slice(0, l + 1).every((s, k) => s >= targets[k])).length);
const pctOf = (n, of) => `${((100 * n) / of).toFixed(0)}%`.padStart(5);

function play() {
  console.log(`${SEEDS} offer scripts per row (seeds ${BASE}-${BASE + SEEDS - 1}), targets ${T.targets.join(' / ')}`);
  console.log('median board at each level end, then the share of runs that clear level n and all before it\n');
  const all = {};
  for (const persona of personas) {
    console.log(`${persona}: ${PERSONAS[persona].about}`);
    for (const set of sets) {
      const t0 = Date.now();
      const runs = seeds().map((s) => playThrough(s, set, persona).scores);
      (all[persona] ||= []).push(...runs);
      const medians = T.targets.map((_, l) => pct(runs.map((r) => r[l]).sort((a, b) => a - b), 0.5));
      console.log(
        `  base+${set.padEnd(6)} median ${medians.map((m) => String(m).padStart(5)).join('')}` +
          `   clears ${clears(runs, T.targets).map((n) => pctOf(n, SEEDS)).join('')}   (${((Date.now() - t0) / 1000).toFixed(1)}s)`
      );
    }
    console.log();
  }
  if (SUGGEST) suggest(all[REFERENCE] || []);
}

// The targets the reference persona meets `rate` of the time at each level,
// level by level over every set walked, and what clearing them in a row costs.
function suggest(runs) {
  if (!runs.length) return console.log(`--suggest needs the reference persona (${REFERENCE}) in --persona`);
  const rate = Number(SUGGEST);
  const targets = T.targets.map((_, l) => pct(runs.map((r) => r[l]).sort((a, b) => a - b), 1 - rate));
  console.log(`targets ${REFERENCE} meets ${(rate * 100).toFixed(0)}% of the time, level by level: ${targets.join(' / ')}`);
  console.log(`with those, ${REFERENCE} clears level n: ${clears(runs, targets).map((n) => pctOf(n, runs.length)).join('')}`);
}

// Per piece: how often it is taken when offered, how many copies a run ends
// with, and what a copy is worth on that final board.
function pieces() {
  for (const persona of personas.filter((p) => p !== 'random' && p !== 'naive')) {
    const stat = Object.fromEntries(PIECES.map((p) => [p.id, { offered: 0, taken: 0, copies: 0, points: 0 }]));
    for (const set of sets)
      for (const seed of seeds()) {
        const { board } = playThrough(seed, set, persona, (offer, took) => {
          for (const id of offer) stat[id].offered++;
          stat[took].taken++;
        });
        const scored = scoreBoard(board, T);
        board.forEach((id, i) => {
          if (!id) return;
          stat[id].copies++;
          stat[id].points += scored.tiles[i].score;
        });
      }
    console.log(`${persona}, over ${sets.join(', ')} (${SEEDS} scripts each)`);
    console.log('  piece        set     rarity      taken  copies/run  pts/copy');
    for (const p of PIECES) {
      const s = stat[p.id];
      if (!s.offered) continue;
      const runsWith = SEEDS * (p.set === 'base' ? sets.length : sets.filter((x) => x === p.set).length);
      console.log(
        `  ${p.id.padEnd(12)} ${p.set.padEnd(7)} ${p.rarity.padEnd(10)} ${pctOf(s.taken, s.offered)}` +
          `  ${(s.copies / runsWith).toFixed(1).padStart(10)}  ${(s.copies ? s.points / s.copies : 0).toFixed(1).padStart(8)}`
      );
    }
    console.log();
  }
}

const MODES = { play, pieces };
if (MODES[mode]) MODES[mode]();
else console.log(`unknown mode "${mode}": ${Object.keys(MODES).join(' | ')}`);
