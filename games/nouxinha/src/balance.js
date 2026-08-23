// Every number the game is balanced on, in one place.
//
// The rule for what lives here rather than in `src/config.js`: if changing it
// changes how hard the game is, how far you can walk, how much you find or how
// long a light lasts, it belongs in this file. Layout, palette, type, input
// feel and the settings a player toggles are config's; the world's own
// arithmetic is this file's.
//
// Nothing here imports anything — it is a table, not code — so it can be read
// straight into a test or a spreadsheet without dragging the game in with it.

// --- Terrain ------------------------------------------------------------------
//
// ~20% rock coverage. Density alone can't guarantee the base isn't walled in —
// at *any* threshold that still looks like a cave system, a slice of seeds seals
// the spawn into a pocket — so connectivity is enforced by validating the seed
// at run start instead (`pickSeed` in core/world.js).
export const ROCK_THRESHOLD = 0.64;

// Rock comes in two formations that are the same terrain and draw the same
// sprite: the masses the threshold above grows, and loose boulders standing on
// their own out in the open. A wall you walk around and a boulder you step past
// are different things to meet even though they are the same stone, and the
// second is what keeps a wide stretch of floor from being an empty screen.
export const BOULDER_CHANCE = 0.03;

// Groves: the one thing in the world that isn't stone and isn't floor. Blocking
// like rock, on a lattice coarser than the rock masses so a grove arrives as a
// stand you skirt rather than as scattered trunks, and drawn as foliage so it
// is never mistaken for a wall.
export const GROVE_THRESHOLD = 0.72;

// The base's 3x3 neighbourhood is forced to floor so spawn can never be walled in.
export const BASE_CLEARING = 1;

// --- The edge of the world ----------------------------------------------------
//
// The world is bounded, and what bounds it is the dark itself. Far enough out
// the dark stops being something a light pushes back and becomes something that
// pushes back: it eats into what you are carrying, a tile of reach at a time,
// and at `EDGE_RADIUS` it has eaten everything and is simply solid.
//
// Measured as a true radius rather than the Chebyshev distance the rest of the
// game counts in, because this one is a shape the player will see on the map: a
// square edge would read as an authored box, and a circle reads as how far the
// light ever got. (The HUD's furthest-out counter stays Chebyshev — that is a
// different question, how far out you walked, not how close to the edge.)
//
// 200 puts the edge well past everything the campaign is currently about: the
// outermost sanctum wall stands at 117, so the last third of the world is
// unspoken for, which is where a late-game area would go.
export const EDGE_RADIUS = 200;

// One tile of light lost for every ten tiles closer to the edge — so the bigger
// the light, the sooner the dark starts eating it, and everything converges on
// the same guttering ring by the end. Never all the way to nothing: a tile of
// reach is left however far out you stand, because the way the boundary is read
// is by seeing the floor stop, and a player who cannot see at all has only
// bumped into something invisible.
export const CHOKE_STEP = 10;

// --- Validating a seed --------------------------------------------------------
//
// A spot opens onto the cave system, or onto a pocket the noise happened to seal
// against its own wall. The two are never close: a sealed spot measures a
// handful of tiles, a real one runs past this limit long before it runs out, so
// a bounded probe separates them for a few hundred lookups.
export const POCKET_PROBE = 80;

// How much of the floor around the hut a run has to be able to walk to, sampled
// over a window this many tiles across, and how many bumped seeds to try before
// giving up (`pickSeed` in core/world.js).
export const SEED_WINDOW = 40;
export const SEED_MIN_FRACTION = 0.6;
export const SEED_MAX_ATTEMPTS = 20;

// --- Sanctums -----------------------------------------------------------------
//
// The chain is what turns three gems into a reason to keep walking: sanctum 1's
// arch stands open (gem 1 has to be reachable carrying nothing), and each gate
// after it wants the gem from the sanctum before it. `requires` is both the
// count of gems needed and the index of the gem whose colour the open gate
// takes — see config.js `gemColour`.
//
// `cache` is what the clearing holds besides the centrepiece, HOARD_PER_KIND of
// each — a hoard, not a pile.
export const SANCTUM_PLAN = [
  {
    gem: 'gem-1',
    distance: 20,
    radius: 4,
    requires: 0,
    cache: ['coin', 'water-drop', 'water-flask', 'torch-medium'],
  },
  {
    gem: 'gem-2',
    distance: 45,
    radius: 5,
    requires: 1,
    cache: ['coin', 'water-drop', 'water-flask', 'torch-beacon'],
  },
  {
    gem: 'gem-3',
    distance: 80,
    radius: 6,
    requires: 2,
    cache: ['coin', 'water-drop', 'spring-vial', 'torch-beacon'],
  },
  // The last one holds no gem: it is what gem 3 is *for*, and the richest cache
  // in the game (DESIGN.md §4.4).
  {
    gem: null,
    distance: 110,
    radius: 7,
    requires: 3,
    cache: ['coin', 'water-flask', 'spring-vial', 'torch-beacon', 'torch-lamp'],
  },
];

export const HOARD_PER_KIND = 2;

// --- Landmarks ----------------------------------------------------------------
//
// The three things in the world that aren't behind a gate and aren't rerolled:
// the merchant, and the one compass and one map lying out in the dark.
export const LANDMARK_PLAN = [
  // Close enough that a first expedition can reach it and walk home, and on the
  // far side of the hut from the first sanctum, so an early run has two
  // directions worth walking rather than one.
  { id: 'merchant', item: null, near: 20, span: 6, opposite: 0 },
  // Past the second sanctum: the compass is either 50 coins or a long walk.
  { id: 'compass', item: 'compass', near: 55, span: 16, opposite: null },
  // Past the third: the map is the longest walk in the game that isn't a gem.
  { id: 'map', item: 'map', near: 90, span: 16, opposite: null },
];

// --- The scatter --------------------------------------------------------------
//
// Coins, water and lights: the layer that moves. Candidates are thrown on a
// lattice and thinned so that no two of the *same* kind ever land closer than
// MIN_SEPARATION, which is what keeps items from arriving in clumps.
//
// MIN_SEPARATION is that rule, and it is the one number that decides how much
// there is to find. Measured over a 141x141 window; unthinned, the same lattice
// puts something under 6.2% of its floor tiles:
//
//   D    items per floor tile   closest two of a kind ever land
//   15   1.4%                   15
//   12   1.8%                   12
//   10   2.3%                   10
//    8   2.9%                    8
//    6   3.7%                    6
//
// Spreading items out costs items: a kind can never be denser than one per DxD,
// so the world holds a fraction of what an unthinned scatter would, evenly,
// instead of several times as much in clumps. That is the trade the rule asks
// for, and this constant is where to change your mind about it.
//
// 8 is where the trade currently sits, and playtesting is what moved it there
// from 10. A light shows nine tiles and the viewport holds 165, so one item per
// 44 floor tiles meant a walk could cross several screenfuls of lit ground with
// nothing on any of them, and pushing one ring further out stopped reading as a
// decision. 8 puts something under one floor tile in 35 — about a quarter more —
// which keeps a walk paying without turning the ground into a shop. It is still
// wider than any light in the game, so a lit ring can never show the same kind
// twice. What it gives up is the outright guarantee that a screenful holds one
// of anything: at D = 8 the 11x15 viewport can hold up to four of a kind, which
// reads as a good patch of ground rather than a clump.
export const MIN_SEPARATION = 8;

// The lattice is much finer than the separation on purpose. One candidate per
// separation-sized cell would place its points far too politely — neighbouring
// cells conflict about half the time and the loser is simply dropped, which
// throws away most of the world's items. Throwing many more darts at the same
// exclusion radius packs what survives much closer to the ceiling the rule
// allows, and still lands irregularly, because the survivors are the ones that
// won a hash rather than the ones sitting on a grid.
//
// The cost is the neighbourhood a candidate has to check: a conflict can come
// from several cells away rather than one.
export const CONSUMABLE_CELL = 4;

// Where the bands the weights below are quoted per fall, in Chebyshev tiles
// from the hut.
export const BAND_MID = 8;
export const BAND_FAR = 20;

// How often a cell offers up a tile at all. This is the density dial; the
// weights below only decide what the offered tile turns out to be.
export const SPAWN_CHANCE = { near: 0.9, mid: 0.95, far: 1 };

// ...and how much of that dial each gem leaves standing. The world gets
// *sparser* as the campaign gets richer, and this is the one place the gems
// change how much there is rather than what it is.
//
// It reads backwards until you look at what a pickup is worth. A gem does not
// add a tier on top of what is lying about, it upgrades it (see SCATTER below),
// and the upgrades are steep: a water drop refills 30 and a spring vial refills
// everything; a medium torch burns 50 steps and a beacon burns 140. At a flat
// density the three-gem world hands out eight times the water and nearly twice
// the light per tile walked that the opening one does, which is what turns the
// late game into stopping every few steps for something you did not need. So
// the count comes down as the value goes up: at three gems the ground holds
// about three fifths of what it opened with, each piece of it worth several
// times more, and picking something up stays a thing that happens rather than a
// thing that keeps happening.
//
// Nothing here touches the opening world — a run with no gems walks the density
// the game was tuned at — and the taper only ever bites after a gem has been
// banked, by which point max water has gone up by WATER_PER_GEM with it. It
// cannot strand a run.
export const GEM_DENSITY = [1, 0.85, 0.72, 0.6];

// Relative weight of each kind within a band, and the two fields that tie a kind
// to the gems: `tier` is the gem that brings it into the world, `until` the gem
// that retires it. This table is where that gating actually happens — the item
// definitions in data/items.js carry no gem fields of their own.
//
// That pair is how a gem changes the world without crowding it. It does not
// sprinkle a new tier on top of everything already lying about — it *upgrades*
// what is out there, one kind out for one kind in: the first gem retires the
// water drop for the flask, the second the medium torch for the beacon, the
// third the flask for the spring vial. The swaps are one-for-one on purpose,
// because the lattice thins a kind that gets too dense — retire two kinds for
// one and the survivors crowd each other, and the map ends up emptier the
// further you get, which is backwards.
//
// The lattice offers up the same tiles either way, so the map holds the same
// number of items after a gem as before; what changed is what they are. Walking
// ground you already walked is worth it again because everything on it is
// better, not because there is more of it.
//
// A sanctum's clearing is the exception: its cache is a hoard somebody left
// there, fixed at what the sanctum was built holding, and it doesn't upgrade.
//
// Item quality still scales with distance from the base — coins and water near
// home, the bigger torches only further out — which is what makes walking away
// worth the durability (DESIGN.md §4.3).
//
// The weights are set by what a kind is *worth per step*, not by how often it
// wants to be seen. A step costs 1 water and 1 durability off the active light,
// so the honest way to read a column is: how much water, and how many
// lit steps, does a walk of a thousand tiles across this band hand back? At the
// opening weights the far band gave back 170 water and 983 lit steps — light
// very nearly paying for itself while water paid for a sixth of itself, which
// made the leash the game is actually about invisible behind a torch supply
// that never ran out. Water is the pressure; light is meant to be the thing you
// ration. So water outweighs light in every band before the first gem.
export const SCATTER = [
  { id: 'coin', near: 5, mid: 4, far: 3 },
  { id: 'water-drop', near: 7, mid: 6, far: 4.5, until: 1 },
  { id: 'torch-small', near: 1.2, mid: 0.8, far: 0.4 },
  { id: 'torch-medium', near: 0, mid: 1.6, far: 1.2, until: 2 },
  { id: 'torch-lamp', near: 0, mid: 0, far: 0.8 },
  { id: 'water-flask', near: 5, mid: 4, far: 2.5, tier: 1, until: 3 },
  { id: 'torch-beacon', near: 0, mid: 2.5, far: 2, tier: 2 },
  { id: 'spring-vial', near: 5, mid: 4, far: 2.5, tier: 3 },
];

// A coin is a small pile, not a penny: the separation rule caps any one kind at
// a single instance per MIN_SEPARATION square, and an economy with a 100-coin
// map in it needs the pickups to be worth stopping for. Set both to 1 for
// literal one-coin coins.
export const COIN_VALUE_MIN = 1;
export const COIN_VALUE_MAX = 5;

// --- Water, and the leash it is -----------------------------------------------
//
// Every successful step costs one; a water pickup refills it by whatever that
// item carries, capped at the run's maximum. Hitting zero is the run's one hard
// failure state (DESIGN.md §6).
export const STARTING_WATER = 200;
export const WATER_PER_STEP = 1;

// Each gem you hold widens the leash. The sanctums sit at 20, 45, 80 and 110
// tiles out, which is further than STARTING_WATER can carry anyone home — so
// the gem that opens the next gate is also what makes the walk to it survivable
// (DESIGN.md §4.4). Without this the chain simply dead-ends at the second gate.
export const WATER_PER_GEM = 50;

// --- Lights -------------------------------------------------------------------
//
// The tension the numbers encode: a light that shows you more burns out faster,
// so every upgrade is also a shorter leash (DESIGN.md §4.1). The beacon is the
// one that breaks the trade, because it is the second gem's reward for a walk
// nothing else would survive.
//
// Shapes are read by core/light.js: a `radius` is the Chebyshev block around
// you, a `cone` widens with distance and shows nothing behind you.
export const LIGHTS = {
  'torch-small': { maxDurability: 100, shape: { kind: 'radius', radius: 1 } },
  'torch-medium': { maxDurability: 50, shape: { kind: 'radius', radius: 2 } },
  'torch-lamp': { maxDurability: 60, shape: { kind: 'cone', depth: 4 } },
  'torch-beacon': { maxDurability: 140, shape: { kind: 'radius', radius: 3 } },
};

// What a run sets out carrying.
export const STARTING_LIGHT = 'torch-small';

// In blackout, remembered ground beyond this Chebyshev distance is hidden
// too — memory shrinks to a fog of war around the character instead of
// staying legible over the whole run (DESIGN.md §4).
export const BLACKOUT_MEMORY_RADIUS = 1;

// --- Water pickups ------------------------------------------------------------
//
// 30 against a 200 tank, so a drop is a seventh of a walk rather than a tenth.
// The separation rule caps how *many* of a kind the ground can hold, so past a
// point the only way to put more water in the world is to make a drop worth
// more — which is also what keeps the flask from being the moment water stops
// being a problem at all.
export const WATER_VALUE = {
  'water-drop': 30,
  'water-flask': 60,
  'spring-vial': Infinity,
};

// --- The merchant -------------------------------------------------------------
//
// The merchant is the only place coins go, and the only reason to pick one up
// (DESIGN.md §4.5). Lights and water are stock: buy as many as you can carry.
// The compass and the map are one-offs — you own one or you don't — and each
// can also be found lying in the dark, so buying one is paying to skip a very
// long walk.
export const PRICES = {
  'torch-small': 10,
  'torch-medium': 25,
  'torch-lamp': 40,
  'water-drop': 5,
  compass: 50,
  map: 100,
};

// --- Cheats -------------------------------------------------------------------
//
// The Settings switch that hands a run the whole late game to look at
// (DESIGN.md §6.2). The reveal reaches past the fourth sanctum's ring (110 + 7)
// and every landmark, with room to spare — the whole of the world the game
// actually has anything in.
export const CHEAT_REVEAL_RADIUS = 130;
export const CHEAT_COINS = 9999;
