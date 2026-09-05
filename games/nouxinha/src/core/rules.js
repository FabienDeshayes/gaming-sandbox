// Step resolution: legality, durability, burnout/auto-swap, pickup, reveal.
//
// A run's whole state lives in the plain object `createRun` returns, and every
// function here operates on it without touching Phaser — so the entire game can
// be played out in Node by a test, which is how the durability and burnout
// sequencing gets checked.

import { DIRECTIONS, chokeShape, visibleTiles, tileKey } from './light.js';
import {
  BASE_X,
  BASE_Y,
  DEFAULT_SEED,
  beyondEdge,
  biomeOf,
  blocksSight,
  canEnter,
  chebyshev,
  chestAt,
  chests,
  chokeAt,
  coinValue,
  consumableAt,
  entryKey,
  hall,
  isBase,
  isMerchant,
  isSorcerer,
  landmarkAt,
  landmarks,
  pickSeed,
  saltOf,
  sanctumAt,
  sanctums,
  scatterSuccessor,
  scatterTier,
  signpostAt,
  signpostHutBearing,
  signpostReadings,
  signpostTargets,
  signposts,
  sites,
  uniqueAt,
} from './world.js';
import { decodeExplored, encodeExplored } from './cartography.js';
import {
  CHEAT_COINS,
  CHEAT_REVEAL_RADIUS,
  LANDMARK_GIFTS,
  STARTING_LIGHT,
  STARTING_WATER,
  WATER_PER_GEM,
  WATER_PER_STEP,
} from '../balance.js';
import { drawSeed, emptySave, loadSave, MAX_GEMS, normaliseSave, writeSave } from './save.js';
import { ITEMS, itemDef, KEYS, TOOLS } from '../data/items.js';
import { LANDMARK_IDS, landmarkDef, STANDINGS } from '../data/landmarks.js';
import { isOneOff, priceOf } from '../data/shop.js';

export { DIRECTIONS, tileKey };

// The leash: a full tank, widened by every gem carried (balance.js).
export function maxWater(gems) {
  return STARTING_WATER + gems * WATER_PER_GEM;
}

// The hut's other job besides writing a run down (DESIGN.md §4): reaching it
// tops the tank back up, so a run that doubles back can push out again at full
// water. Called by `step` the moment the hut is stood on rather than when its
// question is answered — the water is there whichever way the question goes,
// and a walk that gets home on its last drop has got home. Returns whether it
// actually topped anything up, for the scene to decide whether it is worth
// announcing.
export function refillWater(state) {
  const before = state.water;
  state.water = maxWater(state.gems);
  return state.water > before;
}

// The hut's third job: a walk that reaches it in blackout gets a starting
// light handed back, on arrival, the same as the tank (DESIGN.md §4.7).
// Blackout is a setback rather than a dead end everywhere else in the world
// too, but the hut is the one tile the game promises is always safe — it
// shouldn't be the one place a lightless run is left unable to see. Returns
// whether it actually handed one back, for the scene to decide whether it is
// worth announcing.
export function restockLight(state) {
  if (state.inventory.length > 0) return false;
  state.inventory.push(newLight(STARTING_LIGHT));
  state.activeIndex = 0;
  return true;
}

// What a campaign files "I have walked into the end of the world" under. It
// rides along in the same set as the unique objects the run has laid eyes on
// (`seenUnique`), which is exactly the right shelf for it: knowledge rather
// than loot, written down whichever way the expedition ends, and never worth a
// field of its own in the save.
export const EDGE_SEEN = 'edge';

// And what it files "I have laid eyes on the sorcerer" under, on the same
// shelf: the map marks him once a light has actually reached him, the way it
// marks every other unique thing in the world (DESIGN.md §4.9).
export const HALL_SEEN = 'hall';

// A run's consumables are salted with a nonce so no two expeditions walk the
// same scatter (DESIGN.md §4.3). Tests pass one in to get a world they can
// route through; play draws one.
function drawNonce() {
  return (Math.random() * 0x7fffffff) | 0;
}

// `seed` is what the URL asked for, and is almost always absent: a campaign
// walks the world its slot was given when NEW GAME claimed it (`startSlot` in
// core/save.js), which is what makes three slots three worlds rather than three
// walks across the same one. A slot with no seed of its own is a campaign
// started before slots had worlds, and keeps the one world it has been mapping.
export function createRun(seed, save = loadSave(), nonce, options = {}) {
  // Normalised here rather than trusted: a save arrives off disk, from a test,
  // or from the run that banked it, and a hand-edited one must cost the player
  // their progress at worst — never the run's arithmetic.
  const banked = normaliseSave(save);
  const gems = banked.gems;
  const salted = nonce === undefined ? drawNonce() : nonce | 0;
  const picked = pickSeed(seed === undefined ? banked.seed || DEFAULT_SEED : seed);
  // Ground is the one thing every run inherits, map or no map: what you have
  // already lit stays lit, so a new expedition starts from the edge of the last
  // one instead of from scratch (DESIGN.md §6.1). It is tied to the world that
  // drew it, so a save whose seed no longer matches loses the drawing rather
  // than showing one from a world that isn't there (core/cartography.js).
  const carriesGround = banked.mappedSeed === picked;
  const state = {
    seed: picked,
    // Which kind of world that seed is (DESIGN.md §4.3). Derived rather than
    // carried, so it is the world's own answer and not something a save could
    // disagree with — everything that draws the ground asks the run for it.
    biome: biomeOf(picked),
    // One tile south of the hut, not on it — the hut is a dense sprite of its
    // own, and standing on top of it hid it until the first step off (DESIGN.md
    // §4). Facing further away keeps the hut in view, behind the character.
    x: BASE_X,
    y: BASE_Y + 1,
    facing: 'down',
    steps: 0,
    coins: 0,
    // Gems held, as a count — the sanctum chain hands them out in order, so
    // this doubles as which gates open and how much colour is back (save.js).
    gems,
    // How many worlds this campaign has already had taken off it in the hall
    // (DESIGN.md §4.9). Carried on the run so the HUD can say so without going
    // back to the slot every frame; the slot is where it actually lives.
    cycles: banked.cycles,
    // What was already banked before this run, so the recap can report what
    // this expedition added rather than the running total.
    banked,
    // The two tools, which are neither carried nor consumed: you own one or you
    // don't. Bought at the merchant or found in the dark, and — like a gem —
    // only actually yours once the hut has written it down (DESIGN.md §4.6).
    tools: new Set([
      ...(banked.compass ? ['compass'] : []),
      ...(banked.map ? ['map'] : []),
    ]),
    // The keys, held on exactly the same terms as the tools: found in a chest
    // rather than bought, never consumed, and only the campaign's once the hut
    // has written them down (DESIGN.md §4.8).
    keys: new Set(banked.keys),
    // Which chests this campaign has already opened. Banked with the keys, so a
    // run that opened a chest and then died walks back out to a shut one — the
    // same rule the gem in your pocket lives under.
    chests: new Set(banked.chests),
    // The landmarks stood at in **this** world and the signposts read in it,
    // banked on the same terms as the chests (DESIGN.md §4.10) — and the
    // standings, which are not: those are what the campaign keeps out of a
    // landmark, and the one thing besides `cycles` that survives the hall.
    landmarks: new Set(banked.landmarks),
    posts: new Set(banked.posts),
    standings: new Set(banked.standings),
    // The salt the consumable layer is hashed against. `nonce` is this
    // expedition's, `epoch` counts the times the world has respawned under it.
    nonce: salted,
    epoch: 0,
    salt: saltOf(salted, 0),
    // How many gems the ground currently lying about was laid out for — set
    // once per respawn (`respawn` below) rather than read live off `state.gems`,
    // so a gem picked up mid-expedition never relays or thins what is already
    // on the ground (DESIGN.md §4.3). `itemOnTile` is what reads the gap
    // between this and `state.gems` to upgrade, in place, whichever kind the
    // gem retires — the one thing about the ground a gem still changes.
    scatterGems: gems,
    water: maxWater(gems),
    // Every coin this expedition has picked up, banked or not. `coins` is only
    // what is in the pocket right now and empties every time the hut writes it
    // down, so the recap would under-report a walk that came home twice.
    coinsFound: 0,
    // How far out this expedition got, for the recap the hut offers on the way
    // back in — the number DESIGN.md §6 calls the real score.
    furthest: 0,
    // Everything picked up this run, by item id, including lights that have
    // since burned out. The inventory alone can't tell that story.
    found: {},
    // Lights, in pickup order. Auto-swap on burnout walks this order. Two of
    // them for a campaign that has stood at the Lantern Tree: that standing is
    // exactly "you never set out with one light again" (DESIGN.md §4.10), and
    // it is the only thing in the game that changes what a run walks out with.
    inventory: banked.standings.includes(standingOf('lantern-tree'))
      ? [newLight(STARTING_LIGHT), newLight(STARTING_LIGHT)]
      : [newLight(STARTING_LIGHT)],
    activeIndex: 0,
    // Tiles ever lit. The only thing about the world a run has to remember —
    // terrain and items are both re-derived from the seed. A run opens with
    // everywhere the slot has ever been already drawn.
    explored: carriesGround ? decodeExplored(banked.mapped) : new Set(),
    // Which unique objects have been laid eyes on, for the map's markers.
    seenUnique: new Set(carriesGround ? banked.seen : []),
    // Consumable tiles this run has emptied *this epoch*, so a pickup doesn't
    // come straight back. Cleared whenever the world respawns.
    collected: new Set(),
    // A cheat run is a sandbox for looking at the late game, and it is walled
    // off from the save slots: nothing it does is ever written (`bankRun`,
    // `rememberGround`), because a run handed three gems is not a campaign.
    cheats: !!options.cheats,
    // The landmark or post last bumped with no successful step since, so a
    // second bump on the same one while still standing against it reads as the
    // same visit — never saved, and reset by `resumeRun` losing it for free.
    lastBump: null,
    // Where a walk out of this slot died and left everything it was carrying
    // (`dropBag` below), or null for a slot with nothing waiting to be picked
    // back up. Tied to the seed it was dropped in — a world the hall has
    // moulded since has no tile that used to be that spot.
    bag: banked.bag && banked.bag.seed === picked ? banked.bag : null,
  };
  if (state.cheats) applyCheats(state);
  // How much ground the slot had already drawn before this expedition took a
  // step, so the recap can report what *this* walk added rather than the
  // campaign's running total (DESIGN.md §6).
  state.startExplored = state.explored.size;
  reveal(state);
  return state;
}

// --- Cheats ------------------------------------------------------------------
//
// One toggle in Settings, for looking at what the late game actually does
// without walking to it (DESIGN.md §6.2): every colour recovered, one of every
// light and both tools in hand, a purse the merchant can't exhaust, and the
// ground already drawn out past the furthest sanctum.
//
// It reveals rather than lights: the world is drawn from memory, the same
// dimmed ground a real expedition leaves behind, so what a cheat run looks at
// is what a long campaign would have looked at.

function applyCheats(state) {
  state.gems = MAX_GEMS;
  state.scatterGems = MAX_GEMS;
  state.water = maxWater(state.gems);
  state.coins = CHEAT_COINS;
  for (const id of TOOLS) state.tools.add(id);
  // Every key, so every gate stands open — the chests themselves are left shut,
  // because a sandbox for looking at the late game should still have one to open.
  for (const id of KEYS) state.keys.add(id);

  // One of every light, longest leash first, so the run starts under the widest
  // shape in the game and can still equip its way down the list.
  const lights = Object.values(ITEMS)
    .filter((def) => def.isLight)
    .sort((a, b) => b.maxDurability - a.maxDurability);
  state.inventory = lights.map((def) => newLight(def.id));
  state.activeIndex = 0;

  for (let y = -CHEAT_REVEAL_RADIUS; y <= CHEAT_REVEAL_RADIUS; y++)
    for (let x = -CHEAT_REVEAL_RADIUS; x <= CHEAT_REVEAL_RADIUS; x++)
      state.explored.add(tileKey(x, y));
  for (const sanctum of sanctums(state.seed)) if (sanctum.gem) state.seenUnique.add(sanctum.gem);
  for (const site of sites(state.seed)) state.seenUnique.add(site.id);
  for (const chest of chests(state.seed)) state.seenUnique.add(chest.id);
  // Every landmark laid eyes on and every standing in hand, so a sandbox run
  // sees the world the way a campaign four cycles in would — coloured. The
  // landmarks themselves are left untouched, for the same reason the chests are
  // left shut: there should still be something to walk to.
  for (const landmark of landmarks(state.seed)) state.seenUnique.add(landmark.id);
  for (const standing of STANDINGS) state.standings.add(standing);
}

// Everything on the ground goes back, in new places. This is what a stop at
// the hut does (DESIGN.md §4.3): the salt moves, so the scatter is relaid at
// however many gems the run now holds, and nothing this run has already
// emptied stays empty.
export function respawn(state) {
  state.epoch += 1;
  state.salt = saltOf(state.nonce, state.epoch);
  // The ground catches up to what the run is holding right here — the one
  // moment `itemOnTile`'s frozen layer is allowed to move (see `createRun`).
  state.scatterGems = state.gems;
  state.collected.clear();
  // Nothing materialises under the character's feet — the tile they are
  // standing on stays bare until they step off it and come back.
  state.collected.add(tileKey(state.x, state.y));
  return state.epoch;
}

function newLight(id) {
  const def = itemDef(id);
  return { id, durability: def.maxDurability };
}

export function activeLight(state) {
  return state.inventory[state.activeIndex] || null;
}

// Groups the flat, pickup-ordered inventory by item id for display, so a run
// carrying several of the same light shows one stack instead of one slot per
// copy. The model itself stays flat — burnout, auto-swap, and `equip` all
// index into `state.inventory` directly by position — so each instance keeps
// its original flat index for `equip` to use.
export function inventoryStacks(state) {
  const stacks = [];
  const byId = new Map();
  state.inventory.forEach((slot, index) => {
    let stack = byId.get(slot.id);
    if (!stack) {
      stack = { id: slot.id, instances: [] };
      byId.set(slot.id, stack);
      stacks.push(stack);
    }
    stack.instances.push({ index, durability: slot.durability, isActive: index === state.activeIndex });
  });
  return stacks;
}

// The shape currently lighting the world — null once every light is spent,
// which `visibleTiles` reads as blackout, and narrowed by however much the dark
// at the edge of the world is eating at this tile (DESIGN.md §4.7). The choke
// is a property of where you are standing, not of the light: walk back in and
// it is as wide as it ever was.
export function activeShape(state) {
  const light = activeLight(state);
  return light ? chokeShape(itemDef(light.id).shape, chokeAt(state.x, state.y)) : null;
}

export function isBlackout(state) {
  return activeLight(state) === null;
}

// Equips a carried light. Costs no step — the game is turn-based on movement only.
export function equip(state, index) {
  if (index < 0 || index >= state.inventory.length) return false;
  state.activeIndex = index;
  reveal(state);
  return true;
}

// Whether a unique object is already the player's — a gem they hold, a tool they
// own. Unique objects aren't tracked in `collected`, because unlike a coin they
// are gone for good rather than until the next respawn.
export function uniqueTaken(state, id) {
  const def = itemDef(id);
  if (!def) return true;
  if (def.gem) return def.gem <= state.gems;
  if (def.tool) return state.tools.has(id);
  return false;
}

// A kind lying settled on the ground, upgraded in place for however many
// gems the run holds *right now* — water-drop becomes water-flask the moment
// a run picks up the first gem, in exactly the spot the drop was already
// sitting in, without the tile ever being asked what else it might have held
// (`scatterSuccessor` in core/world.js).
function upgraded(id, gems) {
  let current = id;
  for (;;) {
    const next = scatterSuccessor(current);
    if (!next || scatterTier(next) > gems) return current;
    current = next;
  }
}

// The item lying on a tile for this run: a bag this run can walk back to
// first, then the unique layer, which no respawn ever moves, then whatever
// the current scatter put there.
export function itemOnTile(state, x, y) {
  if (state.bag && state.bag.x === x && state.bag.y === y) return 'bag';
  const unique = uniqueAt(x, y, state.seed);
  if (unique) return uniqueTaken(state, unique) ? null : unique;
  if (state.collected.has(tileKey(x, y))) return null;
  // The ground settles at `scatterGems`, frozen since the run's last respawn,
  // so a gem picked up mid-expedition never relays or thins what is already
  // lying about (DESIGN.md §4.3) — everything already out there is enough for
  // a full refill on its own. The one thing a gem still does to it is let the
  // tier it just unlocked take over the exact tiles the kind it replaces was
  // already sitting on, which is the "new category, nowhere else visible
  // before" a gem is supposed to bring in.
  const settled = consumableAt(x, y, state.seed, state.salt, state.scatterGems);
  if (!settled) return null;
  // A sanctum's own hoard is fixed at what the sanctum was built holding and
  // never upgrades with a gem the way the open world's ground does (DESIGN.md
  // §4.4) — the swap above is the open world's rule alone.
  const inSanctum = sanctumAt(x, y, state.seed);
  return inSanctum && inSanctum.part === 'inside' ? settled : upgraded(settled, state.gems);
}

// Whether a step onto this tile is legal for the keys this run is carrying:
// floor always, a gate only once you hold the key it wants (DESIGN.md §4.8).
export function canStepOnto(state, x, y) {
  return canEnter(x, y, state.seed, state.keys);
}

// --- Chests ------------------------------------------------------------------
//
// A chest is the one thing in the world you interact with by *failing* to walk
// onto it. It stands on its own tile, can't be stepped on and doesn't cast a
// shadow; bumping into it lifts the lid, once, and after that it is scenery.
//
// What it held goes into the run, not onto the ground: a key joins the keys, a
// hoard of coins joins the pocket. Both are only the campaign's once the hut has
// written them down, which is what makes `chests` a banked set rather than a
// permanent one — die on the way home and the lid is shut again next time.

// The chest standing on a tile and whether this run has already opened it, or
// null where there is no chest there.
export function chestOnTile(state, x, y) {
  const site = chestAt(x, y, state.seed);
  if (!site || site.part !== 'site') return null;
  return { chest: site.chest, opened: state.chests.has(site.chest.id) };
}

// Lifts the lid. Returns what was inside — or `{ already: true }` for a chest
// this campaign has been to before, because a chest that has been opened does
// nothing at all rather than refilling.
export function openChest(state, chest) {
  if (state.chests.has(chest.id)) return { already: true, key: null, coins: 0 };
  state.chests.add(chest.id);
  if (chest.key) {
    state.keys.add(chest.key);
    state.found[chest.key] = (state.found[chest.key] || 0) + 1;
    return { already: false, key: chest.key, coins: 0 };
  }
  state.coins += chest.coins;
  state.coinsFound += chest.coins;
  return { already: false, key: null, coins: chest.coins };
}

// --- Landmarks and signposts --------------------------------------------------
//
// A landmark is walked into rather than onto, exactly like a chest, and what it
// hands over comes in two tiers that are easy to confuse and must not be
// (DESIGN.md §4.10):
//
//   a **gift**    — every fresh touch, in this world or any other. An in-run
//                   effect like a pickup: coins, water, a relit torch, ground
//                   revealed. Lost with the run, like any pickup, but earned
//                   back the moment you walk up to the landmark again.
//   a **standing** — once per *campaign*, the first time you ever touch it.
//                   Banked at the hut with everything else that is real, and
//                   then kept through every world the hall moulds after.
//
// The standing is banked rather than held: a landmark walked to on a run that
// dies is a landmark the campaign has not been to, and it has to walk back out
// to it.

// The standing a landmark hands over, by landmark id — the two tables meeting.
function standingOf(id) {
  const def = landmarkDef(id);
  return def ? def.standing : null;
}

// Whether this campaign holds a landmark's standing. Takes the landmark's id
// rather than the standing's, because everything that asks is asking about a
// place: does the map know the stall, does the bell carry, is there a second
// candle in the pack, does the HUD count how far out you are.
export function hasStanding(state, id) {
  const standing = standingOf(id);
  return !!standing && state.standings.has(standing);
}

// Every standing the campaign holds, for the screens that list what it knows.
export function standings(state) {
  return LANDMARK_IDS.filter((id) => hasStanding(state, id));
}

// The landmark standing on a tile and whether this run has already touched it
// **in this world**, or null where there is no landmark there.
export function landmarkOnTile(state, x, y) {
  const at = landmarkAt(x, y, state.seed);
  if (!at || at.part !== 'site') return null;
  return { landmark: at.landmark, touched: state.landmarks.has(at.landmark.id) };
}

// What a landmark hands over on the touch itself (balance.js `LANDMARK_GIFTS`).
// Applied to the run and reported back, so the scene can say what happened
// without working it out a second time.
function giveGift(state, id) {
  const gift = LANDMARK_GIFTS[id] || {};
  const given = { coins: 0, water: false, relit: false, revealed: 0 };

  if (gift.coins) {
    state.coins += gift.coins;
    state.coinsFound += gift.coins;
    given.coins = gift.coins;
  }
  if (gift.water) {
    state.water = Math.min(maxWater(state.gems), state.water + gift.water);
    given.water = true;
  }
  if (gift.relight) {
    // In blackout there is nothing to relight, so it hands one over instead —
    // the same mercy the hut does, for the same reason (`restockLight`).
    const light = activeLight(state);
    if (light) light.durability = itemDef(light.id).maxDurability;
    else restockLight(state);
    given.relit = true;
  }
  if (gift.reveal) {
    const mark = landmarkAt(state.x, state.y, state.seed);
    const centre = mark ? mark.landmark : { x: state.x, y: state.y };
    for (let dy = -gift.reveal; dy <= gift.reveal; dy++)
      for (let dx = -gift.reveal; dx <= gift.reveal; dx++) {
        const x = centre.x + dx;
        const y = centre.y + dy;
        // Nothing outside the world is ever drawn, here as everywhere else.
        if (beyondEdge(x, y)) continue;
        state.explored.add(tileKey(x, y));
        given.revealed += 1;
      }
  }
  return given;
}

// Whether this bump is a fresh visit rather than the player still standing
// against the same landmark or post: fresh the first time anything is bumped,
// and again the moment a step actually lands somewhere, but not for a second
// bump on the same one before that — which is what keeps a held direction key
// from reopening the text panel once a step for every frame it's held.
function bumpAgain(state, kind, id) {
  const fresh = !(state.lastBump && state.lastBump.kind === kind && state.lastBump.id === id);
  state.lastBump = { kind, id };
  return fresh;
}

// Putting a hand on a landmark. Returns what happened: whether this world had
// already had it off you before, whether this is the first time the
// *campaign* has ever stood here — which is the standing, and the only part
// of it that outlives the world — and what the gift was. The gift lands on
// every fresh touch (`fresh`, from `bumpAgain`) — a direction key held against
// the same bump pays nothing twice, but a real return visit, in this world or
// the next, pays again.
export function touchLandmark(state, landmark, fresh = true) {
  const already = state.landmarks.has(landmark.id);
  state.landmarks.add(landmark.id);
  const standing = standingOf(landmark.id);
  const firstEver = !!standing && !state.standings.has(standing);
  if (firstEver) state.standings.add(standing);
  return { already, firstEver, gift: fresh ? giveGift(state, landmark.id) : null };
}

// The signpost standing on a tile, and whether this world has already been read
// it — the first read gets the panel, every one after it a line in the status
// bar (DESIGN.md §4.10).
export function signpostOnTile(state, x, y) {
  const at = signpostAt(x, y, state.seed);
  if (!at || at.part !== 'site') return null;
  return { post: at.post, read: state.posts.has(at.post.id) };
}

// Reading a post. Nothing about what it says is stored — the readings and the
// hut heading are worked out from where it stands (`signpostReadings` /
// `signpostHutBearing` in core/world.js) — so all this writes down is that it
// has been read, which is what pins the landmark(s) it names on the map for
// the rest of this world.
export function readSignpost(state, post) {
  const first = !state.posts.has(post.id);
  state.posts.add(post.id);
  return {
    first,
    readings: signpostReadings(post, state.seed),
    hutBearing: signpostHutBearing(post),
  };
}

// Which landmarks the map is allowed to mark: the ones a light has actually
// reached, plus any a signpost has pointed the way to. A post is somebody's
// directions, and directions are worth exactly as much as a mark on a map.
export function markedLandmarks(state) {
  const marked = new Set();
  for (const landmark of landmarks(state.seed))
    if (state.seenUnique.has(landmark.id)) marked.add(landmark.id);
  for (const post of signposts(state.seed))
    if (state.posts.has(post.id))
      for (const id of signpostTargets(post, state.seed)) marked.add(id);
  return marked;
}

// Lights everything the active shape covers from where the character stands and
// files it into `explored`. Returns the lit tiles so the renderer can tell
// "lit right now" from "seen once".
export function reveal(state) {
  const lit = litTiles(state);
  for (const { x, y } of lit) state.explored.add(tileKey(x, y));
  noteSeen(state, lit);
  return lit;
}

// The map only marks unique objects the player has actually laid eyes on, so
// buying it never hands them the locations of things they haven't found
// (DESIGN.md §4.6). Checked against the handful of unique objects rather than
// per lit tile, because there are seven of them and up to 49 of those.
function noteSeen(state, lit) {
  const litKeys = new Set(lit.map((tile) => tileKey(tile.x, tile.y)));
  for (const sanctum of sanctums(state.seed))
    if (sanctum.gem && litKeys.has(tileKey(sanctum.centre.x, sanctum.centre.y)))
      state.seenUnique.add(sanctum.gem);
  for (const site of sites(state.seed))
    if (litKeys.has(tileKey(site.x, site.y))) state.seenUnique.add(site.id);
  // A landmark is marked the same way, and is the one marker on that map whose
  // *colour* the campaign had to earn (DESIGN.md §4.10).
  for (const landmark of landmarks(state.seed))
    if (litKeys.has(tileKey(landmark.x, landmark.y))) state.seenUnique.add(landmark.id);
  for (const chest of chests(state.seed))
    if (litKeys.has(tileKey(chest.x, chest.y))) state.seenUnique.add(chest.id);
  const hallOf = hall(state.seed);
  if (hallOf && litKeys.has(tileKey(hallOf.centre.x, hallOf.centre.y)))
    state.seenUnique.add(HALL_SEEN);
}

// What the light actually shows: the shape it reaches, narrowed by the dark at
// the edge (`activeShape`), then cut back to what it can actually see round
// (`blocksSight` — DESIGN.md §4.1). The three compose in that order and only
// here, which is what keeps every renderer and the explored set agreeing on one
// answer.
//
// Tiles outside the world are dropped rather than lit: the dark out there is
// what the light is losing against, so it can never be what the light reveals —
// which is also what keeps them out of the explored set, and so off both maps.
export function litTiles(state) {
  return visibleTiles(activeShape(state), state.x, state.y, state.facing, (x, y) =>
    blocksSight(x, y, state.seed, state.keys)
  ).filter(({ x, y }) => !beyondEdge(x, y));
}

// Burns one durability off the active light. When it hits zero the light is
// spent and removed, and the next light in inventory order auto-equips; with
// nothing left the character is in blackout, which is a setback, not a death.
function burnActiveLight(state) {
  const light = activeLight(state);
  if (!light) return { burnedOut: false, burnedId: null, blackout: true };

  light.durability -= 1;
  if (light.durability > 0) return { burnedOut: false, burnedId: null, blackout: false };

  state.inventory.splice(state.activeIndex, 1);
  // After the splice the same index *is* the next light in order; only when the
  // spent one was last does it wrap round to the start.
  if (state.inventory.length === 0) state.activeIndex = -1;
  else if (state.activeIndex >= state.inventory.length) state.activeIndex = 0;

  return {
    burnedOut: true,
    burnedId: light.id,
    blackout: state.inventory.length === 0,
  };
}

// Applies whatever is lying on a tile and reports it: the item's id, and for a
// coin pile how much it was worth, since that has to be read off the tile before
// a respawn relays the world underneath it.
function collect(state, x, y) {
  const id = itemOnTile(state, x, y);
  if (!id) return null;
  state.collected.add(tileKey(x, y));
  state.found[id] = (state.found[id] || 0) + 1;

  // The bag isn't part of the seed at all, so it doesn't fit the unique/gem/
  // water/light shape every other pickup does — it hands back a whole run's
  // worth of things at once, whatever this run happened to be holding when it
  // went down (`dropBag` below).
  if (id === 'bag') {
    const bag = state.bag;
    state.bag = null;
    state.coins += bag.coins;
    state.coinsFound += bag.coins;
    state.gems = Math.max(state.gems, bag.gems);
    for (const tool of bag.tools) state.tools.add(tool);
    for (const key of bag.keys) state.keys.add(key);
    for (const light of bag.lights) state.inventory.push({ ...light });
    return { id, coins: bag.coins };
  }

  const def = itemDef(id);
  let coins = 0;

  if (id === 'coin') {
    // A coin on the ground is a small pile, and how small is the tile's own
    // business (core/world.js `coinValue`).
    coins = coinValue(x, y, state.seed, state.salt);
    state.coins += coins;
    state.coinsFound += coins;
  } else if (def.tool) {
    state.tools.add(id);
  } else if (def.gem) {
    // A gem is only ever picked up in the order the sanctums hand them out, so
    // the count only ever climbs by one — but take the max anyway rather than
    // incrementing, so nothing can double-count a gem already banked.
    state.gems = Math.max(state.gems, def.gem);
  } else if (def.water) {
    state.water = Math.min(maxWater(state.gems), state.water + def.water);
  } else {
    // Lights arrive unequipped — swapping is the player's call.
    state.inventory.push(newLight(id));
  }
  return { id, coins };
}

// --- The merchant ------------------------------------------------------------
//
// Coins bank at the hut, so what a run can spend is everything it has ever
// banked plus what it is carrying (DESIGN.md §4.5).
export function spendable(state) {
  return state.coins + state.banked.coins;
}

export function canBuy(state, id) {
  const price = priceOf(id);
  if (price === null) return false;
  if (isOneOff(id) && state.tools.has(id)) return false;
  return spendable(state) >= price;
}

export function buy(state, id) {
  if (!canBuy(state, id)) return null;
  const def = itemDef(id);

  // Banked coins go first. What's in your pocket is the half a bad walk home can
  // still cost you, so it's the half worth keeping — and because the hut writes
  // `banked.coins + state.coins`, a run that dies on the way back never wrote
  // the purchase *or* the payment. You lose the goods and keep the money.
  const price = priceOf(id);
  const fromBank = Math.min(state.banked.coins, price);
  state.banked.coins -= fromBank;
  state.coins -= price - fromBank;

  if (def.tool) {
    state.tools.add(id);
  } else if (def.water) {
    state.water = Math.min(maxWater(state.gems), state.water + def.water);
  } else {
    state.inventory.push(newLight(id));
    // Buying a light in blackout is a rescue, so it lights up immediately
    // rather than waiting to be equipped from a screen you can't read.
    if (state.activeIndex < 0) {
      state.activeIndex = state.inventory.length - 1;
      reveal(state);
    }
  }
  return id;
}

// One step in a cardinal direction. Rock and sanctum wall are impassable, and so
// is a gate you don't have the key for and a chest, which is opened by walking
// into it rather than stepped onto: the step is rejected, costs no durability,
// and doesn't change facing. Once water has run out the run is over, so every
// further step is rejected too.
export function step(state, direction) {
  const dir = DIRECTIONS[direction];
  if (!dir) return { moved: false, reason: 'unknown-direction' };
  if (state.water <= 0) return { moved: false, reason: 'dead' };

  const nx = state.x + dir.dx;
  const ny = state.y + dir.dy;
  if (!canStepOnto(state, nx, ny)) {
    // Walking into the sorcerer is how you talk to him (DESIGN.md §4.9), and
    // like a chest it is a bump rather than a step: no water, no durability, no
    // facing. What happens next is not this function's business — the run is
    // over as a run, and `turnCycle` is what the scene calls once he has had
    // his say.
    if (isSorcerer(nx, ny, state.seed)) return { moved: false, reason: 'sorcerer' };
    // Walking into a landmark is how you touch it (DESIGN.md §4.10) — a bump
    // like the chest's and the sorcerer's, costing nothing, because what the
    // step is for is standing here rather than getting anywhere.
    const mark = landmarkOnTile(state, nx, ny);
    if (mark) {
      const fresh = bumpAgain(state, 'landmark', mark.landmark.id);
      return {
        moved: false,
        reason: 'landmark',
        landmark: mark.landmark.id,
        fresh,
        ...touchLandmark(state, mark.landmark, fresh),
      };
    }
    // And walking into a post is how you read it.
    const post = signpostOnTile(state, nx, ny);
    if (post)
      return {
        moved: false,
        reason: 'signpost',
        post: post.post.id,
        fresh: bumpAgain(state, 'signpost', post.post.id),
        ...readSignpost(state, post.post),
      };
    // Walking into a chest is what opens it (DESIGN.md §4.8). The step is still
    // a step that didn't happen — no water, no durability, no facing change —
    // because what moved was the lid.
    const box = chestOnTile(state, nx, ny);
    if (box) {
      const opened = openChest(state, box.chest);
      return { moved: false, reason: 'chest', chest: box.chest.id, ...opened };
    }
    // A shut gate is a different answer from a wall: it tells the player there
    // is something through there and exactly what opens it.
    const needs = entryKey(nx, ny, state.seed);
    if (needs) return { moved: false, reason: 'locked', needs };
    // Walking into the end of the world is not walking into a rock, and the
    // scene says so the first time it happens (DESIGN.md §4.7). Noted on the
    // run's own record of what it has laid eyes on, so the explanation is
    // offered once per campaign rather than once per expedition.
    if (beyondEdge(nx, ny)) {
      const first = !state.seenUnique.has(EDGE_SEEN);
      state.seenUnique.add(EDGE_SEEN);
      return { moved: false, reason: 'edge', firstTime: first };
    }
    return { moved: false, reason: 'blocked' };
  }
  // The gate opening under you is worth a sound and a line, and only the first
  // time: after that it is an arch you walk through (scenes/ExploreScene.js).
  const unlocked = entryKey(nx, ny, state.seed);

  state.x = nx;
  state.y = ny;
  state.facing = direction;
  state.steps += 1;
  state.furthest = Math.max(state.furthest, chebyshev(nx, ny));
  // A step landing anywhere clears the debounce above: the next bump on a
  // landmark or post is a fresh visit, wherever it is.
  state.lastBump = null;

  // Order matters: burn first (so the step you take on your last durability is
  // the one that plunges you into the dark), then pick up — a water-drop
  // picked up on the tile that would have killed you still saves you, the same
  // way a pickup can't light the tile it landed on until it's equipped.
  const burn = burnActiveLight(state);
  state.water = Math.max(0, state.water - WATER_PER_STEP);
  const gemsBefore = state.gems;
  const got = collect(state, nx, ny);
  const picked = got ? got.id : null;

  // Walking back onto the hut puts everything on the ground back, in new
  // places (DESIGN.md §4.3). Done before the reveal, so the light already
  // shows the world it relaid. A gem no longer does this — it leaves the
  // ground exactly as it is and only lets what it unlocked start turning up
  // where the frozen layer had nothing (`itemOnTile`).
  const gemFound = state.gems > gemsBefore;
  const atBase = isBase(nx, ny);
  const respawned = atBase;
  if (respawned) respawn(state);

  // The hut fills the tank the moment you reach it, not when you answer its
  // question — which is also what makes arriving on your last drop of water a
  // walk home rather than a death in the doorway (DESIGN.md §4). Always a real
  // refill, never a no-op: the step onto the hut cost a water like any other, so
  // there is always at least that one to give back.
  if (atBase) refillWater(state);
  const relit = atBase && restockLight(state);

  const lit = reveal(state);

  // Walking back onto the hut is the one moment the run offers to end itself
  // (DESIGN.md §6), so the step that lands there says so.
  return {
    moved: true,
    reason: null,
    picked,
    // A gem landing is the one pickup that changes how the whole screen looks,
    // so the scene gets told rather than having to diff the count itself.
    gemFound: gemFound ? state.gems : 0,
    // How many coins the pile was worth, for the line the HUD flashes.
    // How much the coin pile was worth, for the line the HUD flashes.
    coinsGained: got ? got.coins : 0,
    // Whether this step put everything on the ground back somewhere new.
    respawned,
    relit,
    lit,
    atBase,
    // The key this step turned, for the walk through a gate that was shut until
    // the chest three days back gave it up.
    unlocked,
    atMerchant: isMerchant(nx, ny, state.seed),
    died: state.water <= 0,
    ...burn,
  };
}

// Which gate stands on this tile, what it wants and whether this run can open it
// — the renderer needs all three to draw a gate in the colour of the key that
// opened it. `colour` is that gem's number and is what the tile is painted with;
// it never changes, so a gate you cannot open yet is drawn in the plain
// foreground exactly like the key still sitting in its chest.
export function gateOnTile(state, x, y) {
  const site = sanctumAt(x, y, state.seed);
  if (!site || site.part !== 'gate') return null;
  const { key, colour } = site.sanctum;
  return { needs: key, colour, open: !key || state.keys.has(key) };
}

// Writes down everything the run is carrying that a campaign can keep, and
// leaves the expedition running. **Reaching the hut is what banks a run** — the
// tap afterwards never was (DESIGN.md §6.1). Dying of thirst or leaving by the
// menu still banks nothing, which is what makes the walk home the thing the run
// is about; what it no longer is, is a walk you can complete and then throw away
// by answering a question wrong.
//
// A cheat run banks nothing at all: it was handed its gems rather than walking
// them home, so writing it into a slot would overwrite a campaign with a
// sandbox (DESIGN.md §6.2).
export function depositRun(state) {
  return writeDeposit(state, false);
}

// Ends the expedition, on the hut, having deposited it on the way. The recap is
// what this is for: the writing-down is the same either way, and closing a walk
// down is the only thing this adds to it.
export function bankRun(state) {
  return writeDeposit(state, true);
}

function writeDeposit(state, closing) {
  if (state.cheats) return loadSave();
  const suspended = normaliseSave(loadSave()).run;
  const written = writeSave({
    v: 1,
    // The campaign's world. Rebuilt from scratch here rather than merged onto
    // what is in the slot, so this has to be carried over by hand — a walk home
    // that dropped it would move the campaign to a different world, and take its
    // cartography with it (`mappedSeed` below).
    seed: state.seed,
    gems: Math.max(state.gems, state.banked.gems),
    // `state.coins` is what this run has picked up since it last stood here and
    // `state.banked.coins` what was already banked less anything the merchant
    // took, so this one sum settles both the finds and the shopping (see `buy`).
    coins: state.banked.coins + state.coins,
    // Runs are counted by expeditions finished, not by visits home: a walk that
    // crosses the hut and carries on is still one walk.
    runs: state.banked.runs + (closing ? 1 : 0),
    // Carried over by hand for the same reason the seed above is: this rebuilds
    // the slot from scratch, and the count of worlds the hall has taken is the
    // one number that has to survive every one of them (`turnCycle`).
    cycles: state.banked.cycles,
    furthest: Math.max(state.furthest, state.banked.furthest),
    compass: state.tools.has('compass'),
    map: state.tools.has('map'),
    // The keys, and which chests gave them up. Both are banked here and nowhere
    // else, so a chest opened on a walk that never got home is shut again — with
    // its key back inside it — exactly like a gem left in its sanctum.
    keys: [...state.keys],
    chests: [...state.chests],
    // The landmarks stood at in this world and the posts read in it, banked on
    // exactly the chests' terms — walk to one and die on the way home and you
    // have not been there. The standings are banked here too and taken from
    // here by nothing at all: `turnCycle` carries them over by hand.
    landmarks: [...state.landmarks],
    posts: [...state.posts],
    standings: [...state.standings],
    // Ground is written whichever way a run ends, so this is the same drawing
    // `rememberGround` would have left — banking simply gets there first.
    mapped: encodeExplored(state.explored),
    mappedSeed: state.seed,
    seen: [...state.seenUnique],
    // Whatever this run is still carrying that isn't a bag no death has ever
    // written — reaching the hut banks what's in hand, but it doesn't walk out
    // to a bag sitting unretrieved somewhere else in the world, so that stays
    // exactly as this run found it.
    bag: state.bag,
    // The expedition being over is what clears a suspended walk: a saved run is
    // a walk to carry on with, and this one has come home.
    run: closing ? null : suspended,
  });
  // The run's own books, squared with what is now on disk: nothing it was
  // carrying is at risk any more, so nothing may still read as carried.
  // `runSummary` works out what a death would cost off exactly these two, and
  // `buy` spends the banked half first.
  state.banked = normaliseSave(written);
  state.coins = 0;
  // A suspended walk describes the campaign it belonged to as well as the walk
  // itself, so one left standing across a deposit would hand back the purse from
  // before it. Written again rather than dropped, so LOAD GAME still has the
  // walk to carry on with — and from the hut, which is where it now is.
  return !closing && suspended ? suspendRun(state) : written;
}

// --- The hall ----------------------------------------------------------------
//
// What the fourth sanctum holds instead of a hoard (DESIGN.md §4.9). Walking
// into the sorcerer is a conversation, and the end of the conversation is this:
// he takes the shards out of your hands, and he moulds the world again.
//
// So a cycle is **a new seed inside the same slot**. Everything derived from the
// seed costs nothing to remake — the ground, the sanctums, the chests, the
// stall — and he takes everything the campaign was holding, not just what was
// of that world: the colours, the keys, the lids you left up, the map you
// drew, and the coins and tools you carried home too. What stays is only the
// tally of the campaign itself: the expeditions you have walked, and the
// count of times you have stood here.
//
// Nothing about it is a death. The expedition is over and counted like any
// other, the slot is written, and the run this hands back is a fresh walk out
// of the hut door — in a world nobody has ever lit a tile of.
export function turnCycle(state) {
  const seed = drawSeed();
  // A cheat run is a sandbox and writes nothing at all, here as everywhere else
  // (DESIGN.md §6.2) — it still gets its new world, because looking at what the
  // hall does is exactly what the switch is for.
  if (state.cheats) return createRun(seed, emptySave(), undefined, { cheats: true });
  const written = writeSave({
    ...emptySave(),
    seed,
    cycles: state.banked.cycles + 1,
    // What the campaign keeps out of the four landmarks: he can unmake the
    // ground one was standing in, and he has never found a way to unmake the
    // fact that you have stood there (DESIGN.md §4.10). The landmarks
    // *witnessed* go with the world, like the keys and the lids — the new one
    // has its own four, in new places, to be found again.
    standings: state.banked.standings,
    // The walk to the hall was an expedition, and it ended here rather than at
    // the hut — but it ended, so it counts like every other one.
    runs: state.banked.runs + 1,
    furthest: Math.max(state.furthest, state.banked.furthest),
  });
  return createRun(undefined, written, undefined, { cheats: false });
}

// Writes the ground this run lit back into the slot, and nothing else.
//
// This is what a run that ends without banking still leaves behind (DESIGN.md
// §6.1): leave by the menu's EXIT GAME and the gems, coins and tools in hand are
// all gone, but the dark you lit stays lit, because starting the next
// expedition by re-walking ground you have already crossed is not the tension
// this game is about.
//
// It merges onto whatever is in the slot rather than onto `state.banked`, since
// the run may have spent banked coins at the merchant on a walk it never
// finished — money a run that never got home never actually spent. That merge
// is also what leaves a suspended expedition alone: quitting without saving
// leaves the slot pointing at whatever SAVE GAME last wrote down, which is the
// whole of what "without saving" means.
export function rememberGround(state) {
  if (state.cheats) return loadSave();
  const stored = loadSave();
  return writeSave({
    ...stored,
    seed: state.seed,
    mapped: encodeExplored(state.explored),
    mappedSeed: state.seed,
    seen: [...state.seenUnique],
    // Written explicitly rather than left to `...stored`: a run that walked
    // back to an earlier bag and took it up carries `null` here now, and that
    // has to overwrite the slot's own record of it too.
    bag: state.bag,
  });
}

// What a death leaves on the tile it happened on: everything this run hadn't
// banked, packed up rather than gone for good (DESIGN.md §6). Walking back
// into it is a bump like a chest's, and hands all of it straight back —
// coins and gems the same way a chest's key is held, since the run picking
// it back up is exactly the run that has to walk it home to keep it.
function dropBag(state) {
  return {
    seed: state.seed,
    x: state.x,
    y: state.y,
    coins: state.coins,
    gems: state.gems,
    tools: [...state.tools],
    keys: [...state.keys],
    lights: state.inventory.map((light) => ({ ...light })),
  };
}

// Running dry: the ground is kept exactly as above, and the slot's suspended
// expedition goes with the run it belonged to — but what the run was carrying
// isn't gone, it's in a bag on the tile it fell on.
//
// This is the one place a save is destroyed by playing rather than by choosing
// to (DESIGN.md §6.1). Death is the game's only hard failure, and a save file
// you could reload out of it would make it a rewind instead — so what the
// campaign keeps banked is what it had banked at the hut, and the walk that
// died is gone the same way a walk abandoned mid-expedition always was. What
// it was holding stays out there, the same way a gem or a key already did.
export function abandonRun(state) {
  if (state.cheats) return loadSave();
  return writeSave({ ...rememberGround(state), run: null, bag: dropBag(state) });
}

// --- Suspending and resuming an expedition -----------------------------------
//
// The cogwheel menu's SAVE GAME (DESIGN.md §6.1). Unlike the hut, this banks
// nothing: it writes the expedition down *as it is*, mid-walk, so the same run
// can be picked up later with the gem still in its pocket and still unbanked.
//
// What goes into the slot is a description, not a copy. The world is a pure
// function of `(x, y, seed)` and its scatter of `(seed, salt)`, so seed, nonce
// and epoch put every coin, torch and water drop back exactly where the run
// left them; `collected` says which of those tiles it has already emptied, and
// the gems and tools it is carrying say which of the unique objects are gone.
// Nothing about the world itself is ever stored.
export function suspendRun(state) {
  // A cheat run is a sandbox, not a campaign, and writes nothing at all —
  // including this (DESIGN.md §6.2).
  if (state.cheats) return loadSave();
  const stored = loadSave();
  return writeSave({
    ...stored,
    seed: state.seed,
    // The ground goes in whichever way a run pauses or ends, same as always.
    mapped: encodeExplored(state.explored),
    mappedSeed: state.seed,
    seen: [...state.seenUnique],
    // Same reasoning as `rememberGround`: written explicitly so a bag this run
    // has already taken up doesn't come back out of the slot's old copy of it.
    bag: state.bag,
    run: {
      seed: state.seed,
      x: state.x,
      y: state.y,
      facing: state.facing,
      steps: state.steps,
      water: state.water,
      coins: state.coins,
      coinsFound: state.coinsFound,
      gems: state.gems,
      furthest: state.furthest,
      nonce: state.nonce,
      epoch: state.epoch,
      // What the ground was last laid out for (`itemOnTile`) — carried
      // separately from `gems` because the two can differ mid-expedition, and
      // a resumed walk has to pick up exactly as frozen as it was saved.
      scatterGems: state.scatterGems,
      tools: [...state.tools],
      keys: [...state.keys],
      chests: [...state.chests],
      landmarks: [...state.landmarks],
      posts: [...state.posts],
      standings: [...state.standings],
      inventory: state.inventory.map((light) => ({ ...light })),
      activeIndex: state.activeIndex,
      found: { ...state.found },
      collected: encodeExplored(state.collected),
      startExplored: state.startExplored,
      banked: state.banked,
    },
  });
}

// Whether a slot has an expedition to carry on with, which is what LOAD GAME
// picks between: resuming the walk, or setting out from the hut again.
export function hasSuspendedRun(save = loadSave()) {
  return !!normaliseSave(save).run;
}

// The other side of `suspendRun`: the run it wrote down, walking again. Returns
// null for a slot that has nothing suspended, so the caller can fall back to
// `createRun` — those two are the only two ways a run ever starts.
//
// Note what it doesn't do: no `pickSeed`, because the seed in the block was
// already validated by the run that wrote it, and no fresh nonce, because a
// resumed expedition has to walk out onto the same scatter it left.
export function resumeRun(save = loadSave()) {
  const slot = normaliseSave(save);
  const suspended = slot.run;
  if (!suspended) return null;
  const banked = suspended.banked;
  const carriesGround = slot.mappedSeed === suspended.seed;
  const state = {
    seed: suspended.seed,
    biome: biomeOf(suspended.seed),
    x: suspended.x,
    y: suspended.y,
    facing: suspended.facing,
    steps: suspended.steps,
    coins: suspended.coins,
    coinsFound: suspended.coinsFound,
    gems: suspended.gems,
    cycles: banked.cycles,
    banked,
    tools: new Set(suspended.tools),
    keys: new Set(suspended.keys),
    chests: new Set(suspended.chests),
    landmarks: new Set(suspended.landmarks),
    posts: new Set(suspended.posts),
    standings: new Set(suspended.standings),
    nonce: suspended.nonce,
    epoch: suspended.epoch,
    salt: saltOf(suspended.nonce, suspended.epoch),
    scatterGems: suspended.scatterGems,
    // Capped rather than trusted: a save hand-edited to a tankful the gems it
    // holds could never justify would otherwise walk further than the leash.
    water: Math.min(maxWater(suspended.gems), suspended.water),
    furthest: suspended.furthest,
    found: suspended.found,
    inventory: suspended.inventory,
    activeIndex: suspended.activeIndex,
    explored: carriesGround ? decodeExplored(slot.mapped) : new Set(),
    seenUnique: new Set(carriesGround ? slot.seen : []),
    // The item tiles this run had already emptied this epoch. Everything else
    // on the ground comes back off the seed and the salt.
    collected: decodeExplored(suspended.collected),
    cheats: false,
    // Not part of what was saved (see `createRun`) — a resumed expedition
    // starts as if it had just stepped, so the next bump reads as a fresh one.
    lastBump: null,
    bag: slot.bag && slot.bag.seed === suspended.seed ? slot.bag : null,
  };
  // How much ground the campaign had drawn when the expedition set out, so the
  // recap still reports what this walk added rather than what the slot holds.
  state.startExplored = Math.min(suspended.startExplored, state.explored.size);
  reveal(state);
  return state;
}

// What the run is worth so far, in the terms the recap reports it.
export function runSummary(state) {
  const lights = state.inventory.map((slot) => ({
    id: slot.id,
    durability: slot.durability,
  }));
  return {
    explored: state.explored.size,
    // Tiles this expedition lit that no earlier one had — the ground it can
    // claim, now that the rest of it came out of the slot.
    newGround: Math.max(0, state.explored.size - (state.startExplored || 0)),
    // What the walk was worth, not what is in the pocket: the hut empties the
    // pocket into the bank every time it is crossed (`depositRun`).
    coins: state.coinsFound,
    // What a death would still cost, which after a deposit is nothing.
    coinsCarried: state.coins,
    // A cheat run reports itself, because none of its numbers are going
    // anywhere (DESIGN.md §6.2) and the recap has to say so.
    cheats: !!state.cheats,
    water: state.water,
    steps: state.steps,
    furthest: state.furthest,
    gems: state.gems,
    // Gems this expedition is carrying that weren't already banked — the thing
    // walking home is actually protecting.
    gemsCarried: Math.max(0, state.gems - state.banked.gems),
    // Tools owned, and which of them this run would lose by not making it back.
    tools: [...state.tools],
    toolsCarried: [...state.tools].filter(
      (id) => !(id === 'compass' ? state.banked.compass : state.banked.map)
    ),
    // The same two questions for the keys: what is held, and what a death out
    // here would put back in its chest.
    keys: [...state.keys],
    keysCarried: [...state.keys].filter((id) => !state.banked.keys.includes(id)),
    // And for the landmarks: which of them this world knows, and which of those
    // this walk would put back by not making it home (DESIGN.md §4.10).
    landmarks: [...state.landmarks],
    landmarksCarried: [...state.landmarks].filter((id) => !state.banked.landmarks.includes(id)),
    standings: [...state.standings],
    // Coins and gems are counted separately, so "found" here means lights only.
    lightsFound: Object.entries(state.found)
      .filter(([id]) => itemDef(id) && itemDef(id).isLight)
      .reduce((total, [, count]) => total + count, 0),
    lights,
  };
}
