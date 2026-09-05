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
// only does in a dialog's body and in the text panel. Keep a string on the side
// of the line it is already on.

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
  tagline: 'Bring back colour to the world',
  cheatsWarning: 'CHEATS ON — NOTHING WILL BE SAVED',
  newGame: UI.newGame,
  loadGame: UI.loadGame,
  settings: UI.settings,
};

// --- Slot picker -------------------------------------------------------------

export const SLOTS = {
  headingNew: UI.newGame,
  headingLoad: UI.loadGame,
  hintNew: 'PICK A SAVE SLOT',
  hintLoad: 'PICK A SAVE TO CARRY ON',
  slotName: (n) => `SLOT ${n}`,
  empty: 'EMPTY',
  // The second tap on an occupied slot is the one that destroys a campaign, so
  // the row says what the next tap does rather than asking in a dialog.
  confirmOverwrite: 'TAP AGAIN TO OVERWRITE',
  neverWalked: 'NO EXPEDITION YET',
  suspended: (furthest, steps) => `SAVED EXPEDITION  ${furthest} OUT  ${steps} STEPS`,
  // The worlds this campaign has already lost in the hall — the one thing on a
  // row that is about the campaign rather than about the world it is in now.
  cycles: (n) => `${n} WORLD${n === 1 ? '' : 'S'} ENDED`,
  furthest: (n) => `FURTHEST OUT ${n}`,
  back: UI.back,
};

// --- Settings ----------------------------------------------------------------

export const SETTINGS = {
  heading: UI.settings,
  music: (on) => `MUSIC: ${on ? 'ON' : 'OFF'}`,
  moveSpeed: (stepsPerSecond) => `MOVE SPEED: ${stepsPerSecond}/s`,
  cheats: (on) => `CHEATS: ${on ? 'ON' : 'OFF'}`,
  cheatNote: (on) =>
    on
      ? 'WHOLE MAP REVEALED, ONE OF EVERYTHING. NOTHING SAVES.'
      : 'REVEALS THE MAP AND HANDS YOU EVERY ITEM.',
  // The switch the ending leaves behind (DESIGN.md §4.9). Only on this screen
  // for a player who has seen the light come back, and only while the cheats are
  // on: it is a way of looking at the game rather than a way of playing it.
  invert: (on) => `INVERT COLOURS: ${on ? 'ON' : 'OFF'}`,
  invertNote: 'THE WORLD DRAWN INSIDE OUT, THE WAY IT ENDED.',
  back: UI.back,
};

// The biomes' display names (data/biomes.js holds what a biome actually is).
export const BIOME_NAMES = {
  temperate: 'TEMPERATE',
  frozen: 'FROZEN',
  desert: 'DESERT',
  mystic: 'MYSTICAL REALM',
};

// --- HUD ---------------------------------------------------------------------

export const HUD = {
  explored: (tiles) => `EXPLORED ${tiles}`,
  coins: (coins) => `COINS ${coins}`,
  water: (water, ceiling) => `WATER ${water}/${ceiling}`,
  // How many worlds the hall has taken off this campaign (DESIGN.md §4.9).
  // Only on screen once there is one to count.
  cycles: (n) => `WORLDS ${n}`,
  // How far from the hut you are standing *now* — the Gnomon's standing, and so
  // only on screen for a campaign that has put a hand on it (DESIGN.md §4.10).
  distance: (n) => `OUT ${n}`,
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
  // as a wall with a pattern on it. It names the key by colour, because the key
  // and the gate are drawn in the same one.
  gateLocked: (keyName) => `LOCKED. IT WANTS THE ${keyName}.`,
  gateOpened: (keyName) => `THE ${keyName} TURNS. THE GATE IS OPEN.`,
  keyFound: (name) => `FOUND THE ${name}. CARRY IT HOME TO KEEP IT.`,
  chestCoins: (n) => `THE CHEST HELD ${n} COINS.`,
  chestEmpty: 'THE CHEST IS ALREADY OPEN.',
  // A landmark, walked into. The panel says what it is; the status line says
  // what it just did for you, which is the half worth having in a shout.
  landmarkAgain: (name) => `${name}. NOTHING MORE TO TAKE FROM IT THIS WORLD.`,
  landmarkCoins: (n) => `THE PRESS STRIKES YOU ${n} BLANKS.`,
  landmarkWater: 'THE WELL UNDER IT IS DEEP. YOUR WATER IS FULL.',
  landmarkRelit: (name) => `${name} BURNS LIKE NEW.`,
  landmarkReveal: 'THE DIAL SHOWS YOU THE GROUND YOU CAME OVER.',
  // A signpost, read again. The first read gets the panel; the hut's hint is
  // flavour rather than a fact worth repeating, so it isn't in this one.
  signpost: (lines) => lines.join(' / '),
  // The edge, every time after the first — the first bump earns the EDGE dialog.
  edge: 'THE DARK IS BLOCKING YOU.',
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
  key: (name) => `the ${name.toLowerCase()}`,
  // A landmark is not a thing in your hands, so it never joins the sentence
  // above — a place you have been gets one of its own (DESIGN.md §4.10).
  landmarkStored: (what) => `You have stood at ${what}. That is written down too.`,
  landmarkLost: (what) =>
    `You will have to walk back to ${what}: standing somewhere counts for nothing until you get home.`,
  coins: (n) => `${n} coins`,
};

// --- Dialogs -----------------------------------------------------------------

// Walking into the edge of the world (DESIGN.md §4). The only thing in the game
// that explains itself, because the edge is invisible by design.
export const EDGE = {
  title: 'THE DARK IS TOO STRONG',
  lines: [
    'Out here the dark stops giving way. It has been eating your light for a while now and this is where it has eaten all of it.',
    'Nothing goes further. Turn around.',
  ],
  back: UI.back,
};

// The cogwheel menu.
export const MENU = {
  title: 'MENU',
  line: 'Saving keeps this expedition exactly as it stands.',
  settings: UI.settings,
  save: 'SAVE GAME',
  exit: 'EXIT GAME',
  keepPlaying: 'KEEP PLAYING',
};

// SAVE GAME: the expedition goes into the slot as it stands, unbanked.
export const SAVED = {
  title: 'EXPEDITION SAVED',
  titleCheats: 'NOTHING SAVED',
  lineCheats: 'Cheats are on, so this run was never for real and nothing was written.',
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
  title: 'LEAVE THE GAME',
  fallsBackToSave: 'Leaving does not save. This slot goes back to your last save.',
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
  written: (what) => `${what} stored. Water topped up.`,
  nothingNew: 'Nothing new to store. Water topped up.',
  cheats: 'CHEATS ON — nothing is stored. Water topped up.',
  bothWays: [
    'HEAD BACK OUT carries the expedition on;',
    'END HERE to quit.',
  ],
  bothWaysCheats: ['HEAD BACK OUT carries the expedition on; END HERE to quit.'],
  headBackOut: 'HEAD BACK OUT',
  endHere: 'END HERE',
};

// What the hall leaves you with: a world nobody has lit a tile of, and the same
// two answers the hut asks for — carry on, or stop here (DESIGN.md §4.9).
export const HALL = {
  title: 'A NEW WORLD',
  moulded: (n) =>
    `He has moulded the world ${n === 1 ? 'again' : `${n} times now`}. You are at your door with a candle and a full tank.`,
  kept: 'He has taken everything you carried — your coins, your tools, your colours — and the ground you drew with them.',
  cheats: 'CHEATS ON — nothing was stored, and this world is a sandbox like the last one.',
  rowWorlds: 'WORLDS ENDED',
  setOut: 'SET OUT AGAIN',
  endHere: 'END HERE',
};

// What is on the screen after he lets go (DESIGN.md §4.9): the whole game drawn
// inside out, in the light, one line at a time. Sentence case is the game
// talking and caps are its chrome, and credits are neither — they are the game
// signing what it just did, so they are set the way the title screen is.
export const CREDITS = {
  title: 'NOUXINHA',
  lines: [
    'THE SUN CAME BACK',
    'FOUR WORLDS WALKED TO THE END',
    'AND EVERY COLOUR CARRIED HOME OUT OF ALL FOUR',
    'THE DARK WAS HIS',
    'THE LIGHT WAS ALWAYS SOMETHING YOU HAD TO CARRY',
    'THE HUT HE LEFT STANDING EVERY SINGLE TIME',
    'THANK YOU FOR WALKING BACK',
  ],
  // The one thing on this screen that is about the game rather than the story:
  // the light it just turned on is a switch from here on (src/config.js).
  unlocked: 'INVERT COLOURS IS IN SETTINGS NOW, WITH THE CHEATS',
  back: 'TAP TO GO ON',
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
  cheats: 'CHEATS ON — NOTHING WAS SAVED TO THE SLOT',
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

// --- What the game says out loud ---------------------------------------------
//
// The text panel (ui/textPanel.js) covers the bottom of the screen and reads
// itself out a character at a time, one block per tap. One string per block, in
// the order they are read — a block is a beat rather than a line, so the split
// is a matter of pacing, not of width.

export const SAY = {
  // Setting out. Said once, at the top of a fresh expedition, and never to a
  // walk that is only being carried on (scenes/ExploreScene.js).
  expeditionStart: [
    'You venture out of the hut, and the dark is surrounding you.',
    'You are only equipped with your torch and some water.',
    'Explore the land, and bring back colour to the world.',
  ],
  // Opening a chest. Somebody was here before you and left something behind —
  // which is the only story the world tells about itself, so it gets the panel
  // rather than a line in the HUD.
  chestKey: (keyName) => [
    'The lid gives, and centuries of dust go up with it.',
    `Inside, on a bed of rotted cloth, lies the ${keyName.toLowerCase()}.`,
    'Somewhere out there is a gate cut in the same colour.',
  ],
  chestCoins: (coins) => [
    'The lid gives, and centuries of dust go up with it.',
    `Inside is a hoard of ${coins} coins, counted out and left for nobody.`,
    'The merchant will not ask where you got them.',
  ],
  // A landmark, walked into (DESIGN.md §4.10). The panel rather than a line in
  // the HUD for the same reason a chest gets it: this is the world telling you
  // something about itself, and the panel leaves the place on screen while it
  // is read. `again` is a landmark this campaign already knows from an earlier
  // world — shorter, because the second time you are not discovering it, you
  // are recognising it.
  landmark: (id, again) => LANDMARK_TEXT[id][again ? 'again' : 'met'],
  // A signpost, read for the first time. Every post has three arms: one is
  // always a blank stub gesturing cryptically toward the hut (SIGNPOST.hutHint),
  // and the rest carry names — usually one, occasionally two, of a landmark
  // this post happens to stand close enough to (`signpostTargets` in
  // core/world.js). Named directions are the only thing worth re-reading —
  // every read after this one is a line in the status bar.
  signpost: (lines, hutLine) => [
    'A post, leaning, with the ground trodden down around it.',
    lines.length > 1
      ? 'One of its three arms is a blank stub. The other two have names burned into the wood.'
      : 'One of its three arms is gone outright. Another is a blank stub. The last has a name burned into the wood.',
    ...lines,
    hutLine,
  ],
  // The hall (DESIGN.md §4.9). He introduces himself, he is courteous, he takes
  // what you brought, and he moulds the world again — and what he says is a
  // different conversation every time this campaign finishes a kind of world,
  // because how many it has finished is the only thing he has to go on.
  //
  // `finished` is that count, before this meeting. Nought is a campaign he has
  // never been carried a full set by; four is a campaign that has already
  // watched him let go and come back anyway (`ending` below).
  hall: (gems, max, finished = 0) => HALL_SPEECH[Math.min(finished, HALL_SPEECH.length - 1)](gems, max),
  // The end of the game: the fourth kind of world, walked to the hall with every
  // colour in hand, and nothing left for him to mould that you have not already
  // finished. He is not beaten and there is no fight — he simply runs out of
  // worlds to hand over, and says the two things the whole campaign has been
  // walking towards.
  ending: () => [
    'The clearing holds the hall, and the hall holds him, and his hands are open before you have said a word.',
    '"Four," he says. "Four kinds of world, walked all the way to the end, and every colour out of every one of them carried back to me. I have nothing left to hand you."',
    '"It is going out," he says. "It has been going out the whole time I have been holding it. I called that keeping it, and you carried the pieces back so that I could go on calling it that."',
    'There is nothing to take out of your hands. He turns his own over and looks at them.',
    '"You kept coming back," he says. "Nobody has ever kept coming back. Stand where you are — this will be bright."',
    'And he lets go.',
  ],
};

// The five conversations, by how many kinds of world this campaign had finished
// when it walked in (DESIGN.md §4.9). Each is the same shape — the clearing, his
// name for what is happening, the one line that depends on what you are actually
// carrying, the taking, and the ground going — and each is a man further along
// in something he has never said out loud.
const HALL_SPEECH = [
  (gems, max) => [
    'The clearing holds no hoard. It holds a hall, and a man standing in front of it with his hands full of light.',
    '"Nouxinha," he says, as though you had asked. "You have come a long way, and not for the first time — though you would not remember that."',
    gems >= max
      ? '"All three. Good — they are flakes off what I am holding, and my hands are rather full."'
      : gems
        ? `"${gems === 1 ? 'One' : 'Two'} of three. Close is not the same as finished, and I will take those."`
        : '"Empty-handed. That is a long walk for a conversation, and I am glad of the conversation."',
    'He takes what you are carrying out of your hands, one piece at a time, and you let him.',
    '"The sun went out because I caught it," he says. "I am not sorry, and I am not finished. Go home and rest."',
    'The ground goes. When it comes back it is not the ground you learned — and your own door is behind you.',
  ],
  (gems, max) => [
    'The clearing again, and the hall in it, and the man in front of the hall with his hands full of light.',
    '"Nouxinha," he says. "Which you knew. You walked one of my worlds all the way to the end, and something of it stayed on you — that is new, and I have not decided whose it is."',
    gems >= max
      ? '"All three again, and faster. You are learning the shape of what I build."'
      : gems
        ? `"${gems === 1 ? 'One' : 'Two'} of three, this time. You came anyway. Last time you came with everything, and I am not going to ask."`
        : '"Nothing in your hands at all. You came the whole way to look at me. I would have, in your place."',
    'He takes what you have, one piece at a time, and he is careful about your hands.',
    '"You will be back," he says, with no weight on it whatsoever. "Everybody is. Go home and rest."',
    'The ground goes. When it comes back it is a different kind of dark, and your own door is behind you.',
  ],
  (gems, max) => [
    'The hall stands where a hoard should be, in the third clearing of its kind you have walked into.',
    '"Two of them finished, and here is the next," he says. "I keep the count as well. It is most of the arithmetic I have left."',
    gems >= max
      ? '"All three. You do this well now — better than I built it to be done."'
      : gems
        ? `"${gems === 1 ? 'One' : 'Two'} of three. You are not here for the fetching any more, are you."`
        : '"Empty-handed, and you knew you would be before you set out. So this is a visit."',
    'He gathers them in. His hands do not quite close any more, and you both watch them not close.',
    '"You are looking at my hands," he says. "Everyone gets there eventually. Go home."',
    'The ground goes, and comes back as somewhere else, and your own door is behind you.',
  ],
  (gems, max) => [
    'The clearing, the hall, the man — the third time you have arrived already knowing what all three of them are.',
    '"Three kinds of world walked out from under you," he says. "There is one left that you have not finished. I would rather you did not, and I am going to hand it to you anyway, because handing you a world is the only thing I still know how to do."',
    gems >= max
      ? '"All three. Of course. You have not missed a set since the first world."'
      : gems
        ? `"${gems === 1 ? 'One' : 'Two'} of three. Not this time, then. Neither of us is in a hurry."`
        : '"Nothing. Good — sit down. The next one will want your legs."',
    'He takes what there is. The light in his hands is thinner than it was the first time you stood here, and it is not the dark that has thinned it.',
    '"Go on," he says. "Finish it. I will be standing in the last one."',
    'The ground goes, for what you both know is the last time but one.',
  ],
  (gems) => [
    'The clearing, and the hall, and him in front of it as though the sun had never come up over any of this.',
    '"You know how it goes now," he says. "It went out of my hands, and it came up over all of it, and here we both still are. I mould, you walk. I never minded the walking."',
    gems
      ? '"And you brought colour with you, out of habit. So did I, once."'
      : '"And nothing in your hands, which is the honest way to arrive."',
    'He takes what you have and sets it down beside him, where the light already is.',
    '"Again, then," he says. "You know the way."',
    'The ground goes. It always does. Your own door is behind you.',
  ],
];

// --- The landmarks -----------------------------------------------------------
//
// The four named places, one per world, the same four in every world the hall
// moulds (DESIGN.md §4.10). A name, and what the panel reads out the first time
// this campaign touches it — and the shorter thing it reads out in every world
// after, once the place is one you recognise rather than one you are finding.
//
// `standing` is the line the campaign keeps: what putting a hand on this one
// changed for good. It is copy rather than a rule — the rule is in
// `src/core/rules.js` — but the two are written to say the same thing.

export const LANDMARK_TEXT = {
  mint: {
    name: 'THE MINT',
    standing: 'THE STALL IS ON YOUR MAP',
    met: [
      'A stone press, with the die still set in it.',
      'Around its foot are coins: struck blank, thousands of them, not one of them worth anything.',
      'Somebody built a mint for a world with one person in it, and then minted the money as well.',
      'You take a handful of blanks. You will know where the stall is, in every world after this one.',
    ],
    again: [
      'The press again, in ground it was not standing in yesterday, in the same drift of blanks.',
      'It strikes you a handful, the way it did before.',
    ],
  },
  bell: {
    name: 'THE DROWNED BELL',
    standing: 'YOU HEAR IT WHEREVER IT STANDS',
    met: [
      'A bell bigger than the hut, mouth-down in ground that is wet for no reason this world can account for.',
      'You put a hand on it. It answers — one note, so low it is more felt than heard, and it is still going when you take your hand away.',
      'You drink until you cannot drink any more. You will hear that note again, wherever it is standing.',
    ],
    again: [
      'The bell again, humming before you have touched it.',
      'The water under it is as deep as it ever was.',
    ],
  },
  'lantern-tree': {
    name: 'THE LANTERN TREE',
    standing: 'YOU NEVER SET OUT WITH ONE LIGHT AGAIN',
    met: [
      'A dead tree with lanterns hung all through it, lit a very long time ago and still, faintly, going.',
      'The glass underfoot says most of them fell. Somebody stood here with a light, and it was not you.',
      'You take a flame off the lowest one. You will not walk out of the hut with a single candle again.',
    ],
    again: [
      'The tree again, still burning, in a world that has never seen it.',
      'You hold your light up to it and it comes back to full.',
    ],
  },
  gnomon: {
    name: 'THE GNOMON',
    standing: 'YOU KNOW HOW FAR OUT YOU ARE',
    met: [
      'A shaft on a stepped base, standing at the centre of a dial cut into the ground.',
      'It has never once cast a shadow. There has been no sun since it was raised, and it was raised anyway, by somebody who expected to need it.',
      'You read what is left of the dial. From here on you know how far out you are standing.',
    ],
    again: [
      'The dial again, in ground it was not cut into yesterday, still keeping a time this world does not have.',
      'It shows you the ground you came over.',
    ],
  },
};

// --- Signposts ---------------------------------------------------------------
//
// What a post says: a name, a heading and how far, in that order and in that
// many words. Eight headings because the post is somebody's directions rather
// than an instrument — the compass is the instrument, and it draws four.

export const SIGNPOST = {
  // North first, then clockwise (`signpostBearing` in src/core/world.js).
  bearings: [
    'NORTH',
    'NORTH-EAST',
    'EAST',
    'SOUTH-EAST',
    'SOUTH',
    'SOUTH-WEST',
    'WEST',
    'NORTH-WEST',
  ],
  // How far, in bands (balance.js SIGNPOST_BANDS): near, a walk, a long walk,
  // and further than any of those.
  far: ['NEARBY', 'A WALK', 'A LONG WALK', 'FAR'],
  line: (name, bearing, far) => `${name} — ${bearing} — ${far}`,
  // The stub that isn't a named arm — cryptic on purpose, because a signpost
  // that knew the way to your hut would be a strange thing to find lying in
  // the dark (DESIGN.md §4.10). It gets a heading and nothing else: no name,
  // no distance, just a direction that happens to be worth remembering.
  hutHint: (bearing) => `A blank stub still points ${bearing.toLowerCase()}. No name on it — but you know that way.`,
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
    name: 'CANDLE',
    effect: 'Lights the 8 tiles around you.',
  },
  'torch-medium': {
    name: 'TORCH',
    effect: 'Lights 2 tiles in every direction. Twice the reach, half the leash.',
  },
  'torch-lamp': {
    name: 'CANDELABRE',
    effect: 'Lights a widening cone 4 tiles ahead. Sees nothing behind you.',
  },
  'torch-beacon': {
    name: 'LANTERN',
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
    effect: 'The first colour, back in the world. More water, and better things lying about.',
  },
  'gem-2': {
    name: 'SECOND COLOUR',
    effect: 'The second colour, back in the world. More water again, and the lantern with it.',
  },
  'gem-3': {
    name: 'THIRD COLOUR',
    effect: 'The last colour, and the last of the water the world can give you.',
  },
  // A key is named for the gate it opens, because that is the only thing a
  // player ever has to know about it — and the two are drawn in the same colour.
  'key-1': {
    name: 'FIRST KEY',
    effect: 'Opens the gate of the second sanctum. Carry it home to keep it.',
  },
  'key-2': {
    name: 'SECOND KEY',
    effect: 'Opens the gate of the third sanctum. Carry it home to keep it.',
  },
  'key-3': {
    name: 'THIRD KEY',
    effect: 'Opens the last gate of all. Carry it home to keep it.',
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
