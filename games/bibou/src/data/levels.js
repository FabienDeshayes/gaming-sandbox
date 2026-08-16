// --- Levels (see LEVEL_DESIGN.md §6/§7) --------------------------------------
// Add new levels here and append them to LEVELS; the level picker and the
// puzzle scene read everything they need off these objects.
//
// `description` is a short one-line summary shown under the level's button in
// LevelSelectScene — what the level teaches or the twist it adds, not a
// solution. Optional, but every level so far has one.
// `entities.crates` is optional — each entry is `{ x, y }`, plus an optional
// `contains: { type, required }` naming the collectible the crate drops when
// it's broken open (LEVEL_DESIGN.md §3).
// `entities.collectibles` is optional too — each entry is `{ x, y, type,
// required }`; `required: true` locks the goal until that collectible is
// picked up (LEVEL_DESIGN.md §3/§4).
// `actionBudget` is per action type: each key is an action the level offers and
// its own private pool of uses (LEVEL_DESIGN.md §6). Move is never listed —
// it's free and unlimited on every level — so `{}` means a pure movement
// puzzle with no cards at all.
// `walls` is optional — a level without it just has no walls (LEVEL_DESIGN.md
// §1.2). Each entry is a `[a, b]` pair of cardinally adjacent tile
// coordinates; every level's walls are validated below, at load time.

import { validateLevelWalls } from '../core/rules.js';

// Level 1 is the whole loop in miniature: swipe to walk, the key gates the
// goal. The goal sits 2 steps right of the start, so walking straight at it is
// the obvious first thing to try — and it does nothing, because the key is off
// that line at (2,0). Moves are free, so that mistake teaches the lock instead
// of punishing it.
export const LEVEL_1 = {
  id: 1,
  gridSize: 5,
  description: 'Swipe to move. The key unlocks the exit.',
  background: { goal: { x: 3, y: 2 } },
  entities: {
    character: { x: 1, y: 2 },
    collectibles: [{ x: 2, y: 0, type: 'key', required: true }],
  },
  actionBudget: {},
};

// Level 2 teaches the borderless board (LEVEL_DESIGN.md §2.1). The key at
// (0,2) is walled off from its up, down and right neighbours, so its only open
// edge is the wraparound seam to (4,2) — the character has to walk off the
// right-hand side of the board to get in, and back out the same way.
export const LEVEL_2 = {
  id: 2,
  gridSize: 5,
  description: 'The board has no edges — go the long way round.',
  background: { goal: { x: 3, y: 2 } },
  entities: {
    character: { x: 1, y: 2 },
    collectibles: [{ x: 0, y: 2, type: 'key', required: true }],
  },
  walls: [
    [
      { x: 0, y: 1 },
      { x: 0, y: 2 },
    ],
    [
      { x: 0, y: 2 },
      { x: 0, y: 3 },
    ],
    [
      { x: 0, y: 2 },
      { x: 1, y: 2 },
    ],
  ],
  actionBudget: {},
};

// Level 3 introduces crates, pushing, and the crate-holds-the-key rule
// (LEVEL_DESIGN.md §3/§5.4). The key is sealed inside the crate, and the only
// wall on the board is what cracks it open: push the crate right until it's
// crushed against the (2,2)-(3,2) wall, then walk onto the key it drops. Still
// no action cards — this is all Move.
export const LEVEL_3 = {
  id: 3,
  gridSize: 5,
  description: 'Crush the crate against a wall to crack it open.',
  background: { goal: { x: 3, y: 2 } },
  entities: {
    character: { x: 0, y: 2 },
    crates: [{ x: 1, y: 2, contains: { type: 'key', required: true } }],
  },
  walls: [
    [
      { x: 2, y: 2 },
      { x: 3, y: 2 },
    ],
  ],
  actionBudget: {},
};

// Level 4 introduces Flip, the only action that reaches through walls
// (LEVEL_DESIGN.md §5.3). The key at (2,0) is sealed on all four edges, so no
// amount of walking gets to it — but a flip teleports it out. The catch is
// which axis: (2,0) sits on the middle column, a flip fixed point, so the ↔
// arrow moves the key exactly nowhere and wastes the level's only Flip. Only
// the row flip, sending it to (2,4), frees it. The crate at (1,1) carries no
// rules — it's there so the player can see the flip move the *whole* entity
// layer, and see it move while the key doesn't.
export const LEVEL_4 = {
  id: 4,
  gridSize: 5,
  description: 'Only Flip reaches through walls — but which axis?',
  background: { goal: { x: 4, y: 2 } },
  entities: {
    character: { x: 0, y: 2 },
    crates: [{ x: 1, y: 1 }],
    collectibles: [{ x: 2, y: 0, type: 'key', required: true }],
  },
  walls: [
    [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ],
    [
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ],
    [
      { x: 2, y: 0 },
      { x: 2, y: 1 },
    ],
    [
      { x: 2, y: 0 },
      { x: 2, y: 4 },
    ],
  ],
  actionBudget: { flip: 1 },
};

// Level 5's board is a sealed one-tile corridor: row y=2 is walled off from
// rows 1 and 3 at every column, so the character can only ever walk left and
// right along it (and around, through the seam).
const CORRIDOR_WALLS = [];
for (let x = 0; x < 5; x++) {
  CORRIDOR_WALLS.push([
    { x, y: 1 },
    { x, y: 2 },
  ]);
  CORRIDOR_WALLS.push([
    { x, y: 2 },
    { x, y: 3 },
  ]);
}

// Level 5 introduces Shift, which pushes from a side the character can't stand
// on (LEVEL_DESIGN.md §5.2). The crate holding the key shares the corridor, so
// Move can only ever slide it left and right — never into a wall, because the
// only walls are above and below and the character can't get there to push
// that way. Shifting the crate's *column* pushes it straight into the corridor
// wall instead, which is what breaks it open.
export const LEVEL_5 = {
  id: 5,
  gridSize: 5,
  description: 'Shift pushes from a side you can never stand on.',
  background: { goal: { x: 4, y: 2 } },
  entities: {
    character: { x: 0, y: 2 },
    crates: [{ x: 2, y: 2, contains: { type: 'key', required: true } }],
  },
  walls: CORRIDOR_WALLS,
  actionBudget: { shift: 1 },
};

// Level 6 reuses Level 5's corridor with one change: a single door. Row y=2 is
// still sealed from the rows above and below at every column, except that
// (4,2) is left open downward onto (4,3) — the corridor's only way in or out.
const DOORED_CORRIDOR_WALLS = [];
for (let x = 0; x < 5; x++) {
  DOORED_CORRIDOR_WALLS.push([
    { x, y: 1 },
    { x, y: 2 },
  ]);
  // x = 4 is the door: no wall below (4,2).
  if (x !== 4) {
    DOORED_CORRIDOR_WALLS.push([
      { x, y: 2 },
      { x, y: 3 },
    ]);
  }
}

// Level 6 is built on the full-loop push (LEVEL_DESIGN.md §5.1.1 case 3). The
// character starts inside the doored corridor with four crates, filling all
// five of its tiles — so there is no empty tile for a push to resolve into, and
// every step the character takes rotates the entire row by one instead. That's
// the only way to move in here, so it's the only way to reach the door at
// (4,2), and later the only way to come back for the goal at (2,2), which is
// sealed above and below like the rest of the corridor.
export const LEVEL_6 = {
  id: 6,
  gridSize: 5,
  description: 'A completely full row still moves — it rotates.',
  background: { goal: { x: 2, y: 2 } },
  entities: {
    character: { x: 1, y: 2 },
    crates: [
      { x: 0, y: 2 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 4, y: 2 },
    ],
    collectibles: [{ x: 2, y: 4, type: 'key', required: true }],
  },
  walls: DOORED_CORRIDOR_WALLS,
  actionBudget: {},
};

// Level 7's board has two prisons. Column x=1 is sealed down both its sides,
// so the key inside can be slid up and down by a Shift but can never cross out
// of it; and (3,2) — the tile column 1's key mirrors onto under a column flip —
// is a sealed one-tile cage of its own.
const SEALED_COLUMN = [];
for (let y = 0; y < 5; y++) {
  SEALED_COLUMN.push([
    { x: 0, y },
    { x: 1, y },
  ]);
  SEALED_COLUMN.push([
    { x: 1, y },
    { x: 2, y },
  ]);
}
const MIRROR_CAGE = [
  [
    { x: 2, y: 2 },
    { x: 3, y: 2 },
  ],
  [
    { x: 3, y: 2 },
    { x: 4, y: 2 },
  ],
  [
    { x: 3, y: 1 },
    { x: 3, y: 2 },
  ],
  [
    { x: 3, y: 2 },
    { x: 3, y: 3 },
  ],
];

// Level 7 is the capstone: one Shift and one Flip, and only one order works.
// The key at (1,2) is sealed in column 1, so only a Flip can lift it out — but
// a column flip sends (1,2) straight to (3,2), which is a cage too, and the
// flip is gone. Shifting column 1 first slides the key one tile off row 2
// (either direction), and *then* the column flip lands it on an open tile.
// Doing it the other way round strands the key in the cage for good.
export const LEVEL_7 = {
  id: 7,
  gridSize: 5,
  description: 'One Shift, one Flip — and only one order works.',
  background: { goal: { x: 0, y: 2 } },
  entities: {
    character: { x: 2, y: 4 },
    collectibles: [{ x: 1, y: 2, type: 'key', required: true }],
  },
  walls: [...SEALED_COLUMN, ...MIRROR_CAGE],
  actionBudget: { shift: 1, flip: 1 },
};

export const LEVELS = [
  LEVEL_1,
  LEVEL_2,
  LEVEL_3,
  LEVEL_4,
  LEVEL_5,
  LEVEL_6,
  LEVEL_7,
];

LEVELS.forEach(validateLevelWalls);
