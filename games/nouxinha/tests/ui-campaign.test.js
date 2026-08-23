// The campaign around a walk: the hut's question, the recap, the three slots,
// what each way of ending a run writes down, and the two tools in the corner.
// Each test drives a fresh page against the real canvas.

import { assert, assertEqual, runIfMain, test as browserTest } from './harness.js';
import { createRun, maxWater, spendable } from '../src/core/rules.js';
import { emptySave } from '../src/core/save.js';
import { decodeExplored } from '../src/core/cartography.js';
import { compassTarget } from '../src/core/compass.js';
import { PRICES } from '../src/balance.js';
import { PALETTES, gemColour } from '../src/config.js';
import {
  FIRST_GEM,
  GEM_ROUTE,
  MERCHANT_ROUTE,
  NONCE,
  SEED,
  TORCH_ROUTE,
  test,
  walkPath,
} from './world.js';

// One tile out and straight back: the shortest walk that ends on the hut, which
// is the only tile that offers to end a run.
const OUT_AND_BACK = ['right', 'left'];

test('the hut asks whether to stop, and keeping going refills the tank', async (game) => {
  await game.startRun();

  // A loop through the base's guaranteed-floor neighbourhood that only lands
  // back on the hut at the very end, so the water spend is real before the
  // dialog interrupts anything.
  await walkPath(game, ['right', 'up', 'left', 'down']);
  const before = await game.state();
  assertEqual({ x: before.x, y: before.y }, { x: 0, y: 0 }, 'back at the hut');
  assert(before.water < 200, 'water spent walking the loop');
  assertEqual(before.dialogOpen, true, 'the hut asks on arrival');
  assert(await game.hasText('BACK AT THE HUT'), 'the prompt');

  // The world is frozen behind the question.
  await game.tapDpad('right');
  assertEqual((await game.state()).x, 0, 'no stepping out from under the dialog');

  await game.clickText('KEEP GOING');
  assertEqual((await game.state()).dialogOpen, false, 'dismissed');
  assert(await game.hasText('WATER REFILLED AT THE HUT.'), 'the status line says so');
  const after = await game.state();
  assertEqual(after.water, 200, 'topped back up to the ceiling');
  assert((await game.texts()).includes('WATER 200/200'), 'the HUD counter agrees');

  await game.tapDpad('right');
  await game.settle();
  assertEqual((await game.state()).x, 1, 'and the run carries on');
});

test('the cogwheel menu closes without touching the run, and Esc opens it', async (game) => {
  await game.startRun();
  await game.tapDpad('right');
  await game.settle();
  const walking = await game.state();

  await game.tapMenuButton();
  assertEqual((await game.state()).menuOpen, true, 'the menu is up');
  await game.clickText('KEEP PLAYING');
  const closed = await game.state();
  assertEqual(closed.menuOpen, false, 'and closes again');
  assertEqual(closed.steps, walking.steps, 'having cost the run nothing');
  // NEW GAME claimed the slot, so there is a save — but nothing suspended in it:
  // opening the menu and closing it again is not saving (DESIGN.md §6.1).
  assertEqual((await game.save()).run, null, 'and suspended no expedition into the slot');

  // Esc is the keyboard's cogwheel, both ways.
  await game.press('Escape');
  assertEqual((await game.state()).menuOpen, true, 'Esc opens it');
  await game.press('Escape');
  assertEqual((await game.state()).menuOpen, false, 'and Esc closes it');

  // A step still has to go through the world, not the menu.
  await game.tapDpad('up');
  await game.settle();
  assert((await game.state()).steps > walking.steps, 'and the run walks on afterwards');
});

test('stopping at the hut recaps the run and writes the slot; leaving keeps only the ground', async (game) => {
  await game.startRun();
  // NEW GAME claims the slot, so there is a save — an empty one, with nothing
  // banked into it yet.
  assertEqual((await game.save()).runs, 0, 'a first run starts with nothing banked');

  await walkPath(game, OUT_AND_BACK);
  await game.clickText('STOP HERE');

  assert(await game.hasText('EXPEDITION OVER'), 'the recap');
  const texts = await game.texts();
  for (const label of ['TILES EXPLORED', 'COINS', 'LIGHTS FOUND', 'FURTHEST OUT', 'STEPS TAKEN'])
    assert(texts.includes(label), `the recap reports ${label}`);
  // One tile out and back: the 3x3 around the base plus the three tiles the
  // step east added, in two steps.
  assert(texts.includes('12'), 'the tiles-explored figure');
  assert(texts.includes('2'), 'the step count');
  assert(texts.some((t) => t.startsWith('CARRYING SMALL TORCH')), 'what is still in hand');
  assert(await game.hasText('COLOURS SAVED'), 'and what was banked');

  const saved = await game.save();
  assertEqual(saved.runs, 1, 'the run was written down');
  assertEqual(saved.gems, 0, 'with no colour on it');
  assert(saved.mapped.length > 0, 'and the ground it lit came home with it');

  await game.clickText('HOME');
  await game.waitForScene('TitleScene');
  assert(await game.hasText('0/3 COLOURS  0 COINS  1 RUNS'), 'the title screen reads it back');

  // Leaving by the cogwheel banks nothing — only the hut does (DESIGN.md §6) —
  // but the dark this run lit stays lit for the next one (§6.1). It asks first,
  // because an abandoned expedition cannot be got back.
  await game.startRun();
  assert((await game.state()).explored > 9, 'the next run opens on the ground already drawn');
  await walkPath(game, ['right', 'up']);
  const abandoned = await game.state();
  await game.tapMenuButton();
  await game.clickText('EXIT GAME');
  assert(await game.hasText('LEAVE THE DARK'), 'leaving asks before it costs the walk');
  await game.clickText('LEAVE');
  await game.waitForScene('TitleScene');

  const after = await game.save();
  assertEqual(after.runs, 1, 'the abandoned run was not counted');
  assertEqual(decodeExplored(after.mapped).size, abandoned.explored, 'but its walk was kept');
});

test('a long carried list wraps the recap footer without it running into the buttons', async (game) => {
  const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

  await game.startRun();
  await walkPath(game, TORCH_ROUTE.path);
  await walkPath(game, [...TORCH_ROUTE.path].reverse().map((dir) => OPPOSITE[dir]));
  await game.clickText('STOP HERE');

  const texts = await game.texts();
  const footer = texts.find((t) => t.startsWith('CARRYING'));
  assert(footer, 'the carried-items footer is on screen');
  // Long enough to wrap inside the panel's fixed width — the small torch
  // carried from the start, the medium one just found, and the two tools.
  assert(footer.length > 45, `footer is long enough to wrap (was ${JSON.stringify(footer)})`);

  const bounds = await game.page.evaluate((footerText) => {
    // Phaser.Geom.Rectangle's top/bottom are getters, which the structured
    // clone back to the test runner drops — so pull the plain numbers out
    // here rather than returning the Rectangle itself.
    const plain = (b) => ({ top: b.top, bottom: b.bottom });
    const found = { footer: null, home: null };
    const walk = (list) => {
      for (const c of list) {
        if (!c.visible) continue;
        if (c.text === footerText) found.footer = plain(c.getBounds());
        if (c.text === 'HOME') found.home = plain(c.getBounds());
        if (c.list) walk(c.list);
      }
    };
    walk(window.__game.scene.getScenes(true).slice(-1)[0].children.list);
    return found;
  }, footer);

  assert(bounds.footer && bounds.home, 'both the footer and the HOME button were found');
  assert(
    bounds.footer.bottom <= bounds.home.top,
    `the wrapped footer (bottom ${bounds.footer.bottom}) overlaps the HOME button (top ${bounds.home.top})`
  );
}, { save: { ...emptySave(), compass: true, map: true } });

test('walking into the first sanctum restores a colour to the world', async (game) => {
  await game.startRun();

  assertEqual((await game.wizardZoneTints())[1], gemColour(0), 'the wizard starts in the palette foreground');
  assertEqual((await game.state()).gems, 0, 'and with no colour to their name');

  await walkPath(game, GEM_ROUTE.path);

  const state = await game.state();
  assertEqual({ x: state.x, y: state.y }, FIRST_GEM.centre, 'standing on the gem');
  assertEqual(state.gems, 1, 'which is now in hand');
  // A gem gets the fanfare, not the two-note blip every other pickup gets.
  assert((await game.sounds()).includes('gem'), 'and it announced itself');
  assert(await game.hasText('FIRST COLOUR IS BACK. CARRY IT HOME TO KEEP IT.'), 'the status line');

  // The colour actually reached the screen — this is the whole point of a gem,
  // and it is only observable in the render.
  const zoneTints = await game.wizardZoneTints();
  assertEqual(zoneTints[0], gemColour(0), 'the base band stays the palette foreground');
  assertEqual(zoneTints[1], gemColour(1), 'the first gem band wears the colour it gave back');
  const tiles = await game.visibleTiles();
  const walls = tiles.filter((t) => t.ground.startsWith('wall'));
  assert(walls.length > 0, 'the sanctum is drawn as masonry, not as rock');
  // And the masonry has taken the colour of the gem this sanctum kept: the
  // stonework stays the palette's own foreground, the crown of the ring over it
  // wears the colour that was just brought back (DESIGN.md §9).
  assert(walls.every((t) => t.tint === gemColour(0)), 'the stonework is still the foreground');
  assert(
    walls.some((t) => t.paint.includes(gemColour(1))),
    "the ring wears the colour of the gem it kept"
  );
  // The arch they walked in through is drawn open. Its leaves are in the colour
  // of whatever opened it — this first sanctum is the one that never wanted a
  // gem, so they stay plain, while the arch over them belongs to the sanctum.
  const arch = tiles.find((t) => t.x === FIRST_GEM.gate.x && t.y === FIRST_GEM.gate.y);
  assertEqual(arch.ground, 'gate-open', 'the gateway is drawn as an open arch');
  assertEqual(arch.paint[1], gemColour(FIRST_GEM.requires), 'its leaves are the colour of whatever opened it');
  assertEqual(arch.paint[0], gemColour(1), "and its arch the colour of the sanctum's own gem");
  // Water rises with the gem, so the HUD's ceiling moves too.
  assert(await game.hasText(`WATER ${state.water}/${maxWater(1)}`), 'the water ceiling rose');
});

test('the cogwheel saves the walk, and load game carries it on', async (game) => {
  await game.startRun();
  // Out a few tiles, so there is a walk worth saving rather than a hut to
  // stand on — arriving back at (0, 0) would open the hut's question instead.
  await walkPath(game, TORCH_ROUTE.path);
  const walked = await game.state();

  await game.tapMenuButton();
  assert(await game.hasText('MENU'), 'the cogwheel opens the menu');
  for (const label of ['SETTINGS', 'SAVE GAME', 'EXIT GAME', 'KEEP PLAYING'])
    assert(await game.hasText(label), `${label} is on it`);

  await game.clickText('SAVE GAME');
  assert(await game.hasText('EXPEDITION SAVED'), 'saving says so');
  const saved = await game.save();
  assertEqual(saved.run.x, walked.x, 'and the slot is holding the tile it was standing on');
  assertEqual(saved.run.y, walked.y, 'both ways');
  assertEqual(saved.run.steps, walked.steps, 'with the steps it had taken');
  assertEqual(saved.runs, 0, 'but nothing is banked by saving — only the hut does that');

  // The question saving asks: carry on, or stop here for now.
  await game.clickText('KEEP PLAYING');
  assertEqual((await game.state()).dialogOpen, false, 'keeping playing hands the world back');
  await game.tapDpad('up');
  await game.settle();
  assert((await game.state()).steps > walked.steps, 'and the run walks on from where it was');

  // Leaving without saving again leaves the save alone: the walk since the last
  // SAVE GAME is what is lost, not the save itself (DESIGN.md §6.1).
  await game.tapMenuButton();
  await game.clickText('EXIT GAME');
  await game.clickText('LEAVE');
  await game.waitForScene('TitleScene');
  assertEqual((await game.save()).run.steps, walked.steps, 'the saved walk is still the saved one');

  // And LOAD GAME picks that expedition up rather than setting out again.
  await game.clickText('LOAD GAME');
  await game.waitForScene('SlotScene');
  assert(
    await game.hasText(`SAVED EXPEDITION  ${walked.furthest} OUT  ${walked.steps} STEPS`),
    'the picker says the slot is mid-walk'
  );
  await game.clickText('SLOT 1');
  await game.waitForScene('ExploreScene');

  const resumed = await game.state();
  assertEqual(resumed.x, walked.x, 'the run resumes on the tile it saved on');
  assertEqual(resumed.y, walked.y, 'both ways');
  assertEqual(resumed.steps, walked.steps, 'with its steps');
  assertEqual(resumed.water, walked.water, 'its water');
  assertEqual(resumed.inventory, walked.inventory, 'and every light burned down as far as it was');
  assertEqual(resumed.epoch, walked.epoch, 'onto the same scatter it left');
  assertEqual(resumed.nonce, walked.nonce, 'salt and all');
});

test('settings mid-run comes back to the same tile, in the new palette', async (game) => {
  await game.startRun();
  await game.tapDpad('right');
  await game.settle();
  const walking = await game.state();

  await game.tapMenuButton();
  await game.clickText('SETTINGS');
  await game.waitForScene('SettingsScene');
  // Picking a palette re-enters Settings to repaint it, which is the step that
  // has to carry the run along with it.
  await game.clickText('AMBER');
  await game.waitForScene('SettingsScene');
  assert(await game.hasText('SETTINGS'), 'still on the settings screen, repainted');

  await game.clickText('BACK');
  await game.waitForScene('ExploreScene');
  const back = await game.state();
  assertEqual(back.x, walking.x, 'the same tile');
  assertEqual(back.y, walking.y, 'both ways');
  assertEqual(back.steps, walking.steps, 'and not a step was spent on the round trip');
  assertEqual(back.water, walking.water, 'nor a drop of water');
  // Ground is drawn in the palette's own foreground (src/ui/MapView.js), so the
  // tint on a tile is how a test sees which palette the page is actually in.
  const amber = PALETTES.find((option) => option.name === 'AMBER');
  assertEqual((await game.visibleTiles())[0].tint, amber.fg, 'the world is drawn in the palette just picked');
});

// Deliberately opened on no seed: the only test that wants whatever world
// NEW GAME draws, because what it is checking is that it draws one at all.
browserTest('each slot is a campaign of its own, in a world of its own', async (game) => {
  // Three campaigns, and the picker says what is in all three (DESIGN.md §6.1).
  await game.clickText('NEW GAME');
  await game.waitForScene('SlotScene');
  for (const slot of ['SLOT 1', 'SLOT 2', 'SLOT 3']) assert(await game.hasText(slot), `${slot} is offered`);
  assertEqual((await game.texts()).filter((t) => t === 'EMPTY').length, 3, 'all three empty');

  // Bank a run in each of two slots: out one tile, back, and stop at the hut.
  const worldOf = async (slot) => {
    await game.clickText(slot);
    await game.waitForScene('ExploreScene');
    const seed = (await game.state()).seed;
    await walkPath(game, OUT_AND_BACK);
    await game.clickText('STOP HERE');
    await game.clickText('HOME');
    await game.waitForScene('TitleScene');
    return seed;
  };

  const first = await worldOf('SLOT 1');
  await game.clickText('NEW GAME');
  await game.waitForScene('SlotScene');
  const second = await worldOf('SLOT 2');
  assert(first !== second, `two campaigns, two worlds (both got ${first})`);

  // Banking rebuilds the save from scratch (`bankRun` in core/rules.js), so this
  // is where a slot would quietly lose the world it has been mapping.
  assertEqual((await game.save(1)).seed, first, 'slot 1 kept the world it walked');
  assertEqual((await game.save(2)).seed, second, 'and slot 2 kept its own');
  assertEqual((await game.save(3)), null, 'slot 3 was never touched');

  await game.clickText('LOAD GAME');
  await game.waitForScene('SlotScene');
  assert(await game.hasText('0/3 COLOURS  0 COINS  1 RUNS'), 'the picker reads a slot back');
  assertEqual((await game.texts()).filter((t) => t === 'EMPTY').length, 1, 'the third is still free');
  await game.clickText('SLOT 1');
  await game.waitForScene('ExploreScene');
  const resumed = await game.state();
  assertEqual(resumed.seed, first, 'and it walks its own world again next expedition');
  assertEqual(resumed.banked.runs, 1, 'carrying on where it left off');
  assert(resumed.explored > 9, 'on the ground that campaign had already lit');
});

// A suspended expedition with one mouthful of water left, planted straight into
// the slot. It is prior state, not live state — the browser's version of handing
// `resumeRun` a save — and it is the only practical way to get a browser test to
// the death screen, since a full tank is 200 taps away from empty.
const THIRSTY_RUN = {
  ...emptySave(),
  run: {
    seed: SEED,
    x: 0,
    y: 0,
    facing: 'up',
    steps: 40,
    water: 1,
    coins: 0,
    gems: 0,
    furthest: 4,
    nonce: NONCE,
    epoch: 0,
    tools: [],
    inventory: [{ id: 'torch-small', durability: 60 }],
    activeIndex: 0,
    found: {},
    collected: '',
    startExplored: 0,
    banked: emptySave(),
  },
};

test('running dry takes the saved expedition with it', async (game) => {
  // LOAD GAME resumes the planted walk, which has one step of water in it.
  await game.startRun();
  assertEqual((await game.state()).water, 1, 'resumed on its last mouthful');

  await game.tapDpad('right');
  await game.settle();
  assert(await game.hasText('OUT OF WATER'), 'the step that empties the flask ends the run');

  // Death is the game's one hard failure (DESIGN.md §6.1), so the save it was
  // walking on goes with it — the campaign keeps only what it had banked, and
  // the ground.
  const after = await game.save();
  assertEqual(after.run, null, 'the saved expedition is gone');
  assert(after.mapped.length > 0, 'but the ground it lit is not');
  await game.clickText('HOME');
  await game.waitForScene('TitleScene');
  await game.clickText('LOAD GAME');
  await game.waitForScene('SlotScene');
  assert(await game.hasText('FURTHEST OUT 0'), 'and the slot is a campaign to walk out from again');
}, { save: THIRSTY_RUN });

test('cheats reveal the map, hand you everything, and save nothing', async (game) => {
  // The switch is in Settings, and the title screen says it is on, because a
  // run under it banks nothing (DESIGN.md §6.2).
  await game.clickText('SETTINGS');
  await game.waitForScene('SettingsScene');
  assert(await game.hasText('CHEATS: OFF'), 'off by default');
  await game.clickText('CHEATS: OFF');
  assert(await game.hasText('CHEATS: ON'), 'and the button says so once tapped');
  await game.clickText('BACK');
  await game.waitForScene('TitleScene');
  assert(await game.hasText('CHEATS ON — NOTHING WILL BE SAVED'), 'the title screen warns');

  await game.startRun();
  const state = await game.state();
  assertEqual(state.gems, 3, 'every colour is back');
  assertEqual(state.tools.sort(), ['compass', 'map'], 'both tools are in the corner');
  assertEqual(state.compassShown, true, 'the needle is there to read');
  assert(state.explored > 10000, 'and the world is drawn out past the last sanctum');

  // Straight back onto the hut, which is the one place a run can write itself.
  await walkPath(game, OUT_AND_BACK);
  await game.clickText('STOP HERE');
  assert(await game.hasText('CHEATS ON — NOTHING WAS WRITTEN TO THE SLOT'), 'the recap says so');
  assertEqual((await game.save()).runs, 0, 'and the slot is untouched');
});

test('walking onto the merchant opens the counter, and buying spends the purse', async (game) => {
  await game.startRun();
  // The purse is what the merchant spends: everything banked plus what this run
  // is carrying, which is what the HUD counter has to show (DESIGN.md §4.5).
  assertEqual((await game.state()).coins, 0, 'this run has found nothing yet');
  assert(await game.hasText('COINS 200'), 'but the counter shows the banked fortune');

  await walkPath(game, MERCHANT_ROUTE.path);

  let state = await game.state();
  assertEqual(state.shopOpen, true, 'arriving at the stall opens it');
  assert(await game.hasText('THE MERCHANT'), 'the counter');
  assert(await game.hasText(`YOU HAVE ${spendable(state)} COINS`), 'and what you can spend');

  // The first row is the water drop (src/data/shop.js STOCK).
  const before = { water: state.water, coins: spendable(state) };
  await game.tapShopRow(0);
  state = await game.state();
  assert(state.water > before.water, 'the drop refilled the tank');
  assertEqual(spendable(state), before.coins - PRICES['water-drop'], 'and cost its price');
  assertEqual(state.shopOpen, true, 'the counter stays open for another purchase');

  await game.clickText('LEAVE');
  assertEqual((await game.state()).shopOpen, false, 'and closes when you leave');
}, { save: { ...emptySave(), coins: 200 } });

test('the compass sits in the corner and points where the rules say', async (game) => {
  await game.startRun();

  const state = await game.state();
  assertEqual(state.compassShown, true, 'a run that owns one sees it');
  assertEqual(state.tools, ['compass'], 'and owns exactly that');

  const expected = compassTarget(createRun(SEED, { ...emptySave(), compass: true }, NONCE));
  assertEqual(state.compassTarget.sprite, expected.sprite, 'the icon is what it is pointing at');
  assert(
    ['arrow-up', 'arrow-right', 'arrow-down', 'arrow-left'].includes(state.compassTarget.arrow),
    'and the needle is one of the four headings'
  );
}, { save: { ...emptySave(), compass: true } });

test('the map draws the ground this run has walked', async (game) => {
  await game.startRun();
  await walkPath(game, ['right', 'right', 'up', 'up', 'up']);

  const before = await game.state();
  await game.tapMapButton();
  assertEqual((await game.state()).mapOpen, true, 'the map button opens it');
  assert(await game.hasText('THE MAP'), 'the overlay');
  assert(await game.hasText(`${before.explored} TILES WALKED`), 'and it draws what was lit');

  await game.clickText('CLOSE');
  assertEqual((await game.state()).mapOpen, false, 'and closes again');
}, { save: { ...emptySave(), map: true } });

runIfMain(import.meta.url);
