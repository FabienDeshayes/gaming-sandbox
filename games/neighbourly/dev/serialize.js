// How the three data files the dev pages edit are written back out.
//
// `src/data/palette.js`, `src/data/pieces.js` and `src/data/sprites.js` are
// data and nothing else, in exactly the shape these functions print, so a page
// that loads them and exports them again with no edits hands back the file
// byte for byte (tests/data.test.mjs holds that). Edit them by hand if you
// like, but keep the shape, or the next export from a page will reformat the
// whole file.
//
// Not part of the game: nothing in `src/` imports this.

// A JS literal: single-quoted strings, `{ a: 1 }` objects, `[1, 2]` arrays, all
// on one line. Keys are bare because every key in these files is an identifier.
export function lit(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'string') return `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return `[${v.map(lit).join(', ')}]`;
  const body = Object.entries(v)
    .filter(([, x]) => x !== undefined)
    .map(([k, x]) => `${k}: ${lit(x)}`)
    .join(', ');
  return body ? `{ ${body} }` : '{}';
}

const PALETTE_HEAD = `// Every colour the game draws with, and nothing else may be drawn in.
//
// Thirty-two colours in ramps (dark to light within a hue), so a sprite can be
// shaded without leaving the palette. \`key\` is the one character a sprite in
// src/data/sprites.js writes for that colour; \`name\` is what src/config.js and
// the dev pages call it. Change a hex and every sprite and every panel follows.
//
// Written by palette.html (dev/serialize.js) — edit it there, or by hand in
// exactly this shape.
`;

export function serializePalette(palette) {
  const rows = palette.map((c) => `  ${lit({ key: c.key, name: c.name, hex: c.hex })},`);
  return `${PALETTE_HEAD}\nexport const PALETTE = [\n${rows.join('\n')}\n];\n`;
}

const PIECES_HEAD = `// The sets and the pieces in them: what each piece *does*. What it is called
// and how its rule reads are src/text.js (PIECE_TEXT), and what it looks like
// is src/data/sprites.js, both under the piece's id.
//
// A run plays every \`core\` set plus special sets drawn from its seed
// (\`specialSets\` in src/data/tuning.js). A piece's score is
//
//   base + every term in \`terms\` + the auras of the pieces that reach it
//
// and never less than 0. A term counts something and pays \`each\` per thing
// counted (\`per: n\` counts in whole groups of n), or checks a condition and
// adds \`add\` when it holds. \`aura\` is \`{ amount, reach }\`: what this piece
// adds to every piece it reaches. The vocabulary is the switches in
// src/core/rules.js (COUNTS, CONDITIONS, REACHES); a piece that only
// recombines it is a line here and a line in text.js, and nothing else.
//
// \`rarity\` does nothing yet (every piece in a run is equally likely), but odds
// and pools will need it.
//
// Written by sets.html (dev/serialize.js) — edit it there, or by hand in
// exactly this shape.
`;

export function serializePieces(sets, pieces) {
  const s = sets.map((x) => `  ${lit({ id: x.id, core: x.core, emblem: x.emblem })},`);
  const p = pieces.map(
    (x) => `  ${lit({ id: x.id, set: x.set, rarity: x.rarity, base: x.base, terms: x.terms, aura: x.aura ?? null })},`
  );
  return `${PIECES_HEAD}\nexport const SETS = [\n${s.join('\n')}\n];\n\nexport const PIECES = [\n${p.join('\n')}\n];\n`;
}

const SPRITES_HEAD = `// Every sprite, as text: sixteen rows of sixteen characters, each one a
// palette key (src/data/palette.js) or \`.\` for nothing. A piece's sprite is
// filed under its id. They are baked into textures at boot
// (src/ui/textures.js) and drawn at a whole multiple of their size, so a pixel
// is always a square.
//
// Written by draw.html (dev/serialize.js) — draw them there, or by hand in
// exactly this shape.
`;

export function serializeSprites(sprites) {
  const body = Object.entries(sprites)
    .map(([k, rows]) => `  ${k}: [\n${rows.map((r) => `    '${r}',`).join('\n')}\n  ],`)
    .join('\n');
  return `${SPRITES_HEAD}\nexport const SPRITES = {\n${body}\n};\n`;
}
