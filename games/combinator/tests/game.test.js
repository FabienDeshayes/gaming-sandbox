// Both screens, driven through the real canvas. Each test gets a fresh page
// with empty storage, so it opens on the Workbench with the starting machines
// saved and the Tank Sprinkler open; tests that build from scratch press New
// first, the way a player would.

import { assert, assertEqual, run, test } from './harness.js';

const types = (state) => state.placements.map((p) => p.type);
const placedAt = (state, x, y) => state.placed.find((p) => p.x === x && p.y === y);
const idOf = (state, name) => state.library.find((m) => m.name === name).id;

async function fresh(game) {
  await game.clickText('New');
  const s = await game.state();
  assertEqual(s.placements.length, 0, 'a new machine starts empty');
  assertEqual(s.machineId, null, 'and unsaved');
}

async function buildSprinkler(game) {
  await game.drag(await game.paletteItem('tank'), await game.slot(0));
  await game.drag(await game.paletteItem('sprinkler'), await game.slot(1));
}

async function rename(game, name) {
  await game.clickText(`${(await game.state()).name}  ✎`);
  assert((await game.state()).editing, 'name field is being edited');
  for (let i = 0; i < 30; i++) await game.page.keyboard.press('Backspace');
  await game.page.keyboard.type(name);
  await game.key('Enter');
}

// Between slots i and i + 1 of the row.
async function between(game, i) {
  const [a, y] = await game.slot(i);
  const [b] = await game.slot(i + 1);
  return [(a + b) / 2, y];
}

// --- Workbench -----------------------------------------------------------------

test('opens on the Workbench with a saved machine that already works, and no errors', async (game) => {
  const s = await game.state();
  assertEqual(s.screen, 'workbench', 'starts on the Workbench');
  assert(s.placements.length > 0 && s.machineId && !s.dirty, 'a saved machine is open');
  assert(s.desc.result.some((l) => l.good), 'and the readout says what it does');
  const texts = await game.texts();
  assert(texts.includes('WHAT THIS MACHINE DOES') && texts.includes('SAVED MACHINES'), 'readout and library on screen');
  assert(texts.includes('#1 Works') && texts.includes('#2 Works'), 'each piece says how it is doing under it');
});

test('building tank → sprinkler by dragging into the row', async (game) => {
  await fresh(game);
  await game.drag(await game.paletteItem('tank'), await game.slot(0));
  let s = await game.state();
  assertEqual(types(s), ['tank'], 'tank in the row');
  assert(s.desc.notes.some((l) => /gives Liquid that no piece to its right takes: it spills onto the machine's tile/.test(l.text)), 'a tank on its own spills');

  await game.drag(await game.paletteItem('sprinkler'), await game.slot(3));
  s = await game.state();
  assertEqual(types(s), ['tank', 'sprinkler'], 'dropped past the end, it lands at the end');
  assert(s.active[s.placements[1].id], 'sprinkler works');
  assert(
    s.desc.result.some((l) => /^Sprinkler wets the machine's tile and the 4 around it\./.test(l.text)),
    'readout: ' + JSON.stringify(s.desc.result)
  );
  assertEqual(Object.keys(s.worldTiles).filter((k) => s.worldTiles[k].wet.length).length, 5, 'five tiles wet in the world round it');
  assert((await game.texts()).includes('◂ Liquid from Water Tank'), 'the sprinkler says where its water comes from');
});

test('a module dropped between two pieces goes in between, and flow passes by it', async (game) => {
  await fresh(game);
  await buildSprinkler(game);
  await game.drag(await game.paletteItem('battery'), await between(game, 0));
  const s = await game.state();
  assertEqual(types(s), ['tank', 'battery', 'sprinkler'], 'inserted between');
  assert(s.active[s.placements[2].id], 'the water still reaches the sprinkler');
});

test('an input with nothing to its left is reported as a problem', async (game) => {
  await fresh(game);
  await game.drag(await game.paletteItem('sprinkler'), await game.slot(0));
  await game.drag(await game.paletteItem('tank'), await game.slot(1));
  const s = await game.state();
  assert(
    s.desc.problems.some((l) => /Sprinkler can't work: its Liquid input gets nothing: no piece to its left has Liquid to spare/.test(l.text)),
    'problems: ' + JSON.stringify(s.desc.problems)
  );
});

test('dragging a piece along the row moves it; dragging it out of the row removes it', async (game) => {
  await fresh(game);
  await game.drag(await game.paletteItem('battery'), await game.slot(0));
  await game.drag(await game.paletteItem('tank'), await game.slot(1));
  await game.drag(await game.slot(0), await game.slot(2));
  let s = await game.state();
  assertEqual(types(s), ['tank', 'battery'], 'battery moved past the tank');

  await game.drag(await game.slot(1), [700, 790]);
  s = await game.state();
  assertEqual(types(s), ['tank'], 'dropped out of the row, gone');
});

test('tapping a palette module and then the row adds it at the end, up to a full row', async (game) => {
  await fresh(game);
  await game.clickAt(...(await game.paletteItem('fan')));
  assertEqual((await game.state()).armed, 'fan', 'fan armed');
  for (let i = 0; i < 9; i++) await game.clickAt(...(await game.slot(6)));
  assertEqual(types(await game.state()), Array(7).fill('fan'), 'seven fans and no more');
});

test('a wooden fan beside an engine works once and burns, and the Workbench says so', async (game) => {
  await game.clickAt(...(await game.machineRow(idOf(await game.state(), 'Steam Fan'))));
  const s = await game.state();
  assertEqual(s.name, 'Steam Fan', 'opened the Steam Fan');
  const fan = s.placements[2].id;
  assert(s.active[fan] && s.burns.includes(fan), 'the fan works and burns');
  assert((await game.texts()).includes('#3 Works, burns'), 'said under it');
  assert(s.desc.problems.some((l) => /Fan is wooden and burns down as the machine works, from waste heat from Steam Engine/.test(l.text)), JSON.stringify(s.desc.problems));
});

test('the ground under the machine decides what its open inputs draw', async (game) => {
  await game.clickAt(...(await game.machineRow(idOf(await game.state(), 'Puddle Torch'))));
  let s = await game.state();
  assertEqual(s.ground, 'puddle', 'the Puddle Torch is tested on a puddle');
  assert(s.desc.result.some((l) => l.good), 'and works there');
  assert(s.desc.notes.some((l) => /Boiler draws Liquid from the puddle under the machine/.test(l.text)), JSON.stringify(s.desc.notes));

  await game.clickText('Bare');
  s = await game.state();
  assertEqual(s.ground, null, 'now on bare ground');
  assert(s.desc.problems.some((l) => /Torch can't work: .*bare ground under the machine has none to give/.test(l.text)), JSON.stringify(s.desc.problems));
  assert(s.dirty, 'changing the ground is an unsaved change');
});

test('a new machine can be named, saved, and is then in the library', async (game) => {
  await fresh(game);
  await rename(game, 'Wet Box');
  await buildSprinkler(game);
  let s = await game.state();
  assertEqual(s.name, 'Wet Box', 'renamed');
  assert(s.dirty && !s.library.some((m) => m.name === 'Wet Box'), 'not saved yet');
  assert((await game.texts()).includes('Not saved yet'), 'and the screen says so');

  await game.clickText('Save');
  s = await game.state();
  assert(s.machineId && !s.dirty, 'saved');
  assert(s.library.some((m) => m.id === s.machineId && m.name === 'Wet Box'), 'listed in the library');
});

test('Escape while naming keeps the old name, and typing a name never edits the machine', async (game) => {
  const before = await game.state();
  await game.clickText(`${before.name}  ✎`);
  await game.page.keyboard.type('r ');
  await game.key('Escape');
  const s = await game.state();
  assertEqual(s.name, before.name, 'name unchanged');
  assertEqual(JSON.stringify(s.placements), JSON.stringify(before.placements), 'R and Space did not touch the machine');
});

test('opening another machine over unsaved changes takes a second click', async (game) => {
  await game.drag(await game.paletteItem('battery'), await game.slot(6));
  const edited = await game.state();
  assert(edited.dirty, 'Tank Sprinkler has unsaved changes');
  const fan = idOf(edited, 'Steam Fan');

  await game.clickAt(...(await game.machineRow(fan)));
  let s = await game.state();
  assertEqual(s.machineId, edited.machineId, 'first click keeps the open machine');
  assert((await game.texts()).some((t) => /Click Steam Fan again/.test(t)), 'and says what a second click does');

  await game.clickAt(...(await game.machineRow(fan)));
  s = await game.state();
  assertEqual(s.name, 'Steam Fan', 'second click opens it');
});

test('deleting a machine takes two clicks and takes it off the Playground too', async (game) => {
  const s0 = await game.state();
  const id = s0.machineId;
  await game.clickText('Delete');
  assert((await game.state()).library.some((m) => m.id === id), 'one click deletes nothing');
  assert((await game.texts()).some((t) => /comes off the Playground too \(1 placed\)/.test(t)), 'warns about the Playground');
  await game.clickText('Delete');
  const s = await game.state();
  assert(!s.library.some((m) => m.id === id), 'gone from the library');
  assert(s.machineId && s.machineId !== id, 'another saved machine is open');

  await game.open('Playground');
  const p = await game.state();
  assert(!p.placed.some((u) => u.machineId === id), 'no copy left on the Playground');
  assert(!p.machines.some((m) => m.id === id), 'and not in its list');
});

test('unsaved work survives flipping to the Playground and back, and a reload', async (game) => {
  await game.drag(await game.paletteItem('battery'), await game.slot(6));
  await game.open('Playground');
  await game.open('Workbench');
  let s = await game.state();
  assert(s.dirty && types(s).at(-1) === 'battery', 'still there after a flip');
  await game.reload();
  s = await game.state();
  assert(s.dirty && types(s).at(-1) === 'battery', 'still there after a reload');
});

// --- Playground ------------------------------------------------------------------

test('the Playground opens with the starting machines placed, and nothing works until clicked', async (game) => {
  await game.open('Playground');
  const s = await game.state();
  assertEqual(s.screen, 'playground', 'on the Playground');
  assertEqual(s.placed.length, 3, 'three machines placed');
  assertEqual(s.actions.length, 0, 'nothing has worked yet');
  assertEqual(s.desc.result.filter((l) => l.good).length, 3, 'each is ready to do something: ' + JSON.stringify(s.desc.result));
  assert(!Object.values(s.tiles).some((t) => t.wet.length), 'no tile is wet yet');
  assert((await game.texts()).includes('RUN · 0 actions so far'), 'run header');
});

test('clicking a machine makes it work once, and what it leaves on the tiles stays', async (game) => {
  await game.open('Playground');
  const sprinkler = placedAt(await game.state(), 3, 3);
  await game.clickAt(...(await game.tile(3, 3)));
  let s = await game.state();
  assertEqual(s.actions, [sprinkler.id], 'one action');
  assertEqual(Object.values(s.tiles).filter((t) => t.wet.length).length, 5, 'five tiles wet');
  assertEqual(placedAt(s, 3, 3).rot, 0, 'a click no longer turns it');
  assert(s.desc.notes.some((l) => /Steam Fan \(E4\) stands on a tile wetted by Tank Sprinkler \(D4\)/.test(l.text)), 'machines touch through tiles');
  assert((await game.texts()).includes('1. Tank Sprinkler (D4)'), 'the run log names it');

  await game.clickText('↶ Undo');
  s = await game.state();
  assertEqual(s.actions.length, 0, 'Undo takes it back');
  assert(!Object.values(s.tiles).some((t) => t.wet.length), 'and dries the tiles');
  await game.clickAt(...(await game.tile(3, 3)));
  await game.clickAt(...(await game.tile(3, 3)));
  await game.clickText('Reset');
  assertEqual((await game.state()).actions.length, 0, 'Reset clears the run');
});

test('the Steam Fan burns if it works first, and survives once the sprinkler beside it has worked', async (game) => {
  await game.open('Playground');
  let s = await game.state();
  const fan = placedAt(s, 4, 3);
  await game.clickAt(...(await game.tile(4, 3)));
  s = await game.state();
  assertEqual(s.burnt[fan.id].length, 1, 'on its dry tile its fan burns');
  assert(s.desc.problems.some((l) => /Steam Fan \(E4\): Fan has burnt down/.test(l.text)), JSON.stringify(s.desc.problems));

  await game.clickText('Reset');
  await game.clickAt(...(await game.tile(3, 3)));
  await game.clickAt(...(await game.tile(4, 3)));
  await game.clickAt(...(await game.tile(4, 3)));
  s = await game.state();
  assertEqual(s.burnt[fan.id].length, 0, 'beside the wet sprinkler it never burns');
  assert(s.ready[fan.id].length === 3, 'and is still ready to work');
});

test('the run and the layout are kept across a reload', async (game) => {
  await game.open('Playground');
  await game.clickAt(...(await game.tile(3, 3)));
  await game.reload();
  await game.open('Playground');
  assertEqual((await game.state()).actions.length, 1, 'still one action');
});

test('placing a saved machine by dragging, turning it with R, removing it by dragging off', async (game) => {
  await game.open('Playground');
  const id = (await game.state()).machines.find((m) => m.name === 'Steam Fan').id;
  await game.drag(await game.machineRow(id), await game.tile(0, 0));
  let s = await game.state();
  assertEqual(placedAt(s, 0, 0)?.machineId, id, 'placed on A1');
  assertEqual(s.placed.length, 4, 'a second Steam Fan');

  await game.page.mouse.move(...(await game.tile(0, 0)));
  await game.key('r');
  s = await game.state();
  assertEqual(placedAt(s, 0, 0).rot, 1, 'turned a quarter');
  assert(s.desc.result.some((l) => /Steam Fan \(A1\): Fan blows wind onto the 2 tiles east of the machine/.test(l.text)), JSON.stringify(s.desc.result));

  await game.drag(await game.tile(0, 0), [600, 790]);
  assertEqual((await game.state()).placed.length, 3, 'dragged off, gone');
});

test('saving a change on the Workbench changes every copy on the Playground', async (game) => {
  // Move the Tank Sprinkler's sprinkler in front of its tank: it stops working.
  const [x, y] = await game.slot(0);
  await game.drag(await game.slot(1), [x - 30, y]);
  await game.clickText('Save');
  await game.open('Playground');
  const s = await game.state();
  assert(s.desc.problems.some((l) => /Tank Sprinkler \(D4\): Sprinkler can't work/.test(l.text)), JSON.stringify(s.desc.problems));
});

test('the Playground layout is kept across a reload, and Tab flips screens', async (game) => {
  await game.open('Playground');
  await game.drag(await game.tile(3, 3), await game.tile(0, 0));
  await game.reload();
  await game.key('Tab');
  await game.page.waitForFunction(() => window.__game.scene.getScenes(true)[0]?.sys.settings.key === 'PlaygroundScene');
  await game.page.waitForTimeout(50);
  const s = await game.state();
  assertEqual(s.screen, 'playground', 'Tab flipped to the Playground');
  assert(placedAt(s, 0, 0), 'the moved machine is still on A1');
});

test('fits a small laptop screen without scrolling', async (game) => {
  const fit = await game.page.evaluate(() => {
    const r = window.__game.canvas.getBoundingClientRect();
    return { right: r.right, bottom: r.bottom, w: innerWidth, h: innerHeight };
  });
  assert(fit.right <= fit.w + 1 && fit.bottom <= fit.h + 1, JSON.stringify(fit));
}, { viewport: { width: 1024, height: 640 } });

// --- On a phone -----------------------------------------------------------------
// A portrait touch screen gets the mobile layout, driven with taps and finger
// drags (touch events, not the mouse).

const phone = { phone: true };

// Picks the shelf a module is on, the way a player would.
async function shelfItem(game, shelf, type) {
  await game.tapText(shelf);
  return game.paletteItem(type);
}

test('a phone held upright gets the mobile layout, and all of it is on screen', async (game) => {
  const fit = await game.page.evaluate(() => {
    const s = window.__game.scene.getScenes(true)[0];
    const r = window.__game.canvas.getBoundingClientRect();
    const cam = s.cameras.main;
    const W = window.__game.scale.width / cam.zoom;
    const H = window.__game.scale.height / cam.zoom;
    const out = s.children.list
      .filter((c) => c.visible && c.getBounds)
      .map((c) => c.getBounds())
      .filter((b) => b.width > 0 && (b.left < -1 || b.top < -1 || b.right > W + 1 || b.bottom > H + 1));
    return { w: r.width, h: r.height, vw: innerWidth, vh: innerHeight, out: out.length, zoom: cam.zoom };
  });
  assert(fit.w >= fit.vw - 1, 'the canvas fills the phone’s width: ' + JSON.stringify(fit));
  assert(fit.h <= fit.vh + 1, 'and fits its height: ' + JSON.stringify(fit));
  assertEqual(fit.out, 0, 'nothing drawn off the edge');
  assert(fit.zoom > 2, 'drawn at the phone’s pixel density');
  const texts = await game.texts();
  assert(['Readout', 'Inspect', 'Test', 'Saved', 'Sources', 'Effectors'].every((t) => texts.includes(t)), 'tabs and shelves on screen');
}, phone);

test('on a phone: building a sprinkler by dragging modules off the shelves with a finger', async (game) => {
  await game.tapText('New');
  assertEqual((await game.state()).placements.length, 0, 'a new machine starts empty');
  await game.swipe(await shelfItem(game, 'Sources', 'tank'), await game.slot(0));
  await game.swipe(await shelfItem(game, 'Effectors', 'sprinkler'), await game.slot(1));
  await game.swipe(await shelfItem(game, 'Sources', 'battery'), await between(game, 0));
  const s = await game.state();
  assertEqual(types(s), ['tank', 'battery', 'sprinkler'], 'three modules in the row');
  assert(s.active[s.placements[2].id], 'and the sprinkler works');
}, phone);

test('on a phone: a tap inspects a piece, and Inspect moves it along the row or removes it', async (game) => {
  const before = await game.state();
  assertEqual(types(before), ['tank', 'sprinkler'], 'the Tank Sprinkler');
  await game.tap(...(await game.slot(1)));
  assert((await game.texts()).includes('#2 Sprinkler'), 'Inspect shows it');
  assertEqual(types(await game.state()), ['tank', 'sprinkler'], 'a tap changes nothing');

  await game.tapText('◀');
  let s = await game.state();
  assertEqual(types(s), ['sprinkler', 'tank'], '◀ moves it left');
  assert(!s.active[s.placements[0].id], 'where nothing feeds it');
  await game.tapText('▶');
  assertEqual(types(await game.state()), ['tank', 'sprinkler'], '▶ moves it back');
  await game.tapText('✕ Remove');
  s = await game.state();
  assertEqual(types(s), ['tank'], 'Remove takes it out');
  assert(s.dirty, 'an unsaved change');
}, phone);

test('on a phone: tap a module, then tap the row to add it', async (game) => {
  await game.tapText('New');
  await game.tap(...(await shelfItem(game, 'Effectors', 'fan')));
  assertEqual((await game.state()).armed, 'fan', 'fan armed');
  await game.tap(...(await game.slot(0)));
  await game.tap(...(await game.slot(1)));
  assertEqual(types(await game.state()), ['fan', 'fan'], 'two fans added');
}, phone);

test('on a phone: the test ground and the saved machines are under their tabs', async (game) => {
  await game.tapText('Test');
  await game.tapText('Puddle');
  assertEqual((await game.state()).ground, 'puddle', 'tested on a puddle');

  await game.tapText('Saved');
  const fan = idOf(await game.state(), 'Steam Fan');
  await game.tap(...(await game.machineRow(fan)));
  assert((await game.texts()).some((t) => /Tap Steam Fan again/.test(t)), 'a second tap is asked for over unsaved changes');
  await game.tap(...(await game.machineRow(fan)));
  assertEqual((await game.state()).name, 'Steam Fan', 'opened');
}, phone);

test('on a phone: naming a machine asks with the phone’s own keyboard', async (game) => {
  game.page.once('dialog', (d) => d.accept('Pocket Pump'));
  await game.tapText(`${(await game.state()).name}  ✎`);
  const s = await game.state();
  assertEqual(s.name, 'Pocket Pump', 'renamed');
  assert(s.dirty, 'as an unsaved change');
}, phone);

test('on a phone: placing a machine with a finger, a second tap makes it work', async (game) => {
  await game.open('Playground');
  const id = (await game.state()).machines.find((m) => m.name === 'Steam Fan').id;
  await game.swipe(await game.machineRow(id), await game.tile(0, 0));
  let s = await game.state();
  const placed = placedAt(s, 0, 0);
  assertEqual(placed?.machineId, id, 'placed on A1');

  await game.tap(...(await game.tile(3, 3)));
  assertEqual((await game.state()).actions.length, 0, 'a first tap only picks a machine out');
  assert((await game.texts()).includes('▶ Work'), 'and Inspect offers to make it work');
  await game.tap(...(await game.tile(3, 3)));
  s = await game.state();
  assertEqual(s.actions.length, 1, 'a second tap makes it work');

  await game.tap(...(await game.tile(0, 0)));
  await game.tapText('⟳ Turn');
  assertEqual(placedAt(await game.state(), 0, 0).rot, 1, 'Turn turns it');
  await game.tapText('✕ Remove');
  assertEqual((await game.state()).placed.length, 3, 'removed');

  await game.tapText('Run');
  await game.tapText('↶ Undo');
  assertEqual((await game.state()).actions.length, 0, 'Undo is under Run');
}, phone);

test('a laptop window gets the desktop layout, and ?layout=mobile forces the phone one', async (game) => {
  assert((await game.texts()).includes('WORKING ONCE') && (await game.texts()).includes('TEST ON'), 'the desktop layout');
  await game.page.goto(game.page.url() + '?layout=mobile', { waitUntil: 'networkidle' });
  await game.page.waitForFunction(() => window.__game?.scene.getScenes(true)[0]?.readout);
  assert((await game.texts()).includes('Test') && !(await game.texts()).includes('TEST ON'), 'the mobile layout, forced');
});

run();
