// Layout, palette and type. No game numbers live here: those are
// src/data/tuning.js, and the board's size is read from there.

export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 854;

export const FONT = 'Trebuchet MS, Verdana, sans-serif';
export const FONT_SM = 16; // the smallest type in the game
export const FONT_MD = 20;
export const FONT_LG = 28;

// --- Vertical bands, top to bottom --------------------------------------------
//
// Where you are in the run, the board, what a tap says, the three offers, and
// the one button that commits. Everything the player can know is on screen at
// once; only the set list is an overlay.

export const HEADER_Y = 22;
export const SCORE_BAR_Y = 74;
export const SCORE_BAR_H = 10;

export const BOARD_X = 30;
export const BOARD_Y = 98;
export const CELL = 70;

export const INFO_Y = 536; // the preview / inspect panel
export const INFO_H = 78;

export const OFFER_Y = 704; // centre of the offer cards
export const OFFER_W = 140;
export const OFFER_H = 150;
export const OFFER_XS = [86, 240, 394];

export const PLACE_Y = 816;

export const COLORS = {
  bg: 0x12161c,
  panel: 0x1f2630,
  panelEdge: 0x3a4656,
  text: '#eef1f4',
  dim: '#93a0ae',
  gain: '#8fe388',
  loss: '#ff8a7a',
  select: 0xffe17a,
  grass: 0x3f6b3a,
  water: 0x2f5f8f,
  rock: 0x6b6660,
  piece: 0xf2ecdf,
  pieceText: '#1c1c1c',
  button: 0x2e7d5b,
  buttonOff: 0x2b333d,
};

// A piece's rim says its rarity.
export const RARITY_COLORS = {
  common: 0x9aa4ae,
  uncommon: 0x5fc46b,
  rare: 0x4f9cf0,
  legendary: 0xf0b43c,
};

export const RARITY_LABELS = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  legendary: 'Legendary',
};
