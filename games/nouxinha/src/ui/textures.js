// Cuts the tile sheet into the game's sprites and bakes them into white
// textures.
//
// White, not the sheet's own near-white: every sprite is drawn tinted with the
// palette's foreground, so one texture set serves all four palettes, a palette
// swap costs nothing at runtime, and a gem's colour lands exactly on its hex
// rather than on a slightly grey version of it.
//
// The sheet is read once per page: the masks it yields are derived data, the
// same for every scene, so scene two onwards only pays for the textures it is
// missing.

import { buildSprites } from '../data/sprites.js';
import { SHEET_COLS, SHEET_GAP, SHEET_KEY, SHEET_PATH, SHEET_ROWS } from '../data/tiles.js';
import { SPRITE_PX } from '../config.js';

// Phaser's texture generator maps each character to a palette entry and treats
// '.' as transparent, which is exactly the mask format.
const WHITE = { 1: '#ffffff' };

// Every scene calls this from `preload`, because any of them can be the first
// one a page shows and none of them can draw without it. The loader is happy to
// be asked twice, but the key is guarded anyway so a re-entered scene doesn't
// log a texture-in-use warning.
export function preloadTiles(scene) {
  if (!scene.textures.exists(SHEET_KEY)) scene.load.image(SHEET_KEY, SHEET_PATH);
}

let sprites = null;

// A `readTile(col, row) -> mask` over the loaded sheet. Draws the image into a
// canvas once and reads every pixel back in one go — per-pixel queries through
// the texture manager re-blit the whole sheet each time, and there are a
// thousand tiles on it.
//
// The sheet is transparent everywhere it isn't drawn on, so alpha *is* the
// mask; the colour it was drawn in never matters.
function sheetReader(scene) {
  if (!scene.textures.exists(SHEET_KEY))
    throw new Error(`tile sheet "${SHEET_PATH}" is not loaded — call preloadTiles in preload()`);

  const image = scene.textures.get(SHEET_KEY).getSourceImage();
  const stride = SPRITE_PX + SHEET_GAP;
  const expectedW = SHEET_COLS * stride - SHEET_GAP;
  const expectedH = SHEET_ROWS * stride - SHEET_GAP;
  if (image.width !== expectedW || image.height !== expectedH)
    throw new Error(
      `tile sheet is ${image.width}x${image.height}, expected ${expectedW}x${expectedH} ` +
        `(${SHEET_COLS}x${SHEET_ROWS} tiles of ${SPRITE_PX}px, ${SHEET_GAP}px apart)`
    );

  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  return (col, row) => {
    if (col < 0 || col >= SHEET_COLS || row < 0 || row >= SHEET_ROWS)
      throw new Error(
        `tile (${col}, ${row}) is off the sheet — it is ${SHEET_COLS} tiles across and ${SHEET_ROWS} down`
      );
    const ox = col * stride;
    const oy = row * stride;
    const mask = [];
    for (let y = 0; y < SPRITE_PX; y++) {
      let line = '';
      for (let x = 0; x < SPRITE_PX; x++)
        line += data[((oy + y) * canvas.width + ox + x) * 4 + 3] > 127 ? '#' : '.';
      mask.push(line);
    }
    return mask;
  };
}

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
  if (!sprites) sprites = buildSprites(sheetReader(scene));
  for (const [key, mask] of Object.entries(sprites)) {
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

// The sprite keys the sheet has been cut into, for anything that wants to check
// the whole set is there rather than name one sprite.
export function spriteKeys() {
  return sprites ? Object.keys(sprites) : [];
}
