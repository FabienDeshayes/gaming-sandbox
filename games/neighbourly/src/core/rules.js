// The whole game as pure functions: no Phaser, no scene state. The scene, the
// simulator and the tests all go through these, so the score a tap previews
// and the score a level is judged on are the same code.
//
// A board is a flat array, `cols * rows` long, of piece ids or null, read row
// by row from the top left. Terrain is a parallel array of 'grass' | 'water' |
// 'rock' that never changes: a piece sits on its terrain, it doesn't replace it.

import { PIECES, pieceDef } from '../data/pieces.js';
import { DEFAULT_TUNING, TERRAIN_KINDS } from '../data/tuning.js';

// --- Board geometry -----------------------------------------------------------

export function terrainOf(tuning) {
  const out = [];
  for (const row of tuning.terrain) for (const ch of row) out.push(TERRAIN_KINDS[ch]);
  if (out.length !== tuning.cols * tuning.rows) throw new Error('terrain does not fit the board');
  return out;
}

export function neighbours(index, tuning) {
  const { cols, rows } = tuning;
  const x = index % cols;
  const y = Math.floor(index / cols);
  const out = [];
  if (y > 0) out.push(index - cols);
  if (y < rows - 1) out.push(index + cols);
  if (x > 0) out.push(index - 1);
  if (x < cols - 1) out.push(index + 1);
  return out;
}

export function onEdge(index, tuning) {
  const x = index % tuning.cols;
  const y = Math.floor(index / tuning.cols);
  return x === 0 || y === 0 || x === tuning.cols - 1 || y === tuning.rows - 1;
}

// --- Scoring ------------------------------------------------------------------

// What one term of a piece's rule is worth where it stands. The vocabulary of
// src/data/pieces.js is exactly the cases here.
function termValue(term, index, board, terrain, tuning) {
  const { cols } = tuning;
  const adj = neighbours(index, tuning);
  if (term.count) {
    let n;
    switch (term.count) {
      case 'adjacentPieces':
        n = adj.filter((i) => board[i]).length;
        break;
      case 'adjacentTerrain':
        n = adj.filter((i) => terrain[i] === term.terrain).length;
        break;
      case 'rowPieces': {
        const y = Math.floor(index / cols);
        n = 0;
        for (let x = 0; x < cols; x++) if (y * cols + x !== index && board[y * cols + x]) n++;
        break;
      }
      case 'columnPieces': {
        const x = index % cols;
        n = 0;
        for (let y = 0; y < tuning.rows; y++) if (y * cols + x !== index && board[y * cols + x]) n++;
        break;
      }
      case 'distinctTypes':
        n = new Set(board.filter(Boolean)).size;
        break;
      default:
        throw new Error(`unknown count "${term.count}"`);
    }
    return { n, value: n * term.each };
  }
  let holds;
  switch (term.when) {
    case 'onTerrain':
      holds = terrain[index] === term.terrain;
      break;
    case 'onEdge':
      holds = onEdge(index, tuning);
      break;
    case 'adjacentPiecesEquals':
      holds = adj.filter((i) => board[i]).length === term.equals;
      break;
    default:
      throw new Error(`unknown condition "${term.when}"`);
  }
  return { holds, value: holds ? term.add : 0 };
}

// One tile's score and how it was reached: `parts` is the breakdown the info
// panel reads out (base, each term, each neighbour's aura), `raw` the sum before
// the floor at 0, `score` what it counts for.
export function scoreTile(index, board, terrain, tuning) {
  const id = board[index];
  if (!id) return null;
  const def = pieceDef(id);
  const parts = [{ kind: 'base', value: def.base }];
  for (const term of def.terms) parts.push({ kind: 'term', term, ...termValue(term, index, board, terrain, tuning) });
  for (const n of neighbours(index, tuning)) {
    const other = board[n] && pieceDef(board[n]);
    if (other && other.aura) parts.push({ kind: 'aura', from: other.id, value: other.aura });
  }
  const raw = parts.reduce((s, p) => s + p.value, 0);
  return { id, parts, raw, score: Math.max(0, raw) };
}

// The board's score: the sum of every piece's. Pure in the board and terrain.
export function scoreBoard(board, terrain, tuning) {
  const tiles = board.map((_, i) => scoreTile(i, board, terrain, tuning));
  const total = tiles.reduce((s, t) => s + (t ? t.score : 0), 0);
  return { total, tiles };
}

// What placing `id` on `index` would do, without doing it.
export function previewPlacement(state, id, index) {
  const before = scoreBoard(state.board, state.terrain, state.tuning);
  const next = state.board.slice();
  next[index] = id;
  const after = scoreBoard(next, state.terrain, state.tuning);
  return {
    before: before.total,
    after: after.total,
    delta: after.total - before.total,
    replaces: state.board[index],
    piece: after.tiles[index],
    // Every tile whose score moves, so the board can show who gains and loses.
    changes: after.tiles
      .map((t, i) => ({ i, from: before.tiles[i] ? before.tiles[i].score : 0, to: t ? t.score : 0 }))
      .filter((c) => c.from !== c.to || c.i === index),
  };
}

// --- Offers -------------------------------------------------------------------

// mulberry32: small, seedable, the same in every browser and in Node.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The whole run's offers, decided before the first turn: `levels *
// turnsPerLevel` offers of `offerSize` distinct pieces, each piece equally
// likely. Fixed offers, as the first prototype asks — no odds, no pool.
export function offerScript(seed, tuning) {
  const next = rng(seed);
  const ids = PIECES.map((p) => p.id);
  const script = [];
  for (let t = 0; t < tuning.levels * tuning.turnsPerLevel; t++) {
    const pool = ids.slice();
    const offer = [];
    for (let k = 0; k < tuning.offerSize; k++) offer.push(pool.splice(Math.floor(next() * pool.length), 1)[0]);
    script.push(offer);
  }
  return script;
}

// --- A run --------------------------------------------------------------------

// status: 'playing' | 'levelEnd' (a level was just passed, waiting for NEXT)
//       | 'won' | 'lost'
export function createRun({ seed, tuning = DEFAULT_TUNING } = {}) {
  const s = seed ?? tuning.offerSeed;
  return {
    tuning,
    seed: s,
    terrain: terrainOf(tuning),
    board: new Array(tuning.cols * tuning.rows).fill(null),
    script: offerScript(s, tuning),
    level: 0, // 0-based
    turn: 0, // 0-based, within the level
    status: 'playing',
    results: [], // one { level, score, target, passed } per level judged
  };
}

export function globalTurn(state) {
  return state.level * state.tuning.turnsPerLevel + state.turn;
}

export function currentOffer(state) {
  return state.status === 'playing' ? state.script[globalTurn(state)] : [];
}

export function targetFor(state, level = state.level) {
  return state.tuning.targets[level];
}

export function turnsLeft(state) {
  return state.tuning.turnsPerLevel - state.turn;
}

// Place the offered piece at `offerIndex` onto `tileIndex`, replacing whatever
// is there. The last turn of a level judges the board on the spot.
export function place(state, offerIndex, tileIndex) {
  if (state.status !== 'playing') throw new Error(`cannot place while ${state.status}`);
  const offer = currentOffer(state);
  const id = offer[offerIndex];
  if (!id) throw new Error(`no offer #${offerIndex}`);
  if (tileIndex < 0 || tileIndex >= state.board.length) throw new Error(`no tile #${tileIndex}`);
  state.board[tileIndex] = id;
  state.turn += 1;
  if (state.turn === state.tuning.turnsPerLevel) judgeLevel(state);
  return state;
}

function judgeLevel(state) {
  const score = scoreBoard(state.board, state.terrain, state.tuning).total;
  const target = targetFor(state);
  const passed = score >= target;
  state.results.push({ level: state.level, score, target, passed });
  if (!passed) state.status = 'lost';
  else if (state.level === state.tuning.levels - 1) state.status = 'won';
  else state.status = 'levelEnd';
}

// After a passed level: the next one, on the board exactly as it was left.
export function nextLevel(state) {
  if (state.status !== 'levelEnd') throw new Error(`no next level while ${state.status}`);
  state.level += 1;
  state.turn = 0;
  state.status = 'playing';
  return state;
}
