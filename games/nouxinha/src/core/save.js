// The save slots, and the only thing that outlives a run.
//
// Progress is written at the hut and nowhere else (DESIGN.md §6): walk home,
// take the hut up on its offer to stop, and what you're carrying becomes yours.
// Anything else — dying of thirst, or leaving by the map's X — ends the run
// without banking, so the gem in your pocket goes back where it came from.
//
// The ground you walked is the exception, and it is deliberate. Cartography is
// not progress: it says where the rock is, never what you were carrying, and a
// world that opened black every expedition would make every run start from
// scratch. So the explored set is written whichever way a run ends, while
// everything the run was *holding* still lives or dies on the walk home.
//
// Gems are stored as a *count*, not a list. The sanctum chain hands them out in
// order — each gate wants the gem from the sanctum before it — so "how many"
// says everything "which ones" would.
//
// There are three slots, so more than one campaign can be walked at a time, and
// one of them is active: the one NEW GAME or LOAD GAME last picked. Everything
// here defaults to that one, which is what lets a run bank itself without ever
// knowing which slot it belongs to.

import { SANCTUM_PLAN } from './world.js';

const SLOT_KEY = (slot) => `nouxinha.save.${slot}`;
const ACTIVE_KEY = 'nouxinha.slot';
// The single slot this game used before there were three. Read once, moved into
// slot 1, and forgotten — a player who has walked a campaign keeps it.
const LEGACY_KEY = 'nouxinha.save';
const VERSION = 1;

export const SLOT_COUNT = 3;

export const MAX_GEMS = SANCTUM_PLAN.filter((s) => s.gem).length;

export function emptySave() {
  return {
    v: VERSION,
    // Whether this slot has been claimed at all. A slot NEW GAME has picked is
    // in use from that moment, before it has a single run in it — otherwise
    // "which slot am I playing" would have no answer until the first walk home.
    started: false,
    gems: 0,
    coins: 0,
    runs: 0,
    furthest: 0,
    compass: false,
    map: false,
    // Run-length encoded explored ground, and the seed it belongs to.
    mapped: '',
    mappedSeed: 0,
    // Which unique objects have been laid eyes on, for the map's markers.
    seen: [],
  };
}

// A saved file is just text the player could have edited, and a corrupt one
// should cost them their progress rather than the game — so every field is
// range-checked back into something the rest of the code can rely on.
//
// Exported because a save reaches a run from more than one direction: read off
// disk, handed straight to `createRun` by a test, or carried over from the run
// that banked it. Normalising at the door means nothing downstream has to ask
// where a save came from before trusting its numbers.
export function normaliseSave(raw) {
  const save = emptySave();
  if (!raw || typeof raw !== 'object') return save;
  const int = (value, min, max) =>
    Number.isFinite(value) ? Math.max(min, Math.min(max, Math.floor(value))) : min;
  save.gems = int(raw.gems, 0, MAX_GEMS);
  save.coins = int(raw.coins, 0, Number.MAX_SAFE_INTEGER);
  save.runs = int(raw.runs, 0, Number.MAX_SAFE_INTEGER);
  save.furthest = int(raw.furthest, 0, Number.MAX_SAFE_INTEGER);
  save.compass = !!raw.compass;
  save.map = !!raw.map;
  save.mapped = typeof raw.mapped === 'string' ? raw.mapped : '';
  save.mappedSeed = Number.isFinite(raw.mappedSeed) ? raw.mappedSeed | 0 : 0;
  save.seen = Array.isArray(raw.seen)
    ? raw.seen.filter((id) => typeof id === 'string').slice(0, 32)
    : [];
  // Anything in a slot means the slot is in use, whether or not the flag
  // survived — a hand-written save is still somebody's campaign.
  save.started =
    !!raw.started ||
    save.runs > 0 ||
    save.coins > 0 ||
    save.gems > 0 ||
    save.compass ||
    save.map ||
    !!save.mapped;
  return save;
}

// --- Slots -------------------------------------------------------------------

export function clampSlot(slot) {
  const n = Number.isFinite(slot) ? Math.floor(slot) : 1;
  return Math.max(1, Math.min(SLOT_COUNT, n));
}

// localStorage throws in some embedded/private contexts, and a save is never
// worth taking the game down for — a run that can't persist is still playable.
function read(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    /* progress just won't persist */
  }
}

function remove(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    /* nothing to clear */
  }
}

// The one-slot save this game used to keep, moved into slot 1 the first time a
// three-slot build opens it. Done once, on the way past, so nothing downstream
// has to know there was ever another shape of save.
function migrateLegacy() {
  const legacy = read(LEGACY_KEY);
  if (legacy === null) return;
  if (read(SLOT_KEY(1)) === null) write(SLOT_KEY(1), legacy);
  remove(LEGACY_KEY);
}
migrateLegacy();

let active = clampSlot(Number(read(ACTIVE_KEY)) || 1);

export function activeSlot() {
  return active;
}

export function setActiveSlot(slot) {
  active = clampSlot(slot);
  write(ACTIVE_KEY, String(active));
  return active;
}

export function loadSave(slot = active) {
  try {
    return normaliseSave(JSON.parse(read(SLOT_KEY(clampSlot(slot)))));
  } catch (e) {
    return emptySave();
  }
}

export function writeSave(save, slot = active) {
  const clean = normaliseSave(save);
  // Anything written is a slot in use, even a run that walked home with nothing.
  clean.started = true;
  write(SLOT_KEY(clampSlot(slot)), JSON.stringify(clean));
  return clean;
}

export function clearSave(slot = active) {
  remove(SLOT_KEY(clampSlot(slot)));
  return emptySave();
}

// Every slot, in order, for the picker to draw. `used` is what tells NEW GAME's
// list from LOAD GAME's: an unused slot is free to start in and has nothing to
// load.
export function slots() {
  const out = [];
  for (let slot = 1; slot <= SLOT_COUNT; slot++) {
    const save = loadSave(slot);
    out.push({ slot, save, used: save.started });
  }
  return out;
}

export function anySlotUsed() {
  return slots().some((entry) => entry.used);
}

// NEW GAME: the slot is emptied, claimed, and made the active one, so a campaign
// started here banks here. Overwriting an occupied slot is the picker's
// decision, not this function's — by the time it is called the player has
// already been asked twice.
export function startSlot(slot) {
  const picked = setActiveSlot(slot);
  clearSave(picked);
  return writeSave(emptySave(), picked);
}

// LOAD GAME: nothing is written, the slot simply becomes the one the next run
// reads from and banks into.
export function loadSlot(slot) {
  const picked = setActiveSlot(slot);
  return loadSave(picked);
}
