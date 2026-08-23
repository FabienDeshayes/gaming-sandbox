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
import { TILES, variantCount } from './tiles.js';

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

// Builds the whole sprite table from a `readTile(col, row) -> mask` cut out of
// the sheet. Takes the reader rather than the image so the derivation above
// stays pure and testable, and so nothing in `src/data/` has to know how a PNG
// is decoded.
export function buildSprites(readTile) {
  const sprites = {};

  // Everything the table names, straight off the sheet. A key naming several
  // tiles becomes `key-0`, `key-1`, ... plus the bare key as an alias for the
  // first, so anything that just wants one of them (a Settings preview, say)
  // can still ask for `rock`.
  for (const [key, tile] of Object.entries(TILES)) {
    if (variantCount(key) === 1) {
      sprites[key] = readTile(tile[0], tile[1]);
      continue;
    }
    tile.forEach(([col, row], n) => {
      sprites[`${key}-${n}`] = readTile(col, row);
    });
    sprites[key] = sprites[`${key}-0`];
  }

  // Floor: ground texture at half strength, and nothing else drawn on top of
  // it (DESIGN.md §9). Before the zones are cut, so a painted fleck of ground
  // is drawn at the same half strength as the ground around it.
  sprites.floor = dimmed(sprites.floor);

  // The colour zones, last: every sprite the sheet and the derivations above
  // can give is in hand by now, and a zone is a cut of one of them.
  for (const key of Object.keys(PAINT)) {
    const entry = paintOf(key);
    if (!sprites[key]) throw new Error(`paint names "${key}", which is not a sprite`);
    Object.assign(sprites, zoneMasks(sprites[key], key, entry));
  }

  return sprites;
}
