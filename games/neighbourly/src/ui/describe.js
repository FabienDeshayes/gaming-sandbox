// Turns a scored tile (rules.js `scoreTile`) into the words the info panel
// shows. Pure, so the tests can read it without a browser.

import { pieceDef } from '../data/pieces.js';

const signed = (v) => (v >= 0 ? `+${v}` : `${v}`);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function termLabel(part) {
  const t = part.term;
  if (t.count) {
    switch (t.count) {
      case 'adjacentPieces':
        return `${signed(part.value)} for ${plural(part.n, 'neighbour', 'neighbours')}`;
      case 'adjacentTerrain':
        return `${signed(part.value)} for ${part.n} ${t.terrain} next to it`;
      case 'rowPieces':
        return `${signed(part.value)} for ${part.n} in its row`;
      case 'columnPieces':
        return `${signed(part.value)} for ${part.n} in its column`;
      case 'distinctTypes':
        return `${signed(part.value)} for ${plural(part.n, 'type', 'types')}`;
    }
  }
  switch (t.when) {
    case 'onTerrain':
      return `${signed(part.value)} on ${t.terrain}`;
    case 'onEdge':
      return `${signed(part.value)} on the edge`;
    case 'adjacentPiecesEquals':
      return `${signed(part.value)} with ${plural(t.equals, 'neighbour', 'neighbours')}`;
  }
  return signed(part.value);
}

// "5: 1 base, +4 for 2 water next to it, +2 Booster". Terms worth nothing
// here are left out; the base is always said, so the sum reads in full.
export function breakdown(tile) {
  const bits = [];
  for (const p of tile.parts) {
    if (p.kind === 'base') bits.push(`${p.value} base`);
    else if (p.kind === 'aura') bits.push(`${signed(p.value)} ${pieceDef(p.from).name}`);
    else if (p.value !== 0) bits.push(termLabel(p));
  }
  const floor = tile.raw < 0 ? ' (never below 0)' : '';
  return `${tile.score}: ${bits.join(', ')}${floor}`;
}
