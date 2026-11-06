// The rules, with no browser: every piece scores what DESIGN.md says it does,
// the floor at 0, the fixed offer script, and a run moving through its levels.
//
// Boards are built on the real terrain map, so a test that needs water or rock
// names a tile from `tile(x, y)` and says what it stands on.

import test from 'node:test';
import assert from 'node:assert/strict';
import { PIECES } from '../src/data/pieces.js';
import { DEFAULT_TUNING } from '../src/data/tuning.js';
import {
  createRun,
  currentOffer,
  nextLevel,
  offerScript,
  place,
  previewPlacement,
  scoreBoard,
  terrainOf,
} from '../src/core/rules.js';
import { breakdown } from '../src/ui/describe.js';

const T = DEFAULT_TUNING;
const TERRAIN = terrainOf(T);
const tile = (x, y) => y * T.cols + x;
const empty = () => new Array(T.cols * T.rows).fill(null);

function board(entries) {
  const b = empty();
  for (const [x, y, id] of entries) b[tile(x, y)] = id;
  return b;
}
const scoreAt = (b, x, y) => scoreBoard(b, TERRAIN, T).tiles[tile(x, y)].score;
const total = (b) => scoreBoard(b, TERRAIN, T).total;

// Tiles the tests stand on, checked against the map so a terrain edit fails here
// rather than quietly testing something else.
test('the map has the tiles these tests rely on', () => {
  assert.equal(TERRAIN.length, T.cols * T.rows);
  assert.equal(TERRAIN[tile(1, 0)], 'water');
  assert.equal(TERRAIN[tile(2, 0)], 'water');
  assert.equal(TERRAIN[tile(1, 1)], 'water');
  assert.equal(TERRAIN[tile(4, 1)], 'rock');
  assert.equal(TERRAIN[tile(2, 2)], 'grass');
  assert.equal(TERRAIN[tile(3, 3)], 'grass');
});

test('Basic scores 2', () => {
  assert.equal(scoreAt(board([[2, 2, 'basic']]), 2, 2), 2);
});

test('Cluster scores 1 per adjacent piece', () => {
  const b = board([[2, 2, 'cluster'], [1, 2, 'basic'], [3, 2, 'basic'], [2, 1, 'basic'], [3, 3, 'basic']]);
  assert.equal(scoreAt(b, 2, 2), 3); // (3,3) is diagonal and doesn't count
});

test('Open scores 4 minus 1 per neighbour, never below 0', () => {
  assert.equal(scoreAt(board([[2, 2, 'open']]), 2, 2), 4);
  assert.equal(scoreAt(board([[2, 2, 'open'], [1, 2, 'basic']]), 2, 2), 3);
  const full = board([[2, 2, 'open'], [1, 2, 'basic'], [3, 2, 'basic'], [2, 1, 'basic'], [2, 3, 'basic']]);
  assert.equal(scoreAt(full, 2, 2), 0);
});

test('Shore scores 1 plus 2 per adjacent water tile, even standing in water', () => {
  assert.equal(scoreAt(board([[3, 3, 'shore']]), 3, 3), 1);
  // (1,0) is water itself; next to it (2,0) and (1,1) are water, (0,0) grass.
  assert.equal(scoreAt(board([[1, 0, 'shore']]), 1, 0), 5);
  // A piece on a water tile doesn't stop it being water.
  assert.equal(scoreAt(board([[1, 0, 'shore'], [2, 0, 'basic']]), 1, 0), 5);
});

test('Ridge scores 1, plus 3 on rock', () => {
  assert.equal(scoreAt(board([[4, 1, 'ridge']]), 4, 1), 4);
  assert.equal(scoreAt(board([[2, 2, 'ridge']]), 2, 2), 1);
});

test('Row and Column count the other pieces in their line', () => {
  const b = board([[0, 2, 'row'], [3, 2, 'basic'], [5, 2, 'basic'], [0, 4, 'basic']]);
  assert.equal(scoreAt(b, 0, 2), 2);
  const c = board([[3, 0, 'column'], [3, 2, 'basic'], [3, 5, 'basic'], [3, 4, 'basic'], [0, 0, 'basic']]);
  assert.equal(scoreAt(c, 3, 0), 3);
});

test('Pair scores 2, plus 4 with exactly one neighbour', () => {
  assert.equal(scoreAt(board([[2, 2, 'pair']]), 2, 2), 2);
  assert.equal(scoreAt(board([[2, 2, 'pair'], [2, 3, 'basic']]), 2, 2), 6);
  assert.equal(scoreAt(board([[2, 2, 'pair'], [2, 3, 'basic'], [2, 1, 'basic']]), 2, 2), 2);
});

test('Edge scores 3, plus 3 on the board edge', () => {
  assert.equal(scoreAt(board([[0, 3, 'edge']]), 0, 3), 6);
  assert.equal(scoreAt(board([[5, 5, 'edge']]), 5, 5), 6);
  assert.equal(scoreAt(board([[2, 2, 'edge']]), 2, 2), 3);
});

test('Hub scores 2 per neighbour and costs each neighbour 1', () => {
  const b = board([[2, 2, 'hub'], [1, 2, 'basic'], [3, 2, 'basic']]);
  assert.equal(scoreAt(b, 2, 2), 4);
  assert.equal(scoreAt(b, 1, 2), 1);
  assert.equal(total(b), 6);
});

test('Booster scores 0 and gives each neighbour 2', () => {
  const b = board([[2, 2, 'booster'], [1, 2, 'basic'], [3, 3, 'basic']]);
  assert.equal(scoreAt(b, 2, 2), 0);
  assert.equal(scoreAt(b, 1, 2), 4);
  assert.equal(scoreAt(b, 3, 3), 2); // diagonal: no boost
});

test('auras stack, and a piece is floored at 0', () => {
  const twoBoosters = board([[2, 2, 'basic'], [1, 2, 'booster'], [3, 2, 'booster']]);
  assert.equal(scoreAt(twoBoosters, 2, 2), 6);
  const threeHubs = board([[2, 2, 'basic'], [1, 2, 'hub'], [3, 2, 'hub'], [2, 1, 'hub']]);
  const t = scoreBoard(threeHubs, TERRAIN, T).tiles[tile(2, 2)];
  assert.equal(t.raw, -1);
  assert.equal(t.score, 0);
});

test('Monument scores 2 per distinct piece type, itself included', () => {
  const b = board([[0, 0, 'monument'], [5, 5, 'basic'], [5, 3, 'basic'], [3, 5, 'cluster']]);
  assert.equal(scoreAt(b, 0, 0), 6);
});

test('the board score is the sum of every piece', () => {
  const b = board([[0, 0, 'basic'], [3, 3, 'basic'], [5, 5, 'edge']]);
  assert.equal(total(b), 2 + 2 + 6);
  assert.equal(total(empty()), 0);
});

test('every piece in the set scores on any tile of a full board', () => {
  for (const p of PIECES) {
    const b = empty().map((_, i) => PIECES[i % PIECES.length].id);
    for (let i = 0; i < b.length; i++) {
      const trial = b.slice();
      trial[i] = p.id;
      const t = scoreBoard(trial, TERRAIN, T).tiles[i];
      assert.ok(Number.isInteger(t.score) && t.score >= 0, `${p.id} on ${i}`);
    }
  }
});

test('the set is twelve pieces split 5/4/2/1 by rarity', () => {
  assert.equal(PIECES.length, 12);
  const n = (r) => PIECES.filter((p) => p.rarity === r).length;
  assert.deepEqual([n('common'), n('uncommon'), n('rare'), n('legendary')], [5, 4, 2, 1]);
});

test('the offer script is fixed: one offer per turn, distinct pieces, same every run', () => {
  const a = offerScript(T.offerSeed, T);
  assert.equal(a.length, T.levels * T.turnsPerLevel);
  for (const offer of a) {
    assert.equal(offer.length, T.offerSize);
    assert.equal(new Set(offer).size, T.offerSize);
  }
  assert.deepEqual(offerScript(T.offerSeed, T), a);
  assert.notDeepEqual(offerScript(T.offerSeed + 1, T), a);
  assert.deepEqual(createRun().script, a);
});

test('placing replaces what is on the tile and spends a turn', () => {
  const s = createRun();
  const [first] = currentOffer(s);
  place(s, 0, tile(2, 2));
  assert.equal(s.board[tile(2, 2)], first);
  assert.equal(s.turn, 1);
  const second = currentOffer(s)[1];
  place(s, 1, tile(2, 2));
  assert.equal(s.board[tile(2, 2)], second);
  assert.equal(s.board.filter(Boolean).length, 1);
});

test('the preview is exactly what placing does', () => {
  const s = createRun();
  for (let turn = 0; turn < 8; turn++) {
    const id = currentOffer(s)[turn % 3];
    const at = (turn * 7) % s.board.length;
    const p = previewPlacement(s, id, at);
    const before = total(s.board);
    place(s, turn % 3, at);
    assert.equal(before, p.before);
    assert.equal(total(s.board), p.after);
  }
});

const withTargets = (targets) => ({ ...T, targets });

test('a level is judged on the board after its last turn', () => {
  const s = createRun({ tuning: withTargets(T.targets.map(() => 0)) });
  for (let k = 0; k < T.turnsPerLevel - 1; k++) place(s, 0, k);
  assert.equal(s.status, 'playing');
  place(s, 0, T.turnsPerLevel - 1);
  assert.equal(s.status, 'levelEnd');
  assert.equal(s.results[0].score, total(s.board));
  assert.throws(() => place(s, 0, 0));
});

test('the next level keeps the board and moves the target', () => {
  const s = createRun({ tuning: withTargets(T.targets.map(() => 0)) });
  for (let k = 0; k < T.turnsPerLevel; k++) place(s, 0, k);
  const kept = s.board.slice();
  nextLevel(s);
  assert.equal(s.level, 1);
  assert.equal(s.turn, 0);
  assert.deepEqual(s.board, kept);
  assert.deepEqual(currentOffer(s), s.script[T.turnsPerLevel]);
});

test('missing a target ends the run; clearing the last level wins it', () => {
  const lose = createRun({ tuning: withTargets(T.targets.map(() => 9999)) });
  for (let k = 0; k < T.turnsPerLevel; k++) place(lose, 0, k);
  assert.equal(lose.status, 'lost');
  assert.throws(() => nextLevel(lose));

  const win = createRun({ tuning: withTargets(T.targets.map(() => 0)) });
  for (let l = 0; l < T.levels; l++) {
    for (let k = 0; k < T.turnsPerLevel; k++) place(win, 0, (l * T.turnsPerLevel + k) % win.board.length);
    if (l < T.levels - 1) nextLevel(win);
  }
  assert.equal(win.status, 'won');
  assert.equal(win.results.length, T.levels);
});

test('targets rise every level', () => {
  assert.equal(T.targets.length, T.levels);
  for (let l = 1; l < T.levels; l++) assert.ok(T.targets[l] > T.targets[l - 1]);
});

test('the info panel reads a tile out as a sum', () => {
  const b = board([[1, 0, 'shore'], [0, 0, 'booster']]);
  const t = scoreBoard(b, TERRAIN, T).tiles[tile(1, 0)];
  assert.equal(breakdown(t), '7: 1 base, +4 for 2 water next to it, +2 Booster');
  const hubs = board([[2, 2, 'basic'], [1, 2, 'hub'], [3, 2, 'hub'], [2, 1, 'hub']]);
  assert.equal(
    breakdown(scoreBoard(hubs, TERRAIN, T).tiles[tile(2, 2)]),
    '0: 2 base, -1 Hub, -1 Hub, -1 Hub (never below 0)'
  );
});
