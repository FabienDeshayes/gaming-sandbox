// Bakes the 1-bit masks in src/data/sprites.js into white textures.
//
// White, not coloured: every sprite is drawn tinted with the palette's
// foreground, so one texture set serves all four palettes and a palette swap
// costs nothing at runtime.

import { SPRITES } from '../data/sprites.js';
import { SPRITE_PX } from '../config.js';

// Phaser's texture generator maps each character to a palette entry and treats
// '.' as transparent, which is exactly the mask format.
const WHITE = { 1: '#ffffff' };

function validate(key, mask) {
  if (mask.length !== SPRITE_PX)
    throw new Error(`sprite "${key}": ${mask.length} rows, expected ${SPRITE_PX}`);
  const bad = mask.findIndex((row) => row.length !== SPRITE_PX);
  if (bad !== -1)
    throw new Error(
      `sprite "${key}" row ${bad}: ${mask[bad].length} px wide, expected ${SPRITE_PX}`
    );
}

export function ensureTextures(scene) {
  for (const [key, mask] of Object.entries(SPRITES)) {
    if (scene.textures.exists(key)) continue;
    validate(key, mask);
    scene.textures.generate(key, {
      data: mask.map((row) => row.replace(/#/g, '1')),
      pixelWidth: 1,
      pixelHeight: 1,
      palette: WHITE,
    });
  }
}
