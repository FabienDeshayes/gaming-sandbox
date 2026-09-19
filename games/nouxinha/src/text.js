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
  gemFound: (name) => `YOU FOUND ${name}! SOMEHOW, THINGS ARE LOOKING BRIGHTER AROUND YOU.`,
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
    bell: () => 'THE WELL UNDER IT IS DEEP. YOUR WATER IS FULL.',
    'lantern-tree': (gift) => `${gift.light} BURNS LIKE NEW.`,
    gnomon: () => 'THE DIAL SHOWS YOU THE GROUND YOU CAME OVER.',
    aqueduct: () => 'YOU FOLLOW THE CHANNEL OUT. THE GROUND UNDER IT COMES CLEAR.',
    watchtower: () => 'FROM THE TOP OF IT, YOU CAN CLEARLY SEE AROUND.',
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
  wispAgain: 'STILL BURNING.',
  // The edge, every time after the first — the first bump earns the EDGE dialog.
  edge: 'THE DARK WILL NOT GIVE WAY.',
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
    'Out here, the dark engulfs you. It has been eating your light for a while now and this is where it has eaten all of it.',
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
  title: 'SOMEWHERE ELSE',
  moulded: (n) =>
    `He has guided you across the realm ${n === 1 ? 'once' : `${n} times now`}. You are at your door with a candle and a full reserve of water.`,
  kept: 'He took the gems out of your hands. Your coins, your lights and your items stayed with the land you left. Only you have moved on.',
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
    'HE DID NOT MAKE THE DARK',
    'THE LIGHT WAS ALWAYS SOMETHING YOU HAD TO CARRY',
    'THE HUT HE LEFT STANDING EVERY SINGLE TIME',
    'THANK YOU FOR WALKING BACK',
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
    'You venture out of the hut, and the dark is surrounding you.',
    'You have a candle lit and some water on you, but nothing else.',
    'Explore the land, and bring back colour to the world.',
  ],
  // Opening a chest. Somebody was here before you and left something behind —
  // which is the only story the world tells about itself, so it gets the panel
  // rather than a line in the HUD.
  chestKey: (keyName) => [
    'The lid gives, and layers of dust go up with it.',
    `Inside lies the ${keyName.toLowerCase()}.`,
    'Somewhere out there is a gate cut in the same colour.',
  ],
  chestCoins: (coins) => [
    'The lid gives, and layers of dust go up with it.',
    `Inside is a hoard of ${coins} coins.`,
    'Nobody will ask where you got them.',
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
    'A small light, alone out here, burning on nothing you can see.',
    "It isn't yours, and it wasn't lit for you. It was already burning when you found it, and it will keep burning after you go.",
  ],
  // A carved stone, read by walking into it (DESIGN.md §4.12). Which of the
  // five cuts of it you get is how many kinds of world this campaign has
  // already finished — the same count the hall reads (`SAY.hall` above) — and
  // a campaign past the end of the table reads the last of them for good.
  stone: (id, finished) => STONE_TEXT[id][Math.min(finished, STONE_TEXT[id].length - 1)],
  signpost: (lines, hutLine) => [
    'A post, leaning, with the ground trodden down around it.',
    lines.length > 1
      ? 'One of its three arms is a blank panel. The other two have names burned into the wood.'
      : 'One of its three arms is gone outright. Another is a blank panel. The last has a name burned into the wood.',
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
    'As expected, Nouxinha awaits you in the hall, hands slightly opened.',
    '"Four," he says. "Four lands, walked all the way to the end, and every colour out of every one of them carried back to me. There is nowhere left I could put you down that you have not already finished."',
    'He takes the last gems from you. The pieces you carried are in between his fingers, and a pure light seems to emerge from it.',
    '"It is whole," he says. "I have been holding it together since before you were woken. What is left is to stop."',
    'He looks down at his hands and slowly opens them. A flashing light starts to appear, powerful and warm at the same time.',
    '"You kept coming back," he says. "Nobody has ever kept coming back. Thank you. Stand where you are — this will be bright."',
    'And he opens his hands fully, and the colour claimed back the land.',
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
    'In the middle of the hall, there is a man standing in front of you, with his hands closed and strangely shining.',
    '"I am Nouxinha," he says, as though you had asked for his name. "You have come a long way, and not for the first time — though you would not remember that."',
    gems >= max
      ? '"All three. Good — they are flakes off what I am holding, and my hands are rather full."'
      : gems
        ? `"${gems === 1 ? 'One' : 'Two'} of three. I will need more before you can move on to the next land."`
        : '"Empty-handed. That is a long walk for a conversation, but I am glad for it."',
    'He takes what you are carrying out of your hands, one piece at a time, and you let him.',
    '"The sun was dying before I put my hands on it," he says. "I can\'t heal it without those gems of colour. Now, go home and rest."',
    'He puts a hand out, and the land goes out from under you. What comes back is somewhere else entirely — and your own door is behind you.',
  ],
  (gems, max) => [
    'The hall again, and the same man, with his hands shining strangely.',
    '"I am Nouxinha," he says. "Which you knew. You walked one of my worlds all the way to the end, and something of it stayed on you — that is new."',
    gems >= max
      ? '"All three again, and faster. You are learning the shape of what I build."'
      : gems
        ? `"${gems === 1 ? 'One' : 'Two'} of three, this time. You came anyway. Last time you came with everything, and I am not going to ask."`
        : '"Nothing in your hands at all. You came the whole way to look at me. I would have, in your place."',
    'He takes what you have, one piece at a time, and he is careful about your hands.',
    '"You will be back," he says, with no weight on it whatsoever. "Go home and rest."',
    'He carries you, and not one thing you were carrying. What comes back around you is a different kind of dark, and your own door is behind you.',
  ],
  (gems, max) => [
    'The hall stands in the third clearing of its kind you have walked into.',
    '"Two of them finished, and here is the next," Nouxinha says. "I keep the count as well. Not that I can do much else from here."',
    gems >= max
      ? '"All three. You do this well now — better than I expected."'
      : gems
        ? `"${gems === 1 ? 'One' : 'Two'} of three. You are not here for the fetching any more, are you."`
        : '"Empty-handed, and you knew you would be before you set out. So this is a visit."',
    'He gathers the gems in. Somehow you get a glimpse of an incredible source of light between his fingers.',
    '"You are looking at my hands," he says. "You will see soon, hopefully. Go home."',
    'He sets you down in another land, with nothing in your pockets, and your own door is behind you.',
  ],
  (gems, max) => [
    'The clearing, the hall, the man — the third time you have arrived already knowing what all three of them are.',
    '"You explored three kinds of lands," he says. "There is one left that you have not finished."',
    gems >= max
      ? '"All three. Of course. You have not missed a set since the first world."'
      : gems
        ? `"${gems === 1 ? 'One' : 'Two'} of three. Not this time, then. Neither of us is in a hurry."`
        : '"Nothing. Good — sit down. Or not. Come back once you\'ve found the gems."',
    'He takes what there is. The light in his hands is brighter than it was the first time you stood here.',
    '"Go on," he says. "Finish it. I will be standing in the last one."',
    'He carries you across, for what you both know is the last time but one.',
  ],
  (gems) => [
    'The clearing, and the hall, and him in front of it as though the sun had never come up over any of this.',
    '"You know how it goes now," he says. "I carry, you walk. I never minded the walking."',
    gems
      ? '"And you brought colour with you, out of habit. Very nice."'
      : '"And nothing in your hands, which is the honest way to arrive."',
    'He takes what you have and sets it down beside him, where the light already is.',
    '"Again, then," he says. "You know the way."',
    'He carries you over. He always does. Your own door is behind you.',
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
  aqueduct: {
    name: 'THE AQUEDUCT',
    standing: 'YOU CARRY MORE THAN YOU DID',
    met: [
      'A line of dry stone arches, striding out of the dark on one side and stopping in mid-air on the other.',
      'The channel cut along the top of it is smooth as a bone and has not been wet in a very long time. It was carrying water somewhere, from somewhere, for somebody.',
      'You stand in the shade of an arch and work out what a person actually needs. You will carry more of it than you did.',
    ],
    again: [
      'The arches again, striding out of a dark they were not standing in yesterday.',
      'You follow the channel with your eye, and the ground under it comes clear.',
    ],
  },
  watchtower: {
    name: 'THE WATCHTOWER',
    standing: 'THE DARK TAKES YOUR LIGHT LATER',
    met: [
      'A tower with no door at the bottom, nothing at all at the top, and a stair going up the outside of it.',
      'You climb. The rail at the top is worn to a shine on one side, by somebody who stood up here a great deal, watching a dark that never once changed.',
      'You look a long way out and something in you stops flinching from it. The dark will have to come closer than that before it starts eating your light.',
    ],
    again: [
      'The tower again, standing over country it was not standing over yesterday.',
      'You go up, and the ground lays itself out underneath you.',
    ],
  },
  weighhouse: {
    name: 'THE WEIGHHOUSE',
    standing: 'NOBODY PUTS A FALSE PRICE ON YOU AGAIN',
    met: [
      'A stone shed open on three sides, with a balance in it big enough to weigh a loaded cart.',
      'One pan is heaped with blanks and the other is empty, and the beam is dead level between them. Somebody weighed nothing against nothing, and cut the answer into the beam.',
      'You read the tables down the length of it. Nobody puts a false price on you again, in this world or any other.',
    ],
    again: [
      'The balance again, level, in a shed that was not standing here yesterday.',
      'There is something on the empty pan. There always is.',
    ],
  },
  // The four that are only one world's (DESIGN.md §4.10.3). No gift, no
  // standing, and no line about what you take, because you take nothing: what
  // these hand over is that somebody was here doing something ordinary, and
  // stopped.
  plough: {
    name: 'THE PLOUGH',
    met: [
      'A plough, standing in the middle of a furrow, with the share still down in the ground.',
      'The furrow runs nine paces behind it and stops. Whoever was walking after this let go of it between one step and the next.',
      'There is nothing to take and nothing to read. It is only that somebody was going to finish this.',
    ],
    again: [
      'The plough again, in the same unfinished furrow, in ground that has never been broken.',
    ],
  },
  washing: {
    name: 'THE LINE OF WASHING',
    met: [
      'Two posts, a line strung between them, and a wash hung out on it — frozen through, and hanging perfectly still.',
      'You put a hand against one of them and it does not give at all. It is holding the shape some wind left it in.',
      'They are your size. There is nothing here to take.',
    ],
    again: [
      'The line again, hung with the same frozen wash, in a cold it has not been standing out in.',
    ],
  },
  caravan: {
    name: 'THE CARAVAN',
    met: [
      'A line of pack-frames standing in order, roped one to the next, every one of them still loaded.',
      'No animals. No people. Nothing dropped and nothing scattered and nothing forced: the knots are all sound and every load is square.',
      'They were walking somewhere in good order, and then they were not walking.',
    ],
    again: [
      'The caravan again, roped and loaded and going nowhere, in sand it has never crossed.',
    ],
  },
  'second-hut': {
    name: 'THE SECOND HUT',
    met: [
      'A hut. Your hut — the same door, the same lean in it, the same stone set against it to hold it open.',
      'Your things are inside, in the places you leave them. The tank is dry, the hearth is cold, and the dust lies thick and even over all of it.',
      'You do not go in. There is nothing in there that is not already yours.',
    ],
    again: [
      'The hut again, still yours, still cold, standing on ground you have never lived on.',
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
      'A block of stone standing on end, dressed flat on the side facing your hut, with lettering cut deep enough to read with a hand.',
      '"THREE COLOURS ARE SHUT IN THIS WORLD," it says. "THEY ARE BEHIND WALLS, AND THE WALLS HAVE DOORS, AND THE DOORS WANT KEYS AND NOT COLOURS."',
      '"BRING THEM TO THE HALL. THE HALL IS THE LAST OF THE FOUR AND THERE IS NO HOARD IN IT."',
      'Lower down, smaller, cut by the same hand on a different day: "NOTHING IN YOUR HANDS IS YOURS UNTIL YOUR OWN DOOR IS BEHIND YOU."',
    ],
    [
      'The stone again — the same block, the same flat face, and the ground around it is nowhere you have ever been.',
      '"THREE COLOURS. YOU KNOW THIS ONE," it says. "THERE IS ONE OF THESE OUTSIDE EVERY DOOR I HAVE EVER WOKEN ANYBODY BEHIND. I CUT THEM ALL. IT IS AN HOUR\'S WORK APIECE AND I HAVE NOTHING BUT HOURS."',
      '"WALK FURTHER THIS TIME. THE FIRST COLOUR IS NEVER FAR, AND IT IS NOT WHAT YOU CAME FOR."',
    ],
    [
      'The doorstep stone, standing where one always stands, which is the first thing about this place you recognised.',
      '"TWO KINDS OF WORLD FINISHED," it says. "I CUT THAT IN AFTERWARDS. I KEEP THE COUNT AS WELL."',
      '"THREE COLOURS, THEN, AND THE SAME WALK. YOU WILL FIND IT SHORTER THAN YOU REMEMBER. THAT IS YOU, NOT THE GROUND."',
    ],
    [
      'The stone, the flat face, the hand you could pick out of a hundred hands by now.',
      '"THREE COLOURS," it says, "AND I AM AWARE OF HOW THIS LOOKS. I TAKE THEM OUT OF YOUR HANDS AND THEN I PUT YOU DOWN SOMEWHERE THERE ARE THREE MORE, IN FRONT OF A STONE I CUT BEFORE EITHER OF US WAS TIRED."',
      '"ONE PLACE LEFT THAT YOU HAVE NOT WALKED OUT OF. GO AND FINISH IT. I WOULD RATHER YOU DID NOT, AND I HAVE CUT YOU THE DIRECTIONS ANYWAY."',
    ],
    [
      'The stone still stands, and the instructions on it are no use to either of you now.',
      '"THREE COLOURS ARE SHUT IN THIS WORLD," it says, because that is what it has always said.',
      'Under it, cut shallow and recently, in a hand that is not steady: "AND YOU KNOW THE WAY. WALK IT IF YOU WANT TO. I AM GLAD OF THE COMPANY."',
    ],
  ],
  // The second: gates, keys and the named places, which is the one chain in the
  // game a player can walk past without ever working out (DESIGN.md §4.8).
  'stone-2': [
    [
      'A stone, waist high, with the face turned away from your hut — cut for somebody already on their way out.',
      '"A DOOR IN A RING WALL WANTS ITS KEY," it says. "A KEY IS IN A BOX, AND A BOX IS A FEW PACES OFF SOMEWHERE WITH A NAME."',
      '"SO WALK TO THE NAMES. THE POSTS ARE FULL OF THEM, AND THE NAMED PLACES PAY YOU FOR ARRIVING WHETHER OR NOT THERE IS A BOX BESIDE THEM."',
    ],
    [
      'The second stone, facing out, with the same three lines and one more under them.',
      '"A DOOR WANTS ITS KEY. THE KEY IS IN A BOX BESIDE A NAMED PLACE. THE POSTS KNOW THE NAMES."',
      '"WHAT YOU LEARN AT A NAMED PLACE, YOU KEEP," the new line says. "I CANNOT GET AT IT. I HAVE TRIED, AND I AM TELLING YOU BECAUSE IT IS THE ONLY GOOD NEWS I HAVE."',
    ],
    [
      'The stone facing out into the dark, in the third place of its own you have read it in.',
      '"THE DOORS, THE KEYS, THE BOXES, THE NAMES," it says. "YOU HAVE THIS. I AM LEAVING IT UP FOR THE SAME REASON A MAN SWEEPS A FLOOR NOBODY WALKS ON."',
      '"THE NAMES REPEAT AND THE PLACES DO NOT, UNDERSTAND. I BUILT ONE OF EACH IN EVERY PART OF THIS REALM, A VERY LONG TIME AGO, WHEN THERE WAS LIGHT TO BUILD BY."',
    ],
    [
      'The second stone, and by now you read it the way you read a letter from somebody who writes too often.',
      '"KEYS, BOXES, NAMES," it says. "THERE IS ALSO ONE PLACE IN EVERY WORLD I DO NOT BUILD AND CANNOT MOVE. IT IS DIFFERENT IN EVERY KIND OF WORLD AND NO POST HAS ITS NAME ON IT."',
      '"IF YOU FIND IT, STAND THERE A MOMENT. IT WILL GIVE YOU NOTHING. IT WAS NOT PUT THERE FOR GIVING."',
    ],
    [
      'The stone, still facing out, still telling a walker where the keys are.',
      '"KEYS, BOXES, NAMES," it says, and then, cut afterwards and close underneath:',
      '"THE PLACE THE GROUND KEEPS TO ITSELF IS STILL OUT THERE. IT WAS NEVER MINE. THAT IS WHY IT IS STILL THERE."',
    ],
  ],
  // The third: light, and the dark that eats it (DESIGN.md §4.1, §4.7). Cut far
  // enough out that a campaign reading it has met both.
  'stone-3': [
    [
      'A stone out where the ground stops being anywhere in particular, cut on all four faces.',
      '"WHAT YOU CARRY BURNS," the first face says. "ONE STEP IS ONE STEP OF IT. THERE IS NO RATIONING IT AND NO PUTTING IT OUT."',
      '"FURTHER OUT THAN THIS THE DARK STOPS GIVING WAY AND STARTS TAKING," the second says. "IT EATS YOUR LIGHT A TILE AT A TIME UNTIL THERE IS NOTHING TO EAT. WALK BACK IN AND IT IS AS BRIGHT AS IT EVER WAS."',
      '"THE LITTLE ROUND LIGHTS ARE NOT MINE AND NOT YOURS," says the third. "THEY BURN ON THEIR OWN ACCOUNT. USE THEM."',
      'The fourth face is blank.',
    ],
    [
      'The four-faced stone, out where the ground stops being anywhere in particular.',
      '"WHAT YOU CARRY BURNS. THE FAR DARK EATS IT. THE LITTLE ROUND LIGHTS ARE NOBODY\'S."',
      'The fourth face has a line on it now: "YOU CAME BACK OUT THIS FAR, WHICH MEANS YOU CAME HOME LAST TIME. GOOD. THAT IS THE HARD HALF."',
    ],
    [
      'The stone with four faces, three of them the same as ever.',
      '"WHAT YOU CARRY BURNS. THE FAR DARK EATS IT. THE LITTLE LIGHTS ARE NOBODY\'S."',
      '"I DID NOT MAKE THE DARK," the fourth face says. "I MADE IT NECESSARY. THERE IS A DIFFERENCE AND I AM THE ONLY ONE IT MATTERS TO."',
    ],
    [
      'The four faces, and you already know what three of them say.',
      '"WHAT YOU CARRY BURNS. THE FAR DARK EATS IT. THE LITTLE LIGHTS ARE NOBODY\'S."',
      '"THE LIGHT IN MY HANDS BURNS TOO," the fourth face says. "SLOWER THAN YOURS. NOT SO MUCH SLOWER THAT I HAVE STOPPED COUNTING."',
    ],
    [
      'The stone, four faces, out past everything.',
      '"WHAT YOU CARRY BURNS. THE FAR DARK EATS IT. THE LITTLE LIGHTS ARE NOBODY\'S."',
      'The fourth face has been cut back to bare rock and written on once more: "IT CAME UP. I DID NOT KNOW UNTIL I OPENED MY HANDS WHETHER IT WOULD. WALK WHERE YOU LIKE."',
    ],
  ],
  // The fourth: water, and that a walk only counts once it is home (DESIGN.md
  // §6). The last of the four and the furthest out, so it is read by somebody
  // who has already learned it the expensive way.
  'stone-4': [
    [
      'A low stone, half sunk, with the lettering worn shallow on the weather side and sharp on the other.',
      '"YOUR WATER IS YOUR DISTANCE," it says. "EVERY STEP IS A MOUTHFUL. HALF OF WHAT YOU CARRY IS THE WALK BACK, AND IT IS THE HALF PEOPLE SPEND."',
      '"A COLOUR RAISES WHAT YOU CAN CARRY THE MOMENT IT IS IN YOUR HAND, AND KEEPS IT RAISED ONCE IT IS HOME. THAT IS THE OTHER THING A COLOUR IS FOR, AND NOBODY IS TOLD IT."',
      '"GET HOME. A WALK THAT DOES NOT GET HOME DID NOT HAPPEN."',
    ],
    [
      'The half-sunk stone, and the ground around it trodden by nobody.',
      '"YOUR WATER IS YOUR DISTANCE. A COLOUR MAKES THE TANK DEEPER. GET HOME."',
      '"YOU HAVE DIED OF THIRST BY NOW, OR YOU HAVE NEARLY," it goes on. "IF YOU DID, WHAT YOU WERE CARRYING IS STILL LYING ON THE TILE YOU LAY DOWN ON. IT KEEPS. NOTHING OUT HERE WANTS IT."',
    ],
    [
      'The low stone, worn on the weather side. The hand on the sharp side is unhurried, which is the thing about it you notice now.',
      '"YOUR WATER IS YOUR DISTANCE. GET HOME."',
      '"I AM NOT TRYING TO KILL YOU," it says underneath. "IF I WERE, THE STONES WOULD SAY SOMETHING ELSE, AND THE WELLS WOULD BE FURTHER APART."',
    ],
    [
      'The furthest of the four, half sunk, still telling you to turn around.',
      '"YOUR WATER IS YOUR DISTANCE. GET HOME."',
      '"THREE PLACES YOU HAVE WALKED OUT OF," it says. "I CUT THIS BEFORE ANY OF THEM, AND I KNEW WHAT IT WOULD SAY, WHICH IS NOT THE SAME AS KNOWING SOMEBODY WOULD BE STANDING HERE READING IT."',
    ],
    [
      'The last of the four, sunk in ground as dark as it has ever been, which neither of you is going to mention.',
      '"YOUR WATER IS YOUR DISTANCE. GET HOME."',
      'And under it, the shallowest cutting on any of the four: "YOU ALWAYS DID. THAT IS THE WHOLE OF WHAT I LEARNED, AND IT TOOK ME EVERYTHING I WAS HOLDING."',
    ],
  ],
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
  // A death's own drop, never part of the seed (core/rules.js `dropBag`).
  bag: {
    name: 'YOUR BAG',
    effect: 'Everything you were carrying when you fell, waiting where you left it.',
  },
};
