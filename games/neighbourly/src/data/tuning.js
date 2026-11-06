// Every gameplay number, in one object. The rules read it off `state.tuning`,
// so the simulator (sim/simulate.mjs) and the tests can hand in a variant
// without touching src/core/. Layout, palette and type are src/config.js.

// The board, read top row first: g = grass, w = water, r = rock. One authored
// map — the design doesn't want procedural islands. A pond in the upper left
// and a ridge running down the right, so Shore and Ridge each have a place
// they want to be and the two places are not the same.
export const TERRAIN_ROWS = [
  'gwwggg',
  'gwwgrg',
  'ggggrr',
  'grgggr',
  'grrgwg',
  'ggggww',
];

export const TERRAIN_KINDS = { g: 'grass', w: 'water', r: 'rock' };

export const DEFAULT_TUNING = {
  cols: 6,
  rows: 6,
  terrain: TERRAIN_ROWS,

  // Six levels of ten turns: sixty placements onto thirty-six tiles, so the
  // back half of a run is mostly replacing.
  levels: 6,
  turnsPerLevel: 10,
  offerSize: 3,

  // The board's score at the end of each level has to reach that level's
  // target. Set with `npm run sim` (DESIGN.md §8 records the numbers it gave).
  targets: [45, 125, 215, 290, 350, 400],

  // The offers are fixed: one scripted sequence, the same every run, drawn
  // from this seed with every piece equally likely and no repeat inside an
  // offer. `?seed=` on the URL swaps it for another script.
  offerSeed: 1,

  // Unused until odds and pools exist: each level's chance of each rarity,
  // in RARITIES order. Kept here so the field is in the one place it belongs.
  rarityWeights: [
    [70, 25, 5, 0],
    [60, 30, 9, 1],
    [50, 33, 14, 3],
    [40, 35, 20, 5],
    [33, 35, 24, 8],
    [25, 35, 28, 12],
  ],
};
