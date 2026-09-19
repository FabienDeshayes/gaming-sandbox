// What the two roses actually place, measured without anyone playing.
//
// The bot answers "what is this world like to walk"; this answers the narrower
// question underneath it — **how far is a thing from the hut, and how much does
// that depend on which way it happens to lie**. It is worth having next to the
// playthroughs because it has no policy in it at all: nothing here decides
// anything, so nothing here can be the reason the numbers moved.
//
// Three distances per placed thing:
//
//   ring  — the number its plan in `balance.js` asked for.
//   flight— the shortest walk there if the ground were empty: the Manhattan
//           distance, because there are no diagonal steps. Under the diamond
//           rose this is the ring, near enough; under the square one it is
//           anything from the ring to twice it.
//   walk  — the shortest walk there over the real ground, flooded out of the
//           hut door holding every key. What a player actually pays.
//
// The spread of `walk` for one plan entry, across bearings and seeds, is the
// thing the whole comparison is about.

import { tileKey } from '../src/core/light.js';
import {
  BASE_X,
  BASE_Y,
  canEnter,
  chebyshev,
  chests,
  edgeDistance,
  landmarks,
  pickSeed,
  sanctums,
  signposts,
  sites,
  stones,
  wisps,
} from '../src/core/world.js';
import { KEYS } from '../src/data/items.js';
import { manhattan, STEPS } from './nav.mjs';

const ALL_KEYS = new Set(KEYS);

// Steps from the hut door to every tile the world can be walked to, holding
// every key — a gate is a doorway into its own sanctum rather than a way
// through to anywhere, so the keys open the last leg and change nothing else
// (`distances.html` floods the same way).
function walkField(seed) {
  const start = [BASE_X, BASE_Y + 1];
  const dist = new Map([[tileKey(start[0], start[1]), 0]]);
  let frontier = [start];
  let d = 0;
  while (frontier.length) {
    d += 1;
    const next = [];
    for (const [x, y] of frontier)
      for (const [, dx, dy] of STEPS) {
        const nx = x + dx;
        const ny = y + dy;
        const key = tileKey(nx, ny);
        if (dist.has(key) || !canEnter(nx, ny, seed, ALL_KEYS)) continue;
        dist.set(key, d);
        next.push([nx, ny]);
      }
    frontier = next;
  }
  return dist;
}

// What it costs to get to a thing. Anything you bump rather than stand on is
// reached from the cheapest tile beside it, plus the bump.
function costOf(dist, x, y, bump) {
  const own = dist.get(tileKey(x, y));
  if (!bump && own !== undefined) return own;
  let best = own === undefined ? Infinity : own;
  for (const [, dx, dy] of STEPS) {
    const at = dist.get(tileKey(x + dx, y + dy));
    if (at !== undefined && at + 1 < best) best = at + 1;
  }
  return Number.isFinite(best) ? best : null;
}

// Everything a plan places, with the ring it was asked for. `bump` marks the
// ones you walk into rather than onto.
function placed(seed) {
  const out = [];
  for (const s of sanctums(seed))
    out.push({ kind: 'sanctum', id: s.gem || 'hall', ring: s.distance, x: s.centre.x, y: s.centre.y, bump: !!s.hall });
  for (const l of landmarks(seed))
    out.push({ kind: 'landmark', id: l.id, ring: l.near + l.span / 2, x: l.x, y: l.y, bump: true });
  for (const c of chests(seed))
    out.push({ kind: 'chest', id: c.id, ring: c.at ? null : c.near + c.span / 2, x: c.x, y: c.y, bump: true });
  for (const s of sites(seed))
    out.push({ kind: 'site', id: s.id, ring: s.near + s.span / 2, x: s.x, y: s.y, bump: false });
  for (const p of signposts(seed))
    out.push({ kind: 'signpost', id: p.id, ring: p.near + p.span / 2, x: p.x, y: p.y, bump: true });
  for (const s of stones(seed))
    out.push({ kind: 'stone', id: s.id, ring: s.near + s.span / 2, x: s.x, y: s.y, bump: true });
  for (const w of wisps(seed))
    out.push({ kind: 'wisp', id: w.id, ring: w.near + w.span / 2, x: w.x, y: w.y, bump: true });
  return out;
}

// One world, measured.
export function survey(preferred) {
  const seed = pickSeed(preferred);
  const dist = walkField(seed);
  const rows = [];
  let rim = 0;
  for (const thing of placed(seed)) {
    const walk = costOf(dist, thing.x, thing.y, thing.bump);
    // How far out it stands as a true radius, which is the measure
    // `EDGE_RADIUS` itself is in (balance.js): the furthest of these across
    // seeds is the room the world has to reserve past its own content.
    const radius = edgeDistance(thing.x, thing.y);
    if (radius > rim) rim = radius;
    rows.push({
      ...thing,
      seed,
      cheb: chebyshev(thing.x, thing.y),
      flight: manhattan(thing.x, thing.y),
      walk,
      radius,
    });
  }
  return { seed, rows, rim, reachable: rows.filter((r) => r.walk !== null).length, placed: rows.length };
}

// --- Summarising -----------------------------------------------------------------

function stats(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
  return {
    n: values.length,
    mean,
    sd,
    // The one number the comparison turns on: the spread as a fraction of the
    // average, so a thing at ring 20 and a thing at ring 110 are comparable.
    cv: mean ? sd / mean : 0,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p10: sorted[Math.floor(sorted.length * 0.1)],
    p90: sorted[Math.floor(sorted.length * 0.9)],
  };
}

// Every seed's worth of rows, grouped by the plan entry that placed them — so
// "the Bell" is one row however many worlds it was measured in, and its spread
// is the spread of one plan entry across bearings and grounds.
export function summarise(surveys) {
  const byId = new Map();
  for (const { rows } of surveys)
    for (const row of rows) {
      const key = `${row.kind}:${row.id}`;
      if (!byId.has(key)) byId.set(key, { kind: row.kind, id: row.id, ring: row.ring, rows: [] });
      byId.get(key).rows.push(row);
    }

  const entries = [...byId.values()].map((entry) => {
    const walked = entry.rows.map((r) => r.walk).filter((w) => w !== null);
    return {
      ...entry,
      walk: stats(walked),
      flight: stats(entry.rows.map((r) => r.flight)),
      // How much further the real walk is than the straight line: the ground's
      // own tax, which the rose has nothing to do with.
      detour: stats(entry.rows.filter((r) => r.walk !== null).map((r) => r.walk / Math.max(1, r.flight))),
      // And how much further it is than its plan asked for, which is the rose's.
      stretch: entry.ring ? stats(walked.map((w) => w / entry.ring)) : null,
      unreachable: entry.rows.length - walked.length,
    };
  });

  const all = surveys.flatMap((s) => s.rows);
  return {
    entries: entries.sort((a, b) => (a.ring || 0) - (b.ring || 0)),
    rim: stats(surveys.map((s) => s.rim)),
    unreachable: all.filter((r) => r.walk === null).length,
    total: all.length,
  };
}
