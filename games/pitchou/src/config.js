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
//
// The bands are tighter than they look because the type is deliberately large:
// a playtest read the old 12-13px labels as unreadable on a phone, so nothing
// in the game is smaller than FONT_SM now and the layout was rebuilt around
// that rather than the other way round.

export const HEADER_Y = 34;
export const TRACK_Y = 72; // the twelve-night pip track
export const TRACK_PIP_R = 6;
export const TRACK_GAP = 27;

export const METER_TOP = 98;
export const METER_H = 168;
export const METER_W = 62;
export const METER_XS = { lamp: 92, hearth: 240, tower: 388 };

// The strike pips and the sentence that reads them share one line: how close
// the night is to ending is one thought, not two.
export const RISK_Y = 362;
export const RISK_PIP_X = 42;
export const RISK_PIP_GAP = 38;
export const RISK_PIP_R = 13;

// The shore grid sits in a fixed band and sizes itself to whatever the shore
// holds — see ShoreView. A season can push the shore from 15 tokens to 28 (12
// resources and three falls to start, three more falls added, and up to ten
// tools that each put a token out there), and all of it has to stay on one
// screen: the contents are inspectable at all times (DESIGN.md §5), which is
// only true if they all fit. Rather than fix a column count and let the tiles
// shrink to postage stamps, the grid picks the fewest columns that still fit
// the band, so a typical night is drawn with the biggest tiles it can have.
export const SHORE_TOP = 388;
export const SHORE_BAND_H = 212;
export const SHORE_WIDTH = 460;
export const SHORE_MAX_CELL = 66;
export const SHORE_MIN_CELL = 48;
export const SHORE_COL_CHOICES = [5, 6, 7, 8];

export const BASKET_Y = 654;
export const BASKET_XS = { oil: 92, wood: 240, plank: 388 };

export const SEARCH_Y = 744;
export const HOME_Y = 808;

// Depth bands. Transient effects sit above the board, the dawn panel above
// everything — same banding idea as Bibou's PuzzleScene.
export const EFFECT_DEPTH = 40;
export const PANEL_DEPTH = 60;
export const PANEL_CONTENT_DEPTH = 61;

// --- Tween durations --------------------------------------------------------

export const FLIP_MS = 180; // a token turning face-up
export const DRAIN_MS = 420; // a meter bar falling at dusk
export const KNOCK_MS = 260; // a unit a fall spills out of the basket
export const SHAKE_MS = 220; // the screen when the keeper goes down
export const VIGNETTE_MS = 500; // the flash on the fall that ends the night

// --- Palette ----------------------------------------------------------------
//
// A dark storm, and the lamp is the only warm colour on screen (DESIGN.md §10).
// That rule is why Hearth and Tower are cool tones rather than fire colours:
// three warm meters would make the lamp just another bar, and the lamp going
// out is the whole stake. A fall is cold foam-blue; the one red on the screen is
// the flash when a fall ends the night, and it only exists for half a second.
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
  // Every one of these clears WCAG AAA (7:1) against `bg`. `dim` is the floor
  // and it is a real reading colour now, not a whisper: a playtest read the
  // secondary text on a phone as grey mush, and the fix was both larger type
  // and a shorter distance between `text` and `dim`.
  muted: '#d5e0ea',
  mutedHex: 0xd5e0ea,
  dim: '#a6b8c8',
  dimHex: 0xa6b8c8,

  lamp: '#ffb547',
  lampHex: 0xffb547,
  hearth: '#5f9ea8',
  hearthHex: 0x5f9ea8,
  tower: '#7d8ba0',
  towerHex: 0x7d8ba0,

  // The colour of a fall — cold water, the one thing on the shore that isn't a
  // find. Named for the hazard rather than for the sea it used to be.
  fall: '#9fd8ff',
  fallHex: 0x9fd8ff,
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
  disabledText: '#94a8ba',
};

// --- Type scale -------------------------------------------------------------
//
// One ladder, used everywhere, so "make it bigger" is a change in one place
// instead of forty inline pixel values. FONT_SM is the floor: nothing in the
// game is allowed to be smaller than this, which is what the tighter vertical
// bands above are paying for.
export const FONT_XL = 34; // a meter numeral, the title
export const FONT_LG = 26; // a panel heading, the night
export const FONT_MD = 22; // feedback, buttons
export const FONT_RG = 19; // list rows, tool names
export const FONT_SM = 16; // labels and captions — the floor

export const METER_COLORS = { lamp: COLORS.lampHex, hearth: COLORS.hearthHex, tower: COLORS.towerHex };
export const RESOURCE_COLORS = { oil: COLORS.lampHex, wood: COLORS.hearthHex, plank: COLORS.towerHex };

// The keeper's names for things. The meters are not abstractions (DESIGN.md
// §11), so they are labelled as the things they are.
//
// One name per thing, everywhere. Driftwood used to be DRIFTWOOD in the recap
// and WOOD in the basket, and the hazard answered to squall, wave and storm on
// three different lines of the same screen — a playtest found that reading as
// three separate rules rather than one.
export const METER_LABELS = { lamp: 'LAMP', hearth: 'HEARTH', tower: 'TOWER' };
export const RESOURCE_LABELS = { oil: 'OIL', wood: 'WOOD', plank: 'PLANK' };
export const FALL_LABEL = 'FALL';

export const FONT = 'Georgia, "Times New Roman", serif';

// Phaser renders Text to its own internal canvas at 1x by default, then that
// texture gets drawn onto the game canvas and stretched by Scale.FIT to fill
// whatever viewport it's given — rarely an integer multiple, especially on a
// high-DPI phone. Combined with `pixelArt: true` (nearest-neighbour filtering,
// no antialiasing — correct for the chunky sprite masks), that stretch makes
// anti-aliased glyph edges look blocky. Rendering text at a higher internal
// resolution gives that stretch enough source detail to sample cleanly, same
// fix sprites don't need because their blockiness is the intended look.
const dpr = typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1;
export const TEXT_RESOLUTION = Math.min(4, Math.max(2, dpr));

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
