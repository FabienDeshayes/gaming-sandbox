// Bibou's regression suite — run with `npm test` from games/bibou.
//
// The point of this suite is "is the game still responsive and correct after
// the player does a normal sequence of things", not exhaustive level coverage
// (LEVEL_DESIGN.md still owns per-level verification). Every test drives real
// pointer events on the canvas and reads the live scene back.

import {
  assert,
  assertClose,
  assertEqual,
  run,
  test,
  unit,
} from './harness.js';
import {
  buildWallSet,
  flipEntity,
  moveEntity,
  resolveMoveChain,
  rotateEntity,
  shiftEntity,
} from '../src/core/rules.js';

const N = 5;

// --- Rule math (no browser) -------------------------------------------------

unit('move wraps around the board edges', () => {
  assertEqual(moveEntity({ x: 4, y: 0 }, 'Right', N), { x: 0, y: 0 }, 'right wrap');
  assertEqual(moveEntity({ x: 0, y: 0 }, 'Up', N), { x: 0, y: 4 }, 'up wrap');
});

unit('rotate steps one place around the ring', () => {
  assertEqual(rotateEntity({ x: 1, y: 2 }, { x: 2, y: 3 }, true, N), { x: 2, y: 2 }, 'cw');
  assertEqual(
    rotateEntity({ x: 0, y: 0 }, { x: 3, y: 3 }, true, N),
    { x: 0, y: 0 },
    'off the ring: unchanged'
  );
});

unit('shift only moves the addressed row or column', () => {
  assertEqual(shiftEntity({ x: 2, y: 3 }, 'row', 3, 'Right', N), { x: 3, y: 3 }, 'on row');
  assertEqual(shiftEntity({ x: 2, y: 1 }, 'row', 3, 'Right', N), { x: 2, y: 1 }, 'other row');
});

unit('flip mirrors across the middle line and is its own inverse', () => {
  assertEqual(flipEntity({ x: 1, y: 1 }, 'column', N), { x: 3, y: 1 }, 'column flip');
  assertEqual(flipEntity(flipEntity({ x: 1, y: 1 }, 'row', N), 'row', N), { x: 1, y: 1 }, 'twice');
  assertEqual(flipEntity({ x: 0, y: 2 }, 'row', N), { x: 0, y: 2 }, 'middle row is fixed');
});

unit('a wall makes the move across it illegal', () => {
  const walls = buildWallSet([[{ x: 1, y: 2 }, { x: 2, y: 2 }]]);
  const entities = [{ kind: 'character', pos: { x: 1, y: 2 } }];
  assert(
    resolveMoveChain(walls, entities, { x: 1, y: 2 }, 'Right', N) === null,
    'blocked direction should resolve to null'
  );
  assert(
    resolveMoveChain(walls, entities, { x: 1, y: 2 }, 'Up', N) !== null,
    'unblocked direction should still resolve'
  );
});

// --- Boot and navigation ----------------------------------------------------

test('the game boots to the title screen', async (game) => {
  await game.waitForScene('TitleScene');
  const texts = await game.texts();
  ['Bibou', 'Start', 'Settings', 'Test'].forEach((label) =>
    assert(texts.includes(label), `title screen should show "${label}"`)
  );
});

test('Start leads to the level list and a level starts', async (game) => {
  await game.clickText('Start');
  await game.waitForScene('LevelSelectScene');
  const texts = await game.texts();
  assert(texts.includes('Select Level'), 'level select heading');
  assert(texts.includes('Level 1') && texts.includes('Level 8'), 'all levels listed');

  await game.clickText('Level 1');
  await game.waitForScene('PuzzleScene');
  const s = await game.state();
  assertEqual(s.char, { x: 1, y: 2 }, 'character starts where the level says');
  assertEqual(s.movesUsed, 0, 'no actions used yet');
  assert((await game.texts()).includes('Actions: 0 / 2'), 'HUD shows the budget');
});

test('Test mode runs a level with unlimited budgets', async (game) => {
  await game.clickText('Test');
  await game.waitForScene('LevelSelectScene');
  await game.clickText('Level 1');
  await game.waitForScene('PuzzleScene');
  const texts = await game.texts();
  assert(texts.includes('TEST'), 'test badge');
  assert(texts.includes('Actions: 0 / ∞'), 'unlimited HUD');
  assert(texts.includes('∞ left'), 'unlimited card counter');
});

// --- Playing a level --------------------------------------------------------

test('Move solves Level 1 and spends its budget', async (game) => {
  await game.clickText('Start');
  await game.clickText('Level 1');
  await game.waitForScene('PuzzleScene');

  await game.clickText('Move');
  assertEqual((await game.state()).selectedAction, 'move', 'card selects');
  await game.clickText('▶');
  await game.settle();

  let s = await game.state();
  assertEqual(s.char, { x: 2, y: 2 }, 'character stepped right');
  assertEqual(s.movesUsed, 1, 'one action used');
  assertEqual(s.remaining.move, 1, 'move budget dropped by one');

  await game.clickText('Move');
  await game.swipeFrom(2, 2, 70, 0);
  await game.settle();

  s = await game.state();
  assertEqual(s.char, { x: 3, y: 2 }, 'swipe moves too');
  assert((await game.texts()).includes('You win!'), 'reaching the goal wins');
});

test('budgets are per action, and a spent card stops responding', async (game) => {
  await game.clickText('Start');
  await game.clickText('Level 5');
  await game.waitForScene('PuzzleScene');
  const before = await game.state();
  assertEqual(Object.keys(before.remaining).sort(), ['flip', 'move'], 'level 5 offers two actions');

  // Tapping a selected card again deselects it, and must not cost anything.
  await game.clickText('Flip');
  assertEqual((await game.state()).selectedAction, 'flip', 'flip selected');
  await game.clickText('Flip');
  let s = await game.state();
  assertEqual(s.selectedAction, null, 'tapping again deselects');
  assertEqual(s.movesUsed, 0, 'deselecting costs nothing');

  // Spending Flip's only use must leave Move's own pool untouched.
  await game.clickText('Flip');
  await game.clickText('↔');
  await game.settle();
  s = await game.state();
  assertEqual(s.remaining, { move: 1, flip: 0 }, 'only flip was spent');

  await game.clickText('Flip');
  s = await game.state();
  assertEqual(s.selectedAction, null, 'a spent card does not select');
  assertEqual(s.movesUsed, 1, 'and does not cost an action');
  assert(
    (await game.texts()).includes('No Flip actions left'),
    'the hint says why the card is dead'
  );

  await game.clickText('Move');
  assertEqual((await game.state()).selectedAction, 'move', 'the other card still works');
});

test('a wall blocks the move and costs nothing', async (game) => {
  await game.clickText('Start');
  await game.clickText('Level 7');
  await game.waitForScene('PuzzleScene');

  await game.clickText('Move');
  await game.clickText('▶'); // straight into the wall between (1,2) and (2,2)
  await game.settle();

  const s = await game.state();
  assertEqual(s.char, { x: 1, y: 2 }, 'character stays put');
  assertEqual(s.movesUsed, 0, 'a blocked move is not spent');
  assert(
    (await game.texts()).some((t) => t.includes('Blocked by a wall')),
    'the hint explains why'
  );
});

// --- Regression: crate size after a flip ------------------------------------

// The crate sprite is a 16x16 texture scaled up with setDisplaySize(48, 48), so
// its scale is 3, not 1. A flip animation that squashes the sprite must restore
// it to *its own* scale — restoring to a hardcoded 1 shrinks the crate to its
// raw texture size, which is the "crate got narrow after a flip" bug.
test('entities keep their size through a flip', async (game) => {
  await game.clickText('Test');
  await game.clickText('Level 4');
  await game.waitForScene('PuzzleScene');

  const before = await game.entitySizes();
  assert(
    before.some((e) => e.kind === 'crate'),
    'level 4 should have crates to check'
  );

  await game.clickText('Flip');
  await game.clickText('↔'); // mirror across the middle column
  await game.settle();

  let after = await game.entitySizes();
  after.forEach((e, i) => {
    assertClose(e.width, before[i].width, 0.5, `${e.kind} width after a column flip`);
    assertClose(e.height, before[i].height, 0.5, `${e.kind} height after a column flip`);
  });

  await game.clickText('Flip');
  await game.clickText('↕'); // mirror across the middle row
  await game.settle();

  after = await game.entitySizes();
  after.forEach((e, i) => {
    assertClose(e.width, before[i].width, 0.5, `${e.kind} width after a row flip`);
    assertClose(e.height, before[i].height, 0.5, `${e.kind} height after a row flip`);
  });
});

test('Flip moves the whole entity layer and solves Level 4', async (game) => {
  await game.clickText('Start');
  await game.clickText('Level 4');
  await game.waitForScene('PuzzleScene');
  assertEqual((await game.state()).crates, [{ x: 0, y: 0 }, { x: 4, y: 2 }], 'crates start');

  await game.clickText('Flip');
  await game.clickText('↔');
  await game.settle();
  let s = await game.state();
  assertEqual(s.char, { x: 3, y: 1 }, 'character mirrored');
  assertEqual(s.crates, [{ x: 4, y: 0 }, { x: 0, y: 2 }], 'crates mirrored too');

  await game.clickText('Flip');
  await game.clickText('↕');
  await game.settle();
  s = await game.state();
  assertEqual(s.char, { x: 3, y: 3 }, 'character on the goal');
  assert((await game.texts()).includes('You win!'), 'level 4 solved');
});

// --- Regression: exiting a level and coming back ----------------------------

test('Cancel on the exit panel leaves the level playable', async (game) => {
  await game.clickText('Start');
  await game.clickText('Level 1');
  await game.waitForScene('PuzzleScene');

  await game.clickText('✕');
  assert((await game.texts()).includes('Exit to level select?'), 'confirm panel opens');
  await game.clickText('Cancel');
  assert(
    !(await game.texts()).includes('Exit to level select?'),
    'confirm panel closes'
  );

  await game.clickText('Move');
  assertEqual((await game.state()).selectedAction, 'move', 'cards respond after Cancel');
});

// Exit tears the level down mid-flow with the confirm panel open, so any state
// that gate-keeps input has to be reset when the scene is rebuilt — otherwise
// the next level looks fine but ignores every tap.
test('the game is still playable after exiting to level select', async (game) => {
  await game.clickText('Start');
  await game.clickText('Level 1');
  await game.waitForScene('PuzzleScene');

  await game.clickText('✕');
  await game.clickText('Exit');
  await game.waitForScene('LevelSelectScene');
  assertEqual(await game.activeScene(), 'LevelSelectScene', 'exit returns to level select');

  await game.clickText('Level 1');
  await game.waitForScene('PuzzleScene');
  const fresh = await game.state();
  assertEqual(fresh.char, { x: 1, y: 2 }, 'the level restarts clean');
  assertEqual(fresh.movesUsed, 0, 'and with a fresh budget');

  await game.clickText('Move');
  assertEqual(
    (await game.state()).selectedAction,
    'move',
    'the action card still responds after an exit'
  );
  assert((await game.texts()).includes('▶'), 'move arrows appear');

  await game.clickText('▶');
  await game.settle();
  const s = await game.state();
  assertEqual(s.char, { x: 2, y: 2 }, 'the move actually happens');
  assertEqual(s.movesUsed, 1, 'and is counted');
});

test('exiting from Test mode returns to the Test level list', async (game) => {
  await game.clickText('Test');
  await game.clickText('Level 2');
  await game.waitForScene('PuzzleScene');

  await game.clickText('✕');
  await game.clickText('Exit');
  await game.waitForScene('LevelSelectScene');
  assert((await game.texts()).includes('Test — Select Level'), 'stays in test mode');

  await game.clickText('Level 2');
  await game.waitForScene('PuzzleScene');
  await game.clickText('Rotate');
  await game.clickCell(2, 3);
  await game.clickText('↻');
  await game.settle();
  assertEqual((await game.state()).char, { x: 2, y: 2 }, 'rotate still works after an exit');
});

// --- Regression: level select from the win overlay --------------------------

// --- Collectibles: the key gates the goal --------------------------------

test('reaching the goal without the required key does not win', async (game) => {
  await game.clickText('Start');
  await game.clickText('Level 9');
  await game.waitForScene('PuzzleScene');
  assert((await game.texts()).some((t) => t.startsWith('Objective:')), 'objective line shown');

  // Walk straight to the goal, ignoring the key.
  await game.clickText('Move');
  await game.clickText('▶');
  await game.settle();
  await game.clickText('Move');
  await game.clickText('▶');
  await game.settle();

  let s = await game.state();
  assertEqual(s.char, { x: 3, y: 2 }, 'character reached the goal tile');
  assertEqual(s.gameOver, false, 'standing on a locked goal does not win');
  assert(
    (await game.texts()).some((t) => t.includes('Get the key first')),
    'hint explains the goal is locked'
  );

  // Budget was exactly 6 and 2 were just spent going nowhere — the remaining
  // 4 aren't enough to fetch the key and come back (that alone takes 6), so
  // the level is now unwinnable; spend the rest and confirm a normal loss.
  for (let i = 0; i < 4; i++) {
    await game.clickText('Move');
    await game.clickText('▲');
    await game.settle();
  }
  assert((await game.texts()).includes('Out of actions'), 'runs out of budget without the key');
});

test('collecting the key first unlocks the goal and wins', async (game) => {
  await game.clickText('Start');
  await game.clickText('Level 9');
  await game.waitForScene('PuzzleScene');

  await game.clickText('Move');
  await game.clickText('▲');
  await game.settle();
  await game.clickText('Move');
  await game.clickText('▲');
  await game.settle();

  let s = await game.state();
  assertEqual(s.char, { x: 1, y: 0 }, 'character on the key tile');
  assert(
    (await game.texts()).includes('Objective: reach the goal'),
    'objective updates once the key is collected'
  );

  await game.clickText('Move');
  await game.clickText('▶');
  await game.settle();
  await game.clickText('Move');
  await game.clickText('▶');
  await game.settle();
  await game.clickText('Move');
  await game.clickText('▼');
  await game.settle();
  await game.clickText('Move');
  await game.clickText('▼');
  await game.settle();

  s = await game.state();
  assertEqual(s.char, { x: 3, y: 2 }, 'character on the goal');
  assert((await game.texts()).includes('You win!'), 'level 9 solved with the key in hand');
});

test('Level select from the win overlay leaves the next level playable', async (game) => {
  await game.clickText('Start');
  await game.clickText('Level 1');
  await game.waitForScene('PuzzleScene');

  await game.clickText('Move');
  await game.clickText('▶');
  await game.settle();
  await game.clickText('Move');
  await game.clickText('▶');
  await game.settle();
  assert((await game.texts()).includes('You win!'), 'level solved');

  await game.clickText('Level select');
  await game.waitForScene('LevelSelectScene');
  await game.clickText('Level 1');
  await game.waitForScene('PuzzleScene');

  const s = await game.state();
  assertEqual(s.gameOver, false, 'the new run is not already over');
  await game.clickText('Move');
  assertEqual((await game.state()).selectedAction, 'move', 'cards respond in the new run');
});

run();
