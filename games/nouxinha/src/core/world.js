// The world: infinite, and derived rather than stored.
//
// Every tile's terrain and item is a pure function of its (x, y) and the run's
// seed, so walking back to a tile always finds the same thing there and nothing
// but the set of *seen* tiles ever needs remembering. No Phaser, no scene
// state — importable straight into Node for tests.

export const DEFAULT_SEED = 0x6e6f7578; // "noux"

// Distinct hash channels, so terrain and items are independent of each other —
// otherwise rocky ground would also be rich ground.
const CH_TERRAIN = 1;
const CH_TERRAIN_FINE = 2;
const CH_ITEM = 3;
const CH_ITEM_KIND = 4;

// ~28% rock coverage. Density alone can't guarantee the base isn't walled in —
// at *any* threshold that still looks like a cave system, a noticeable slice of
// seeds seals the spawn into a pocket — so connectivity is enforced by
// validating the seed at run start instead (`pickSeed`).
const ROCK_THRESHOLD = 0.6;

// The base's 3x3 neighbourhood is forced to floor so spawn can never be walled in.
export const BASE_X = 0;
export const BASE_Y = 0;
const BASE_CLEARING = 1;

// --- Noise ------------------------------------------------------------------

// 32-bit integer hash of (x, y, seed, channel) as a float in [0, 1).
// Handles negative coordinates: the bit ops coerce to int32 either way.
function hash(x, y, seed, channel) {
  let h = (seed ^ Math.imul(channel, 0x9e3779b1)) | 0;
  h = Math.imul(h ^ x, 0x85ebca6b);
  h = Math.imul(h ^ (x >>> 13), 0xc2b2ae35);
  h = Math.imul(h ^ y, 0x27d4eb2f);
  h = Math.imul(h ^ (y >>> 11), 0x165667b1);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

export function randomAt(x, y, seed, channel) {
  return hash(x | 0, y | 0, seed | 0, channel);
}

const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);

// Value noise on a lattice `cell` tiles wide. White noise would give a
// salt-and-pepper world with no shape worth exploring; this gives blobs.
function valueNoise(x, y, seed, channel, cell) {
  const gx = Math.floor(x / cell);
  const gy = Math.floor(y / cell);
  const fx = smooth(x / cell - gx);
  const fy = smooth(y / cell - gy);
  const top = lerp(hash(gx, gy, seed, channel), hash(gx + 1, gy, seed, channel), fx);
  const bot = lerp(hash(gx, gy + 1, seed, channel), hash(gx + 1, gy + 1, seed, channel), fx);
  return lerp(top, bot, fy);
}

// --- Terrain ----------------------------------------------------------------

export function chebyshev(x, y, ox = 0, oy = 0) {
  return Math.max(Math.abs(x - ox), Math.abs(y - oy));
}

export function isBase(x, y) {
  return x === BASE_X && y === BASE_Y;
}

export function terrainAt(x, y, seed = DEFAULT_SEED) {
  if (chebyshev(x, y, BASE_X, BASE_Y) <= BASE_CLEARING) return 'floor';
  // Two octaves: broad masses from the coarse lattice, ragged edges from the fine one.
  const n =
    0.65 * valueNoise(x, y, seed, CH_TERRAIN, 6) +
    0.35 * valueNoise(x, y, seed, CH_TERRAIN_FINE, 3);
  return n > ROCK_THRESHOLD ? 'rock' : 'floor';
}

export function isWalkable(x, y, seed = DEFAULT_SEED) {
  return terrainAt(x, y, seed) !== 'rock';
}

// --- Connectivity -----------------------------------------------------------

// How much of the floor within `radius` of the base you can actually walk to.
// The world is infinite, so this only ever samples a window — but a spawn that
// can reach most of a 40-tile window is a spawn that isn't in a pocket.
export function reachableFraction(seed, radius = 40) {
  const seen = new Set(['0,0']);
  const stack = [[BASE_X, BASE_Y]];
  while (stack.length) {
    const [x, y] = stack.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (Math.abs(nx) > radius || Math.abs(ny) > radius) continue;
      const key = `${nx},${ny}`;
      if (seen.has(key) || !isWalkable(nx, ny, seed)) continue;
      seen.add(key);
      stack.push([nx, ny]);
    }
  }
  let floor = 0;
  for (let y = -radius; y <= radius; y++)
    for (let x = -radius; x <= radius; x++) if (isWalkable(x, y, seed)) floor++;
  return floor === 0 ? 0 : seen.size / floor;
}

// Returns `preferred` if it gives the player a world worth exploring, otherwise
// the first bumped seed that does. Some seeds seal the base into a pocket of a
// few tiles, which would break the promise that the character is never
// permanently stuck (DESIGN.md §5); rejecting those at run start is cheaper and
// keeps the terrain organic, where carving guaranteed corridors into the noise
// would leave a visible lattice. Converges immediately in practice — 1 attempt
// median, 2 worst case over a 200-seed sample, a few ms each.
export function pickSeed(preferred = DEFAULT_SEED, minFraction = 0.6, maxAttempts = 20) {
  let seed = preferred | 0;
  for (let i = 0; i < maxAttempts; i++) {
    if (reachableFraction(seed) >= minFraction) return seed;
    seed = (Math.imul(seed, 1103515245) + 12345) | 0;
  }
  return seed;
}

// --- Items ------------------------------------------------------------------

// Spawn odds rise with distance from the base, and so does what can spawn:
// coins and water drops near home, medium torches in the middle band, lamp
// torches only far out. This is the whole reason to spend durability walking
// away (DESIGN.md §4.3).
const SPAWN_NEAR = 0.03;
const SPAWN_FAR = 0.06;
const SPAWN_FALLOFF = 40;

const BAND_MID = 8;
const BAND_FAR = 20;

export function spawnChance(distance) {
  const t = Math.min(distance, SPAWN_FALLOFF) / SPAWN_FALLOFF;
  return SPAWN_NEAR + (SPAWN_FAR - SPAWN_NEAR) * t;
}

// The item lying on a tile in a pristine world, ignoring whether this run has
// already picked it up — see rules.js `itemOnTile` for the run-aware version.
//
// Water drops carve their share out of what would otherwise be a coin, at
// every distance band, without moving the torch thresholds — so a change here
// can never shift where a medium or lamp torch spawns.
export function itemAt(x, y, seed = DEFAULT_SEED) {
  const d = chebyshev(x, y, BASE_X, BASE_Y);
  if (d <= BASE_CLEARING) return null;
  if (!isWalkable(x, y, seed)) return null;
  if (randomAt(x, y, seed, CH_ITEM) >= spawnChance(d)) return null;

  const kind = randomAt(x, y, seed, CH_ITEM_KIND);
  if (d < BAND_MID) return kind < 0.5 ? 'coin' : 'water-drop';
  if (d < BAND_FAR) {
    if (kind < 0.75) return kind < 0.45 ? 'coin' : 'water-drop';
    return 'torch-medium';
  }
  if (kind < 0.6) return kind < 0.3 ? 'coin' : 'water-drop';
  return kind < 0.85 ? 'torch-medium' : 'torch-lamp';
}
