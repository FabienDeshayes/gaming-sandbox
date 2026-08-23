// The art: one tile sheet addressed by coordinate, cut into masks, plus the
// palette rules the masks are tinted by. That the *real* sheet loads and is cut
// needs a canvas, so it lives in tests/ui-shell.test.js; everything derivable is
// here. Pure — no browser.

import { assert, assertEqual, runIfMain, unit } from './harness.js';
import { DIM, buildSprites, WIZARD_ZONES } from '../src/data/sprites.js';
import { SHEET_COLS, SHEET_ROWS, TILES, variantCount, variantKey, wallSprite } from '../src/data/tiles.js';
import { zoneColours } from '../src/ui/wizard.js';
import { MAX_MOVE_SPEED, MIN_MOVE_SPEED, gemColour, getMoveSpeed, setMoveSpeed } from '../src/config.js';

// A stand-in for the sheet: every tile is its own coordinate written into the
// mask — the first four rows spell out the column and the row, low nibble then
// high — so no two tiles come out alike and a sprite can be traced back to the
// tile it was cut from without a browser.
function fakeSheet(col, row) {
  const lit = [col % 16, Math.floor(col / 16), row % 16, Math.floor(row / 16)];
  return Array.from({ length: 16 }, (_, y) =>
    Array.from({ length: 16 }, (_, x) => (y < lit.length && x === lit[y] ? '#' : '.')).join('')
  );
}

const sprites = buildSprites(fakeSheet);

unit('every tile the table names is on the sheet', () => {
  for (const [key, tile] of Object.entries(TILES)) {
    // A key names one [col, row], or a list of them to alternate between.
    const pairs = Array.isArray(tile[0]) ? tile : [tile];
    assert(pairs.length === variantCount(key), `${key}: the variant count matches the table`);
    for (const pair of pairs) {
      assert(Array.isArray(pair) && pair.length === 2, `${key} is a [col, row] pair`);
      const [col, row] = pair;
      assert(Number.isInteger(col) && col >= 0 && col < SHEET_COLS, `${key}: column ${col} is on the sheet`);
      assert(Number.isInteger(row) && row >= 0 && row < SHEET_ROWS, `${key}: row ${row} is on the sheet`);
    }
  }
});

unit('every sprite is 16x16 and comes from the tile it was pointed at', () => {
  for (const [key, mask] of Object.entries(sprites)) {
    assertEqual(mask.length, 16, `${key} row count`);
    for (const row of mask) assertEqual(row.length, 16, `${key} row width`);
  }

  // Nothing the table names goes missing on the way through.
  for (const key of Object.keys(TILES)) assert(sprites[key], `${key} was cut from the sheet`);

  // A tile repointed in the table is what the sprite is drawn from: the gem is
  // the tile at its own coordinates and not, say, the coin's.
  assertEqual(sprites.gem, fakeSheet(...TILES.gem), 'the gem is its own tile');
  assert(sprites.gem !== sprites.coin, 'and not the coin next to it');
});

unit('a terrain that alternates gets one sprite per tile, and the bare key is the first', () => {
  for (const key of ['rock', 'tree']) {
    const count = variantCount(key);
    assert(count > 1, `${key} alternates`);
    TILES[key].forEach((tile, n) =>
      assertEqual(sprites[`${key}-${n}`], fakeSheet(...tile), `${key}-${n} is the tile it names`)
    );
    assertEqual(sprites[key], sprites[`${key}-0`], `bare ${key} is the first of them`);

    // A roll anywhere in [0, 1) lands on one of them, and 1 would too if a
    // caller ever handed one over.
    const rolled = new Set();
    for (let i = 0; i <= 100; i++) rolled.add(variantKey(key, i / 100));
    assertEqual(rolled.size, count, `${key}: every tile is reachable`);
    for (const chosen of rolled) assert(sprites[chosen], `${chosen} exists`);
  }

  // A single-tile key is left alone: no suffix, no second texture.
  assertEqual(variantKey('coin', 0.99), 'coin', 'a single-tile key keeps its name');
});

unit('a sanctum ring draws corners on its corners and runs down its sides', () => {
  const radius = 4;
  // Walk the whole ring and check every tile against where it sits: the four
  // corners, then the runs between them.
  const seen = new Map();
  for (let dy = -radius; dy <= radius; dy++)
    for (let dx = -radius; dx <= radius; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
      const piece = wallSprite(dx, dy, radius);
      seen.set(piece, (seen.get(piece) || 0) + 1);
    }

  assertEqual(wallSprite(-radius, -radius, radius), 'wall-tl', 'top-left');
  assertEqual(wallSprite(radius, -radius, radius), 'wall-tr', 'top-right');
  assertEqual(wallSprite(-radius, radius, radius), 'wall-bl', 'bottom-left');
  assertEqual(wallSprite(radius, radius, radius), 'wall-br', 'bottom-right');
  assertEqual(wallSprite(0, -radius, radius), 'wall-t', 'the top run');
  assertEqual(wallSprite(0, radius, radius), 'wall-b', 'the bottom run');
  assertEqual(wallSprite(-radius, 0, radius), 'wall-l', 'the left run');
  assertEqual(wallSprite(radius, 0, radius), 'wall-r', 'the right run');

  // Each corner exactly once, and each run the length of a side between them.
  for (const corner of ['wall-tl', 'wall-tr', 'wall-bl', 'wall-br'])
    assertEqual(seen.get(corner), 1, `${corner} is a corner, so there is one`);
  for (const runOf of ['wall-t', 'wall-b', 'wall-l', 'wall-r'])
    assertEqual(seen.get(runOf), radius * 2 - 1, `${runOf} spans its side`);
  assertEqual(seen.get('wall'), undefined, 'and nothing on a ring needs the standalone piece');

  // Which is what the standalone piece is for.
  assertEqual(wallSprite(0, 0, radius), 'wall', 'a wall tile on no ring');

  // Every piece the ring asks for has to exist as a sprite.
  for (const piece of [...seen.keys(), 'wall']) assert(sprites[piece], `${piece} was cut`);
});

unit('each wizard facing is split into colour bands that rebuild the whole sprite', () => {
  for (const facing of ['down', 'up', 'right', 'left']) {
    const whole = sprites[`wizard-${facing}`];
    const bands = Array.from({ length: WIZARD_ZONES }, (_, z) => sprites[`wizard-${facing}-${z}`]);
    // Stacking the bands back up has to give exactly the silhouette they were
    // cut from — a band that drops a row loses pixels off the character.
    const stacked = whole.map((_, y) =>
      Array.from(whole[y], (_, x) => (bands.some((b) => b[y][x] !== '.') ? whole[y][x] : '.')).join('')
    );
    assertEqual(stacked, whole, `${facing}: the bands are the whole wizard`);
  }
});

unit('floor texture is drawn at half strength, and nothing else is', () => {
  const solid = () => Array.from({ length: 16 }, () => '#'.repeat(16));
  const fromSolid = buildSprites(solid);

  assertEqual(fromSolid.floor, Array.from({ length: 16 }, () => DIM.repeat(16)), 'the whole tile is dimmed ground');

  // A dim pixel anywhere but the floor would be a second weight on an object,
  // which the two-colour rule doesn't have.
  for (const [key, mask] of Object.entries(fromSolid)) {
    if (key === 'floor') continue;
    assert(!mask.join('').includes(DIM), `${key} is drawn at one strength`);
  }
});

unit('the wizard accumulates one colour per gem, keeping the base band', () => {
  const fg = gemColour(0);
  assertEqual(zoneColours(0), [fg, fg, fg, fg], 'no gems: every band is the palette foreground');
  assertEqual(zoneColours(1), [fg, gemColour(1), fg, fg], 'one gem lights only its own band');
  assertEqual(zoneColours(2), [fg, gemColour(1), gemColour(2), fg], 'a second gem adds a band, keeping the first');
  assertEqual(zoneColours(3), [fg, gemColour(1), gemColour(2), gemColour(3)], 'a third gem lights every band');
});

unit('the move-speed setting clamps to its slider range', () => {
  const before = getMoveSpeed();
  assertEqual(setMoveSpeed(0), MIN_MOVE_SPEED, 'clamped up to the minimum');
  assertEqual(setMoveSpeed(99), MAX_MOVE_SPEED, 'clamped down to the maximum');
  assertEqual(setMoveSpeed(6.4), 6, 'rounded to a whole step');
  setMoveSpeed(before);
});

runIfMain(import.meta.url);
