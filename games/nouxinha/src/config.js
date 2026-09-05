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

// The two colours each palette is. There is no picking one in Settings any
// more — a world's colour comes from its biome (`biomes.js`), full stop.
export const PALETTES = [
  { id: 'phosphor', bg: 0x0b1a0b, fg: 0x33ff66 },
  { id: 'amber', bg: 0x1a0f00, fg: 0xffb000 },
  { id: 'cathode', bg: 0x06121a, fg: 0x4fd0ff },
  { id: 'magenta', bg: 0x14061a, fg: 0xff5fd2 },
];

let activeId = PALETTES[0].id;

export function getPalette() {
  const pal = PALETTES.find((p) => p.id === activeId) || PALETTES[0];
  // Inverted, the palette is still two colours and still the pair this world was
  // given — they have simply swapped sides of the light (`invertColour` below).
  return getInvert() ? { ...pal, bg: invertColour(pal.bg), fg: invertColour(pal.fg) } : pal;
}

// The colour a run's world is drawn in, set from its biome the moment a run
// opens (`ExploreScene`). Not persisted: it is re-read off whichever world is
// being walked, so it can never outlive the run it came from, and the menus
// stay in whatever world was last walked until the next one sets it again.
export function setDefaultPalette(id) {
  if (PALETTES.some((p) => p.id === id)) activeId = id;
  return getPalette();
}

// --- Inverting the colours ---------------------------------------------------
//
// What the sun coming back leaves behind (DESIGN.md §4.9). A campaign that has
// finished all four worlds ends on a light explosion that turns every colour on
// screen into its opposite, and the switch that does it stays in Settings
// afterwards — next to the cheats and shown only while they are on, because it
// is a way of looking at the game rather than a way of playing it.
//
// One line of arithmetic reaches the whole screen, because every colour in the
// game comes out of the three accessors below: the palette, a gem's colour and a
// landmark's. Nothing that draws anything has to know this exists.
const INVERT_KEY = 'nouxinha.invert';
const INVERT_UNLOCKED_KEY = 'nouxinha.invert.unlocked';

let invertOn = false;
let invertKnown = false;

try {
  invertOn = localStorage.getItem(INVERT_KEY) === '1';
  invertKnown = localStorage.getItem(INVERT_UNLOCKED_KEY) === '1';
} catch (e) {
  /* off, and not a switch anybody has yet */
}

// The ending's own inversion, which is deliberately *not* the player's setting:
// it is turned on for the explosion and the credits and dropped on the way back
// to the title screen. A page closed halfway through the credits therefore never
// comes back to a game drawn inside out with the switch to undo it hidden behind
// a cheat toggle. `null` means nothing is overriding the setting.
let invertOverride = null;

export function getInvert() {
  return invertOverride === null ? invertOn : invertOverride;
}

// The Settings switch, persisted like the other two.
export function setInvert(on) {
  invertOn = !!on;
  try {
    localStorage.setItem(INVERT_KEY, invertOn ? '1' : '0');
  } catch (e) {
    /* preference just won't persist */
  }
  return invertOn;
}

// The ending's, which persists nothing. `null` hands the screen back to the
// setting.
export function overrideInvert(on) {
  invertOverride = on === null ? null : !!on;
  return getInvert();
}

// Whether the campaign has ever seen the light come back. Kept next to the
// cheats rather than in a save slot: it is something the player has seen, not
// something a campaign is holding, so it survives a slot being overwritten the
// way the music switch does.
export function invertUnlocked() {
  return invertKnown;
}

export function unlockInvert() {
  invertKnown = true;
  try {
    localStorage.setItem(INVERT_UNLOCKED_KEY, '1');
  } catch (e) {
    /* it will have to be earned again next time */
  }
  return invertKnown;
}

// White less the colour, channel by channel, which is the whole of what
// inverting is: the dark background goes bright, the foreground goes dark, and a
// world that has spent the entire game being a hole in the light is suddenly the
// light with things standing in it.
export function invertColour(colour) {
  return 0xffffff ^ (colour & 0xffffff);
}

const shown = (colour) => (getInvert() ? invertColour(colour) : colour);

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
// Walking into a different biome reshuffles which colour belongs to which
// gem; that's deterministic and it's the same three, so nothing is lost by it.
export function gemColour(hue) {
  const active = getPalette();
  if (!hue) return active.fg;
  const other = PALETTES.filter((p) => p.id !== active.id)[hue - 1];
  return other ? shown(other.fg) : active.fg;
}

// A palette's foreground by name, for the one thing in the game whose colour is
// absolute rather than relative to the world it is standing in: a landmark
// (src/data/landmarks.js). Everything else asks `gemColour`, which deliberately
// hands back a colour the world it is in does *not* draw itself in; a landmark
// is the same object in every world, so it keeps the same colour in all four.
export function paletteColour(id) {
  const found = PALETTES.find((p) => p.id === id);
  return found ? shown(found.fg) : getPalette().fg;
}

// Phaser wants '#rrggbb' for text colours, the palette stores numbers.
export function hex(colour) {
  return '#' + colour.toString(16).padStart(6, '0');
}

export const FONT = 'monospace';
