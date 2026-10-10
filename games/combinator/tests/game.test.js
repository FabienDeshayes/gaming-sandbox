// The screen, driven through the real canvas. Each test gets a fresh page,
// which opens on the first example machine; tests that build from scratch
// press "Clear bench" first, the way a player would.

import { assert, assertEqual, run, test } from './harness.js';

const at = (state, x, y) => state.placements.find((p) => p.x === x && p.y === y);

async function cleared(game) {
  await game.clickText('Clear bench');
  assertEqual((await game.state()).placements.length, 0, 'bench cleared');
}

test('opens on an example machine that already works, with no errors', async (game) => {
  const s = await game.state();
  assert(s.placements.length > 0, 'an example is loaded');
  assert(s.desc.result.some((l) => l.good), 'and the readout says what it does');
  assert((await game.texts()).includes('WHAT THIS MACHINE DOES'), 'readout heading on screen');
});

test('building tank → pipe bend → sprinkler by dragging from the palette', async (game) => {
  await cleared(game);
  await game.drag(await game.paletteItem('tank'), await game.tile(1, 2));
  let s = await game.state();
  assert(at(s, 1, 2)?.type === 'tank', 'tank placed on B3');
  assert(s.desc.notes.some((l) => /open Matter output: it spills/.test(l.text)), 'an unconnected tank spills');

  await game.drag(await game.paletteItem('bend'), await game.tile(2, 2));
  await game.drag(await game.paletteItem('sprinkler'), await game.tile(2, 1));
  s = await game.state();
  const sprinkler = at(s, 2, 1);
  assert(s.active[sprinkler.id], 'sprinkler runs on turn 1');
  assert(
    s.desc.result.some((l) => /Sprinkler \(C2\) wets 5 tiles on turns 1–4/.test(l.text)),
    'readout: ' + JSON.stringify(s.desc.result)
  );
});

test('clicking a placed module turns it', async (game) => {
  await cleared(game);
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
  await cleared(game);
  await game.drag(await game.paletteItem('tank'), await game.tile(1, 2));
  await game.drag(await game.paletteItem('shaft'), await game.tile(2, 2));
  const s = await game.state();
  assert(
    s.desc.problems.some((l) => /touch but can't connect: Matter meets Motion/.test(l.text)),
    'problems: ' + JSON.stringify(s.desc.problems)
  );
});

test('dragging a module off the bench removes it; dragging within it moves it', async (game) => {
  await cleared(game);
  await game.drag(await game.paletteItem('battery'), await game.tile(3, 3));
  await game.drag(await game.tile(3, 3), await game.tile(4, 4));
  let s = await game.state();
  assert(at(s, 4, 4)?.type === 'battery' && !at(s, 3, 3), 'moved to E5');

  await game.drag(await game.tile(4, 4), [640, 760]);
  s = await game.state();
  assertEqual(s.placements.length, 0, 'dropped off the bench, gone');
});

test('R while dragging turns the module before it lands', async (game) => {
  await cleared(game);
  const [x1, y1] = await game.paletteItem('pipe');
  const [x2, y2] = await game.tile(3, 2);
  await game.hover(x1, y1);
  await game.page.mouse.down();
  await game.hover(x2, y2);
  await game.key('r');
  await game.page.mouse.up();
  const s = await game.state();
  assertEqual(at(s, 3, 2)?.rot, 1, 'landed turned');
});

test('tapping a palette module and then a tile places it', async (game) => {
  await cleared(game);
  await game.clickAt(...(await game.paletteItem('fan')));
  assertEqual((await game.state()).armed, 'fan', 'fan armed');
  await game.clickAt(...(await game.tile(0, 0)));
  assert(at(await game.state(), 0, 0)?.type === 'fan', 'fan placed on A1');
});

test('the timeline steps through the run and the bench follows it', async (game) => {
  await game.clickText('Steam fan');
  await game.clickText('▶|');
  assertEqual((await game.state()).turn, 2, 'stepped to turn 2');
  await game.clickText('8');
  const s = await game.state();
  assertEqual(s.turn, 8, 'clicked turn 8');
  assert(!s.placements.every((p) => s.active[p.id]), 'by turn 8 the fan has stopped');
  assert((await game.texts()).includes('TEST RUN · turn 8 of 8'), 'turn shown in the header');

  await game.clickText('▶ Run test');
  const playing = await game.state();
  assert(playing.playing && playing.turn === 1, 'a test run starts from turn 1');
});

test('fits a small laptop screen without scrolling', async (game) => {
  const fit = await game.page.evaluate(() => {
    const r = window.__game.canvas.getBoundingClientRect();
    return { right: r.right, bottom: r.bottom, w: innerWidth, h: innerHeight };
  });
  assert(fit.right <= fit.w + 1 && fit.bottom <= fit.h + 1, JSON.stringify(fit));
}, { viewport: { width: 1024, height: 640 } });

run();
