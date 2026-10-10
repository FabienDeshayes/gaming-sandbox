// The ground machines stand on, the two grids of the game, and the machines a
// new player starts with.
//
// A machine is built on the Workbench grid out of modules, and then fills one
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

// The grid a machine is built on. Every machine has this footprint inside.
export const WORKBENCH = { cols: 7, rows: 5 };

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

// The machines a new player finds saved. Each part is [type, x, y, rotation]
// on the Workbench grid; rotation is quarter turns clockwise from the
// catalogue's north-facing drawing. `ground` is what the Workbench tests the
// machine standing on.
export const EXAMPLES = [
  {
    name: 'Tank Sprinkler',
    ground: null,
    parts: [
      ['tank', 1, 2, 0],
      ['pipe', 2, 2, 0],
      ['bend', 3, 2, 0],
      ['sprinkler', 3, 1, 0],
    ],
  },
  {
    name: 'Puddle Pump',
    ground: 'puddle',
    parts: [
      ['spring', 0, 3, 0],
      ['pump', 1, 3, 0],
      ['bend', 2, 3, 0],
      ['sprinkler', 2, 2, 0],
    ],
  },
  {
    name: 'Steam Fan',
    ground: null,
    parts: [
      ['burner', 0, 2, 0],
      ['engine', 1, 2, 0],
      ['shaft', 2, 2, 0],
      ['shaft', 3, 2, 0],
      ['gear', 4, 2, 0],
      ['fan', 4, 1, 0],
    ],
  },
];

// What the Playground holds the first time: [example index, x, y, rotation].
// The Steam Fan burns itself out on the Workbench; here, next to the Tank
// Sprinkler, its tile is wet and its shaft survives.
export const PLAYGROUND_START = [
  [0, 3, 3, 0],
  [2, 4, 3, 0],
  [1, 1, 4, 0],
];
