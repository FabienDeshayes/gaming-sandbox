// The three things around a run that only a real browser can answer: that the
// canvas fits the screen the game is played on, that the tile sheet loaded and
// was cut, and that the game's own voice types itself out a character at a time.
//
// The menus themselves are not here, and shouldn't be. Which scene a button
// opens, whether a toggle flips, whether the music loop swapped tracks — none of
// those is a rule of the game, and each costs a page and several seconds to
// re-assert every time anybody runs the suite.

import { assert, assertEqual, runIfMain } from './harness.js';
import { SAY, SLOTS, TITLE } from '../src/text.js';
import { test } from './world.js';

test('the whole game fits a portrait phone screen', async (game) => {
  // Phaser fits the canvas to #game, so if #game is not the viewport the canvas
  // overflows it — which pushes the D-pad and the map's X button off the side
  // and lets the page pan sideways, swallowing taps. The game is played on a
  // phone held upright, so this is a playability claim, not a layout nicety.
  const phone = await game.openAnother({ viewport: { width: 390, height: 844 } });
  const fit = await phone.canvasFit();
  const where = JSON.stringify(fit);

  assert(fit.left >= -1 && fit.top >= -1, `canvas starts off screen: ${where}`);
  assert(fit.right <= fit.viewport.width + 1, `canvas runs off the side: ${where}`);
  assert(fit.bottom <= fit.viewport.height + 1, `canvas runs off the bottom: ${where}`);
  assert(!fit.pageScrollsX && !fit.pageScrollsY, `the page scrolls behind the canvas: ${where}`);
});

test('the tile sheet is loaded and cut into every sprite the game draws', async (game) => {
  // Reading a PNG needs a canvas, so this is the one half of the art the pure
  // suite can't reach: `sprites.test.js` proves the table is cut correctly
  // against a fake sheet, and this proves the real sheet is the one it names.
  const cut = await game.page.evaluate(async () => {
    const textures = await import('/src/ui/textures.js');
    const { SHEET_KEY } = await import('/src/data/tiles.js');
    const manager = window.__game.textures;
    const sheet = manager.get(SHEET_KEY).getSourceImage();
    return {
      sheet: { width: sheet.width, height: sheet.height },
      sprites: textures.spriteKeys().map((key) => {
        const frame = manager.getFrame(key);
        return { key, width: frame && frame.width, height: frame && frame.height };
      }),
    };
  });

  // 49x22 tiles of 16px, one transparent pixel apart (src/data/tiles.js).
  assertEqual(cut.sheet, { width: 832, height: 373 }, 'the sheet the page actually loaded');
  assert(cut.sprites.length > 0, 'and it was cut into sprites');
  for (const sprite of cut.sprites)
    assertEqual(
      { width: sprite.width, height: sprite.height },
      { width: 16, height: 16 },
      `${sprite.key} is one tile`
    );

  // The keys the renderer names have to be among them, or a tile draws blank —
  // including the colour zones a painted tile is stacked back up from
  // (src/data/paint.js).
  for (const key of ['floor', 'rock-2', 'tree-7', 'wall-tl', 'base', 'wizard-down-z1', 'wall-tl-z1'])
    assert(cut.sprites.some((s) => s.key === key), `${key} was cut`);
});

test('setting out, the game says its piece a character at a time', async (game) => {
  // The text panel is the game's own voice (DESIGN.md §7): it types itself out,
  // it owns the input while it is up, and a tap fills the block in rather than
  // skipping it. Every other test gets to a run through `startRun`, which reads
  // the panel to the end on the way past — this one takes the long way round,
  // because the panel is the thing it is about.
  await game.clickText(TITLE.newGame);
  await game.waitForScene('SlotScene');
  await game.clickText(SLOTS.slotName(1));
  await game.waitForScene('ExploreScene');

  const opening = await game.textPanel();
  assert(opening, 'a fresh expedition opens with the panel up');
  assertEqual(opening.blocks, SAY.expeditionStart.length, 'one block per line of the copy');
  assertEqual(opening.index, 0, 'starting at the first');
  // The block is wrapped to the panel, not reworded by it.
  assertEqual(opening.full.replace(/\n/g, ' '), SAY.expeditionStart[0], 'saying what text.js says');

  // Progressive is a claim about two moments, not one — and it is *waited* for
  // rather than slept on, so a slow machine reads the same result as a fast one.
  // A quarter of the block is a long way short of all of it (26ms a character
  // against a sentence of sixty), which is what leaves the tap below landing
  // mid-sentence however slowly the page is running.
  const quarter = Math.floor(opening.full.length / 4);
  await game.page.waitForFunction(
    (n) => window.__game.scene.getScene('ExploreScene').textPanel.shown >= n,
    quarter
  );
  const more = await game.textPanel();
  assert(more.shown.length > opening.shown.length, 'it fills itself in as it goes');
  assert(more.shown.length < more.full.length, 'and is still not all there');
  assert((await game.sounds()).includes('text'), 'and it is audible doing it');

  // The first tap fills the block in rather than skipping past it, which is the
  // whole difference between a text box and a dismiss button.
  await game.tapPanel();
  const filled = await game.textPanel();
  assertEqual(filled.index, 0, 'a tap mid-sentence is not a tap to the next block');
  assertEqual(filled.shown, filled.full, 'it puts the rest of it up at once');
  await game.tapPanel();
  assertEqual((await game.textPanel()).index, 1, 'and the tap after that is the next block');

  // Anywhere on the screen is the panel's, so the D-pad under it reads it on
  // instead of walking.
  const before = await game.state();
  assert(before.textPanelOpen, 'the panel owns the screen while it talks');
  await game.tapDpad('right');
  await game.settle();
  const bumped = await game.state();
  assertEqual(bumped.steps, before.steps, 'the D-pad does not step while it is up');
  assert(bumped.textPanelOpen, 'it took the tap itself');

  // Read out, it gets out of the way and hands the expedition over.
  await game.readPanel();
  assertEqual(await game.textPanel(), null, 'the last block closes it');
  await game.tapDpad('right');
  await game.settle();
  assertEqual((await game.state()).steps, before.steps + 1, 'and now the run walks');
});

runIfMain(import.meta.url);
