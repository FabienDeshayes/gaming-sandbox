// The test bench: a small fixed patch of ground to build and test on, and a
// few example machines to load onto it.
//
// Terrain is what an open input draws from (DESIGN.md §4, "Open ports"): a
// module standing on a puddle can pull water out of the ground through any
// unconnected Matter input. Embers are also hot, every turn, so they threaten
// wooden modules the same way waste heat does.

export const TERRAIN = {
  puddle: { name: 'Puddle', provides: 'matter', hot: false },
  embers: { name: 'Embers', provides: 'heat', hot: true },
  draft: { name: 'Draft', provides: 'motion', hot: false },
};

export const BENCH = {
  cols: 7,
  rows: 5,
  terrain: {
    '0,3': 'puddle',
    '1,3': 'puddle',
    '5,0': 'embers',
    '6,0': 'embers',
    '6,3': 'draft',
    '6,4': 'draft',
  },
};

// Each example is a list of [type, x, y, rotation]. Rotation is quarter turns
// clockwise from the catalogue's north-facing drawing.
export const EXAMPLES = [
  {
    name: 'Tank to sprinkler',
    parts: [
      ['tank', 1, 2, 0],
      ['pipe', 2, 2, 0],
      ['bend', 3, 2, 0],
      ['sprinkler', 3, 1, 0],
    ],
  },
  {
    name: 'Pump from a puddle',
    parts: [
      ['spring', 0, 3, 0],
      ['pump', 1, 3, 0],
      ['bend', 2, 3, 0],
      ['sprinkler', 2, 2, 0],
    ],
  },
  {
    name: 'Steam fan',
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
