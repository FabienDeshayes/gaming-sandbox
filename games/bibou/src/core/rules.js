// Pure grid rules for Bibou — no Phaser, no scene state. Every function takes
// and returns plain {x, y} positions, so this module is equally usable from the
// game and from a Node check (see TESTING.md).

// Direction deltas, per LEVEL_DESIGN.md §5.1.
export const DIRECTIONS = {
  Up: { x: 0, y: -1 },
  Down: { x: 0, y: 1 },
  Left: { x: -1, y: 0 },
  Right: { x: 1, y: 0 },
};

// The 8 tiles surrounding a rotation center, listed in CLOCKWISE order starting
// from the top-left. Rotate shifts each surrounding tile's contents one step
// along this ring (clockwise, or the reverse for anticlockwise). See
// LEVEL_DESIGN.md §5.3.
export const RING = [
  { x: -1, y: -1 }, // TL (0)
  { x: 0, y: -1 }, // T  (1)
  { x: 1, y: -1 }, // TR (2)
  { x: 1, y: 0 }, // R  (3)
  { x: 1, y: 1 }, // BR (4)
  { x: 0, y: 1 }, // B  (5)
  { x: -1, y: 1 }, // BL (6)
  { x: -1, y: 0 }, // L  (7)
];

// The board is borderless and loops on both axes (LEVEL_DESIGN.md §2.1).
export function wrap(value, size) {
  return ((value % size) + size) % size;
}

export function samePos(a, b) {
  return a.x === b.x && a.y === b.y;
}

// No blocking background tiles yet (walls are post-MVP). Kept as the seam that
// LEVEL_DESIGN.md §5.1 anticipates, so Move already routes through a legality
// check.
export function isBlocked(level, pos) {
  return false;
}

// Move: one cell in a cardinal direction, wrapping past the edges.
export function moveEntity(pos, direction, size) {
  const delta = DIRECTIONS[direction];
  return {
    x: wrap(pos.x + delta.x, size),
    y: wrap(pos.y + delta.y, size),
  };
}

// Rotate: step one place along the 8-tile ring around `center`. An entity that
// isn't on the ring (including one sitting on the center itself) is unaffected.
export function rotateEntity(pos, center, clockwise, size) {
  let idx = -1;
  for (let i = 0; i < RING.length; i++) {
    const rx = wrap(center.x + RING[i].x, size);
    const ry = wrap(center.y + RING[i].y, size);
    if (rx === pos.x && ry === pos.y) {
      idx = i;
      break;
    }
  }
  if (idx === -1) return { ...pos };

  const n = RING.length;
  const next = clockwise ? (idx + 1) % n : (idx - 1 + n) % n;
  return {
    x: wrap(center.x + RING[next].x, size),
    y: wrap(center.y + RING[next].y, size),
  };
}

// Shift: move one cell along row `index` (axis 'row') or column `index` (axis
// 'column'), with wraparound. An entity on any other line is unaffected.
export function shiftEntity(pos, axis, index, direction, size) {
  const delta = DIRECTIONS[direction];
  if (axis === 'row' && pos.y === index) {
    return { x: wrap(pos.x + delta.x, size), y: pos.y };
  }
  if (axis === 'column' && pos.x === index) {
    return { x: pos.x, y: wrap(pos.y + delta.y, size) };
  }
  return { ...pos };
}

// Move push-chain resolution (LEVEL_DESIGN.md §3/§5.1): no two entities may
// share a tile, so moving one into an occupied tile pushes whatever is there.
// Walk the line of tiles starting at `pos` in `direction`, following whichever
// entity occupies each tile in turn, until either an unoccupied tile is found
// (the chain can resolve there) or — because the board wraps — the walk comes
// back around to `pos` itself, meaning every tile on that line was occupied.
// That closed-loop case still resolves: the whole line rotates by one, the
// same as if it had been Shifted. Returns the ordered list of tiles the chain
// passes through, `[pos, ..., destination]`, or `null` if a blocking
// Background tile (post-MVP wall) stops the chain before it resolves.
export function resolveMoveChain(level, entities, pos, direction, size) {
  const path = [pos];
  let current = pos;
  for (let i = 0; i < size; i++) {
    current = moveEntity(current, direction, size);
    if (isBlocked(level, current)) return null;
    path.push(current);
    if (samePos(current, pos)) break; // full loop: line was entirely occupied
    if (!entities.some((e) => samePos(e.pos, current))) break; // open tile
  }
  return path;
}

// Apply a chain resolved by resolveMoveChain: every entity along `path` except
// the last tile shifts one step forward to the next tile in the chain. Every
// occupant is looked up against the *original* entities first, before any
// position is written, so the closed-loop case (where the last step lands back
// on the mover's own starting tile) never matches the entity that's about to
// be overwritten.
export function applyMoveChain(entities, path) {
  const occupants = path
    .slice(0, -1)
    .map((p) => entities.find((e) => samePos(e.pos, p)));
  occupants.forEach((entity, i) => {
    entity.pos = path[i + 1];
  });
}

// Flip: mirror the whole entity layer across the board's middle line. `axis` is
// the mirror line itself: 'row' mirrors across the middle row (y flips, the
// board turns top-to-bottom), 'column' mirrors across the middle column (x
// flips, the board turns left-to-right). Every entity moves, so this is the
// only action that touches the whole board at once. No wraparound is involved —
// mirroring never leaves the grid. See LEVEL_DESIGN.md §5.4.
export function flipEntity(pos, axis, size) {
  if (axis === 'row') return { x: pos.x, y: size - 1 - pos.y };
  if (axis === 'column') return { x: size - 1 - pos.x, y: pos.y };
  return { ...pos };
}
