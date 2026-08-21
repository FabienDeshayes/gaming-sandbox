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
  // The sheet has no side or back views of a figure, so the three views are
  // three different robed characters that read apart at 16x16 rather than one
  // character turned around: a pointed-hat wizard face-on, a blank hood for
  // the back of a head, and a hooded figure for the profile. This is the part
  // of the table most worth repointing by eye.
  'wizard-down': [26, 9],
  'wizard-up': [28, 9],
  'wizard-right': [27, 9],

  // --- Terrain -------------------------------------------------------------
  // Floor points at the sheet's blank tile: an explored floor tile is its
  // dotted border and nothing else (DESIGN.md §9), and the border is derived
  // rather than drawn. Point this at a textured tile and the border still
  // draws on top of it.
  floor: [0, 0],
  // Rock has to mass: nine of these in a block read as one rock wall, and one
  // on its own still reads as a boulder. Both formations draw this tile.
  rock: [9, 1],
  tree: [4, 2],
  wall: [8, 0],
  gate: [13, 11],
  'gate-open': [12, 11],

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
  // Two arrows cover the compass badge's eight headings, each rotated in 90°
  // steps (src/ui/compassBadge.js), so both have to sit square in their tile.
  'arrow-up': [24, 13],
  'arrow-diagonal': [41, 5],
};

// Sprites that are another sprite's tile flipped left-to-right. The sheet is
// drawn face-on, so this is only ever the character's two profiles — one tile,
// two facings, nothing to keep in sync.
export const MIRRORED = {
  'wizard-left': 'wizard-right',
};
