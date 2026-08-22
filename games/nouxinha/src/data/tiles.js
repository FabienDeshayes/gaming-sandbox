// Where every sprite lives on the tile sheet.
//
// The art is one image, `assets/tiles.png`: a 1-bit sheet of 16x16 tiles laid
// out 49 across and 22 down, with a single transparent pixel between
// neighbours. Every tile is drawn in near-white on transparent, which is what
// lets the renderer tint the whole game with the palette's foreground and keep
// the two-colour rule (DESIGN.md §9) a property of the renderer rather than of
// the art.
//
// A tile is addressed by its **(col, row)**, zero-based, origin top-left — so
// [12, 1] is the thirteenth tile across, second row down. That is the
// coordinate system used everywhere: open `tiles.html` through the same server
// the game runs on and it draws the sheet with those coordinates printed on it,
// marking the tiles this table already claims. Repointing a sprite is editing
// one pair of numbers below; nothing else in the game names a tile.
//
// A key can also name a **list** of tiles, and then the terrain alternates
// between them — one is picked per world tile, from the seed, so a rock field
// isn't the same rock stamped fifty times and the choice never changes as you
// walk back past it. Those become `key-0`, `key-1`, ... with the bare `key`
// staying as an alias for the first, for anything that just wants one of them.

export const SHEET_KEY = 'tiles';
export const SHEET_PATH = 'assets/tiles.png';

// The sheet's own geometry. `ensureTextures` checks the loaded image against
// these, so a sheet swapped for one of another size fails loudly at boot
// instead of quietly slicing every sprite off by a pixel.
export const SHEET_COLS = 49;
export const SHEET_ROWS = 22;
export const SHEET_GAP = 1;

// The tile behind each sprite key. Keys are the names the rest of the game
// draws with (`setTexture('rock')`, `def.sprite`), so this table is the only
// place that knows the sheet exists.
export const TILES = {
  // --- The character -------------------------------------------------------
  // One tile for all four facings until side and back views are drawn. The
  // sheet is face-on throughout and holds no figure seen from behind, and a
  // wrong-looking turn is worse than no turn at all — the direction the
  // character is facing is carried by the shape of the lit ground meanwhile.
  'wizard-down': [24, 1],
  'wizard-up': [24, 1],
  'wizard-right': [24, 1],
  'wizard-left': [24, 1],

  // --- Terrain -------------------------------------------------------------
  // Floor's tile is ground texture, drawn at half strength (FLOOR_TEXTURE_LEVEL
  // in src/config.js, derived in src/data/sprites.js) so it reads as a surface
  // without competing with the things standing on it.
  floor: [5, 0],
  // Rock and trees each alternate between several tiles, picked per world tile
  // from the seed. Rock's three are one terrain and one formation rule — a
  // mass and a loose boulder draw from the same list (DESIGN.md §4.3).
  rock: [
    [12, 4],
    [12, 1],
    [5, 2],
  ],
  tree: [
    [0, 1],
    [2, 1],
    [3, 1],
    [5, 1],
    [4, 1],
    [3, 2],
    [1, 1],
    [4, 2],
  ],
  gate: [13, 11],
  'gate-open': [12, 11],

  // --- The sanctum wall ----------------------------------------------------
  // A sanctum is a square ring of wall one tile thick (DESIGN.md §4.4), so its
  // masonry is a nine-slice: four corners, four runs, and the standalone piece
  // for a wall tile that isn't on a ring at all. They sit on the sheet in the
  // same 3x3 arrangement they are drawn in, and `wallSprite` below picks one
  // from where the tile sits on its ring.
  'wall-tl': [16, 13],
  'wall-t': [17, 13],
  'wall-tr': [18, 13],
  'wall-l': [16, 14],
  wall: [17, 14],
  'wall-r': [18, 14],
  'wall-bl': [16, 15],
  'wall-b': [17, 15],
  'wall-br': [18, 15],

  // --- Structures ----------------------------------------------------------
  base: [1, 20],
  merchant: [5, 20],

  // --- Items ---------------------------------------------------------------
  // The four lights climb a silhouette: candle, lantern, candelabra, and a
  // radiating burst for the beacon, which is the only one that has to read as
  // "this lights everything".
  'torch-small': [3, 15],
  'torch-medium': [4, 15],
  'torch-lamp': [5, 15],
  'torch-beacon': [2, 15],
  'water-drop': [15, 10],
  'water-flask': [41, 11],
  'spring-vial': [33, 13],
  coin: [41, 3],
  gem: [23, 4],
  compass: [22, 14],
  map: [46, 5],

  // --- HUD -----------------------------------------------------------------
  // The compass needle, one tile per direction. Four for now: the sheet's
  // arrows are drawn pointing, so a heading is a texture swap rather than a
  // rotation, and `compassHeading` snaps to the four these can draw.
  'arrow-up': [28, 20],
  'arrow-right': [29, 20],
  'arrow-down': [30, 20],
  'arrow-left': [31, 20],
};

// How many tiles a key alternates between; 1 for the single-tile ones.
export function variantCount(key) {
  const tile = TILES[key];
  if (!tile) return 0;
  return Array.isArray(tile[0]) ? tile.length : 1;
}

// The texture key for one of a terrain's tiles, given a roll in [0, 1) — which
// the caller derives from the world (`variantAt` in src/core/world.js), so the
// same tile always draws the same way.
export function variantKey(key, roll) {
  const count = variantCount(key);
  if (count <= 1) return key;
  return `${key}-${Math.min(count - 1, Math.floor(roll * count))}`;
}

// Which piece of the wall nine-slice a ring tile needs. `dx`/`dy` are the
// tile's offset from the sanctum's centre and `radius` the ring's half-width,
// so a tile is on the top run when `dy` is at the near edge, on a corner when
// both are at an edge, and the bare `wall` piece when it is on no ring at all.
export function wallSprite(dx, dy, radius) {
  const vertical = dy === -radius ? 't' : dy === radius ? 'b' : '';
  const horizontal = dx === -radius ? 'l' : dx === radius ? 'r' : '';
  const piece = vertical + horizontal;
  return piece ? `wall-${piece}` : 'wall';
}
