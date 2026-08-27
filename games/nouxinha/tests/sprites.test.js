// The art: one tile sheet addressed by coordinate, cut into masks, plus the
// palette rules the masks are tinted by. That the *real* sheet loads and is cut
// needs a canvas, so it lives in tests/ui-shell.test.js; everything derivable is
// here. Pure — no browser.

import { assert, assertEqual, runIfMain, unit } from './harness.js';
import { DIM, buildSprites } from '../src/data/sprites.js';
import {
  BIOME_KEYS,
  BIOME_TILES,
  SHEET_COLS,
  SHEET_ROWS,
  TILES,
  VARIANT_KEYS,
  baseKey,
  biomeKey,
  tileList,
  variantCount,
  variantKey,
  wallSprite,
} from '../src/data/tiles.js';
import { BIOME_IDS } from '../src/data/biomes.js';
import { PAINT, PAINT_ZONES, ZONE_INK, paintOf, zoneAt, zoneKey } from '../src/data/paint.js';
import { zoneTints } from '../src/ui/painted.js';
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

// --- Biomes ------------------------------------------------------------------

unit('only the terrains a world alternates between name more than one tile', () => {
  // Everything else is drawn through `biomeKey`, which hands back one sprite —
  // a list on a gate would quietly draw the first of them and lose the rest.
  const tables = [['TILES', TILES], ...Object.entries(BIOME_TILES).map(([b, own]) => [b, own])];
  for (const [where, table] of tables)
    for (const [key, tile] of Object.entries(table))
      if (tileList(tile).length > 1)
        assert(VARIANT_KEYS.includes(key), `${where} gives "${key}" several tiles, so it alternates`);
});

unit('every biome names its own floors, rock and trees', () => {
  // The three each world is mostly made of are spelled out per biome rather
  // than left to the fallback, because those are the ones a world is meant to
  // own. What they name today is what every world draws.
  for (const biome of BIOME_IDS)
    for (const key of VARIANT_KEYS) {
      const own = BIOME_TILES[biome][key];
      assert(own, `${biome} names its ${key}`);
      assert(Array.isArray(own[0]), `${biome}'s ${key} is a list, even holding one`);
    }
});

unit('a list of one tile and that tile are the same thing said twice', () => {
  // Which is what lets a biome write `floor: [[5, 0]]` — a list of floors that
  // happens to hold one — without that counting as drawing its own.
  const biomes = { ...BIOME_TILES, desert: { ...BIOME_TILES.desert, gate: [TILES.gate] } };
  assertEqual(biomeKey('gate', 'desert', biomes), 'gate', 'the shared sprite comes back');
  assertEqual(variantCount('gate', 'desert', biomes), 1, 'and it is still the one tile');
  assertEqual(variantKey('gate', 0.9, 'desert', biomes), 'gate', 'so nothing is suffixed');
  assertEqual(tileList(TILES.gate), [TILES.gate], 'a bare tile reads as a list of one');
});

unit('every biome names tiles that are on the sheet, and only terrain', () => {
  assertEqual(
    Object.keys(BIOME_TILES).sort(),
    BIOME_IDS.slice().sort(),
    'the tile table covers the four biomes and nothing else'
  );

  for (const [biome, own] of Object.entries(BIOME_TILES))
    for (const [key, tile] of Object.entries(own)) {
      assert(BIOME_KEYS.includes(key), `${biome} repoints "${key}", one of the world's own tiles`);
      const pairs = Array.isArray(tile[0]) ? tile : [tile];
      for (const [col, row] of pairs) {
        assert(Number.isInteger(col) && col >= 0 && col < SHEET_COLS, `${biome}/${key}: column ${col} is on the sheet`);
        assert(Number.isInteger(row) && row >= 0 && row < SHEET_ROWS, `${biome}/${key}: row ${row} is on the sheet`);
      }
    }

  // And what a biome may repoint is a tile the game actually draws.
  for (const key of BIOME_KEYS) assert(TILES[key], `${key} is a sprite the sheet gives`);
});

unit('a biome only pays for a sprite of its own where it actually draws differently', () => {
  // Rock is the same three tiles in every biome today, so it costs one cut,
  // not four. Floor and tree are where the four worlds actually differ.
  const sharedKeys = BIOME_KEYS.filter((key) => !['floor', 'tree'].includes(key));
  for (const biome of BIOME_IDS)
    for (const key of sharedKeys) assertEqual(biomeKey(key, biome), key, `${biome} shares the ${key} sprite`);

  // Temperate's floor still happens to land on the default's own tile; every
  // other floor, and every biome's trees, are a world's own.
  assertEqual(biomeKey('floor', 'temperate'), 'floor', "temperate's floor is the shared tile");
  for (const biome of BIOME_IDS.filter((b) => b !== 'temperate'))
    assertEqual(biomeKey('floor', biome), `floor@${biome}`, `${biome}'s floor is its own`);
  for (const biome of BIOME_IDS) assertEqual(biomeKey('tree', biome), `tree@${biome}`, `${biome}'s trees are its own`);
});

unit('a biome that repoints a tile gets its own sprite, painted like the tile it came from', () => {
  // The one thing the real table cannot exercise while all four biomes draw the
  // same art: a biome with stone of its own, and a floor of its own that
  // alternates where the shared one does not.
  const biomes = { ...BIOME_TILES, frozen: { rock: [[0, 0], [1, 0]], floor: [2, 3] } };
  const cold = buildSprites(fakeSheet, biomes);

  assertEqual(biomeKey('rock', 'frozen', biomes), 'rock@frozen', 'the repointed key belongs to the biome');
  assertEqual(biomeKey('tree', 'frozen', biomes), 'tree', 'and everything it left alone is shared');
  assertEqual(biomeKey('rock', 'desert', biomes), 'rock', 'as is what every other biome draws');

  assertEqual(variantCount('rock', 'frozen', biomes), 2, 'a biome can alternate between its own number of tiles');
  assertEqual(variantKey('rock', 0.9, 'frozen', biomes), 'rock@frozen-1', 'and the roll picks one of those');
  assertEqual(variantKey('rock', 0.9, 'desert', biomes), 'rock-2', 'while another biome rolls the shared three');

  assertEqual(cold['rock@frozen-0'], fakeSheet(0, 0), 'the first tile of the biome is the one it names');
  assertEqual(cold['rock@frozen'], cold['rock@frozen-0'], 'the bare key is the first of them');
  assertEqual(cold['rock-0'], sprites['rock-0'], 'and the shared rock is untouched by any of it');

  // Ground is ground in every world: a biome's floor is still drawn at half
  // strength, or it would stop reading as a surface.
  assert(cold['floor@frozen'].join('').includes(DIM), 'the floor of a biome is ground texture');

  // Paint follows the tile a biome's sprite is a version of, so a world drawn
  // in different stone keeps the veins a gem lights up in it.
  assertEqual(baseKey('rock@frozen-1'), 'rock-1', 'a biome sprite knows the tile it is a version of');
  const zones = paintOf('rock@frozen-1');
  assertEqual(zones, paintOf('rock-1'), 'and is painted the way that tile is');
  for (let zone = 0; zone <= zones.hues.length; zone++)
    assert(cold[zoneKey('rock@frozen-1', zone)], `zone ${zone} of the frozen rock was cut`);
});

unit('a tile past the end of the shared list is painted like the terrain', () => {
  // A world that alternates between six floors where the shared table names one
  // keeps the ground's flecks on all six: past the tile it is a version of, a
  // variant falls back on its terrain rather than on nothing. Painting it for
  // that world (`paint.html`) is what says otherwise.
  assertEqual(paintOf('floor@frozen-3'), paintOf('floor'), 'the fourth frozen floor is ground');
  assertEqual(paintOf('tree@desert-9'), paintOf('tree'), 'and a tenth desert tree is a tree');
  assertEqual(paintOf('rock-1'), PAINT['rock-1'], 'while a tile with zones of its own keeps them');
  assertEqual(paintOf('coin'), null, 'and a tile with none still has none');
});

unit('a biome cannot repoint anything but terrain', () => {
  let thrown = null;
  try {
    buildSprites(fakeSheet, { ...BIOME_TILES, desert: { coin: [0, 0] } });
  } catch (e) {
    thrown = e;
  }
  assert(thrown, 'a biome that repoints an item is refused');
  assert(/coin/.test(thrown.message), 'and the error names it');
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

unit('a painted tile is cut into zones that rebuild the whole sprite', () => {
  for (const key of Object.keys(PAINT)) {
    const entry = paintOf(key);
    assert(entry && Array.isArray(entry.hues), `${key} resolves to a paint entry`);
    assert(entry.hues.length >= 1, `${key} paints at least one zone`);
    assert(entry.hues.length < PAINT_ZONES, `${key} paints at most ${PAINT_ZONES - 1} zones`);
    assertEqual(entry.map.length, 16, `${key}: the zone map is 16 rows`);
    for (const row of entry.map) assertEqual(row.length, 16, `${key}: the zone map is 16 px wide`);

    const whole = sprites[key];
    const zones = Array.from({ length: entry.hues.length + 1 }, (_, z) => sprites[zoneKey(key, z)]);
    for (const zone of zones) assert(zone, `${key}: every zone was cut`);

    // Stacking the zones back up has to give exactly the silhouette they were
    // cut from, with no pixel in two of them: a zone that drops a pixel puts a
    // hole in the tile, and one that keeps a pixel twice draws it in two
    // colours at once.
    whole.forEach((row, y) =>
      Array.from(row).forEach((ink, x) => {
        const drawn = zones.filter((zone) => zone[y][x] !== '.');
        assertEqual(drawn.length, ink === '.' ? 0 : 1, `${key} (${x}, ${y}) is drawn once`);
        if (ink !== '.') assertEqual(drawn[0][y][x], ink, `${key} (${x}, ${y}) keeps its weight`);
      })
    );

    // And a pixel lands in the zone its map put it in.
    whole.forEach((row, y) =>
      Array.from(row).forEach((ink, x) => {
        if (ink === '.') return;
        const zone = zoneAt(entry.map, x, y);
        assert(zones[zone][y][x] === ink, `${key} (${x}, ${y}) is in zone ${zone}`);
      })
    );
  }

  // A map is written in the zone characters and nothing else, so a typo in one
  // is a failure here rather than a pixel quietly falling back to zone 0.
  for (const entry of Object.values(PAINT)) {
    if (typeof entry === 'string') continue;
    const stray = entry.map.join('').match(new RegExp(`[^${ZONE_INK.join('')}]`));
    assert(!stray, `"${stray && stray[0]}" is not a zone character`);
  }
});

unit('floor texture is drawn at half strength, and nothing else is', () => {
  const solid = () => Array.from({ length: 16 }, () => '#'.repeat(16));
  const fromSolid = buildSprites(solid);

  assertEqual(fromSolid.floor, Array.from({ length: 16 }, () => DIM.repeat(16)), 'the whole tile is dimmed ground');
  // A landmark's court is its own paving rather than the world's floor, and it
  // is drawn at the same weight as the ground it interrupts (DESIGN.md §4.10) —
  // otherwise walking into a court would look like walking onto a wall.
  assertEqual(
    fromSolid['court-bell'],
    Array.from({ length: 16 }, () => DIM.repeat(16)),
    'and so is a court'
  );

  // A dim pixel anywhere but the ground would be a second weight on an object,
  // which the two-colour rule doesn't have. The floor's own colour zones are
  // cut out of the dimmed tile, so they carry the same weight it does.
  const ground = (key) => /^(floor|court-[a-z-]+)(-\d+)?(-z\d+)?$/.test(baseKey(key));
  for (const [key, mask] of Object.entries(fromSolid)) {
    if (ground(key)) continue;
    assert(!mask.join('').includes(DIM), `${key} is drawn at one strength`);
  }
});

unit('the wizard accumulates one colour per gem, keeping the base silhouette', () => {
  const fg = gemColour(0);
  const tints = (gems) => zoneTints('wizard-down', { gems });
  assertEqual(tints(0), [fg, fg, fg, fg], 'no gems: the whole character is the palette foreground');
  assertEqual(tints(1), [fg, gemColour(1), fg, fg], 'one gem lights only its own zone');
  assertEqual(tints(2), [fg, gemColour(1), gemColour(2), fg], 'a second gem adds a zone, keeping the first');
  assertEqual(tints(3), [fg, gemColour(1), gemColour(2), gemColour(3)], 'a third gem lights every zone');

  // Every facing is the same tile and shares the one map, so they all wear it.
  for (const facing of ['up', 'right', 'left'])
    assertEqual(zoneTints(`wizard-${facing}`, { gems: 3 }), tints(3), `${facing} is painted too`);
});

unit('a place-dependent hue waits for the gem it names', () => {
  const fg = gemColour(0);
  // A sanctum's masonry is the colour of the gem it keeps — but only once that
  // gem has been picked up, so no colour is ever on screen before the run that
  // brought it back.
  const wall = (gems, gem) => zoneTints('wall-t', { gems, roles: { gem } })[1];
  assertEqual(wall(0, 2), fg, 'an unclaimed sanctum is drawn as plain masonry');
  assertEqual(wall(1, 2), fg, "and stays plain while you hold somebody else's gem");
  assertEqual(wall(2, 2), gemColour(2), 'taking its gem is what lights it');

  // A gate carries both at once: the sanctum behind it and whoever opened it.
  const gate = (gems, roles) => zoneTints('gate-open', { gems, roles });
  assertEqual(gate(1, { gem: 1, opened: 0 }), [fg, gemColour(1), fg, fg], 'the first arch never wanted a gem');
  assertEqual(
    gate(2, { gem: 2, opened: 1 }),
    [fg, gemColour(2), gemColour(1), fg],
    'the second wears its own gem on the arch and the gem that opened it on the leaves'
  );

  // An unpainted tile is one colour, whatever it is handed.
  assertEqual(
    zoneTints('merchant', { gems: 3, roles: { gem: 1 } }),
    [fg, fg, fg, fg],
    'the stall is one colour'
  );
});

unit('the move-speed setting clamps to its slider range', () => {
  const before = getMoveSpeed();
  assertEqual(setMoveSpeed(0), MIN_MOVE_SPEED, 'clamped up to the minimum');
  assertEqual(setMoveSpeed(99), MAX_MOVE_SPEED, 'clamped down to the maximum');
  assertEqual(setMoveSpeed(6.4), 6, 'rounded to a whole step');
  setMoveSpeed(before);
});

runIfMain(import.meta.url);
