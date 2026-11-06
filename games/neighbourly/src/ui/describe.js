// Turns a scored tile (rules.js `scoreTile`) into the words the info panel
// shows. Pure, so the tests can read it without a browser; the words are SUM in
// src/text.js.

import { PIECE_TEXT, SUM } from '../text.js';

function termLabel(part) {
  const t = part.term;
  if (t.count) return SUM.count[t.count](part.value, part.n);
  return SUM.when[t.when](part.value, t);
}

// "5: 1 base, +4 for 2 neighbours, +2 Booster". Terms worth nothing here are
// left out; the base is always said, so the sum reads in full.
export function breakdown(tile) {
  const bits = [];
  for (const p of tile.parts) {
    if (p.kind === 'base') bits.push(SUM.base(p.value));
    else if (p.kind === 'aura') bits.push(SUM.aura(p.value, PIECE_TEXT[p.from].name));
    else if (p.value !== 0) bits.push(termLabel(p));
  }
  return SUM.total(tile.score, bits, tile.raw < 0);
}

export const pieceName = (id) => PIECE_TEXT[id].name;
export const pieceRule = (id) => PIECE_TEXT[id].rule;
