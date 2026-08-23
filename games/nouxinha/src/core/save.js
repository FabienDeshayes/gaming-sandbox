// The save slots, and the only thing that outlives a run.
//
// Progress is banked at the hut and nowhere else (DESIGN.md §6): walk home,
// take the hut up on its offer to stop, and what you're carrying becomes yours.
// Anything else — dying of thirst, or leaving by the menu's EXIT GAME — ends the
// run without banking, so the gem in your pocket goes back where it came from.
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
// A slot also holds, alongside the banked campaign, an optional **suspended
// expedition**: the run the cogwheel menu's SAVE GAME wrote down mid-walk
// (DESIGN.md §6.1). It is stored the way the world itself is — derived, never
// copied. The seed, the run's nonce and its epoch put every item back where the
// run left it, so all the slot has to remember is which tiles the run has
// already emptied, plus what it is standing on, carrying and holding.
//
// There are three slots, so more than one campaign can be walked at a time, and
// one of them is active: the one NEW GAME or LOAD GAME last picked. Everything
// here defaults to that one, which is what lets a run bank itself without ever
// knowing which slot it belongs to.

import { BASE_X, BASE_Y, SANCTUM_PLAN, beyondEdge, pickSeed } from './world.js';
import { ITEMS, TOOLS } from '../data/items.js';

const SLOT_KEY = (slot) => `nouxinha.save.${slot}`;
const ACTIVE_KEY = 'nouxinha.slot';
// The single slot this game used before there were three. Read once, moved into
// slot 1, and forgotten — a player who has walked a campaign keeps it.
const LEGACY_KEY = 'nouxinha.save';
const VERSION = 2;

export const SLOT_COUNT = 3;

export const MAX_GEMS = SANCTUM_PLAN.filter((s) => s.gem).length;

export function emptySave() {
  return {
    v: VERSION,
    // Whether this slot has been claimed at all. A slot NEW GAME has picked is
    // in use from that moment, before it has a single run in it — otherwise
    // "which slot am I playing" would have no answer until the first walk home.
    started: false,
    // The world this campaign walks. Drawn when NEW GAME claims the slot, so
    // the three slots are three different worlds — see `startSlot`. Zero means
    // "not drawn": every save written before slots had seeds, which is why it
    // falls back to DEFAULT_SEED in `createRun` rather than to a fresh draw. A
    // campaign already under way keeps the world it has been mapping.
    seed: 0,
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
    // The expedition this slot was left in the middle of, or null for a slot
    // that is between runs. LOAD GAME resumes it (`resumeRun` in core/rules.js).
    run: null,
  };
}

const FACINGS = ['up', 'down', 'left', 'right'];

const int = (value, min, max) =>
  Number.isFinite(value) ? Math.max(min, Math.min(max, Math.floor(value))) : min;

// A coordinate: any whole number, either side of zero, since the world has no
// edge and a run can be suspended anywhere in it.
const whole = (value) => (Number.isFinite(value) ? Math.trunc(value) : 0);

// A saved file is just text the player could have edited, and a corrupt one
// should cost them their progress rather than the game — so every field is
// range-checked back into something the rest of the code can rely on.
//
// Exported because a save reaches a run from more than one direction: read off
// disk, handed straight to `createRun` by a test, or carried over from the run
// that banked it. Normalising at the door means nothing downstream has to ask
// where a save came from before trusting its numbers.
//
// `keepRun` is how the nesting stops: a suspended expedition carries the banked
// save it started from (the merchant spends out of it), and that inner save is
// normalised with the flag off, so a hand-edited file cannot nest slots deep
// enough to recurse.
export function normaliseSave(raw, keepRun = true) {
  const save = emptySave();
  if (!raw || typeof raw !== 'object') return save;
  save.seed = Number.isFinite(raw.seed) ? raw.seed | 0 : 0;
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
  save.run = keepRun ? normaliseRun(raw.run) : null;
  // Anything in a slot means the slot is in use, whether or not the flag
  // survived — a hand-written save is still somebody's campaign.
  save.started =
    !!raw.started ||
    save.runs > 0 ||
    save.coins > 0 ||
    save.gems > 0 ||
    save.compass ||
    save.map ||
    !!save.mapped ||
    !!save.run;
  return save;
}

// The suspended expedition, checked the same way and to the same end: a slot
// whose run block is nonsense loses the walk, never the campaign — anything
// that can't be made sense of comes back as null, which simply means "this slot
// is between runs".
//
// What is *not* here is the world: no terrain, no items, no explored set. Seed,
// nonce and epoch re-derive the first two (core/world.js) and the slot's own
// `mapped` holds the third, so the only thing worth writing down about the
// ground is which item tiles this run has already emptied.
function normaliseRun(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!Number.isFinite(raw.seed)) return null;

  const inventory = (Array.isArray(raw.inventory) ? raw.inventory : [])
    .filter((slot) => slot && ITEMS[slot.id] && ITEMS[slot.id].isLight)
    // A light with no burn left in it never existed — it would be spliced out
    // by the first step anyway (`burnActiveLight` in core/rules.js).
    .map((slot) => ({ id: slot.id, durability: int(slot.durability, 1, ITEMS[slot.id].maxDurability) }))
    .slice(0, 64);

  const found = {};
  if (raw.found && typeof raw.found === 'object')
    for (const [id, count] of Object.entries(raw.found))
      if (ITEMS[id]) found[id] = int(count, 0, Number.MAX_SAFE_INTEGER);

  // A position outside the world is one a run could never have walked to, so it
  // only ever comes from a save that has been edited or corrupted. It matters
  // because every neighbour of such a tile is also outside: restoring one would
  // put the character somewhere they can neither move nor die, which is the one
  // thing the design promises never happens (DESIGN.md §5). The hut is the tile
  // that is always walkable, so that is where an impossible one lands.
  const stranded = beyondEdge(whole(raw.x), whole(raw.y));

  return {
    seed: raw.seed | 0,
    x: stranded ? BASE_X : whole(raw.x),
    y: stranded ? BASE_Y : whole(raw.y),
    facing: FACINGS.includes(raw.facing) ? raw.facing : 'up',
    steps: int(raw.steps, 0, Number.MAX_SAFE_INTEGER),
    // Never zero: a run is suspended mid-walk, and one restored with no water
    // left would be a run that can't take a step and can't be ended either.
    water: int(raw.water, 1, Number.MAX_SAFE_INTEGER),
    coins: int(raw.coins, 0, Number.MAX_SAFE_INTEGER),
    gems: int(raw.gems, 0, MAX_GEMS),
    furthest: int(raw.furthest, 0, Number.MAX_SAFE_INTEGER),
    // The two halves of the consumable salt (DESIGN.md §4.3) — with the seed,
    // they are the whole of what puts the scatter back where it was.
    nonce: Number.isFinite(raw.nonce) ? raw.nonce | 0 : 0,
    epoch: int(raw.epoch, 0, Number.MAX_SAFE_INTEGER),
    tools: Array.isArray(raw.tools) ? raw.tools.filter((id) => TOOLS.includes(id)) : [],
    inventory,
    // -1 is blackout, and it is the only answer for an empty inventory.
    activeIndex: inventory.length ? int(raw.activeIndex, 0, inventory.length - 1) : -1,
    found,
    // Run-length encoded the same way the explored ground is (core/cartography.js).
    collected: typeof raw.collected === 'string' ? raw.collected : '',
    startExplored: int(raw.startExplored, 0, Number.MAX_SAFE_INTEGER),
    // What the campaign had banked when this run walked out, less anything it
    // has spent at the merchant since — money a suspended run has already
    // parted with (`buy` in core/rules.js).
    banked: campaignOnly(normaliseSave(raw.banked, false)),
  };
}

// The campaign's numbers without its cartography. A suspended run carries the
// save it walked out of, and the ground in that copy would be a second copy of
// the slot's own — the largest thing in the file, duplicated. The run resumes
// on the slot's drawing (`resumeRun` in core/rules.js), so this one is dropped.
function campaignOnly(save) {
  save.mapped = '';
  save.mappedSeed = 0;
  save.seen = [];
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

// A campaign's world, drawn once when the slot is claimed. Every run out of
// this slot walks it, so the three slots are three different worlds and
// starting over gives a fourth — which is the whole point of a world that is a
// pure function of a seed (core/world.js).
//
// Validated here rather than at every run start: `pickSeed` is what promises
// the spawn isn't sealed into a pocket and that every gate and landmark can be
// reached, and the seed it hands back is the one worth writing down. `createRun`
// still runs it, but on an already-valid seed it is a no-op that returns the
// same number.
function drawSeed() {
  return pickSeed((Math.random() * 0x100000000) | 0);
}

// NEW GAME: the slot is emptied, given a world of its own, claimed, and made
// the active one, so a campaign started here banks here. Overwriting an occupied
// slot is the picker's decision, not this function's — by the time it is called
// the player has already been asked twice.
export function startSlot(slot) {
  const picked = setActiveSlot(slot);
  clearSave(picked);
  return writeSave({ ...emptySave(), seed: drawSeed() }, picked);
}

// LOAD GAME: nothing is written, the slot simply becomes the one the next run
// reads from and banks into.
export function loadSlot(slot) {
  const picked = setActiveSlot(slot);
  return loadSave(picked);
}
