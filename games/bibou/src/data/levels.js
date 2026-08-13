// --- Levels (see LEVEL_DESIGN.md §6/§7) --------------------------------------
// Add new levels here and append them to LEVELS; the level picker and the
// puzzle scene read everything they need off these objects.
//
// `entities.crates` is optional — a level without it just has no crates.
// `actionBudget` is per action type: each key is an action the level offers and
// its own private pool of uses (LEVEL_DESIGN.md §6).
// `walls` is optional — a level without it just has no walls (LEVEL_DESIGN.md
// §1.2). Each entry is a `[a, b]` pair of cardinally adjacent tile
// coordinates; every level's walls are validated below, at load time.

import { validateLevelWalls } from '../core/rules.js';

export const LEVEL_1 = {
  id: 1,
  gridSize: 5,
  background: { goal: { x: 3, y: 2 } },
  entities: { character: { x: 1, y: 2 } },
  actionBudget: { move: 2 },
};

// Level 2 introduces Rotate (see LEVEL_DESIGN.md §5.3/§7). Solvable with two
// rotations: char (1,2) → (2,2) via CW rotate around (2,3), then (2,2) → (2,3)
// via CW rotate around (1,3).
export const LEVEL_2 = {
  id: 2,
  gridSize: 5,
  background: { goal: { x: 2, y: 3 } },
  entities: { character: { x: 1, y: 2 } },
  actionBudget: { rotate: 2 },
};

// Level 3 introduces Shift (see LEVEL_DESIGN.md §5.3/§7). Solvable with two
// shifts: char (2,3) → (3,3) via row-3 Right, then (3,3) → (3,2) via
// column-3 Up.
export const LEVEL_3 = {
  id: 3,
  gridSize: 5,
  background: { goal: { x: 3, y: 2 } },
  entities: { character: { x: 2, y: 3 } },
  actionBudget: { shift: 2 },
};

// Level 4 introduces Flip and crates (see LEVEL_DESIGN.md §5.4/§7). Solvable
// with one flip per axis, in either order: char (1,1) → (3,1) via a column
// flip, then (3,1) → (3,3) via a row flip. The crates flip along with the
// character — they carry no rules yet, they just show that Flip moves the whole
// entity layer.
export const LEVEL_4 = {
  id: 4,
  gridSize: 5,
  background: { goal: { x: 3, y: 3 } },
  entities: {
    character: { x: 1, y: 1 },
    crates: [
      { x: 0, y: 0 },
      { x: 4, y: 2 },
    ],
  },
  actionBudget: { flip: 2 },
};

// Level 5 is the first level offering two action types, each with its own
// budget: exactly one Move and exactly one Flip, so neither can substitute for
// the other. Solvable in either order: char (1,2) → (3,2) via a column flip
// then Down to (3,3), or Down to (1,3) first then the column flip to (3,3).
export const LEVEL_5 = {
  id: 5,
  gridSize: 5,
  background: { goal: { x: 3, y: 3 } },
  entities: {
    character: { x: 1, y: 2 },
    crates: [{ x: 1, y: 0 }],
  },
  actionBudget: { move: 1, flip: 1 },
};

// Level 6 tests crate pushing (see LEVEL_DESIGN.md §3/§5.1/§7). Row y=2 is
// completely full — character at (1,2), crates at (0,2), (2,2), (3,2), (4,2) —
// so a single Move Right pushes the whole chain around the wraparound board
// and back into the character's own vacated tile: a full-loop push, which
// resolves as the entire row rotating one step. That lands the character
// exactly on the goal at (2,2).
export const LEVEL_6 = {
  id: 6,
  gridSize: 5,
  background: { goal: { x: 2, y: 2 } },
  entities: {
    character: { x: 1, y: 2 },
    crates: [
      { x: 0, y: 2 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 4, y: 2 },
    ],
  },
  actionBudget: { move: 1 },
};

// Level 7 introduces walls (see LEVEL_DESIGN.md §1.2/§7). A wall sits directly
// between the character and the adjacent goal tile, so the 1-move direct
// approach is illegal — the shortest legal path is a 3-move detour one row up
// and back down (going the other way around the board via wraparound would
// take 4 moves, per §2.1, so it isn't the shortcut here).
export const LEVEL_7 = {
  id: 7,
  gridSize: 5,
  background: { goal: { x: 2, y: 2 } },
  entities: { character: { x: 1, y: 2 } },
  walls: [
    [
      { x: 1, y: 2 },
      { x: 2, y: 2 },
    ],
  ],
  actionBudget: { move: 3 },
};

// Level 8 exercises a wraparound wall (LEVEL_DESIGN.md §2.1/§1.2): the wall
// sits on the seam between x=0 and x=4 on row y=2, so the short way around the
// loop is blocked and the level needs the long way across the row instead.
export const LEVEL_8 = {
  id: 8,
  gridSize: 5,
  background: { goal: { x: 4, y: 2 } },
  entities: { character: { x: 1, y: 2 } },
  walls: [
    [
      { x: 0, y: 2 },
      { x: 4, y: 2 },
    ],
  ],
  actionBudget: { move: 3 },
};

export const LEVELS = [
  LEVEL_1,
  LEVEL_2,
  LEVEL_3,
  LEVEL_4,
  LEVEL_5,
  LEVEL_6,
  LEVEL_7,
  LEVEL_8,
];

LEVELS.forEach(validateLevelWalls);
