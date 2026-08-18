// Every item in the game. Lights carry a shape (src/core/light.js) and a
// durability; water carries a refill; coins carry neither.
//
// The tension the numbers encode: a light that shows you more burns out faster,
// so every upgrade is also a shorter leash (DESIGN.md §4.1).
//
// Two fields tie an item to the gems (DESIGN.md §4.4):
//
//   `unlock` — how many gems you need before this exists for you at all. The
//              world always generated it; without the gem you walk straight
//              past the tile without seeing a thing.
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
    unlock: 2,
    hue: 2,
    effect: 'Lights 3 tiles in every direction, and burns longer than anything.',
  },
  coin: {
    id: 'coin',
    name: 'COIN',
    sprite: 'coin',
    isLight: false,
    effect: 'Currency. The merchant is not open yet.',
  },
  'water-drop': {
    id: 'water-drop',
    name: 'WATER DROP',
    sprite: 'water-drop',
    isLight: false,
    water: 20,
    effect: 'Refills 20 water. Run dry and the run is over.',
  },
  'water-flask': {
    id: 'water-flask',
    name: 'WATER FLASK',
    sprite: 'water-flask',
    isLight: false,
    water: 60,
    unlock: 1,
    hue: 1,
    effect: 'Refills 60 water. Three drops in one, and it carries you further out.',
  },
  'spring-vial': {
    id: 'spring-vial',
    name: 'SPRING VIAL',
    sprite: 'spring-vial',
    isLight: false,
    water: Infinity,
    unlock: 3,
    hue: 3,
    effect: 'Fills your water right back up, however far from home you are.',
  },
  // The three gems. They are never hidden by `unlock` — the sanctum wall around
  // each one is the gate, so nothing else needs to be.
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
};

export const STARTING_LIGHT = 'torch-small';

export function itemDef(id) {
  return ITEMS[id] || null;
}

// How many gems you need before this item is part of your world at all.
export function unlockOf(id) {
  const def = itemDef(id);
  return def && def.unlock ? def.unlock : 0;
}
