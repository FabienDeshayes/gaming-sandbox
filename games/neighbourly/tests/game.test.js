// The screen: Playwright against the real canvas. Every move a test makes is a
// tap a player could make; the choices are worked out by replaying the same
// offer script through src/core/rules.js, so nothing is hardcoded. Every word
// a test looks for comes from src/text.js.
//
// A browser test pays for what is drawn, what an input does, or what the URL
// sets up; anything that is only a rule belongs in the pure suites.

import { DEFAULT_TUNING } from '../src/data/tuning.js';
import { piecesIn } from '../src/data/catalogue.js';
import { createRun, currentOffer, place, previewPlacement } from '../src/core/rules.js';
import { HUD, LEVEL_END, PIECE_TEXT, SET_LIST, SET_TEXT } from '../src/text.js';
import { assert, assertEqual, run, test } from './harness.js';

const T = DEFAULT_TUNING;
const name = (id) => PIECE_TEXT[id].name;
const sprite = (id) => `sprite:${id}`;

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
  await game.clickText(HUD.place);
}

test('the title screen leads to level 1 with three offers, each drawn as its sprite', async (game) => {
  await game.startRun();
  const s = await game.state();
  assertEqual([s.level, s.turn, s.status], [0, 0, 'playing'], 'fresh run');
  assert(await game.hasText(HUD.level(1, T.levels)), 'level label');
  assert(await game.hasText(HUD.target(T.targets[0])), 'target label');
  const offer = currentOffer(createRun());
  for (const id of offer) assert(await game.hasText(name(id)), `offer card for ${name(id)}`);
  assertEqual(s.cardSprites, offer.map(sprite), 'each card draws its piece');
  assertEqual(s.sprites.filter(Boolean).length, 0, 'an empty board draws no piece');
});

test('picking a piece and tapping a tile previews the score change, PLACE commits it', async (game) => {
  await game.startRun();
  const fresh = createRun();
  const tile = 14;
  const id = currentOffer(fresh)[1];
  const expect = previewPlacement(fresh, id, tile);
  await game.tapOffer(1);
  await game.tapTile(tile);
  let s = await game.state();
  assertEqual(s.board.filter(Boolean).length, 0, 'a preview places nothing');
  assertEqual(s.sprites[tile], sprite(id), 'the previewed piece is drawn as a ghost');
  assert(s.info[0].endsWith(`+${expect.delta}`), `preview title says +${expect.delta}: ${s.info[0]}`);
  assert(s.info[1].startsWith(`Board ${expect.before} → ${expect.after}`), `preview body: ${s.info[1]}`);
  await game.clickText(HUD.place);
  s = await game.state();
  assertEqual(s.board[tile], id, 'placed the picked piece');
  assertEqual(s.sprites[tile], sprite(id), 'and drew it');
  assertEqual(s.turn, 1, 'a turn was spent');
  assertEqual([s.selOffer, s.selTile], [null, null], 'selection cleared');
  assertEqual(s.score, HUD.score(expect.after), 'header score');
});

test('a preview marks every tile whose score would move, and no other', async (game) => {
  await game.startRun();
  const s0 = createRun();
  place(s0, 0, 14);
  await placeVia(game, 0, 14);
  // Preview each offer next to the first piece; at least one moves a neighbour.
  for (let pick = 0; pick < T.offerSize; pick++) {
    const p = previewPlacement(s0, currentOffer(s0)[pick], 15);
    await game.tapOffer(pick);
    await game.tapTile(15);
    const s = await game.state();
    for (const c of p.changes) {
      const d = c.to - c.from;
      if (d !== 0) assertEqual(s.deltas[c.i], d > 0 ? `+${d}` : `${d}`, `delta on tile ${c.i}`);
    }
    assertEqual(s.deltas.filter(Boolean).length, p.changes.filter((c) => c.to !== c.from).length, 'no other tile marked');
    await game.tapOffer(pick); // drop it again
  }
});

test('PLACE does nothing without both a piece and a tile', async (game) => {
  await game.startRun();
  await game.clickText(HUD.place);
  await game.tapOffer(0);
  await game.clickText(HUD.place);
  const s = await game.state();
  assertEqual(s.turn, 0, 'no turn spent');
  assertEqual(s.board.filter(Boolean).length, 0, 'nothing placed');
});

test('tapping a placed piece with nothing picked explains its score', async (game) => {
  await game.startRun();
  await placeVia(game, 0, 0);
  await game.tapTile(0);
  const s = await game.state();
  assertEqual(s.info[0], name(s.board[0]), 'inspects the piece');
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
  assert(await game.hasText(LEVEL_END.cleared(1)), 'cleared banner');
  // The board can't be touched under the result panel.
  await game.tapTile(35);
  assertEqual((await game.state()).selTile, null, 'board blocked by the panel');
  await game.clickText(LEVEL_END.nextLevel);
  s = await game.state();
  assertEqual([s.level, s.turn, s.status, s.overlay], [1, 0, 'playing', false], 'level 2 started');
  assertEqual(s.board, expected.board, 'board carried over');
  assert(await game.hasText(HUD.target(T.targets[1])), 'level 2 target shown');
});

test('missing the target ends the run, and PLAY AGAIN starts the same run over', async (game) => {
  // Stacking every piece onto one tile leaves one piece on the board.
  const s0 = createRun();
  for (let k = 0; k < T.turnsPerLevel; k++) place(s0, 0, 0);
  assert(s0.status === 'lost', 'one piece cannot reach the first target');
  await game.startRun();
  for (let k = 0; k < T.turnsPerLevel; k++) await placeVia(game, 0, 0);
  let s = await game.state();
  assertEqual(s.status, 'lost', 'run lost');
  assert(await game.hasText(LEVEL_END.lost), 'lost banner');
  const sets = s.sets;
  await game.clickText(LEVEL_END.again);
  await game.waitForScene('PlayScene');
  s = await game.state();
  assertEqual([s.level, s.turn, s.status, s.board.filter(Boolean).length], [0, 0, 'playing', 0], 'fresh run');
  assertEqual(s.sets, sets, 'with the same sets');
});

test('SETS lists every piece in play, one tab per set, and blocks the board while open', async (game) => {
  await game.startRun();
  const { sets } = await game.state();
  assertEqual(sets.length, 2, 'base plus one special set');
  await game.clickText(HUD.sets);
  assert(await game.hasText(SET_LIST.heading), 'set list open');
  for (const id of piecesIn('base')) assert(await game.hasText(PIECE_TEXT[id].rule), `${id} listed`);
  await game.clickText(SET_TEXT[sets[1]].name);
  for (const id of piecesIn(sets[1])) assert(await game.hasText(PIECE_TEXT[id].rule), `${id} listed`);
  await game.tapTile(0);
  assertEqual((await game.state()).selTile, null, 'board blocked');
  await game.clickText(SET_LIST.close);
  assert(!(await game.state()).overlay, 'closed');
});

test('?seed= plays another offer script and ?set= picks the special set', async (game) => {
  await game.waitForScene('TitleScene');
  assert(await game.hasText(HUD.setsInPlay([SET_TEXT.base.name, SET_TEXT.kin.name])), 'the title says which sets');
  await game.startRun();
  const s = await game.state();
  assertEqual([s.seed, s.sets], [7, ['base', 'kin']], 'seed and set from the URL');
  const offer = createRun({ seed: 7, special: ['kin'] }).script[0];
  assertEqual(s.cardSprites, offer.map(sprite), 'the offers of that script');
}, { seed: 7, set: 'kin' });

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

test('on a high-density phone the canvas has a pixel for every screen pixel', async (game) => {
  await game.startRun();
  const fit = await game.canvasFit();
  assert(Math.abs(fit.stretch - 1) < 0.01, `canvas is not stretched by the browser (stretch ${fit.stretch})`);
  const res = await game.page.evaluate(() => window.__game.scene.getScene('PlayScene').scoreText.style.resolution);
  assert(res >= 2.4, `text is rasterised at the screen's density (resolution ${res})`);
  await placeVia(game, 0, 35);
  assertEqual((await game.state()).turn, 1, 'a tap on a zoomed canvas lands');
}, { viewport: { width: 390, height: 844 }, dpr: 3 });

await run();
