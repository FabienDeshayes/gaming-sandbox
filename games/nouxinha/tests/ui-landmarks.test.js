// The landmarks and the posts, on screen: what a bump into one actually does to
// the page (DESIGN.md §4.10). Each test drives a fresh page against the real
// canvas.
//
// What a landmark *is* — where it stands, what it hands over, what survives a
// world — is pure and lives in `landmarks.test.js`. What is here is the half
// only a browser can answer: that walking into one is a bump rather than a
// step, that the game says its piece over the world, and above all that the
// colour actually reaches the screen, since a landmark gaining its colour is
// the whole of what a campaign has to show for having been there.

import { assert, assertEqual, runIfMain } from './harness.js';
import { FLASH, SIGNPOST } from '../src/text.js';
import { getPalette, paletteColour } from '../src/config.js';
import { landmarkDef } from '../src/data/landmarks.js';
import { signpostReading } from '../src/core/world.js';
import { maxWater } from '../src/core/rules.js';
import {
  FIRST_POST,
  LANDMARK_ROUTE,
  NEAREST_LANDMARK,
  POST_ROUTE,
  SEED,
  standingAt,
  test,
  walkPath,
} from './world.js';

// Standing on the landmark's court. Its own tile can't be stepped on, so the
// route ends beside it and the input under test is the bump into it.
const AT_LANDMARK = standingAt(LANDMARK_ROUTE, { run: { water: 60 } });
const DEF = landmarkDef(NEAREST_LANDMARK.id);

test('walking into a landmark stands you at it, says its piece, and gives it a colour', async (game) => {
  await game.startRun();

  // Drawn in the plain foreground, because this campaign has never been here:
  // nothing is ever shown in a colour it has not brought back (DESIGN.md §9).
  const before = await game.visibleTiles();
  const plain = before.find((t) => t.x === NEAREST_LANDMARK.x && t.y === NEAREST_LANDMARK.y);
  assertEqual(plain.ground, DEF.sprite, 'the landmark is drawn');
  assertEqual(plain.paint[0], getPalette().fg, 'and every part of it in the plain foreground');
  // Its court is its own paving rather than the world's floor, which is what
  // makes arriving at one look like arriving somewhere.
  const court = before.find((t) => t.x === NEAREST_LANDMARK.x + 1 && t.y === NEAREST_LANDMARK.y);
  assertEqual(court.ground, DEF.court, 'standing on its court');

  // The bump: no step, no water, no facing — the same contract as a chest's.
  const standing = await game.state();
  await game.tapDpad(LANDMARK_ROUTE.hit);
  await game.settle();
  const stood = await game.state();
  assertEqual({ x: stood.x, y: stood.y }, { x: standing.x, y: standing.y }, 'the step did not happen');
  assertEqual(stood.steps, standing.steps, 'and cost no step');
  assertEqual(stood.landmarks, [NEAREST_LANDMARK.id], 'but this world knows you stood there');
  assertEqual(stood.standings, [DEF.standing], 'and the campaign has the standing');
  assert((await game.sounds()).includes('landmark'), 'it was heard');

  // The gift, on the spot: this one is drowned, so the tank comes back full.
  assertEqual(stood.water, maxWater(0), 'and the gift landed');

  // The game says its piece over the world, the way a chest does.
  assert(stood.textPanelOpen, 'the text panel is up');
  await game.readPanel();

  // And now it is the colour it keeps — absolutely, not relative to this world.
  const after = await game.visibleTiles();
  const lit = after.find((t) => t.x === NEAREST_LANDMARK.x && t.y === NEAREST_LANDMARK.y);
  assertEqual(lit.paint[0], paletteColour(DEF.palette), 'its own colour reached the screen');
  assertEqual(lit.tint, getPalette().fg, 'and the rest of it is still the world it stands in');

  // A second visit does nothing at all, exactly like a chest with its lid up —
  // as long as no step has landed between the two bumps.
  await game.tapDpad(LANDMARK_ROUTE.hit);
  await game.settle();
  assert(await game.hasText(FLASH.landmarkAgain(DEF.name)), 'walking back into it says so');
  assertEqual((await game.state()).water, maxWater(0), 'and hands over nothing twice');

  // Step off the landmark's own tile and back onto the court — a corner of it,
  // guaranteed walkable — and the panel opens again: a real return visit reads
  // differently from a direction key just held against it.
  const perp = LANDMARK_ROUTE.hit === 'left' || LANDMARK_ROUTE.hit === 'right' ? 'up' : 'left';
  const back = perp === 'up' ? 'down' : 'right';
  await game.tapDpad(perp);
  await game.settle();
  await game.tapDpad(back);
  await game.settle();
  await game.tapDpad(LANDMARK_ROUTE.hit);
  await game.settle();
  assert((await game.state()).textPanelOpen, 'and the panel is up again');
  await game.readPanel();
}, { save: AT_LANDMARK.save });

// The post five tiles from the hut: the one every campaign meets on its first
// expedition, walked to from the door rather than planted.
test('a signpost is read by walking into it, and says which way and how far', async (game) => {
  await game.startRun();
  await walkPath(game, POST_ROUTE.path);

  const standing = await game.state();
  await game.tapDpad(POST_ROUTE.hit);
  await game.settle();
  const read = await game.state();
  assertEqual({ x: read.x, y: read.y }, { x: standing.x, y: standing.y }, 'reading it is a bump');
  assertEqual(read.posts, [FIRST_POST.id], 'and the post is on the read list');
  assert((await game.sounds()).includes('signpost'), 'the wood was heard');

  // The directions themselves, worked out from where the post stands.
  const reading = signpostReading(FIRST_POST, SEED);
  const line = SIGNPOST.line(
    landmarkDef(reading.target).name,
    SIGNPOST.bearings[reading.bearing],
    SIGNPOST.far[reading.band]
  );
  assert(read.textPanelOpen, 'the first read gets the panel');
  // Read it out block by block: the last one is the directions themselves,
  // which is the only part of a post worth re-reading.
  let last = null;
  for (let taps = 0; taps < 40 && (await game.textPanel()); taps++) {
    const panel = await game.textPanel();
    if (panel.done) last = panel.full;
    await game.tapPanel();
  }
  assertEqual(last, line, 'and it ends on the directions');

  // Read again, it is the same directions as a line in the status bar — by then
  // the player is checking rather than finding out, as long as no step has
  // landed since the last time it was read.
  await game.tapDpad(POST_ROUTE.hit);
  await game.settle();
  const twice = await game.state();
  assertEqual(twice.textPanelOpen, false, 'no second reading of the whole post');
  assert(await game.hasText(line), 'just the directions, in the status line');

  // Retrace the route's last leg and back — ground already proven walkable —
  // and reading it again opens the panel: a real return visit, not a direction
  // key held against it.
  const lastLeg = POST_ROUTE.path[POST_ROUTE.path.length - 1];
  const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };
  await game.tapDpad(OPPOSITE[lastLeg]);
  await game.settle();
  await game.tapDpad(lastLeg);
  await game.settle();
  await game.tapDpad(POST_ROUTE.hit);
  await game.settle();
  assert((await game.state()).textPanelOpen, 'and the panel is up again');
  await game.readPanel();

  // The arm is drawn in the colour of the landmark it names, and that colour is
  // the plain foreground until the campaign has been there.
  const tiles = await game.visibleTiles();
  const post = tiles.find((t) => t.x === FIRST_POST.x && t.y === FIRST_POST.y);
  assertEqual(post.ground, 'signpost', 'the post is drawn');
  assertEqual(post.paint[0], getPalette().fg, 'with a plain arm, for a place never visited');
});

runIfMain(import.meta.url);
