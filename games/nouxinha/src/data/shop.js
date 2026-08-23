// What the merchant sells: the shelf, and the two questions the shop widget and
// the rules ask about it. The prices themselves are economy, so they live in
// `src/balance.js` (DESIGN.md §4.5).

import { PRICES } from '../balance.js';

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
