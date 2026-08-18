// What the merchant sells, and for how much.
//
// One table, so retuning the economy never means reading the shop's code. The
// merchant is the only place coins go, and the only reason to pick one up
// (DESIGN.md §4.5).
//
// Lights and water are stock: buy as many as you can carry. The compass and the
// map are one-offs — you own one or you don't — and each can also be found
// lying in the dark, so buying one is paying to skip a very long walk.

export const PRICES = {
  'torch-small': 10,
  'torch-medium': 25,
  'torch-lamp': 40,
  'water-drop': 5,
  compass: 50,
  map: 100,
};

// The order they're listed in, cheapest use first.
export const STOCK = ['water-drop', 'torch-small', 'torch-medium', 'torch-lamp', 'compass', 'map'];

// Bought at most once each, and gone from the shelf afterwards.
export const ONE_OFF = ['compass', 'map'];

export function priceOf(id) {
  return PRICES[id] === undefined ? null : PRICES[id];
}

export function isOneOff(id) {
  return ONE_OFF.includes(id);
}
