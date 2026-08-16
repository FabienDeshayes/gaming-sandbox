// --- Levels (see LEVEL_DESIGN.md §6/§7) --------------------------------------
// Add new levels here and append them to LEVELS; the level picker and the
// puzzle scene read everything they need off these objects.
//
// `description` is a short one-line summary shown under the level's button in
// LevelSelectScene — what the level teaches or the twist it adds, not a
// solution. Optional, but every level so far has one.
// `entities.crates` is optional — a level without it just has no crates.
// `entities.collectibles` is optional too — each entry is `{ x, y, type,
// required }`; `required: true` locks the goal until that collectible is
// picked up (LEVEL_DESIGN.md §3/§4).
// `actionBudget` is per action type: each key is an action the level offers and
// its own private pool of uses (LEVEL_DESIGN.md §6).
// `walls` is optional — a level without it just has no walls (LEVEL_DESIGN.md
// §1.2). Each entry is a `[a, b]` pair of cardinally adjacent tile
// coordinates; every level's walls are validated below, at load time.

import { validateLevelWalls } from '../core/rules.js';

export const LEVEL_1 = {
  id: 1,
  gridSize: 5,
  description: 'Learn Move: walk straight to the goal.',
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
  description: 'Learn Rotate: turn a center to step around it.',
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
  description: 'Learn Shift: slide a whole row or column.',
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
  description: 'Learn Flip: mirror the whole board across an axis.',
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
  description: 'Combine Move and Flip — each usable only once.',
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
  description: 'Push a fully packed row all the way around the board.',
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
  description: 'A wall blocks the direct path — find the detour.',
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
  description: 'A wall on the wraparound seam blocks the shortcut.',
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

// Level 9 introduces collectibles (see LEVEL_DESIGN.md §3/§7): a `required`
// key the character must pick up before the goal will accept them. The goal
// sits 2 moves directly right of the start — the same shape as Level 1 — but
// the key sits off that direct line, so reaching the goal first does nothing
// (the marker shows 🔒 and the HUD explains why): the budget only has enough
// slack for the key-first route, not for a direct attempt plus a recovery.
export const LEVEL_9 = {
  id: 9,
  gridSize: 5,
  description: 'Grab the required key before the goal will open.',
  background: { goal: { x: 3, y: 2 } },
  entities: {
    character: { x: 1, y: 2 },
    collectibles: [{ x: 1, y: 0, type: 'key', required: true }],
  },
  actionBudget: { move: 6 },
};

// Level 10 introduces destructible crates (LEVEL_DESIGN.md §5.5): the key
// sits stuck against a wall, and a crate sits directly between the character
// and it on the same row. Pushing the crate straight at the key crushes it
// (the key can't move to make room, and it can't be destroyed) — the only
// way through, since going around costs one move more than the budget allows.
export const LEVEL_10 = {
  id: 10,
  gridSize: 5,
  description: 'Crush a crate against a stuck key to clear the way.',
  background: { goal: { x: 3, y: 2 } },
  entities: {
    character: { x: 0, y: 2 },
    crates: [{ x: 1, y: 2 }],
    collectibles: [{ x: 2, y: 2, type: 'key', required: true }],
  },
  walls: [
    [
      { x: 2, y: 2 },
      { x: 3, y: 2 },
    ],
  ],
  actionBudget: { move: 6 },
};

// Level 11 exercises the same crate-destruction mechanic through Shift instead
// of Move (LEVEL_DESIGN.md §5.5): shifting the row crushes the crate exactly
// as pushing it would (the character and the wall-stuck key both just stay
// put — nothing behind a destroyed crate advances), then Move handles the
// rest. Same layout as Level 10, but the crate is destroyed with the level's
// one Shift instead of a Move.
export const LEVEL_11 = {
  id: 11,
  gridSize: 5,
  description: 'Same puzzle as Level 10 — crush the crate with Shift instead.',
  background: { goal: { x: 3, y: 2 } },
  entities: {
    character: { x: 0, y: 2 },
    crates: [{ x: 1, y: 2 }],
    collectibles: [{ x: 2, y: 2, type: 'key', required: true }],
  },
  walls: [
    [
      { x: 2, y: 2 },
      { x: 3, y: 2 },
    ],
  ],
  actionBudget: { shift: 1, move: 5 },
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
  LEVEL_9,
  LEVEL_10,
  LEVEL_11,
];

LEVELS.forEach(validateLevelWalls);
