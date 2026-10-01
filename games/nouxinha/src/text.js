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

// The one line the slot picker uses to say what a campaign has to show for
// itself.
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
  // Weather, embers and bursts (src/ui/particles.js).
  particles: (on) => `PARTICLES: ${on ? 'ON' : 'OFF'}`,
  moveSpeed: (stepsPerSecond) => `MOVE SPEED: ${stepsPerSecond}/s`,
  cheats: (on) => `CHEATS: ${on ? 'ON' : 'OFF'}`,
  cheatNote: (on) =>
    on
      ? 'WHOLE MAP REVEALED. NOTHING SAVES.'
      : 'REVEALS THE MAP AND HANDS YOU EVERY ITEM.',
  // The switch the ending leaves behind (DESIGN.md §4.9). Only on this screen
  // for a player who has seen the light come back, and only while the cheats are
  // on: it is a way of looking at the game rather than a way of playing it.
  invert: (on) => `INVERT COLOURS: ${on ? 'ON' : 'OFF'}`,
  invertNote: 'THE WORLD DRAWN INVERTED.',
  // The tutorial's switch (DESIGN.md §4.13): on for a first game, turned off by
  // finishing it, and turned back on here for the next NEW GAME.
  tutorial: (on) => `TUTORIAL: ${on ? 'ON' : 'OFF'}`,
  tutorialNote: (on) => (on ? 'THE NEXT NEW GAME STARTS WITH IT.' : 'TURN ON TO WALK IT AGAIN.'),
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
  explored: (tiles) => `EXPLORED: ${tiles}`,
  coins: (coins) => `COINS: ${coins}`,
  water: (water, ceiling) => `WATER: ${water}/${ceiling}`,
  // How many worlds the hall has taken off this campaign (DESIGN.md §4.9).
  // Only on screen once there is one to count.
  cycles: (n) => `WORLDS: ${n}`,
  // How far from the hut you are standing *now* — the Gnomon's standing, and so
  // only on screen for a campaign that has put a hand on it (DESIGN.md §4.10).
  distance: (n) => `OUT: ${n}`,
  light: (name, durability, max) => `${name}:  ${durability}/${max}`,
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
  gemFound: (name) => `YOU FOUND ${name}! A PIECE OF THE SUN. CARRY IT HOME.`,
  toolFound: (name) => `YOU FOUND THE ${name}!`,
  burnedOutBlackout: (name) => `${name} BURNED OUT. NO LIGHT LEFT.`,
  burnedOutSwapped: (name, lit) => `${name} BURNED OUT. ${lit} LIT.`,
  coins: (n) => `YOU FOUND ${n} COIN${n === 1 ? '' : 'S'}.`,
  picked: (name) => `YOU FOUND ${name}.`,
  respawned: 'THE WORLD HAS SHIFTED. EVERYTHING LYING OUT THERE IS LYING SOMEWHERE ELSE NOW.',
  // Walking back into the bag a death left behind (DESIGN.md §6).
  bagFound: 'YOUR BAG. EVERYTHING YOU LOST IS BACK IN HAND.',
  // A shut gate bumps like rock, so it says what it wants rather than reading
  // as a wall with a pattern on it. It names the key by colour, because the key
  // and the gate are drawn in the same one.
  gateLocked: (keyName) => `LOCKED. IT NEEDS THE ${keyName}.`,
  gateOpened: (keyName) => `THE ${keyName} TURNS. THE GATE IS OPEN.`,
  keyFound: (name) => `YOU FOUND THE ${name}. WHAT WILL IT OPEN?`,
  chestCoins: (n) => `THE CHEST HELD ${n} COINS.`,
  chestEmpty: 'THE CHEST IS ALREADY OPEN.',
  // A landmark, walked into. The panel says what it is; the status line says
  // what it just did for you, which is the half worth having in a shout.
  landmarkAgain: (name) => `${name}. NOTHING MORE TO TAKE FROM IT IN THIS WORLD.`,
  // One line per landmark that has a gift, because two of them reveal ground
  // and a shared "GROUND REVEALED" would lose which place just did it. Keyed
  // by landmark id and read through `giftLine` in ExploreScene: a landmark
  // with no entry here is one with no gift to shout about, which is the four
  // that belong to a single world (DESIGN.md §4.10.3).
  landmarkGift: {
    mint: (gift) => `THE PRESS STRIKES YOU ${gift.coins} COINS.`,
    bell: () => 'THE WATER UNDER IT IS DEEP. YOUR WATER IS FULL.',
    'lantern-tree': (gift) => `${gift.light} BURNS LIKE NEW.`,
    gnomon: () => 'THE DIAL SHOWS YOU THE GROUND YOU WALKED OVER.',
    aqueduct: () => 'YOU FOLLOW THE CHANNEL WITH YOUR EYES. THE GROUND UNDER IT LIGHTS UP.',
    watchtower: () => 'FROM THE TOP, YOU CAN SEE ALL AROUND.',
    weighhouse: (gift) => `IN THE HOUSE, YOU FIND ${gift.stocked}.`,
  },
  // A signpost, read again. The first read gets the panel; the hut's hint is
  // flavour rather than a fact worth repeating, so it isn't in this one.
  signpost: (lines) => lines.join(' / '),
  // A carved stone, bumped again with no step in between. Unlike a post there
  // is nothing short to echo — what a stone says is paragraphs — so all the
  // status line does is say that nothing has changed since the panel.
  stoneAgain: 'THE SAME WORDS, CUT IN THE SAME STONE.',
  // A wisp, bumped again with no step in between — a direction key held
  // against it, the same debounce every other bumped thing gets.
  wispAgain: 'STILL GLOWING.',
  // The edge, every time after the first — the first bump earns the EDGE dialog.
  edge: 'THE DARK IS TOO THICK. YOU CANNOT GO ANY FURTHER.',
  bought: (name, coinsLeft) => `YOU BOUGHT ${name}. ${coinsLeft} COINS LEFT.`,
  headBackOut: 'GAME SAVED. YOUR WATER HAS REPLENISHED.',
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
  title: 'THE DARK IS TOO STRONG.',
  lines: [
    'This is the edge of the land. Out here, the dark is so thick that it has eaten all of your light.',
    'You cannot go any further. Turn around.',
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
  lineCheats: 'Cheats are on, so this run was never for real and nothing was saved.',
  lines: (slot) => [
    `Slot ${slot} is holding this game exactly where you are standing.`,
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
  title: 'A NEW LAND',
  moulded: (n) =>
    `Nouxinha has carried you to a new land ${n === 1 ? 'once' : `${n} times now`}. You are at your door with a candle and a full tank of water.`,
  kept: 'He kept the colours. Your coins, lights and tools stayed behind in the old land. Only you came across: you, and everything you learned.',
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
    'FOUR LANDS WALKED TO THE END',
    'TWELVE PIECES OF THE SUN CARRIED HOME',
    'HE HELD THE SUN FOR HUNDREDS OF YEARS',
    'YOU CARRIED THE LIGHT THE WHOLE WAY',
    'AND YOUR HUT WAS ALWAYS THERE, WAITING',
    'THANK YOU FOR COMING BACK',
  ],
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
    `You collapsed in the dark. ${what} you were carrying ${many ? 'are' : 'is'} in a bag where you fell — walk back to it to take ${
      many ? 'them' : 'it'
    } up again.`,
  collapsedEmptyHanded: 'You collapsed in the dark. Everything you were carrying is in a bag where you fell.',
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
    'You step out of your hut. All around you, it is dark.',
    'You have a lit candle and some water. Every step uses up a little of both.',
    'Somewhere out there are pieces of the broken sun. Find them, and bring their colour back home.',
  ],
  // Opening a chest. Somebody was here before you and left something behind —
  // which is the only story the world tells about itself, so it gets the panel
  // rather than a line in the HUD.
  chestKey: (keyName) => [
    'You lift the lid, and a cloud of old dust puffs out.',
    `Inside is the ${keyName.toLowerCase()}.`,
    'Somewhere out there is a gate painted the same colour. This key opens it.',
  ],
  chestCoins: (coins) => [
    'You lift the lid, and a cloud of old dust puffs out.',
    `Inside are ${coins} coins.`,
    'You can spend them at a stall.',
  ],
  chestTool: (toolName) => [
    'You lift the lid, and a cloud of old dust puffs out.',
    `Inside is the ${toolName.toLowerCase()}.`,
    'Someone left it here a long time ago, and never came back for it.',
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
  // A wisp, put a hand on for the first time — or the tenth: it has nothing
  // to give and nothing to remember about you, so every fresh touch reads the
  // same short thing (DESIGN.md §4.11).
  wisp: [
    'A tiny light, floating all on its own.',
    'It is a little piece of the broken sun, too small to pick up. It lights up the ground around it, and it will keep glowing long after you leave.',
  ],
  // A carved stone, read by walking into it (DESIGN.md §4.12). Which of the
  // five cuts of it you get is how many kinds of world this campaign has
  // already finished — the same count the hall reads (`SAY.hall` above) — and
  // a campaign past the end of the table reads the last of them for good.
  stone: (id, finished) => STONE_TEXT[id][Math.min(finished, STONE_TEXT[id].length - 1)],
  signpost: (lines, hutLine) => [
    'An old wooden signpost, leaning a little.',
    lines.length > 1
      ? 'It has three arms. Two have names painted on them, and one is blank.'
      : 'It has three arms. One has broken off, one is blank, and one has a name painted on it.',
    ...lines,
    hutLine,
  ],
  // The hall (DESIGN.md §4.9). He introduces himself, he is courteous, he takes
  // what you brought, and he carries you to another part of the realm — and
  // what he says is a different conversation every time this campaign finishes
  // a kind of world, because how many it has finished is the only thing he has
  // to go on.
  //
  // `finished` is that count, before this meeting. Nought is a campaign he has
  // never been carried a full set by; the meeting that reaches four is the
  // ending (`ending` below) instead, and never lands here — the clamp exists
  // only for a slot that already says four some other way.
  hall: (gems, max, finished = 0) => HALL_SPEECH[Math.min(finished, HALL_SPEECH.length - 1)](gems, max),
  // The end of the game: the fourth kind of world, walked to the hall with every
  // colour in hand, and nowhere left in the realm to carry you that you have not
  // already finished. He is not beaten and there is no fight and he is not
  // giving up — twelve pieces is enough to mend it, and the mending is the one
  // thing he has not done in centuries: he opens his hands (STORY.md §2).
  ending: () => [
    'Nouxinha is waiting in the hall. This time, his hands are already a little open.',
    '"Four," he says. "Four lands, and you brought me every piece from every one of them. There is nowhere left to send you."',
    'He takes the last pieces from you. Between his fingers, the sun is whole again, and a warm light pours out.',
    '"It is mended," he says. "I have held it since before I woke you. Now all I have to do is let go."',
    'He looks down at his hands and slowly starts to open them. The light grows, strong and warm.',
    '"You always came back," he says. "Thank you. Stay right where you are. This will be very bright."',
    'He opens his hands all the way. The sun rises, and colour floods back into the land.',
  ],
};

// The five conversations, by how many kinds of world this campaign had finished
// when it walked in (DESIGN.md §4.9). Each is the same shape — the clearing, his
// name for what is happening, the one line that depends on what you are actually
// carrying, the taking, and the crossing — and each is a man further along in
// something he has never said out loud.
//
// He never makes ground and the copy never says he does (STORY.md §2): the four
// worlds are four countries of one realm, and what happens at the end of a
// conversation is that he carries you to another of them, with nothing in your
// hands, because a person is the whole of what he can carry.
const HALL_SPEECH = [
  (gems, max) => [
    'In the middle of the hall stands an old man. His hands are closed, and light is shining out between his fingers.',
    '"Hello. I am Nouxinha," he says. "You don\'t remember me, but I am the one who woke you up in your hut."',
    gems >= max
      ? '"You found all three colours! Each one is a piece of the sun. Let me tell you why I need them."'
      : gems
        ? `"${gems === 1 ? 'One' : 'Two'} of three. That is a good start, but I need all three. Let me tell you why."`
        : '"You came with empty hands. That is all right. Let me tell you why you are here."',
    '"Long ago, the sun was dying. I held it in my hands to save it, but it broke. The pieces fell all over the land, and the world went dark."',
    '"I am still holding what is left of the sun. If I let go, everything disappears. That is why I can\'t look for the pieces myself, and why I woke you."',
    'He gently takes what you are carrying. "Now I will send you to another land. I can only carry you, not your things. Your coins, lights and tools stay here."',
    'He lifts one hand, and the ground drops away. When it comes back, you are somewhere new, and your own door is right behind you.',
  ],
  (gems, max) => [
    'The hall again, and Nouxinha in the middle of it, with light shining between his fingers.',
    '"Hello again," he says. "You finished a whole land. And look: what you learned at my landmarks came with you."',
    gems >= max
      ? '"All three again, and faster this time. You are getting good at this."'
      : gems
        ? `"${gems === 1 ? 'One' : 'Two'} of three this time. Never mind. You came, and that matters."`
        : '"Nothing in your hands. You walked all this way just to see me? That is kind."',
    '"Every piece you bring makes the sun a little more whole," he says. "With twelve, I can mend it."',
    'He takes what you are carrying, one piece at a time, very carefully.',
    '"Go home and rest," he says. Then the ground drops away, and you are somewhere new, with your own door behind you.',
  ],
  (gems, max) => [
    'Another hall: the third one you have walked into. Nouxinha is waiting, as always.',
    '"Two lands finished," he says. "I keep count too. There is not much else to do when you can\'t move."',
    gems >= max
      ? '"All three! You are better at this than I ever hoped."'
      : gems
        ? `"${gems === 1 ? 'One' : 'Two'} of three. You don't really come just for the pieces any more, do you?"`
        : '"No pieces at all. So this is just a visit. I like visits."',
    'He gathers in the colours. For a moment you see between his fingers: a ball of light, cracked all over, held together by his hands.',
    '"Yes, that is the sun, or what is left of it," he says. "Two more lands, and it will be whole again. Now go home."',
    'The ground drops away, and you are in another land, with empty pockets and your own door behind you.',
  ],
  (gems, max) => [
    'The hall, and Nouxinha. This time, you knew exactly what you would find.',
    '"Three kinds of land finished," he says. "Only one is left."',
    gems >= max
      ? '"All three. Of course. You haven\'t missed a piece since the very first land."'
      : gems
        ? `"${gems === 1 ? 'One' : 'Two'} of three. Not this time, then. That is all right. Neither of us is in a hurry."`
        : '"Nothing in your hands. Come back when you have found the pieces."',
    'He takes what you are carrying. The light between his fingers is much brighter than the first time you stood here.',
    '"Go and finish the last land," he says. "Bring me its three pieces, and I can mend the sun. I will be waiting in the last hall."',
    'He carries you across one more time. You both know it is nearly the last.',
  ],
  (gems) => [
    'The hall, and Nouxinha in the middle of it, as if the sun had never come up at all.',
    '"You know how this goes now," he says. "I carry, and you walk. I never minded the walking."',
    gems
      ? '"And you brought colours with you, out of habit. Thank you."'
      : '"And nothing in your hands. That is fine too."',
    'He takes what you have and puts it down beside him, where the light already is.',
    '"Again, then," he says. "You know the way."',
    'He carries you over, like always. Your own door is behind you.',
  ],
];

// --- The landmarks -----------------------------------------------------------
//
// The seven he carries with him wherever he puts you down, plus the one thing
// each kind of world keeps to itself (DESIGN.md §4.10, STORY.md §3). A name,
// and what the panel reads out the first time this campaign touches it — and
// the shorter thing it reads out in every world after, once the place is one
// you recognise rather than one you are finding.
//
// `standing` is the line the campaign keeps: what putting a hand on this one
// changed for good. It is copy rather than a rule — the rule is in
// `src/core/rules.js` — but the two are written to say the same thing.

export const LANDMARK_TEXT = {
  mint: {
    name: 'THE MINT',
    standing: 'THE STALL IS ON YOUR MAP',
    met: [
      'A big stone press, for making coins.',
      'Thousands of blank coins lie all around it. They have no pictures on them, and they are worth nothing anywhere except at the stalls.',
      'You fill your pockets. From now on, in every land, you will know where the stall is.',
    ],
    again: [
      'The coin press again: a new land, but the same pile of blank coins.',
      'It gives you a handful, just like last time.',
    ],
  },
  bell: {
    name: 'THE DROWNED BELL',
    standing: 'YOU HEAR IT WHEREVER IT STANDS',
    met: [
      'A huge bell, bigger than your hut, lying upside down in wet ground.',
      'You touch it, and it rings: one note, so deep that you feel it more than you hear it.',
      'There is fresh water under it, and you drink until you are full. From now on, you will hear this bell from wherever it stands.',
    ],
    again: [
      'The bell again. It is humming before you even touch it.',
      'The water under it is as deep as ever.',
    ],
  },
  'lantern-tree': {
    name: 'THE LANTERN TREE',
    standing: 'YOU ALWAYS SET OUT WITH A SPARE CANDLE',
    met: [
      'A dead tree, hung all over with old lanterns. They were lit a very long time ago, and they are still glowing, just a little.',
      'Broken glass lies on the ground. Many of the lanterns have fallen.',
      'You take a flame from the lowest one. From now on, you will always leave your hut with a spare candle.',
    ],
    again: [
      'The Lantern Tree again, still glowing, in a new land.',
      'You hold your light up to it, and your light burns like new.',
    ],
  },
  gnomon: {
    name: 'THE GNOMON',
    standing: 'YOU KNOW HOW FAR OUT YOU ARE',
    met: [
      'A tall stone pointer on a set of steps, in the middle of a big dial carved into the ground. It is a sundial.',
      'But there is no sun, so it has never cast a shadow.',
      'You read the marks on the dial. From now on, you will always know how far you are from home.',
    ],
    again: [
      'The sundial again, in a new land, still waiting for the sun.',
      'It shows you the ground you walked over.',
    ],
  },
  aqueduct: {
    name: 'THE AQUEDUCT',
    standing: 'YOU CAN CARRY MORE WATER',
    met: [
      'A row of tall stone arches. They come out of the dark on one side and stop in mid-air on the other.',
      'Along the top runs a channel that once carried water. It has been dry for a very long time.',
      'Standing under it, you work out how to pack your water better. From now on, you can carry more.',
    ],
    again: [
      'The stone arches again, in a new land.',
      'You follow the channel with your eyes, and the ground under it lights up.',
    ],
  },
  watchtower: {
    name: 'THE WATCHTOWER',
    standing: 'THE DARK TAKES YOUR LIGHT LATER',
    met: [
      'A tall tower with no door. A staircase winds around the outside, up to an empty top.',
      'You climb up. The railing is worn smooth, as if someone stood here for a very long time, watching the dark.',
      'From up here, the dark looks less scary. From now on, it has to come closer before it starts eating your light.',
    ],
    again: [
      'The tower again, standing over a new land.',
      'You climb up, and see the ground spread out below you.',
    ],
  },
  weighhouse: {
    name: 'THE WEIGHHOUSE',
    standing: 'YOU PAY LESS AT THE STALLS',
    met: [
      'A stone shed, open on three sides, with a giant pair of scales inside. They are big enough to weigh a whole cart.',
      'One side is piled with blank coins and the other is empty, but the scales are perfectly level. Price lists are carved along the beam.',
      'You read the price lists carefully. From now on, nobody can charge you too much: everything at the stalls costs you less.',
    ],
    again: [
      'The scales again, in a new land, still perfectly level.',
      'There is something lying on the empty side. There always is.',
    ],
  },
  // The four that are only one world's (DESIGN.md §4.10.3). No gift, no
  // standing, and no line about what you take, because you take nothing: what
  // these hand over is that somebody was here doing something ordinary, and
  // stopped.
  plough: {
    name: 'THE PLOUGH',
    met: [
      'A plough, standing in a half-dug field, with its blade still in the ground.',
      'The line it was digging stops after nine steps. Whoever was pushing it stopped right in the middle of their work, as if time had frozen.',
      'There is nothing to take here. Someone meant to finish this field, and never did.',
    ],
    again: [
      'The plough again, in the same half-dug field.',
    ],
  },
  washing: {
    name: 'THE LINE OF WASHING',
    met: [
      'Two posts with a line between them. Clothes hang on it, frozen stiff and perfectly still.',
      'You touch a shirt. It is as hard as wood, still blowing in a wind that stopped long ago.',
      'The clothes are just your size. There is nothing here to take.',
    ],
    again: [
      'The washing line again, with the same frozen clothes.',
    ],
  },
  caravan: {
    name: 'THE CARAVAN',
    met: [
      'A long line of packs, tied one to the next, all of them still full.',
      'There are no animals and no people. Nothing has fallen and nothing is broken. Every knot is still tight.',
      'They were on their way somewhere, and then, all at once, they stopped.',
    ],
    again: [
      'The caravan again, tied up and loaded, going nowhere.',
    ],
  },
  'second-hut': {
    name: 'THE SECOND HUT',
    met: [
      'A hut. Your hut! The same door, the same crooked roof, the same stone holding the door open.',
      'Inside are your own things, right where you would put them. But the water tank is dry, the fire is cold, and thick dust covers everything.',
      'You have lived here before, a long time ago. You just don\'t remember it. You don\'t go in.',
    ],
    again: [
      'The other hut again: still yours, still cold, on ground you have never lived on.',
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
  hutHint: (bearing) => `The blank arm points ${bearing.toLowerCase()}. There is no name on it, but you know where that way goes: home.`,
};

// --- Carved stones -----------------------------------------------------------
//
// The four stones Nouxinha cut and left standing in the dark (DESIGN.md §4.12),
// and the only thing in the game he says to you when he is not in front of you.
// A signpost is the world's own signage and a landmark is somebody's building;
// a stone is a letter, cut in advance, addressed to whoever is walking.
//
// Each of them is about one thing the game will not otherwise explain — the
// colours, the gates, the light, the walk home — and each is written **five
// ways**, by how many kinds of world this campaign has already finished
// (`state.finished`, the same count the hall reads: `HALL_SPEECH` above). The
// stone is the same stone every time; what changes is who he is writing to, and
// how much of himself he is willing to cut into rock about it. Nought is a
// stranger who may not know what a colour is for. Four is somebody who has
// walked every country he has and watched him open his hands, and the
// instructions are no use to either of them any more.
//
// A cycle leaves one country for another and the stones are standing in that
// one too, which is the one thing here the copy is allowed to notice: he cut
// them in every part of the realm before any of this, because it was an hour's
// work apiece and he had nothing but hours.

export const STONE_TEXT = {
  // The doorstep stone (`STONE_PLAN` in src/balance.js): five to eight tiles
  // out, so a first expedition cannot miss it. It says what the colours are,
  // which is the one thing a player who has never walked this dark actually has
  // to be told.
  'stone-1': [
    [
      'A tall stone stands here, with big letters carved into the side facing your hut.',
      '"HELLO. MY NAME IS NOUXINHA. I WOKE YOU UP, AND I NEED YOUR HELP."',
      '"THE SUN BROKE. THREE PIECES OF IT FELL IN THIS LAND. EACH PIECE IS A COLOUR. THEY ARE KEPT INSIDE WALLS, BEHIND GATES."',
      '"FIND ALL THREE AND BRING THEM TO ME. I AM IN THE HALL, THE LAST AND FURTHEST OF THE WALLED PLACES."',
      'Lower down, in smaller letters: "NOTHING YOU FIND IS YOURS UNTIL YOU CARRY IT BACK TO YOUR HUT."',
    ],
    [
      'The same stone, with the same carving. But this is a new land.',
      '"THREE COLOURS AGAIN," it says. "I CARVED A STONE LIKE THIS OUTSIDE EVERY HUT. EACH ONE TOOK ME AN HOUR, AND I HAVE ALL THE TIME IN THE WORLD."',
      '"THE FIRST COLOUR IS ALWAYS CLOSE. THE OTHERS ARE FURTHER OUT. TAKE PLENTY OF WATER."',
    ],
    [
      'The doorstep stone again. It is the first thing here you recognise.',
      '"TWO LANDS FINISHED," it says. "I CARVED THAT IN LATER. I KEEP COUNT TOO."',
      '"THREE COLOURS, AND THE SAME WALK. IT WILL FEEL SHORTER THIS TIME. THAT IS BECAUSE YOU HAVE GOT BETTER AT IT."',
    ],
    [
      'The doorstep stone. By now you know his writing well.',
      '"THREE COLOURS," it says. "I KNOW HOW THIS LOOKS: I TAKE THE PIECES FROM YOU, AND THEN I SEND YOU SOMEWHERE WITH THREE MORE."',
      '"BUT THIS IS THE LAST LAND. BRING ME THESE THREE, AND I CAN MEND THE SUN."',
    ],
    [
      'The stone is still here, even though you don\'t need its help any more.',
      '"THREE COLOURS ARE HIDDEN IN THIS LAND," it says, the way it always has.',
      'Underneath is a new line, carved with a shaky hand: "YOU KNOW THE WAY. WALK IT IF YOU LIKE. I AM GLAD OF THE COMPANY."',
    ],
  ],
  // The second: gates, keys and the named places, which is the one chain in the
  // game a player can walk past without ever working out (DESIGN.md §4.8).
  'stone-2': [
    [
      'A waist-high stone. Its carving faces away from your hut, for someone already on their way out.',
      '"EACH WALLED PLACE HAS A GATE, AND EACH GATE NEEDS A KEY OF THE SAME COLOUR," it says. "ONLY THE FIRST ONE IS OPEN."',
      '"KEYS ARE IN CHESTS, AND THE CHESTS ARE NEAR MY LANDMARKS. THE SIGNPOSTS TELL YOU WHERE THE LANDMARKS ARE."',
      '"VISIT THE LANDMARKS EVEN WHEN THERE IS NO CHEST NEARBY. EACH ONE GIVES YOU SOMETHING."',
    ],
    [
      'The second stone, facing out, with the same words and one new line.',
      '"GATES NEED KEYS. KEYS ARE IN CHESTS NEAR THE LANDMARKS. THE SIGNPOSTS KNOW WHERE THE LANDMARKS ARE."',
      '"WHAT YOU LEARN AT A LANDMARK, YOU KEEP, EVEN WHEN I SEND YOU TO A NEW LAND," says the new line. "THAT IS THE ONE GOOD THING I CAN TELL YOU."',
    ],
    [
      'The stone facing out into the dark. This is the third land you have read it in.',
      '"GATES, KEYS, CHESTS, LANDMARKS," it says. "YOU KNOW ALL THIS. I LEAVE IT UP ANYWAY, THE WAY SOMEONE SWEEPS A FLOOR THAT NOBODY WALKS ON."',
      '"I BRING THE SAME SEVEN LANDMARKS TO EVERY LAND. THEY HELP ME FIND MY WAY. THEY ARE ALSO THE ONLY COMPANY I HAVE."',
    ],
    [
      'The second stone. By now it reads like a letter from an old friend who writes too often.',
      '"GATES, KEYS, LANDMARKS," it says. "BUT THERE IS ONE PLACE IN EVERY LAND THAT I DID NOT BUILD, AND I PUT UP NO SIGNPOSTS FOR IT."',
      '"PEOPLE LIVED HERE ONCE. I THINK MY MAGIC FROZE THEM WHEN I CAUGHT THE SUN. IF YOU FIND THAT PLACE, STOP FOR A MOMENT AND REMEMBER THEM."',
    ],
    [
      'The stone, still facing out, still telling walkers where the keys are.',
      '"GATES, KEYS, LANDMARKS," it says. And underneath, carved later:',
      '"THE PLACE I DID NOT BUILD IS STILL OUT THERE. IT WAS NEVER MINE. THAT IS WHY IT IS STILL THERE."',
    ],
  ],
  // The third: light, and the dark that eats it (DESIGN.md §4.1, §4.7). Cut far
  // enough out that a campaign reading it has met both.
  'stone-3': [
    [
      'A stone far out, where the ground starts to feel empty. There is writing on all four of its sides.',
      '"YOUR LIGHT BURNS DOWN WITH EVERY STEP," says the first side. "YOU CANNOT SAVE IT OR PUT IT OUT."',
      '"FURTHER OUT, THE DARK GETS THICKER AND EATS YOUR LIGHT, ONE TILE AT A TIME," says the second. "WALK BACK, AND YOUR LIGHT GROWS AGAIN."',
      '"THE LITTLE ROUND LIGHTS ARE TINY PIECES OF THE SUN," says the third. "THEY ARE TOO SMALL TO CARRY, BUT THEY LIGHT THE WAY. USE THEM."',
      'The fourth side is blank.',
    ],
    [
      'The four-sided stone, far out where the ground feels empty.',
      '"YOUR LIGHT BURNS. THE FAR DARK EATS IT. THE LITTLE LIGHTS ARE PIECES OF THE SUN."',
      'The fourth side has words on it now: "YOU CAME BACK OUT THIS FAR, SO YOU MADE IT HOME LAST TIME. WELL DONE. THAT IS THE HARD PART."',
    ],
    [
      'The four-sided stone. Three of its sides say what they always say.',
      '"YOUR LIGHT BURNS. THE FAR DARK EATS IT. THE LITTLE LIGHTS ARE PIECES OF THE SUN."',
      '"I DID NOT MAKE THE DARK," says the fourth side. "BUT IT IS MY FAULT THAT IT IS HERE. I WAS TRYING TO SAVE THE SUN WHEN IT BROKE."',
    ],
    [
      'The four sides. You already know what three of them say.',
      '"YOUR LIGHT BURNS. THE FAR DARK EATS IT. THE LITTLE LIGHTS ARE PIECES OF THE SUN."',
      '"THE LIGHT IN MY HANDS IS BURNING DOWN TOO," says the fourth side. "MORE SLOWLY THAN YOURS. BUT I HAVE STARTED COUNTING."',
    ],
    [
      'The four-sided stone, far out past everything.',
      '"YOUR LIGHT BURNS. THE FAR DARK EATS IT. THE LITTLE LIGHTS ARE PIECES OF THE SUN."',
      'The fourth side has been scraped clean and carved again: "THE SUN CAME UP. UNTIL I OPENED MY HANDS, I DID NOT KNOW IF IT WOULD. WALK WHEREVER YOU LIKE."',
    ],
  ],
  // The fourth: water, and that a walk only counts once it is home (DESIGN.md
  // §6). The last of the four and the furthest out, so it is read by somebody
  // who has already learned it the expensive way.
  'stone-4': [
    [
      'A low stone, half sunk into the ground. The letters are worn on one side and sharp on the other.',
      '"YOUR WATER IS HOW FAR YOU CAN GO," it says. "EVERY STEP COSTS A SIP. KEEP HALF OF IT FOR THE WALK HOME."',
      '"EACH COLOUR LETS YOU CARRY MORE WATER: AS SOON AS YOU PICK IT UP, AND FOR GOOD ONCE IT IS HOME."',
      '"GET HOME. A WALK THAT DOES NOT GET HOME DOES NOT COUNT."',
    ],
    [
      'The half-sunk stone. Nobody else has walked here.',
      '"YOUR WATER IS HOW FAR YOU CAN GO. A COLOUR LETS YOU CARRY MORE. GET HOME."',
      '"IF YOU RAN OUT OF WATER OUT HERE," it goes on, "EVERYTHING YOU HAD IS STILL IN A BAG WHERE YOU FELL. GO BACK AND GET IT. NOBODY ELSE WANTS IT."',
    ],
    [
      'The low stone. The carving on the sharp side is slow and careful. You notice that now.',
      '"YOUR WATER IS HOW FAR YOU CAN GO. GET HOME."',
      '"I AM NOT TRYING TO HURT YOU," it says underneath. "IF I WERE, I WOULD HAVE PUT THE WATER MUCH FURTHER APART."',
    ],
    [
      'The furthest of the four stones, half sunk, still telling you to turn around in time.',
      '"YOUR WATER IS HOW FAR YOU CAN GO. GET HOME."',
      '"YOU HAVE FINISHED THREE LANDS," it says. "I CARVED THIS BEFORE ANY OF THEM. I KNEW WHAT IT WOULD SAY. I DID NOT KNOW THAT SOMEONE WOULD REALLY READ IT."',
    ],
    [
      'The last of the four stones, half sunk in the ground.',
      '"YOUR WATER IS HOW FAR YOU CAN GO. GET HOME."',
      'And under it, the lightest carving of all: "YOU ALWAYS DID. THAT IS THE MOST IMPORTANT THING I LEARNED."',
    ],
  ],
};

// --- The tutorial ------------------------------------------------------------
//
// What the tutorial says on the text panel (DESIGN.md §4.13, ui/tutorial.js),
// lesson by lesson, one string per block. Which thing on screen a block points
// at is the scene's business rather than the words', so each list here lines up
// block for block with its row in `POINTS` in ui/tutorial.js — add a block to
// one and add its pointer to the other.
//
// Short on purpose. A first game is for walking, and every block is a tap
// between the player and the next step. Headings and names come in as
// arguments, because the route is worked out of the world rather than written
// down (core/tutorial.js).

export const TUTORIAL = {
  // Out of the hut door, the first time. Read instead of the usual setting-out
  // blocks (`SAY.expeditionStart`), which say the same thing less usefully.
  intro: [
    'This is you. It is dark out here: your candle only lights the tiles right around you.',
    'Behind you is your hut. Come back to it to refill your water and keep what you have found.',
    'Your water. Every step costs one.',
    'If it runs dry, you die out there. Keep an eye on it.',
    'Your candle. It burns down a step at a time too, and when it goes out you walk blind.',
    'Swipe, or tap the arrows, to walk. Hold an arrow down to walk faster.',
  ],
  post: (bearing) => [`A signpost stands a few steps ${bearing.toLowerCase()}. Follow the arrow, and walk into it to read it.`],
  // After the post's own panel has been read.
  postRead: ['Signposts name the landmarks around them, and which way to walk.'],
  chest: (bearing, landmark) => [
    `There is a chest ${bearing.toLowerCase()} of here, on the way to ${landmark}. Walk into it to open it.`,
  ],
  // After the chest's own panel: the rest of the HUD, while there is a coin in
  // it to point at.
  chestOpened: [
    'Your coins. Spend them at a stall.',
    'Next to them, how much ground you have explored.',
    'And up here, the menu: save your game, change the settings, or leave.',
  ],
  landmark: (landmark) => [`Just past the chest stands ${landmark}, a landmark. Walk into it.`],
  // After the landmark's own panel.
  landmarkTouched: ['A landmark gives you something every time you come back. The first visit leaves you something for good.'],
  torch: (bearing) => [
    `Further ${bearing.toLowerCase()} stands a sanctum. Somebody left supplies inside it: pick up a torch.`,
  ],
  equip: [
    'Your lights. Tap the new torch here, then EQUIP.',
    'A bigger light shows you more of the dark, but burns out faster.',
  ],
  gem: ['Now take the gem at the centre of the sanctum.'],
  // The end of it: the gem in hand, and what the rest of the game is.
  end: [
    'A gem: a piece of the broken sun. It gives a colour back to the world, and lets you carry more water.',
    'There are more of them out there. Find them all, and bring them to Nouxinha, who waits in a hall far out in the dark.',
    'But carry this one home first. Nothing you find is yours until the hut has it.',
    'That is the end of the tutorial. You can turn it back on in the settings.',
  ],
  // The status line, when a step off the route is refused: what the arrow is
  // pointing at, and which way it lies.
  offPath: (thing, bearing) => `NOT THAT WAY. ${thing} IS ${bearing}.`,
  // The same, on the one lesson that is about the HUD rather than the ground.
  offPathEquip: 'NOT THAT WAY. EQUIP THE NEW TORCH FIRST.',
  things: {
    post: 'THE SIGNPOST',
    chest: 'THE CHEST',
    torch: 'THE TORCH',
    gem: 'THE GEM',
  },
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
  // A counter with a canopy and nobody behind it — his, standing where a long
  // walk needs somewhere to spend (STORY.md §3). Never "the merchant": there is
  // no one there, and the game should not imply one.
  title: 'THE STALL',
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
      'What the stalls take. The counter shows everything you have banked plus what you are carrying.',
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
    effect: 'The first piece of the sun. You can carry more water, and you will find better things lying around.',
  },
  'gem-2': {
    name: 'SECOND COLOUR',
    effect: 'The second piece of the sun. You can carry even more water, and the stalls start selling the lantern.',
  },
  'gem-3': {
    name: 'THIRD COLOUR',
    effect: 'The third and last piece of the sun in this land. You can carry more water than ever.',
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
  // A death's own drop, never part of the seed (core/rules.js `dropBag`).
  bag: {
    name: 'YOUR BAG',
    effect: 'Everything you were carrying when you fell, waiting where you left it.',
  },
};
