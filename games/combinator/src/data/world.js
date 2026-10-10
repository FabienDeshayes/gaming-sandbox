// The ground machines stand on, what can be left on a tile, the two grids of
// the game, and the machines a new player starts with.
//
// A machine is built on the Workbench as a row of modules, and then fills one
// tile of the Playground. The tile it stands on is its ground: an open input
// anywhere in the machine draws from it (DESIGN.md §4, "Open ports"), so the
// same machine takes its Energy from embers in one place and from a draft in
// another. Embers are also hot, so they threaten every wooden module in a
// machine standing on them while it works.

export const TERRAIN = {
  puddle: { name: 'Puddle', provides: 'liquid', hot: false },
  sand: { name: 'Sand', provides: 'solid', hot: false },
  vent: { name: 'Gas Vent', provides: 'gas', hot: false },
  embers: { name: 'Embers', provides: 'energy', hot: true },
  draft: { name: 'Draft', provides: 'energy', hot: false },
};

// What a machine leaves on tiles, and the element a machine standing on such a
// tile can draw from it afterwards. Effectors leave these on the tiles they
// reach; an open output leaves one on its own machine's tile (SPILL). A tile
// keeps what it has been given until the run is reset.
export const CONDITIONS = {
  wet: { name: 'Wet', gives: 'liquid', what: 'water' },
  sand: { name: 'Sand', gives: 'solid', what: 'sand' },
  fumes: { name: 'Fumes', gives: 'gas', what: 'fumes' },
  wind: { name: 'Wind', gives: 'energy', what: 'wind' },
  hot: { name: 'Hot', gives: 'energy', what: 'heat' },
};

// What an output nobody takes leaves on its machine's tile.
export const SPILL = { liquid: 'wet', solid: 'sand', gas: 'fumes', energy: 'hot' };

// What the Workbench can test a machine standing on. null is bare ground.
export const GROUNDS = [null, 'puddle', 'sand', 'vent', 'embers', 'draft'];

// A machine is a row of at most this many modules, side by side.
export const WORKBENCH = { slots: 7 };

// The grid machines are placed on. One machine per tile.
export const PLAYGROUND = {
  cols: 10,
  rows: 7,
  terrain: {
    '1,4': 'puddle',
    '1,5': 'puddle',
    '2,5': 'puddle',
    '5,0': 'sand',
    '6,0': 'sand',
    '0,1': 'vent',
    '0,2': 'vent',
    '7,1': 'embers',
    '8,1': 'embers',
    '7,2': 'embers',
    '8,5': 'draft',
    '8,6': 'draft',
  },
};

// The machines a new player finds saved: their modules, left to right.
// `ground` is what the Workbench tests the machine standing on.
export const EXAMPLES = [
  { name: 'Tank Sprinkler', ground: null, parts: ['tank', 'sprinkler'] },
  { name: 'Puddle Torch', ground: 'puddle', parts: ['battery', 'boiler', 'torch'] },
  { name: 'Steam Fan', ground: null, parts: ['bottle', 'engine', 'fan'] },
];

// What the Playground holds the first time: [example index, x, y, rotation].
// The Steam Fan burns itself out on the Workbench; here, once the Tank
// Sprinkler beside it has worked, its tile is wet and its wooden fan survives.
export const PLAYGROUND_START = [
  [0, 3, 3, 0],
  [2, 4, 3, 0],
  [1, 1, 4, 0],
];
