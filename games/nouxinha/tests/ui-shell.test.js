// Everything around a run: the title screen, Settings, the audio switches, the
// canvas against a real phone, and that the tile sheet actually loaded. Each
// test drives a fresh page against the real canvas.

import { assert, assertEqual, runIfMain, test as browserTest } from './harness.js';
import { test } from './world.js';

browserTest('a button responds across its whole width, not just the left half', async (game) => {
  assert(await game.hasText('NOUXINHA'), 'the title screen is up');
  // NEW GAME is a 240-wide button centred on (240, 566) (TitleScene.js), so its
  // right edge sits at x=360. Tapping 90px right of centre is still 30px
  // inside the button — Container.displayOriginX shifting the hit area left
  // by half the button's width (the bug this pins) would make this miss.
  await game.clickAt(330, 566);
  await game.waitForScene('SlotScene');
  assertEqual(await game.activeScene(), 'SlotScene', 'scene');
});

test('settings: picking a palette and going back both work on a single tap', async (game) => {
  await game.clickText('SETTINGS');
  await game.waitForScene('SettingsScene');
  assertEqual(await game.activeScene(), 'SettingsScene', 'scene');

  // Picking a row restarts the scene in the new palette — one tap, not several.
  await game.clickText('AMBER');
  await game.waitForScene('SettingsScene');
  assert(await game.hasText('AMBER'), 'still on the palette list, repainted');

  // Restore the default so this test doesn't change what every other test sees.
  await game.clickText('PHOSPHOR');
  await game.waitForScene('SettingsScene');

  await game.clickText('BACK');
  await game.waitForScene('TitleScene');
  assertEqual(await game.activeScene(), 'TitleScene', 'back to the title screen');
});

test('the music follows the scene: the menus get one loop, the dark another', async (game) => {
  assertEqual(await game.musicTrack(), 'menu', 'the title screen has its own small loop');
  await game.clickText('SETTINGS');
  await game.waitForScene('SettingsScene');
  assertEqual(await game.musicTrack(), 'menu', 'and it carries on across the menus');
  await game.clickText('BACK');
  await game.waitForScene('TitleScene');

  await game.startRun();
  // The loop is started by the scene and again by the first input, because a
  // page the player has not touched yet has no clock to schedule against.
  await game.tapDpad('right');
  await game.settle();
  assertEqual(await game.musicTrack(), 'explore', 'the dark gets the longer loop');

  // Out through the cogwheel, which is the only way out of a run.
  await game.tapMenuButton();
  await game.clickText('EXIT GAME');
  await game.clickText('LEAVE');
  await game.waitForScene('TitleScene');
  assertEqual(await game.musicTrack(), 'menu', 'and the menus take theirs back');
});

test('the music switch turns the loop off and keeps it off', async (game) => {
  await game.clickText('SETTINGS');
  await game.waitForScene('SettingsScene');
  assert(await game.hasText('MUSIC: ON'), 'on by default');
  await game.clickText('MUSIC: ON');
  assert(await game.hasText('MUSIC: OFF'), 'and the button says so once tapped');
  await game.clickText('BACK');
  await game.waitForScene('TitleScene');

  await game.startRun();
  await game.tapDpad('right');
  await game.settle();
  assertEqual(await game.music(), false, 'a run started with it off stays silent');
});

test('every button taps back, and the D-pad does not', async (game) => {
  const taps = async () => (await game.sounds()).filter((s) => s === 'tap').length;
  assertEqual(await taps(), 0, 'nothing has been touched yet');

  await game.clickText('SETTINGS');
  await game.waitForScene('SettingsScene');
  assertEqual(await taps(), 1, 'a button makes a sound');
  await game.clickText('BACK');
  await game.waitForScene('TitleScene');
  assertEqual(await taps(), 2, 'so does the one that comes back');

  await game.startRun();
  // Walking is the one control tapped often enough that a sound on it would
  // turn an expedition into a rattle, so the D-pad is the exception.
  const before = await taps();
  for (const dir of ['right', 'up', 'left']) {
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

  // The keys the renderer names have to be among them, or a tile draws blank.
  for (const key of ['floor', 'rock-2', 'tree-7', 'wall-tl', 'base', 'wizard-down-0'])
    assert(cut.sprites.some((s) => s.key === key), `${key} was cut`);
});

runIfMain(import.meta.url);
