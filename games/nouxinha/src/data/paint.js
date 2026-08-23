// Which parts of a tile turn a colour a gem gave back, and which gem's.
//
// The sheet is 1-bit: a tile is a silhouette, and the renderer tints the whole
// of it with one colour (DESIGN.md §9). That is enough for a world drawn in one
// foreground, and not enough for a world that gets a colour back every time a
// gem comes home — a torch can be *the* colour of gem two, but a rock cannot
// have a vein of it while staying stone.
//
// So a tile can be split into **zones**: up to three regions of its silhouette
// painted separately, plus everything left over. Each zone is cut into its own
// mask at boot (`src/data/sprites.js`), baked into its own texture, and the
// zones are stacked back into one silhouette at draw time (`src/ui/painted.js`)
// — the same trick the wizard's colour bands always used, opened up to any tile
// and to any shape rather than four horizontal slices.
//
// **A zone map is 16 lines of 16 characters**, laid over the tile it paints:
// `1`, `2` and `3` claim a pixel for that zone, and every other character
// leaves it in zone 0. A pixel the sheet doesn't draw is ignored whatever the
// map says, so a map can be drawn loosely and still be exact.
//
// `hues` names the colour of zones 1 upward — zone 0 is by definition whatever
// the tile would have been drawn in anyway:
//
// | Hue | The zone is drawn in |
// |---|---|
// | `1` `2` `3` | the colour gem 1, 2 or 3 gave back — **once that gem is held** |
// | `'gem'` | the colour of the gem the *place* belongs to: a sanctum's own gem, an item's tier |
// | `'opened'` | the colour of the gem that opened this gate |
//
// A hue naming a gem you are not carrying draws in the base colour instead, so
// a tile *gains* colour as gems come home and no colour is ever on screen
// before the run that brought it back. The two roles are resolved by whoever
// draws the tile, which is what lets one sanctum's masonry be amber and the
// next one's cyan off a single entry here.
//
// Nothing is authored by hand: open `tiles.html` through a server, pick a tile,
// paint its zones, and copy the entry it writes into the table below.

// Zone 0 plus the three a map can name.
export const PAINT_ZONES = 4;

// The hues a zone can be given, and what to call them in the editor.
export const HUES = [
  { hue: 0, label: 'BASE' },
  { hue: 1, label: 'GEM 1' },
  { hue: 2, label: 'GEM 2' },
  { hue: 3, label: 'GEM 3' },
  { hue: 'gem', label: "THIS PLACE'S GEM" },
  { hue: 'opened', label: 'THE GEM THAT OPENED IT' },
];

// The characters a zone map is written in. Anything else is zone 0.
export const ZONE_INK = ['.', '1', '2', '3'];

export const PAINT = {
  // --- The character -------------------------------------------------------
  //
  // The wizard wears the campaign: the hood turns the first colour brought
  // home, the robe the second, the staff the third — so a character carrying
  // everything is three colours over the one they set out in, and one carrying
  // nothing is still the plain silhouette they always were. All four facings
  // draw the same tile, so they share the one map.
  'wizard-down': {
    hues: [1, 2, 3],
    map: [
      '................',
      '...11111111..3..',
      '..1.11111111.33.',
      '....1......1.3..',
      '....1......1.33.',
      '....1......1..3.',
      '....1......1..3.',
      '...11......11.3.',
      '..2222....222.3.',
      '..22222..222....',
      '..222222222..33.',
      '.....22..22..33.',
      '...2.22..22.....',
      '.....22..22...3.',
      '.....22..22...3.',
      '................',
    ],
  },
  'wizard-up': 'wizard-down',
  'wizard-right': 'wizard-down',
  'wizard-left': 'wizard-down',

  // --- The sanctums --------------------------------------------------------
  //
  // A sanctum is the colour of the gem it keeps (DESIGN.md §9): the crown of
  // the ring and its outward faces take that gem's colour, while the stonework
  // under them stays the foreground everything else is drawn in — so the ring
  // is outlined in its own colour rather than repainted into a colour-shaped
  // hole. It only lights once the gem is in hand, which makes emptying a
  // sanctum the moment the place itself changes colour. The nine pieces are
  // one nine-slice, so each paints the edges it actually shows.
  'wall-tl': {
    hues: ['gem'],
    map: [
      '................',
      '.11..11..11..11.',
      '.11111111111111.',
      '...111111111111.',
      '.111............',
      '.111............',
      '...1............',
      '.111............',
      '.111............',
      '...1............',
      '.111............',
      '.111............',
      '...1............',
      '.111............',
      '.111............',
      '................',
    ],
  },
  'wall-t': {
    hues: ['gem'],
    map: [
      '................',
      '.11..11..11..11.',
      '.11111111111111.',
      '.11111111111111.',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
  },
  'wall-tr': {
    hues: ['gem'],
    map: [
      '................',
      '.11..11..11..11.',
      '.11111111111111.',
      '.111111111111...',
      '............111.',
      '............111.',
      '............1...',
      '............111.',
      '............111.',
      '............1...',
      '............111.',
      '............111.',
      '............1...',
      '............111.',
      '............111.',
      '................',
    ],
  },
  'wall-l': {
    hues: ['gem'],
    map: [
      '................',
      '.111............',
      '.111............',
      '...1............',
      '.111............',
      '.111............',
      '...1............',
      '.111............',
      '.111............',
      '...1............',
      '.111............',
      '.111............',
      '...1............',
      '.111............',
      '.111............',
      '................',
    ],
  },
  'wall': {
    hues: ['gem'],
    map: [
      '................',
      '.11..11..11..11.',
      '.11111111111111.',
      '.11111111111111.',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '.11..11..11..11.',
      '.11111111111111.',
      '................',
      '.11111111111111.',
      '.11111111111111.',
      '................',
    ],
  },
  'wall-r': {
    hues: ['gem'],
    map: [
      '................',
      '............111.',
      '............111.',
      '............1...',
      '............111.',
      '............111.',
      '............1...',
      '............111.',
      '............111.',
      '............1...',
      '............111.',
      '............111.',
      '............1...',
      '............111.',
      '............111.',
      '................',
    ],
  },
  'wall-bl': {
    hues: ['gem'],
    map: [
      '................',
      '.111............',
      '.111............',
      '...1............',
      '.111............',
      '.111............',
      '...1............',
      '.111............',
      '.111............',
      '...1............',
      '.111.11..11..11.',
      '.11111111111111.',
      '................',
      '.11111111111111.',
      '.11111111111111.',
      '................',
    ],
  },
  'wall-b': {
    hues: ['gem'],
    map: [
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '.11..11..11..11.',
      '.11111111111111.',
      '................',
      '.11111111111111.',
      '.11111111111111.',
      '................',
    ],
  },
  'wall-br': {
    hues: ['gem'],
    map: [
      '................',
      '............111.',
      '............111.',
      '............1...',
      '............111.',
      '............111.',
      '............1...',
      '............111.',
      '............111.',
      '............1...',
      '.11..11..11.111.',
      '.11111111111111.',
      '................',
      '.11111111111111.',
      '.11111111111111.',
      '................',
    ],
  },

  // A gate carries both gems at once: the arch is masonry, so its crown belongs
  // to the sanctum behind it, and the bars — or the leaves folded back once it
  // is open — belong to the gem that opened it. The first sanctum's arch wants
  // no gem, so it stays plain; every gate after it is coloured by the walk that
  // got you through.
  'gate': {
    hues: ['gem', 'opened'],
    map: [
      '................',
      '1111111111111111',
      '1111111111111111',
      '...2222222222...',
      '...2222222222...',
      '...2222222222...',
      '...2222222222...',
      '...2222222222...',
      '...2222222222...',
      '...2222222222...',
      '...2222222222...',
      '...2222222222...',
      '...2222222222...',
      '...2222222222...',
      '...2222222222...',
      '................',
    ],
  },
  'gate-open': {
    hues: ['gem', 'opened'],
    map: [
      '................',
      '1111111111111111',
      '1111111111111111',
      '...2........2...',
      '...2........2...',
      '...2........2...',
      '...2........2...',
      '...2........2...',
      '...2........2...',
      '...2........2...',
      '...2........2...',
      '...2........2...',
      '...2........2...',
      '...2........2...',
      '...2........2...',
      '................',
    ],
  },

  // --- The ground ----------------------------------------------------------
  //
  // Each gem reaches a different layer of the world, so the three colours are
  // never all in the same place: the first finds flecks in the ground, the
  // second veins in the stone, the third the lit edge of a canopy. They are a
  // handful of pixels each on purpose — terrain is still the constant that
  // every restored colour has to read against, and it is the *whole screen*.
  'floor': {
    hues: [1],
    map: [
      '................',
      '................',
      '..........11....',
      '...........1....',
      '................',
      '................',
      '................',
      '................',
      '................',
      '.1..............',
      '.11.............',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
  },
  'rock-0': {
    hues: [2],
    map: [
      '................',
      '................',
      '................',
      '................',
      '.....1..........',
      '.....1..........',
      '......1.........',
      '......1.........',
      '.......1........',
      '.......1........',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
  },
  'rock-1': {
    hues: [2],
    map: [
      '................',
      '................',
      '................',
      '................',
      '.......1........',
      '.......1........',
      '........1.......',
      '........1.......',
      '.........1......',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
  },
  'rock-2': {
    hues: [2],
    map: [
      '................',
      '................',
      '................',
      '................',
      '.........1......',
      '.........1......',
      '........1.......',
      '........1.......',
      '................',
      '................',
      '................',
      '......1.........',
      '......1.........',
      '................',
      '................',
      '................',
    ],
  },
  rock: 'rock-0',

  'tree-0': {
    hues: [3],
    map: [
      '................',
      '.......11.......',
      '................',
      '......1..1......',
      '................',
      '.....1....1.....',
      '................',
      '....1......1....',
      '................',
      '...1........1...',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
  },
  'tree-1': {
    hues: [3],
    map: [
      '................',
      '.......11.......',
      '......1..1......',
      '................',
      '.....1....1.....',
      '................',
      '....1......1....',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
  },
  'tree-2': {
    hues: [3],
    map: [
      '................',
      '...........1....',
      '..........1.1...',
      '.........1...1..',
      '....1...........',
      '...1.1..1.....1.',
      '..1...1.........',
      '................',
      '.1.....1........',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
  },
  'tree-3': {
    hues: [3],
    map: [
      '................',
      '...1111111111...',
      '..1..........1..',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
  },
  'tree-4': {
    hues: [3],
    map: [
      '................',
      '......1111......',
      '.....1....1.....',
      '................',
      '....1......1....',
      '................',
      '...1........1...',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
  },
  'tree-5': {
    hues: [3],
    map: [
      '................',
      '..........1.....',
      '................',
      '.........1.1....',
      '....1...........',
      '........1...1...',
      '...1.1..........',
      '.......1.....1..',
      '..1...1.........',
      '..............1.',
      '.1..............',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
  },
  'tree-6': {
    hues: [3],
    map: [
      '................',
      '.......11.......',
      '................',
      '......1..1......',
      '................',
      '.....1....1.....',
      '................',
      '................',
      '....1......1....',
      '................',
      '...1........1...',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
  },
  'tree-7': {
    hues: [3],
    map: [
      '................',
      '.....111111.....',
      '...11......11...',
      '..1..........1..',
      '................',
      '.1............1.',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
  },
  tree: 'tree-0',
};

// A key that names another shares its zones — the four wizard facings are the
// same tile, and a terrain's bare key is an alias for the first of its variants
// (`rock` for `rock-0`), so both follow the paint of what they point at.
function resolve(key, seen = new Set()) {
  const entry = PAINT[key];
  if (typeof entry !== 'string') return entry || null;
  if (seen.has(key)) throw new Error(`paint alias loop at "${key}"`);
  seen.add(key);
  return resolve(entry, seen);
}

// The zones a sprite key is painted in, or null for the vast majority of tiles
// that are drawn in one colour like they always were.
export function paintOf(key) {
  return resolve(key);
}

// The texture one zone of a painted key is baked into. Zone 0 is everything the
// map left alone, so it is a texture in its own right rather than the whole
// tile — stacking the zones back up is what rebuilds the silhouette.
export function zoneKey(key, zone) {
  return `${key}-z${zone}`;
}

// Which zone a map puts a pixel in. Anything that isn't a zone digit is zone 0,
// so a map can be drawn with '.' for "leave this alone" and read as art.
export function zoneAt(map, x, y) {
  const ink = (map[y] || '')[x];
  const zone = ZONE_INK.indexOf(ink);
  return zone > 0 ? zone : 0;
}
