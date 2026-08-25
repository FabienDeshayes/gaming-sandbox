// The four kinds of world, and what each one is.
//
// A world is all one biome and always has been one thing or another — a
// campaign walks a temperate dark, a frozen one, a desert or a mystical realm,
// never a border between two (DESIGN.md §4.3). Which one a world is falls out
// of its seed (`biomeOf` in src/core/world.js), so it is derived like
// everything else about the world rather than written into the save: a slot's
// seed is the whole of its world's identity, biome included.
//
// What a biome *is*, so far, is two things:
//
//   - the colour the world is drawn in by default. Each biome takes one of the
//     four palettes (src/config.js), which is what makes a frozen world read
//     cold and a desert warm without a single new asset. A palette picked in
//     Settings is the player's, and outranks this everywhere (`setDefaultPalette`).
//   - the tiles it draws its terrain with. A biome names only the keys it wants
//     to draw differently, in `BIOME_TILES` (src/data/tiles.js) — today all four
//     draw the same art, and that table is where that stops being true.
//
// The parameters the ground itself is grown on — how much rock, how thick the
// groves, what the scatter holds — are not here yet: they live in
// src/balance.js, one set for every world.

import { BIOME_NAMES } from '../text.js';

export const BIOMES = [
  { id: 'temperate', name: BIOME_NAMES.temperate, palette: 'phosphor' },
  { id: 'frozen', name: BIOME_NAMES.frozen, palette: 'cathode' },
  { id: 'desert', name: BIOME_NAMES.desert, palette: 'amber' },
  { id: 'mystic', name: BIOME_NAMES.mystic, palette: 'magenta' },
];

// The world every campaign walked before there were four kinds of them, and the
// answer for anything that has to name a biome without having a world in hand.
export const DEFAULT_BIOME = BIOMES[0].id;

export const BIOME_IDS = BIOMES.map((biome) => biome.id);

export function biomeDef(id) {
  return BIOMES.find((biome) => biome.id === id) || BIOMES[0];
}

export function isBiome(id) {
  return BIOME_IDS.includes(id);
}
