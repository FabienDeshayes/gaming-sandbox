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
