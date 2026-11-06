// The rules every piece leans on, with no browser: how a board adds up, what a
// preview promises, which pieces a run can be offered, and a run moving through
// its levels. What each piece scores is tests/pieces.test.mjs.

import test from 'node:test';
import assert from 'node:assert/strict';
import { CORE_SETS, SPECIAL_SETS, piecesIn } from '../src/data/catalogue.js';
import { PIECES } from '../src/data/pieces.js';
import {
  COUNTS,
  CONDITIONS,
  createRun,
  currentOffer,
  nextLevel,
  offerScript,
  place,
  poolFor,
  previewPlacement,
  scoreBoard,
  setsFor,
} from '../src/core/rules.js';
import { breakdown } from '../src/ui/describe.js';
import { T, board, empty, full, scoreAt, tile, total } from './board.mjs';

// --- adding up ----------------------------------------------------------------

test('the board scores the sum of its pieces, and an empty board scores 0', () => {
  const b = board([[0, 0, 'basic'], [3, 3, 'basic'], [5, 5, 'edge']]);
  assert.equal(total(b), 2 + 2 + 6);
  assert.equal(total(empty()), 0);
});

test('auras stack, and the floor at 0 is on the final sum', () => {
  const twoBoosters = board([[2, 2, 'basic'], [1, 2, 'booster'], [3, 2, 'booster']]);
  assert.equal(scoreAt(twoBoosters, 2, 2), 6);
  const threeHubs = board([[2, 2, 'basic'], [1, 2, 'hub'], [3, 2, 'hub'], [2, 1, 'hub']]);
  const t = scoreBoard(threeHubs, T).tiles[tile(2, 2)];
  assert.equal(t.raw, -1);
  assert.equal(t.score, 0);
  // A Booster's +2 can lift a piece the Hubs pushed under 0 back over it.
  const mixed = board([[2, 2, 'basic'], [1, 2, 'hub'], [3, 2, 'hub'], [2, 1, 'hub'], [2, 3, 'booster']]);
  assert.equal(scoreAt(mixed, 2, 2), 1);
});

test('an aura never reaches the piece that gives it', () => {
  // Each Crossroads lifts the other (same row) but not itself.
  const b = board([[0, 0, 'crossroads'], [5, 0, 'crossroads']]);
  assert.equal(scoreAt(b, 0, 0), 1);
  assert.equal(total(full('beacon')), 6 * 6 * 5);
});

test('every piece scores a whole number of at least 0 on any tile of any board this test throws at it', () => {
  const ids = PIECES.map((p) => p.id);
  const boards = [empty(), full('basic'), empty().map((_, i) => ids[i % ids.length]), empty().map((_, i) => (i % 3 ? ids[(i * 7) % ids.length] : null))];
  for (const p of PIECES)
    for (const b0 of boards)
      for (let i = 0; i < b0.length; i++) {
        const b = b0.slice();
        b[i] = p.id;
        const t = scoreBoard(b, T).tiles[i];
        assert.ok(Number.isInteger(t.score) && t.score >= 0, `${p.id} on ${i}`);
      }
});

test('every word a piece is written in is one the rules know', () => {
  for (const p of PIECES) {
    for (const term of p.terms) {
      if (term.count) assert.ok(COUNTS[term.count], `${p.id}: count ${term.count}`);
      else assert.ok(CONDITIONS[term.when], `${p.id}: condition ${term.when}`);
    }
  }
});

// --- the preview ----------------------------------------------------------------

test('the preview is exactly what placing does, replacements included', () => {
  const s = createRun();
  for (let turn = 0; turn < 40; turn++) {
    const k = turn % 3;
    const id = currentOffer(s)[k];
    const at = (turn * 7) % s.board.length; // wraps, so the later turns replace
    const p = previewPlacement(s, id, at);
    const before = scoreBoard(s.board, T);
    assert.equal(before.total, p.before);
    place(s, k, at);
    const after = scoreBoard(s.board, T);
    assert.equal(after.total, p.after);
    // ...and the tiles it says move are exactly the ones that do.
    const moved = after.tiles.map((t, i) => i).filter((i) => (after.tiles[i]?.score ?? 0) !== (before.tiles[i]?.score ?? 0));
    assert.deepEqual(p.changes.filter((c) => c.from !== c.to).map((c) => c.i), moved);
    if (s.status === 'levelEnd') nextLevel(s);
    if (s.status !== 'playing') break;
  }
});

// --- sets and offers ------------------------------------------------------------

test('a run plays the base set plus one special set drawn from its seed', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 60; seed++) {
    const sets = setsFor(seed, T);
    assert.deepEqual(sets.slice(0, CORE_SETS.length), CORE_SETS);
    assert.equal(sets.length, CORE_SETS.length + T.specialSets);
    assert.ok(SPECIAL_SETS.includes(sets[sets.length - 1]));
    seen.add(sets[sets.length - 1]);
    assert.deepEqual(setsFor(seed, T), sets, 'the same seed draws the same sets');
  }
  assert.deepEqual([...seen].sort(), SPECIAL_SETS.slice().sort(), 'every special set comes up');
});

test('a special set can be asked for by id, and an unknown one is refused', () => {
  for (const id of SPECIAL_SETS) assert.deepEqual(createRun({ special: [id] }).sets, [...CORE_SETS, id]);
  assert.throws(() => setsFor(1, T, ['base']));
  assert.throws(() => setsFor(1, T, ['nope']));
});

test('the offer script only ever offers the run\'s own pieces, three distinct a turn, the same every time', () => {
  for (const id of SPECIAL_SETS) {
    const s = createRun({ special: [id] });
    const pool = new Set([...piecesIn('base'), ...piecesIn(id)]);
    assert.deepEqual(new Set(s.pool), pool);
    assert.equal(s.script.length, T.levels * T.turnsPerLevel);
    for (const offer of s.script) {
      assert.equal(offer.length, T.offerSize);
      assert.equal(new Set(offer).size, T.offerSize);
      for (const p of offer) assert.ok(pool.has(p), `${p} offered in a ${id} run`);
    }
  }
  const pool = poolFor(setsFor(T.offerSeed, T));
  assert.deepEqual(offerScript(T.offerSeed, T, pool), createRun().script);
  assert.notDeepEqual(offerScript(T.offerSeed + 1, T, pool), createRun().script);
});

// --- a run ----------------------------------------------------------------------

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

test('missing a target ends the run; clearing the fifth level wins it', () => {
  const lose = createRun({ tuning: withTargets(T.targets.map(() => 9999)) });
  for (let k = 0; k < T.turnsPerLevel; k++) place(lose, 0, k);
  assert.equal(lose.status, 'lost');
  assert.throws(() => nextLevel(lose));

  assert.equal(T.levels, 5);
  const win = createRun({ tuning: withTargets(T.targets.map(() => 0)) });
  for (let l = 0; l < T.levels; l++) {
    for (let k = 0; k < T.turnsPerLevel; k++) place(win, 0, (l * T.turnsPerLevel + k) % win.board.length);
    if (l < T.levels - 1) nextLevel(win);
  }
  assert.equal(win.status, 'won');
  assert.equal(win.results.length, T.levels);
});

test('there is a target for every level, and they rise', () => {
  assert.equal(T.targets.length, T.levels);
  for (let l = 1; l < T.levels; l++) assert.ok(T.targets[l] > T.targets[l - 1]);
});

// --- the read-out -----------------------------------------------------------------

test('the info panel reads a tile out as a sum that adds up', () => {
  const b = board([[2, 2, 'cluster'], [1, 2, 'booster'], [3, 2, 'basic']]);
  assert.equal(breakdown(scoreBoard(b, T).tiles[tile(2, 2)]), '4: 0 base, +2 for 2 neighbours, +2 Booster');
  const hubs = board([[2, 2, 'basic'], [1, 2, 'hub'], [3, 2, 'hub'], [2, 1, 'hub']]);
  assert.equal(breakdown(scoreBoard(hubs, T).tiles[tile(2, 2)]), '0: 2 base, -1 Hub, -1 Hub, -1 Hub (never below 0)');
});

test('every piece reads out a sum whose numbers add up to its score', () => {
  const ids = PIECES.map((p) => p.id);
  const b0 = empty().map((_, i) => (i % 4 ? ids[(i * 5) % ids.length] : null));
  for (const p of PIECES)
    for (let i = 0; i < b0.length; i++) {
      const b = b0.slice();
      b[i] = p.id;
      const t = scoreBoard(b, T).tiles[i];
      const said = breakdown(t);
      assert.ok(!said.includes('undefined'), `${p.id}: ${said}`);
      // Everything after "n: " is the parts; their signed numbers sum to raw.
      const nums = said
        .slice(said.indexOf(':') + 2)
        .replace(/ \(never below 0\)$/, '')
        .split(', ')
        .map((bit) => Number(bit.match(/^[+-]?\d+/)[0]));
      assert.equal(nums.reduce((a, x) => a + x, 0), t.raw, `${p.id} on ${i}: ${said}`);
    }
});
