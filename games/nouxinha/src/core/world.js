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
const CH_SANCTUM = 5;

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
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

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

export function chebyshev(x, y, ox = 0, oy = 0) {
  return Math.max(Math.abs(x - ox), Math.abs(y - oy));
}

export function isBase(x, y) {
  return x === BASE_X && y === BASE_Y;
}

// The world the noise alone grows, before any sanctum is set into it. Sanctum
// placement has to ask about terrain to find a spot whose door isn't sealed in,
// and it can't ask `terrainAt` for that without asking where the sanctums are.
function noiseTerrain(x, y, seed) {
  if (chebyshev(x, y, BASE_X, BASE_Y) <= BASE_CLEARING) return 'floor';
  // Two octaves: broad masses from the coarse lattice, ragged edges from the fine one.
  const n =
    0.65 * valueNoise(x, y, seed, CH_TERRAIN, 6) +
    0.35 * valueNoise(x, y, seed, CH_TERRAIN_FINE, 3);
  return n > ROCK_THRESHOLD ? 'rock' : 'floor';
}

// --- Sanctums ---------------------------------------------------------------
//
// The one structure in an otherwise noise-grown world: a ring of built wall
// around a forced-floor clearing with a gem at its centre and a single gate in
// the wall. Everything about a sanctum is derived from the seed like the rest
// of the world — nothing is stored, and a new seed relays all four.
//
// The chain is what turns three gems into a reason to keep walking: sanctum 1's
// arch stands open (gem 1 has to be reachable carrying nothing), and each gate
// after it wants the gem from the sanctum before it. `requires` is both the
// count of gems needed and the index of the gem whose colour the open gate
// takes — see config.js `gemColour`.

export const SANCTUM_PLAN = [
  { gem: 'gem-1', distance: 20, radius: 4, requires: 0 },
  { gem: 'gem-2', distance: 45, radius: 5, requires: 1 },
  { gem: 'gem-3', distance: 80, radius: 6, requires: 2 },
  // The last one holds no gem: it is what gem 3 is *for*, and the richest cache
  // in the game (DESIGN.md §4.4).
  { gem: null, distance: 110, radius: 7, requires: 3 },
];

// A point at exactly `distance` in Chebyshev terms, on the heading `angle`.
// Projecting the circle onto the square ring keeps "distance from the hut" the
// same number the HUD's furthest-out counter reports.
function ringPoint(distance, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const m = Math.max(Math.abs(c), Math.abs(s));
  return { x: Math.round((distance * c) / m), y: Math.round((distance * s) / m) };
}

// Puts the gate on the wall face pointing back at the hut, never on a corner —
// a corner tile could only be entered diagonally, and there are no diagonal
// steps. `out` is the outward step from the gate, so the tile you approach from
// is always orthogonally adjacent to the tile you walk through.
function gateOn(centre, radius) {
  const tx = -centre.x;
  const ty = -centre.y;
  const span = radius - 1;
  if (Math.abs(tx) >= Math.abs(ty)) {
    const sx = Math.sign(tx) || 1;
    const off = clamp(Math.round((ty * radius) / Math.max(1, Math.abs(tx))), -span, span);
    return { gate: { x: centre.x + sx * radius, y: centre.y + off }, out: { x: sx, y: 0 } };
  }
  const sy = Math.sign(ty) || 1;
  const off = clamp(Math.round((tx * radius) / Math.max(1, Math.abs(ty))), -span, span);
  return { gate: { x: centre.x + off, y: centre.y + sy * radius }, out: { x: 0, y: sy } };
}

function buildSanctum(plan, index, angle) {
  const centre = ringPoint(plan.distance, angle);
  const { gate, out } = gateOn(centre, plan.radius);
  return {
    ...plan,
    index,
    centre,
    gate,
    // The tile you stand on to walk through the gate. Placement guarantees this
    // one opens onto the cave system rather than a sealed pocket.
    approach: { x: gate.x + out.x, y: gate.y + out.y },
  };
}

// A door opens onto the cave system, or onto a pocket the noise happened to
// seal against the sanctum's own wall. The two are never close: a sealed door
// measures a handful of tiles, a real one runs past this limit long before it
// runs out, so a bounded probe separates them for a few hundred lookups.
const POCKET_PROBE = 80;

function doorOpens(candidate, seed) {
  const { approach, centre, radius } = candidate;
  // Walked from outside, so the sanctum's own wall — gate included — is a
  // boundary, and only its apron counts as ground the noise didn't put there.
  const open = (x, y) => {
    const d = chebyshev(x, y, centre.x, centre.y);
    if (d <= radius) return false;
    if (chebyshev(x, y, approach.x, approach.y) <= 1) return true;
    return noiseTerrain(x, y, seed) === 'floor';
  };

  const seen = new Set([`${approach.x},${approach.y}`]);
  const stack = [[approach.x, approach.y]];
  while (stack.length && seen.size < POCKET_PROBE) {
    const [x, y] = stack.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const key = `${x + dx},${y + dy}`;
      if (seen.has(key) || !open(x + dx, y + dy)) continue;
      seen.add(key);
      stack.push([x + dx, y + dy]);
    }
  }
  return seen.size >= POCKET_PROBE;
}

// Offsets as a fraction of one sanctum's arc, nearest the ideal heading first,
// so a sanctum only moves as far as it has to.
const HEADING_SEARCH = (() => {
  const out = [0];
  for (let i = 1; i <= 10; i++) out.push(i * 0.03, -i * 0.03);
  return out;
})();

// Deriving four sanctums costs a flood probe apiece, and `terrainAt` asks for
// them on every tile lookup — so they're worked out once per seed and kept.
const sanctumCache = new Map();

export function sanctums(seed = DEFAULT_SEED) {
  const key = seed | 0;
  const cached = sanctumCache.get(key);
  if (cached) return cached;

  const spread = (Math.PI * 2) / SANCTUM_PLAN.length;
  const heading = randomAt(0, 0, key, CH_SANCTUM) * Math.PI * 2;

  const built = SANCTUM_PLAN.map((plan, i) => {
    // Evenly spaced headings, jittered within their own quarter: three gems in
    // three directions at three distances is what makes collecting them
    // exploring rather than one long walk (DESIGN.md §4.4).
    const jitter = (randomAt(i + 1, 0, key, CH_SANCTUM) - 0.5) * spread * 0.24;
    const nominal = heading + i * spread + jitter;

    // Roughly one seed in six drops a given sanctum somewhere its door backs
    // onto a sealed pocket. Turning that one sanctum a few degrees around the
    // hut fixes it without rerolling the whole world, which rejecting the seed
    // outright would do — and the search stays inside this sanctum's own
    // quarter of the compass, so the four never bunch into one direction.
    for (const delta of HEADING_SEARCH) {
      const candidate = buildSanctum(plan, i, nominal + delta * spread);
      if (doorOpens(candidate, key)) return candidate;
    }
    // Nothing in the arc worked; `pickSeed` is the backstop that rejects it.
    return buildSanctum(plan, i, nominal);
  });

  sanctumCache.set(key, built);
  return built;
}

// Which sanctum a tile belongs to, and what part of it: the walled ring, the
// gate in that ring, the clearing inside, or the forced-floor apron just
// outside the gate that keeps the door approachable whatever the noise did.
export function sanctumAt(x, y, seed = DEFAULT_SEED) {
  for (const sanctum of sanctums(seed)) {
    const d = chebyshev(x, y, sanctum.centre.x, sanctum.centre.y);
    if (d < sanctum.radius) return { sanctum, part: 'inside' };
    // The ring is solid wall bar the one gate tile — the apron below can only
    // ever claim ground *outside* it, so a door can't punch a second hole.
    if (d === sanctum.radius)
      return x === sanctum.gate.x && y === sanctum.gate.y
        ? { sanctum, part: 'gate' }
        : { sanctum, part: 'wall' };
    if (chebyshev(x, y, sanctum.approach.x, sanctum.approach.y) <= 1)
      return { sanctum, part: 'apron' };
  }
  return null;
}

export function terrainAt(x, y, seed = DEFAULT_SEED) {
  const site = sanctumAt(x, y, seed);
  if (site) {
    if (site.part === 'wall') return 'wall';
    if (site.part === 'gate') return 'gate';
    return 'floor'; // the clearing inside, and the apron at the door
  }
  return noiseTerrain(x, y, seed);
}

// Plain floor: what you can walk on carrying nothing. Rock, sanctum wall, and
// every gate are all "no" here — a gate needs `canEnter`, which knows what
// gems you have.
export function isWalkable(x, y, seed = DEFAULT_SEED) {
  return terrainAt(x, y, seed) === 'floor';
}

// How many gems a tile demands before it can be stepped on: 0 for open ground,
// and for a gate the number of gems its sanctum wants. Null where the tile is
// impassable however much you're carrying.
export function entryCost(x, y, seed = DEFAULT_SEED) {
  const terrain = terrainAt(x, y, seed);
  if (terrain === 'floor') return 0;
  if (terrain !== 'gate') return null;
  return sanctumAt(x, y, seed).sanctum.requires;
}

export function canEnter(x, y, seed = DEFAULT_SEED, gems = 0) {
  const cost = entryCost(x, y, seed);
  return cost !== null && cost <= gems;
}

// --- Connectivity -----------------------------------------------------------

// Flood-fills the walkable tiles reachable from the base inside a window,
// treating every gate as shut — the worst case, and the one a run has to be
// able to walk out of. `stopAt` lets a caller bail as soon as it has its answer.
function floodFromBase(seed, radius, stopAt = null) {
  const seen = new Set(['0,0']);
  const stack = [[BASE_X, BASE_Y]];
  let remaining = stopAt ? stopAt.size : -1;
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
      if (stopAt && stopAt.has(key) && --remaining === 0) return seen;
    }
  }
  return seen;
}

// How much of the floor within `radius` of the base you can actually walk to.
// The world is infinite, so this only ever samples a window — but a spawn that
// can reach most of a 40-tile window is a spawn that isn't in a pocket.
export function reachableFraction(seed, radius = 40) {
  const seen = floodFromBase(seed, radius);
  let floor = 0;
  for (let y = -radius; y <= radius; y++)
    for (let x = -radius; x <= radius; x++) if (isWalkable(x, y, seed)) floor++;
  return floor === 0 ? 0 : seen.size / floor;
}

// Every sanctum door has to be walkable-to from the hut, or a gem is sealed
// off and the chain stops dead. Only the tile *outside* each gate is checked:
// the clearing behind the gate is forced floor, so once you're through you can
// always reach the gem.
export function gatesReachable(seed) {
  const doors = sanctums(seed).map((s) => s.approach);
  const radius = Math.max(...doors.map((d) => chebyshev(d.x, d.y))) + 8;
  const targets = new Set(doors.map((d) => `${d.x},${d.y}`));
  const seen = floodFromBase(seed, radius, targets);
  return doors.every((d) => seen.has(`${d.x},${d.y}`));
}

// Returns `preferred` if it gives the player a world worth exploring, otherwise
// the first bumped seed that does. A seed has to clear two bars: the base must
// not be sealed into a pocket of a few tiles, and every sanctum gate must be
// walkable-to — both would otherwise break the promise that the character is
// never permanently stuck and that all three gems can be found (DESIGN.md §5).
//
// Rejecting bad seeds at run start is cheaper than carving guaranteed corridors
// into the noise, which would leave a visible lattice and point straight at
// each gem. It converges immediately in practice: the terrain is well connected
// at range, so the gate check almost never bites.
export function pickSeed(preferred = DEFAULT_SEED, minFraction = 0.6, maxAttempts = 20) {
  let seed = preferred | 0;
  for (let i = 0; i < maxAttempts; i++) {
    if (reachableFraction(seed) >= minFraction && gatesReachable(seed)) return seed;
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

// A sanctum clearing is a hoard, not open ground: most of its tiles hold
// something, which is what makes opening a gate feel like it paid.
const SANCTUM_SPAWN = 0.35;

export function spawnChance(distance) {
  const t = Math.min(distance, SPAWN_FALLOFF) / SPAWN_FALLOFF;
  return SPAWN_NEAR + (SPAWN_FAR - SPAWN_NEAR) * t;
}

// What lies in a sanctum's clearing: the gem dead centre, and a cache of the
// tier that gem unlocks scattered around it. The last sanctum has no gem, so it
// holds the best of everything instead.
function sanctumItemAt(x, y, sanctum, seed) {
  if (x === sanctum.centre.x && y === sanctum.centre.y) return sanctum.gem || 'spring-vial';
  if (randomAt(x, y, seed, CH_ITEM) >= SANCTUM_SPAWN) return null;

  const kind = randomAt(x, y, seed, CH_ITEM_KIND);
  const tier = sanctum.gem ? sanctum.index + 1 : 3;
  if (kind < 0.3) return 'coin';
  if (kind < 0.45) return 'water-drop';
  if (tier === 1) return kind < 0.8 ? 'water-flask' : 'torch-medium';
  if (tier === 2) return kind < 0.7 ? 'water-flask' : 'torch-beacon';
  return kind < 0.6 ? 'spring-vial' : kind < 0.85 ? 'torch-beacon' : 'water-flask';
}

// The item lying on a tile in a pristine world, ignoring whether this run has
// already picked it up and whether the player has the gems to *see* it — see
// rules.js `itemOnTile` for the run-aware version.
//
// The gem-tier items carve their share out of what would otherwise be a coin or
// a water drop, at every band, without moving the torch thresholds — so a
// change here can never shift where a medium or lamp torch spawns.
export function itemAt(x, y, seed = DEFAULT_SEED) {
  const site = sanctumAt(x, y, seed);
  if (site) return site.part === 'inside' ? sanctumItemAt(x, y, site.sanctum, seed) : null;

  const d = chebyshev(x, y, BASE_X, BASE_Y);
  if (d <= BASE_CLEARING) return null;
  if (!isWalkable(x, y, seed)) return null;
  if (randomAt(x, y, seed, CH_ITEM) >= spawnChance(d)) return null;

  const kind = randomAt(x, y, seed, CH_ITEM_KIND);
  if (d < BAND_MID) return kind < 0.5 ? 'coin' : 'water-drop';
  if (d < BAND_FAR) {
    if (kind < 0.75) return kind < 0.45 ? 'coin' : kind < 0.68 ? 'water-drop' : 'water-flask';
    return 'torch-medium';
  }
  if (kind < 0.6) {
    if (kind < 0.3) return 'coin';
    if (kind < 0.44) return 'water-drop';
    if (kind < 0.5) return 'water-flask';
    return kind < 0.55 ? 'torch-beacon' : 'spring-vial';
  }
  return kind < 0.85 ? 'torch-medium' : 'torch-lamp';
}
