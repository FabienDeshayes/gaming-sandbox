// Where every sprite lives on the tile sheet.
//
// The art is one image, `assets/tiles.png`: a 1-bit sheet of 16x16 tiles laid
// out 49 across and 22 down, with a single transparent pixel between
// neighbours. Every tile is drawn in near-white on transparent, which is what
// lets the renderer tint the whole game with the palette's foreground and keep
// the two-colour rule (DESIGN.md §9) a property of the renderer rather than of
// the art.
//
// A tile is addressed by its **(col, row)**, zero-based, origin top-left — so
// [12, 1] is the thirteenth tile across, second row down. That is the
// coordinate system used everywhere: open `tiles.html` through the same server
// the game runs on and it draws the sheet with those coordinates printed on it,
// marking the tiles this table already claims. Repointing a sprite is editing
// one pair of numbers below; nothing else in the game names a tile.
//
// A key can also name a **list** of tiles, and then the terrain alternates
// between them — one is picked per world tile, from the seed, so a rock field
// isn't the same rock stamped fifty times and the choice never changes as you
// walk back past it. Those become `key-0`, `key-1`, ... with the bare `key`
// staying as an alias for the first, for anything that just wants one of them.
// A list of one and a single tile are the same thing written two ways.
//
// What this table says is what *every* world draws, and `BIOME_TILES` below is
// where one world says otherwise — so assigning a tile here is assigning it in
// all four biomes at once, and overriding it there is a per-world exception.
// `biomes.html` is the tool for both.

export const SHEET_KEY = 'tiles';
export const SHEET_PATH = 'assets/tiles.png';

// The sheet's own geometry. `ensureTextures` checks the loaded image against
// these, so a sheet swapped for one of another size fails loudly at boot
// instead of quietly slicing every sprite off by a pixel.
export const SHEET_COLS = 49;
export const SHEET_ROWS = 22;
export const SHEET_GAP = 1;

// The tile behind each sprite key. Keys are the names the rest of the game
// draws with (`setTexture('rock')`, `def.sprite`), so this table is the only
// place that knows the sheet exists.
export const TILES = {
  // --- The character -------------------------------------------------------
  // Four tiles, one per facing: down is the face-on figure the sheet already
  // had, up is that same figure turned around (the hood closed over where the
  // face was), and left and right are a profile silhouette drawn for this
  // game, mirrored off each other.
  'wizard-down': [24, 1],
  'wizard-up': [25, 1],
  'wizard-right': [26, 1],
  'wizard-left': [27, 1],

  // --- Terrain -------------------------------------------------------------
  // Floor's tile is ground texture, drawn at half strength (FLOOR_TEXTURE_LEVEL
  // in src/config.js, derived in src/data/sprites.js) so it reads as a surface
  // without competing with the things standing on it.
  floor: [5, 0],
  // Rock and trees each alternate between several tiles, picked per world tile
  // from the seed. Rock's three are one terrain and one formation rule — a
  // mass and a loose boulder draw from the same list (DESIGN.md §4.3).
  rock: [
    [12, 4],
    [12, 1],
    [5, 2],
  ],
  tree: [
    [0, 1],
    [2, 1],
    [3, 1],
    [5, 1],
    [4, 1],
    [3, 2],
    [1, 1],
    [4, 2],
  ],
  gate: [13, 11],
  'gate-open': [12, 11],

  // --- The sanctum wall ----------------------------------------------------
  // A sanctum is a square ring of wall one tile thick (DESIGN.md §4.4), so its
  // masonry is a nine-slice: four corners, four runs, and the standalone piece
  // for a wall tile that isn't on a ring at all. They sit on the sheet in the
  // same 3x3 arrangement they are drawn in, and `wallSprite` below picks one
  // from where the tile sits on its ring.
  'wall-tl': [16, 13],
  'wall-t': [17, 13],
  'wall-tr': [18, 13],
  'wall-l': [16, 14],
  wall: [17, 14],
  'wall-r': [18, 14],
  'wall-bl': [16, 15],
  'wall-b': [17, 15],
  'wall-br': [18, 15],

  // --- Structures ----------------------------------------------------------
  base: [1, 20],
  merchant: [19, 10],
  // Nouxinha, standing at the centre of the hall (DESIGN.md §4.9): a cowled
  // figure with his hands full and his face inside the hood, and deliberately
  // not the wizard's own tile — there are two people in this world and they
  // have to read as two people. Not a biome's to repoint: he is the same man in
  // every world he makes.
  sorcerer: [24, 2],
  // The chest, shut and open. Drawn for this game — the sheet is a dungeon set
  // with no chest in it — over two of its interchangeable crates, the same way
  // three of the wizard's four facings were drawn over tiles nothing claimed.
  chest: [26, 15],
  'chest-open': [27, 15],

  // --- Landmarks -----------------------------------------------------------
  // The four named places (DESIGN.md §4.10), each with the ground its court is
  // paved with. Deliberately *not* in `BIOME_KEYS` below: a biome may repoint
  // its own rock and its own hut, but a landmark is the same object in every
  // world the hall moulds, and a world does not get to redraw it.
  //
  // Every one of these is a tile the sheet already had, standing in until they
  // are drawn for this game (`draw.html`): a press, the sheet's own bell, a
  // bare tree nothing else claims, a shaft on a stepped base, and a banner on a
  // pole for the signposts. The courts are ground textures off the top row,
  // drawn at half strength like every other floor (src/data/sprites.js).
  mint: [23, 10],
  bell: [1, 12],
  'lantern-tree': [1, 2],
  gnomon: [46, 20],
  'court-mint': [2, 0],
  'court-bell': [3, 0],
  'court-tree': [4, 0],
  'court-gnomon': [22, 14],
  signpost: [0, 7],

  // --- Items ---------------------------------------------------------------
  // The four lights climb a silhouette: candle, lantern, candelabra, and a
  // radiating burst for the beacon, which is the only one that has to read as
  // "this lights everything".
  'torch-small': [3, 15],
  'torch-medium': [43, 3],
  'torch-lamp': [5, 15],
  'torch-beacon': [44, 4],
  'water-drop': [47, 3],
  'water-flask': [41, 11],
  'spring-vial': [33, 13],
  coin: [41, 3],
  gem: [23, 4],
  // One key tile for all three, tinted by the gate it opens — the same economy
  // the three gems are drawn with.
  key: [33, 11],
  compass: [24, 14],
  map: [47, 6],

  // --- HUD -----------------------------------------------------------------
  // The cogwheel the in-run menu hangs off (DESIGN.md §7).
  cog: [45, 16],
  // The compass needle, one tile per direction. Four for now: the sheet's
  // arrows are drawn pointing, so a heading is a texture swap rather than a
  // rotation, and `compassHeading` snaps to the four these can draw.
  'arrow-up': [28, 20],
  'arrow-right': [29, 20],
  'arrow-down': [30, 20],
  'arrow-left': [31, 20],
};

// --- Biomes ------------------------------------------------------------------
//
// A world is all one biome (`src/data/biomes.js`), and a biome draws the ground
// its own way: the same wizard walks into a frozen world and finds different
// rock in it. `TILES` above is the default every biome falls back on, and a
// biome names only the keys it wants to change — so this table stays a list of
// differences rather than four copies of the sheet map, and assigning a tile
// up there is assigning it in all four worlds at once.
//
// The three terrains a world is mostly made of get spelled out in full below,
// one list per biome, because those are the ones each world is meant to own:
// its floors, its rock and its trees. They all name the shared tiles today —
// a biome that names the tile a key already had repoints nothing, so four
// biomes can spell their ground out without paying for a second copy of it —
// and repointing one of those lists is the whole of giving a world stone of
// its own. The sprites get cut (`src/data/sprites.js`), the paint follows the
// tile they were cut from (`src/data/paint.js`), and the map draws them
// (`src/ui/MapView.js`) without anything else being touched.
//
// Nothing here is authored by hand either: open `biomes.html` through a server,
// pick a key and a biome, click the tiles off the sheet, and paste back what it
// writes.
//
// Only the *world's* own tiles can be repointed, the ones in `BIOME_KEYS`
// below. Items, the character and the HUD are the same everywhere: they belong
// to the campaign that carries them from world to world, not to the ground
// under them — and they are drawn by screens (the HUD, the item card, the
// shop) that have no world to ask.
export const BIOME_TILES = {
  temperate: {
    floor: [[5, 0]],
    rock: [
      [12, 4],
      [12, 1],
      [5, 2],
    ],
    tree: [
      [0, 1],
      [2, 1],
      [3, 1],
      [5, 1],
      [4, 1],
      [3, 2],
      [1, 1],
      [4, 2],
    ],
  },
  frozen: {
    floor: [[5, 0]],
    rock: [
      [12, 4],
      [12, 1],
      [5, 2],
    ],
    tree: [
      [0, 1],
      [2, 1],
      [3, 1],
      [5, 1],
      [4, 1],
      [3, 2],
      [1, 1],
      [4, 2],
    ],
  },
  desert: {
    floor: [[5, 0]],
    rock: [
      [12, 4],
      [12, 1],
      [5, 2],
    ],
    tree: [
      [0, 1],
      [2, 1],
      [3, 1],
      [5, 1],
      [4, 1],
      [3, 2],
      [1, 1],
      [4, 2],
    ],
  },
  mystic: {
    floor: [[5, 0]],
    rock: [
      [12, 4],
      [12, 1],
      [5, 2],
    ],
    tree: [
      [0, 1],
      [2, 1],
      [3, 1],
      [5, 1],
      [4, 1],
      [3, 2],
      [1, 1],
      [4, 2],
    ],
  },
};

// What a biome is allowed to draw differently: terrain, the masonry and gates
// built into it, and the structures standing on it.
export const BIOME_KEYS = [
  'floor',
  'rock',
  'tree',
  'gate',
  'gate-open',
  'chest',
  'chest-open',
  'wall-tl',
  'wall-t',
  'wall-tr',
  'wall-l',
  'wall',
  'wall-r',
  'wall-bl',
  'wall-b',
  'wall-br',
  'base',
  'merchant',
];

// The terrains a world draws several tiles for and alternates between, which
// are the three each biome is expected to spell out in full: what it walks on,
// the stone in its way and the trees on it. Everything else a biome can repoint
// is one tile — a hut is a hut.
export const VARIANT_KEYS = ['floor', 'rock', 'tree'];

// A key's tiles, always as a list. One tile and a list of one are the same
// thing said twice, which is what lets a biome write `floor: [[5, 0]]` — a list
// of floors that happens to hold one — without that counting as repointing the
// shared `floor: [5, 0]`.
export function tileList(tile) {
  if (!tile) return [];
  return Array.isArray(tile[0]) ? tile : [tile];
}

// Tiles are numbers and lists of numbers, so this is the whole of comparing two.
const sameTile = (a, b) => JSON.stringify(tileList(a)) === JSON.stringify(tileList(b));

// Whether a biome actually draws this key differently. A biome that names a key
// and gives it the tile it already had repoints nothing — which is what lets a
// biome spell its terrain out in full without paying for a second copy of it.
//
// `biomes` is the table to read, and is only ever passed by the tests: the
// derivation is pure so it can be exercised on a biome that does repoint
// something while the real four still don't.
function repoints(key, biome, biomes = BIOME_TILES) {
  const own = biome && biomes[biome] ? biomes[biome][key] : undefined;
  return own !== undefined && !sameTile(own, TILES[key]);
}

// The tile a key draws in a biome: the biome's own, or the shared one.
export function tileFor(key, biome, biomes = BIOME_TILES) {
  const own = biome && biomes[biome] ? biomes[biome][key] : undefined;
  return own === undefined ? TILES[key] : own;
}

// The sprite key a biome draws `key` with. A biome that repoints the tile gets
// a key of its own, `rock@frozen`; every other biome shares the one texture, so
// four biomes drawing the same art cost exactly what one does.
export function biomeKey(key, biome, biomes = BIOME_TILES) {
  return repoints(key, biome, biomes) ? `${key}@${biome}` : key;
}

// The other direction: the tile a biome's sprite key is a version of, so
// anything keyed by the shared name — the paint table, above all — can be found
// from it. `rock@frozen-1` is `rock-1` seen in a frozen world.
export function baseKey(key) {
  return key.replace(/@[^-]*/, '');
}

// How many tiles a key alternates between; 1 for the single-tile ones. A biome
// can alternate between a different number of them than the shared tile does.
export function variantCount(key, biome, biomes = BIOME_TILES) {
  return tileList(tileFor(key, biome, biomes)).length;
}

// The texture key for one of a terrain's tiles, given a roll in [0, 1) — which
// the caller derives from the world (`variantAt` in src/core/world.js), so the
// same tile always draws the same way.
export function variantKey(key, roll, biome, biomes = BIOME_TILES) {
  const count = variantCount(key, biome, biomes);
  const base = biomeKey(key, biome, biomes);
  if (count <= 1) return base;
  return `${base}-${Math.min(count - 1, Math.floor(roll * count))}`;
}

// Which piece of the wall nine-slice a ring tile needs. `dx`/`dy` are the
// tile's offset from the sanctum's centre and `radius` the ring's half-width,
// so a tile is on the top run when `dy` is at the near edge, on a corner when
// both are at an edge, and the bare `wall` piece when it is on no ring at all.
export function wallSprite(dx, dy, radius) {
  const vertical = dy === -radius ? 't' : dy === radius ? 'b' : '';
  const horizontal = dx === -radius ? 'l' : dx === radius ? 'r' : '';
  const piece = vertical + horizontal;
  return piece ? `wall-${piece}` : 'wall';
}
