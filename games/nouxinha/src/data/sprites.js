// Every sprite in the game, as a 16x16 1-bit mask.
//
// '#' is a pixel drawn in the palette's foreground, '+' one drawn at half its
// strength, '.' transparent. The masks are not authored here — they are cut out
// of the tile sheet (`src/data/tiles.js`) at boot and then baked into textures
// (src/ui/textures.js) that are tinted with the foreground at draw time, which
// is what keeps the two-colour rule (DESIGN.md §9) a property of the renderer
// rather than something each asset has to be re-authored for.
//
// What lives here is everything the sheet cannot give: the wizard's colour
// bands, the floor's half-strength ground texture, and a terrain's alternate
// tiles. All of it is *derived* from a sheet tile, so repointing a sprite
// (src/data/tiles.js) carries it along.

import { TILES, variantCount } from './tiles.js';

// The two levels a mask pixel can be drawn at. `DIM` is the same colour at
// FLOOR_TEXTURE_LEVEL (src/config.js) — one texture, two weights, still one
// colour on screen.
export const LIT = '#';
export const DIM = '+';

function dimmed(mask) {
  return mask.map((row) => row.replace(/#/g, DIM));
}

// The wizard wears one colour per gem recovered, plus the base colour they
// start with (DESIGN.md §9). A single sprite can only take one tint, so each
// facing is split into four horizontal bands — top to bottom, hat tip to
// feet — baked as their own masks and stacked back into the same silhouette at
// draw time. Band 0 is always the palette's own foreground; bands 1-3 turn the
// colour of gems one, two and three once carried, so the character accumulates
// colour instead of just swapping it.
export const WIZARD_ZONES = 4;

function zoneMask(mask, zone) {
  const bandSize = Math.ceil(mask.length / WIZARD_ZONES);
  const lo = zone * bandSize;
  const hi = lo + bandSize;
  const blank = '.'.repeat(mask[0].length);
  return mask.map((row, y) => (y >= lo && y < hi ? row : blank));
}

function wizardZones(mask, key) {
  const out = {};
  for (let zone = 0; zone < WIZARD_ZONES; zone++) out[`${key}-${zone}`] = zoneMask(mask, zone);
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

  // The wizard's four colour bands, per facing.
  for (const facing of ['down', 'up', 'right', 'left'])
    Object.assign(sprites, wizardZones(sprites[`wizard-${facing}`], `wizard-${facing}`));

  // Floor: ground texture at half strength, and nothing else drawn on top of
  // it (DESIGN.md §9).
  sprites.floor = dimmed(sprites.floor);

  return sprites;
}
