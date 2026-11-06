// The one way a box is drawn: a flat fill with a bevel (light along the top
// and left, dark along the bottom and right) inside an ink outline, every edge
// a whole number of `px` screen pixels, so panels, tiles, cards and buttons
// read as the same pixel art as the sprites on them. Colours are numbers from
// COLORS / colour() in src/config.js.

import { COLORS } from '../config.js';

export const PX = 3; // one art pixel on screen, for frames

export function pixelBox(g, x, y, w, h, { fill, light, dark, edge = COLORS.shadow, alpha = 1, px = PX }) {
  g.fillStyle(edge, alpha).fillRect(x, y, w, h);
  g.fillStyle(fill, alpha).fillRect(x + px, y + px, w - 2 * px, h - 2 * px);
  if (light != null) {
    g.fillStyle(light, alpha).fillRect(x + px, y + px, w - 2 * px, px);
    g.fillStyle(light, alpha).fillRect(x + px, y + px, px, h - 2 * px);
  }
  if (dark != null) {
    g.fillStyle(dark, alpha).fillRect(x + px, y + h - 2 * px, w - 2 * px, px);
    g.fillStyle(dark, alpha).fillRect(x + w - 2 * px, y + px, px, h - 2 * px);
  }
  return g;
}

// A plain outline `px` thick, for selection and rarity rims.
export function pixelRim(g, x, y, w, h, colour, px = PX) {
  g.fillStyle(colour).fillRect(x, y, w, px);
  g.fillStyle(colour).fillRect(x, y + h - px, w, px);
  g.fillStyle(colour).fillRect(x, y, px, h);
  g.fillStyle(colour).fillRect(x + w - px, y, px, h);
  return g;
}
