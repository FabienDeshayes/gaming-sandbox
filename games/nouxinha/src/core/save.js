// The one save slot, and the only thing that outlives a run.
//
// Saving happens at the hut and nowhere else (DESIGN.md §6): walk home, take
// the hut up on its offer to stop, and what you're carrying becomes yours.
// Anything else — dying of thirst, or leaving by the map's X — ends the run
// without writing, so the gem in your pocket goes back where it came from.
//
// Gems are stored as a *count*, not a list. The sanctum chain hands them out in
// order — each gate wants the gem from the sanctum before it — so "how many"
// says everything "which ones" would.
//
// The two tools are stored as flags, and the map brings a third thing with it:
// the ground it has drawn. That is the only part of a run that outlives it, and
// it is here rather than in a run save because it is cartography, not progress
// (core/cartography.js). It is tied to the seed that produced it, so a world
// that ever changed underneath it is discarded rather than drawn wrong.

import { SANCTUM_PLAN } from './world.js';

const STORAGE_KEY = 'nouxinha.save';
const VERSION = 1;

export const MAX_GEMS = SANCTUM_PLAN.filter((s) => s.gem).length;

export function emptySave() {
  return {
    v: VERSION,
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
  // Only a run that owns the map is allowed to have drawn anything, so a save
  // claiming otherwise loses the drawing rather than the game.
  save.mapped = save.map && typeof raw.mapped === 'string' ? raw.mapped : '';
  save.mappedSeed = Number.isFinite(raw.mappedSeed) ? raw.mappedSeed | 0 : 0;
  save.seen = Array.isArray(raw.seen)
    ? raw.seen.filter((id) => typeof id === 'string').slice(0, 32)
    : [];
  return save;
}

// localStorage throws in some embedded/private contexts, and a save is never
// worth taking the game down for — a run that can't persist is still playable.
export function loadSave() {
  try {
    return normaliseSave(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch (e) {
    return emptySave();
  }
}

export function writeSave(save) {
  const clean = normaliseSave(save);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  } catch (e) {
    /* progress just won't persist */
  }
  return clean;
}

export function clearSave() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    /* nothing to clear */
  }
  return emptySave();
}
