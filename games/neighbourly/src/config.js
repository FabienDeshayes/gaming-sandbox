// Layout, type, and which palette colour plays which part. No game numbers
// live here (those are src/data/tuning.js) and no colour is spelled here
// either: every colour is a name from src/data/palette.js, so recolouring the
// game is editing the palette (palette.html) and nothing else.

import { PALETTE } from './data/palette.js';

export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 854;

export const FONT = '"Trebuchet MS", Verdana, sans-serif';
export const FONT_SM = 16; // the smallest type in the game
export const FONT_MD = 20;
export const FONT_LG = 28;

// --- Pixel art ----------------------------------------------------------------
//
// A sprite is 16×16 art pixels (src/data/sprites.js) and is only ever drawn at
// a whole multiple of that, so every art pixel is a square block on screen.

export const SPRITE = 16;
export const PIECE_SCALE = 3; // on the board: 48px in a 72px tile
export const CARD_SCALE = 3; // on an offer card: 48px
export const LIST_SCALE = 2; // in the set list: 32px

// --- Vertical bands, top to bottom --------------------------------------------
//
// Where you are in the run, the board, what a tap says, the three offers, and
// the one button that commits. Everything the player can know is on screen at
// once; only the set list is an overlay.

export const HEADER_Y = 18;
export const SCORE_BAR_Y = 72;
export const SCORE_BAR_H = 12;

export const BOARD_X = 24;
export const BOARD_Y = 96;
export const CELL = 72;

export const INFO_Y = 538; // the preview / inspect panel
export const INFO_H = 80;

export const OFFER_Y = 708; // centre of the offer cards
export const OFFER_W = 144;
export const OFFER_H = 150;
export const OFFER_XS = [84, 240, 396];

export const PLACE_Y = 818;

// --- Colour -------------------------------------------------------------------

const HEX = Object.fromEntries(PALETTE.map((c) => [c.name, c.hex]));

// A palette colour by name, as Phaser wants it for a fill (a number) or for
// text (a CSS string).
export function colour(name) {
  const hex = HEX[name];
  if (!hex) throw new Error(`no palette colour "${name}"`);
  return parseInt(hex.slice(1), 16);
}
export function css(name) {
  colour(name);
  return HEX[name];
}

// Which colour plays which part, by palette name.
export const ROLES = {
  bg: 'ink',
  panel: 'night',
  panelEdge: 'slate',
  shadow: 'ink',
  text: 'white',
  dim: 'mist',
  gain: 'leaf',
  loss: 'coral',
  select: 'lemon',
  tile: 'slate',
  tileLight: 'dusk',
  tileDark: 'night',
  bar: 'gold',
  barMet: 'leaf',
  button: 'green',
  buttonLight: 'leaf',
  buttonOff: 'slate',
  badge: 'ink',
};

export const COLORS = Object.fromEntries(Object.entries(ROLES).map(([role, name]) => [role, colour(name)]));
export const TEXT = Object.fromEntries(Object.entries(ROLES).map(([role, name]) => [role, css(name)]));

// A piece's frame says its rarity.
export const RARITY_ROLES = {
  common: 'mist',
  uncommon: 'leaf',
  rare: 'sky',
  legendary: 'gold',
};
export const RARITY_COLORS = Object.fromEntries(Object.entries(RARITY_ROLES).map(([r, n]) => [r, colour(n)]));
export const RARITY_TEXT_COLORS = Object.fromEntries(Object.entries(RARITY_ROLES).map(([r, n]) => [r, css(n)]));
