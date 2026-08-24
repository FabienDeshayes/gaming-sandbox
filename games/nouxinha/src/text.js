// Every word the game says to the player, in one place.
//
// The rest of the source imports from here and never spells a player-facing
// string itself, so the whole voice of the game can be read — and rewritten —
// without opening a scene. Sprite keys, texture names, scene names, storage
// keys and item ids are *not* text: they are identifiers the player never sees,
// and they stay where they are.
//
// Anything that varies is a function of what it varies on, so the copy and the
// number it quotes can never drift apart. The few numbers that appear inside a
// sentence come from `balance.js` for the same reason (DESIGN.md §4.2) — this
// file imports nothing else.
//
// Convention: SHOUTED CAPS are the game's chrome — buttons, labels, counters,
// headings, the status line. Sentence case is the game talking to you, which it
// only does in a dialog's body. Keep a string on the side of the line it is
// already on.

import { WATER_VALUE } from './balance.js';

// Words reused across more than one screen, so a rename lands everywhere at
// once.
export const UI = {
  back: 'BACK',
  close: 'CLOSE',
  home: 'HOME',
  settings: 'SETTINGS',
  newGame: 'NEW GAME',
  loadGame: 'LOAD GAME',
};

// The one line both the title screen and the slot picker use to say what a
// campaign has to show for itself.
export const progressLine = (gems, maxGems, coins, runs) =>
  `${gems}/${maxGems} COLOURS  ${coins} COINS  ${runs} RUNS`;

// --- Title screen ------------------------------------------------------------

export const TITLE = {
  name: 'NOUXINHA',
  tagline: 'THE DARK IS THE ONLY MAP',
  cheatsWarning: 'CHEATS ON — NOTHING WILL BE SAVED',
  newGame: UI.newGame,
  loadGame: UI.loadGame,
  settings: UI.settings,
};

// --- Slot picker -------------------------------------------------------------

export const SLOTS = {
  headingNew: UI.newGame,
  headingLoad: UI.loadGame,
  hintNew: 'PICK A SLOT TO WALK OUT FROM',
  hintLoad: 'PICK A CAMPAIGN TO CARRY ON',
  slotName: (n) => `SLOT ${n}`,
  empty: 'EMPTY',
  // The second tap on an occupied slot is the one that destroys a campaign, so
  // the row says what the next tap does rather than asking in a dialog.
  confirmOverwrite: 'TAP AGAIN TO OVERWRITE',
  neverWalked: 'NOTHING WALKED YET',
  suspended: (furthest, steps) => `SAVED EXPEDITION  ${furthest} OUT  ${steps} STEPS`,
  furthest: (n) => `FURTHEST OUT ${n}`,
  back: UI.back,
};

// --- Settings ----------------------------------------------------------------

export const SETTINGS = {
  heading: UI.settings,
  // Badge on the palette currently in use.
  paletteActive: 'ON',
  music: (on) => `MUSIC: ${on ? 'ON' : 'OFF'}`,
  moveSpeed: (stepsPerSecond) => `MOVE SPEED: ${stepsPerSecond}/s`,
  cheats: (on) => `CHEATS: ${on ? 'ON' : 'OFF'}`,
  cheatNote: (on) =>
    on
      ? 'WHOLE MAP REVEALED, ONE OF EVERYTHING. NOTHING SAVES.'
      : 'REVEALS THE MAP AND HANDS YOU EVERY ITEM.',
  back: UI.back,
};

// The palettes' display names (config.js holds the colours themselves).
export const PALETTE_NAMES = {
  phosphor: 'PHOSPHOR',
  amber: 'AMBER',
  cathode: 'CATHODE',
  magenta: 'MAGENTA',
};

// --- HUD ---------------------------------------------------------------------

export const HUD = {
  explored: (tiles) => `EXPLORED ${tiles}`,
  coins: (coins) => `COINS ${coins}`,
  water: (water, ceiling) => `WATER ${water}/${ceiling}`,
  light: (name, durability, max) => `${name}  ${durability}/${max}`,
  noLight: 'NO LIGHT',
  blackout: 'BLACKOUT. ONLY WHAT IS RIGHT AROUND YOU IS VISIBLE.',
  // Badge on a slot holding more than one copy of the same light.
  stackCount: (n) => `x${n}`,
  // The slot that opens the full inventory.
  items: 'ITEMS',
};

// The status line under the HUD: what the step just taken is worth saying about
// (ExploreScene `announce`). Every one of these is a shout, and every one of
// them is transient — the line is blank the rest of the time.
export const FLASH = {
  gemFound: (name) => `${name} IS BACK. CARRY IT HOME TO KEEP IT.`,
  toolFound: (name) => `FOUND THE ${name}. CARRY IT HOME TO KEEP IT.`,
  burnedOutBlackout: (name) => `${name} BURNED OUT. NO LIGHT LEFT.`,
  burnedOutSwapped: (name) => `${name} BURNED OUT. SWITCHED TO NEXT LIGHT.`,
  coins: (n) => `FOUND ${n} COIN${n === 1 ? '' : 'S'}.`,
  picked: (name) => `FOUND ${name}.`,
  respawned: 'THE DARK HAS PUT EVERYTHING BACK SOMEWHERE NEW.',
  // A shut gate bumps like rock, so it says what it wants rather than reading
  // as a wall with a pattern on it.
  gateLocked: (needs, held) => `THE GATE WANTS ${needs} COLOUR${needs === 1 ? '' : 'S'}. YOU HAVE ${held}.`,
  // The edge, every time after the first — the first bump earns the EDGE dialog.
  edge: 'THE DARK IS SOLID HERE.',
  bought: (name, coinsLeft) => `BOUGHT ${name}. ${coinsLeft} COINS LEFT.`,
  headBackOut: 'SAVED AT THE HUT. WATER FULL.',
};

// --- What a run is carrying --------------------------------------------------
//
// Named in the hut's dialog, the menu's way out, and the death screen, in a
// sentence rather than a list: "The colour, the compass and 30 coins". These
// are the fragments that sentence is built from.

export const CARRIED = {
  // "a, b and c" — the sentence these build is a sentence, not a list.
  list: (words) =>
    words.length < 2 ? words[0] || '' : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`,
  oneGem: 'the colour',
  manyGems: (n) => `all ${n} colours`,
  tool: (name) => `the ${name.toLowerCase()}`,
  coins: (n) => `${n} coins`,
};

// --- Dialogs -----------------------------------------------------------------

// Walking into the edge of the world (DESIGN.md §4). The only thing in the game
// that explains itself, because the edge is invisible by design.
export const EDGE = {
  title: 'THE DARK IS SOLID',
  lines: [
    'Out here the dark stops giving way. It has been eating your light for a while now — a tile of reach for every ten you walked — and this is where it has eaten all of it.',
    'Nothing goes further. Turn around.',
  ],
  back: UI.back,
};

// The cogwheel menu.
export const MENU = {
  title: 'MENU',
  line: 'Saving keeps this expedition exactly as it stands. Leaving without it does not.',
  settings: UI.settings,
  save: 'SAVE GAME',
  exit: 'EXIT GAME',
  keepPlaying: 'KEEP PLAYING',
};

// SAVE GAME: the expedition goes into the slot as it stands, unbanked.
export const SAVED = {
  title: 'EXPEDITION SAVED',
  titleCheats: 'NOTHING SAVED',
  lineCheats: 'Cheats are on, so this run was never a campaign and nothing was written.',
  lines: (slot) => [
    `Slot ${slot} is holding this walk exactly where you are standing.`,
    'LOAD GAME picks it up from here.',
  ],
  rowFurthest: 'FURTHEST OUT',
  rowSteps: 'STEPS TAKEN',
  rowCoins: 'COINS CARRIED',
  keepPlaying: MENU.keepPlaying,
  exit: MENU.exit,
};

// EXIT GAME: banks nothing, saves nothing, and says what that costs.
export const LEAVING = {
  title: 'LEAVE THE DARK',
  fallsBackToSave: 'Leaving does not save. This slot goes back to the walk you last saved.',
  savesNothing: 'Leaving now saves nothing of this expedition.',
  atRisk: (what, many) =>
    `${what} you are carrying ${many ? 'go' : 'goes'} back where you found ${many ? 'them' : 'it'}.`,
  groundKept: 'The ground you lit stays on your map.',
  keepPlaying: MENU.keepPlaying,
  leave: 'LEAVE',
};

// Stepping onto the hut, which is what banks a run (DESIGN.md §6.1). Said
// plainly, because neither answer costs anything and the game spent the whole
// walk teaching the opposite.
export const HUT = {
  title: 'BACK AT THE HUT',
  written: (what) => `${what} written down. Water topped up.`,
  nothingNew: 'Nothing new to write down. Water topped up.',
  cheats: 'CHEATS ON — nothing is written down. Water topped up.',
  bothWays: [
    'Both ways keep it. HEAD BACK OUT carries the expedition on;',
    'END HERE closes it and totals it up.',
  ],
  bothWaysCheats: ['HEAD BACK OUT carries the expedition on; END HERE closes it.'],
  headBackOut: 'HEAD BACK OUT',
  endHere: 'END HERE',
};

// END HERE: the run is over and counted up.
export const RECAP = {
  title: 'EXPEDITION OVER',
  rowExplored: 'TILES EXPLORED',
  rowNewGround: 'NEW GROUND',
  rowCoins: 'COINS FOUND',
  rowLights: 'LIGHTS FOUND',
  rowColours: 'COLOURS SAVED',
  rowFurthest: 'FURTHEST OUT',
  rowSteps: 'STEPS TAKEN',
  colours: (saved, max) => `${saved}/${max}`,
  // What is still in hand at the end of it: a light and its remaining
  // durability, or a tool by name.
  carriedLight: (name, durability) => `${name} ${durability}`,
  carrying: (what) => `CARRYING ${what}`,
  carryingNothing: 'CARRYING NOTHING',
  cheats: 'CHEATS ON — NOTHING WAS WRITTEN TO THE SLOT',
  home: UI.home,
};

// Running dry: the run's one hard failure state (DESIGN.md §6).
export const DEATH = {
  title: 'OUT OF WATER',
  collapsed: (what, many) =>
    `You collapsed in the dark. ${what} you were carrying ${many ? 'are' : 'is'} back where you found ${
      many ? 'them' : 'it'
    }.`,
  collapsedEmptyHanded: 'You collapsed in the dark. Everything you carried is lost.',
  groundKept: LEAVING.groundKept,
  rowExplored: RECAP.rowExplored,
  rowNewGround: RECAP.rowNewGround,
  rowFurthest: RECAP.rowFurthest,
  rowSteps: RECAP.rowSteps,
  home: UI.home,
};

// --- Panels ------------------------------------------------------------------

export const INVENTORY = {
  title: 'INVENTORY',
  empty: 'NOTHING CARRIED.',
  carrying: (n) => `CARRYING ${n}`,
  equippedSuffix: (carrying) => `${carrying} · EQUIPPED`,
  close: UI.close,
};

// The card one item opens onto.
export const CARD = {
  durability: (durability, max) => `DURABILITY  ${durability} / ${max}`,
  // One row per copy, when a stack holds several.
  instance: (durability, max, active) => `${durability} / ${max}${active ? '  EQUIPPED' : ''}`,
  equip: 'EQUIP',
  equipped: 'EQUIPPED',
  close: UI.close,
};

export const SHOP = {
  title: 'THE MERCHANT',
  purse: (coins) => `YOU HAVE ${coins} COINS`,
  owned: 'OWNED',
  price: (coins) => `${coins}`,
  leave: 'LEAVE',
};

export const WORLD_MAP = {
  title: 'THE MAP',
  empty: 'NOTHING WALKED YET.',
  walked: (tiles) => `${tiles} TILES WALKED`,
  zoomOut: '-',
  zoomIn: '+',
  fit: 'FIT',
  close: UI.close,
  // The button on the rail that opens it.
  button: 'MAP',
};

// The compass badge, standing on the thing it points at.
export const COMPASS = {
  here: 'HERE',
};

// --- Items -------------------------------------------------------------------
//
// What each item is called and what its card says it does. `src/data/items.js`
// holds everything else about them — their sprite, their hue, and the balance
// numbers spread in from `balance.js`.

export const ITEM_TEXT = {
  'torch-small': {
    name: 'SMALL TORCH',
    effect: 'Lights the 8 tiles around you.',
  },
  'torch-medium': {
    name: 'MEDIUM TORCH',
    effect: 'Lights 2 tiles in every direction. Twice the reach, half the leash.',
  },
  'torch-lamp': {
    name: 'LAMP TORCH',
    effect: 'Lights a widening cone 4 tiles ahead. Sees nothing behind you.',
  },
  'torch-beacon': {
    name: 'BEACON',
    effect: 'Lights 3 tiles in every direction, and burns longer than anything.',
  },
  coin: {
    name: 'COINS',
    effect:
      'What the merchant takes. The counter shows everything you have banked plus what you are carrying.',
  },
  // The refill numbers are quoted from balance.js, so a retuned drop is never a
  // drop whose card lies about it.
  'water-drop': {
    name: 'WATER DROP',
    effect: `Refills ${WATER_VALUE['water-drop']} water. Run dry and the run is over.`,
  },
  'water-flask': {
    name: 'WATER FLASK',
    effect: `Refills ${WATER_VALUE['water-flask']} water. Two drops in one, and it carries you further out.`,
  },
  'spring-vial': {
    name: 'SPRING VIAL',
    effect: 'Fills your water right back up, however far from home you are.',
  },
  'gem-1': {
    name: 'FIRST COLOUR',
    effect: 'The first colour, back in the world. Opens the gate that wants one gem.',
  },
  'gem-2': {
    name: 'SECOND COLOUR',
    effect: 'The second colour, back in the world. Opens the gate that wants two gems.',
  },
  'gem-3': {
    name: 'THIRD COLOUR',
    effect: 'The last colour. Opens the gate at the far edge of everything.',
  },
  compass: {
    name: 'COMPASS',
    effect: 'Points at whatever is worth walking to next, or at the hut.',
  },
  map: {
    name: 'MAP',
    effect: 'Draws everywhere you have walked, and remembers it between runs.',
  },
};
