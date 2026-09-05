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

// How many raw seeds the hall looks through for a kind of world this campaign
// has not finished yet before it moulds whatever it has in hand (`turnCycle` in
// core/rules.js, DESIGN.md §4.9). Candidates are rejected on `biomeOf` alone,
// which is one hash, so this is cheap: with one biome left to find, twenty-four
// looks miss it about once in a thousand campaigns, and missing costs a cycle
// rather than the ending.
export const MOULD_ATTEMPTS = 24;

// --- Sanctums -----------------------------------------------------------------
//
// The chain is what turns three gems into a reason to keep walking: sanctum 1's
// arch stands open, so the first gem is reachable carrying nothing, and every
// gate after it is locked and wants a key out of a chest (CHEST_PLAN below).
//
// `key` is the key that opens the gate, and `colour` the gem whose colour the
// gate, its key and the sanctum's own masonry are all drawn in — see config.js
// `gemColour`. The two run together on purpose: a key is *the colour of the gate
// it opens*, which is the whole of what a player has to learn about them.
//
// The distances are still the pacing. A gem no longer opens the next gate, but
// it still widens the leash by WATER_PER_GEM and upgrades what is lying about,
// so the sanctum you have just walked to is what makes the next one survivable.
//
// `cache` is what the clearing holds besides the centrepiece, HOARD_PER_KIND of
// each — a hoard, not a pile. `hall` marks the one clearing that holds neither:
// the sorcerer stands at the centre of it instead (DESIGN.md §4.9).
export const SANCTUM_PLAN = [
  {
    gem: 'gem-1',
    distance: 20,
    radius: 4,
    key: null,
    colour: 0,
    cache: ['coin', 'water-drop', 'water-flask', 'torch-medium'],
  },
  {
    gem: 'gem-2',
    distance: 45,
    radius: 5,
    key: 'key-1',
    colour: 1,
    cache: ['coin', 'water-drop', 'water-flask', 'torch-beacon'],
  },
  {
    gem: 'gem-3',
    distance: 80,
    radius: 6,
    key: 'key-2',
    colour: 2,
    cache: ['coin', 'water-drop', 'spring-vial', 'torch-beacon'],
  },
  // The last one holds no gem and no hoard: it is the **hall**, and what stands
  // at the centre of it is Nouxinha (DESIGN.md §4.9). The third key is what it
  // is for, and a conversation is what is behind it.
  {
    gem: null,
    hall: true,
    distance: 110,
    radius: 7,
    key: 'key-3',
    colour: 3,
    cache: [],
  },
];

export const HOARD_PER_KIND = 2;

// --- Chests -------------------------------------------------------------------
//
// The other built thing in the world, and the only one you open rather than
// walk onto: a chest stands on its own tile, cannot be stepped on, and does not
// stop a light. Walking into it opens it, once, forever — so like the merchant
// and the two tools lying in the dark, a chest belongs to the *slot* rather than
// to the expedition: it is placed with the seed and never relaid by a respawn.
//
// Four of them stand beside the landmarks (LANDMARK_PLAN below) — three keys and
// a hoard — and each key still sits well inside the gate it opens, so the walk
// to a gem is the walk the distances above describe. The rest are loose, on
// rings of their own.
export const CHEST_PLAN = [
  // The four beside the landmarks (LANDMARK_PLAN below). Three of them hold the
  // three keys, in the order the gates want them, and the nearest one holds a
  // hoard — so the first landmark a campaign ever walks to pays in coins and
  // every one after it pays in a gate.
  { id: 'chest-mint', key: null, at: 'mint' },
  { id: 'chest-key-1', key: 'key-1', at: 'bell' },
  { id: 'chest-key-2', key: 'key-2', at: 'lantern-tree' },
  { id: 'chest-key-3', key: 'key-3', at: 'gnomon' },
  // And the loose ones, on rings of their own, holding coins: spread a band
  // apart so a campaign meets one every so often rather than all at once.
  { id: 'chest-coin-1', key: null, near: 12, span: 8 },
  { id: 'chest-coin-2', key: null, near: 32, span: 10 },
  { id: 'chest-coin-3', key: null, near: 58, span: 12 },
  { id: 'chest-coin-4', key: null, near: 84, span: 14 },
  { id: 'chest-coin-5', key: null, near: 104, span: 14 },
];

// How far off a landmark its chest stands: outside the court, near enough that
// the light which shows you the landmark is one step from showing you the box.
export const LANDMARK_CHEST_NEAR = 3;
export const LANDMARK_CHEST_SPAN = 3;

// What a coin chest is worth, picked per chest from the seed. An order of
// magnitude above a coin pile on the ground (COIN_VALUE_MIN/MAX below) because a
// chest is opened once per campaign and never comes back: 30 is most of the way
// to the map, 50 buys it outright, and 75 is a third of the way to the compass —
// which stays a long walk away even with every chest found. The merchant's
// prices are the scale these are set against — retune PRICES and these want a
// second look.
export const CHEST_COIN_VALUES = [30, 50, 75];

// --- Sites --------------------------------------------------------------------
//
// The single-tile things in the world that aren't behind a gate and aren't
// rerolled: the merchants, and the one compass and one map lying out in the
// dark. Placed like the chests and the landmarks are, and named `site` because
// that is all they have in common — a stall, a tool on the floor, and a tool
// on the floor. A site's `item` says which: `null` is a stall (`isMerchant`
// goes by that, not by `id`), anything else is a pickup with that item's id.
export const SITE_PLAN = [
  // Close enough that a first expedition can reach it and walk home, and on the
  // far side of the hut from the first sanctum, so an early run has two
  // directions worth walking rather than one.
  { id: 'merchant', item: null, near: 20, span: 6, opposite: 0 },
  // A second stall roughly level with the second sanctum, opposite it the same
  // way the first stall sits opposite the first — so a campaign that has
  // pushed that far out has somewhere to spend what it found without the walk
  // all the way back home.
  { id: 'merchant-2', item: null, near: 40, span: 8, opposite: 1 },
  // A third, opposite the third sanctum, for the same reason further out.
  { id: 'merchant-3', item: null, near: 65, span: 10, opposite: 2 },
  // Past the second sanctum: the map is the cheaper of the two to just buy, at
  // 50 coins, so it doesn't need to be the longer walk.
  { id: 'map', item: 'map', near: 45, span: 16, opposite: null },
  // Past the third: the compass is either 250 coins or the longest walk in the
  // game that isn't a gem.
  { id: 'compass', item: 'compass', near: 85, span: 16, opposite: null },
];

// --- Landmarks ----------------------------------------------------------------
//
// Four named places per world, one per colour, and the same four in every world
// the hall moulds (DESIGN.md §4.10). What a landmark *is* — its sprite, the
// ground its court is paved with, the colour it keeps and what standing it
// hands over — is `src/data/landmarks.js`; what is here is where it stands.
//
// The rings are the pacing. The first two are inside a first or second
// expedition, so a campaign meets a landmark before it meets a gate; the fourth
// tops out at 74, nearer than the third sanctum and a long way inside the hall.
// Each takes a quarter of the compass, with the whole rose turned by the seed:
// every world has one in every direction, and which direction holds which
// changes every time the world is moulded. That is what makes them orient you.
export const LANDMARK_PLAN = [
  { id: 'mint', near: 12, span: 6 },
  { id: 'bell', near: 28, span: 8 },
  { id: 'lantern-tree', near: 48, span: 10 },
  { id: 'gnomon', near: 66, span: 9 },
];

// The court: the ring of its own ground around a landmark, forced walkable so
// there is always a way in and a way round whatever the noise did. One tile, so
// a landmark is 3x3 — which is the whole of a small torch's shape, and the
// reason arriving at one fills your light.
export const LANDMARK_COURT = 1;

// What a landmark hands the run on every fresh touch: a gift, not a standing
// (DESIGN.md §4.10). Small and repeatable — a walk back to one pays again, in
// this world or the next — so a landmark is worth the detour every time.
//
//   coins    — a handful of blanks, struck on the spot
//   water    — Infinity is a full tank, the same as the spring vial's
//   relight   — the equipped light burns back up to full
//   reveal   — tiles of ground drawn around it, so you can see how far you came
export const LANDMARK_GIFTS = {
  mint: { coins: 15 },
  bell: { water: Infinity },
  'lantern-tree': { relight: true },
  gnomon: { reveal: 8 },
};

// The Drowned Bell's standing: how far its note carries in every world after
// the one you first put a hand on it in. Wide enough to be a bearing rather
// than a proximity beep — you hear it long before a light could show it.
export const BELL_HEARING = 20;

// --- Signposts ----------------------------------------------------------------
//
// Twelve posts, each *assigned* one landmark to name. Three per landmark: one
// nearer than it, one about level with it, and one further out, so no post is
// more than about 25 tiles from the thing it is assigned to and every heading
// is worth trusting.
//
// The one at 5 is the post every campaign meets on its first expedition: near
// enough that the opening walk cannot miss it, far enough to be outside the
// hut's clearing, and it points at the nearest landmark there is.
//
// A post's own spot is rolled independently of its assigned landmark's
// heading, so nothing stops it landing, by chance, close enough to a
// *different* landmark to be worth naming too (`signpostTargets` in
// core/world.js) — "close enough" being SIGNPOST_BANDS' own NEARBY threshold.
// Most posts only ever name the one landmark they were assigned; a few, some
// worlds, end up naming two.
export const SIGNPOST_PLAN = [
  { id: 'post-1', near: 5, span: 0, target: 'mint' },
  { id: 'post-2', near: 12, span: 4, target: 'bell' },
  { id: 'post-3', near: 20, span: 4, target: 'mint' },
  { id: 'post-4', near: 28, span: 4, target: 'lantern-tree' },
  { id: 'post-5', near: 33, span: 5, target: 'mint' },
  { id: 'post-6', near: 38, span: 5, target: 'bell' },
  { id: 'post-7', near: 50, span: 5, target: 'gnomon' },
  { id: 'post-8', near: 58, span: 5, target: 'bell' },
  { id: 'post-9', near: 62, span: 5, target: 'lantern-tree' },
  { id: 'post-10', near: 75, span: 5, target: 'gnomon' },
  { id: 'post-11', near: 82, span: 5, target: 'lantern-tree' },
  { id: 'post-12', near: 90, span: 5, target: 'gnomon' },
];

// How much room a post needs: clear of the landmark courts, because a signpost
// standing next to the thing it points at is a joke the player has to walk to
// get to, and clear of the other posts, so the twelve of them stay twelve
// directions rather than one crowd.
export const SIGNPOST_CLEARANCE = 8;
export const SIGNPOST_SPACING = 10;

// What a post says about how far it is, in Chebyshev tiles: under the first is
// nearby, under the last is a long walk, past it is far (`SIGNPOST.far` in
// src/text.js names them). Banded rather than counted because a post is
// somebody's directions, not an instrument — the compass is the instrument.
// The first band doubles as "close enough to name too" for a landmark that
// isn't the one a post was assigned (see `SIGNPOST_PLAN` above).
export const SIGNPOST_BANDS = [15, 40, 80];

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
// long walk. The compass is priced well above the map on purpose: it turns
// every walk into a follow-the-needle exercise the moment it's in hand, so it
// should cost most of a campaign's early coin rather than a couple of chests.
export const PRICES = {
  'torch-small': 10,
  'torch-medium': 25,
  'torch-lamp': 40,
  'water-drop': 5,
  compass: 250,
  map: 50,
};

// --- Cheats -------------------------------------------------------------------
//
// The Settings switch that hands a run the whole late game to look at
// (DESIGN.md §6.2). The reveal reaches past the fourth sanctum's ring (110 + 7)
// and every landmark, with room to spare — the whole of the world the game
// actually has anything in.
export const CHEAT_REVEAL_RADIUS = 130;
export const CHEAT_COINS = 9999;
