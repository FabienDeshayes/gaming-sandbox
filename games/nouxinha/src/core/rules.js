// Step resolution: legality, durability, burnout/auto-swap, pickup, reveal.
//
// A run's whole state lives in the plain object `createRun` returns, and every
// function here operates on it without touching Phaser — so the entire game can
// be played out in Node by a test, which is how the durability and burnout
// sequencing gets checked.

import { DIRECTIONS, chokeShape, visibleTiles, tileKey } from './light.js';
import {
  DEFAULT_SEED,
  beyondEdge,
  canEnter,
  chebyshev,
  chokeAt,
  coinValue,
  consumableAt,
  entryCost,
  isBase,
  isMerchant,
  landmarks,
  pickSeed,
  saltOf,
  sanctumAt,
  sanctums,
  uniqueAt,
} from './world.js';
import { decodeExplored, encodeExplored } from './cartography.js';
import { loadSave, MAX_GEMS, normaliseSave, writeSave } from './save.js';
import { ITEMS, itemDef, STARTING_LIGHT, TOOLS } from '../data/items.js';
import { isOneOff, priceOf } from '../data/shop.js';

export { DIRECTIONS, tileKey };

// Water balance — tune here. Every successful step costs one; a water pickup
// refills it by whatever that item carries, capped at the run's maximum.
// Hitting zero is the run's one hard failure state (DESIGN.md §6).
export const STARTING_WATER = 200;
export const WATER_PER_STEP = 1;

// Each gem you hold widens the leash. The sanctums sit at 20, 45, 80 and 110
// tiles out, which is further than 200 water can carry anyone home — so the
// gem that opens the next gate is also what makes the walk to it survivable
// (DESIGN.md §4.4). Without this the chain simply dead-ends at the second gate.
export const WATER_PER_GEM = 50;

export function maxWater(gems) {
  return STARTING_WATER + gems * WATER_PER_GEM;
}

// The hut's other job besides banking a run (DESIGN.md §4): choosing to keep
// going instead of stopping tops the tank back up before the expedition
// continues, so a run that doubles back can push out again at full water.
// Returns whether it actually topped anything up, for the scene to decide
// whether a refill is worth announcing.
export function refillWater(state) {
  const before = state.water;
  state.water = maxWater(state.gems);
  return state.water > before;
}

// What a campaign files "I have walked into the end of the world" under. It
// rides along in the same set as the unique objects the run has laid eyes on
// (`seenUnique`), which is exactly the right shelf for it: knowledge rather
// than loot, written down whichever way the expedition ends, and never worth a
// field of its own in the save.
export const EDGE_SEEN = 'edge';

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
    x: 0,
    y: 0,
    facing: 'up',
    steps: 0,
    coins: 0,
    // Gems held, as a count — the sanctum chain hands them out in order, so
    // this doubles as which gates open and how much colour is back (save.js).
    gems,
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
    // The salt the consumable layer is hashed against. `nonce` is this
    // expedition's, `epoch` counts the times the world has respawned under it.
    nonce: salted,
    epoch: 0,
    salt: saltOf(salted, 0),
    water: maxWater(gems),
    // How far out this expedition got, for the recap the hut offers on the way
    // back in — the number DESIGN.md §6 calls the real score.
    furthest: 0,
    // Everything picked up this run, by item id, including lights that have
    // since burned out. The inventory alone can't tell that story.
    found: {},
    // Lights, in pickup order. Auto-swap on burnout walks this order.
    inventory: [newLight(STARTING_LIGHT)],
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

// Past the fourth sanctum's ring (110 + 7) and every landmark, with room to
// spare — the whole of the world the game actually has anything in.
export const CHEAT_REVEAL_RADIUS = 130;
export const CHEAT_COINS = 9999;

function applyCheats(state) {
  state.gems = MAX_GEMS;
  state.water = maxWater(state.gems);
  state.coins = CHEAT_COINS;
  for (const id of TOOLS) state.tools.add(id);

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
  for (const landmark of landmarks(state.seed)) state.seenUnique.add(landmark.id);
}

// Everything on the ground goes back, in new places. This is what a gem and a
// stop at the hut both do (DESIGN.md §4.3): the salt moves, so the scatter is
// relaid, and nothing this run has already emptied stays empty.
export function respawn(state) {
  state.epoch += 1;
  state.salt = saltOf(state.nonce, state.epoch);
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

// The item lying on a tile for this run: the unique layer first, which no
// respawn ever moves, then whatever the current scatter put there.
export function itemOnTile(state, x, y) {
  const unique = uniqueAt(x, y, state.seed);
  if (unique) return uniqueTaken(state, unique) ? null : unique;
  if (state.collected.has(tileKey(x, y))) return null;
  return consumableAt(x, y, state.seed, state.salt, state.gems);
}

// Whether a step onto this tile is legal for the gems this run is carrying:
// floor always, a gate only once you hold the gem it wants.
export function canStepOnto(state, x, y) {
  return canEnter(x, y, state.seed, state.gems);
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
  for (const landmark of landmarks(state.seed))
    if (litKeys.has(tileKey(landmark.x, landmark.y))) state.seenUnique.add(landmark.id);
}

// What the light actually shows. Tiles outside the world are dropped rather
// than lit: the dark out there is what the light is losing against, so it can
// never be what the light reveals — which is also what keeps them out of the
// explored set, and so off both maps.
export function litTiles(state) {
  return visibleTiles(activeShape(state), state.x, state.y, state.facing).filter(
    ({ x, y }) => !beyondEdge(x, y)
  );
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
  const def = itemDef(id);
  state.collected.add(tileKey(x, y));
  state.found[id] = (state.found[id] || 0) + 1;
  let coins = 0;

  if (id === 'coin') {
    // A coin on the ground is a small pile, and how small is the tile's own
    // business (core/world.js `coinValue`).
    coins = coinValue(x, y, state.seed, state.salt);
    state.coins += coins;
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

// One step in a cardinal direction. Rock and sanctum wall are impassable, and
// so is a gate you don't have the gem for: the step is rejected, costs no
// durability, and doesn't change facing. Once water has run out the run is
// over, so every further step is rejected too.
export function step(state, direction) {
  const dir = DIRECTIONS[direction];
  if (!dir) return { moved: false, reason: 'unknown-direction' };
  if (state.water <= 0) return { moved: false, reason: 'dead' };

  const nx = state.x + dir.dx;
  const ny = state.y + dir.dy;
  if (!canStepOnto(state, nx, ny)) {
    // A shut gate is a different answer from a wall: it tells the player there
    // is something through there and exactly what it costs to get in.
    const cost = entryCost(nx, ny, state.seed);
    if (cost !== null) return { moved: false, reason: 'locked', needs: cost };
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

  state.x = nx;
  state.y = ny;
  state.facing = direction;
  state.steps += 1;
  state.furthest = Math.max(state.furthest, chebyshev(nx, ny));

  // Order matters: burn first (so the step you take on your last durability is
  // the one that plunges you into the dark), then pick up — a water-drop
  // picked up on the tile that would have killed you still saves you, the same
  // way a pickup can't light the tile it landed on until it's equipped.
  const burn = burnActiveLight(state);
  state.water = Math.max(0, state.water - WATER_PER_STEP);
  const gemsBefore = state.gems;
  const got = collect(state, nx, ny);
  const picked = got ? got.id : null;

  // Two things put everything on the ground back, in new places: taking a gem,
  // and walking back onto the hut (DESIGN.md §4.3). Done before the reveal, so
  // the light already shows the world it relaid.
  const gemFound = state.gems > gemsBefore;
  const respawned = gemFound || isBase(nx, ny);
  if (respawned) respawn(state);

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
    lit,
    atBase: isBase(nx, ny),
    atMerchant: isMerchant(nx, ny, state.seed),
    died: state.water <= 0,
    ...burn,
  };
}

// Which gate stands on this tile and whether this run can open it — the
// renderer needs both to draw a gate in the colour of the gem that opened it.
export function gateOnTile(state, x, y) {
  const site = sanctumAt(x, y, state.seed);
  if (!site || site.part !== 'gate') return null;
  return { requires: site.sanctum.requires, open: site.sanctum.requires <= state.gems };
}

export function tilesExplored(state) {
  return state.explored.size;
}

// Banks the run into the active save slot. Only the hut calls this (DESIGN.md
// §6): dying of thirst or leaving by the map's X ends a run without banking,
// which is what makes carrying a gem home the moment that matters. Those two
// still keep the ground they walked — see `rememberGround`.
//
// A cheat run banks nothing at all: it was handed its gems rather than walking
// them home, so writing it into a slot would overwrite a campaign with a
// sandbox (DESIGN.md §6.2).
export function bankRun(state) {
  if (state.cheats) return loadSave();
  return writeSave({
    v: 1,
    // The campaign's world. Rebuilt from scratch here rather than merged onto
    // what is in the slot, so this has to be carried over by hand — a walk home
    // that dropped it would move the campaign to a different world, and take its
    // cartography with it (`mappedSeed` below).
    seed: state.seed,
    gems: Math.max(state.gems, state.banked.gems),
    // `state.coins` is what this run picked up and `state.banked.coins` what was
    // already banked less anything the merchant took, so this one sum settles
    // both the finds and the shopping (see `buy`).
    coins: state.banked.coins + state.coins,
    runs: state.banked.runs + 1,
    furthest: Math.max(state.furthest, state.banked.furthest),
    compass: state.tools.has('compass'),
    map: state.tools.has('map'),
    // Ground is written whichever way a run ends, so this is the same drawing
    // `rememberGround` would have left — banking simply gets there first.
    mapped: encodeExplored(state.explored),
    mappedSeed: state.seed,
    seen: [...state.seenUnique],
    // The expedition is over, so whatever the menu had suspended of it goes:
    // a saved run is a walk to carry on with, and this one has come home.
    run: null,
  });
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
  });
}

// Running dry: the ground is kept exactly as above, and the slot's suspended
// expedition goes with the run it belonged to.
//
// This is the one place a save is destroyed by playing rather than by choosing
// to (DESIGN.md §6.1). Death is the game's only hard failure, and a save file
// you could reload out of it would make it a rewind instead — so what the
// campaign keeps is what it had banked at the hut, and the walk that died is
// gone the same way a walk abandoned mid-expedition always was.
export function abandonRun(state) {
  if (state.cheats) return loadSave();
  return writeSave({ ...rememberGround(state), run: null });
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
    run: {
      seed: state.seed,
      x: state.x,
      y: state.y,
      facing: state.facing,
      steps: state.steps,
      water: state.water,
      coins: state.coins,
      gems: state.gems,
      furthest: state.furthest,
      nonce: state.nonce,
      epoch: state.epoch,
      tools: [...state.tools],
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
    x: suspended.x,
    y: suspended.y,
    facing: suspended.facing,
    steps: suspended.steps,
    coins: suspended.coins,
    gems: suspended.gems,
    banked,
    tools: new Set(suspended.tools),
    nonce: suspended.nonce,
    epoch: suspended.epoch,
    salt: saltOf(suspended.nonce, suspended.epoch),
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
    coins: state.coins,
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
    // Coins and gems are counted separately, so "found" here means lights only.
    lightsFound: Object.entries(state.found)
      .filter(([id]) => id !== 'coin' && !itemDef(id).gem && !itemDef(id).water)
      .reduce((total, [, count]) => total + count, 0),
    lights,
  };
}
