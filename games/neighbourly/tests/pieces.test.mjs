// Every piece scores what its card says, played out on a board built for it.
// One test per piece, named after its card, so a rule edited in
// src/data/pieces.js without its words in src/text.js (or the other way
// round) fails here by name.
//
// Filler is Basic, which has no term and no aura, so a board's other pieces
// only ever matter by being there.

import test from 'node:test';
import assert from 'node:assert/strict';
import { PIECES } from '../src/data/pieces.js';
import { PIECE_TEXT } from '../src/text.js';
import { board, full, scoreAt } from './board.mjs';

const covered = new Set();
const piece = (id, fn) => {
  covered.add(id);
  test(`${PIECE_TEXT[id].name}: ${PIECE_TEXT[id].rule}`, fn);
};

// --- base ---

piece('basic', () => {
  assert.equal(scoreAt(board([[2, 2, 'basic']]), 2, 2), 2);
  assert.equal(scoreAt(full('basic'), 2, 2), 2);
});

piece('cluster', () => {
  const b = board([[2, 2, 'cluster'], [1, 2, 'basic'], [3, 2, 'basic'], [2, 1, 'basic'], [3, 3, 'basic']]);
  assert.equal(scoreAt(b, 2, 2), 3); // (3,3) is diagonal and doesn't count
});

piece('open', () => {
  assert.equal(scoreAt(board([[2, 2, 'open']]), 2, 2), 4);
  assert.equal(scoreAt(board([[2, 2, 'open'], [1, 2, 'basic']]), 2, 2), 3);
  assert.equal(scoreAt(full('basic', [[2, 2, 'open']]), 2, 2), 0);
});

piece('slant', () => {
  assert.equal(scoreAt(board([[2, 2, 'slant'], [1, 2, 'basic']]), 2, 2), 1); // orthogonal: nothing
  assert.equal(scoreAt(board([[2, 2, 'slant'], [1, 1, 'basic'], [3, 3, 'basic']]), 2, 2), 5);
  assert.equal(scoreAt(full('basic', [[0, 0, 'slant']]), 0, 0), 3); // a corner has one diagonal
});

piece('core', () => {
  assert.equal(scoreAt(board([[2, 2, 'core']]), 2, 2), 4);
  assert.equal(scoreAt(board([[0, 3, 'core']]), 0, 3), 1);
  assert.equal(scoreAt(board([[5, 5, 'core']]), 5, 5), 1);
});

piece('row', () => {
  const b = board([[0, 2, 'row'], [3, 2, 'basic'], [5, 2, 'basic'], [0, 4, 'basic']]);
  assert.equal(scoreAt(b, 0, 2), 2);
  assert.equal(scoreAt(full('basic', [[3, 3, 'row']]), 3, 3), 5);
});

piece('column', () => {
  const b = board([[3, 0, 'column'], [3, 2, 'basic'], [3, 5, 'basic'], [3, 4, 'basic'], [0, 0, 'basic']]);
  assert.equal(scoreAt(b, 3, 0), 3);
});

piece('pair', () => {
  assert.equal(scoreAt(board([[2, 2, 'pair']]), 2, 2), 2);
  assert.equal(scoreAt(board([[2, 2, 'pair'], [2, 3, 'basic']]), 2, 2), 6);
  assert.equal(scoreAt(board([[2, 2, 'pair'], [2, 3, 'basic'], [2, 1, 'basic']]), 2, 2), 2);
});

piece('edge', () => {
  assert.equal(scoreAt(board([[0, 3, 'edge']]), 0, 3), 6);
  assert.equal(scoreAt(board([[5, 5, 'edge']]), 5, 5), 6);
  assert.equal(scoreAt(board([[2, 2, 'edge']]), 2, 2), 3);
});

piece('hub', () => {
  const b = board([[2, 2, 'hub'], [1, 2, 'basic'], [3, 2, 'basic'], [3, 3, 'basic']]);
  assert.equal(scoreAt(b, 2, 2), 4);
  assert.equal(scoreAt(b, 1, 2), 1);
  assert.equal(scoreAt(b, 3, 3), 2); // diagonal: untouched
});

piece('booster', () => {
  const b = board([[2, 2, 'booster'], [1, 2, 'basic'], [3, 3, 'basic']]);
  assert.equal(scoreAt(b, 2, 2), 0);
  assert.equal(scoreAt(b, 1, 2), 4);
  assert.equal(scoreAt(b, 3, 3), 2); // diagonal: no boost
});

piece('monument', () => {
  const b = board([[0, 0, 'monument'], [5, 5, 'basic'], [5, 3, 'basic'], [3, 5, 'cluster']]);
  assert.equal(scoreAt(b, 0, 0), 6); // monument, basic, cluster
  assert.equal(scoreAt(board([[0, 0, 'monument']]), 0, 0), 2); // itself
});

// --- lines ---

piece('lane', () => {
  assert.equal(scoreAt(board([[0, 1, 'lane'], [1, 1, 'basic'], [2, 1, 'basic'], [3, 1, 'basic'], [4, 1, 'basic']]), 0, 1), 2);
  assert.equal(scoreAt(board([[0, 1, 'lane'], [1, 1, 'basic'], [2, 1, 'basic'], [3, 1, 'basic'], [4, 1, 'basic'], [5, 1, 'basic']]), 0, 1), 8);
  // A full column is not a full row.
  assert.equal(scoreAt(full('basic', [[0, 1, 'lane'], [3, 1, null]]), 0, 1), 2);
});

piece('pillar', () => {
  const col = [0, 1, 2, 3, 4, 5].map((y) => [2, y, 'basic']);
  col[3] = [2, 3, 'pillar'];
  assert.equal(scoreAt(board(col), 2, 3), 8);
  assert.equal(scoreAt(board(col.filter(([, y]) => y !== 0)), 2, 3), 2);
});

piece('beacon', () => {
  const b = board([[0, 2, 'beacon'], [5, 2, 'basic'], [3, 2, 'basic'], [0, 3, 'basic'], [1, 3, 'basic']]);
  assert.equal(scoreAt(b, 0, 2), 0);
  assert.equal(scoreAt(b, 5, 2), 3); // across the row, however far
  assert.equal(scoreAt(b, 3, 2), 3);
  assert.equal(scoreAt(b, 0, 3), 2); // below it: not its row
});

piece('spire', () => {
  const b = board([[2, 0, 'spire'], [2, 5, 'basic'], [3, 0, 'basic']]);
  assert.equal(scoreAt(b, 2, 0), 0);
  assert.equal(scoreAt(b, 2, 5), 3);
  assert.equal(scoreAt(b, 3, 0), 2); // beside it: not its column
});

piece('cross', () => {
  const b = board([[2, 2, 'cross'], [0, 2, 'basic'], [5, 2, 'basic'], [2, 0, 'basic'], [3, 3, 'basic']]);
  assert.equal(scoreAt(b, 2, 2), 3);
  assert.equal(scoreAt(full('basic', [[2, 2, 'cross']]), 2, 2), 10);
});

piece('crossroads', () => {
  const b = board([[2, 2, 'crossroads'], [5, 2, 'basic'], [2, 5, 'basic'], [3, 3, 'basic']]);
  assert.equal(scoreAt(b, 2, 2), 0);
  assert.equal(scoreAt(b, 5, 2), 3);
  assert.equal(scoreAt(b, 2, 5), 3);
  assert.equal(scoreAt(b, 3, 3), 2);
});

// --- kin ---

piece('flock', () => {
  const b = board([[2, 2, 'flock'], [1, 2, 'flock'], [3, 2, 'basic'], [2, 1, 'flock'], [3, 3, 'flock']]);
  assert.equal(scoreAt(b, 2, 2), 5); // two flocks beside it; the diagonal one doesn't count
});

piece('loner', () => {
  assert.equal(scoreAt(board([[2, 2, 'loner'], [3, 2, 'basic']]), 2, 2), 6);
  const two = board([[0, 0, 'loner'], [5, 5, 'loner']]);
  assert.equal(scoreAt(two, 0, 0), 1); // anywhere on the board
});

piece('echo', () => {
  assert.equal(scoreAt(board([[0, 0, 'echo']]), 0, 0), 1);
  const three = board([[0, 0, 'echo'], [5, 5, 'echo'], [3, 2, 'echo'], [1, 1, 'basic']]);
  assert.equal(scoreAt(three, 0, 0), 5);
});

piece('mosaic', () => {
  const b = board([[2, 2, 'mosaic'], [1, 2, 'basic'], [3, 2, 'basic'], [2, 1, 'edge'], [2, 3, 'hub']]);
  // basic, edge, hub: three kinds; the hub's aura costs it 1.
  assert.equal(scoreAt(b, 2, 2), 5);
  assert.equal(scoreAt(board([[2, 2, 'mosaic'], [1, 2, 'mosaic']]), 2, 2), 2); // its own kind counts as a kind
});

piece('twins', () => {
  assert.equal(scoreAt(board([[2, 2, 'twins']]), 2, 2), 3);
  assert.equal(scoreAt(board([[2, 2, 'twins'], [2, 3, 'twins'], [1, 2, 'basic']]), 2, 2), 9);
  assert.equal(scoreAt(board([[2, 2, 'twins'], [2, 3, 'twins'], [2, 1, 'twins']]), 2, 2), 3);
});

piece('crowd', () => {
  const b = board([[0, 0, 'crowd'], [1, 0, 'basic'], [2, 0, 'basic'], [3, 0, 'basic'], [4, 0, 'edge'], [5, 0, 'edge']]);
  assert.equal(scoreAt(b, 0, 0), 3); // three basics
  assert.equal(scoreAt(full('crowd'), 0, 0), 36); // itself included
});

// --- space ---

piece('hermit', () => {
  assert.equal(scoreAt(board([[2, 2, 'hermit']]), 2, 2), 9);
  assert.equal(scoreAt(board([[0, 0, 'hermit'], [1, 0, 'basic']]), 0, 0), 3);
  assert.equal(scoreAt(full('basic', [[2, 2, 'hermit']]), 2, 2), 1);
});

piece('corner', () => {
  for (const [x, y] of [[0, 0], [5, 0], [0, 5], [5, 5]]) assert.equal(scoreAt(board([[x, y, 'corner']]), x, y), 8);
  assert.equal(scoreAt(board([[0, 2, 'corner']]), 0, 2), 2);
});

piece('island', () => {
  assert.equal(scoreAt(board([[2, 2, 'island'], [3, 3, 'basic']]), 2, 2), 7);
  assert.equal(scoreAt(board([[2, 2, 'island'], [2, 3, 'basic']]), 2, 2), 0);
});

piece('frontier', () => {
  assert.equal(scoreAt(board([[2, 2, 'frontier']]), 2, 2), 11);
  assert.equal(scoreAt(board([[2, 2, 'frontier'], [0, 2, 'basic'], [2, 5, 'basic'], [4, 4, 'basic']]), 2, 2), 9);
});

piece('void', () => {
  assert.equal(scoreAt(board([[0, 0, 'void']]), 0, 0), 11); // 35 empty: 11 whole threes
  assert.equal(scoreAt(full('basic', [[0, 0, 'void'], [1, 1, null], [2, 2, null]]), 0, 0), 0);
  assert.equal(scoreAt(full('basic', [[0, 0, 'void'], [1, 1, null], [2, 2, null], [3, 3, null]]), 0, 0), 1);
});

piece('clearing', () => {
  assert.equal(scoreAt(board([[2, 2, 'clearing']]), 2, 2), 24);
  assert.equal(scoreAt(board([[0, 0, 'clearing']]), 0, 0), 9);
  assert.equal(scoreAt(board([[2, 2, 'clearing'], [3, 3, 'basic'], [2, 1, 'basic']]), 2, 2), 18);
});

test('every piece in the data has a test above', () => {
  const missing = PIECES.map((p) => p.id).filter((id) => !covered.has(id));
  assert.deepEqual(missing, []);
});
