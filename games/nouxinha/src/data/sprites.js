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

// A gem: table, crown, girdle, and a pavilion tapering to a point, with the
// facet lines carried right through. Drawn once and tinted three different ways
// — the colour a gem gave back *is* how you tell it from the other two, so
// three separate masks would be three ways to say the same thing.
export const GEM = [
  '................',
  '....########....',
  '...#.#....#.#...',
  '..#..#....#..#..',
  '.##############.',
  '..#...#..#...#..',
  '...#..#..#..#...',
  '...#..#..#..#...',
  '....#.#..#.#....',
  '....#.#..#.#....',
  '.....##..##.....',
  '.....#....#.....',
  '......#..#......',
  '.......##.......',
  '................',
  '................',
];

// Sanctum wall: coursed masonry with staggered joints. Rock is a blob and this
// is a grid, which is the whole point — a sanctum has to read as *built* from
// the edge of your light, or a player walks its perimeter thinking it's terrain.
export const WALL = [
  '################',
  '#....#....#....#',
  '#....#....#....#',
  '################',
  '..#....#....#...',
  '..#....#....#...',
  '################',
  '#....#....#....#',
  '#....#....#....#',
  '################',
  '..#....#....#...',
  '..#....#....#...',
  '################',
  '#....#....#....#',
  '#....#....#....#',
  '################',
];

// A shut gate: an arch, barred. Drawn in the palette's own foreground like the
// wall it sits in, because a gate you can't open yet is just more wall.
export const GATE = [
  '................',
  '....########....',
  '..##........##..',
  '.#............#.',
  '.#..#..##..#..#.',
  '.#..#..##..#..#.',
  '.#..#..##..#..#.',
  '.##############.',
  '.#..#..##..#..#.',
  '.#..#..##..#..#.',
  '.#..#..##..#..#.',
  '.#..#..##..#..#.',
  '.#..#..##..#..#.',
  '.#..#..##..#..#.',
  '.##############.',
  '................',
];

// The same arch with the bars gone and the leaves folded back against the
// jambs, drawn in the colour of the gem that opened it (DESIGN.md §9).
export const GATE_OPEN = [
  '................',
  '....########....',
  '..##........##..',
  '.#............#.',
  '.##..........##.',
  '.##..........##.',
  '.##..........##.',
  '.##..........##.',
  '.##..........##.',
  '.##..........##.',
  '.##..........##.',
  '.##..........##.',
  '.##..........##.',
  '.##..........##.',
  '.##############.',
  '................',
];

// The gem-tier waters. Both have to read apart from the water drop at a glance,
// since all three sit on the ground looking useful: the drop is a teardrop, the
// flask is square-shouldered and hard-sided, the vial is round-bottomed and
// sparkling. Each is drawn with its water pooled solid inside the outline.
export const WATER_FLASK = [
  '................',
  '......####......',
  '......#..#......',
  '......#..#......',
  '.....##..##.....',
  '....#......#....',
  '...#........#...',
  '..#..........#..',
  '..#..........#..',
  '..#..........#..',
  '..#..........#..',
  '..#...####...#..',
  '..#..######..#..',
  '..#.########.#..',
  '..############..',
  '................',
];

export const SPRING_VIAL = [
  '...#........#...',
  '....#..##..#....',
  '.....######.....',
  '......#..#......',
  '..#...#..#...#..',
  '...#.#....#.#...',
  '.....#....#.....',
  '....#......#....',
  '....#......#....',
  '...#........#...',
  '...#.######.#...',
  '...#.######.#...',
  '....########....',
  '.....######.....',
  '......####......',
  '................',
];

// The beacon: a brazier on splayed legs, throwing sparks. The three torches
// differ from each other by silhouette and so does this — nothing else in the
// game is a wide bowl on a stem.
export const TORCH_BEACON = [
  '................',
  '.......##.......',
  '......####......',
  '..#..######..#..',
  '..#.#.####.#.#..',
  '...#..####..#...',
  '..############..',
  '..#..........#..',
  '...#........#...',
  '....########....',
  '.......##.......',
  '.......##.......',
  '......####......',
  '.....##..##.....',
  '....##....##....',
  '................',
];

// The left-facing wizard is the right-facing mask mirrored — same silhouette,
// same staff hand, no second drawing to keep in sync.
export function mirror(mask) {
  return mask.map((row) => row.split('').reverse().join(''));
}

// The wizard wears one colour per gem recovered, plus the base colour they
// start with (DESIGN.md §9). A single sprite can only take one tint, so each
// facing is split into four horizontal bands — top to bottom, hat tip to
// staff foot — baked as their own masks and stacked back into the same
// silhouette at draw time. Band 0 is always the palette's own foreground;
// bands 1-3 turn the colour of gems one, two and three once carried, so the
// character accumulates colour instead of just swapping it.
export const WIZARD_ZONES = 4;

function zoneMask(mask, zone) {
  const bandSize = Math.ceil(mask.length / WIZARD_ZONES);
  const lo = zone * bandSize;
  const hi = lo + bandSize;
  const blank = '.'.repeat(mask[0].length);
  return mask.map((row, y) => (y >= lo && y < hi ? row : blank));
}

function wizardZones(mask, key) {
  const out = {};
  for (let zone = 0; zone < WIZARD_ZONES; zone++) out[`${key}-${zone}`] = zoneMask(mask, zone);
  return out;
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
  ...wizardZones(WIZARD_DOWN, 'wizard-down'),
  ...wizardZones(WIZARD_UP, 'wizard-up'),
  ...wizardZones(WIZARD_RIGHT, 'wizard-right'),
  ...wizardZones(mirror(WIZARD_RIGHT), 'wizard-left'),
  rock: ROCK,
  ...FLOOR_VARIANTS,
  base: BASE,
  wall: WALL,
  gate: GATE,
  'gate-open': GATE_OPEN,
  coin: COIN,
  'torch-small': TORCH_SMALL,
  'torch-medium': TORCH_MEDIUM,
  'torch-lamp': TORCH_LAMP,
  'torch-beacon': TORCH_BEACON,
  'water-drop': WATER_DROP,
  'water-flask': WATER_FLASK,
  'spring-vial': SPRING_VIAL,
  gem: GEM,
};
