// Light shapes: given a light, a tile, and a facing, which tiles are visible.
//
// Rock does not occlude in the MVP — a shape is applied literally, so you can
// light the far side of a wall (DESIGN.md §4.1). Line-of-sight is a nice-to-have
// and would slot in here without touching anything else.

export const DIRECTIONS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

// Blackout: no light left, so you see the tile you're standing on and nothing else.
export const BLACKOUT_SHAPE = { kind: 'self' };

// The same light, with the dark at the edge of the world eating into it
// (`chokeAt` in core/world.js says by how much). A shape rather than the light
// itself, so nothing is spent by walking out here and nothing is recovered by
// walking back: a beacon choked to one tile is still a beacon.
export function chokeShape(shape, allowance) {
  if (!shape) return shape;
  if (shape.kind === 'radius' && shape.radius > allowance) return { ...shape, radius: allowance };
  if (shape.kind === 'cone' && shape.depth > allowance) return { ...shape, depth: allowance };
  return shape;
}

export function tileKey(x, y) {
  return `${x},${y}`;
}

// Returns the list of {x, y} a light illuminates from (x, y) while facing `facing`.
export function visibleTiles(shape, x, y, facing = 'up') {
  const s = shape || BLACKOUT_SHAPE;
  if (s.kind === 'radius') return radiusTiles(x, y, s.radius);
  if (s.kind === 'cone') return coneTiles(x, y, facing, s.depth);
  return [{ x, y }];
}

// A Chebyshev radius: the (2r+1) square block centred on the tile, which is what
// "shows one tile around you" means on a grid you move through diagonally-adjacent.
function radiusTiles(x, y, radius) {
  const out = [];
  for (let dy = -radius; dy <= radius; dy++)
    for (let dx = -radius; dx <= radius; dx++) out.push({ x: x + dx, y: y + dy });
  return out;
}

// A cone widening with distance: 1 tile ahead is 3 wide, 2 ahead is 5 wide,
// 3 ahead is 7 wide, 4 ahead is 9 wide. Nothing behind or beside, plus your
// own tile — turning re-aims it, which is why the lamp rewards committing to
// a direction.
function coneTiles(x, y, facing, depth) {
  const dir = DIRECTIONS[facing] || DIRECTIONS.up;
  // The axis across the cone is the facing rotated a quarter turn.
  const px = -dir.dy;
  const py = dir.dx;
  const out = [{ x, y }];
  for (let d = 1; d <= depth; d++) {
    const halfWidth = d;
    for (let w = -halfWidth; w <= halfWidth; w++)
      out.push({ x: x + dir.dx * d + px * w, y: y + dir.dy * d + py * w });
  }
  return out;
}
