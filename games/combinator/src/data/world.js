// The ground machines stand on, the two grids of the game, and the machines a
// new player starts with.
//
// A machine is built on the Workbench as a row of modules, and then fills one
// tile of the Playground. The tile it stands on is its ground: an open input
// anywhere in the machine draws from that ground (DESIGN.md §4, "Open ports"),
// so a pump machine standing in a puddle can pull water out of it. Embers are
// also hot every turn, so they threaten every wooden module in a machine
// standing on them.

export const TERRAIN = {
  puddle: { name: 'Puddle', provides: 'matter', hot: false },
  embers: { name: 'Embers', provides: 'heat', hot: true },
  draft: { name: 'Draft', provides: 'motion', hot: false },
};

// What the Workbench can test a machine standing on. null is bare ground.
export const GROUNDS = [null, 'puddle', 'embers', 'draft'];

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
  { name: 'Puddle Pump', ground: 'puddle', parts: ['spring', 'pump', 'sprinkler'] },
  { name: 'Steam Fan', ground: null, parts: ['burner', 'engine', 'fan'] },
];

// What the Playground holds the first time: [example index, x, y, rotation].
// The Steam Fan burns itself out on the Workbench; here, next to the Tank
// Sprinkler, its tile is wet and its wooden fan survives.
export const PLAYGROUND_START = [
  [0, 3, 3, 0],
  [2, 4, 3, 0],
  [1, 1, 4, 0],
];
