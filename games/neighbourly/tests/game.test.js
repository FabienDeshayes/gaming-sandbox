// The screen: Playwright against the real canvas. Every move a test makes is a
// tap a player could make; the choices are worked out by replaying the same
// offer script through src/core/rules.js, so nothing is hardcoded.

import { DEFAULT_TUNING } from '../src/data/tuning.js';
import { createRun, currentOffer, nextLevel, place, previewPlacement } from '../src/core/rules.js';
import { assert, assertEqual, run, test } from './harness.js';

const T = DEFAULT_TUNING;

// The best immediate gain over every offer and tile — enough to clear level 1
// on the default script (checked below before any browser test relies on it).
function greedyMove(state) {
  let best = null;
  currentOffer(state).forEach((id, o) => {
    for (let i = 0; i < state.board.length; i++) {
      const d = previewPlacement(state, id, i).delta;
      if (!best || d > best.d) best = { d, o, i };
    }
  });
  return best;
}

function greedyLevelOne() {
  const s = createRun();
  const moves = [];
  for (let k = 0; k < T.turnsPerLevel; k++) {
    const m = greedyMove(s);
    moves.push(m);
    place(s, m.o, m.i);
  }
  return { moves, state: s };
}

async function placeVia(game, offer, tile) {
  await game.tapOffer(offer);
  await game.tapTile(tile);
  await game.clickText('PLACE');
}

test('the title screen leads to level 1 with three offers', async (game) => {
  await game.startRun();
  const s = await game.state();
  assertEqual([s.level, s.turn, s.status], [0, 0, 'playing'], 'fresh run');
  assert(await game.hasText(`LEVEL 1/${T.levels}`), 'level label');
  assert(await game.hasText(`target ${T.targets[0]}`), 'target label');
  const offer = currentOffer(createRun());
  for (const id of offer) {
    const name = id[0].toUpperCase() + id.slice(1);
    assert(await game.hasText(name), `offer card for ${name}`);
  }
});

test('picking a piece and tapping a tile previews the score change, PLACE commits it', async (game) => {
  await game.startRun();
  const fresh = createRun();
  const tile = 14;
  const expect = previewPlacement(fresh, currentOffer(fresh)[1], tile);
  await game.tapOffer(1);
  await game.tapTile(tile);
  let s = await game.state();
  assertEqual(s.board.filter(Boolean).length, 0, 'a preview places nothing');
  assert(s.info[0].endsWith(`+${expect.delta}`), `preview title says +${expect.delta}: ${s.info[0]}`);
  assert(s.info[1].startsWith(`Board ${expect.before} → ${expect.after}`), `preview body: ${s.info[1]}`);
  await game.clickText('PLACE');
  s = await game.state();
  assertEqual(s.board[tile], currentOffer(fresh)[1], 'placed the picked piece');
  assertEqual(s.turn, 1, 'a turn was spent');
  assertEqual([s.selOffer, s.selTile], [null, null], 'selection cleared');
  assertEqual(s.score, `SCORE ${expect.after}`, 'header score');
});

test('a preview marks every tile whose score would move', async (game) => {
  await game.startRun();
  // Put down a piece, then preview a second one next to it.
  const s0 = createRun();
  place(s0, 0, 14);
  await placeVia(game, 0, 14);
  const pick = currentOffer(s0).findIndex(Boolean);
  const p = previewPlacement(s0, currentOffer(s0)[pick], 15);
  await game.tapOffer(pick);
  await game.tapTile(15);
  const s = await game.state();
  for (const c of p.changes) {
    const d = c.to - c.from;
    if (d !== 0) assertEqual(s.deltas[c.i], d > 0 ? `+${d}` : `${d}`, `delta on tile ${c.i}`);
  }
  const marked = s.deltas.filter(Boolean).length;
  assertEqual(marked, p.changes.filter((c) => c.to !== c.from).length, 'no other tile marked');
});

test('PLACE does nothing without both a piece and a tile', async (game) => {
  await game.startRun();
  await game.clickText('PLACE');
  await game.tapOffer(0);
  await game.clickText('PLACE');
  const s = await game.state();
  assertEqual(s.turn, 0, 'no turn spent');
  assertEqual(s.board.filter(Boolean).length, 0, 'nothing placed');
});

test('tapping a placed piece with nothing picked explains its score', async (game) => {
  await game.startRun();
  await placeVia(game, 0, 0);
  await game.tapTile(0);
  const s = await game.state();
  const name = s.board[0][0].toUpperCase() + s.board[0].slice(1);
  assert(s.info[0].startsWith(name), `inspects the piece: ${s.info[0]}`);
  assert(s.info[1].startsWith('Scores '), `reads out its score: ${s.info[1]}`);
});

test('clearing level 1 keeps the board for level 2', async (game) => {
  const { moves, state: expected } = greedyLevelOne();
  assert(expected.status === 'levelEnd', 'the greedy line clears level 1 on the default script');
  await game.startRun();
  for (const m of moves) await placeVia(game, m.o, m.i);
  let s = await game.state();
  assertEqual(s.status, 'levelEnd', 'level judged');
  assert(s.overlay, 'result panel open');
  assert(await game.hasText('LEVEL 1 CLEARED'), 'cleared banner');
  // The board can't be touched under the result panel.
  await game.tapTile(35);
  assertEqual((await game.state()).selTile, null, 'board blocked by the panel');
  await game.clickText('NEXT LEVEL');
  s = await game.state();
  assertEqual([s.level, s.turn, s.status, s.overlay], [1, 0, 'playing', false], 'level 2 started');
  assertEqual(s.board, expected.board, 'board carried over');
  assert(await game.hasText(`target ${T.targets[1]}`), 'level 2 target shown');
});

test('missing the target ends the run, and PLAY AGAIN starts over', async (game) => {
  // Stacking every piece onto one tile leaves one piece on the board.
  const s0 = createRun();
  for (let k = 0; k < T.turnsPerLevel; k++) place(s0, 0, 0);
  assert(s0.status === 'lost', 'one piece cannot reach the first target');
  await game.startRun();
  for (let k = 0; k < T.turnsPerLevel; k++) await placeVia(game, 0, 0);
  let s = await game.state();
  assertEqual(s.status, 'lost', 'run lost');
  assert(await game.hasText('RUN OVER'), 'lost banner');
  await game.clickText('PLAY AGAIN');
  await game.waitForScene('PlayScene');
  s = await game.state();
  assertEqual([s.level, s.turn, s.status, s.board.filter(Boolean).length], [0, 0, 'playing', 0], 'fresh run');
});

test('SET lists every piece and its rule, and blocks the board while open', async (game) => {
  await game.startRun();
  await game.clickText('SET');
  assert(await game.hasText('THE SET'), 'set overlay open');
  assert(await game.hasText('2 per distinct piece type on the board.'), 'Monument rule listed');
  assert(await game.hasText('Booster'), 'Booster listed');
  await game.tapTile(0);
  assertEqual((await game.state()).selTile, null, 'board blocked');
  await game.clickText('CLOSE');
  assert(!(await game.state()).overlay, 'closed');
});

test('?seed= plays another offer script', async (game) => {
  await game.startRun();
  const s = await game.state();
  assertEqual(s.seed, 7, 'seed taken from the URL');
}, { seed: 7 });

test('the game fits a phone screen with nothing off the edge', async (game) => {
  await game.startRun();
  const fit = await game.canvasFit();
  assert(fit.left >= 0 && fit.top >= 0, 'canvas starts on screen');
  assert(fit.right <= fit.viewport.width + 0.5 && fit.bottom <= fit.viewport.height + 0.5, 'canvas ends on screen');
  assert(!fit.pageScrollsX && !fit.pageScrollsY, 'page does not scroll');
  // And it still plays at that scale.
  await placeVia(game, 0, 35);
  assertEqual((await game.state()).turn, 1, 'a tap on a scaled canvas lands');
}, { viewport: { width: 390, height: 844 } });

await run();
