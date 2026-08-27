// Every sprite in the game, as a 16x16 1-bit mask.
//
// '#' is a pixel drawn in the palette's foreground, '+' one drawn at half its
// strength, '.' transparent. The masks are not authored here — they are cut out
// of the tile sheet (`src/data/tiles.js`) at boot and then baked into textures
// (src/ui/textures.js) that are tinted with the foreground at draw time, which
// is what keeps the two-colour rule (DESIGN.md §9) a property of the renderer
// rather than something each asset has to be re-authored for.
//
// What lives here is everything the sheet cannot give: a terrain's alternate
// tiles, the floor's half-strength ground texture, and the colour zones a tile
// is cut into so parts of it can turn the colour a gem gave back
// (`src/data/paint.js`). All of it is *derived* from a sheet tile, so
// repointing a sprite (src/data/tiles.js) carries it along.

import { PAINT, paintOf, zoneAt, zoneKey } from './paint.js';
import {
  BIOME_KEYS,
  BIOME_TILES,
  TILES,
  baseKey,
  biomeKey,
  tileFor,
} from './tiles.js';

// The two levels a mask pixel can be drawn at. `DIM` is the same colour at
// FLOOR_TEXTURE_LEVEL (src/config.js) — one texture, two weights, still one
// colour on screen.
export const LIT = '#';
export const DIM = '+';

function dimmed(mask) {
  return mask.map((row) => row.replace(/#/g, DIM));
}

// A painted tile is cut into one mask per zone: zone 0 keeps every pixel the
// map left alone, and each other zone keeps only what the map claimed for it.
// A single sprite can take only one tint, so the zones are baked as their own
// textures and stacked back into the same silhouette at draw time
// (`src/ui/painted.js`) — which is what lets one tile carry up to four colours
// while every texture in the game is still a flat 1-bit mask.
function zoneMasks(mask, key, entry) {
  const zones = entry.hues.length;
  const out = {};
  for (let zone = 0; zone <= zones; zone++) {
    out[zoneKey(key, zone)] = mask.map((row, y) =>
      Array.from(row, (ink, x) => {
        const claimed = zoneAt(entry.map, x, y);
        if (claimed > zones)
          throw new Error(
            `paint for "${key}" puts a pixel in zone ${claimed}, but it only names ${zones}`
          );
        return ink !== '.' && claimed === zone ? ink : '.';
      }).join('')
    );
  }
  return out;
}

// One key off the sheet, under whatever name it is being cut as. A key naming
// several tiles becomes `name-0`, `name-1`, ... plus the bare name as an alias
// for the first, so anything that just wants one of them (a Settings preview,
// say) can still ask for `rock`.
function cut(sprites, readTile, name, tile) {
  if (!Array.isArray(tile[0])) {
    sprites[name] = readTile(tile[0], tile[1]);
    return;
  }
  tile.forEach(([col, row], n) => {
    sprites[`${name}-${n}`] = readTile(col, row);
  });
  sprites[name] = sprites[`${name}-0`];
}

// Builds the whole sprite table from a `readTile(col, row) -> mask` cut out of
// the sheet. Takes the reader rather than the image so the derivation above
// stays pure and testable, and so nothing in `src/data/` has to know how a PNG
// is decoded. `biomes` is the biome tile table, passed only by the tests, for
// the same reason.
export function buildSprites(readTile, biomes = BIOME_TILES) {
  const sprites = {};

  // Everything the table names, straight off the sheet.
  for (const [key, tile] of Object.entries(TILES)) cut(sprites, readTile, key, tile);

  // Then the tiles a biome draws differently, under a key of its own
  // (`rock@frozen`). A biome that draws the same tile as everyone else gets the
  // shared key back and so is cut once, not four times — which is why four
  // biomes of the same art cost nothing (src/data/tiles.js).
  for (const [biome, own] of Object.entries(biomes)) {
    for (const key of Object.keys(own)) {
      if (!BIOME_KEYS.includes(key))
        throw new Error(
          `biome "${biome}" repoints "${key}", which is not one of the world's own tiles`
        );
      const name = biomeKey(key, biome, biomes);
      if (name !== key) cut(sprites, readTile, name, tileFor(key, biome, biomes));
    }
  }

  // Floor: ground texture at half strength, and nothing else drawn on top of
  // it (DESIGN.md §9). Before the zones are cut, so a painted fleck of ground
  // is drawn at the same half strength as the ground around it. Every floor
  // there is — a biome's own, and any tile it alternates between — because what
  // makes ground ground is the weight it is drawn at, whichever world it is in.
  // A landmark's court is ground too — its own paving rather than the world's,
  // but ground, so it is drawn at the same weight as the floor around it
  // (DESIGN.md §4.10). Anything a landmark *stands* on is dimmed here; the
  // landmark itself is not.
  for (const key of Object.keys(sprites))
    if (/^(floor|court-[a-z-]+)(-\d+)?$/.test(baseKey(key))) sprites[key] = dimmed(sprites[key]);

  // The colour zones, last: every sprite the sheet and the derivations above
  // can give is in hand by now, and a zone is a cut of one of them. Driven off
  // the sprites rather than off the paint table, so a biome's own tile is cut
  // into the same zones as the tile it is a version of (`paintOf`).
  for (const key of Object.keys(PAINT))
    if (!sprites[key]) throw new Error(`paint names "${key}", which is not a sprite`);
  for (const key of Object.keys(sprites)) {
    const entry = paintOf(key);
    if (entry) Object.assign(sprites, zoneMasks(sprites[key], key, entry));
  }

  return sprites;
}
