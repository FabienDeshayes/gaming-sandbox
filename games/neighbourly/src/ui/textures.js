// Bakes every sprite in src/data/sprites.js into a texture at boot, one canvas
// pixel per art pixel, filtered NEAREST so a sprite scaled up stays square.
// Nothing is loaded from disk, so nothing can fail to load.

import { PALETTE } from '../data/palette.js';
import { SPRITES } from '../data/sprites.js';

const HEX = Object.fromEntries(PALETTE.map((c) => [c.key, c.hex]));

export const spriteKey = (id) => `sprite:${id}`;

export function bakeSprites(scene) {
  for (const [id, rows] of Object.entries(SPRITES)) {
    const key = spriteKey(id);
    if (scene.textures.exists(key)) continue;
    const tex = scene.textures.createCanvas(key, rows[0].length, rows.length);
    const ctx = tex.getContext();
    rows.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (ch === '.') return;
        ctx.fillStyle = HEX[ch];
        ctx.fillRect(x, y, 1, 1);
      })
    );
    tex.refresh();
    tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
}
