// The one set of the prototype: twelve pieces whose verb is "neighbours".
//
// A piece is data, never code. Its score is
//
//   base + every term in `terms` + the auras of the pieces next to it
//
// and never less than 0. A term either counts something and pays `each` per
// thing counted, or checks a condition and adds `add` when it holds. `aura` is
// what this piece adds to (or takes from) each orthogonal neighbour's score.
// The vocabulary the terms may use is the switch in `termValue` in
// src/core/rules.js; a new piece that only recombines it is a new entry here and
// nothing else.
//
// `rarity` does nothing yet (the prototype's offers are fixed), but odds and
// pools will need it, so every piece carries one from the start.

export const RARITIES = ['common', 'uncommon', 'rare', 'legendary'];

export const PIECES = [
  {
    id: 'basic',
    name: 'Basic',
    rarity: 'common',
    glyph: '●',
    base: 2,
    terms: [],
    text: 'Scores 2.',
  },
  {
    id: 'cluster',
    name: 'Cluster',
    rarity: 'common',
    glyph: '✚',
    base: 0,
    terms: [{ count: 'adjacentPieces', each: 1 }],
    text: '1 per adjacent piece.',
  },
  {
    id: 'open',
    name: 'Open',
    rarity: 'common',
    glyph: '○',
    base: 4,
    terms: [{ count: 'adjacentPieces', each: -1 }],
    text: '4, minus 1 per adjacent piece.',
  },
  {
    id: 'shore',
    name: 'Shore',
    rarity: 'common',
    glyph: '≈',
    base: 1,
    terms: [{ count: 'adjacentTerrain', terrain: 'water', each: 2 }],
    text: '1, plus 2 per adjacent water tile.',
  },
  {
    id: 'ridge',
    name: 'Ridge',
    rarity: 'common',
    glyph: '▲',
    base: 1,
    terms: [{ when: 'onTerrain', terrain: 'rock', add: 3 }],
    text: '1, plus 3 if placed on rock.',
  },
  {
    id: 'row',
    name: 'Row',
    rarity: 'uncommon',
    glyph: '↔',
    base: 0,
    terms: [{ count: 'rowPieces', each: 1 }],
    text: '1 per other piece in its row.',
  },
  {
    id: 'column',
    name: 'Column',
    rarity: 'uncommon',
    glyph: '↕',
    base: 0,
    terms: [{ count: 'columnPieces', each: 1 }],
    text: '1 per other piece in its column.',
  },
  {
    id: 'pair',
    name: 'Pair',
    rarity: 'uncommon',
    glyph: '∞',
    base: 2,
    terms: [{ when: 'adjacentPiecesEquals', equals: 1, add: 4 }],
    text: '2, plus 4 if exactly one adjacent piece.',
  },
  {
    id: 'edge',
    name: 'Edge',
    rarity: 'uncommon',
    glyph: '□',
    base: 3,
    terms: [{ when: 'onEdge', add: 3 }],
    text: '3, plus 3 if on the board edge.',
  },
  {
    id: 'hub',
    name: 'Hub',
    rarity: 'rare',
    glyph: '✱',
    base: 0,
    terms: [{ count: 'adjacentPieces', each: 2 }],
    aura: -1,
    text: '2 per adjacent piece. Each neighbour scores 1 less.',
  },
  {
    id: 'booster',
    name: 'Booster',
    rarity: 'rare',
    glyph: '⇑',
    base: 0,
    terms: [],
    aura: 2,
    text: '0. Each neighbour scores 2 more.',
  },
  {
    id: 'monument',
    name: 'Monument',
    rarity: 'legendary',
    glyph: '★',
    base: 0,
    terms: [{ count: 'distinctTypes', each: 2 }],
    text: '2 per distinct piece type on the board.',
  },
];

const BY_ID = new Map(PIECES.map((p) => [p.id, p]));

export function pieceDef(id) {
  const def = BY_ID.get(id);
  if (!def) throw new Error(`unknown piece "${id}"`);
  return def;
}
