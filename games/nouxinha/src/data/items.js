// Every item in the game: what it is, what it is drawn as, and where the words
// on its card come from.
//
// The numbers are not here — a light's durability and shape and a water's
// refill are balance, so they live in `src/balance.js` and are spread in below.
// Neither are the words: a name and an effect line are copy, so they live in
// `src/text.js` and are spread in the same way. So does the question of which
// gem brings an item into the world: that gating happens in balance.js's
// SCATTER table, and nothing reads it off an item.
//
// The one gem field an item does carry is `hue`: which gem's colour it is drawn
// in (DESIGN.md §4.4). 0 is the palette's own foreground, 1-3 the colour that
// gem gave back.

import { LIGHTS, WATER_VALUE } from '../balance.js';
import { ITEM_TEXT } from '../text.js';

export const ITEMS = {
  'torch-small': {
    id: 'torch-small',
    ...ITEM_TEXT['torch-small'],
    sprite: 'torch-small',
    isLight: true,
    ...LIGHTS['torch-small'],
  },
  'torch-medium': {
    id: 'torch-medium',
    ...ITEM_TEXT['torch-medium'],
    sprite: 'torch-medium',
    isLight: true,
    ...LIGHTS['torch-medium'],
  },
  'torch-lamp': {
    id: 'torch-lamp',
    ...ITEM_TEXT['torch-lamp'],
    sprite: 'torch-lamp',
    isLight: true,
    ...LIGHTS['torch-lamp'],
  },
  'torch-beacon': {
    id: 'torch-beacon',
    ...ITEM_TEXT['torch-beacon'],
    sprite: 'torch-beacon',
    isLight: true,
    ...LIGHTS['torch-beacon'],
    hue: 2,
  },
  coin: {
    id: 'coin',
    ...ITEM_TEXT['coin'],
    sprite: 'coin',
    isLight: false,
  },
  // The refill numbers come out of balance.js, and the card copy in text.js
  // quotes them — a retuned drop should never be a drop whose card lies about it.
  'water-drop': {
    id: 'water-drop',
    ...ITEM_TEXT['water-drop'],
    sprite: 'water-drop',
    isLight: false,
    water: WATER_VALUE['water-drop'],
  },
  'water-flask': {
    id: 'water-flask',
    ...ITEM_TEXT['water-flask'],
    sprite: 'water-flask',
    isLight: false,
    water: WATER_VALUE['water-flask'],
    hue: 1,
  },
  'spring-vial': {
    id: 'spring-vial',
    ...ITEM_TEXT['spring-vial'],
    sprite: 'spring-vial',
    isLight: false,
    water: WATER_VALUE['spring-vial'],
    hue: 3,
  },
  // The three gems. Nothing hides them — the sanctum wall around each one is
  // the gate, so nothing else needs to be.
  'gem-1': {
    id: 'gem-1',
    ...ITEM_TEXT['gem-1'],
    sprite: 'gem',
    isLight: false,
    gem: 1,
    hue: 1,
  },
  'gem-2': {
    id: 'gem-2',
    ...ITEM_TEXT['gem-2'],
    sprite: 'gem',
    isLight: false,
    gem: 2,
    hue: 2,
  },
  'gem-3': {
    id: 'gem-3',
    ...ITEM_TEXT['gem-3'],
    sprite: 'gem',
    isLight: false,
    gem: 3,
    hue: 3,
  },

  // The three keys, one per shut gate. Like a gem, a key is a thing you *hold*
  // rather than a thing you carry: it never burns down, never stacks, and is
  // only yours once the hut has written it down. Its `hue` is the gate it opens
  // — the key and the gate wear the same gem's colour, which is the whole of
  // what makes "the blue gate wants the blue key" legible without a word of UI.
  'key-1': {
    id: 'key-1',
    ...ITEM_TEXT['key-1'],
    sprite: 'key',
    isLight: false,
    key: 1,
    hue: 1,
  },
  'key-2': {
    id: 'key-2',
    ...ITEM_TEXT['key-2'],
    sprite: 'key',
    isLight: false,
    key: 2,
    hue: 2,
  },
  'key-3': {
    id: 'key-3',
    ...ITEM_TEXT['key-3'],
    sprite: 'key',
    isLight: false,
    key: 3,
    hue: 3,
  },

  // The two tools. Neither is consumed and neither stacks — you own one or you
  // don't — so they sit outside the inventory entirely and show up in the HUD
  // instead. Each can be bought from the merchant or found lying in the dark
  // (balance.js `SITE_PLAN`); owning one takes it off both.
  compass: {
    id: 'compass',
    ...ITEM_TEXT['compass'],
    sprite: 'compass',
    isLight: false,
    tool: true,
  },
  map: {
    id: 'map',
    ...ITEM_TEXT['map'],
    sprite: 'map',
    isLight: false,
    tool: true,
  },
};

// The tools, in the order they are offered and shown.
export const TOOLS = ['compass', 'map'];

// The keys, in the order the gates want them — which is also the order of the
// colours they are drawn in (balance.js `SANCTUM_PLAN`).
export const KEYS = ['key-1', 'key-2', 'key-3'];

export function itemDef(id) {
  return ITEMS[id] || null;
}
