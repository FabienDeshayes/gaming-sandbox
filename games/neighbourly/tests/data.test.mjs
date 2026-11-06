// The data files hold together: every piece has words and a sprite, every
// sprite is drawable in the palette, and the dev pages can write each file
// back out unchanged.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PALETTE } from '../src/data/palette.js';
import { PIECES, SETS } from '../src/data/pieces.js';
import { SPRITES } from '../src/data/sprites.js';
import { RARITIES, piecesIn } from '../src/data/catalogue.js';
import { REACHES } from '../src/core/rules.js';
import { PIECE_TEXT, RARITY_TEXT, SET_TEXT, SUM } from '../src/text.js';
import { ROLES, RARITY_ROLES } from '../src/config.js';
import { serializePalette, serializePieces, serializeSprites } from '../dev/serialize.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('one base set of twelve in every game, and special sets of six', () => {
  const core = SETS.filter((s) => s.core);
  assert.deepEqual(core.map((s) => s.id), ['base']);
  assert.equal(piecesIn('base').length, 12);
  const special = SETS.filter((s) => !s.core);
  assert.ok(special.length >= 2, 'more than one special set, or there is nothing to draw');
  for (const s of special) assert.equal(piecesIn(s.id).length, 6, s.id);
});

test('every piece belongs to one known set, with a unique id and a known rarity', () => {
  const ids = PIECES.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const p of PIECES) {
    assert.ok(SETS.some((s) => s.id === p.set), `${p.id}: set ${p.set}`);
    assert.ok(RARITIES.includes(p.rarity), `${p.id}: rarity ${p.rarity}`);
    assert.ok(Number.isInteger(p.base), `${p.id}: base`);
    if (p.aura) assert.ok(REACHES[p.aura.reach] && Number.isInteger(p.aura.amount), `${p.id}: aura`);
  }
  for (const s of SETS) assert.equal(PIECES.find((p) => p.id === s.emblem)?.set, s.id, `${s.id}'s emblem is one of its own`);
});

test('every piece, set and rarity has its words', () => {
  for (const p of PIECES) assert.ok(PIECE_TEXT[p.id]?.name && PIECE_TEXT[p.id]?.rule, p.id);
  assert.deepEqual(Object.keys(PIECE_TEXT).sort(), PIECES.map((p) => p.id).sort(), 'no words for a piece that is gone');
  for (const s of SETS) assert.ok(SET_TEXT[s.id]?.name && SET_TEXT[s.id]?.about, s.id);
  for (const r of RARITIES) assert.ok(RARITY_TEXT[r], r);
  for (const p of PIECES)
    for (const t of p.terms) assert.ok(t.count ? SUM.count[t.count] : SUM.when[t.when], `${p.id}: no read-out for ${t.count || t.when}`);
});

test('every piece has a 16×16 sprite drawn only in palette colours', () => {
  const keys = new Set(PALETTE.map((c) => c.key));
  for (const p of PIECES) assert.ok(SPRITES[p.id], `${p.id} has no sprite`);
  for (const [id, rows] of Object.entries(SPRITES)) {
    assert.equal(rows.length, 16, id);
    for (const r of rows) {
      assert.equal(r.length, 16, id);
      for (const ch of r) assert.ok(ch === '.' || keys.has(ch), `${id} uses "${ch}", not in the palette`);
    }
    assert.ok(rows.some((r) => /[^.]/.test(r)), `${id} is blank`);
  }
});

test('the palette is 32 distinct colours, one character each, and every colour role names one', () => {
  assert.equal(PALETTE.length, 32);
  assert.equal(new Set(PALETTE.map((c) => c.key)).size, 32);
  assert.equal(new Set(PALETTE.map((c) => c.name)).size, 32);
  assert.equal(new Set(PALETTE.map((c) => c.hex.toLowerCase())).size, 32);
  for (const c of PALETTE) {
    assert.match(c.hex, /^#[0-9a-f]{6}$/i, c.name);
    assert.equal(c.key.length, 1);
    assert.notEqual(c.key, '.');
  }
  const names = new Set(PALETTE.map((c) => c.name));
  for (const [role, n] of Object.entries({ ...ROLES, ...RARITY_ROLES })) assert.ok(names.has(n), `${role} → ${n}`);
});

test('the dev pages write each data file back out byte for byte', () => {
  assert.equal(serializePalette(PALETTE), read('src/data/palette.js'));
  assert.equal(serializePieces(SETS, PIECES), read('src/data/pieces.js'));
  assert.equal(serializeSprites(SPRITES), read('src/data/sprites.js'));
});
