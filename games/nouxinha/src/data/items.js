// Every item in the game: what it is called, what it is drawn as, and what it
// says about itself on its card.
//
// The numbers are not here — a light's durability and shape and a water's
// refill are balance, so they live in `src/balance.js` and are spread in below.
// So does the question of which gem brings an item into the world: that gating
// happens in balance.js's SCATTER table, and nothing reads it off an item.
//
// The one gem field an item does carry is `hue`: which gem's colour it is drawn
// in (DESIGN.md §4.4). 0 is the palette's own foreground, 1-3 the colour that
// gem gave back.

import { LIGHTS, WATER_VALUE } from '../balance.js';

export const ITEMS = {
  'torch-small': {
    id: 'torch-small',
    name: 'SMALL TORCH',
    sprite: 'torch-small',
    isLight: true,
    ...LIGHTS['torch-small'],
    effect: 'Lights the 8 tiles around you.',
  },
  'torch-medium': {
    id: 'torch-medium',
    name: 'MEDIUM TORCH',
    sprite: 'torch-medium',
    isLight: true,
    ...LIGHTS['torch-medium'],
    effect: 'Lights 2 tiles in every direction. Twice the reach, half the leash.',
  },
  'torch-lamp': {
    id: 'torch-lamp',
    name: 'LAMP TORCH',
    sprite: 'torch-lamp',
    isLight: true,
    ...LIGHTS['torch-lamp'],
    effect: 'Lights a widening cone 4 tiles ahead. Sees nothing behind you.',
  },
  'torch-beacon': {
    id: 'torch-beacon',
    name: 'BEACON',
    sprite: 'torch-beacon',
    isLight: true,
    ...LIGHTS['torch-beacon'],
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
  // The refill numbers come out of balance.js, and so does the copy that quotes
  // them — a retuned drop should never be a drop whose card lies about it.
  'water-drop': {
    id: 'water-drop',
    name: 'WATER DROP',
    sprite: 'water-drop',
    isLight: false,
    water: WATER_VALUE['water-drop'],
    effect: `Refills ${WATER_VALUE['water-drop']} water. Run dry and the run is over.`,
  },
  'water-flask': {
    id: 'water-flask',
    name: 'WATER FLASK',
    sprite: 'water-flask',
    isLight: false,
    water: WATER_VALUE['water-flask'],
    hue: 1,
    effect: `Refills ${WATER_VALUE['water-flask']} water. Two drops in one, and it carries you further out.`,
  },
  'spring-vial': {
    id: 'spring-vial',
    name: 'SPRING VIAL',
    sprite: 'spring-vial',
    isLight: false,
    water: WATER_VALUE['spring-vial'],
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

// The tools, in the order they are offered and shown.
export const TOOLS = ['compass', 'map'];

export function itemDef(id) {
  return ITEMS[id] || null;
}
