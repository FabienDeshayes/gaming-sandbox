// --- Levels (see LEVEL_DESIGN.md §6/§7) --------------------------------------
// Add new levels here and append them to LEVELS; the level picker and the
// puzzle scene read everything they need off these objects.

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

export const LEVELS = [LEVEL_1, LEVEL_2, LEVEL_3];
