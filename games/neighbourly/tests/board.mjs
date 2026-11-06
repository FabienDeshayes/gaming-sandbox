// Shared by the pure suites: build a board from [x, y, id] entries and read
// scores back off it, on the real tuning.

import { DEFAULT_TUNING } from '../src/data/tuning.js';
import { scoreBoard } from '../src/core/rules.js';

export const T = DEFAULT_TUNING;
export const tile = (x, y) => y * T.cols + x;
export const empty = () => new Array(T.cols * T.rows).fill(null);

export function board(entries) {
  const b = empty();
  for (const [x, y, id] of entries) b[tile(x, y)] = id;
  return b;
}

// A board with every tile filled with `id`, then the entries on top.
export function full(id, entries = []) {
  const b = empty().fill(id);
  for (const [x, y, e] of entries) b[tile(x, y)] = e;
  return b;
}

export const scoreAt = (b, x, y) => scoreBoard(b, T).tiles[tile(x, y)].score;
export const total = (b) => scoreBoard(b, T).total;
