// The four kinds of world, and what each one is.
//
// A world is all one biome and always has been one thing or another — a
// campaign walks a temperate dark, a frozen one, a desert or a mystical realm,
// never a border between two (DESIGN.md §4.3). Which one a world is falls out
// of its seed (`biomeOf` in src/core/world.js), so it is derived like
// everything else about the world rather than written into the save: a slot's
// seed is the whole of its world's identity, biome included.
//
// What a biome *is*, is three things:
//
//   - the colour the world is drawn in. Each biome takes one of the four
//     palettes (src/config.js), which is what makes a frozen world read cold
//     and a desert warm without a single new asset. There is no picking one in
//     Settings: a world's biome is the only thing that ever sets it
//     (`setDefaultPalette`).
//   - the tiles it draws its terrain with. A biome names only the keys it wants
//     to draw differently, in `BIOME_TILES` (src/data/tiles.js) — today that is
//     its floor and its trees, with the rock still shared between all four.
//   - the ground it grows. How much rock there is and how it masses, how thick
//     the groves are, how often the ground offers anything and what it offers
//     when it does: `BIOME_TERRAIN` in src/balance.js, read by `terrainTuning`
//     in src/core/world.js. That is the one of the three that makes a
//     campaign's four worlds four different walks rather than one walk in four
//     colours — which matters, because finishing all four is how the game ends
//     (DESIGN.md §4.9).
//
// All three are keyed by the id below and nothing else, so a biome stays what
// it has always been: a property of the seed, derived and never stored.

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
