// Every word the game says to the player, in one place.
//
// The scenes, the info panel and the tests import from here and never spell a
// player-facing string themselves, so the whole voice of the game can be read
// (and rewritten, through text.html) without opening a scene. Piece ids, set
// ids, scene names and texture keys are not text: the player never sees them.
//
// Anything that varies is a function of what it varies on, so the copy and the
// number it quotes can't drift apart.
//
// Convention: SHOUTED CAPS are chrome (buttons, headings, the header).
// Sentence case is the game talking to you.

// --- Pieces -----------------------------------------------------------------

// A piece's name and its rule as the card and the set list print it. The rule
// is what src/data/pieces.js does, in words: when one changes, so does the
// other (tests/pieces.test.mjs plays each rule out as its words say it).
export const PIECE_TEXT = {
  basic: { name: 'Basic', rule: 'Scores 2.' },
  cluster: { name: 'Cluster', rule: '1 per adjacent piece.' },
  open: { name: 'Open', rule: '4, minus 1 per adjacent piece.' },
  slant: { name: 'Slant', rule: '1, plus 2 per diagonal neighbour.' },
  core: { name: 'Core', rule: '1, plus 3 if not on the edge.' },
  row: { name: 'Row', rule: '1 per other piece in its row.' },
  column: { name: 'Column', rule: '1 per other piece in its column.' },
  pair: { name: 'Pair', rule: '2, plus 4 with exactly one adjacent piece.' },
  edge: { name: 'Edge', rule: '3, plus 3 on the board edge.' },
  hub: { name: 'Hub', rule: '2 per adjacent piece. Each neighbour scores 1 less.' },
  booster: { name: 'Booster', rule: '0. Each neighbour scores 2 more.' },
  monument: { name: 'Monument', rule: '2 per distinct kind of piece on the board.' },

  lane: { name: 'Lane', rule: '2, plus 6 if its row is full.' },
  pillar: { name: 'Pillar', rule: '2, plus 6 if its column is full.' },
  beacon: { name: 'Beacon', rule: '0. Every other piece in its row scores 1 more.' },
  spire: { name: 'Spire', rule: '0. Every other piece in its column scores 1 more.' },
  cross: { name: 'Cross', rule: '1 per other piece in its row and column.' },
  crossroads: { name: 'Crossroads', rule: '0. Every other piece in its row and column scores 1 more.' },

  flock: { name: 'Flock', rule: '1, plus 2 per adjacent piece of its kind.' },
  loner: { name: 'Loner', rule: '1, plus 5 if no other piece of its kind is on the board.' },
  echo: { name: 'Echo', rule: '1, plus 2 per other piece of its kind on the board.' },
  mosaic: { name: 'Mosaic', rule: '2 per distinct kind of piece next to it.' },
  twins: { name: 'Twins', rule: '3, plus 6 with exactly one adjacent piece of its kind.' },
  crowd: { name: 'Crowd', rule: "1 per piece of the board's commonest kind." },

  hermit: { name: 'Hermit', rule: '1, plus 2 per adjacent empty tile.' },
  corner: { name: 'Corner', rule: '2, plus 6 in a corner.' },
  island: { name: 'Island', rule: '7 with no adjacent piece, else 0.' },
  frontier: { name: 'Frontier', rule: '1, plus 1 per empty tile in its row and column.' },
  void: { name: 'Void', rule: '1 per 3 empty tiles on the board.' },
  clearing: { name: 'Clearing', rule: '3 per empty tile around it, diagonals included.' },
};

// What each set is called and what it is about, for the title and the set list.
export const SET_TEXT = {
  base: { name: 'BASE', about: 'In every game: pieces that score from their neighbours.' },
  lines: { name: 'LINES', about: 'Rows and columns: fill a line, or light one up.' },
  kin: { name: 'KIN', about: 'Pieces that care what kind their neighbours are.' },
  space: { name: 'SPACE', about: 'Pieces that want room. The board only ever fills up.' },
};

export const RARITY_TEXT = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  legendary: 'Legendary',
};

// --- Title ------------------------------------------------------------------

export const TITLE = {
  name: 'Neighbourly',
  tagline: 'a placement puzzle on one small board',
  how: (t) => [
    `Each turn, pick one of ${t.offerSize} pieces and put it`,
    'on any tile. Whatever was there is gone.',
    '',
    'Pieces score from what is around them:',
    'their neighbours, their row, the edge.',
    'Tap a tile to see what a piece would score.',
    '',
    `After ${t.turnsPerLevel} turns the board must reach the`,
    `level's target. Clear all ${t.levels} levels on the`,
    'same board to win.',
  ],
  play: 'PLAY',
};

// --- The run ----------------------------------------------------------------

export const HUD = {
  level: (n, of) => `LEVEL ${n}/${of}`,
  turn: (n, of, left) => `Turn ${n}/${of} · ${left} left`,
  turnDone: (of) => `Turn ${of}/${of}`,
  score: (n) => `SCORE ${n}`,
  target: (n) => `target ${n}`,
  sets: 'SETS',
  place: 'PLACE',
  setsInPlay: (names) => `Sets: ${names.join(' + ')}`,
};

export const INFO = {
  preview: (name, replacing, d) => `${name}${replacing ? `, replacing ${replacing}` : ''}: ${d >= 0 ? '+' : ''}${d}`,
  previewBody: (before, after, sum) => `Board ${before} → ${after}. It scores ${sum}`,
  inspect: (name) => name,
  inspectBody: (sum, rule) => `Scores ${sum}. ${rule}`,
  empty: 'Empty tile',
  emptyBody: 'Pick a piece below to see what it would score here.',
  picked: (name) => name,
  pickedBody: 'Tap a tile to preview the score. Placing replaces whatever is there.',
  idle: 'Pick a piece',
  idleBody: 'Choose one of the three offers, then tap a tile to see what it would score.',
};

// The info panel's read-out of one tile's score as a sum:
// "5: 1 base, +4 for 2 neighbours, +2 Booster". Keyed by the term vocabulary
// in src/core/rules.js; tests/rules.test.mjs checks every count and condition
// has a line here.
const signed = (v) => (v >= 0 ? `+${v}` : `${v}`);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export const SUM = {
  total: (score, bits, floored) => `${score}: ${bits.join(', ')}${floored ? ' (never below 0)' : ''}`,
  base: (v) => `${v} base`,
  aura: (v, name) => `${signed(v)} ${name}`,
  count: {
    adjacentPieces: (v, n) => `${signed(v)} for ${plural(n, 'neighbour', 'neighbours')}`,
    diagonalPieces: (v, n) => `${signed(v)} for ${n} diagonal`,
    adjacentEmpty: (v, n) => `${signed(v)} for ${n} empty next to it`,
    surroundingEmpty: (v, n) => `${signed(v)} for ${n} empty around it`,
    adjacentSame: (v, n) => `${signed(v)} for ${n} of its kind next to it`,
    adjacentKinds: (v, n) => `${signed(v)} for ${plural(n, 'kind', 'kinds')} next to it`,
    rowPieces: (v, n) => `${signed(v)} for ${n} in its row`,
    columnPieces: (v, n) => `${signed(v)} for ${n} in its column`,
    linePieces: (v, n) => `${signed(v)} for ${n} in its row and column`,
    lineEmpty: (v, n) => `${signed(v)} for ${n} empty in its row and column`,
    copies: (v, n) => `${signed(v)} for ${plural(n, 'other', 'others')} of its kind`,
    distinctTypes: (v, n) => `${signed(v)} for ${plural(n, 'kind', 'kinds')}`,
    largestKind: (v, n) => `${signed(v)} for ${n} of the commonest kind`,
    emptyTiles: (v, n) => `${signed(v)} for ${n} empty tiles`,
  },
  when: {
    onEdge: (v) => `${signed(v)} on the edge`,
    inCentre: (v) => `${signed(v)} off the edge`,
    inCorner: (v) => `${signed(v)} in a corner`,
    adjacentPiecesEquals: (v, t) => `${signed(v)} with ${plural(t.equals, 'neighbour', 'neighbours')}`,
    adjacentSameEquals: (v, t) => `${signed(v)} with ${t.equals} of its kind next to it`,
    copiesEquals: (v, t) => `${signed(v)} with ${t.equals} others of its kind`,
    rowFull: (v) => `${signed(v)} for a full row`,
    columnFull: (v) => `${signed(v)} for a full column`,
  },
};

// --- Overlays ---------------------------------------------------------------

export const LEVEL_END = {
  cleared: (n) => `LEVEL ${n} CLEARED`,
  won: 'RUN COMPLETE',
  lost: 'RUN OVER',
  result: (score, target) => `Board ${score} · target ${target}`,
  next: (n, target, turns) => `Level ${n} needs ${target} in ${turns} more turns. The board stays as it is.`,
  wonLine: (levels, score) => `All ${levels} levels cleared with a board worth ${score}.`,
  lostLine: (short, n, levels) => `${short} short on level ${n} of ${levels}.`,
  nextLevel: 'NEXT LEVEL',
  again: 'PLAY AGAIN',
  title: 'TITLE',
};

export const SET_LIST = {
  heading: 'THE SETS',
  close: 'CLOSE',
};
