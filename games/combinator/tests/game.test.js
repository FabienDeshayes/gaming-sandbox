// Both screens, driven through the real canvas. Each test gets a fresh page
// with empty storage, so it opens on the Workbench with the starting machines
// saved and the Tank Sprinkler open; tests that build from scratch press New
// first, the way a player would.

import { assert, assertEqual, run, test } from './harness.js';

const at = (state, x, y) => state.placements.find((p) => p.x === x && p.y === y);
const placedAt = (state, x, y) => state.placed.find((p) => p.x === x && p.y === y);
const idOf = (state, name) => state.library.find((m) => m.name === name).id;

async function fresh(game) {
  await game.clickText('New');
  const s = await game.state();
  assertEqual(s.placements.length, 0, 'a new machine starts empty');
  assertEqual(s.machineId, null, 'and unsaved');
}

async function buildSprinkler(game) {
  await game.drag(await game.paletteItem('tank'), await game.tile(1, 2));
  await game.drag(await game.paletteItem('bend'), await game.tile(2, 2));
  await game.drag(await game.paletteItem('sprinkler'), await game.tile(2, 1));
}

async function rename(game, name) {
  await game.clickText(`${(await game.state()).name}  ✎`);
  assert((await game.state()).editing, 'name field is being edited');
  for (let i = 0; i < 30; i++) await game.page.keyboard.press('Backspace');
  await game.page.keyboard.type(name);
  await game.key('Enter');
}

// --- Workbench -----------------------------------------------------------------

test('opens on the Workbench with a saved machine that already works, and no errors', async (game) => {
  const s = await game.state();
  assertEqual(s.screen, 'workbench', 'starts on the Workbench');
  assert(s.placements.length > 0 && s.machineId && !s.dirty, 'a saved machine is open');
  assert(s.desc.result.some((l) => l.good), 'and the readout says what it does');
  const texts = await game.texts();
  assert(texts.includes('WHAT THIS MACHINE DOES') && texts.includes('SAVED MACHINES'), 'readout and library on screen');
});

test('building tank → pipe bend → sprinkler by dragging from the palette', async (game) => {
  await fresh(game);
  await game.drag(await game.paletteItem('tank'), await game.tile(1, 2));
  let s = await game.state();
  assert(at(s, 1, 2)?.type === 'tank', 'tank placed on B3');
  assert(s.desc.notes.some((l) => /open Matter output: it spills onto the machine's tile/.test(l.text)), 'an unconnected tank spills');

  await game.drag(await game.paletteItem('bend'), await game.tile(2, 2));
  await game.drag(await game.paletteItem('sprinkler'), await game.tile(2, 1));
  s = await game.state();
  assert(s.active[at(s, 2, 1).id], 'sprinkler runs on turn 1');
  assert(
    s.desc.result.some((l) => /Sprinkler \(C2\) wets the machine's tile and the 4 around it on turns 1–4/.test(l.text)),
    'readout: ' + JSON.stringify(s.desc.result)
  );
  assertEqual(Object.keys(s.worldTiles).filter((k) => s.worldTiles[k].wet.length).length, 5, 'five tiles wet in the world round it');
});

test('clicking a placed module turns it', async (game) => {
  await fresh(game);
  await game.drag(await game.paletteItem('tank'), await game.tile(1, 2));
  await game.drag(await game.paletteItem('pipe'), await game.tile(2, 2));
  let s = await game.state();
  assert(s.active[at(s, 2, 2).id], 'pipe carries the tank’s water');

  await game.clickAt(...(await game.tile(2, 2)));
  s = await game.state();
  assertEqual(at(s, 2, 2).rot, 1, 'one click is a quarter turn');
  assert(!s.active[at(s, 2, 2).id], 'turned pipe no longer faces the tank');
});

test('a port touching the wrong flow is reported as a problem', async (game) => {
  await fresh(game);
  await game.drag(await game.paletteItem('tank'), await game.tile(1, 2));
  await game.drag(await game.paletteItem('shaft'), await game.tile(2, 2));
  const s = await game.state();
  assert(
    s.desc.problems.some((l) => /touch but can't connect: Matter meets Motion/.test(l.text)),
    'problems: ' + JSON.stringify(s.desc.problems)
  );
});

test('dragging a module off the Workbench removes it; dragging within it moves it', async (game) => {
  await fresh(game);
  await game.drag(await game.paletteItem('battery'), await game.tile(3, 3));
  await game.drag(await game.tile(3, 3), await game.tile(4, 4));
  let s = await game.state();
  assert(at(s, 4, 4)?.type === 'battery' && !at(s, 3, 3), 'moved to E5');

  await game.drag(await game.tile(4, 4), [700, 790]);
  s = await game.state();
  assertEqual(s.placements.length, 0, 'dropped off the Workbench, gone');
});

test('R while dragging turns the module before it lands', async (game) => {
  await fresh(game);
  const [x1, y1] = await game.paletteItem('pipe');
  const [x2, y2] = await game.tile(3, 2);
  await game.hover(x1, y1);
  await game.page.mouse.down();
  await game.hover(x2, y2);
  await game.key('r');
  await game.page.mouse.up();
  assertEqual(at(await game.state(), 3, 2)?.rot, 1, 'landed turned');
});

test('tapping a palette module and then a cell places it', async (game) => {
  await fresh(game);
  await game.clickAt(...(await game.paletteItem('fan')));
  assertEqual((await game.state()).armed, 'fan', 'fan armed');
  await game.clickAt(...(await game.tile(0, 0)));
  assert(at(await game.state(), 0, 0)?.type === 'fan', 'fan placed on A1');
});

test('the timeline steps through the test run and the Workbench follows it', async (game) => {
  await game.clickAt(...(await game.machineRow(idOf(await game.state(), 'Steam Fan'))));
  assertEqual((await game.state()).name, 'Steam Fan', 'opened the Steam Fan');
  await game.clickText('▶|');
  assertEqual((await game.state()).turn, 2, 'stepped to turn 2');
  await game.clickText('8');
  const s = await game.state();
  assertEqual(s.turn, 8, 'clicked turn 8');
  assert(!s.placements.every((p) => s.active[p.id]), 'by turn 8 the fan has stopped');
  assert((await game.texts()).includes('TEST RUN · turn 8 of 8'), 'turn shown');

  await game.clickText('▶ Run test');
  const playing = await game.state();
  assert(playing.playing && playing.turn === 1, 'a test run starts from turn 1');
});

test('the ground under the machine decides what its open inputs draw', async (game) => {
  await game.clickAt(...(await game.machineRow(idOf(await game.state(), 'Puddle Pump'))));
  let s = await game.state();
  assertEqual(s.ground, 'puddle', 'the Puddle Pump is tested on a puddle');
  assert(s.desc.result.some((l) => l.good), 'and works there');

  await game.clickText('Bare');
  s = await game.state();
  assertEqual(s.ground, null, 'now on bare ground');
  assert(s.desc.problems.some((l) => /Sprinkler \(C3\) never runs: .*bare ground under the machine has no Matter/.test(l.text)), JSON.stringify(s.desc.problems));
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
  assert(!s.playing, 'and did not start a run');
});

test('opening another machine over unsaved changes takes a second click', async (game) => {
  await game.drag(await game.paletteItem('battery'), await game.tile(6, 4));
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
  await game.drag(await game.paletteItem('battery'), await game.tile(6, 4));
  await game.open('Playground');
  await game.open('Workbench');
  let s = await game.state();
  assert(s.dirty && at(s, 6, 4)?.type === 'battery', 'still there after a flip');
  await game.reload();
  s = await game.state();
  assert(s.dirty && at(s, 6, 4)?.type === 'battery', 'still there after a reload');
});

// --- Playground ------------------------------------------------------------------

test('the Playground opens with the starting machines placed, and the round runs', async (game) => {
  await game.open('Playground');
  const s = await game.state();
  assertEqual(s.screen, 'playground', 'on the Playground');
  assertEqual(s.placed.length, 3, 'three machines placed');
  assertEqual(s.desc.result.filter((l) => l.good).length, 3, 'each does something: ' + JSON.stringify(s.desc.result));
  assert(s.desc.notes.some((l) => /Steam Fan \(E4\) is wetted by Tank Sprinkler \(D4\) on turns 1–4/.test(l.text)), 'machines touch through tiles');
  assert((await game.texts()).includes('ROUND · turn 1 of 8'), 'round header');
});

test('a machine that burns out on its own survives beside a sprinkler, and burns when moved away', async (game) => {
  await game.open('Playground');
  let s = await game.state();
  const fan = placedAt(s, 4, 3);
  assertEqual(s.burnt[fan.id].length, 0, 'beside the Tank Sprinkler nothing in the Steam Fan burns');

  await game.drag(await game.tile(4, 3), await game.tile(5, 6));
  s = await game.state();
  assert(placedAt(s, 5, 6)?.id === fan.id, 'moved to F7');
  assertEqual(s.burnt[fan.id].length, 1, 'out on its own its shaft burns');
  assert(s.desc.problems.some((l) => /Steam Fan \(F7\): Shaft is wooden and burns down after turn 2, from waste heat from Steam Engine/.test(l.text)), JSON.stringify(s.desc.problems));
});

test('placing a saved machine by dragging, turning it by clicking, removing it by dragging off', async (game) => {
  await game.open('Playground');
  const id = (await game.state()).machines.find((m) => m.name === 'Steam Fan').id;
  await game.drag(await game.machineRow(id), await game.tile(0, 0));
  let s = await game.state();
  assertEqual(placedAt(s, 0, 0)?.machineId, id, 'placed on A1');
  assertEqual(s.placed.length, 4, 'a second Steam Fan');

  await game.clickAt(...(await game.tile(0, 0)));
  s = await game.state();
  assertEqual(placedAt(s, 0, 0).rot, 1, 'turned a quarter');
  assert(s.desc.result.some((l) => /Steam Fan \(A1\): Fan blows air onto the 2 tiles east of the machine/.test(l.text)), JSON.stringify(s.desc.result));

  await game.drag(await game.tile(0, 0), [600, 790]);
  assertEqual((await game.state()).placed.length, 3, 'dragged off, gone');
});

test('saving a change on the Workbench changes every copy on the Playground', async (game) => {
  // Turn the Tank Sprinkler's sprinkler away from its pipe: it stops working.
  await game.clickAt(...(await game.tile(3, 1)));
  await game.clickText('Save');
  await game.open('Playground');
  const s = await game.state();
  assert(s.desc.problems.some((l) => /Tank Sprinkler \(D4\): Sprinkler never runs/.test(l.text)), JSON.stringify(s.desc.problems));
  assert(!s.desc.notes.some((l) => /is wetted by Tank Sprinkler/.test(l.text)), 'and no longer wets its neighbour');
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

run();
