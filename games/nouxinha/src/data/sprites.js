// Every sprite in the game, as a 16x16 1-bit mask.
//
// '#' is a lit pixel, '.' is transparent. The masks are not authored here any
// more — they are cut out of the tile sheet (`src/data/tiles.js`) at boot and
// then baked into white textures (src/ui/textures.js) and tinted with the
// palette's foreground at draw time, which is what keeps the two-colour rule
// (DESIGN.md §9) a property of the renderer rather than something each asset
// has to be re-authored for.
//
// What lives here is everything the sheet cannot give: the mirrored facing, the
// wizard's colour bands, and the floor's frontier edges. All three are
// *derived* from a sheet tile, so repointing a sprite at a different tile
// (src/data/tiles.js) carries them along with it.

import { MIRRORED, TILES } from './tiles.js';

// The left-facing wizard is the right-facing tile mirrored — same silhouette,
// no second tile to keep in sync.
export function mirror(mask) {
  return mask.map((row) => row.split('').reverse().join(''));
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

// Floor's dotted border, which is drawn rather than taken from the sheet —
// it is a property of what has been explored, not of the ground itself.
//
// A tile always closes its top and left edges, so the edge shared by two known
// tiles is drawn once rather than doubled, and closes its right or bottom edge
// only where the neighbour there is still unknown. The frontier of explored
// ground then reads as a boundary instead of an unfinished grid (DESIGN.md §9).
// The border goes on top of whatever tile `floor` points at, so pointing it at
// textured ground keeps the grid.
const EDGE_DOTS = '#.#.#.#.#.#.#.#.';

function withTopEdge(mask) {
  return mask.map((row, y) => (y === 0 ? EDGE_DOTS : row));
}

function withLeftEdge(mask) {
  return mask.map((row, y) => (y % 2 === 0 ? '#' + row.slice(1) : row));
}

function withRightEdge(mask) {
  return mask.map((row, y) => (y % 2 === 0 ? row.slice(0, -1) + '#' : row));
}

function withBottomEdge(mask) {
  return mask.map((row, y) => (y === mask.length - 1 ? EDGE_DOTS : row));
}

// Builds the whole sprite table from a `readTile(col, row) -> mask` cut out of
// the sheet. Takes the reader rather than the image so the derivation above
// stays pure and testable, and so nothing in `src/data/` has to know how a PNG
// is decoded.
export function buildSprites(readTile) {
  const at = (key) => {
    const tile = TILES[key];
    if (!tile) throw new Error(`sprite "${key}" has no tile in src/data/tiles.js`);
    return readTile(tile[0], tile[1]);
  };

  const wizard = {
    down: at('wizard-down'),
    up: at('wizard-up'),
    right: at('wizard-right'),
    left: mirror(at(MIRRORED['wizard-left'])),
  };

  const floor = withTopEdge(withLeftEdge(at('floor')));

  const sprites = {
    'wizard-down': wizard.down,
    'wizard-up': wizard.up,
    'wizard-right': wizard.right,
    'wizard-left': wizard.left,
    ...wizardZones(wizard.down, 'wizard-down'),
    ...wizardZones(wizard.up, 'wizard-up'),
    ...wizardZones(wizard.right, 'wizard-right'),
    ...wizardZones(wizard.left, 'wizard-left'),
    floor,
    'floor-r': withRightEdge(floor),
    'floor-b': withBottomEdge(floor),
    'floor-rb': withBottomEdge(withRightEdge(floor)),
  };

  // Everything else is its sheet tile and nothing more. Driven off the table
  // rather than listed again here, so adding a sprite is one line in
  // `src/data/tiles.js`.
  for (const key of Object.keys(TILES)) {
    if (key in sprites) continue;
    sprites[key] = at(key);
  }

  return sprites;
}
