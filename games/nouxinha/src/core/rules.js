// Step resolution: legality, durability, burnout/auto-swap, pickup, reveal.
//
// A run's whole state lives in the plain object `createRun` returns, and every
// function here operates on it without touching Phaser — so the entire game can
// be played out in Node by a test, which is how the durability and burnout
// sequencing gets checked.

import { DIRECTIONS, visibleTiles, tileKey } from './light.js';
import { DEFAULT_SEED, chebyshev, isBase, isWalkable, itemAt, pickSeed } from './world.js';
import { itemDef, STARTING_LIGHT } from '../data/items.js';

export { DIRECTIONS, tileKey };

export function createRun(seed = DEFAULT_SEED) {
  const state = {
    seed: pickSeed(seed),
    x: 0,
    y: 0,
    facing: 'up',
    steps: 0,
    coins: 0,
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

// The item lying on a tile, accounting for what this run has already taken.
export function itemOnTile(state, x, y) {
  if (state.collected.has(tileKey(x, y))) return null;
  return itemAt(x, y, state.seed);
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
  state.collected.add(tileKey(x, y));
  state.found[id] = (state.found[id] || 0) + 1;
  if (id === 'coin') {
    state.coins += 1;
  } else {
    // Lights arrive unequipped — swapping is the player's call.
    state.inventory.push(newLight(id));
  }
  return id;
}

// One step in a cardinal direction. Rock is impassable: the step is rejected,
// costs no durability, and doesn't change facing.
export function step(state, direction) {
  const dir = DIRECTIONS[direction];
  if (!dir) return { moved: false, reason: 'unknown-direction' };

  const nx = state.x + dir.dx;
  const ny = state.y + dir.dy;
  if (!isWalkable(nx, ny, state.seed)) return { moved: false, reason: 'blocked' };

  state.x = nx;
  state.y = ny;
  state.facing = direction;
  state.steps += 1;
  state.furthest = Math.max(state.furthest, chebyshev(nx, ny));

  // Order matters: burn first (so the step you take on your last durability is
  // the one that plunges you into the dark), then pick up, then light the
  // result — a pickup can't light the tile it landed on until it's equipped.
  const burn = burnActiveLight(state);
  const picked = collect(state, nx, ny);
  const lit = reveal(state);

  // Walking back onto the hut is the one moment the run offers to end itself
  // (DESIGN.md §6), so the step that lands there says so.
  return { moved: true, reason: null, picked, lit, atBase: isBase(nx, ny), ...burn };
}

export function tilesExplored(state) {
  return state.explored.size;
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
    steps: state.steps,
    furthest: state.furthest,
    // Coins are counted separately, so "found" here means lights only.
    lightsFound: Object.entries(state.found)
      .filter(([id]) => id !== 'coin')
      .reduce((total, [, count]) => total + count, 0),
    lights,
  };
}
