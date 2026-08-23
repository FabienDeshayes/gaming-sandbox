// Every item in the game. Lights carry a shape (src/core/light.js) and a
// durability; water carries a refill; coins carry neither.
//
// The tension the numbers encode: a light that shows you more burns out faster,
// so every upgrade is also a shorter leash (DESIGN.md §4.1).
//
// Two fields tie an item to the gems (DESIGN.md §4.4):
//
//   `tier`   — the gem that brings this item into the world. Below that many
//              gems the world simply doesn't spawn it; see the SCATTER table in
//              core/world.js, which is where the gating actually happens.
//   `hue`    — which gem's colour it is drawn in. 0 is the palette's own
//              foreground, 1-3 the colour that gem gave back.
//
// The tiers are deliberately about *range*: each one carries water further than
// the last, so the gem you just found is what makes the next sanctum survivable.

export const ITEMS = {
  'torch-small': {
    id: 'torch-small',
    name: 'SMALL TORCH',
    sprite: 'torch-small',
    isLight: true,
    maxDurability: 100,
    shape: { kind: 'radius', radius: 1 },
    effect: 'Lights the 8 tiles around you.',
  },
  'torch-medium': {
    id: 'torch-medium',
    name: 'MEDIUM TORCH',
    sprite: 'torch-medium',
    isLight: true,
    maxDurability: 50,
    shape: { kind: 'radius', radius: 2 },
    effect: 'Lights 2 tiles in every direction. Twice the reach, half the leash.',
  },
  'torch-lamp': {
    id: 'torch-lamp',
    name: 'LAMP TORCH',
    sprite: 'torch-lamp',
    isLight: true,
    maxDurability: 60,
    shape: { kind: 'cone', depth: 4 },
    effect: 'Lights a widening cone 4 tiles ahead. Sees nothing behind you.',
  },
  // The one light that breaks the "more reach, shorter leash" trade, because it
  // is the second gem's reward for a walk nothing else would survive.
  'torch-beacon': {
    id: 'torch-beacon',
    name: 'BEACON',
    sprite: 'torch-beacon',
    isLight: true,
    maxDurability: 140,
    shape: { kind: 'radius', radius: 3 },
    tier: 2,
    hue: 2,
    effect: 'Lights 3 tiles in every direction, and burns longer than anything.',
  },
  coin: {
    id: 'coin',
    name: 'COINS',
    sprite: 'coin',
    isLight: false,
    effect: 'What the merchant takes. The counter shows everything you have banked plus what you are carrying.',
  },
  // 30 against a 200 tank, so a drop is a seventh of a walk rather than a tenth.
  // The separation rule caps how *many* of a kind the ground can hold
  // (MIN_SEPARATION in core/world.js), so past a point the only way to put more
  // water in the world is to make a drop worth more — which is also what keeps
  // the flask from being the moment water stops being a problem at all.
  'water-drop': {
    id: 'water-drop',
    name: 'WATER DROP',
    sprite: 'water-drop',
    isLight: false,
    water: 30,
    effect: 'Refills 30 water. Run dry and the run is over.',
  },
  'water-flask': {
    id: 'water-flask',
    name: 'WATER FLASK',
    sprite: 'water-flask',
    isLight: false,
    water: 60,
    tier: 1,
    hue: 1,
    effect: 'Refills 60 water. Two drops in one, and it carries you further out.',
  },
  'spring-vial': {
    id: 'spring-vial',
    name: 'SPRING VIAL',
    sprite: 'spring-vial',
    isLight: false,
    water: Infinity,
    tier: 3,
    hue: 3,
    effect: 'Fills your water right back up, however far from home you are.',
  },
  // The three gems. Nothing hides them — the sanctum wall around each one is
  // the gate, so nothing else needs to be.
  'gem-1': {
    id: 'gem-1',
    name: 'FIRST COLOUR',
    sprite: 'gem',
    isLight: false,
    gem: 1,
    hue: 1,
    effect: 'The first colour, back in the world. Opens the gate that wants one gem.',
  },
  'gem-2': {
    id: 'gem-2',
    name: 'SECOND COLOUR',
    sprite: 'gem',
    isLight: false,
    gem: 2,
    hue: 2,
    effect: 'The second colour, back in the world. Opens the gate that wants two gems.',
  },
  'gem-3': {
    id: 'gem-3',
    name: 'THIRD COLOUR',
    sprite: 'gem',
    isLight: false,
    gem: 3,
    hue: 3,
    effect: 'The last colour. Opens the gate at the far edge of everything.',
  },

  // The two tools. Neither is consumed and neither stacks — you own one or you
  // don't — so they sit outside the inventory entirely and show up in the HUD
  // instead. Each can be bought from the merchant or found lying in the dark
  // (core/world.js `LANDMARK_PLAN`); owning one takes it off both.
  compass: {
    id: 'compass',
    name: 'COMPASS',
    sprite: 'compass',
    isLight: false,
    tool: true,
    effect: 'Points at whatever is worth walking to next, or at the hut.',
  },
  map: {
    id: 'map',
    name: 'MAP',
    sprite: 'map',
    isLight: false,
    tool: true,
    effect: 'Draws everywhere you have walked, and remembers it between runs.',
  },
};

export const STARTING_LIGHT = 'torch-small';

// The tools, in the order they are offered and shown.
export const TOOLS = ['compass', 'map'];

export function isTool(id) {
  const def = itemDef(id);
  return !!def && !!def.tool;
}

export function itemDef(id) {
  return ITEMS[id] || null;
}
