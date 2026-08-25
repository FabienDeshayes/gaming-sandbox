// Layout, type, palette and the settings a player can change: everything about
// how the game *looks* and how the shell around it behaves.
//
// The numbers the game is balanced on are not here — item frequency, distances,
// durability, water and prices all live in `src/balance.js`.
//
// Exactly two colours are on screen at once (DESIGN.md §9): a background and a
// foreground. Every sprite is a white 1-bit mask that gets tinted with the
// foreground colour, so swapping palettes is a tint change, not an asset swap.
//
// The words on screen are not here either — every player-facing string in the
// game lives in `src/text.js`.

import { PALETTE_NAMES } from './text.js';

export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 854;

// The map viewport occupies everything above the HUD.
export const VIEW_H = 624;
export const HUD_Y = VIEW_H;

export const TILE = 48;
export const SPRITE_PX = 16;
export const SPRITE_SCALE = TILE / SPRITE_PX; // 3

// The character sits dead centre of the viewport and the world scrolls around
// them (DESIGN.md §4). 480 and 624 are whole multiples of TILE, so centring on
// a tile *centre* puts the grid on a half-tile offset — the outer ring of tiles
// is half-cut by the screen edge, which is the intended "world keeps going" read.
export const VIEW_CX = GAME_WIDTH / 2;
export const VIEW_CY = VIEW_H / 2;

// Tiles drawn each frame, centred on the character. One wider than strictly
// visible so the half-cut ring is fully covered.
export const VIEW_COLS = 11;
export const VIEW_ROWS = 15;

// Visibility states (DESIGN.md §4). Unknown tiles are simply not drawn.
export const LIT_ALPHA = 1;
export const REMEMBERED_ALPHA = 0.3;

// Ground texture is drawn at this fraction of the foreground's strength, so an
// explored floor tile reads as a surface without competing with the wizard, the
// items and the frontier standing on it (DESIGN.md §9). Still one colour: the
// tile is baked with a dimmed grey that the same tint multiplies through.
export const FLOOR_TEXTURE_LEVEL = 0.5;

// The names Settings shows are copy, so they come from `src/text.js`; what is
// here is the two colours each palette actually is.
export const PALETTES = [
  { id: 'phosphor', name: PALETTE_NAMES.phosphor, bg: 0x0b1a0b, fg: 0x33ff66 },
  { id: 'amber', name: PALETTE_NAMES.amber, bg: 0x1a0f00, fg: 0xffb000 },
  { id: 'cathode', name: PALETTE_NAMES.cathode, bg: 0x06121a, fg: 0x4fd0ff },
  { id: 'magenta', name: PALETTE_NAMES.magenta, bg: 0x14061a, fg: 0xff5fd2 },
];

const STORAGE_KEY = 'nouxinha.palette';

let activeId = PALETTES[0].id;
// Whether the player has ever picked a palette themselves. Until they have,
// the world chooses: each biome is drawn in a colour of its own (`biomes.js`),
// so a frozen world reads cold and a desert warm without anyone touching
// Settings. The moment one is picked in Settings it is theirs, in every world,
// and nothing overrides it again.
let chosen = false;

// localStorage throws in some embedded/private contexts; a palette preference
// is never worth taking the game down for.
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && PALETTES.some((p) => p.id === saved)) {
    activeId = saved;
    chosen = true;
  }
} catch (e) {
  /* keep the default */
}

export function getPalette() {
  return PALETTES.find((p) => p.id === activeId) || PALETTES[0];
}

// The player's own choice: persisted, and from here on it outranks whatever
// world they walk into.
export function setPalette(id) {
  if (!PALETTES.some((p) => p.id === id)) return;
  activeId = id;
  chosen = true;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch (e) {
    /* preference just won't persist */
  }
}

// The colour a world is drawn in for a player who has not asked for another
// one. Not persisted: it is re-read off whichever world is being walked
// (`ExploreScene`), so it can never outlive the run it came from.
export function setDefaultPalette(id) {
  if (!chosen && PALETTES.some((p) => p.id === id)) activeId = id;
  return getPalette();
}

// --- Music -------------------------------------------------------------------
//
// The one thing in the game a player might want turned off, so it gets a switch
// of its own next to the palettes and is persisted the same way. On by default:
// the browser's autoplay policy means it can't make a sound until the player
// has touched something anyway (ui/music.js).
const MUSIC_KEY = 'nouxinha.music';

let musicOn = true;

try {
  musicOn = localStorage.getItem(MUSIC_KEY) !== '0';
} catch (e) {
  /* on by default */
}

export function getMusic() {
  return musicOn;
}

export function setMusic(on) {
  musicOn = !!on;
  try {
    localStorage.setItem(MUSIC_KEY, musicOn ? '1' : '0');
  } catch (e) {
    /* preference just won't persist */
  }
  return musicOn;
}

// --- Cheats ------------------------------------------------------------------
//
// A developer switch, in Settings next to the palettes and persisted the same
// way: a run started with it on gets the whole map revealed and one of
// everything, so the late game can be looked at without walking to it
// (DESIGN.md §6.2). It is a preference rather than run state, which is why it
// lives here — `core/rules.js` is handed the flag, it never reads it.
const CHEATS_KEY = 'nouxinha.cheats';

let cheatsOn = false;

try {
  cheatsOn = localStorage.getItem(CHEATS_KEY) === '1';
} catch (e) {
  /* off by default */
}

export function getCheats() {
  return cheatsOn;
}

export function setCheats(on) {
  cheatsOn = !!on;
  try {
    localStorage.setItem(CHEATS_KEY, cheatsOn ? '1' : '0');
  } catch (e) {
    /* preference just won't persist */
  }
  return cheatsOn;
}

// --- Move speed ----------------------------------------------------------
//
// Holding a D-pad arrow repeats the step instead of taking just the one
// (DESIGN.md §7), at a rate the player tunes in Settings rather than one
// fixed for everyone — a slider from a deliberate step to a fast walk.
export const MIN_MOVE_SPEED = 2;
export const MAX_MOVE_SPEED = 10;
const DEFAULT_MOVE_SPEED = 5;
const MOVE_SPEED_KEY = 'nouxinha.moveSpeed';

let moveSpeed = DEFAULT_MOVE_SPEED;

try {
  const saved = parseInt(localStorage.getItem(MOVE_SPEED_KEY), 10);
  if (saved >= MIN_MOVE_SPEED && saved <= MAX_MOVE_SPEED) moveSpeed = saved;
} catch (e) {
  /* keep the default */
}

export function getMoveSpeed() {
  return moveSpeed;
}

export function setMoveSpeed(stepsPerSecond) {
  moveSpeed = Math.max(MIN_MOVE_SPEED, Math.min(MAX_MOVE_SPEED, Math.round(stepsPerSecond)));
  try {
    localStorage.setItem(MOVE_SPEED_KEY, String(moveSpeed));
  } catch (e) {
    /* preference just won't persist */
  }
  return moveSpeed;
}

// The colour a gem gave back (DESIGN.md §9). Each of the three takes the
// foreground of a palette you are *not* playing in, so restoring a colour
// always adds one the world genuinely did not have — and the four CRT
// foregrounds are already known to read against every one of the backgrounds.
//
// `hue` 0 means "no gem": the palette's own foreground, which is what the whole
// world is drawn in before the first gem and what most of it stays after.
// Switching palettes mid-game reshuffles which colour belongs to which gem;
// that's deterministic and it's the same three, so nothing is lost by it.
export function gemColour(hue) {
  const active = getPalette();
  if (!hue) return active.fg;
  const other = PALETTES.filter((p) => p.id !== active.id)[hue - 1];
  return other ? other.fg : active.fg;
}

// Phaser wants '#rrggbb' for text colours, the palette stores numbers.
export function hex(colour) {
  return '#' + colour.toString(16).padStart(6, '0');
}

export const FONT = 'monospace';
