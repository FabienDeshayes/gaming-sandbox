// The campaign around a walk: the hut's question, the recap, the three slots,
// what each way of ending a run writes down, and the two payoffs a run walks
// out for — a sanctum's colour and a chest's key. Each test drives a fresh page
// against the real canvas.
//
// Everything here is either what a slot ends up holding or what the screen ends
// up showing, because that is the whole of what a browser is being paid for
// (TESTING.md, "What earns a browser test"). A menu that opens and closes, a
// screen that comes back to the same tile, a panel whose text clears its own
// buttons: those are not rules of this game and do not belong in a suite that
// has to stay quick enough to run between two edits.
//
// The routes out to a sanctum, a chest and the merchant are thirty-odd taps
// each, and none of those taps is what is being asserted: that the routes exist
// and are walkable is a pure claim (`campaign.test.js`, `terrain.test.js`), so
// the walks here are planted on the doorstep and only the last step is taken.

import { assert, assertEqual, runIfMain, test as browserTest } from './harness.js';
import { maxWater, spendable } from '../src/core/rules.js';
import { emptySave, MAX_GEMS } from '../src/core/save.js';
import { decodeExplored } from '../src/core/cartography.js';
import { PRICES } from '../src/balance.js';
import { gemColour, getPalette, invertColour } from '../src/config.js';
import { BIOME_IDS } from '../src/data/biomes.js';
import {
  CREDITS,
  DEATH,
  FLASH,
  HALL,
  HUD,
  HUT,
  ITEM_TEXT,
  LEAVING,
  MENU,
  RECAP,
  SAVED,
  SHOP,
  SLOTS,
  UI,
  WORLD_MAP,
  progressLine,
} from '../src/text.js';
import {
  ALL_KEYS_LIST,
  BIOME,
  FIRST_GEM,
  GEM_ROUTE,
  HALL as THE_HALL,
  HALL_ROUTE,
  KEY_CHEST,
  KEY_CHEST_BUMP,
  KEY_CHEST_ROUTE,
  MERCHANT_ROUTE,
  NONCE,
  ROCK_ROUTE,
  SEED,
  standingAt,
  stepsAfter,
  test,
  walkPath,
} from './world.js';

// The shortest walk that ends on the hut, which is the only tile that offers to
// end a run — a run starts one tile south of it, so a single step home does it.
const OUT_AND_BACK = ['up'];

test('reaching the hut banks the walk and fills the tank, and the run goes on', async (game) => {
  await game.startRun();

  // A loop through the base's guaranteed-floor neighbourhood that only lands
  // back on the hut at the very end, so the water spend is real before the
  // dialog interrupts anything. A run starts one tile south of the hut, so
  // the loop has to clear it on the way out and only cross it on the way in.
  await walkPath(game, ['right', 'up', 'up', 'left', 'down']);
  const before = await game.state();
  assertEqual({ x: before.x, y: before.y }, { x: 0, y: 0 }, 'back at the hut');
  assertEqual(before.water, 200, 'the tank is filled by arriving, not by answering');
  assertEqual(before.dialogOpen, true, 'and the hut says so on arrival');
  assert(await game.hasText(HUT.title), 'the prompt');

  // The ground is in the slot before either button has been touched — arriving
  // is what banks a walk now, so neither answer can cost it (DESIGN.md §6.1).
  assert((await game.save()).mapped.length > 0, 'the walk is already written down');
  assertEqual((await game.save()).runs, 0, 'without the expedition being over');

  // Both buttons are named, and what they mean is on the panel rather than left
  // to be guessed at — the whole point of the change.
  assert(await game.hasText(HUT.nothingNew), 'what just happened');
  assert(await game.hasText(HUT.bothWays[0]), 'and what each button means');

  // The world is frozen behind the question.
  await game.tapDpad('right');
  assertEqual((await game.state()).x, 0, 'no stepping out from under the dialog');

  await game.clickText(HUT.headBackOut);
  assertEqual((await game.state()).dialogOpen, false, 'dismissed');
  assert(await game.hasText(FLASH.headBackOut), 'the status line says so');
  assert((await game.texts()).includes('WATER 200/200'), 'the HUD counter agrees');

  await game.tapDpad('right');
  await game.settle();
  assertEqual((await game.state()).x, 1, 'and the run carries on');
});

test('stopping at the hut recaps the run and writes the slot; leaving keeps only the ground', async (game) => {
  await game.startRun();
  // NEW GAME claims the slot, so there is a save — an empty one, with nothing
  // banked into it yet.
  assertEqual((await game.save()).runs, 0, 'a first run starts with nothing banked');

  await walkPath(game, OUT_AND_BACK);
  await game.clickText(HUT.endHere);

  assert(await game.hasText(RECAP.title), 'the recap');
  const texts = await game.texts();
  for (const label of [RECAP.rowExplored, RECAP.rowCoins, RECAP.rowLights, RECAP.rowFurthest, RECAP.rowSteps])
    assert(texts.includes(label), `the recap reports ${label}`);
  // The 3x3 around the start tile plus the row the step onto the hut added,
  // in one step.
  assert(texts.includes('12'), 'the tiles-explored figure');
  assert(texts.includes('1'), 'the step count');
  assert(texts.some((t) => t.startsWith(RECAP.carrying(ITEM_TEXT['torch-small'].name))), 'what is still in hand');
  assert(await game.hasText(RECAP.rowColours), 'and what was banked');

  const saved = await game.save();
  assertEqual(saved.runs, 1, 'the run was written down');
  assertEqual(saved.gems, 0, 'with no colour on it');
  assert(saved.mapped.length > 0, 'and the ground it lit came home with it');

  await game.clickText(RECAP.home);
  await game.waitForScene('TitleScene');

  // Leaving by the cogwheel banks nothing — only the hut does (DESIGN.md §6) —
  // but the dark this run lit stays lit for the next one (§6.1). It asks first,
  // because an abandoned expedition cannot be got back.
  await game.startRun();
  assert((await game.state()).explored > 9, 'the next run opens on the ground already drawn');
  await walkPath(game, ['right', 'up']);
  const abandoned = await game.state();
  await game.tapMenuButton();
  await game.clickText(MENU.exit);
  assert(await game.hasText(LEAVING.title), 'leaving asks before it costs the walk');
  await game.clickText(LEAVING.leave);
  await game.waitForScene('TitleScene');

  const after = await game.save();
  assertEqual(after.runs, 1, 'the abandoned run was not counted');
  assertEqual(decodeExplored(after.mapped).size, abandoned.explored, 'but its walk was kept');
});

// Standing one step outside the first sanctum's own arch — not next to its
// prize, because the masonry has to be walked past to be drawn at all: a
// planted run has lit nothing, and the ring is only on screen because the walk
// in lit it. Sanctum 1's arch is the one that stands open, so a walk carrying
// nothing gets this far on its own.
const AT_GEM = standingAt(GEM_ROUTE, { back: stepsAfter(GEM_ROUTE, FIRST_GEM.gate) + 1 });

test('walking into the first sanctum restores a colour to the world', async (game) => {
  await game.startRun();

  assertEqual((await game.wizardZoneTints())[1], gemColour(0), 'the wizard starts in the palette foreground');
  assertEqual((await game.state()).gems, 0, 'and with no colour to their name');

  await walkPath(game, AT_GEM.path);

  const state = await game.state();
  assertEqual({ x: state.x, y: state.y }, FIRST_GEM.centre, 'standing on the gem');
  assertEqual(state.gems, 1, 'which is now in hand');
  // A gem gets the fanfare, not the two-note blip every other pickup gets.
  assert((await game.sounds()).includes('gem'), 'and it announced itself');
  assert(await game.hasText(FLASH.gemFound(ITEM_TEXT['gem-1'].name)), 'the status line');

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
  assertEqual(arch.paint[1], gemColour(FIRST_GEM.colour), 'its leaves are the colour of whatever opened it');
  assertEqual(arch.paint[0], gemColour(1), "and its arch the colour of the sanctum's own gem");
  // Water rises with the gem, so the HUD's ceiling moves too.
  assert(await game.hasText(HUD.water(state.water, maxWater(1))), 'the water ceiling rose');
}, { save: AT_GEM.save });

// Standing on the chest's apron. A chest can't be stepped on, so the route ends
// one tile east of it and the input under test is the bump westward.
const AT_CHEST = standingAt(KEY_CHEST_ROUTE);

test('walking into a chest opens it, says its piece, and hands over the key', async (game) => {
  await game.startRun();

  // It is drawn shut, and it does not stop the light: the wizard is standing
  // right next to it, so the ground behind it has to be lit too.
  const shut = await game.visibleTiles();
  const before = shut.find((t) => t.x === KEY_CHEST.x && t.y === KEY_CHEST.y);
  assertEqual(before.ground, 'chest', 'the chest is drawn shut');

  // Opening it is a bump, not a step — the wizard never moves onto the tile.
  const standing = await game.state();
  await game.tapDpad(KEY_CHEST_BUMP);
  await game.settle();
  const opened = await game.state();
  assertEqual({ x: opened.x, y: opened.y }, { x: standing.x, y: standing.y }, 'the step did not happen');
  assertEqual(opened.steps, standing.steps, 'and cost no step');
  assertEqual(opened.water, standing.water, 'and no water');
  assertEqual(opened.keys, ['key-1'], 'but the key is in hand');
  assertEqual(opened.chests, [KEY_CHEST.id], 'and the chest is on the opened list');
  assert((await game.sounds()).includes('chest'), 'the lid was heard going up');

  // The game says its piece over the world, the way setting out does.
  assert(opened.textPanelOpen, 'the text panel is up');
  await game.readPanel();

  const after = await game.visibleTiles();
  const now = after.find((t) => t.x === KEY_CHEST.x && t.y === KEY_CHEST.y);
  assertEqual(now.ground, 'chest-open', 'and the lid stays up behind it');

  // A second visit does nothing at all — that is the whole rule.
  await game.tapDpad(KEY_CHEST_BUMP);
  await game.settle();
  assert(await game.hasText(FLASH.chestEmpty), 'walking back into it says so');
  assertEqual((await game.state()).keys, ['key-1'], 'and hands over nothing');
}, { save: AT_CHEST.save });

// Standing on the sorcerer's doorstep, at the end of the longest walk in the
// game, with everything a campaign can be holding when it gets there.
const AT_HALL = standingAt(HALL_ROUTE, {
  save: { ...emptySave(), gems: MAX_GEMS, keys: ALL_KEYS_LIST, coins: 40, compass: true },
  run: {
    gems: MAX_GEMS,
    keys: ALL_KEYS_LIST,
    tools: ['compass'],
    water: 300,
    inventory: [{ id: 'torch-beacon', durability: 60 }],
  },
});

test('walking into the sorcerer ends the world and hands you a new one', async (game) => {
  await game.startRun();

  // He is drawn standing in his clearing, and — like a chest — he stops a step
  // without stopping a light.
  const clearing = await game.visibleTiles();
  const him = clearing.find((t) => t.x === THE_HALL.centre.x && t.y === THE_HALL.centre.y);
  assertEqual(him.ground, 'sorcerer', 'he is drawn standing there');

  const standing = await game.state();
  await game.tapDpad(HALL_ROUTE.hit);
  await game.settle();

  const met = await game.state();
  assertEqual({ x: met.x, y: met.y }, { x: standing.x, y: standing.y }, 'the step did not happen');
  assertEqual(met.steps, standing.steps, 'and cost no step');
  // He gets the game's own voice, over the world, so he is visibly standing
  // there while he talks (DESIGN.md §4.9).
  assert(met.textPanelOpen, 'he has the floor');
  await game.readPanel();

  // Reading him out is what turns the world over, so the scene the test was
  // holding is gone by the time the question about the new one is up.
  await game.waitForDialog();
  const after = await game.state();
  assert(after.seed !== standing.seed, 'the world is one he has just moulded');
  assertEqual(after.cycles, 1, 'and the campaign counts it');
  assertEqual(after.gems, 0, 'the colours went with him');
  assertEqual({ x: after.x, y: after.y }, { x: 0, y: 1 }, 'and you are back at your own door');
  assert(await game.hasText(HALL.title), 'the new world says what it is');
  assert(await game.hasText(HUD.cycles(1)), 'and the HUD keeps the count from here on');

  // The slot is the campaign, and this is the one thing that rewrites the whole
  // of it: a new world, no colours, no keys, no drawing, no purse and no tools
  // (DESIGN.md §4.9).
  const saved = await game.save();
  assertEqual(saved.seed, after.seed, 'the slot walks the new world from now on');
  assertEqual(saved.cycles, 1, 'with a world behind it');
  assertEqual(saved.gems, 0, 'no colours');
  assertEqual(saved.keys, [], 'no keys');
  assertEqual(saved.mapped, '', 'and no ground drawn yet');
  assertEqual(saved.coins, 0, 'the purse is gone with everything else');
  assertEqual(saved.compass, false, 'and so is the compass');

  // And stopping here is one of the two answers, since the walk that ended in
  // the hall is already written down.
  await game.clickText(HALL.endHere);
  await game.waitForScene('TitleScene');
}, { save: AT_HALL.save });

// The same doorstep, at the end of the last kind of world a campaign has left:
// three biomes already finished, three colours in hand, and so nothing left for
// him to mould (DESIGN.md §4.9).
const AT_THE_END = standingAt(HALL_ROUTE, {
  save: {
    ...emptySave(),
    gems: MAX_GEMS,
    keys: ALL_KEYS_LIST,
    finished: BIOME_IDS.filter((id) => id !== BIOME),
  },
  run: {
    gems: MAX_GEMS,
    keys: ALL_KEYS_LIST,
    water: 300,
    inventory: [{ id: 'torch-beacon', durability: 60 }],
  },
});

test('the last world finished ends the game in the light', async (game) => {
  await game.startRun();
  await game.tapDpad(HALL_ROUTE.hit);
  await game.settle();
  assert((await game.state()).textPanelOpen, 'he has the floor one last time');
  await game.readPanel();

  // He opens his hands, the light takes the screen, and what is on the other
  // side of it is the same world drawn inside out — which is the only thing a
  // game with two colours can do to say the sun is back.
  await game.waitForScene('CreditsScene');
  assertEqual(await game.background(), invertColour(getPalette().bg),
    'the credits are drawn in the world with its colours turned over');
  assert(await game.hasText(CREDITS.title), 'and the game signs what it just did');
  assertEqual(await game.pref('nouxinha.invert.unlocked'), '1',
    'the switch that does that is in Settings from now on');

  // The campaign is still a campaign: the walk into the hall was banked, the
  // world was moulded like every other time, and the kind of world it just
  // finished is written into the slot — which is the one thing that could never
  // be worked out again from the seed.
  const saved = await game.save();
  assertEqual(saved.cycles, 1, 'the last world ended like all the others');
  assertEqual(saved.finished.length, BIOME_IDS.length, 'with every kind of world walked out');

  // A tap brings the rest of it in, and the one after leaves — back to a title
  // screen in the colours the game has always been in, because the light was the
  // ending's rather than the player's (src/config.js).
  await game.tapScreen();
  await game.tapScreen();
  await game.waitForScene('TitleScene');
  assertEqual(await game.background(), getPalette().bg, 'and the dark is back where it was');
}, { save: AT_THE_END.save });

test('the cogwheel saves the walk, and load game carries it on', async (game) => {
  await game.startRun();
  // Off the hut before saving: arriving back at (0, 0) would open the hut's own
  // question instead, and there would be no walk in progress to write down.
  await walkPath(game, ROCK_ROUTE.path);
  const walked = await game.state();

  await game.tapMenuButton();
  await game.clickText(MENU.save);
  assert(await game.hasText(SAVED.title), 'saving says so');
  const saved = await game.save();
  assertEqual(saved.run.x, walked.x, 'and the slot is holding the tile it was standing on');
  assertEqual(saved.run.y, walked.y, 'both ways');
  assertEqual(saved.run.steps, walked.steps, 'with the steps it had taken');
  assertEqual(saved.runs, 0, 'but nothing is banked by saving — only the hut does that');

  // The question saving asks: carry on, or stop here for now.
  await game.clickText(MENU.keepPlaying);
  assertEqual((await game.state()).dialogOpen, false, 'keeping playing hands the world back');
  await game.tapDpad(ROCK_ROUTE.path[0]);
  await game.settle();
  assert((await game.state()).steps > walked.steps, 'and the run walks on from where it was');

  // Leaving without saving again leaves the save alone: the walk since the last
  // SAVE GAME is what is lost, not the save itself (DESIGN.md §6.1).
  await game.tapMenuButton();
  await game.clickText(MENU.exit);
  await game.clickText(LEAVING.leave);
  await game.waitForScene('TitleScene');
  assertEqual((await game.save()).run.steps, walked.steps, 'the saved walk is still the saved one');

  // And LOAD GAME picks that expedition up rather than setting out again.
  await game.clickText(UI.loadGame);
  await game.waitForScene('SlotScene');
  assert(
    await game.hasText(SLOTS.suspended(walked.furthest, walked.steps)),
    'the picker says the slot is mid-walk'
  );
  await game.clickText(SLOTS.slotName(1));
  await game.waitForScene('ExploreScene');

  const resumed = await game.state();
  // A walk being carried on is not a character setting out, so it is not read
  // the opening piece again (src/ui/textPanel.js).
  assertEqual(resumed.textPanelOpen, false, 'and it is not talked at about setting out');
  assertEqual(resumed.x, walked.x, 'the run resumes on the tile it saved on');
  assertEqual(resumed.y, walked.y, 'both ways');
  assertEqual(resumed.steps, walked.steps, 'with its steps');
  assertEqual(resumed.water, walked.water, 'its water');
  assertEqual(resumed.inventory, walked.inventory, 'and every light burned down as far as it was');
  assertEqual(resumed.epoch, walked.epoch, 'onto the same scatter it left');
  assertEqual(resumed.nonce, walked.nonce, 'salt and all');
});

// Deliberately opened on no seed: the only test that wants whatever world
// NEW GAME draws, because what it is checking is that it draws one at all.
browserTest('each slot is a campaign of its own, in a world of its own', async (game) => {
  // Three campaigns, and the picker says what is in all three (DESIGN.md §6.1).
  await game.clickText(UI.newGame);
  await game.waitForScene('SlotScene');
  for (const slot of [1, 2, 3])
    assert(await game.hasText(SLOTS.slotName(slot)), `slot ${slot} is offered`);
  assertEqual((await game.texts()).filter((t) => t === 'EMPTY').length, 3, 'all three empty');

  // Bank a run in each of two slots: out one tile, back, and stop at the hut.
  const worldOf = async (slot) => {
    await game.clickText(slot);
    await game.waitForScene('ExploreScene');
    // Setting out is read its piece before it can be walked, and this test takes
    // the long way to a run rather than through `startRun`, which reads it for
    // everybody else (src/ui/textPanel.js).
    await game.readPanel();
    const seed = (await game.state()).seed;
    await walkPath(game, OUT_AND_BACK);
    await game.clickText(HUT.endHere);
    await game.clickText(RECAP.home);
    await game.waitForScene('TitleScene');
    return seed;
  };

  const first = await worldOf('SLOT 1');
  await game.clickText(UI.newGame);
  await game.waitForScene('SlotScene');
  const second = await worldOf('SLOT 2');
  assert(first !== second, `two campaigns, two worlds (both got ${first})`);

  // Banking rebuilds the save from scratch (`bankRun` in core/rules.js), so this
  // is where a slot would quietly lose the world it has been mapping.
  assertEqual((await game.save(1)).seed, first, 'slot 1 kept the world it walked');
  assertEqual((await game.save(2)).seed, second, 'and slot 2 kept its own');
  assertEqual((await game.save(3)), null, 'slot 3 was never touched');

  await game.clickText(UI.loadGame);
  await game.waitForScene('SlotScene');
  assert(await game.hasText(progressLine(0, 3, 0, 1)), 'the picker reads a slot back');
  assertEqual((await game.texts()).filter((t) => t === 'EMPTY').length, 1, 'the third is still free');
  await game.clickText(SLOTS.slotName(1));
  await game.waitForScene('ExploreScene');
  await game.readPanel();
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

// A walk standing one tile off the hut with a colour, a tool and a pocketful of
// coins on it, and nothing banked behind it. The whole point of banking on
// arrival is what this run is one step away from, so it is planted rather than
// walked: the route to a real gem is ninety steps.
const LOADED_RUN = {
  ...emptySave(),
  run: {
    seed: SEED,
    x: 1,
    y: 0,
    facing: 'right',
    steps: 30,
    water: 120,
    coins: 30,
    coinsFound: 30,
    gems: 1,
    furthest: 20,
    nonce: NONCE,
    epoch: 0,
    tools: ['compass'],
    inventory: [{ id: 'torch-small', durability: 60 }],
    activeIndex: 0,
    found: {},
    collected: '',
    startExplored: 0,
    banked: emptySave(),
  },
};

test('what the hut writes down cannot be lost by walking back out', async (game) => {
  await game.startRun();
  const carrying = await game.state();
  assertEqual(carrying.gems, 1, 'resumed carrying a colour');
  assertEqual((await game.save()).gems, 0, 'that the campaign has not got yet');

  // One step west, onto the hut.
  await game.tapDpad('left');
  await game.settle();
  assert(await game.hasText(HUT.title), 'the hut speaks up');
  assert(
    await game.hasText(HUT.written(`The colour, the ${ITEM_TEXT.compass.name.toLowerCase()} and 30 coins`)),
    'naming exactly what it just wrote'
  );

  const banked = await game.save();
  assertEqual(banked.gems, 1, 'the colour is in the slot before either button is touched');
  assertEqual(banked.coins, 30, 'and so are the coins');
  assertEqual(banked.compass, true, 'and the tool');
  assertEqual(banked.runs, 0, 'without the expedition being over');

  // Back out, and then throw the walk away — the thing that used to cost you a
  // gem you had already carried home (DESIGN.md §6.1).
  await game.clickText(HUT.headBackOut);
  await game.tapDpad('right');
  await game.settle();
  const out = await game.state();
  assertEqual(out.gems - out.banked.gems, 0, 'nothing a bad walk could still cost');
  assertEqual(out.coins, 0, 'and an empty pocket, because the bank has it all');

  await game.tapMenuButton();
  await game.clickText(MENU.exit);
  await game.clickText(LEAVING.leave);
  await game.waitForScene('TitleScene');

  const after = await game.save();
  assertEqual(after.gems, 1, 'abandoning the walk did not take the colour with it');
  assertEqual(after.coins, 30, 'nor the coins');
  assertEqual(after.compass, true, 'nor the compass');
  await game.clickText(UI.loadGame);
  await game.waitForScene('SlotScene');
  assert(await game.hasText(progressLine(1, 3, 30, 0)), 'and the slot picker reads it back');
}, { save: LOADED_RUN });

test('running dry takes the saved expedition with it', async (game) => {
  // LOAD GAME resumes the planted walk, which has one step of water in it.
  await game.startRun();
  assertEqual((await game.state()).water, 1, 'resumed on its last mouthful');

  await game.tapDpad('right');
  await game.settle();
  assert(await game.hasText(DEATH.title), 'the step that empties the flask ends the run');

  // Death is the game's one hard failure (DESIGN.md §6.1), so the save it was
  // walking on goes with it — the campaign keeps only what it had banked, and
  // the ground.
  const after = await game.save();
  assertEqual(after.run, null, 'the saved expedition is gone');
  assert(after.mapped.length > 0, 'but the ground it lit is not');
  await game.clickText(RECAP.home);
  await game.waitForScene('TitleScene');
  await game.clickText(UI.loadGame);
  await game.waitForScene('SlotScene');
  assert(await game.hasText(SLOTS.furthest(0)), 'and the slot is a campaign to walk out from again');
}, { save: THIRSTY_RUN });

// The same last mouthful as THIRSTY_RUN, with a purse and a tool this walk
// hadn't banked yet — what a death used to simply erase now goes into a bag
// on the tile it happened on (DESIGN.md §6).
const DYING_WITH_LOOT = {
  ...emptySave(),
  run: {
    seed: SEED,
    x: 0,
    y: 0,
    facing: 'right',
    steps: 40,
    water: 1,
    coins: 12,
    coinsFound: 12,
    gems: 0,
    furthest: 4,
    nonce: NONCE,
    epoch: 0,
    tools: ['map'],
    inventory: [{ id: 'torch-small', durability: 60 }],
    activeIndex: 0,
    found: {},
    collected: '',
    startExplored: 0,
    banked: emptySave(),
  },
};

test('dying leaves a bag where it happened, and walking back to it hands it all back', async (game) => {
  await game.startRun();
  assertEqual((await game.state()).water, 1, 'resumed on its last mouthful');

  await game.tapDpad('right');
  await game.settle();
  assert(await game.hasText(DEATH.title), 'the step that empties the tank ends the run');

  // What the death screen abandons doesn't vanish — it goes into a bag on the
  // tile the run fell on.
  const dead = await game.save();
  assert(dead.bag, 'a bag is left behind');
  assertEqual({ x: dead.bag.x, y: dead.bag.y }, { x: 1, y: 0 }, 'right where the run died');
  assertEqual(dead.bag.coins, 12, 'holding the coins that were in the pocket');
  assertEqual(dead.bag.tools, ['map'], 'and the tool that never made it home');

  await game.clickText(RECAP.home);
  await game.waitForScene('TitleScene');
  await game.clickText(UI.loadGame);
  await game.waitForScene('SlotScene');
  await game.clickText(SLOTS.slotName(1));
  await game.waitForScene('ExploreScene');
  await game.readPanel();

  // A fresh expedition sets out from south of the hut — walk round rather than
  // back over the hut's own tile, which would open its own question instead.
  await game.tapDpad('right');
  await game.settle();
  await game.tapDpad('up');
  await game.settle();
  assert(await game.hasText(FLASH.bagFound), 'the status line says so');

  const picked = await game.state();
  assertEqual(picked.coins, 12, 'the coins are back in the pocket');
  assert(picked.tools.includes('map'), 'and so is the map');

  // Picking it up only makes it real the way any other pickup does — walking
  // it home to the hut is what writes the slot down without it.
  await game.tapDpad('left');
  await game.settle();
  assertEqual((await game.save()).bag, null, 'and the bag itself is gone from the slot');
}, { save: DYING_WITH_LOOT });

// Standing one step off the merchant's stall, with a campaign's fortune banked
// behind the run: what the merchant spends is everything banked plus what the
// run is carrying (DESIGN.md §4.5).
const AT_MERCHANT = standingAt(MERCHANT_ROUTE, { back: 1, save: { coins: 200 } });

test('walking onto the merchant opens the counter, and buying spends the purse', async (game) => {
  await game.startRun();
  assertEqual((await game.state()).coins, 0, 'this run has found nothing yet');
  assert(await game.hasText(HUD.coins(200)), 'but the counter shows the banked fortune');

  await walkPath(game, AT_MERCHANT.path);

  let state = await game.state();
  assertEqual(state.shopOpen, true, 'arriving at the stall opens it');
  assert(await game.hasText(SHOP.title), 'the counter');
  assert(await game.hasText(SHOP.purse(spendable(state))), 'and what you can spend');

  // The first row is the water drop (src/data/shop.js STOCK).
  const before = { water: state.water, coins: spendable(state) };
  await game.tapShopRow(0);
  state = await game.state();
  assert(state.water > before.water, 'the drop refilled the tank');
  assertEqual(spendable(state), before.coins - PRICES['water-drop'], 'and cost its price');
  assertEqual(state.shopOpen, true, 'the counter stays open for another purchase');

  await game.clickText(LEAVING.leave);
  assertEqual((await game.state()).shopOpen, false, 'and closes when you leave');
}, { save: AT_MERCHANT.save });

test('the map draws the ground this run has walked', async (game) => {
  await game.startRun();
  await walkPath(game, ['right', 'right', 'up', 'up', 'up']);

  const before = await game.state();
  await game.tapMapButton();
  assertEqual((await game.state()).mapOpen, true, 'the map button opens it');
  assert(await game.hasText(WORLD_MAP.title), 'the overlay');
  assert(await game.hasText(WORLD_MAP.walked(before.explored)), 'and it draws what was lit');

  await game.clickText(UI.close);
  assertEqual((await game.state()).mapOpen, false, 'and closes again');
}, { save: { ...emptySave(), map: true } });

runIfMain(import.meta.url);
