// What the game needs from a browser, and nothing else.
//
// `core/` is pure by design, with two exceptions the simulator has to supply:
// a slot to save into (`core/save.js` reaches for `localStorage` and shrugs
// when it isn't there — which would quietly cost a campaign everything it
// banked), and `Math.random`, which draws a run's nonce and the seed the hall
// moulds. Both are replaced here so a campaign is a pure function of its own
// seed and can be walked again to look at.

// --- A slot that lives in memory ---------------------------------------------
//
// `writeSave` hands back the save it wrote, so a run of the simulator could
// almost chain them by hand — almost, because `abandonRun` and `rememberGround`
// merge onto whatever is *in* the slot, and with no slot to read they would
// merge onto nothing and hand a dead campaign back its purse. So the slot is
// real, and the save layer behaves exactly as it does in a browser.
class MemoryStorage {
  constructor() {
    this.map = new Map();
  }

  getItem(key) {
    const value = this.map.get(key);
    return value === undefined ? null : value;
  }

  setItem(key, value) {
    this.map.set(key, String(value));
  }

  removeItem(key) {
    this.map.delete(key);
  }

  clear() {
    this.map.clear();
  }
}

export const storage = new MemoryStorage();
globalThis.localStorage = storage;

// --- A random that can be replayed --------------------------------------------

// mulberry32: small, fast and good enough for deciding which way a bot turns.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const REAL_RANDOM = Math.random;

// Puts the whole process on one replayable stream — `createRun` draws its nonce
// off `Math.random` and so does the seed the hall moulds, and neither takes one
// as an argument. Returns the roll function, so a caller that wants its own
// decisions on the same stream can share it.
export function seedRandom(seed) {
  const roll = rng(seed);
  Math.random = roll;
  return roll;
}

export function restoreRandom() {
  Math.random = REAL_RANDOM;
}

// A fresh, empty set of slots — one campaign must never see the one before it.
export function resetStorage() {
  storage.clear();
}
