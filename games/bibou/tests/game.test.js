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
  resolveCycleOutcome,
  resolveMoveChain,
  shiftEntity,
  shiftOrder,
} from '../src/core/rules.js';

const N = 5;

// --- Rule math (no browser) -------------------------------------------------

unit('move wraps around the board edges', () => {
  assertEqual(moveEntity({ x: 4, y: 0 }, 'Right', N), { x: 0, y: 0 }, 'right wrap');
  assertEqual(moveEntity({ x: 0, y: 0 }, 'Up', N), { x: 0, y: 4 }, 'up wrap');
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

// Level 4's whole puzzle: the sealed key sits on the middle column, so the
// column flip is the wrong axis — it leaves the key exactly where it was.
unit('the middle column is a fixed point, which is what makes Level 4 a choice', () => {
  assertEqual(flipEntity({ x: 2, y: 0 }, 'column', N), { x: 2, y: 0 }, 'column flip: no help');
  assertEqual(flipEntity({ x: 2, y: 0 }, 'row', N), { x: 2, y: 4 }, 'row flip: frees it');
});

unit('a wall makes the move across it illegal', () => {
  const walls = buildWallSet([[{ x: 1, y: 2 }, { x: 2, y: 2 }]]);
  const entities = [{ kind: 'character', pos: { x: 1, y: 2 } }];
  assertEqual(
    resolveMoveChain(walls, entities, { x: 1, y: 2 }, 'Right', N).kind,
    'illegal',
    'blocked direction should resolve as illegal'
  );
  assertEqual(
    resolveMoveChain(walls, entities, { x: 1, y: 2 }, 'Up', N).kind,
    'open',
    'unblocked direction should resolve normally'
  );
});

// --- Rule math: destructible crates & collectibles (LEVEL_DESIGN.md §5.4) --

unit('a crate crushed against a wall is destroyed', () => {
  const walls = buildWallSet([[{ x: 2, y: 2 }, { x: 3, y: 2 }]]);
  const entities = [
    { kind: 'character', pos: { x: 1, y: 2 } },
    { kind: 'crate', pos: { x: 2, y: 2 } },
  ];
  const result = resolveMoveChain(walls, entities, { x: 1, y: 2 }, 'Right', N);
  assertEqual(result.kind, 'destroy', 'crate crushed against the wall');
  assertEqual(result.victim.kind, 'crate', 'the crate is the victim');
  assertEqual(result.dest, { x: 3, y: 2 }, 'dest is the tile it failed to reach');
});

unit('a crate crushed against an indestructible collectible is destroyed', () => {
  const walls = buildWallSet([[{ x: 3, y: 2 }, { x: 4, y: 2 }]]);
  const entities = [
    { kind: 'character', pos: { x: 1, y: 2 } },
    { kind: 'crate', pos: { x: 2, y: 2 } },
    { kind: 'collectible', type: 'key', pos: { x: 3, y: 2 } },
  ];
  const result = resolveMoveChain(walls, entities, { x: 1, y: 2 }, 'Right', N);
  assertEqual(result.kind, 'destroy', 'crate crushed against a stuck key');
  assertEqual(result.victim.kind, 'crate', 'the crate is the victim, not the key');
});

unit('the character always picks up a collectible instead of pushing it', () => {
  const entities = [
    { kind: 'character', pos: { x: 1, y: 2 } },
    { kind: 'collectible', type: 'key', pos: { x: 2, y: 2 } },
  ];
  const result = resolveMoveChain(buildWallSet([]), entities, { x: 1, y: 2 }, 'Right', N);
  assertEqual(result.kind, 'pickup', 'stepping onto a collectible is a pickup, not a push');
});

// Level 5's shape: walls perpendicular to the shift line crush whatever sits
// between them, which is the only way that level's crate can ever be broken.
unit('resolveCycleOutcome: Shift crushes a crate walled in on the shift axis', () => {
  const walls = buildWallSet([
    [{ x: 2, y: 1 }, { x: 2, y: 2 }],
    [{ x: 2, y: 2 }, { x: 2, y: 3 }],
  ]);
  const crate = { kind: 'crate', pos: { x: 2, y: 2 } };
  const outcomes = resolveCycleOutcome(walls, [crate], shiftOrder('column', 2, 'Down', N));
  assertEqual(outcomes.length, 1, 'only the crate is involved');
  assertEqual(outcomes[0].outcome, 'destroy', 'crushed against the wall ahead of it');
  assertEqual(outcomes[0].dest, { x: 2, y: 3 }, 'dest is the tile it failed to reach');
});

unit('resolveCycleOutcome: a line with nothing on it produces no outcomes', () => {
  const outcomes = resolveCycleOutcome(buildWallSet([]), [], shiftOrder('row', 0, 'Right', N));
  assertEqual(outcomes, [], 'an empty line is a no-op, which PuzzleScene makes free');
});

unit('resolveCycleOutcome: the character collects a key stuck at a wall', () => {
  const walls = buildWallSet([[{ x: 3, y: 2 }, { x: 4, y: 2 }]]);
  const entities = [
    { kind: 'collectible', type: 'key', pos: { x: 3, y: 2 } },
    { kind: 'character', pos: { x: 2, y: 2 } },
  ];
  const outcomes = resolveCycleOutcome(walls, entities, shiftOrder('row', 2, 'Right', N));
  const byKind = Object.fromEntries(outcomes.map((o) => [o.entity.kind, o.outcome]));
  assertEqual(byKind.character, 'pickup', 'character always yields to nothing, not even a stuck key');
});

// The mirror image: shifting can queue the key *behind* a character that's
// already stuck at the wall, rather than the character stepping onto the key.
// The pickup rule has to hold in this direction too, or the shift just
// silently does nothing.
unit('resolveCycleOutcome: a collectible pushed into a stuck character is still a pickup', () => {
  const walls = buildWallSet([[{ x: 3, y: 2 }, { x: 4, y: 2 }]]);
  const character = { kind: 'character', pos: { x: 3, y: 2 } };
  const collectible = { kind: 'collectible', type: 'key', pos: { x: 2, y: 2 } };
  const outcomes = resolveCycleOutcome(walls, [character, collectible], shiftOrder('row', 2, 'Right', N));
  const pickup = outcomes.find((o) => o.outcome === 'pickup');
  assert(pickup, 'the key catching up to the stuck character should be a pickup, not a silent no-op');
  assertEqual(pickup.entity, character, 'the character ends up holding the key');
  assertEqual(pickup.collectible, collectible, 'the key is the thing collected');
  assertEqual(pickup.characterStays, true, 'the character does not move — it was already at the wall');
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
  assert(texts.includes('Level 1') && texts.includes('Level 5'), 'all levels listed');

  await game.clickText('Level 1');
  await game.waitForScene('PuzzleScene');
  const s = await game.state();
  assertEqual(s.char, { x: 1, y: 2 }, 'character starts where the level says');
  assertEqual(s.movesUsed, 0, 'no moves used yet');
  assert((await game.texts()).includes('Moves: 0'), 'HUD counts moves, with no limit');
});

test('the level list shows a description per level and stays scrollable', async (game) => {
  await game.clickText('Start');
  await game.waitForScene('LevelSelectScene');

  let texts = await game.texts();
  assert(
    texts.includes('Swipe to move. The key unlocks the exit.'),
    'Level 1 shows its description'
  );
  assert(texts.includes('Back'), 'Back is always present');

  await game.scrollToLevel(5);
  texts = await game.texts();
  assert(
    texts.includes('Shift pushes from a side you can never stand on.'),
    'Level 5 still shows its description after scrolling to it'
  );

  await game.clickText('Back');
  await game.waitForScene('TitleScene');
});

test('Test mode runs a level with unlimited budgets', async (game) => {
  await game.clickText('Test');
  await game.waitForScene('LevelSelectScene');
  await game.clickText('Level 4');
  await game.waitForScene('PuzzleScene');
  const texts = await game.texts();
  assert(texts.includes('TEST'), 'test badge');
  assert(
    texts.some((t) => t.includes('Actions: 0 / ∞')),
    'unlimited HUD'
  );
  assert(texts.includes('∞ left'), 'unlimited card counter');
});

// --- Move is free, unlimited, and always available ---------------------------

// The headline change: Move has no card and no budget. The direction arrows sit
// around the character from the moment the level loads, and a swipe works
// without selecting anything first.
test('Move needs no card: the arrows are there from the start', async (game) => {
  await game.clickText('Start');
  await game.clickText('Level 1');
  await game.waitForScene('PuzzleScene');

  const texts = await game.texts();
  assert(!texts.includes('Move'), 'there is no Move card any more');
  ['▲', '▼', '◀', '▶'].forEach((glyph) =>
    assert(texts.includes(glyph), `the ${glyph} arrow is showing before anything is tapped`)
  );

  await game.clickText('▶');
  await game.settle();
  let s = await game.state();
  assertEqual(s.char, { x: 2, y: 2 }, 'tapping an arrow moves straight away');
  assertEqual(s.movesUsed, 1, 'moves are counted');

  // The arrows follow the character rather than being consumed by the move.
  await game.swipeFrom(2, 2, 0, -70);
  await game.settle();
  s = await game.state();
  assertEqual(s.char, { x: 2, y: 1 }, 'and a swipe works with nothing selected');
  assertEqual(s.movesUsed, 2, 'still just moves');
});

test('a level with no actions offers no cards and cannot run out', async (game) => {
  await game.clickText('Start');
  await game.clickText('Level 1');
  await game.waitForScene('PuzzleScene');

  const s = await game.state();
  assertEqual(s.remaining, {}, 'Level 1 budgets nothing');
  assertEqual(s.budget, 0, 'so there is no budget to spend');

  // Wander well past what any old budget would have allowed.
  for (let i = 0; i < 8; i++) {
    await game.clickText('▼');
    await game.settle();
  }
  const after = await game.state();
  assertEqual(after.movesUsed, 8, 'every move counted');
  assertEqual(after.gameOver, false, 'and none of them can end the level');
  assert(!(await game.texts()).includes('Out of actions'), 'there is no lose state left');
});

test('Level 1: the goal stays locked until the key is collected', async (game) => {
  await game.clickText('Start');
  await game.clickText('Level 1');
  await game.waitForScene('PuzzleScene');
  assert((await game.texts()).some((t) => t.startsWith('Objective:')), 'objective line shown');

  // Straight at the goal, ignoring the key.
  await game.clickText('▶');
  await game.settle();
  await game.clickText('▶');
  await game.settle();

  let s = await game.state();
  assertEqual(s.char, { x: 3, y: 2 }, 'character reached the goal tile');
  assertEqual(s.gameOver, false, 'standing on a locked goal does not win');
  assert(
    (await game.texts()).some((t) => t.includes('Get the key first')),
    'hint explains the goal is locked'
  );

  // Fetch the key and come back — free, because moves cost nothing.
  for (const glyph of ['◀', '▲', '▲']) {
    await game.clickText(glyph);
    await game.settle();
  }
  assert(
    (await game.texts()).includes('Objective: reach the goal'),
    'objective updates once the key is collected'
  );
  for (const glyph of ['▶', '▼', '▼']) {
    await game.clickText(glyph);
    await game.settle();
  }
  s = await game.state();
  assertEqual(s.char, { x: 3, y: 2 }, 'character back on the goal');
  assert((await game.texts()).includes('You win!'), 'level 1 solved with the key in hand');
});

// --- Walls and wraparound ---------------------------------------------------

test('a wall blocks the move and costs nothing', async (game) => {
  await game.clickText('Start');
  await game.clickText('Level 2');
  await game.waitForScene('PuzzleScene');

  await game.clickText('◀'); // straight into the wall between (0,2) and (1,2)
  await game.settle();

  const s = await game.state();
  assertEqual(s.char, { x: 1, y: 2 }, 'character stays put');
  assertEqual(s.movesUsed, 0, 'a blocked move is not even counted');
  assert(
    (await game.texts()).some((t) => t.includes('Blocked by a wall')),
    'the hint explains why'
  );
});

test('Level 2: the key is only reachable through the wraparound seam', async (game) => {
  await game.clickText('Start');
  await game.clickText('Level 2');
  await game.waitForScene('PuzzleScene');

  // Walk right to the far edge, then wrap through the seam onto the key.
  for (let i = 0; i < 3; i++) {
    await game.clickText('▶');
    await game.settle();
  }
  assertEqual((await game.state()).char, { x: 4, y: 2 }, 'at the seam');

  await game.clickText('▶');
  await game.settle();
  let s = await game.state();
  assertEqual(s.char, { x: 0, y: 2 }, 'wrapped around onto the key tile');
  assertEqual(s.collectibles, [], 'and picked the key up on the way in');

  await game.clickText('◀'); // back out through the seam
  await game.settle();
  await game.clickText('◀');
  await game.settle();
  s = await game.state();
  assertEqual(s.char, { x: 3, y: 2 }, 'character on the goal');
  assert((await game.texts()).includes('You win!'), 'level 2 solved');
});

// --- Crates that hold a key -------------------------------------------------

test('Level 3: crushing a crate against a wall drops the key it held', async (game) => {
  await game.clickText('Start');
  await game.clickText('Level 3');
  await game.waitForScene('PuzzleScene');

  let s = await game.state();
  assertEqual(s.crates, [{ x: 1, y: 2 }], 'the crate starts next to the character');
  assertEqual(s.collectibles, [], 'the key is inside it, not on the board');
  assert(
    (await game.texts()).some((t) => t.includes('Objective: find the key')),
    'the objective still names the key even though it is hidden'
  );

  // Push the crate along the row until it hits the wall.
  await game.clickText('▶');
  await game.settle();
  assertEqual((await game.state()).crates, [{ x: 2, y: 2 }], 'crate pushed one tile');

  await game.clickText('▶');
  await game.settle();
  s = await game.state();
  assertEqual(s.crates, [], 'the crate is destroyed against the wall');
  assertEqual(s.char, { x: 1, y: 2 }, 'nothing behind a crushed crate advances');
  assertEqual(
    s.collectibles,
    [{ type: 'key', x: 2, y: 2 }],
    'and it drops its key on the tile it died on'
  );

  await game.clickText('▶');
  await game.settle();
  s = await game.state();
  assertEqual(s.char, { x: 2, y: 2 }, 'character walked onto the dropped key');
  assertEqual(s.collectibles, [], 'and collected it');

  for (const glyph of ['▲', '▶', '▼']) {
    await game.clickText(glyph);
    await game.settle();
  }
  s = await game.state();
  assertEqual(s.char, { x: 3, y: 2 }, 'character on the goal after the detour');
  assert((await game.texts()).includes('You win!'), 'level 3 solved');
});

// --- Flip -------------------------------------------------------------------

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
    'level 4 should have a crate to check'
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

test('Level 4: the wrong flip axis leaves the sealed key exactly where it was', async (game) => {
  await game.clickText('Test'); // unlimited flips, so both axes can be tried
  await game.clickText('Level 4');
  await game.waitForScene('PuzzleScene');

  await game.clickText('Flip');
  await game.clickText('↔'); // the middle column: the key's own line
  await game.settle();
  let s = await game.state();
  assertEqual(s.collectibles, [{ type: 'key', x: 2, y: 0 }], 'the key did not move');
  assertEqual(s.crates, [{ x: 3, y: 1 }], 'though everything off that line did');

  await game.clickText('Flip');
  await game.clickText('↕'); // the middle row: frees it
  await game.settle();
  s = await game.state();
  assertEqual(s.collectibles, [{ type: 'key', x: 2, y: 4 }], 'the row flip moves it out of its cage');
});

test('Level 4: one row flip frees the key and the level is solvable', async (game) => {
  await game.clickText('Start');
  await game.clickText('Level 4');
  await game.waitForScene('PuzzleScene');

  // The key is sealed on all four edges, so walking at it is illegal.
  await game.clickText('Flip');
  await game.swipeFrom(2, 2, 0, 70); // vertical swipe = mirror across the middle row
  await game.settle();

  let s = await game.state();
  assertEqual(s.collectibles, [{ type: 'key', x: 2, y: 4 }], 'key flipped out of its cage');
  assertEqual(s.char, { x: 0, y: 2 }, 'the character sits on the mirror line, so it stays');
  assertEqual(s.remaining.flip, 0, 'the level only ever had one flip');
  assertEqual(s.actionsUsed, 1, 'and it is counted as an action, not a move');

  for (const glyph of ['▼', '▼', '▶', '▶']) {
    await game.clickText(glyph);
    await game.settle();
  }
  s = await game.state();
  assertEqual(s.collectibles, [], 'key collected');

  for (const glyph of ['▶', '▶', '▲', '▲']) {
    await game.clickText(glyph);
    await game.settle();
  }
  s = await game.state();
  assertEqual(s.char, { x: 4, y: 2 }, 'character on the goal');
  assert((await game.texts()).includes('You win!'), 'level 4 solved');
});

test('a spent action card stops responding while Move carries on', async (game) => {
  await game.clickText('Start');
  await game.clickText('Level 4');
  await game.waitForScene('PuzzleScene');
  assertEqual(Object.keys((await game.state()).remaining), ['flip'], 'level 4 offers only Flip');

  // Tapping a selected card again deselects it, and must not cost anything.
  await game.clickText('Flip');
  assertEqual((await game.state()).selectedAction, 'flip', 'flip selected');
  await game.clickText('Flip');
  let s = await game.state();
  assertEqual(s.selectedAction, null, 'tapping again deselects');
  assertEqual(s.actionsUsed, 0, 'deselecting costs nothing');

  await game.clickText('Flip');
  await game.clickText('↔');
  await game.settle();
  assertEqual((await game.state()).remaining, { flip: 0 }, 'the only flip is spent');

  await game.clickText('Flip');
  s = await game.state();
  assertEqual(s.selectedAction, null, 'a spent card does not select');
  assertEqual(s.actionsUsed, 1, 'and does not cost an action');
  assert(
    (await game.texts()).includes('No Flip actions left'),
    'the hint says why the card is dead'
  );

  // Move is not a card and has no budget, so it still works.
  await game.clickText('▼');
  await game.settle();
  assertEqual((await game.state()).char, { x: 4, y: 3 }, 'the character can still walk');
});

// --- Shift ------------------------------------------------------------------

test('Level 5: only a column shift can crush the corridor crate', async (game) => {
  await game.clickText('Start');
  await game.scrollToLevel(5);
  await game.clickText('Level 5');
  await game.waitForScene('PuzzleScene');

  // Move can push the crate along the corridor forever without ever crushing
  // it — the only walls are above and below, where the character can't stand.
  await game.clickText('▶');
  await game.settle();
  await game.clickText('▶');
  await game.settle();
  let s = await game.state();
  assertEqual(s.char, { x: 2, y: 2 }, 'character pushed into the crate');
  assertEqual(s.crates, [{ x: 3, y: 2 }], 'and the crate just slid along the corridor');
  assertEqual(s.remaining.shift, 1, 'moving spends nothing');

  // A shift with nothing on the line changes nothing, so it costs nothing —
  // and leaves the card selected, so the next arrow can be tried right away.
  await game.clickText('Shift');
  await game.clickText('▼', 1); // column 1: empty
  await game.settle();
  s = await game.state();
  assertEqual(s.remaining.shift, 1, 'a no-op shift is free');
  assertEqual(s.selectedAction, 'shift', 'and does not drop the selection');
  assert(
    (await game.texts()).some((t) => t.includes('Nothing on that row or column')),
    'and says so'
  );

  // Shifting the crate's own column pushes it into the corridor wall.
  await game.clickText('▼', 3); // column 3: the crate
  await game.settle();
  s = await game.state();
  assertEqual(s.crates, [], 'the crate is crushed by the shift');
  assertEqual(
    s.collectibles,
    [{ type: 'key', x: 3, y: 2 }],
    'and drops its key inside the corridor'
  );
  assertEqual(s.remaining.shift, 0, 'that one spent the shift');

  await game.clickText('▶');
  await game.settle();
  s = await game.state();
  assertEqual(s.char, { x: 3, y: 2 }, 'walked onto the key');
  assertEqual(s.collectibles, [], 'and collected it');

  await game.clickText('▶');
  await game.settle();
  s = await game.state();
  assertEqual(s.char, { x: 4, y: 2 }, 'character on the goal');
  assert((await game.texts()).includes('You win!'), 'level 5 solved');
  assert(
    !(await game.texts()).includes('Next level'),
    'level 5 is the last level, so the win overlay offers no Next level button'
  );
});

test('Level 5: shifting the row the character is on is blocked and free', async (game) => {
  await game.clickText('Start');
  await game.scrollToLevel(5);
  await game.clickText('Level 5');
  await game.waitForScene('PuzzleScene');

  await game.clickText('Shift');
  await game.clickText('▼', 0); // column 0: only the character, walled in
  await game.settle();

  const s = await game.state();
  assertEqual(s.char, { x: 0, y: 2 }, 'the character cannot be shifted out of the corridor');
  assertEqual(s.remaining.shift, 1, 'and a blocked shift costs nothing');
  assert(
    (await game.texts()).some((t) => t.includes('Blocked by a wall')),
    'the hint explains why'
  );
});

// --- Retry replaces the lose condition --------------------------------------

// With Move free there is no "out of actions" any more, so spending an action
// badly is recovered from with the retry button rather than a lose overlay.
test('the retry button restarts the level from scratch', async (game) => {
  await game.clickText('Start');
  await game.clickText('Level 4');
  await game.waitForScene('PuzzleScene');

  await game.clickText('Flip');
  await game.clickText('↔'); // the wrong axis: the key stays sealed
  await game.settle();
  let s = await game.state();
  assertEqual(s.remaining.flip, 0, 'the only flip is gone');
  assertEqual(s.collectibles, [{ type: 'key', x: 2, y: 0 }], 'and the key is still sealed');

  await game.clickText('↻');
  await game.waitForScene('PuzzleScene');
  s = await game.state();
  assertEqual(s.remaining.flip, 1, 'retry restores the budget');
  assertEqual(s.char, { x: 0, y: 2 }, 'and the starting position');
  assertEqual(s.movesUsed, 0, 'with a clean move count');
  assertEqual(s.actionsUsed, 0, 'and a clean action count');

  await game.clickText('▼');
  await game.settle();
  assertEqual((await game.state()).char, { x: 0, y: 3 }, 'the board responds after a retry');
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

  // The panel clears the board controls, so Cancel has to put them back.
  assert((await game.texts()).includes('▶'), 'the move arrows come back');
  await game.clickText('▶');
  await game.settle();
  assertEqual((await game.state()).char, { x: 2, y: 2 }, 'and the board responds after Cancel');
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
  assertEqual(fresh.movesUsed, 0, 'and with a fresh count');

  assert((await game.texts()).includes('▶'), 'move arrows appear');
  await game.clickText('▶');
  await game.settle();
  const s = await game.state();
  assertEqual(s.char, { x: 2, y: 2 }, 'the move actually happens');
  assertEqual(s.movesUsed, 1, 'and is counted');
});

test('exiting from Test mode returns to the Test level list', async (game) => {
  await game.clickText('Test');
  await game.clickText('Level 4');
  await game.waitForScene('PuzzleScene');

  await game.clickText('✕');
  await game.clickText('Exit');
  await game.waitForScene('LevelSelectScene');
  assert((await game.texts()).includes('Test — Select Level'), 'stays in test mode');

  await game.clickText('Level 4');
  await game.waitForScene('PuzzleScene');
  await game.clickText('Flip');
  await game.clickText('↕');
  await game.settle();
  assertEqual(
    (await game.state()).collectibles,
    [{ type: 'key', x: 2, y: 4 }],
    'flip still works after an exit'
  );
});

// --- Win overlay flow -------------------------------------------------------

test('Winning offers a Next level button that loads the following level', async (game) => {
  await game.clickText('Start');
  await game.clickText('Level 1');
  await game.waitForScene('PuzzleScene');

  for (const glyph of ['▶', '▲', '▲', '▶', '▼', '▼']) {
    await game.clickText(glyph);
    await game.settle();
  }
  assert((await game.texts()).includes('You win!'), 'level 1 solved');
  assert((await game.texts()).includes('Moves used: 6'), 'the overlay reports the move count');
  assert((await game.texts()).includes('Next level'), 'level 2 exists, so the button shows');

  await game.clickText('Next level');
  await game.waitForScene('PuzzleScene');

  const s = await game.state();
  assertEqual(s.gameOver, false, 'the next level is not already over');
  assertEqual(s.char, { x: 1, y: 2 }, 'level 2 loaded at its own start');
  assertEqual(s.movesUsed, 0, 'with a fresh move count');
});

test('Level select from the win overlay leaves the next level playable', async (game) => {
  await game.clickText('Start');
  await game.clickText('Level 1');
  await game.waitForScene('PuzzleScene');

  for (const glyph of ['▶', '▲', '▲', '▶', '▼', '▼']) {
    await game.clickText(glyph);
    await game.settle();
  }
  assert((await game.texts()).includes('You win!'), 'level solved');

  await game.clickText('Level select');
  await game.waitForScene('LevelSelectScene');
  await game.clickText('Level 1');
  await game.waitForScene('PuzzleScene');

  const s = await game.state();
  assertEqual(s.gameOver, false, 'the new run is not already over');
  await game.clickText('▶');
  await game.settle();
  assertEqual((await game.state()).char, { x: 2, y: 2 }, 'the board responds in the new run');
});

run();
