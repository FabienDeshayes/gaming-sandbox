// Every item in the game. Lights carry a shape (src/core/light.js) and a
// durability; coins carry neither.
//
// The tension the numbers encode: a light that shows you more burns out faster,
// so every upgrade is also a shorter leash (DESIGN.md §4.1).

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
    shape: { kind: 'cone', depth: 3 },
    effect: 'Lights a widening cone 3 tiles ahead. Sees nothing behind you.',
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
    effect: 'Refills 20 water, up to the 200 max. Run dry and the run is over.',
  },
};

export const STARTING_LIGHT = 'torch-small';

export function itemDef(id) {
  return ITEMS[id] || null;
}
