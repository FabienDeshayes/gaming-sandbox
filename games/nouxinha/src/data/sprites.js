// Every sprite in the game, as a 16x16 1-bit mask.
//
// '#' is a lit pixel, '.' is transparent. Masks are baked into white textures at
// boot (src/ui/textures.js) and tinted with the palette's foreground colour at
// draw time, which is what keeps the two-colour rule (DESIGN.md §9) a property
// of the renderer rather than something each asset has to be re-authored for.
//
// Kept as text rather than PNGs on purpose: the art *is* the data, it diffs in
// git, and it needs no build step or image editor to change.

// The wizard: pointed hat, robe, staff. At 16x16 the hat silhouette and the
// staff line are the whole identity, so those two shapes are what the masks
// protect. Facing is mechanically load-bearing — the lamp torch's cone points
// wherever the wizard does — so the four views have to read apart instantly.
export const WIZARD_DOWN = [
  '................',
  '......#.........',
  '.....###........',
  '.....###.....#..',
  '....#####...###.',
  '....#####....#..',
  '...#######...#..',
  '..#########..#..',
  '...######....#..',
  '...#.##.#....#..',
  '...######....#..',
  '..########...#..',
  '..########...#..',
  '.##########..#..',
  '.##########..#..',
  '..###..###......',
];

export const WIZARD_UP = [
  '................',
  '......#.........',
  '.....###........',
  '.....###.....#..',
  '....#####...###.',
  '....#####....#..',
  '...#######...#..',
  '..#########..#..',
  '...######....#..',
  '...######....#..',
  '...######....#..',
  '..########...#..',
  '..########...#..',
  '.##########..#..',
  '.##########..#..',
  '..###..###......',
];

export const WIZARD_RIGHT = [
  '................',
  '..#.............',
  '..##............',
  '..###...........',
  '..####..........',
  '..#####.........',
  '.#######........',
  '.#########......',
  '...#####........',
  '...###.#........',
  '...#####..###...',
  '..######...#....',
  '..######...#....',
  '.#######...#....',
  '.#######...#....',
  '..##..##...#....',
];

// Rock: the inverse weight to floor — a dense, near-solid mask, so a wall reads
// as a mass while floor reads as a surface.
export const ROCK = [
  '..############..',
  '.##############.',
  '################',
  '#####.##########',
  '################',
  '###########.####',
  '################',
  '##############.#',
  '##.#############',
  '################',
  '################',
  '#########.######',
  '################',
  '###.############',
  '.##############.',
  '..############..',
];

// Floor: a dotted border on the top and left edges only, so the edge shared by
// two tiles is drawn once rather than twice. The right and bottom edges are
// added back per-tile (see FLOOR_VARIANTS) when the neighbour on that side is
// still unknown — otherwise explored ground would trail off with no boundary.
export const FLOOR = [
  '#.#.#.#.#.#.#.#.',
  '................',
  '#...............',
  '................',
  '#...............',
  '................',
  '#...............',
  '................',
  '#...............',
  '................',
  '#...............',
  '................',
  '#...............',
  '................',
  '#...............',
  '................',
];

// Floor decoration: floor is never plain (DESIGN.md §9), but it has to stay
// sparse — the wizard and items must still pop, and at the remembered state's
// 30% alpha these few pixels are the *only* thing telling explored ground apart
// from unknown dark. Which variant a tile gets comes from the world seed, so a
// tile looks the same every time you re-light it.
export const DECOR = [
  [
    '................',
    '................',
    '................',
    '................',
    '................',
    '.....#..........',
    '................',
    '................',
    '................',
    '................',
    '..........#.....',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '......#.........',
    '.......#........',
    '.......#........',
    '........#.......',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.......##.......',
    '......####......',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '......#.#.......',
    '.......#........',
    '.......#........',
    '................',
    '................',
    '................',
    '................',
  ],
  [
    '................',
    '................',
    '................',
    '................',
    '....#...........',
    '................',
    '................',
    '................',
    '...........#....',
    '................',
    '................',
    '................',
    '......#.........',
    '................',
    '................',
    '................',
  ],
  [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.........#......',
    '................',
    '................',
    '................',
    '....##..........',
    '................',
    '................',
    '................',
    '................',
  ],
];

// The base at (0, 0): a hut with a flag, so it's recognisable from the edge of
// your light. The one tile that is always on the map.
export const BASE = [
  '................',
  '................',
  '.......#........',
  '.......###......',
  '.......##.......',
  '.......#........',
  '.......#........',
  '......###.......',
  '.....#####......',
  '....#######.....',
  '...#########....',
  '...#.......#....',
  '...#..###..#....',
  '...#..#.#..#....',
  '...#..#.#..#....',
  '...#########....',
];

export const COIN = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '......####......',
  '.....######.....',
  '....###..###....',
  '....##....##....',
  '....##....##....',
  '....###..###....',
  '.....######.....',
  '......####......',
  '................',
  '................',
  '................',
];

export const TORCH_SMALL = [
  '................',
  '................',
  '.......#........',
  '......#.#.......',
  '......###.......',
  '.....#####......',
  '.....#####......',
  '......###.......',
  '.......#........',
  '.......#........',
  '.......#........',
  '.......#........',
  '.......#........',
  '......###.......',
  '.......#........',
  '................',
];

export const TORCH_MEDIUM = [
  '................',
  '.......#........',
  '......###.......',
  '.....#####......',
  '....#######.....',
  '....#######.....',
  '...#########....',
  '....#######.....',
  '.....#####......',
  '......###.......',
  '......###.......',
  '......###.......',
  '......###.......',
  '.....#####......',
  '......###.......',
  '................',
];

export const TORCH_LAMP = [
  '................',
  '......####......',
  '.....#....#.....',
  '.......##.......',
  '....########....',
  '....########....',
  '...#........#...',
  '...#..####..#...',
  '...#.######.#...',
  '...#.######.#...',
  '...#..####..#...',
  '...#........#...',
  '....########....',
  '....########....',
  '................',
  '................',
];

// The left-facing wizard is the right-facing mask mirrored — same silhouette,
// same staff hand, no second drawing to keep in sync.
export function mirror(mask) {
  return mask.map((row) => row.split('').reverse().join(''));
}

// The four floor tiles: the base pattern, plus the versions that close off the
// right edge, the bottom edge, or both. A tile picks its variant from whether
// those neighbours have been lit yet, so the frontier of explored ground reads
// as a boundary instead of an unfinished grid.
const EDGE_DOTS = '#.#.#.#.#.#.#.#.';

function withRightEdge(mask) {
  return mask.map((row, y) => (y % 2 === 0 ? row.slice(0, 15) + '#' : row));
}

function withBottomEdge(mask) {
  return mask.map((row, y) => (y === 15 ? EDGE_DOTS : row));
}

export const FLOOR_VARIANTS = {
  floor: FLOOR,
  'floor-r': withRightEdge(FLOOR),
  'floor-b': withBottomEdge(FLOOR),
  'floor-rb': withBottomEdge(withRightEdge(FLOOR)),
};

export const SPRITES = {
  'wizard-down': WIZARD_DOWN,
  'wizard-up': WIZARD_UP,
  'wizard-right': WIZARD_RIGHT,
  'wizard-left': mirror(WIZARD_RIGHT),
  rock: ROCK,
  ...FLOOR_VARIANTS,
  base: BASE,
  coin: COIN,
  'torch-small': TORCH_SMALL,
  'torch-medium': TORCH_MEDIUM,
  'torch-lamp': TORCH_LAMP,
  ...Object.fromEntries(DECOR.map((mask, i) => [`decor-${i}`, mask])),
};
