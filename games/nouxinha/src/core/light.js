// Light shapes: given a light, a tile, and a facing, which tiles are visible.
//
// A shape says how far a light *reaches*; what stands in the way says how much
// of that it actually shows (DESIGN.md §4.1). Callers that care about terrain
// hand in an `isOpaque` predicate and get the shape with its shadows cut out of
// it; callers that only want the shape itself leave it out. That is what keeps
// this file pure: it knows what a shadow is, and nothing at all about rock.

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

// Returns the list of {x, y} a light illuminates from (x, y) while facing
// `facing`. With no `isOpaque` the shape is applied literally; with one, every
// tile it can't see round is dropped (`castLight` below).
export function visibleTiles(shape, x, y, facing = 'up', isOpaque = null) {
  const s = shape || BLACKOUT_SHAPE;
  let tiles;
  if (s.kind === 'radius') tiles = radiusTiles(x, y, s.radius);
  else if (s.kind === 'cone') tiles = coneTiles(x, y, facing, s.depth);
  else tiles = [{ x, y }];
  return isOpaque ? castLight(tiles, x, y, isOpaque) : tiles;
}

// A Chebyshev radius: the (2r+1) square block centred on the tile, which is what
// "shows one tile around you" means on a grid you move through diagonally-adjacent.
function radiusTiles(x, y, radius) {
  const out = [];
  for (let dy = -radius; dy <= radius; dy++)
    for (let dx = -radius; dx <= radius; dx++) out.push({ x: x + dx, y: y + dy });
  return out;
}

// --- Shadows -----------------------------------------------------------------
//
// Cuts the shadows out of a shape: a tile is shown when some straight line from
// the character's tile reaches it without crossing anything opaque.
//
// **The opaque tile itself is always shown.** A wall that hid itself would be a
// wall the player only finds by walking into it, which is the one failure mode
// this game's whole visibility design is arranged to avoid — you see the rock,
// you just don't see past it.
//
// Two lines are tried per tile rather than one, because a line between tile
// centres passes exactly through a lattice corner whenever the run and the rise
// divide evenly, and which side it comes down on is arbitrary. Trying both ways
// of breaking that tie is what keeps a lone boulder from throwing a wedge of
// shadow it has no business throwing — the bias here is deliberately permissive,
// since a light this small (radius 3 at the very most) has little enough to show
// without being stingy about corners.
function castLight(tiles, x, y, isOpaque) {
  // Ray after ray asks about the same handful of tiles, so opacity is cached for
  // the length of one cast — and since a line to a tile in the shape stays
  // inside the shape, that cache holds a shape's worth of entries at most, never
  // a world's. It is a speed-up over one call and nothing more: nothing about a
  // shadow is ever state.
  const memo = new Map();
  const opaque = (tx, ty) => {
    const key = tileKey(tx, ty);
    let hit = memo.get(key);
    if (hit === undefined) memo.set(key, (hit = !!isOpaque(tx, ty)));
    return hit;
  };
  return tiles.filter(
    (t) =>
      (t.x === x && t.y === y) ||
      opaque(t.x, t.y) ||
      reaches(x, y, t.x, t.y, opaque, false) ||
      reaches(x, y, t.x, t.y, opaque, true)
  );
}

// Whether a Bresenham line from (x0, y0) to (x1, y1) crosses nothing opaque.
// Only the tiles strictly between the two count: neither end blocks itself.
//
// Integer throughout, and `tieHigh` picks which way the line turns where the
// error term lands exactly on the midpoint — the one place a straight line
// between two tile centres has a genuine choice.
function reaches(x0, y0, x1, y1, opaque, tieHigh) {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x1 > x0 ? 1 : -1;
  const sy = y1 > y0 ? 1 : -1;
  // Whichever axis is longer is the one stepped every iteration; the error is
  // carried in doubled units so the midpoint is an exact integer rather than a
  // half, which is what makes the tie something that can be broken at all.
  const long = Math.max(dx, dy);
  const short = Math.min(dx, dy);
  const steep = dy > dx;
  let x = x0;
  let y = y0;
  let err = long;
  for (let i = 0; i < long; i++) {
    err -= 2 * short;
    const turn = err < 0 || (err === 0 && tieHigh);
    if (turn) err += 2 * long;
    if (steep) {
      if (turn) x += sx;
      y += sy;
    } else {
      if (turn) y += sy;
      x += sx;
    }
    if (x === x1 && y === y1) return true;
    if (opaque(x, y)) return false;
  }
  return x === x1 && y === y1;
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
