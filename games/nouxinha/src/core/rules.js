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
  entryCost,
  isBase,
  itemAt,
  pickSeed,
  sanctumAt,
} from './world.js';
import { loadSave, normaliseSave, writeSave } from './save.js';
import { itemDef, unlockOf, STARTING_LIGHT } from '../data/items.js';

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

export function createRun(seed = DEFAULT_SEED, save = loadSave()) {
  // Normalised here rather than trusted: a save arrives off disk, from a test,
  // or from the run that banked it, and a hand-edited one must cost the player
  // their progress at worst — never the run's arithmetic.
  const banked = normaliseSave(save);
  const gems = banked.gems;
  const state = {
    seed: pickSeed(seed),
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
    // terrain and items are both re-derived from the seed.
    explored: new Set(),
    // Item tiles this run has already emptied, so a pickup doesn't respawn.
    collected: new Set(),
  };
  reveal(state);
  return state;
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

// The item lying on a tile, accounting for what this run has already taken and
// what it has the gems to see at all. An item above your gem count isn't
// hidden from the *world* — it was always generated there — it just isn't part
// of yours yet, which is what makes a gem light up ground you'd already walked.
export function itemOnTile(state, x, y) {
  if (state.collected.has(tileKey(x, y))) return null;
  const id = itemAt(x, y, state.seed);
  if (!id || unlockOf(id) > state.gems) return null;
  return id;
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
  return lit;
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

function collect(state, x, y) {
  const id = itemOnTile(state, x, y);
  if (!id) return null;
  const def = itemDef(id);
  state.collected.add(tileKey(x, y));
  state.found[id] = (state.found[id] || 0) + 1;

  if (id === 'coin') {
    state.coins += 1;
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
  const picked = collect(state, nx, ny);
  const lit = reveal(state);

  // Walking back onto the hut is the one moment the run offers to end itself
  // (DESIGN.md §6), so the step that lands there says so.
  return {
    moved: true,
    reason: null,
    picked,
    // A gem landing is the one pickup that changes how the whole screen looks,
    // so the scene gets told rather than having to diff the count itself.
    gemFound: state.gems > gemsBefore ? state.gems : 0,
    lit,
    atBase: isBase(nx, ny),
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
  return writeSave({
    v: 1,
    gems: Math.max(state.gems, state.banked.gems),
    coins: state.banked.coins + state.coins,
    runs: state.banked.runs + 1,
    furthest: Math.max(state.furthest, state.banked.furthest),
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
    // Coins and gems are counted separately, so "found" here means lights only.
    lightsFound: Object.entries(state.found)
      .filter(([id]) => id !== 'coin' && !itemDef(id).gem && !itemDef(id).water)
      .reduce((total, [, count]) => total + count, 0),
    lights,
  };
}
