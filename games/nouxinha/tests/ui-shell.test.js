// Everything around a run: the title screen, Settings, the audio switches, the
// canvas against a real phone, and that the tile sheet actually loaded. Each
// test drives a fresh page against the real canvas.

import { assert, assertEqual, runIfMain, test as browserTest } from './harness.js';
import { test } from './world.js';
import { LEAVING, MENU, SAY, SETTINGS, SLOTS, TITLE, UI } from '../src/text.js';

browserTest('a button responds across its whole width, not just the left half', async (game) => {
  assert(await game.hasText(TITLE.name), 'the title screen is up');
  // NEW GAME is a 240-wide button centred on (240, 566) (TitleScene.js), so its
  // right edge sits at x=360. Tapping 90px right of centre is still 30px
  // inside the button — Container.displayOriginX shifting the hit area left
  // by half the button's width (the bug this pins) would make this miss.
  await game.clickAt(330, 566);
  await game.waitForScene('SlotScene');
  assertEqual(await game.activeScene(), 'SlotScene', 'scene');
});

browserTest('the title screen has no gem indicator, and colours the wizard and name at random', async (game) => {
  const t = await game.titleScreen();
  assertEqual(t.gemImages, 0, 'no gem pips are drawn any more');
  assert(t.wizardIsGemHue, 'the wizard is tinted one of the three gem colours');
  assert(t.nameIsGemHue, 'the name is coloured one of the three gem colours');
  assert(t.distinct, 'and the two are never the same colour');
});

test('settings: going back works on a single tap', async (game) => {
  await game.clickText(UI.settings);
  await game.waitForScene('SettingsScene');
  assertEqual(await game.activeScene(), 'SettingsScene', 'scene');

  await game.clickText(UI.back);
  await game.waitForScene('TitleScene');
  assertEqual(await game.activeScene(), 'TitleScene', 'back to the title screen');
});

test('the music follows the scene: the menus get one loop, the dark another', async (game) => {
  assertEqual(await game.musicTrack(), 'menu', 'the title screen has its own small loop');
  await game.clickText(UI.settings);
  await game.waitForScene('SettingsScene');
  assertEqual(await game.musicTrack(), 'menu', 'and it carries on across the menus');
  await game.clickText(UI.back);
  await game.waitForScene('TitleScene');

  await game.startRun();
  // The loop is started by the scene and again by the first input, because a
  // page the player has not touched yet has no clock to schedule against.
  await game.tapDpad('right');
  await game.settle();
  assertEqual(await game.musicTrack(), 'explore', 'the dark gets the longer loop');

  // Out through the cogwheel, which is the only way out of a run.
  await game.tapMenuButton();
  await game.clickText(MENU.exit);
  await game.clickText(LEAVING.leave);
  await game.waitForScene('TitleScene');
  assertEqual(await game.musicTrack(), 'menu', 'and the menus take theirs back');
});

test('the music switch turns the loop off and keeps it off', async (game) => {
  await game.clickText(UI.settings);
  await game.waitForScene('SettingsScene');
  assert(await game.hasText(SETTINGS.music(true)), 'on by default');
  await game.clickText(SETTINGS.music(true));
  assert(await game.hasText(SETTINGS.music(false)), 'and the button says so once tapped');
  await game.clickText(UI.back);
  await game.waitForScene('TitleScene');

  await game.startRun();
  await game.tapDpad('right');
  await game.settle();
  assertEqual(await game.music(), false, 'a run started with it off stays silent');
});

test('every button taps back, and the D-pad does not', async (game) => {
  const taps = async () => (await game.sounds()).filter((s) => s === 'tap').length;
  assertEqual(await taps(), 0, 'nothing has been touched yet');

  await game.clickText(UI.settings);
  await game.waitForScene('SettingsScene');
  assertEqual(await taps(), 1, 'a button makes a sound');
  await game.clickText(UI.back);
  await game.waitForScene('TitleScene');
  assertEqual(await taps(), 2, 'so does the one that comes back');

  await game.startRun();
  // Walking is the one control tapped often enough that a sound on it would
  // turn an expedition into a rattle, so the D-pad is the exception. A loop
  // through the base's guaranteed-floor neighbourhood that stays clear of the
  // hut itself, so the hut's own dialog doesn't interrupt the count.
  const before = await taps();
  for (const dir of ['left', 'up', 'up']) {
    await game.tapDpad(dir);
    await game.settle();
  }
  assertEqual(await taps(), before, 'the D-pad walks silently');

  // The HUD is buttons again, so it is audible again.
  await game.tapCoins();
  assertEqual(await taps(), before + 1, 'the coin counter is a button like any other');
});

test('the whole game fits a portrait phone screen', async (game) => {
  // Phaser fits the canvas to #game, so if #game is not the viewport the canvas
  // overflows it — which used to push the map's X button off the side and let
  // the page pan sideways, swallowing taps.
  const phone = await game.openAnother({ viewport: { width: 390, height: 844 } });
  const fit = await phone.canvasFit();
  const where = JSON.stringify(fit);

  assert(fit.left >= -1 && fit.top >= -1, `canvas starts off screen: ${where}`);
  assert(fit.right <= fit.viewport.width + 1, `canvas runs off the side: ${where}`);
  assert(fit.bottom <= fit.viewport.height + 1, `canvas runs off the bottom: ${where}`);
  assert(!fit.pageScrollsX && !fit.pageScrollsY, `the page scrolls behind the canvas: ${where}`);
});

test('the tile sheet is loaded and cut into every sprite the game draws', async (game) => {
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
  // Every other test gets to a run through `startRun`, which reads the panel to
  // the end on the way past. This one takes the long way round, because the
  // panel is the thing it is about.
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
  assert(opening.shown.length < opening.full.length, 'and it is not all there yet');

  // Progressively: two reads a beat apart see different amounts of it.
  await game.page.waitForTimeout(150);
  const more = await game.textPanel();
  assert(more.shown.length > opening.shown.length, 'it fills itself in as it goes');
  assert((await game.sounds()).includes('text'), 'and it is audible doing it');

  // The first tap fills the block in rather than skipping past it.
  await game.tapPanel();
  const filled = await game.textPanel();
  assertEqual(filled.index, 0, 'a tap mid-sentence is not a tap to the next block');
  assertEqual(filled.shown, filled.full, 'it puts the rest of it up at once');

  // The next one moves on.
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
