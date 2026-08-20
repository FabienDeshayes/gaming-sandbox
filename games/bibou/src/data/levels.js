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

// --- Wall helpers (LEVEL_DESIGN.md §1.2) ------------------------------------
// A wall is a pair of cardinally adjacent tiles. `edge` wraps its coordinates,
// so the seam edges (index 4 next to index 0) are expressible the same way as
// any other — the board loops (§2.1).
const N = 5;
const wrapIndex = (v) => (v + N) % N;
const edge = (ax, ay, bx, by) => [
  { x: wrapIndex(ax), y: wrapIndex(ay) },
  { x: wrapIndex(bx), y: wrapIndex(by) },
];

// All four edges of one tile: a cell that can't be walked or shifted into or
// out of. Flip is the only action that ignores walls, so a sealed tile is a
// Flip-only cell — the lever most of the later levels are built on (§5.3).
const sealedTile = (x, y) => [
  edge(x, y, x - 1, y),
  edge(x, y, x + 1, y),
  edge(x, y, x, y - 1),
  edge(x, y, x, y + 1),
];

// Row `y` cut off from the rows above and below at every column: a one-tile
// corridor that wraps into a closed ring. `doors` leaves individual edges
// open, per column — `sealedRow(2, { down: [4] })` is Level 6's doored
// corridor. A ring has no wall along its own axis, which is why a crate in one
// can only ever be crushed *across* it (Level 5).
const sealedRow = (y, doors = {}) => {
  const walls = [];
  for (let x = 0; x < N; x++) {
    if (!(doors.up ?? []).includes(x)) walls.push(edge(x, y, x, y - 1));
    if (!(doors.down ?? []).includes(x)) walls.push(edge(x, y, x, y + 1));
  }
  return walls;
};

// The same, turned on its side: column `x` cut off from its neighbours at
// every row.
const sealedColumn = (x, doors = {}) => {
  const walls = [];
  for (let y = 0; y < N; y++) {
    if (!(doors.left ?? []).includes(y)) walls.push(edge(x, y, x - 1, y));
    if (!(doors.right ?? []).includes(y)) walls.push(edge(x, y, x + 1, y));
  }
  return walls;
};


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
  walls: [edge(0, 2, 0, 1), edge(0, 2, 0, 3), edge(0, 2, 1, 2)],
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
  walls: [edge(2, 2, 3, 2)],
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
  walls: sealedTile(2, 0),
  actionBudget: { flip: 1 },
};

// Level 5's board is a sealed one-tile corridor: row y=2 is walled off from
// rows 1 and 3 at every column, so the character can only ever walk left and
// right along it (and around, through the seam).
const CORRIDOR_WALLS = sealedRow(2);

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
// (4,2) is the door: no wall below it.
const DOORED_CORRIDOR_WALLS = sealedRow(2, { down: [4] });

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
const SEALED_COLUMN = sealedColumn(1);
const MIRROR_CAGE = sealedTile(3, 2);

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

// --- Levels 8-13: what Move alone can still do ------------------------------

// Level 8 is the shielding rule (LEVEL_DESIGN.md §5.4): when a push chain jams,
// the casualty is the entity *touching the wall*, not the one being pushed. Two
// crates queue at the (3,2)-(4,2) wall with the key in the near one, so the
// first push breaks the crate the player doesn't want and leaves the one they
// do — the key only comes out on the second crush, once its shield is gone.
export const LEVEL_8 = {
  id: 8,
  gridSize: 5,
  description: 'Two crates, one wall — the far one breaks first.',
  background: { goal: { x: 4, y: 2 } },
  entities: {
    character: { x: 1, y: 2 },
    crates: [
      { x: 2, y: 2, contains: { type: 'key', required: true } },
      { x: 3, y: 2 },
    ],
  },
  walls: [edge(3, 2, 4, 2)],
  actionBudget: {},
};

// Level 9 is about *where* a crate dies: the key lands on the tile the crate
// was standing on, not the one it was pushed toward (§5.4). The corridor is
// Level 6's, with the ring cut by a seam wall so it's a dead-end line instead:
// the character can only enter by the door at (4,3), which puts it to the right
// of the crate, so the crate can only ever be pushed left — into the dead end
// at (0,2), which is the goal. The key drops onto the exit.
export const LEVEL_9 = {
  id: 9,
  gridSize: 5,
  description: 'A crate drops its key on the tile it dies on.',
  background: { goal: { x: 0, y: 2 } },
  entities: {
    character: { x: 4, y: 4 },
    crates: [{ x: 2, y: 2, contains: { type: 'key', required: true } }],
  },
  walls: [...sealedRow(2, { down: [4] }), edge(4, 2, 0, 2)],
  actionBudget: {},
};

// Level 10: a crate is only crushable from the side that pushes it into the
// wall, and here that side is the far one. Column x=2 is a sealed ring cut by
// the (2,1)-(2,2) wall, so the crate at (2,2) has to be pushed *up* — and the
// only way to get above it is to walk the whole ring the other way, through the
// wraparound seam. Then the same walk back, because the goal is on the far
// side of that same wall.
export const LEVEL_10 = {
  id: 10,
  gridSize: 5,
  description: 'The only side you can push from is all the way round.',
  background: { goal: { x: 2, y: 1 } },
  entities: {
    character: { x: 2, y: 0 },
    crates: [{ x: 2, y: 2, contains: { type: 'key', required: true } }],
  },
  walls: [...sealedColumn(2), edge(2, 1, 2, 2)],
  actionBudget: {},
};

// Level 11 puts the wraparound (§2.1) inside a push chain. Pushing right from
// (2,2) walks the chain across the seam, so the crate that ends up jammed
// against the (0,2)-(1,2) wall is the one on the *other side of the board* —
// three tiles away, in the direction the player didn't push. It drops the key
// at (0,2), which the wall then keeps them from simply stepping onto: the way
// in is round through row 1.
export const LEVEL_11 = {
  id: 11,
  gridSize: 5,
  description: 'A push chain wraps — so does the crate that breaks.',
  background: { goal: { x: 1, y: 2 } },
  entities: {
    character: { x: 2, y: 2 },
    crates: [
      { x: 3, y: 2 },
      { x: 4, y: 2 },
      { x: 0, y: 2, contains: { type: 'key', required: true } },
    ],
  },
  walls: [edge(0, 2, 1, 2)],
  actionBudget: {},
};

// Level 12 is Level 6's packed corridor with the ring cut by a seam wall — and
// that one wall takes the full-loop push (§5.1.1 case 3) away. The row is full,
// so there's no open tile to resolve into, and it can't rotate either, so every
// step the character takes is a jam: the crate at the far end is crushed
// instead. Demolition is the only way to move, and the key is in the crate at
// the far end of the line.
export const LEVEL_12 = {
  id: 12,
  gridSize: 5,
  description: "A packed row with a wall in it can't rotate.",
  background: { goal: { x: 4, y: 2 } },
  entities: {
    character: { x: 2, y: 2 },
    crates: [
      { x: 0, y: 2, contains: { type: 'key', required: true } },
      { x: 1, y: 2 },
      { x: 3, y: 2 },
      { x: 4, y: 2 },
    ],
  },
  walls: [...sealedRow(2), edge(4, 2, 0, 2)],
  actionBudget: {},
};

// Level 13 is the corridor from the other side. Nothing inside row 2 can crush
// the crate — the ring has no wall along it — but the corridor has two doors,
// one below (2,2) and one above (3,2), and a door is a tile the character can
// stand *beside* the corridor at. Push the crate to (3,2), leave by the lower
// door, walk the long way round to (3,1), and push down: the crate is crushed
// against the corridor's own floor. Then the same door lets the character step
// straight down onto the key it dropped.
export const LEVEL_13 = {
  id: 13,
  gridSize: 5,
  description: 'Out one door and round the board, to push from the other.',
  background: { goal: { x: 4, y: 2 } },
  entities: {
    character: { x: 0, y: 2 },
    crates: [{ x: 1, y: 2, contains: { type: 'key', required: true } }],
  },
  walls: sealedRow(2, { down: [2], up: [3] }),
  actionBudget: {},
};

// --- Levels 14-15: more Shift ------------------------------------------------

// Level 14 is the other half of the full-loop push: a rotation moves *every*
// entity on the line by one, so the gaps between them never change and the
// character can never gain a tile on the key two along. Walking is therefore
// useless here no matter how long it goes on. One Shift across the corridor
// crushes a crate (§5.2), and the hole it leaves is what finally lets the line
// move relative to itself.
export const LEVEL_14 = {
  id: 14,
  gridSize: 5,
  description: 'A full row only rotates — you never gain on the key.',
  background: { goal: { x: 4, y: 2 } },
  entities: {
    character: { x: 0, y: 2 },
    crates: [{ x: 1, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 }],
    collectibles: [{ x: 2, y: 2, type: 'key', required: true }],
  },
  walls: sealedRow(2),
  actionBudget: { shift: 1 },
};

// Level 15 is Level 5's corridor turned on its side, with a crate the player
// can't identify: both look the same, and only one holds the key (a crate's
// contents are invisible until it breaks). So the level hands over two Shifts
// instead of one — enough to break both, in either order, and enough that
// guessing wrong isn't a retry.
export const LEVEL_15 = {
  id: 15,
  gridSize: 5,
  description: 'Two crates, no telling them apart. Two shifts, then.',
  background: { goal: { x: 2, y: 0 } },
  entities: {
    character: { x: 2, y: 4 },
    crates: [
      { x: 2, y: 1, contains: { type: 'key', required: true } },
      { x: 2, y: 3 },
    ],
  },
  walls: sealedColumn(2),
  actionBudget: { shift: 2 },
};

// --- Levels 16-25: what only Flip can do ------------------------------------

// Level 16 cuts the corridor into two rooms: row 2 is sealed above and below as
// usual, and two walls inside the ring split it into {0,1,2} and {3,4}. Walking
// can't cross either wall and neither can a Shift, so the key in the small room
// is out of reach — but a column flip mirrors it to (1,2), inside the
// character's room. The character stands on the middle column, the one tile a
// column flip leaves alone (§5.3), so it watches the board move without moving
// itself; the row flip, with everything on the middle row, does nothing at all.
export const LEVEL_16 = {
  id: 16,
  gridSize: 5,
  description: 'The middle column never moves. The far room does.',
  background: { goal: { x: 0, y: 2 } },
  entities: {
    character: { x: 2, y: 2 },
    collectibles: [{ x: 3, y: 2, type: 'key', required: true }],
  },
  walls: [...sealedRow(2), edge(2, 2, 3, 2), edge(4, 2, 0, 2)],
  actionBudget: { flip: 1 },
};

// Level 17 seals the *character* in instead of the key. (3,1) is walled on all
// four edges, so the only way out is the one action that ignores walls — and
// the axis is the whole puzzle, because row 3 is a sealed corridor. A row flip
// lands the character at (3,3), inside it, with no flip left to get out again:
// out of one prison and straight into another. The column flip, to (1,1), is
// the one that opens onto the rest of the board.
export const LEVEL_17 = {
  id: 17,
  gridSize: 5,
  description: 'Flip out of the cage — the other axis walls you in again.',
  background: { goal: { x: 4, y: 2 } },
  entities: {
    character: { x: 3, y: 1 },
    collectibles: [{ x: 0, y: 0, type: 'key', required: true }],
  },
  walls: [...sealedTile(3, 1), ...sealedRow(3)],
  actionBudget: { flip: 1 },
};

// Level 18 splits the board into two rooms down the columns — {0,1} and
// {2,3,4}, both seams walled — with the key in one and the goal in the other.
// One flip crosses, so it has to be spent holding the key: a flip taken early
// carries the key across too, and its mirror tile (3,3) is a sealed cage it
// never comes out of. The character's own landing matters for the same reason —
// flipping while standing on (1,3) puts *it* in that cage instead.
export const LEVEL_18 = {
  id: 18,
  gridSize: 5,
  description: 'Two rooms, one flip. Mind what you leave behind.',
  background: { goal: { x: 4, y: 2 } },
  entities: {
    character: { x: 0, y: 0 },
    collectibles: [{ x: 1, y: 3, type: 'key', required: true }],
  },
  walls: (() => {
    const split = [];
    for (let y = 0; y < N; y++) {
      split.push(edge(1, y, 2, y));
      split.push(edge(4, y, 0, y));
    }
    return [...split, ...sealedTile(3, 3)];
  })(),
  actionBudget: { flip: 1 },
};

// Level 19: a flip is a reflection of the whole entity layer, which means two
// entities on mirrored tiles simply swap. The character starts on (3,2), the
// exact tile the sealed key at (1,2) mirrors onto, so the obvious flip trades
// places with it — the key comes out and the character goes into the cage it
// came from, with no flip left. Stepping one tile off that mirror line first is
// the whole level.
export const LEVEL_19 = {
  id: 19,
  gridSize: 5,
  description: "You're standing where the key is about to land.",
  background: { goal: { x: 0, y: 0 } },
  entities: {
    character: { x: 3, y: 2 },
    collectibles: [{ x: 1, y: 2, type: 'key', required: true }],
  },
  walls: sealedTile(1, 2),
  actionBudget: { flip: 1 },
};

// Level 20 hides the key in a crate inside a sealed ring (row 0), where Move
// can't reach it and a Shift could only crush it out of sight. A row flip lifts
// the crate over the wall to (1,4) — and parks it against the far face of that
// same seam wall, which is exactly what the character needs to crush it. The
// column flip only slides it along its own prison.
export const LEVEL_20 = {
  id: 20,
  gridSize: 5,
  description: "Sealed away where you can't push it. Bring it out first.",
  background: { goal: { x: 3, y: 2 } },
  entities: {
    character: { x: 0, y: 2 },
    crates: [{ x: 1, y: 0, contains: { type: 'key', required: true } }],
  },
  walls: sealedRow(0),
  actionBudget: { flip: 1 },
};

// Level 21 shuts the character in with the crate: row 1 is a sealed corridor,
// cut by a seam wall so it's a dead-end line with a wall at each end. That wall
// is what cracks the crate open — push it to the end of the line — and the flip
// is then the only way out to the goal, which is outside. Flipping first isn't
// fatal — the crate is carried out along with the character, and the corridor's
// outer wall cracks it just as well from that side — but the column flip is: it
// mirrors the corridor onto itself, so nothing ever leaves it.
export const LEVEL_21 = {
  id: 21,
  gridSize: 5,
  description: 'Break it open in here, then flip yourself out.',
  background: { goal: { x: 2, y: 3 } },
  entities: {
    character: { x: 0, y: 1 },
    crates: [{ x: 2, y: 1, contains: { type: 'key', required: true } }],
  },
  walls: [...sealedRow(1), edge(4, 1, 0, 1)],
  actionBudget: { flip: 1 },
};

// Level 22 is Level 14's trap without the Shift to solve it: the corridor is
// packed, so walking only rotates it and the key stays exactly two tiles away
// forever. Here the answer is to stop working inside the corridor at all — one
// row flip tips its whole contents out into the open board, where there's room
// to walk round the crates instead of pushing them.
export const LEVEL_22 = {
  id: 22,
  gridSize: 5,
  description: 'Tip the whole corridor out into the open.',
  background: { goal: { x: 2, y: 0 } },
  entities: {
    character: { x: 0, y: 1 },
    crates: [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 4, y: 1 }],
    collectibles: [{ x: 3, y: 1, type: 'key', required: true }],
  },
  walls: sealedRow(1),
  actionBudget: { flip: 1 },
};

// Level 23 seals the *goal*. (3,3) is walled on all four edges, so the only way
// onto it is to land there — and only from (1,3), the tile it mirrors onto
// under a column flip, since row 1 is a sealed corridor the character can't
// stand in to use the other axis. That makes the flip both the last move of the
// level and unrepeatable, so the key has to be in hand before it's spent.
export const LEVEL_23 = {
  id: 23,
  gridSize: 5,
  description: 'The exit is sealed. Land on it.',
  background: { goal: { x: 3, y: 3 } },
  entities: {
    character: { x: 0, y: 0 },
    collectibles: [{ x: 4, y: 4, type: 'key', required: true }],
  },
  walls: [...sealedTile(3, 3), ...sealedRow(1)],
  actionBudget: { flip: 1 },
};

// Level 24 uses the fact that a flip is its own inverse — and that the
// character isn't. The key is sealed in (2,1); a row flip drops it into the
// sealed two-tile room at the bottom, and carries the character (standing on
// (3,1), the tile that mirrors into the room's other half) in with it. Collect
// it there, step back to (3,3), and flip again: the board comes back to exactly
// where it started, except the key is now in the character's hands. Flipping
// back from (2,3) instead lands in the empty cage, which is a dead end.
export const LEVEL_24 = {
  id: 24,
  gridSize: 5,
  description: 'Flip is its own inverse — but you come back holding the key.',
  background: { goal: { x: 0, y: 0 } },
  entities: {
    character: { x: 3, y: 1 },
    collectibles: [{ x: 2, y: 1, type: 'key', required: true }],
  },
  walls: [
    ...sealedTile(2, 1),
    // The sealed room {(2,3), (3,3)}: every edge but the one between them.
    edge(1, 3, 2, 3),
    edge(3, 3, 4, 3),
    edge(2, 2, 2, 3),
    edge(3, 2, 3, 3),
    edge(2, 3, 2, 4),
    edge(3, 3, 3, 4),
  ],
  actionBudget: { flip: 2 },
};

// Level 25 is the other thing two flips can do: mirroring across both lines in
// turn is a half turn of the board. The key at (1,0) has both of its single
// mirrors sealed — (1,4) under a row flip, (3,0) under a column flip — so
// neither flip alone frees it, and two flips on the same axis put it straight
// back where it started. Only one of each, in either order, lands it on (3,4).
// The character sits on (2,2), the tile both axes leave alone, and watches.
export const LEVEL_25 = {
  id: 25,
  gridSize: 5,
  description: 'Two flips, two axes: a half turn.',
  background: { goal: { x: 0, y: 2 } },
  entities: {
    character: { x: 2, y: 2 },
    collectibles: [{ x: 1, y: 0, type: 'key', required: true }],
  },
  walls: [
    ...sealedTile(1, 0),
    // (1,4), the key's row-flip mirror, sealed too — it shares the seam wall
    // above it with the cage at (1,0).
    edge(0, 4, 1, 4),
    edge(1, 4, 2, 4),
    edge(1, 3, 1, 4),
    // (3,0), its column-flip mirror.
    ...sealedTile(3, 0),
  ],
  actionBudget: { flip: 2 },
};

// --- Levels 26-27: both budgeted actions ------------------------------------

// Level 26 needs both actions on the same crate, and in one order. The crate is
// sealed in the ring at row 0, and a row flip would land it on (2,4) — a cage
// it never comes out of. Shifting row 0 first slides it one tile along its
// prison, so the flip lands it at (1,4) or (3,4) instead, in the open and up
// against the seam wall it can be crushed on. Spending the Shift on the crate's
// *column* instead cracks it open where it stands and leaves the key in the
// ring, which the flip then drops into the cage: same dead end, one step later.
export const LEVEL_26 = {
  id: 26,
  gridSize: 5,
  description: 'Slide it clear first — one landing tile is a cage.',
  background: { goal: { x: 4, y: 2 } },
  entities: {
    character: { x: 0, y: 2 },
    crates: [{ x: 2, y: 0, contains: { type: 'key', required: true } }],
  },
  walls: [
    ...sealedRow(0),
    // The cage at (2,4), directly under the crate's row-flip mirror. Its top
    // edge is already the corridor's own seam wall.
    edge(1, 4, 2, 4),
    edge(2, 4, 3, 4),
    edge(2, 3, 2, 4),
  ],
  actionBudget: { shift: 1, flip: 1 },
};

// Level 27 is the capstone: a flip moves the whole entity layer, so the trick
// is to be standing somewhere useful when it lands. The key is sealed in the
// cage at (1,1) and the goal is inside the sealed corridor at row 3 — a room
// with no door, so the character has to arrive by flip and can never leave.
// Row 1 mirrors onto row 3, so the character has to be *on row 1* when it
// flips, to come down inside the corridor alongside the cage's contents. The
// Shift is what opens the crate, against the cage's own walls before the flip
// or against the corridor's after it; either order works, but the flip taken
// from anywhere but row 1 ends the run.
export const LEVEL_27 = {
  id: 27,
  gridSize: 5,
  description: 'Stand where the cage is going to land.',
  background: { goal: { x: 4, y: 3 } },
  entities: {
    character: { x: 4, y: 0 },
    crates: [{ x: 1, y: 1, contains: { type: 'key', required: true } }],
  },
  walls: [...sealedTile(1, 1), ...sealedRow(3)],
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
  LEVEL_8,
  LEVEL_9,
  LEVEL_10,
  LEVEL_11,
  LEVEL_12,
  LEVEL_13,
  LEVEL_14,
  LEVEL_15,
  LEVEL_16,
  LEVEL_17,
  LEVEL_18,
  LEVEL_19,
  LEVEL_20,
  LEVEL_21,
  LEVEL_22,
  LEVEL_23,
  LEVEL_24,
  LEVEL_25,
  LEVEL_26,
  LEVEL_27,
];

LEVELS.forEach(validateLevelWalls);
