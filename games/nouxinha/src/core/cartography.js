// The map's memory: turning the set of explored tiles into something a save slot
// can hold, and back.
//
// This exists because the map is the one thing a player buys that would be
// worthless without it. Everything else about a run is deliberately forgotten at
// the door (DESIGN.md §6.1) — but a map that opens blank every run is not a map,
// so owning one is exactly what makes walking persist. What is stored is
// cartography, not progress: where the ground is, never where you were standing.
//
// Pure: no Phaser, no localStorage. save.js does the storing.

// Rows are run-length encoded — "y x length x length ..." — because explored
// ground is walked in corridors, so a row is a handful of runs rather than a
// scatter of single tiles. Rows are separated by ';', numbers by ','.
//
// The cap is a ceiling on how much a save is allowed to grow over a campaign of
// many runs. Past it the furthest-out rows are dropped rather than the nearest,
// since the ground around the hut is the part worth keeping.
export const MAX_MAPPED_TILES = 40000;

export function encodeExplored(explored) {
  const rows = new Map();
  for (const key of explored) {
    const comma = key.indexOf(',');
    if (comma < 0) continue;
    const x = Number(key.slice(0, comma));
    const y = Number(key.slice(comma + 1));
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y).push(x);
  }

  // Nearest rows first, so the cap drops the far ones.
  const order = [...rows.keys()].sort((a, b) => Math.abs(a) - Math.abs(b));
  const out = [];
  let kept = 0;
  for (const y of order) {
    const xs = rows.get(y).sort((a, b) => a - b);
    if (kept + xs.length > MAX_MAPPED_TILES) break;
    kept += xs.length;
    const parts = [y];
    let start = xs[0];
    let length = 1;
    for (let i = 1; i < xs.length; i++) {
      if (xs[i] === xs[i - 1] + 1) {
        length++;
        continue;
      }
      parts.push(start, length);
      start = xs[i];
      length = 1;
    }
    parts.push(start, length);
    out.push(parts.join(','));
  }
  return out.join(';');
}

export function decodeExplored(encoded) {
  const explored = new Set();
  if (typeof encoded !== 'string' || !encoded) return explored;
  for (const row of encoded.split(';')) {
    const parts = row.split(',');
    // A row is a y plus (start, length) pairs; anything else is a corrupt save
    // and is simply skipped, the same way save.js normalises the numbers.
    if (parts.length < 3 || parts.length % 2 === 0) continue;
    const y = Number(parts[0]);
    if (!Number.isInteger(y)) continue;
    for (let i = 1; i < parts.length; i += 2) {
      const start = Number(parts[i]);
      const length = Number(parts[i + 1]);
      if (!Number.isInteger(start) || !Number.isInteger(length) || length <= 0) continue;
      if (explored.size + length > MAX_MAPPED_TILES) return explored;
      for (let n = 0; n < length; n++) explored.add(`${start + n},${y}`);
    }
  }
  return explored;
}
