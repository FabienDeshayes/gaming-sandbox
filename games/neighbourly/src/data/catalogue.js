// Lookups over src/data/pieces.js, which is data only (the dev pages rewrite
// it). Everything that asks "which piece is this" or "what is in this set"
// comes through here.

import { PIECES, SETS } from './pieces.js';

export const RARITIES = ['common', 'uncommon', 'rare', 'legendary'];

const BY_ID = new Map(PIECES.map((p) => [p.id, p]));

export function pieceDef(id) {
  const def = BY_ID.get(id);
  if (!def) throw new Error(`unknown piece "${id}"`);
  return def;
}

export function setDef(id) {
  const def = SETS.find((s) => s.id === id);
  if (!def) throw new Error(`unknown set "${id}"`);
  return def;
}

export const CORE_SETS = SETS.filter((s) => s.core).map((s) => s.id);
export const SPECIAL_SETS = SETS.filter((s) => !s.core).map((s) => s.id);

export function piecesIn(setId) {
  return PIECES.filter((p) => p.set === setId).map((p) => p.id);
}
