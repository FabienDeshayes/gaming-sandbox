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
// | `'landmark'` | the colour a landmark keeps, once this campaign has stood at it |
//
// The last of those is the one that is not a gem: a landmark's colour is
// absolute rather than relative to the world (src/data/landmarks.js), so the
// role resolves to a colour outright rather than to a gem number, and what
// gates it is whether the campaign holds that landmark's standing rather than
// how many gems are in hand. The rule it is keeping is the same one either
// way — nothing is ever shown in a colour the campaign has not brought back.
//
// A hue naming a gem you are not carrying draws in the base colour instead, so
// a tile *gains* colour as gems come home and no colour is ever on screen
// before the run that brought it back. The two roles are resolved by whoever
// draws the tile, which is what lets one sanctum's masonry be amber and the
// next one's cyan off a single entry here.
//
// Nothing is authored by hand: open `paint.html` through a server, pick a tile,
// paint its zones, and copy the entry it writes into the table below.

import { baseKey } from './tiles.js';

// A variant's terrain: `tree-5` is one of the trees, `tree` is the tree. What a
// tile falls back on when it has no zones of its own.
const terrainOf = (key) => key.replace(/-\d+$/, '');

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
  { hue: 'landmark', label: "THE LANDMARK'S OWN COLOUR" },
];

// The characters a zone map is written in. Anything else is zone 0.
export const ZONE_INK = ['.', '1', '2', '3'];

export const PAINT = {
  // --- The character -------------------------------------------------------
  //
  // The wizard wears the campaign: the hood turns the first colour brought
  // home, the robe the second, the staff the third — so a character carrying
  // everything is three colours over the one they set out in, and one carrying
  // nothing is still the plain silhouette they always were. Each facing is
  // its own tile now (`src/data/tiles.js`), so each gets its own map, but all
  // four keep the same three-zone split.
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
      '..222222222.....',
      '.....22..22.....',
      '.....22..22.....',
      '.....22..22...3.',
      '.....22..22...3.',
      '................',
    ],
  },
  // Turned around: the same hood and robe, mirrored so the staff swaps
  // hands, with the face closed over — no brow or eyes, just hood.
  'wizard-up': {
    hues: [1, 2, 3],
    map: [
      '................',
      '..3..11111111...',
      '.33.11111111.1..',
      '..3.11111111....',
      '.33.11111111....',
      '.3..11111111....',
      '.3..11111111....',
      '.3.1111111111...',
      '.3.22222222222..',
      '....2222222222..',
      '.....222222222..',
      '.....22..22.....',
      '.....22..22.....',
      '.3...22..22.....',
      '.3...22..22.....',
      '................',
    ],
  },
  'wizard-right': {
    hues: [1, 2, 3],
    map: [
      '................',
      '....111111..33..',
      '...11111111.33..',
      '..1.1111111.33..',
      '....1111.11133..',
      '....1111111..3..',
      '....1111111..3..',
      '...11111121..3..',
      '..222222222..3..',
      '..22222222...3..',
      '..22222222......',
      '..22222222......',
      '..22222222...3..',
      '..22.22222...3..',
      '..22.22222...3..',
      '................',
    ],
  },
  'wizard-left': {
    hues: [1, 2, 3],
    map: [
      '................',
      '..33..111111....',
      '..33.11111111...',
      '..33.1111111.1..',
      '..33111.1111....',
      '..3..1111111....',
      '..3..1111111....',
      '..3..12111111...',
      '..3..222222222..',
      '..3...22222222..',
      '......22222222..',
      '......22222222..',
      '..3...22222222..',
      '..3...22222.22..',
      '..3...22222.22..',
      '................',
    ],
  },

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
  'chest': {
    hues: [1, 2, 3],
    map: [
      '................',
      '................',
      '................',
      '..333333333333..',
      '..32........23..',
      '..3..........3..',
      '..333333333333..',
      '...2...11...2...',
      '......1..1......',
      '.......11.......',
      '................',
      '................',
      '...2........2...',
      '................',
      '................',
      '................',
    ],
  },
  'chest-open': {
    hues: [1, 2, 3],
    map: [
      '..333333333333..',
      '..3..........3..',
      '..3..........3..',
      '..3..........3..',
      '..3..........3..',
      '..3..........3..',
      '................',
      '...2...11...2...',
      '......1..1......',
      '.......11.......',
      '................',
      '................',
      '...2........2...',
      '................',
      '................',
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
    hues: [1, 2, 3],
    map: [
      '................',
      '..........1.....',
      '....2.........3.',
      '..3.2...........',
      '................',
      '................',
      '................',
      '................',
      '.....2..........',
      '.1........3...1.',
      '................',
      '................',
      '................',
      '.......3........',
      '.......3.2......',
      '................',
    ],
  },
  'floor@mystic': {
    hues: [1, 2, 3],
    map: [
      '................',
      '.1.....3.....2..',
      '..............3.',
      '..3..........33.',
      '................',
      '....2...........',
      '..........1.....',
      '................',
      '................',
      '.1..........2.1.',
      '.11.............',
      '.........3....1.',
      '................',
      '.......32.......',
      '.......3.2......',
      '................',
    ],
  },
  'floor@frozen': {
    hues: [1, 2, 3],
    map: [
      '................',
      '.1.......2......',
      '....2.....11..3.',
      '....2......1....',
      '................',
      '.....3.....1....',
      '................',
      '..2.............',
      '.....2....3.....',
      '.....2.......21.',
      '.11.............',
      '......2.........',
      '.1..........3...',
      '................',
      '.......3.2......',
      '................',
    ],
  },
  'floor@desert': {
    hues: [1, 2, 3],
    map: [
      '................',
      '.......3........',
      '....21.3.111..3.',
      '..2.2......1.31.',
      '................',
      '.......33...33..',
      '.......3.....3..',
      '................',
      '.1...2..........',
      '.1...2....3...1.',
      '.11...2.........',
      '..2.............',
      '............2...',
      '.......3........',
      '.......312......',
      '................',
    ],
  },
  'rock-0': {
    hues: [1, 2, 3],
    map: [
      '................',
      '................',
      '................',
      '................',
      '....1...........',
      '....1...........',
      '...11.......2...',
      '.3.1........2...',
      '.3.1........2...',
      '...1........2...',
      '..1........2....',
      '..1........2.3..',
      '..1........2.3..',
      '..1........2....',
      '............2...',
      '............2...',
    ],
  },
  'rock-1': {
    hues: [1, 2, 3],
    map: [
      '................',
      '................',
      '................',
      '................',
      '....1...........',
      '....1...........',
      '...1........2...',
      '.3.1........2...',
      '.3.1........2...',
      '...1.......22...',
      '..11.......2....',
      '..1........2.3..',
      '..1........2.3..',
      '..1........2....',
      '...........22...',
      '............2...',
    ],
  },
  'rock-2': {
    hues: [1, 2, 3],
    map: [
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '..33............',
      '..33............',
      '................',
      '................',
      '.1..22222..33.1.',
      '...2222222.33...',
      '...2222222......',
      '....22222.......',
      '................',
      '................',
    ],
  },
  'base': {
    hues: [1, 2, 3],
    map: [
      '................',
      '.......33.......',
      '......3.33......',
      '.....3..333.....',
      '....3...3333....',
      '...3...333.33...',
      '..3...3..33333..',
      '.3...3....33.33.',
      '.3..3......33.3.',
      '.3.3........333.',
      '.33..........33.',
      '......2222......',
      '..1...2..2...1..',
      '......2..2......',
      '..11111..11111..',
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

  // --- The landmarks -------------------------------------------------------
  //
  // One zone apiece, and the hue is the role rather than a gem: whichever
  // landmark's tile is being drawn resolves it to the colour that landmark
  // keeps, and to the plain foreground until this campaign has stood at it
  // (DESIGN.md §4.10). What each map claims is the part of the thing that is
  // *doing* something — the die and the bed of the press, the bell's mouth, the
  // lanterns still burning in the tree, the shaft that would throw a shadow if
  // there were a sun — so a landmark that is not yet yours reads as a shape,
  // and one that is reads as a shape with a light in it.
  mint: {
    hues: ['landmark'],
    map: [
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '.....111111.....',
      '.....1111111....',
      '.....111111.....',
      '....11111111....',
      '.........11.....',
      '.....1111.......',
      '..........11....',
      '....11..........',
    ],
  },
  bell: {
    hues: ['landmark'],
    map: [
      '................',
      '................',
      '................',
      '................',
      '......1111......',
      '.....1....1.....',
      '.....1....1.....',
      '....1......1....',
      '....1......1....',
      '...1........1...',
      '..11........11..',
      '.11111111111111.',
      '.11111111111111.',
      '.11111111111111.',
      '.11111111111111.',
      '.......11.......',
    ],
  },
  'lantern-tree': {
    hues: ['landmark'],
    map: [
      '................',
      '....1...........',
      '.1.1............',
      '.1.1.......1.111',
      '.111..1.1....1.1',
      '......1.1....111',
      '......111.......',
      '................',
      '................',
      '.1.1........1.1.',
      '.1.1........1.1.',
      '.111.......1111.',
      '....1...........',
      '................',
      '................',
      '................',
    ],
  },
  gnomon: {
    hues: ['landmark'],
    map: [
      '................',
      '................',
      '......1111......',
      '......1111......',
      '......1111......',
      '......1111......',
      '........1.......',
      '........1.......',
      '........1.......',
      '........1.......',
      '........1.......',
      '........1.......',
      '........1.......',
      '........1.......',
      '................',
      '................',
    ],
  },
  // The signpost's arm, painted in the colour of the landmark it names — so a
  // post is legible from inside a torch without reading a word of it, and grey
  // until the campaign has been where it points. Its post is its own two-tone
  // masonry, painted like everything else built rather than grown.
  signpost: {
    hues: ['landmark', 2, 3],
    map: [
      '................',
      '....1112211111..',
      '............11..',
      '.............1..',
      '.............1..',
      '............11..',
      '....1111111111..',
      '....3333333331..',
      '...33333333331..',
      '...3333333333...',
      '....333333333...',
      '................',
      '.......22.......',
      '....1..22..1....',
      '.....1.22.1.....',
      '................',
    ],
  },
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
//
// A biome's own version of a tile (`rock@frozen-1`, src/data/tiles.js) follows
// the paint of the tile it is a version of unless it names zones of its own, so
// a world drawn in different stone keeps its veins without the map being
// re-authored four times. Repointing a tile far enough that the zones no longer
// fit it is what an entry of its own is for — `paint.html` writes one keyed to
// the biome.
//
// One tile short of that, a terrain's *nth* tile falls back on the terrain: a
// world that alternates between six floors where the shared table names one
// keeps the ground's flecks on all six. A zone only ever claims pixels the
// sheet actually draws, so an inherited map is a handful of pixels in roughly
// the right place rather than a wrong one — and painting that tile for that
// biome is what says otherwise.
export function paintOf(key) {
  const own = baseKey(key);
  return resolve(key) || resolve(own) || resolve(terrainOf(own));
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
