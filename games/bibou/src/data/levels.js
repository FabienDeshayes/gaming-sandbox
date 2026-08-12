// --- Levels (see LEVEL_DESIGN.md §6/§7) --------------------------------------
// Add new levels here and append them to LEVELS; the level picker and the
// puzzle scene read everything they need off these objects.
//
// `entities.crates` is optional — a level without it just has no crates.
// `actionBudget` is per action type: each key is an action the level offers and
// its own private pool of uses (LEVEL_DESIGN.md §6).

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

export const LEVELS = [LEVEL_1, LEVEL_2, LEVEL_3, LEVEL_4, LEVEL_5];
