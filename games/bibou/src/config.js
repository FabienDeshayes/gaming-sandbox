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

// Tween durations, ms (LEVEL_DESIGN.md nice-to-have: character/goal
// animations). Each is the *full* time the effect takes on screen — a bump or
// a pulse plays out-and-back within it, a wraparound slide splits it between
// its exit and entry halves.
export const MOVE_TWEEN_MS = 160; // one entity, one cell, straight slide
export const ROTATE_TWEEN_MS = 220; // every ring entity slides at once
export const FLIP_TWEEN_MS = 260; // squash to 0 (the "mirror"), then back
export const BUMP_TWEEN_MS = 240; // blocked move: nudge toward the wall, spring back
export const GOAL_PULSE_MS = 340; // reaching the goal: grow, then settle back
export const CRUSH_NUDGE_MS = 160; // a crushed crate: nudge toward what it hit, spring back
export const EXPLOSION_TWEEN_MS = 260; // a crushed crate: fragments burst outward and fade
export const PICKUP_TWEEN_MS = 220; // a collected collectible: grow and fade in place

// Distance from the board edge, in px, at which the edge arrows are drawn —
// Shift's inward-pointing row/column arrows and Flip's two mirror arrows (see
// BoardView.showShiftArrows / showFlipControls). See LEVEL_DESIGN.md §5.3/§5.4.
export const EDGE_ARROW_INSET = 20;

export const ACTION_LABELS = {
  move: 'Move',
  rotate: 'Rotate',
  shift: 'Shift',
  flip: 'Flip',
};

// Card row geometry, picked by how many action cards a level shows. A level can
// offer up to four actions, and four full-size cards don't fit across 480px, so
// the cards shrink as the row fills up. Keyed by card count.
export const CARD_LAYOUTS = {
  1: { spacing: 170, fontSize: 32, padX: 24 },
  2: { spacing: 170, fontSize: 32, padX: 24 },
  3: { spacing: 150, fontSize: 26, padX: 16 },
  4: { spacing: 116, fontSize: 22, padX: 10 },
};

export const CARD_Y = 720;
export const CARD_COUNT_Y = 672; // per-action budget counter, above its card

// Depth every transient control (direction/rotate/shift/flip arrows and their
// highlight outlines, BoardView's `controls` array) is drawn at, so they
// always sit above the board, walls, and entities regardless of draw order.
export const CONTROL_DEPTH = 50;

// Dark, low-saturation palette (see DESIGN.md §10). CSS strings are for text
// styles, 0x values for Graphics/Shape fills.
export const COLORS = {
  text: '#ffffff',
  hint: '#aaaaaa',
  button: '#242628',
  buttonHover: '#3a3d40',
  accent: '#1565c0', // selected card, arrows, ring outlines
  accentHex: 0x1565c0,
  highlight: '#ffb74d', // test mode, rotation center outline
  highlightHex: 0xffb74d,
  floorHex: 0x17191c,
  gridLineHex: 0x2a2d31,
  goalHex: 0x1b5e20,
  goalMark: '#a5d6a7',
  characterHex: 0x4fc3f7,
  wallHex: 0x9c4a35, // brick — walls, prototype styling (DESIGN.md §10)
  wallMortarHex: 0x4a3428, // mortar joints on the brick wall segments
  explosionHex: 0xff8a50, // fragments when a crushed crate is destroyed
  disabled: '#1c1c1c', // action card with no budget left
  disabledText: '#666666',
  lose: '#ef9a9a',
  objective: '#ffd54f', // level objective text, and the goal marker while locked

  // Action-card panels (BoardView-adjacent ui/actionCard.js): a stronger,
  // bordered "playable card" look distinct from the plain nav buttons.
  cardFillHex: 0x1b2027,
  cardBorderHex: 0x3c4652, // idle
  cardBorderHoverHex: 0x55636f,
  cardBorderDisabledHex: 0x242428, // spent action

  // Transient control arrows (BoardView.addControlArrow): deliberately
  // low-contrast so they read as a preview overlay, not another entity.
  controlBg: 'rgba(18,20,24,0.6)',
  controlGlyph: '#8fb8e6',
};

export const CRATE_TEXTURE_KEY = 'crate';
export const CRATE_TEXTURE_PATH = 'assets/sprites/crate.png';

// Collectibles (DESIGN.md, LEVEL_DESIGN.md §3): static pickups on the board,
// keyed by `type`. Glyph is the on-board marker; label is what shows in the
// HUD objective line. Add an entry here whenever a new collectible type ships.
export const COLLECTIBLE_GLYPHS = {
  key: '🔑',
};

export const COLLECTIBLE_LABELS = {
  key: 'key',
};

// Goal marker glyph, swapped based on whether any `required` collectible is
// still outstanding (LEVEL_DESIGN.md §4).
export const GOAL_LOCKED_GLYPH = '🔒';
export const GOAL_UNLOCKED_GLYPH = '★';
