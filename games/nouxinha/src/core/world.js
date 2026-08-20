// The world: infinite, and derived rather than stored.
//
// Three layers sit on top of each other, and they differ in what they depend on:
//
//   terrain    — noise plus the built sanctums and landmark clearings. A pure
//                function of (x, y, seed): the same every run, forever. Floor,
//                two formations of rock, groves of trees, and the built walls.
//   unique     — the gems, the merchant, and the one compass and one map lying
//                out in the dark. Also pure in (x, y, seed), so a run always
//                finds them where the last run left them.
//   consumable — coins, water and lights. A function of (x, y, seed, salt),
//                where the salt changes every run and every time the world
//                respawns, so these are never twice in the same places.
//
// Nothing but the set of *seen* tiles ever needs remembering. No Phaser, no
// scene state — importable straight into Node for tests.

export const DEFAULT_SEED = 0x6e6f7578; // "noux"

// Distinct hash channels, so no two things ever share a stream of numbers —
// otherwise rocky ground would also be rich ground.
const CH_TERRAIN = 1;
const CH_TERRAIN_FINE = 2;
const CH_GROVE = 3;
const CH_GROVE_FINE = 4;
const CH_SANCTUM = 5;
const CH_LANDMARK = 6;
const CH_COIN = 7;
const CH_BOULDER = 8;
const CH_HOARD = 20; // + one per kind in a sanctum's cache
const CH_SCATTER = 40; // + four per consumable kind

// ~20% rock coverage. Density alone can't guarantee the base isn't walled in —
// at *any* threshold that still looks like a cave system, a slice of seeds seals
// the spawn into a pocket — so connectivity is enforced by validating the seed
// at run start instead (`pickSeed`).
const ROCK_THRESHOLD = 0.64;

// Rock comes in two formations that are the same terrain and draw the same
// sprite: the masses the threshold above grows, and loose boulders standing on
// their own out in the open. A wall you walk around and a boulder you step past
// are different things to meet even though they are the same stone, and the
// second is what keeps a wide stretch of floor from being an empty screen.
const BOULDER_CHANCE = 0.03;

// Groves: the one thing in the world that isn't stone and isn't floor. Blocking
// like rock, on a lattice coarser than the rock masses so a grove arrives as a
// stand you skirt rather than as scattered trunks, and drawn as foliage so it
// is never mistaken for a wall.
const GROVE_THRESHOLD = 0.72;

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

// The world the noise alone grows, before any sanctum or landmark is set into
// it. Placement has to ask about terrain to find a spot that isn't sealed in,
// and it can't ask `terrainAt` for that without asking where the structures are.
function noiseTerrain(x, y, seed) {
  if (chebyshev(x, y, BASE_X, BASE_Y) <= BASE_CLEARING) return 'floor';
  // Two octaves: broad masses from the coarse lattice, ragged edges from the fine one.
  const n =
    0.65 * valueNoise(x, y, seed, CH_TERRAIN, 6) +
    0.35 * valueNoise(x, y, seed, CH_TERRAIN_FINE, 3);
  if (n > ROCK_THRESHOLD) return 'rock';

  // Groves grow on a lattice of their own, so where the trees are owes nothing
  // to where the rock is and a stand can run right up against a wall.
  const g =
    0.6 * valueNoise(x, y, seed, CH_GROVE, 9) + 0.4 * valueNoise(x, y, seed, CH_GROVE_FINE, 4);
  if (g > GROVE_THRESHOLD) return 'tree';

  // Boulders are thrown as white noise rather than grown on a lattice: what
  // makes them the other kind of rock is precisely that they stand alone
  // instead of massing, so they want no shape at all.
  if (hash(x, y, seed, CH_BOULDER) < BOULDER_CHANCE) return 'rock';

  return 'floor';
}

// --- Placement ---------------------------------------------------------------

// A point at exactly `distance` in Chebyshev terms, on the heading `angle`.
// Projecting the circle onto the square ring keeps "distance from the hut" the
// same number the HUD's furthest-out counter reports.
function ringPoint(distance, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const m = Math.max(Math.abs(c), Math.abs(s));
  return { x: Math.round((distance * c) / m), y: Math.round((distance * s) / m) };
}

// A spot opens onto the cave system, or onto a pocket the noise happened to seal
// against its own wall. The two are never close: a sealed spot measures a
// handful of tiles, a real one runs past this limit long before it runs out, so
// a bounded probe separates them for a few hundred lookups.
const POCKET_PROBE = 80;

function opensOntoCaves(start, isOpen) {
  const seen = new Set([`${start.x},${start.y}`]);
  const stack = [[start.x, start.y]];
  while (stack.length && seen.size < POCKET_PROBE) {
    const [x, y] = stack.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const key = `${x + dx},${y + dy}`;
      if (seen.has(key) || !isOpen(x + dx, y + dy)) continue;
      seen.add(key);
      stack.push([x + dx, y + dy]);
    }
  }
  return seen.size >= POCKET_PROBE;
}

// Offsets as a fraction of one arc, nearest the ideal heading first, so a
// structure only moves as far as it has to.
const HEADING_SEARCH = (() => {
  const out = [0];
  for (let i = 1; i <= 10; i++) out.push(i * 0.03, -i * 0.03);
  return out;
})();

// --- Sanctums ---------------------------------------------------------------
//
// The one built structure in an otherwise noise-grown world: a ring of built
// wall around a forced-floor clearing with a gem at its centre and a single gate
// in the wall. Everything about a sanctum is derived from the seed like the rest
// of the world — nothing is stored, and a new seed relays all four.
//
// The chain is what turns three gems into a reason to keep walking: sanctum 1's
// arch stands open (gem 1 has to be reachable carrying nothing), and each gate
// after it wants the gem from the sanctum before it. `requires` is both the
// count of gems needed and the index of the gem whose colour the open gate
// takes — see config.js `gemColour`.
//
// `cache` is what the clearing holds besides the centrepiece, two of each
// (HOARD_PER_KIND) — a hoard, not a pile.

export const SANCTUM_PLAN = [
  {
    gem: 'gem-1',
    distance: 20,
    radius: 4,
    requires: 0,
    cache: ['coin', 'water-drop', 'water-flask', 'torch-medium'],
  },
  {
    gem: 'gem-2',
    distance: 45,
    radius: 5,
    requires: 1,
    cache: ['coin', 'water-drop', 'water-flask', 'torch-beacon'],
  },
  {
    gem: 'gem-3',
    distance: 80,
    radius: 6,
    requires: 2,
    cache: ['coin', 'water-drop', 'spring-vial', 'torch-beacon'],
  },
  // The last one holds no gem: it is what gem 3 is *for*, and the richest cache
  // in the game (DESIGN.md §4.4).
  {
    gem: null,
    distance: 110,
    radius: 7,
    requires: 3,
    cache: ['coin', 'water-flask', 'spring-vial', 'torch-beacon', 'torch-lamp'],
  },
];

export const HOARD_PER_KIND = 2;

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

function doorOpens(candidate, seed) {
  const { approach, centre, radius } = candidate;
  // Walked from outside, so the sanctum's own wall — gate included — is a
  // boundary, and only its apron counts as ground the noise didn't put there.
  return opensOntoCaves(approach, (x, y) => {
    const d = chebyshev(x, y, centre.x, centre.y);
    if (d <= radius) return false;
    if (chebyshev(x, y, approach.x, approach.y) <= 1) return true;
    return noiseTerrain(x, y, seed) === 'floor';
  });
}

function buildSanctums(seed) {
  const spread = (Math.PI * 2) / SANCTUM_PLAN.length;
  const heading = randomAt(0, 0, seed, CH_SANCTUM) * Math.PI * 2;

  return SANCTUM_PLAN.map((plan, i) => {
    // Evenly spaced headings, jittered within their own quarter: three gems in
    // three directions at three distances is what makes collecting them
    // exploring rather than one long walk (DESIGN.md §4.4).
    const jitter = (randomAt(i + 1, 0, seed, CH_SANCTUM) - 0.5) * spread * 0.24;
    const nominal = heading + i * spread + jitter;

    // Roughly one seed in ten drops a given sanctum somewhere its door backs
    // onto a sealed pocket. Turning that one sanctum a few degrees around the
    // hut fixes it without rerolling the whole world, which rejecting the seed
    // outright would do — and the search stays inside this sanctum's own
    // quarter of the compass, so the four never bunch into one direction.
    for (const delta of HEADING_SEARCH) {
      const candidate = buildSanctum(plan, i, nominal + delta * spread);
      if (doorOpens(candidate, seed)) return candidate;
    }
    // Nothing in the arc worked; `pickSeed` is the backstop that rejects it.
    return buildSanctum(plan, i, nominal);
  });
}

// --- Landmarks ---------------------------------------------------------------
//
// The three things in the world that aren't behind a gate and aren't rerolled:
// the merchant, and the one compass and one map lying out in the dark. Each is
// a single tile with a forced-floor apron around it, so however the noise fell
// there is always ground to stand on next to it.
//
// A landmark carrying an `item` is a pickup; the merchant carries none, because
// what you do at the merchant's tile is trade, not collect.

export const LANDMARK_PLAN = [
  // Close enough that a first expedition can reach it and walk home, and on the
  // far side of the hut from the first sanctum, so an early run has two
  // directions worth walking rather than one.
  { id: 'merchant', item: null, near: 20, span: 6, opposite: 0 },
  // Past the second sanctum: the compass is either 50 coins or a long walk.
  { id: 'compass', item: 'compass', near: 55, span: 16, opposite: null },
  // Past the third: the map is the longest walk in the game that isn't a gem.
  { id: 'map', item: 'map', near: 90, span: 16, opposite: null },
];

// `built` is the sanctums, passed in rather than looked up: this runs *during*
// `structures`, before the cache exists, so asking `sanctumAt` or `terrainAt`
// where a landmark can go would ask where the landmarks are.
function buildLandmarks(seed, built) {
  const taken = [];
  // A landmark's tile and apron can't overlap a sanctum, another landmark, or
  // the base clearing — and it has to open onto the cave system rather than a
  // pocket, the same bar a sanctum door has to clear.
  const clear = (site) => {
    if (chebyshev(site.x, site.y, BASE_X, BASE_Y) <= BASE_CLEARING + 1) return false;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const x = site.x + dx;
        const y = site.y + dy;
        if (built.some((s) => chebyshev(x, y, s.centre.x, s.centre.y) <= s.radius + 1))
          return false;
        if (taken.some((t) => chebyshev(x, y, t.x, t.y) <= 2)) return false;
      }
    return opensOntoCaves(
      site,
      (x, y) =>
        chebyshev(x, y, site.x, site.y) <= 1 ||
        (!built.some((s) => chebyshev(x, y, s.centre.x, s.centre.y) <= s.radius + 1) &&
          noiseTerrain(x, y, seed) === 'floor')
    );
  };

  return LANDMARK_PLAN.map((plan, i) => {
    const roll = randomAt(i + 1, 0, seed, CH_LANDMARK);
    const distance = plan.near + Math.floor(randomAt(i + 1, 1, seed, CH_LANDMARK) * plan.span);
    // A landmark pinned `opposite` a sanctum takes that sanctum's heading plus
    // half a turn; the rest take a heading of their own.
    const base =
      plan.opposite === null
        ? roll * Math.PI * 2
        : Math.atan2(built[plan.opposite].centre.y, built[plan.opposite].centre.x) +
          Math.PI +
          (roll - 0.5) * 0.5;

    for (const delta of HEADING_SEARCH) {
      const site = ringPoint(distance, base + delta * Math.PI * 2);
      if (clear(site)) {
        taken.push(site);
        return { ...plan, index: i, x: site.x, y: site.y };
      }
    }
    // Nothing in the sweep worked; `pickSeed` is the backstop that rejects it.
    const site = ringPoint(distance, base);
    taken.push(site);
    return { ...plan, index: i, x: site.x, y: site.y };
  });
}

// Deriving the world's structures costs a flood probe apiece, and `terrainAt`
// asks for them on every tile lookup — so they're worked out once per seed and
// kept. The cache is a derivation, not world state: nothing in it is authored,
// and a given seed always produces the same seven.
const structureCache = new Map();

function structures(seed = DEFAULT_SEED) {
  const key = seed | 0;
  const cached = structureCache.get(key);
  if (cached) return cached;
  const built = buildSanctums(key);
  const world = { sanctums: built, landmarks: buildLandmarks(key, built) };
  structureCache.set(key, world);
  return world;
}

export function sanctums(seed = DEFAULT_SEED) {
  return structures(seed).sanctums;
}

export function landmarks(seed = DEFAULT_SEED) {
  return structures(seed).landmarks;
}

export function landmarkNamed(id, seed = DEFAULT_SEED) {
  return landmarks(seed).find((l) => l.id === id) || null;
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

// Which landmark a tile belongs to: the tile itself, or the forced-floor apron
// around it that keeps it approachable whatever the noise did.
export function landmarkAt(x, y, seed = DEFAULT_SEED) {
  for (const landmark of landmarks(seed)) {
    const d = chebyshev(x, y, landmark.x, landmark.y);
    if (d === 0) return { landmark, part: 'site' };
    if (d === 1) return { landmark, part: 'apron' };
  }
  return null;
}

export function isMerchant(x, y, seed = DEFAULT_SEED) {
  const site = landmarkAt(x, y, seed);
  return !!site && site.part === 'site' && site.landmark.id === 'merchant';
}

export function terrainAt(x, y, seed = DEFAULT_SEED) {
  const site = sanctumAt(x, y, seed);
  if (site) {
    if (site.part === 'wall') return 'wall';
    if (site.part === 'gate') return 'gate';
    return 'floor'; // the clearing inside, and the apron at the door
  }
  if (landmarkAt(x, y, seed)) return 'floor'; // the landmark and its apron
  return noiseTerrain(x, y, seed);
}

// Plain floor: what you can walk on carrying nothing. Rock, trees, sanctum wall,
// and every gate are all "no" here — a gate needs `canEnter`, which knows what
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

// Every sanctum door and every landmark has to be walkable-to from the hut with
// nothing in hand, or a gem is sealed off and the chain stops dead — or the
// merchant is somewhere no coin can ever reach. Only the tile *outside* each
// gate is checked: the clearing behind it is forced floor, so once you're
// through you can always reach the gem.
export function landmarksReachable(seed) {
  const targets = [
    ...sanctums(seed).map((s) => s.approach),
    ...landmarks(seed).map((l) => ({ x: l.x, y: l.y })),
  ];
  const radius = Math.max(...targets.map((t) => chebyshev(t.x, t.y))) + 8;
  const wanted = new Set(targets.map((t) => `${t.x},${t.y}`));
  const seen = floodFromBase(seed, radius, wanted);
  return targets.every((t) => seen.has(`${t.x},${t.y}`));
}

// Returns `preferred` if it gives the player a world worth exploring, otherwise
// the first bumped seed that does. A seed has to clear two bars: the base must
// not be sealed into a pocket of a few tiles, and every sanctum gate and
// landmark must be walkable-to — both would otherwise break the promise that
// the character is never permanently stuck and that everything can be found
// (DESIGN.md §5).
//
// Rejecting bad seeds at run start is cheaper than carving guaranteed corridors
// into the noise, which would leave a visible lattice and point straight at
// each gem. It converges immediately in practice: the terrain is well connected
// at range, so the landmark check almost never bites.
export function pickSeed(preferred = DEFAULT_SEED, minFraction = 0.6, maxAttempts = 20) {
  let seed = preferred | 0;
  for (let i = 0; i < maxAttempts; i++) {
    if (reachableFraction(seed) >= minFraction && landmarksReachable(seed)) return seed;
    seed = (Math.imul(seed, 1103515245) + 12345) | 0;
  }
  return seed;
}

// --- The consumable salt ------------------------------------------------------

// Consumables are the one layer that moves. A run draws a `nonce` at the start
// so no two runs walk the same scatter, and bumps an `epoch` every time the
// world respawns — on a gem, and at the hut. Together they make the salt that
// every consumable lookup is hashed against.
export function saltOf(nonce = 0, epoch = 0) {
  return (Math.imul(nonce | 0, 0x9e3779b1) ^ Math.imul(epoch | 0, 0x85ebca6b)) | 0;
}

// Salt 0 leaves the seed alone, so an unsalted lookup is the world's own layout —
// which is what the tests and the pristine-world assertions want.
function saltedSeed(seed, salt) {
  return salt ? (seed ^ Math.imul(salt | 0, 0x27d4eb2f)) | 0 : seed | 0;
}

// --- Unique objects -----------------------------------------------------------

// Fixed for a seed and never rerolled: the gems at the sanctum centres, and the
// compass and map lying out in the dark. The merchant is a landmark too but
// carries no item — you trade there, you don't pick it up.
export function uniqueAt(x, y, seed = DEFAULT_SEED) {
  const site = sanctumAt(x, y, seed);
  if (site)
    return site.part === 'inside' && x === site.sanctum.centre.x && y === site.sanctum.centre.y
      ? site.sanctum.gem
      : null;
  const mark = landmarkAt(x, y, seed);
  return mark && mark.part === 'site' ? mark.landmark.item : null;
}

// --- Consumables ---------------------------------------------------------------
//
// Coins, water and lights: the layer that moves. Candidates are thrown on a
// lattice and thinned so that no two of the *same* kind ever land closer than
// MIN_SEPARATION, which is what keeps items from arriving in clumps.
//
// MIN_SEPARATION is that rule, and it is the one number that decides how much
// there is to find. Measured over a 141x141 window; unthinned, the same lattice
// puts something under 6.2% of its floor tiles:
//
//   D    items per floor tile   closest two of a kind ever land
//   15   1.4%                   15
//   12   1.8%                   12
//   10   2.3%                   10
//    8   2.9%                    8
//    6   3.7%                    6
//
// Spreading items out costs items: a kind can never be denser than one per DxD,
// so the world holds a fraction of what an unthinned scatter would, evenly,
// instead of several times as much in clumps. That is the trade the rule asks
// for, and this constant is where to change your mind about it.
//
// 8 is where the trade currently sits, and playtesting is what moved it there
// from 10. A light shows nine tiles and the viewport holds 165, so one item per
// 44 floor tiles meant a walk could cross several screenfuls of lit ground with
// nothing on any of them, and pushing one ring further out stopped reading as a
// decision. 8 puts something under one floor tile in 35 — about a quarter more —
// which keeps a walk paying without turning the ground into a shop. It is still
// wider than any light in the game, so a lit ring can never show the same kind
// twice. What it gives up is the outright guarantee that a screenful holds one
// of anything: at D = 8 the 11x15 viewport can hold up to four of a kind, which
// reads as a good patch of ground rather than a clump.
//
// The lattice is much finer than the separation on purpose. One candidate per
// separation-sized cell would place its points far too politely — neighbouring
// cells conflict about half the time and the loser is simply dropped, which
// throws away most of the world's items. Throwing many more darts at the same
// exclusion radius packs what survives much closer to the ceiling the rule
// allows, and still lands irregularly, because the survivors are the ones that
// won a hash rather than the ones sitting on a grid.
//
// The cost is the neighbourhood a candidate has to check: a conflict can come
// from CELL_REACH cells away rather than one.

const CONSUMABLE_CELL = 4;
export const MIN_SEPARATION = 8;
const CELL_REACH = Math.ceil(MIN_SEPARATION / CONSUMABLE_CELL);

const BAND_MID = 8;
const BAND_FAR = 20;

// How often a cell offers up a tile at all. This is the density dial; the
// weights below only decide what the offered tile turns out to be.
const SPAWN = { near: 0.9, mid: 0.95, far: 1 };

// Relative weight of each kind within a band, and the two fields that tie a kind
// to the gems: `tier` is the gem that brings it into the world, `until` the gem
// that retires it.
//
// That pair is how a gem changes the world without crowding it. It does not
// sprinkle a new tier on top of everything already lying about — it *upgrades*
// what is out there, one kind out for one kind in: the first gem retires the
// water drop for the flask, the second the medium torch for the beacon, the
// third the flask for the spring vial. The swaps are one-for-one on purpose,
// because the lattice thins a kind that gets too dense — retire two kinds for
// one and the survivors crowd each other, and the map ends up emptier the
// further you get, which is backwards.
//
// The lattice offers up the same tiles either way, so the map holds the same
// number of items after a gem as before; what changed is what they are. Walking
// ground you already walked is worth it again because everything on it is
// better, not because there is more of it.
//
// A sanctum's clearing is the exception: its cache is a hoard somebody left
// there, fixed at what the sanctum was built holding, and it doesn't upgrade.
//
// Item quality still scales with distance from the base — coins and water near
// home, the bigger torches only further out — which is what makes walking away
// worth the durability (DESIGN.md §4.3).
const SCATTER = [
  { id: 'coin', near: 5, mid: 4, far: 3 },
  { id: 'water-drop', near: 5, mid: 4, far: 2.5, until: 1 },
  { id: 'torch-small', near: 2, mid: 1, far: 0.5 },
  { id: 'torch-medium', near: 0, mid: 3, far: 2, until: 2 },
  { id: 'torch-lamp', near: 0, mid: 0, far: 1.5 },
  { id: 'water-flask', near: 5, mid: 4, far: 2.5, tier: 1, until: 3 },
  { id: 'torch-beacon', near: 0, mid: 3, far: 2.5, tier: 2 },
  { id: 'spring-vial', near: 5, mid: 4, far: 2.5, tier: 3 },
];

// Whether a kind is part of the world for a run holding this many gems.
function available(kind, gems) {
  if (kind.tier && gems < kind.tier) return false;
  if (kind.until && gems >= kind.until) return false;
  return true;
}

// A coin is a small pile, not a penny: the separation rule caps any one kind at
// a single instance per MIN_SEPARATION square, and an economy with a 100-coin
// map in it needs the pickups to be worth stopping for. Set both to 1 for
// literal one-coin coins.
export const COIN_VALUE_MIN = 1;
export const COIN_VALUE_MAX = 5;

export function coinValue(x, y, seed = DEFAULT_SEED, salt = 0) {
  const span = COIN_VALUE_MAX - COIN_VALUE_MIN + 1;
  return COIN_VALUE_MIN + Math.floor(hash(x, y, saltedSeed(seed, salt), CH_COIN) * span);
}

// Ground a consumable can lie on. Sanctum clearings are excluded because they
// have their own rule below, and the base and landmark clearings because they
// are places to arrive at, not to loot.
function spawnable(x, y, seed) {
  if (chebyshev(x, y, BASE_X, BASE_Y) <= BASE_CLEARING) return false;
  if (sanctumAt(x, y, seed)) return false;
  if (landmarkAt(x, y, seed)) return false;
  return noiseTerrain(x, y, seed) === 'floor';
}

function bandOf(distance) {
  return distance < BAND_MID ? 'near' : distance < BAND_FAR ? 'mid' : 'far';
}

function candidateIn(cx, cy, seed, salt) {
  const s = saltedSeed(seed, salt);
  return {
    x: cx * CONSUMABLE_CELL + Math.floor(hash(cx, cy, s, CH_SCATTER) * CONSUMABLE_CELL),
    y: cy * CONSUMABLE_CELL + Math.floor(hash(cx, cy, s, CH_SCATTER + 1) * CONSUMABLE_CELL),
    roll: hash(cx, cy, s, CH_SCATTER + 2),
    kindRoll: hash(cx, cy, s, CH_SCATTER + 3),
    priority: hash(cx, cy, s, CH_SCATTER + 4),
  };
}

// What a candidate would be if nothing crowded it out, or null where the cell
// is offering nothing at all.
function kindOf(candidate, seed, gems) {
  const d = chebyshev(candidate.x, candidate.y);
  const band = bandOf(d);
  if (candidate.roll >= SPAWN[band]) return null;
  if (!spawnable(candidate.x, candidate.y, seed)) return null;

  const pool = SCATTER.filter((kind) => kind[band] > 0 && available(kind, gems));
  if (!pool.length) return null;
  let pick = candidate.kindRoll * pool.reduce((sum, kind) => sum + kind[band], 0);
  for (const kind of pool) {
    pick -= kind[band];
    if (pick < 0) return kind.id;
  }
  return pool[pool.length - 1].id;
}

// A strict total order, so of two candidates too close together exactly one
// survives. A tie left unbroken would leave both standing and break the
// separation guarantee.
function beats(a, b) {
  if (a.priority !== b.priority) return a.priority > b.priority;
  if (a.x !== b.x) return a.x > b.x;
  return a.y > b.y;
}

// What a cell's candidate actually turns out to be, resolved the way darts are
// thrown one after another in priority order: a candidate is crowded out only by
// a same-kind conflict that *itself* landed. Dropping every candidate that
// merely has a stronger neighbour would keep only local maxima, which thins the
// world to a third of what the separation rule allows.
//
// The recursion terminates because it only ever walks to strictly higher
// priorities, and it is memoised per (seed, salt, gems) because a tile lookup
// asks about the same cells over and over as the viewport scrolls.
const acceptCache = new Map();
const ACCEPT_CACHE_KEYS = 8;

function acceptMemo(seed, salt, gems) {
  const key = `${seed | 0}|${salt | 0}|${gems}`;
  let memo = acceptCache.get(key);
  if (!memo) {
    // A run bumps the salt every time the world respawns, so old memos are dead
    // weight; the cache is a speed-up, never state, so dropping it is free.
    if (acceptCache.size >= ACCEPT_CACHE_KEYS) acceptCache.clear();
    memo = new Map();
    acceptCache.set(key, memo);
  }
  return memo;
}

function accepted(cx, cy, seed, salt, gems, memo) {
  const key = `${cx},${cy}`;
  if (memo.has(key)) return memo.get(key);

  const me = candidateIn(cx, cy, seed, salt);
  const mine = kindOf(me, seed, gems);
  if (!mine) {
    memo.set(key, null);
    return null;
  }

  let lands = true;
  for (let dy = -CELL_REACH; dy <= CELL_REACH && lands; dy++)
    for (let dx = -CELL_REACH; dx <= CELL_REACH && lands; dx++) {
      if (!dx && !dy) continue;
      const other = candidateIn(cx + dx, cy + dy, seed, salt);
      if (chebyshev(other.x, other.y, me.x, me.y) >= MIN_SEPARATION) continue;
      if (!beats(other, me)) continue;
      if (accepted(cx + dx, cy + dy, seed, salt, gems, memo) === mine) lands = false;
    }

  const landed = lands ? mine : null;
  memo.set(key, landed);
  return landed;
}

// What a sanctum's clearing holds: the centrepiece dead centre, and exactly
// HOARD_PER_KIND of each kind in the sanctum's cache scattered around it. Ranked
// rather than rolled, so opening a gate always pays the same amount — and so a
// clearing can never turn into a pile of one thing.
const hoardCache = new Map();

function hoardOf(sanctum, seed, salt) {
  const key = `${seed | 0}|${salt | 0}|${sanctum.index}`;
  const cached = hoardCache.get(key);
  if (cached) return cached;

  const s = saltedSeed(seed, salt);
  const held = new Map();
  // The last sanctum has no gem, so its centre holds the best water in the game.
  const centrepiece = sanctum.gem ? null : 'spring-vial';
  if (centrepiece) held.set(`${sanctum.centre.x},${sanctum.centre.y}`, centrepiece);

  const span = sanctum.radius - 1;
  const tiles = [];
  for (let dy = -span; dy <= span; dy++)
    for (let dx = -span; dx <= span; dx++) {
      if (!dx && !dy) continue; // the centrepiece's tile
      tiles.push([sanctum.centre.x + dx, sanctum.centre.y + dy]);
    }

  sanctum.cache.forEach((id, i) => {
    // The centrepiece counts against its own kind's share, so a clearing whose
    // centre already holds a spring vial gets one more rather than two.
    const room = HOARD_PER_KIND - (id === centrepiece ? 1 : 0);
    tiles
      .filter(([tx, ty]) => !held.has(`${tx},${ty}`))
      .sort((a, b) => hash(b[0], b[1], s, CH_HOARD + i) - hash(a[0], a[1], s, CH_HOARD + i))
      .slice(0, room)
      .forEach(([tx, ty]) => held.set(`${tx},${ty}`, id));
  });

  hoardCache.set(key, held);
  return held;
}

// The consumable lying on a tile in a pristine world, ignoring whether this run
// has already picked it up — see rules.js `itemOnTile` for the run-aware version.
export function consumableAt(x, y, seed = DEFAULT_SEED, salt = 0, gems = 0) {
  const site = sanctumAt(x, y, seed);
  if (site) {
    if (site.part !== 'inside') return null;
    return hoardOf(site.sanctum, seed, salt).get(`${x},${y}`) || null;
  }
  const cx = Math.floor(x / CONSUMABLE_CELL);
  const cy = Math.floor(y / CONSUMABLE_CELL);
  const candidate = candidateIn(cx, cy, seed, salt);
  if (candidate.x !== x || candidate.y !== y) return null;
  return accepted(cx, cy, seed, salt, gems, acceptMemo(seed, salt, gems));
}

// Everything lying on a tile, unique layer first: a gem or a landmark's item is
// always there whatever the run has rerolled underneath it.
export function itemAt(x, y, seed = DEFAULT_SEED, { salt = 0, gems = 0 } = {}) {
  return uniqueAt(x, y, seed) || consumableAt(x, y, seed, salt, gems);
}
