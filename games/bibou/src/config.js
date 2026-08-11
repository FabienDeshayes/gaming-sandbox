// Screen, board layout, and palette constants shared across scenes.

export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 854;

// Board geometry. The 5x5 board is centered horizontally in the design space.
export const CELL = 80;
export const BOARD_PX = CELL * 5; // 400
export const BOARD_X = (GAME_WIDTH - BOARD_PX) / 2; // 40
export const BOARD_Y = 230;

// px — below this a pointer up is a tap, not a swipe
export const SWIPE_THRESHOLD = 24;

// Distance from the board edge, in px, at which Shift's inward-pointing
// arrows are drawn (see BoardView.showShiftArrows). See LEVEL_DESIGN.md §5.3.
export const SHIFT_ARROW_EDGE = 20;

export const ACTION_LABELS = { move: 'Move', rotate: 'Rotate', shift: 'Shift' };

// Flat palette (see DESIGN.md §10). CSS strings are for text styles, 0x values
// for Graphics/Shape fills.
export const COLORS = {
  text: '#ffffff',
  hint: '#aaaaaa',
  button: '#333333',
  buttonHover: '#555555',
  accent: '#1565c0', // selected card, arrows, ring outlines
  accentHex: 0x1565c0,
  highlight: '#ffb74d', // test mode, rotation center outline
  highlightHex: 0xffb74d,
  floorHex: 0x222222,
  gridLineHex: 0x444444,
  goalHex: 0x2e7d32,
  goalMark: '#a5d6a7',
  characterHex: 0x4fc3f7,
  lose: '#ef9a9a',
};
