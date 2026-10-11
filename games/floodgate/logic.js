// Pure rules for Floodgate. No Phaser here, so it can be tested in Node.
//
// Water is counted in whole units. A wave drops its units one at a time on the
// source tile; each settles on the lowest tile it can reach without stepping up
// (see pour). Damage is counted when the wave has settled, then the ground
// soaks the water up, so every wave starts on dry land.

export const SIZE = 10;
export const MAX_HEIGHT = 9;
export const HOUSES_TO_KEEP = 3; // lose when fewer than this many houses are dry
export const FIELD_DROWN = 3; // a field with this much water or more is drowned

// '.' land, S source, D drain (the sea), H house, F field
const TYPES = [
  '....S.....',
  '..........',
  '..........',
  '..........',
  '..........',
  '.F........',
  '.F........',
  '.......HH.',
  '......HH..',
  '....D.....',
];

const HEIGHTS = [
  '9999899999',
  '9999799999',
  '9998689999',
  '9986579999',
  '9746869999',
  '9338458999',
  '9338343499',
  '9668552119',
  '9998151139',
  '9999099999',
];

export const WAVES = [
  { volume: 10, actions: 4 },
  { volume: 18, actions: 3 },
  { volume: 28, actions: 3 },
];

const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

export function newGame() {
  const tiles = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const c = TYPES[y][x];
      tiles.push({
        type: { '.': 'land', S: 'source', D: 'drain', H: 'house', F: 'field' }[c],
        height: Number(HEIGHTS[y][x]),
        water: 0,
        flooded: false, // houses
        drowned: false, // fields
      });
    }
  }
  return {
    tiles,
    wave: 0, // index of the next wave
    actionsLeft: WAVES[0].actions,
    bonusNext: 0,
    status: 'playing', // playing | won | lost
    log: [],
    lastReport: null,
  };
}

export const idx = (x, y) => y * SIZE + x;

export function clone(s) {
  return { ...s, tiles: s.tiles.map((t) => ({ ...t })), log: s.log.slice() };
}

export function source(s) {
  return s.tiles.findIndex((t) => t.type === 'source');
}

export function canEdit(s, i, delta) {
  const t = s.tiles[i];
  if (s.status !== 'playing' || s.actionsLeft <= 0) return false;
  if (t.type !== 'land') return false;
  const h = t.height + delta;
  return h >= 0 && h <= MAX_HEIGHT;
}

export function edit(prev, i, delta) {
  if (!canEdit(prev, i, delta)) return prev;
  const s = clone(prev);
  s.tiles[i].height += delta;
  s.actionsLeft -= 1;
  return s;
}

const surface = (t) => t.height + t.water;

// Pour `volume` units over the tiles in place. Each unit settles on the lowest
// tile it can reach from the source without ever stepping up (flat is fine).
// Ties go to the tile found last, i.e. furthest downstream (search order: north, east, south, west).
// A unit that can reach a drain leaves the map. Returns how many drained.
function pour(tiles, from, volume) {
  let drained = 0;
  for (let n = 0; n < volume; n++) {
    const seen = new Uint8Array(tiles.length);
    const queue = [from];
    seen[from] = 1;
    let best = from, reachedDrain = false;
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q];
      if (tiles[i].type === 'drain') { reachedDrain = true; break; }
      if (surface(tiles[i]) <= surface(tiles[best])) best = i;
      const x = i % SIZE, y = Math.floor(i / SIZE);
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue;
        const j = idx(nx, ny);
        if (seen[j] || surface(tiles[j]) > surface(tiles[i])) continue;
        seen[j] = 1;
        queue.push(j);
      }
    }
    if (reachedDrain) drained++;
    else tiles[best].water += 1;
  }
  return drained;
}

export function housesDry(s) {
  return s.tiles.filter((t) => t.type === 'house' && !t.flooded).length;
}

// Run the next wave on a copy of the state and settle its consequences.
export function runWave(prev) {
  const s = clone(prev);
  const wave = WAVES[s.wave];
  for (const t of s.tiles) t.water = 0;
  const drained = pour(s.tiles, source(s), wave.volume);
  let newlyFlooded = 0, fertile = 0, newlyDrowned = 0;
  for (const t of s.tiles) {
    if (t.type === 'house' && t.water > 0 && !t.flooded) { t.flooded = true; newlyFlooded++; }
    if (t.type === 'field' && !t.drowned) {
      if (t.water >= FIELD_DROWN) { t.drowned = true; newlyDrowned++; }
      else if (t.water > 0) fertile++;
    }
  }
  const water = s.tiles.map((t) => t.water);
  s.lastReport = { wave: s.wave, volume: wave.volume, drained, newlyFlooded, fertile, newlyDrowned, water };
  s.log.push(`Wave ${s.wave + 1}: ${wave.volume} water, ${drained} reached the sea. ` +
    `${newlyFlooded} house(s) flooded, ${fertile} fertile field(s), ${newlyDrowned} drowned.`);
  s.wave += 1;
  if (housesDry(s) < HOUSES_TO_KEEP) s.status = 'lost';
  else if (s.wave >= WAVES.length) s.status = 'won';
  else s.actionsLeft = WAVES[s.wave].actions + fertile;
  s.bonusNext = fertile;
  for (const t of s.tiles) t.water = 0; // soaks away; lastReport keeps the picture
  return s;
}

// What the next wave would do to the current terrain, for the preview overlay.
export function previewWave(s) {
  if (s.wave >= WAVES.length) return null;
  const after = runWave(s);
  return {
    water: after.lastReport.water,
    drained: after.lastReport.drained,
    housesLost: after.lastReport.newlyFlooded,
    fertile: after.lastReport.fertile,
    drowned: after.lastReport.newlyDrowned,
    outcome: after.status,
  };
}
