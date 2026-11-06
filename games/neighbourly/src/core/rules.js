// The whole game as pure functions: no Phaser, no scene state. The scene, the
// simulator and the tests all go through these, so the score a tap previews
// and the score a level is judged on are the same code.
//
// A board is a flat array, `cols * rows` long, of piece ids or null, read row
// by row from the top left. Every tile is the same; a piece scores from what is
// around it.

import { CORE_SETS, SPECIAL_SETS, pieceDef, piecesIn } from '../data/catalogue.js';
import { DEFAULT_TUNING } from '../data/tuning.js';

// --- Board geometry -----------------------------------------------------------

const xy = (index, tuning) => [index % tuning.cols, Math.floor(index / tuning.cols)];

function around(index, tuning, steps) {
  const [x, y] = xy(index, tuning);
  const out = [];
  for (const [dx, dy] of steps) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < tuning.cols && ny < tuning.rows) out.push(ny * tuning.cols + nx);
  }
  return out;
}

const ORTHOGONAL = [[0, -1], [0, 1], [-1, 0], [1, 0]];
const DIAGONAL = [[-1, -1], [1, -1], [-1, 1], [1, 1]];

// The four orthogonal neighbours: what "adjacent" means everywhere.
export const neighbours = (index, tuning) => around(index, tuning, ORTHOGONAL);
export const diagonals = (index, tuning) => around(index, tuning, DIAGONAL);

// Every other tile in the same row / column as `index`.
export function rowOf(index, tuning) {
  const [, y] = xy(index, tuning);
  const out = [];
  for (let x = 0; x < tuning.cols; x++) if (y * tuning.cols + x !== index) out.push(y * tuning.cols + x);
  return out;
}
export function columnOf(index, tuning) {
  const [x] = xy(index, tuning);
  const out = [];
  for (let y = 0; y < tuning.rows; y++) if (y * tuning.cols + x !== index) out.push(y * tuning.cols + x);
  return out;
}

export function onEdge(index, tuning) {
  const [x, y] = xy(index, tuning);
  return x === 0 || y === 0 || x === tuning.cols - 1 || y === tuning.rows - 1;
}

export function inCorner(index, tuning) {
  const [x, y] = xy(index, tuning);
  return (x === 0 || x === tuning.cols - 1) && (y === 0 || y === tuning.rows - 1);
}

// --- Scoring ------------------------------------------------------------------

// The vocabulary pieces are written in (src/data/pieces.js). Each count says how
// many of something there are for the piece at `i`; each condition whether it
// holds; each reach which tiles an aura lands on. A new piece that recombines
// these is data; a new word here is a new line in each table plus its read-out
// in SUM (src/text.js).
const filled = (b, list) => list.filter((j) => b[j]).length;
const empty = (b, list) => list.filter((j) => !b[j]).length;

export const COUNTS = {
  adjacentPieces: (i, b, t) => filled(b, neighbours(i, t)),
  diagonalPieces: (i, b, t) => filled(b, diagonals(i, t)),
  adjacentEmpty: (i, b, t) => empty(b, neighbours(i, t)),
  surroundingEmpty: (i, b, t) => empty(b, [...neighbours(i, t), ...diagonals(i, t)]),
  adjacentSame: (i, b, t) => neighbours(i, t).filter((j) => b[j] === b[i]).length,
  adjacentKinds: (i, b, t) => new Set(neighbours(i, t).map((j) => b[j]).filter(Boolean)).size,
  rowPieces: (i, b, t) => filled(b, rowOf(i, t)),
  columnPieces: (i, b, t) => filled(b, columnOf(i, t)),
  linePieces: (i, b, t) => filled(b, [...rowOf(i, t), ...columnOf(i, t)]),
  lineEmpty: (i, b, t) => empty(b, [...rowOf(i, t), ...columnOf(i, t)]),
  copies: (i, b) => b.filter((id, j) => j !== i && id === b[i]).length,
  distinctTypes: (i, b) => new Set(b.filter(Boolean)).size,
  largestKind: (i, b) => {
    const n = new Map();
    for (const id of b) if (id) n.set(id, (n.get(id) || 0) + 1);
    return Math.max(0, ...n.values());
  },
  emptyTiles: (i, b) => b.filter((id) => !id).length,
};

export const CONDITIONS = {
  onEdge: (i, b, t) => onEdge(i, t),
  inCentre: (i, b, t) => !onEdge(i, t),
  inCorner: (i, b, t) => inCorner(i, t),
  adjacentPiecesEquals: (i, b, t, term) => COUNTS.adjacentPieces(i, b, t) === term.equals,
  adjacentSameEquals: (i, b, t, term) => COUNTS.adjacentSame(i, b, t) === term.equals,
  copiesEquals: (i, b, t, term) => COUNTS.copies(i, b, t) === term.equals,
  rowFull: (i, b, t) => empty(b, rowOf(i, t)) === 0,
  columnFull: (i, b, t) => empty(b, columnOf(i, t)) === 0,
};

export const REACHES = {
  adjacent: (i, t) => neighbours(i, t),
  diagonal: (i, t) => diagonals(i, t),
  row: (i, t) => rowOf(i, t),
  column: (i, t) => columnOf(i, t),
  lines: (i, t) => [...rowOf(i, t), ...columnOf(i, t)],
};

// What one term of a piece's rule is worth where it stands.
function termValue(term, index, board, tuning) {
  if (term.count) {
    const count = COUNTS[term.count];
    if (!count) throw new Error(`unknown count "${term.count}"`);
    const raw = count(index, board, tuning);
    const n = term.per ? Math.floor(raw / term.per) : raw;
    return { n: raw, value: n * term.each };
  }
  const cond = CONDITIONS[term.when];
  if (!cond) throw new Error(`unknown condition "${term.when}"`);
  const holds = cond(index, board, tuning, term);
  return { holds, value: holds ? term.add : 0 };
}

// For every tile, the auras that land on it: [{ from, value }]. A piece never
// reaches itself.
function aurasOn(board, tuning) {
  const on = board.map(() => []);
  board.forEach((id, i) => {
    if (!id) return;
    const { aura } = pieceDef(id);
    if (!aura) return;
    const reach = REACHES[aura.reach];
    if (!reach) throw new Error(`unknown reach "${aura.reach}"`);
    for (const j of reach(i, tuning)) on[j].push({ from: id, value: aura.amount });
  });
  return on;
}

// One tile's score and how it was reached: `parts` is the breakdown the info
// panel reads out (base, each term, each aura that reaches it), `raw` the sum
// before the floor at 0, `score` what it counts for.
function scoreOne(index, board, tuning, auras) {
  const id = board[index];
  if (!id) return null;
  const def = pieceDef(id);
  const parts = [{ kind: 'base', value: def.base }];
  for (const term of def.terms) parts.push({ kind: 'term', term, ...termValue(term, index, board, tuning) });
  for (const a of auras[index]) parts.push({ kind: 'aura', from: a.from, value: a.value });
  const raw = parts.reduce((s, p) => s + p.value, 0);
  return { id, parts, raw, score: Math.max(0, raw) };
}

export function scoreTile(index, board, tuning) {
  return scoreOne(index, board, tuning, aurasOn(board, tuning));
}

// The board's score: the sum of every piece's. Pure in the board.
export function scoreBoard(board, tuning) {
  const auras = aurasOn(board, tuning);
  const tiles = board.map((_, i) => scoreOne(i, board, tuning, auras));
  const total = tiles.reduce((s, t) => s + (t ? t.score : 0), 0);
  return { total, tiles };
}

// What placing `id` on `index` would do, without doing it.
export function previewPlacement(state, id, index) {
  const before = scoreBoard(state.board, state.tuning);
  const next = state.board.slice();
  next[index] = id;
  const after = scoreBoard(next, state.tuning);
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

// --- Sets and offers ----------------------------------------------------------

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

// The sets a run plays: every core set, then `specialSets` special ones drawn
// from the seed (or the ones asked for by id). Its own stream, so which special
// set a seed gets doesn't move when the offer script's length does.
export function setsFor(seed, tuning, special = null) {
  if (special) {
    for (const id of special) if (!SPECIAL_SETS.includes(id)) throw new Error(`no special set "${id}"`);
    return [...CORE_SETS, ...special];
  }
  const next = rng(seed ^ 0x5e75);
  const pool = SPECIAL_SETS.slice();
  const picked = [];
  for (let k = 0; k < tuning.specialSets && pool.length; k++) picked.push(pool.splice(Math.floor(next() * pool.length), 1)[0]);
  return [...CORE_SETS, ...picked];
}

export function poolFor(sets) {
  return sets.flatMap(piecesIn);
}

// The whole run's offers, decided before the first turn: `levels *
// turnsPerLevel` offers of `offerSize` distinct pieces, every piece in the pool
// equally likely. No odds, no pool depletion yet.
export function offerScript(seed, tuning, pool) {
  const next = rng(seed);
  const script = [];
  for (let t = 0; t < tuning.levels * tuning.turnsPerLevel; t++) {
    const left = pool.slice();
    const offer = [];
    for (let k = 0; k < tuning.offerSize; k++) offer.push(left.splice(Math.floor(next() * left.length), 1)[0]);
    script.push(offer);
  }
  return script;
}

// --- A run --------------------------------------------------------------------

// status: 'playing' | 'levelEnd' (a level was just passed, waiting for NEXT)
//       | 'won' | 'lost'
export function createRun({ seed, tuning = DEFAULT_TUNING, special = null } = {}) {
  const s = seed ?? tuning.offerSeed;
  const sets = setsFor(s, tuning, special);
  const pool = poolFor(sets);
  return {
    tuning,
    seed: s,
    sets,
    pool,
    board: new Array(tuning.cols * tuning.rows).fill(null),
    script: offerScript(s, tuning, pool),
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
  const score = scoreBoard(state.board, state.tuning).total;
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
