// Every gameplay number, in one object. The rules read it off `state.tuning`,
// so the simulator (sim/) and the tests can hand in a variant without touching
// src/core/. Layout and type are src/config.js; colours are src/data/palette.js.

export const DEFAULT_TUNING = {
  // An empty 6×6 board. Every tile is the same: where a piece stands matters
  // only through what is around it (its neighbours, its row and column, the
  // edge).
  cols: 6,
  rows: 6,

  // Five levels of ten turns: fifty placements onto thirty-six tiles, so the
  // back of a run is mostly replacing.
  levels: 5,
  turnsPerLevel: 10,
  offerSize: 3,

  // The board's score at the end of each level has to reach that level's
  // target. Set with `npm run sim` (DESIGN.md §8 records the numbers it gave).
  targets: [50, 130, 210, 280, 330],

  // A run plays every core set (the base set) plus this many special sets,
  // drawn from its seed. `?set=` on the URL picks one by id instead.
  specialSets: 1,

  // The offers are fixed: one scripted sequence, decided from the seed before
  // the first turn, with every piece in the run's sets equally likely and no
  // repeat inside an offer. `?seed=` on the URL swaps it for another script.
  offerSeed: 1,

  // Unused until odds and pools exist: each level's chance of each rarity,
  // in RARITIES order.
  rarityWeights: [
    [70, 25, 5, 0],
    [60, 30, 9, 1],
    [50, 33, 14, 3],
    [40, 35, 20, 5],
    [30, 35, 25, 10],
  ],
};
