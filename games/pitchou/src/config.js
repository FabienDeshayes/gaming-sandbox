// Layout constants, the storm palette, and the three persisted preferences.
//
// No game numbers live here. Everything the rules depend on — meter cap, drain
// schedule, shore composition, tool costs — is in src/core/rules.js's tuning
// object, because those were settled by simulation (DESIGN.md §8) and a second
// copy in the view layer would be a second source of truth. The only tuning
// this file touches is the hard-mode override, and that is one field.

export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 854;

export const SPRITE_PX = 16;

// A tap that travels further than this is a drag, not a click. Same tolerance
// Bibou uses, so a button inside a list never fires on a scroll.
export const SWIPE_THRESHOLD = 12;

// --- Vertical bands ---------------------------------------------------------
//
// One screen, no scrolling, thumb-reachable (DESIGN.md §5). Reading down:
// where you are in the season, what is draining, how close the night is to
// ending, what is left to find, what you are holding, and the two taps.

export const HEADER_Y = 30;
export const TRACK_Y = 62; // the twelve-night pip track
export const TRACK_PIP_R = 5;
export const TRACK_GAP = 26;

export const METER_TOP = 92;
export const METER_H = 150;
export const METER_W = 56;
export const METER_XS = { lamp: 92, hearth: 240, tower: 388 };

// The strike pips and the sentence that reads them share one line: how close
// the night is to ending is one thought, not two.
export const RISK_Y = 348;
export const RISK_PIP_X = 40;
export const RISK_PIP_GAP = 34;

// The shore grid sits in a fixed band and centres however many rows it needs.
// Seven columns because a season can push the shore to 25 tokens (18 to start,
// three from the storm, four more if every add-a-token tool gets built) and all
// of it has to stay on one screen — the contents are inspectable at all times
// (DESIGN.md §5), which is only true if they all fit.
export const SHORE_TOP = 382;
export const SHORE_BAND_H = 200;
export const SHORE_COLS = 7;
export const SHORE_CELL = 50;
export const SHORE_LEFT = (GAME_WIDTH - SHORE_COLS * SHORE_CELL) / 2;

export const BASKET_Y = 636;
export const BASKET_XS = { oil: 92, wood: 240, plank: 388 };

export const SEARCH_Y = 742;
export const HOME_Y = 812;

// Depth bands. Transient effects sit above the board, the dawn panel above
// everything — same banding idea as Bibou's PuzzleScene.
export const EFFECT_DEPTH = 40;
export const PANEL_DEPTH = 60;
export const PANEL_CONTENT_DEPTH = 61;

// --- Tween durations --------------------------------------------------------

export const FLIP_MS = 180; // a token turning face-up
export const DRAIN_MS = 420; // a meter bar falling at dusk
export const KNOCK_MS = 260; // a unit a wave knocks out of the basket
export const SHAKE_MS = 220; // the screen when a wave reaches you
export const VIGNETTE_MS = 500; // the bust flash

// --- Palette ----------------------------------------------------------------
//
// A dark storm, and the lamp is the only warm colour on screen (DESIGN.md §10).
// That rule is why Hearth and Tower are cool tones rather than fire colours:
// three warm meters would make the lamp just another bar, and the lamp going
// out is the whole stake. Waves are cold foam; the one red on the screen is the
// bust vignette, and it only exists for half a second.
//
// CSS strings for text styles, `…Hex` numbers for Graphics fills and tints,
// following Bibou's COLORS convention.
export const COLORS = {
  bg: '#0b1016',
  bgHex: 0x0b1016,
  panel: '#131c26',
  panelHex: 0x131c26,
  panelEdge: '#22303f',
  panelEdgeHex: 0x22303f,

  text: '#f2f6fa',
  textHex: 0xf2f6fa,
  // Both raised well past WCAG AA (4.5:1) against `bg` — `dim` used to sit at
  // ~2.6:1, which is what read as unreadable grey-on-dark.
  muted: '#b7c5d3',
  mutedHex: 0xb7c5d3,
  dim: '#8496a8',
  dimHex: 0x8496a8,

  lamp: '#ffb547',
  lampHex: 0xffb547,
  hearth: '#5f9ea8',
  hearthHex: 0x5f9ea8,
  tower: '#7d8ba0',
  towerHex: 0x7d8ba0,

  foam: '#9fd8ff',
  foamHex: 0x9fd8ff,
  bust: '#8c3a3a',
  bustHex: 0x8c3a3a,
  // A brighter red for text (doomed meter numeral, overflow warning) — `bust`
  // itself stays dark because it also paints the full-screen vignette flash,
  // where a deep red is the point.
  danger: '#ff6f6f',

  button: '#1b2733',
  buttonHex: 0x1b2733,
  buttonHover: '#27394a',
  buttonHoverHex: 0x27394a,
  buttonEdgeHex: 0x35485c,
  disabled: '#131a21',
  disabledHex: 0x131a21,
  disabledText: '#7f93a6',
};

export const METER_COLORS = { lamp: COLORS.lampHex, hearth: COLORS.hearthHex, tower: COLORS.towerHex };
export const RESOURCE_COLORS = { oil: COLORS.lampHex, wood: COLORS.hearthHex, plank: COLORS.towerHex };

// The keeper's names for things. The meters are not abstractions (DESIGN.md
// §11), so they are labelled as the things they are.
export const METER_LABELS = { lamp: 'LAMP', hearth: 'HEARTH', tower: 'TOWER' };
export const RESOURCE_LABELS = { oil: 'OIL', wood: 'DRIFTWOOD', plank: 'PLANK' };
export const RESOURCE_SHORT = { oil: 'OIL', wood: 'WOOD', plank: 'PLANK' };

export const FONT = 'sans-serif';

// --- Preferences ------------------------------------------------------------
//
// Read once at import and written through on change. localStorage throws in
// some embedded and private contexts, and a preference is never worth taking
// the game down for — hence the try/catch around every access.

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : raw === '1';
  } catch (e) {
    return fallback;
  }
}

function write(key, on) {
  try {
    localStorage.setItem(key, on ? '1' : '0');
  } catch (e) {
    /* the preference just won't persist */
  }
}

let audioOn = read('pitchou.audio', true);
let motionOn = read('pitchou.motion', true);
let hardOn = read('pitchou.hard', false);

export function getAudio() {
  return audioOn;
}
export function setAudio(on) {
  audioOn = !!on;
  write('pitchou.audio', audioOn);
}

// Reduced motion collapses every tween to an instant set. It never changes what
// is shown — a player who turns it on still sees every token, meter and knock,
// just without the travel.
export function getMotion() {
  return motionOn;
}
export function setMotion(on) {
  motionOn = !!on;
  write('pitchou.motion', motionOn);
}

// Hard mode is the all-or-nothing bust DESIGN.md §9 keeps in reserve. It is one
// tuning field, so it lives as an override rather than a second rules path.
export function getHardMode() {
  return hardOn;
}
export function setHardMode(on) {
  hardOn = !!on;
  write('pitchou.hard', hardOn);
}
