// The sets and the pieces in them: what each piece *does*. What it is called
// and how its rule reads are src/text.js (PIECE_TEXT), and what it looks like
// is src/data/sprites.js, both under the piece's id.
//
// A run plays every `core` set plus special sets drawn from its seed
// (`specialSets` in src/data/tuning.js). A piece's score is
//
//   base + every term in `terms` + the auras of the pieces that reach it
//
// and never less than 0. A term counts something and pays `each` per thing
// counted (`per: n` counts in whole groups of n), or checks a condition and
// adds `add` when it holds. `aura` is `{ amount, reach }`: what this piece
// adds to every piece it reaches. The vocabulary is the switches in
// src/core/rules.js (COUNTS, CONDITIONS, REACHES); a piece that only
// recombines it is a line here and a line in text.js, and nothing else.
//
// `rarity` does nothing yet (every piece in a run is equally likely), but odds
// and pools will need it.
//
// Written by sets.html (dev/serialize.js) — edit it there, or by hand in
// exactly this shape.

export const SETS = [
  { id: 'base', core: true, emblem: 'basic' },
  { id: 'lines', core: false, emblem: 'crossroads' },
  { id: 'kin', core: false, emblem: 'twins' },
  { id: 'space', core: false, emblem: 'clearing' },
];

export const PIECES = [
  { id: 'basic', set: 'base', rarity: 'common', base: 2, terms: [], aura: null },
  { id: 'cluster', set: 'base', rarity: 'common', base: 0, terms: [{ count: 'adjacentPieces', each: 1 }], aura: null },
  { id: 'open', set: 'base', rarity: 'common', base: 4, terms: [{ count: 'adjacentPieces', each: -1 }], aura: null },
  { id: 'slant', set: 'base', rarity: 'common', base: 1, terms: [{ count: 'diagonalPieces', each: 2 }], aura: null },
  { id: 'core', set: 'base', rarity: 'common', base: 1, terms: [{ when: 'inCentre', add: 3 }], aura: null },
  { id: 'row', set: 'base', rarity: 'uncommon', base: 0, terms: [{ count: 'rowPieces', each: 1 }], aura: null },
  { id: 'column', set: 'base', rarity: 'uncommon', base: 0, terms: [{ count: 'columnPieces', each: 1 }], aura: null },
  { id: 'pair', set: 'base', rarity: 'uncommon', base: 2, terms: [{ when: 'adjacentPiecesEquals', equals: 1, add: 4 }], aura: null },
  { id: 'edge', set: 'base', rarity: 'uncommon', base: 3, terms: [{ when: 'onEdge', add: 3 }], aura: null },
  { id: 'hub', set: 'base', rarity: 'rare', base: 0, terms: [{ count: 'adjacentPieces', each: 2 }], aura: { amount: -1, reach: 'adjacent' } },
  { id: 'booster', set: 'base', rarity: 'rare', base: 0, terms: [], aura: { amount: 2, reach: 'adjacent' } },
  { id: 'monument', set: 'base', rarity: 'legendary', base: 0, terms: [{ count: 'distinctTypes', each: 2 }], aura: null },
  { id: 'lane', set: 'lines', rarity: 'common', base: 2, terms: [{ when: 'rowFull', add: 6 }], aura: null },
  { id: 'pillar', set: 'lines', rarity: 'common', base: 2, terms: [{ when: 'columnFull', add: 6 }], aura: null },
  { id: 'beacon', set: 'lines', rarity: 'uncommon', base: 0, terms: [], aura: { amount: 1, reach: 'row' } },
  { id: 'spire', set: 'lines', rarity: 'uncommon', base: 0, terms: [], aura: { amount: 1, reach: 'column' } },
  { id: 'cross', set: 'lines', rarity: 'rare', base: 0, terms: [{ count: 'linePieces', each: 1 }], aura: null },
  { id: 'crossroads', set: 'lines', rarity: 'legendary', base: 0, terms: [], aura: { amount: 1, reach: 'lines' } },
  { id: 'flock', set: 'kin', rarity: 'common', base: 1, terms: [{ count: 'adjacentSame', each: 2 }], aura: null },
  { id: 'loner', set: 'kin', rarity: 'common', base: 1, terms: [{ when: 'copiesEquals', equals: 0, add: 5 }], aura: null },
  { id: 'echo', set: 'kin', rarity: 'uncommon', base: 1, terms: [{ count: 'copies', each: 2 }], aura: null },
  { id: 'mosaic', set: 'kin', rarity: 'uncommon', base: 0, terms: [{ count: 'adjacentKinds', each: 2 }], aura: null },
  { id: 'twins', set: 'kin', rarity: 'rare', base: 3, terms: [{ when: 'adjacentSameEquals', equals: 1, add: 6 }], aura: null },
  { id: 'crowd', set: 'kin', rarity: 'legendary', base: 0, terms: [{ count: 'largestKind', each: 1 }], aura: null },
  { id: 'hermit', set: 'space', rarity: 'common', base: 1, terms: [{ count: 'adjacentEmpty', each: 2 }], aura: null },
  { id: 'corner', set: 'space', rarity: 'common', base: 2, terms: [{ when: 'inCorner', add: 6 }], aura: null },
  { id: 'island', set: 'space', rarity: 'uncommon', base: 0, terms: [{ when: 'adjacentPiecesEquals', equals: 0, add: 7 }], aura: null },
  { id: 'frontier', set: 'space', rarity: 'uncommon', base: 1, terms: [{ count: 'lineEmpty', each: 1 }], aura: null },
  { id: 'void', set: 'space', rarity: 'rare', base: 0, terms: [{ count: 'emptyTiles', each: 1, per: 3 }], aura: null },
  { id: 'clearing', set: 'space', rarity: 'legendary', base: 0, terms: [{ count: 'surroundingEmpty', each: 3 }], aura: null },
];
