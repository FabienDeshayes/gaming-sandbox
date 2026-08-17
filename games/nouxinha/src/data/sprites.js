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
//
// The border is the *whole* floor sprite: ground carries no stipple or scatter.
// The dotted grid alone is enough to tell lit ground from unknown dark, even at
// the remembered state's 30% alpha, and pixels loose in the middle of a tile
// read as noise rather than texture once the viewport is full of them.
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

// The three lights. A solid silhouette turns to mush at 16x16 once it is tinted
// flat, so each of these is drawn as an *outline* with only small solid accents:
// the hollow interior is what gives the eye an edge to read. The three also have
// to be told apart at a glance from the edge of the light, so they differ in
// silhouette rather than in detail — a thin stick, a fat stick, and a lantern.
export const TORCH_SMALL = [
  '................',
  '.......#........',
  '......#.#.......',
  '.....#...#......',
  '.....#...#......',
  '......#.#.......',
  '.....#####......',
  '.......#........',
  '.......#........',
  '.......#........',
  '.......#........',
  '.......#........',
  '.......#........',
  '.......#........',
  '.......#........',
  '................',
];

export const TORCH_MEDIUM = [
  '................',
  '.......#........',
  '......#.#.......',
  '.....#...#......',
  '....#.....#.....',
  '....#.....#.....',
  '.....#...#......',
  '....#######.....',
  '......###.......',
  '......###.......',
  '......###.......',
  '......###.......',
  '......###.......',
  '......###.......',
  '......###.......',
  '................',
];

export const TORCH_LAMP = [
  '................',
  '......###.......',
  '.....#...#......',
  '.....#...#......',
  '...#########....',
  '...#.......#....',
  '...#...#...#....',
  '...#..###..#....',
  '...#..###..#....',
  '...#.#####.#....',
  '...#.......#....',
  '...#########....',
  '....#.....#.....',
  '................',
  '................',
  '................',
];

// The water drop: a pointed tip widening into a hollow bulb with a solid
// bottom cap, same "outline with a small solid accent" language as the
// torches — and a silhouette that reads apart from both the torches' diamond
// tip and the coin's ring.
export const WATER_DROP = [
  '................',
  '.......##.......',
  '......#..#......',
  '.....#....#.....',
  '.....#....#.....',
  '....#......#....',
  '....#......#....',
  '...#........#...',
  '...#........#...',
  '..#..........#..',
  '..#..........#..',
  '..#..........#..',
  '...#........#...',
  '....#......#....',
  '.....##....##...',
  '......######....',
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
  'water-drop': WATER_DROP,
};
