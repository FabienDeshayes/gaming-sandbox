// The world: infinite, and derived rather than stored.
//
// Three layers sit on top of each other, and they differ in what they depend on:
//
//   terrain    — noise plus the built sanctums and landmark clearings. A pure
//                function of (x, y, seed): the same every run, forever. Floor,
//                two formations of rock, groves of trees, and the built walls.
//   unique     — the gems, the merchant, the chests, and the one compass and one
//                map lying out in the dark. Also pure in (x, y, seed), so a run
//                always finds them where the last run left them.
//   consumable — coins, water and lights. A function of (x, y, seed, salt),
//                where the salt changes every run and every time the world
//                respawns, so these are never twice in the same places.
//
// Nothing but the set of *seen* tiles ever needs remembering. No Phaser, no
// scene state — importable straight into Node for tests.
//
// Every number this file is tuned on lives in `src/balance.js`; what is here is
// the machinery that reads them.

import {
  BAND_FAR,
  BAND_MID,
  BASE_CLEARING,
  BOULDER_CHANCE,
  CHEST_COIN_VALUES,
  CHEST_PLAN,
  CHOKE_STEP,
  COIN_VALUE_MAX,
  COIN_VALUE_MIN,
  CONSUMABLE_CELL,
  EDGE_RADIUS,
  GEM_DENSITY,
  GROVE_THRESHOLD,
  HOARD_PER_KIND,
  LANDMARK_PLAN,
  MIN_SEPARATION,
  POCKET_PROBE,
  ROCK_THRESHOLD,
  SANCTUM_PLAN,
  SCATTER,
  SEED_MAX_ATTEMPTS,
  SEED_MIN_FRACTION,
  SEED_WINDOW,
  SPAWN_CHANCE,
} from '../balance.js';
import { BIOME_IDS } from '../data/biomes.js';

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
const CH_VARIANT = 9;
const CH_CHEST = 10;
const CH_BIOME = 11;
const CH_HOARD = 20; // + one per kind in a sanctum's cache
const CH_SCATTER = 40; // + four per consumable kind

// The hut: the one tile every campaign starts and ends on. Its 3x3
// neighbourhood is forced to floor so spawn can never be walled in.
export const BASE_X = 0;
export const BASE_Y = 0;

// --- The edge of the world ----------------------------------------------------
//
// Past `EDGE_RADIUS` the terrain is `'dark'` — impassable, and drawn as nothing
// at all, so what the player sees is the ground running out. Approaching it,
// `chokeAt` narrows whatever light is burning (balance.js `CHOKE_STEP`).

export function edgeDistance(x, y) {
  return Math.hypot(x, y);
}

export function beyondEdge(x, y) {
  return edgeDistance(x, y) > EDGE_RADIUS;
}

// How many tiles of reach the dark leaves a light standing here. Applied to
// whatever light is burning (`activeShape` in core/rules.js), never to the light
// itself — walk back in and it is as bright as it ever was.
export function chokeAt(x, y) {
  return Math.max(1, Math.floor((EDGE_RADIUS - edgeDistance(x, y)) / CHOKE_STEP));
}

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

// Which of a terrain's several tiles this one draws, as a roll in [0, 1). Part
// of the world rather than of the renderer for the reason everything else here
// is: it has to be the same every time you walk back past it, and nothing about
// the world is stored. Floor, rock and trees share the channel — a tile is only
// ever one of the three.
export function variantAt(x, y, seed = DEFAULT_SEED) {
  return hash(x | 0, y | 0, seed | 0, CH_VARIANT);
}

// Which kind of world this is (`src/data/biomes.js`). Derived from the seed
// like everything else here rather than written into the save: a slot's seed is
// the whole of its world's identity, so a campaign can no more drift into
// another biome than it can drift onto other ground, and a world named by
// `?seed=` in the URL is the same one every time it is opened. Hashed on the
// origin tile, because a biome is a property of the whole world and not of any
// tile in it — there is never a border between two inside one world.
export function biomeOf(seed = DEFAULT_SEED) {
  const roll = hash(0, 0, seed | 0, CH_BIOME);
  return BIOME_IDS[Math.min(BIOME_IDS.length - 1, Math.floor(roll * BIOME_IDS.length))];
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
  // Outside the world entirely. Checked before anything else so that terrain,
  // item spawning and every flood probe all agree on where the world stops.
  if (beyondEdge(x, y)) return 'dark';
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

// Whether a spot opens onto the cave system, or onto a pocket the noise happened
// to seal against its own wall — a bounded probe (balance.js `POCKET_PROBE`)
// separates the two for a few hundred lookups.
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
// of the world — nothing is stored, and a new seed relays all four. What the
// four are is balance.js `SANCTUM_PLAN`.

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
// the merchant, and the one compass and one map lying out in the dark
// (balance.js `LANDMARK_PLAN`). Each is a single tile with a forced-floor apron
// around it, so however the noise fell there is always ground to stand on next
// to it.
//
// A landmark carrying an `item` is a pickup; the merchant carries none, because
// what you do at the merchant's tile is trade, not collect.

// Whether a single-tile site with a forced-floor apron can stand here: clear of
// the sanctums, of everything already placed, and of the base clearing, and
// opening onto the cave system rather than onto a pocket — the same bar a
// sanctum door has to clear. Shared by the landmarks and the chests, which are
// placed the same way and have to stay off each other.
//
// `built` is the sanctums, passed in rather than looked up: this runs *during*
// `structures`, before the cache exists, so asking `sanctumAt` or `terrainAt`
// where a landmark can go would ask where the landmarks are.
function siteIsClear(site, seed, built, taken) {
  if (chebyshev(site.x, site.y, BASE_X, BASE_Y) <= BASE_CLEARING + 1) return false;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const x = site.x + dx;
      const y = site.y + dy;
      if (built.some((s) => chebyshev(x, y, s.centre.x, s.centre.y) <= s.radius + 1)) return false;
      if (taken.some((t) => chebyshev(x, y, t.x, t.y) <= 2)) return false;
    }
  return opensOntoCaves(
    site,
    (x, y) =>
      chebyshev(x, y, site.x, site.y) <= 1 ||
      (!built.some((s) => chebyshev(x, y, s.centre.x, s.centre.y) <= s.radius + 1) &&
        noiseTerrain(x, y, seed) === 'floor')
  );
}

function buildLandmarks(seed, built, taken) {
  const clear = (site) => siteIsClear(site, seed, built, taken);

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

// --- Chests -------------------------------------------------------------------
//
// A chest is placed exactly like a landmark — seed-derived, a forced-floor apron
// around it, checked for a way in — and differs in the one thing that matters:
// its own tile is not walkable. You open it by walking into it, which is why it
// has to be something you bump against rather than something you stand on, and
// it never blocks a light, because a box you cannot see past would be a wall
// wearing a lid (DESIGN.md §4.8).
//
// What a chest holds is fixed by the seed too: three of them hold the three
// keys, in the order the gates want them, and the rest hold a pile of coins
// picked out of balance.js `CHEST_COIN_VALUES`.

function buildChests(seed, built, taken) {
  return CHEST_PLAN.map((plan, i) => {
    const roll = randomAt(i + 1, 0, seed, CH_CHEST);
    const distance = plan.near + Math.floor(randomAt(i + 1, 1, seed, CH_CHEST) * plan.span);
    const base = roll * Math.PI * 2;
    const coins =
      CHEST_COIN_VALUES[
        Math.floor(randomAt(i + 1, 2, seed, CH_CHEST) * CHEST_COIN_VALUES.length) %
          CHEST_COIN_VALUES.length
      ];
    const holds = plan.key ? { key: plan.key } : { coins };

    for (const delta of HEADING_SEARCH) {
      const site = ringPoint(distance, base + delta * Math.PI * 2);
      if (siteIsClear(site, seed, built, taken)) {
        taken.push(site);
        return { ...plan, ...holds, index: i, x: site.x, y: site.y };
      }
    }
    // Nothing in the sweep worked; `pickSeed` is the backstop that rejects it.
    const site = ringPoint(distance, base);
    taken.push(site);
    return { ...plan, ...holds, index: i, x: site.x, y: site.y };
  });
}

// Deriving the world's structures costs a flood probe apiece, and `terrainAt`
// asks for them on every tile lookup — so they're worked out once per seed and
// kept. The cache is a derivation, not world state: nothing in it is authored,
// and a given seed always produces the same set.
const structureCache = new Map();

function structures(seed = DEFAULT_SEED) {
  const key = seed | 0;
  const cached = structureCache.get(key);
  if (cached) return cached;
  const built = buildSanctums(key);
  // Landmarks first, then chests onto the same `taken` list, so a chest can
  // never land on the merchant's apron — or on another chest.
  const taken = [];
  const marks = buildLandmarks(key, built, taken);
  const world = { sanctums: built, landmarks: marks, chests: buildChests(key, built, taken) };
  structureCache.set(key, world);
  return world;
}

export function sanctums(seed = DEFAULT_SEED) {
  return structures(seed).sanctums;
}

export function landmarks(seed = DEFAULT_SEED) {
  return structures(seed).landmarks;
}

export function chests(seed = DEFAULT_SEED) {
  return structures(seed).chests;
}

export function chestNamed(id, seed = DEFAULT_SEED) {
  return chests(seed).find((c) => c.id === id) || null;
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

// The hall: the last sanctum, the one that keeps no gem (balance.js
// `SANCTUM_PLAN`). What is behind its gate is a clearing with the sorcerer
// standing in the middle of it (DESIGN.md §4.9).
export function hall(seed = DEFAULT_SEED) {
  return sanctums(seed).find((sanctum) => sanctum.hall) || null;
}

// Whether this is the tile Nouxinha is standing on. Asked by `terrainAt`, so it
// reads the sanctum list directly rather than going back through `sanctumAt`.
export function isSorcerer(x, y, seed = DEFAULT_SEED) {
  const site = hall(seed);
  return !!site && x === site.centre.x && y === site.centre.y;
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

// Which chest a tile belongs to: the chest's own tile, or the forced-floor apron
// around it that keeps every side of it approachable whatever the noise did.
export function chestAt(x, y, seed = DEFAULT_SEED) {
  for (const chest of chests(seed)) {
    const d = chebyshev(x, y, chest.x, chest.y);
    if (d === 0) return { chest, part: 'site' };
    if (d === 1) return { chest, part: 'apron' };
  }
  return null;
}

// The tile a chest is opened from. The apron is forced floor all the way round,
// so any of the four would do; this one is what the reachability check aims at.
export function chestApproach(chest) {
  return { x: chest.x + 1, y: chest.y };
}

export function terrainAt(x, y, seed = DEFAULT_SEED) {
  const site = sanctumAt(x, y, seed);
  if (site) {
    if (site.part === 'wall') return 'wall';
    if (site.part === 'gate') return 'gate';
    // The one tile of clearing that isn't clearing: the sorcerer, standing dead
    // centre of the hall (DESIGN.md §4.9). Solid to a step and transparent to a
    // light, exactly like a chest — he is somebody standing on the floor, not a
    // piece of the world's shape.
    if (isSorcerer(x, y, seed)) return 'sorcerer';
    return 'floor'; // the clearing inside, and the apron at the door
  }
  if (landmarkAt(x, y, seed)) return 'floor'; // the landmark and its apron
  const box = chestAt(x, y, seed);
  if (box) return box.part === 'site' ? 'chest' : 'floor';
  return noiseTerrain(x, y, seed);
}

// Plain floor: what you can walk on carrying nothing. Rock, trees, sanctum wall,
// and every gate are all "no" here — a gate needs `canEnter`, which knows what
// gems you have.
export function isWalkable(x, y, seed = DEFAULT_SEED) {
  return terrainAt(x, y, seed) === 'floor';
}

// What stops a light rather than a step (DESIGN.md §4.1). Rock, trees and
// masonry all stop one dead; a gate stops it only while it is shut, so the key
// that opens a sanctum opens a window into it in the same moment it opens the
// door. A **chest doesn't stop one at all** — it is a thing standing on the
// floor, not a piece of the world's shape, and a box you could hide behind would
// read as a wall wearing a lid; the sorcerer is the same kind of thing standing
// on the same kind of tile. Everything outside the world counts as opaque too,
// which costs nothing: the world is a disc, and a straight line between two
// points inside a disc never leaves it, so the edge can never shadow ground that
// is still in play.
export function blocksSight(x, y, seed = DEFAULT_SEED, keys = null) {
  const terrain = terrainAt(x, y, seed);
  if (terrain === 'floor' || terrain === 'chest' || terrain === 'sorcerer') return false;
  if (terrain === 'gate') return !canEnter(x, y, seed, keys);
  return true;
}

// Which key a tile demands before it can be stepped on: null for open ground and
// for the one arch that stands open, the key id for every other gate. `false`
// where the tile is impassable whatever you are carrying — rock, trees, masonry,
// a chest, which is opened rather than walked through, and the sorcerer, who is
// talked to the same way.
export const ENTRY_BLOCKED = false;

export function entryKey(x, y, seed = DEFAULT_SEED) {
  const terrain = terrainAt(x, y, seed);
  if (terrain === 'floor') return null;
  if (terrain !== 'gate') return ENTRY_BLOCKED;
  return sanctumAt(x, y, seed).sanctum.key;
}

// `keys` is what the walker is carrying — anything with a `has`, so a run's own
// Set goes straight in, and `null` reads as "carrying nothing", which is the
// worst case every flood probe walks.
export function canEnter(x, y, seed = DEFAULT_SEED, keys = null) {
  const needs = entryKey(x, y, seed);
  if (needs === ENTRY_BLOCKED) return false;
  return !needs || !!(keys && keys.has(needs));
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
export function reachableFraction(seed, radius = SEED_WINDOW) {
  const seen = floodFromBase(seed, radius);
  let floor = 0;
  for (let y = -radius; y <= radius; y++)
    for (let x = -radius; x <= radius; x++) if (isWalkable(x, y, seed)) floor++;
  return floor === 0 ? 0 : seen.size / floor;
}

// Every sanctum door, every landmark and every chest has to be walkable-to from
// the hut with nothing in hand, or a gem is sealed off and the chain stops dead
// — or the merchant is somewhere no coin can ever reach, or a key is in a box
// nobody can walk up to. Only the tile *outside* each gate is checked: the
// clearing behind it is forced floor, so once you're through you can always
// reach the gem. A chest is checked by its apron for the same reason in reverse:
// its own tile is never walkable, and the apron is where you open it from.
export function landmarksReachable(seed) {
  const targets = [
    ...sanctums(seed).map((s) => s.approach),
    ...landmarks(seed).map((l) => ({ x: l.x, y: l.y })),
    ...chests(seed).map(chestApproach),
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
export function pickSeed(
  preferred = DEFAULT_SEED,
  minFraction = SEED_MIN_FRACTION,
  maxAttempts = SEED_MAX_ATTEMPTS
) {
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
// carries no item — you trade there, you don't pick it up. Neither is a chest:
// what a chest holds is handed over by opening it (core/rules.js `openChest`),
// so nothing is ever lying on its tile.
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
// lattice CONSUMABLE_CELL tiles wide and thinned so that no two of the *same*
// kind ever land closer than MIN_SEPARATION, which is what keeps items from
// arriving in clumps. Both numbers, the per-band spawn chance, the gem taper and
// the kind weights are balance.js's; this is the machinery that reads them.
//
// The cost of a lattice finer than the separation is the neighbourhood a
// candidate has to check: a conflict can come from CELL_REACH cells away rather
// than one.

const CELL_REACH = Math.ceil(MIN_SEPARATION / CONSUMABLE_CELL);

// Whether a kind is part of the world for a run holding this many gems.
function available(kind, gems) {
  if (kind.tier && gems < kind.tier) return false;
  if (kind.until && gems >= kind.until) return false;
  return true;
}

// How much the pile under a coin tile is worth (balance.js COIN_VALUE_MIN/MAX).
export function coinValue(x, y, seed = DEFAULT_SEED, salt = 0) {
  const span = COIN_VALUE_MAX - COIN_VALUE_MIN + 1;
  return COIN_VALUE_MIN + Math.floor(hash(x, y, saltedSeed(seed, salt), CH_COIN) * span);
}

// Ground a consumable can lie on. Sanctum clearings are excluded because they
// have their own rule below, and the base, landmark and chest clearings because
// they are places to arrive at, not to loot.
function spawnable(x, y, seed) {
  if (chebyshev(x, y, BASE_X, BASE_Y) <= BASE_CLEARING) return false;
  if (sanctumAt(x, y, seed)) return false;
  if (landmarkAt(x, y, seed)) return false;
  if (chestAt(x, y, seed)) return false;
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
  if (candidate.roll >= SPAWN_CHANCE[band] * GEM_DENSITY[Math.min(gems, GEM_DENSITY.length - 1)])
    return null;
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

// What a sanctum's clearing holds: exactly HOARD_PER_KIND of each kind in the
// sanctum's cache, scattered around the centre. Ranked rather than rolled, so
// opening a gate always pays the same amount — and so a clearing can never turn
// into a pile of one thing. The hall's cache is empty (balance.js), so this
// hands back nothing at all for it.
const hoardCache = new Map();

function hoardOf(sanctum, seed, salt) {
  const key = `${seed | 0}|${salt | 0}|${sanctum.index}`;
  const cached = hoardCache.get(key);
  if (cached) return cached;

  const s = saltedSeed(seed, salt);
  const held = new Map();

  const span = sanctum.radius - 1;
  const tiles = [];
  for (let dy = -span; dy <= span; dy++)
    for (let dx = -span; dx <= span; dx++) {
      // The centre is never the hoard's: it holds the sanctum's gem, out of the
      // unique layer, or — in the hall — the sorcerer himself (DESIGN.md §4.9),
      // and a pickup underneath either would be a pickup nobody could see.
      if (!dx && !dy) continue;
      tiles.push([sanctum.centre.x + dx, sanctum.centre.y + dy]);
    }

  sanctum.cache.forEach((id, i) => {
    tiles
      .filter(([tx, ty]) => !held.has(`${tx},${ty}`))
      .sort((a, b) => hash(b[0], b[1], s, CH_HOARD + i) - hash(a[0], a[1], s, CH_HOARD + i))
      .slice(0, HOARD_PER_KIND)
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
