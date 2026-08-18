// Step resolution: legality, durability, burnout/auto-swap, pickup, reveal.
//
// A run's whole state lives in the plain object `createRun` returns, and every
// function here operates on it without touching Phaser — so the entire game can
// be played out in Node by a test, which is how the durability and burnout
// sequencing gets checked.

import { DIRECTIONS, visibleTiles, tileKey } from './light.js';
import {
  DEFAULT_SEED,
  canEnter,
  chebyshev,
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
import { loadSave, normaliseSave, writeSave } from './save.js';
import { itemDef, STARTING_LIGHT } from '../data/items.js';
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

// A run's consumables are salted with a nonce so no two expeditions walk the
// same scatter (DESIGN.md §4.3). Tests pass one in to get a world they can
// route through; play draws one.
function drawNonce() {
  return (Math.random() * 0x7fffffff) | 0;
}

export function createRun(seed = DEFAULT_SEED, save = loadSave(), nonce) {
  // Normalised here rather than trusted: a save arrives off disk, from a test,
  // or from the run that banked it, and a hand-edited one must cost the player
  // their progress at worst — never the run's arithmetic.
  const banked = normaliseSave(save);
  const gems = banked.gems;
  const salted = nonce === undefined ? drawNonce() : nonce | 0;
  const picked = pickSeed(seed);
  // The map is the one thing that carries ground between runs, and only for the
  // world it drew: a save whose seed no longer matches loses its drawing rather
  // than showing one from a world that isn't there (core/cartography.js).
  const carriesMap = banked.map && banked.mappedSeed === picked;
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
    // terrain and items are both re-derived from the seed. A run carrying the
    // map starts with everywhere it has ever been already drawn.
    explored: carriesMap ? decodeExplored(banked.mapped) : new Set(),
    // Which unique objects have been laid eyes on, for the map's markers.
    seenUnique: new Set(carriesMap ? banked.seen : []),
    // Consumable tiles this run has emptied *this epoch*, so a pickup doesn't
    // come straight back. Cleared whenever the world respawns.
    collected: new Set(),
  };
  reveal(state);
  return state;
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
// which `visibleTiles` reads as blackout.
export function activeShape(state) {
  const light = activeLight(state);
  return light ? itemDef(light.id).shape : null;
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
  const lit = visibleTiles(activeShape(state), state.x, state.y, state.facing);
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

export function litTiles(state) {
  return visibleTiles(activeShape(state), state.x, state.y, state.facing);
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
    return cost === null
      ? { moved: false, reason: 'blocked' }
      : { moved: false, reason: 'locked', needs: cost };
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

// Banks the run into the single save slot. Only the hut calls this (DESIGN.md
// §6): dying of thirst or leaving by the map's X ends a run without writing,
// which is what makes carrying a gem home the moment that matters.
export function bankRun(state) {
  const hasMap = state.tools.has('map');
  return writeSave({
    v: 1,
    gems: Math.max(state.gems, state.banked.gems),
    // `state.coins` is what this run picked up and `state.banked.coins` what was
    // already banked less anything the merchant took, so this one sum settles
    // both the finds and the shopping (see `buy`).
    coins: state.banked.coins + state.coins,
    runs: state.banked.runs + 1,
    furthest: Math.max(state.furthest, state.banked.furthest),
    compass: state.tools.has('compass'),
    map: hasMap,
    // The map is what makes walking persist, so it is the only thing that writes
    // ground back out (DESIGN.md §4.6). Without it a run's memory dies with it,
    // exactly like everything else a run doesn't carry home.
    mapped: hasMap ? encodeExplored(state.explored) : '',
    mappedSeed: state.seed,
    seen: hasMap ? [...state.seenUnique] : [],
  });
}

// What the run is worth so far, in the terms the recap reports it.
export function runSummary(state) {
  const lights = state.inventory.map((slot) => ({
    id: slot.id,
    durability: slot.durability,
  }));
  return {
    explored: state.explored.size,
    coins: state.coins,
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
