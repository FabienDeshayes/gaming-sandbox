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

// --- Walls (LEVEL_DESIGN.md §1.2) -------------------------------------------
// A wall is a pair of tile coordinates naming the edge between two cardinally
// adjacent tiles — including the wraparound case, where the tiles sit at the
// two opposite extremes of a row/column and touch through the loop (§2.1). A
// wall blocks entity movement between exactly that pair of tiles, both
// directions; it says nothing about any other pair, however close.

// True if `u` and `v` (two values on the same axis) are one cardinal step
// apart, wraparound included. Wraparound only connects the two extreme
// indices (0 and size - 1) — any other pair the same distance apart is just
// far away, not touching.
function isAdjacentOnAxis(u, v, size) {
  const d = Math.abs(u - v);
  if (d === 1) return true;
  return (
    d === size - 1 && ((u === 0 && v === size - 1) || (u === size - 1 && v === 0))
  );
}

// True if `a` and `b` are a legal wall endpoint pair for a board of `size`:
// aligned on exactly one axis, one cardinal step apart on it (wraparound
// counts). Rejects diagonals, the same tile twice, and tiles that are merely
// far apart.
export function isValidWallPair(a, b, size) {
  if (samePos(a, b)) return false;
  if (a.x !== b.x && a.y !== b.y) return false; // not aligned on either axis
  if (a.x !== b.x) return isAdjacentOnAxis(a.x, b.x, size);
  return isAdjacentOnAxis(a.y, b.y, size);
}

// Throws if any entry in `level.walls` isn't a legal wall pair (§1.2) — called
// when levels are loaded (see src/data/levels.js) so a bad level definition
// fails fast instead of silently drawing or blocking the wrong thing.
export function validateLevelWalls(level) {
  (level.walls ?? []).forEach(([a, b]) => {
    if (!isValidWallPair(a, b, level.gridSize)) {
      throw new Error(
        `Level ${level.id}: invalid wall between (${a.x},${a.y}) and (${b.x},${b.y}) — ` +
          'walls must connect two cardinally adjacent tiles (including the wraparound edge).'
      );
    }
  });
}

// Order-independent key for a pair of positions, so a wall (or a step through
// one) can be looked up regardless of which side it's queried from.
function wallKey(a, b) {
  const ka = `${a.x},${a.y}`;
  const kb = `${b.x},${b.y}`;
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
}

// Builds a lookup from a level's `walls` list for fast "is there a wall
// between these two tiles" checks. Levels are assumed already validated
// (validateLevelWalls) by the time this runs.
export function buildWallSet(walls) {
  return new Set((walls ?? []).map(([a, b]) => wallKey(a, b)));
}

// True if a wall separates `a` and `b`. Only meaningful for cardinally
// adjacent tiles (including the wraparound case) — a wall never applies to
// any other pair.
export function isWallBetween(wallSet, a, b) {
  return wallSet.has(wallKey(a, b));
}

// --- Destructible / collectible entities (LEVEL_DESIGN.md §3/§5.5) ---------
// A crate is destructible: if it's crushed against something that can never
// move out of its way (a wall, or an entity that itself can't move), it's
// destroyed instead of the whole action being rejected. A collectible is the
// opposite — indestructible, so when it can't move it just becomes an
// obstruction — except for the character, which never treats a collectible
// as an obstacle at all: it always picks one up rather than being blocked by
// or pushing it.
export function isDestructible(entity) {
  return entity.kind === 'crate';
}

export function isCollectible(entity) {
  return entity.kind === 'collectible';
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
// entity occupies each tile in turn, until one of:
//   - an unoccupied tile is found ({ kind: 'open', path }) — the common case;
//   - the walk wraps all the way back to `pos` ({ kind: 'loop', path }) —
//     every tile on the line was occupied, so the whole line rotates by one,
//     same as a Shift;
//   - the character's own very next step lands directly on a collectible
//     ({ kind: 'pickup', path, collectible }) — the character never pushes a
//     collectible, it always collects it instead, so the chain stops there
//     regardless of what (if anything) sits beyond it;
//   - a wall stops the next step before the chain resolves — see
//     resolveBlockedMoveChain (§5.5) for how a destructible entity crushed
//     against the wall (or against something else that can't move) gets
//     destroyed instead of the whole move being rejected
//     ({ kind: 'destroy', victim }), or, if nothing in the chain can be
//     sacrificed, the whole move is illegal ({ kind: 'illegal' }).
export function resolveMoveChain(wallSet, entities, pos, direction, size) {
  const path = [pos];
  let current = pos;
  for (let i = 0; i < size; i++) {
    const next = moveEntity(current, direction, size);
    if (isWallBetween(wallSet, current, next)) {
      return resolveBlockedMoveChain(entities, path, direction, size);
    }
    current = next;
    path.push(current);
    if (samePos(current, pos)) return { kind: 'loop', path }; // full loop
    const occupant = entities.find((e) => samePos(e.pos, current));
    if (!occupant) return { kind: 'open', path }; // open tile
    if (path.length === 2 && isCollectible(occupant)) {
      // The character's own immediate destination is a collectible: pick it
      // up rather than pushing it, whatever sits beyond it on the line.
      return { kind: 'pickup', path, collectible: occupant };
    }
  }
  return { kind: 'open', path };
}

// A wall stopped the chain from extending past `path`'s last tile. `path[0]`
// is the mover (the character); `path[1..]` are the entities queued to be
// pushed, in push order — closest to the mover first, closest to the wall
// last. Peel from the tile touching the wall backward: the first destructible
// entity found (a crate) is destroyed and the peel stops there — nothing else
// in the chain moves or is destroyed (§5.5's single-casualty rule). Every
// entity in the chain moves in the same `direction`, so the victim's own
// attempted (never reached) destination is just one step past its own tile —
// `dest` is reported so the UI can show it trying to push through before it's
// destroyed. If every entity between the mover and the wall is indestructible
// (a collectible — the character itself is never in this list, see
// resolveMoveChain's own pickup case above), there's nothing to sacrifice and
// the whole move is illegal, exactly as an unconditionally-blocked move
// always was.
function resolveBlockedMoveChain(entities, path, direction, size) {
  const occupants = path.slice(1).map((p) => entities.find((e) => samePos(e.pos, p)));
  for (let i = occupants.length - 1; i >= 0; i--) {
    if (isDestructible(occupants[i])) {
      return {
        kind: 'destroy',
        victim: occupants[i],
        dest: moveEntity(occupants[i].pos, direction, size),
      };
    }
  }
  return { kind: 'illegal' };
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

// --- Shift / Rotate resolution (LEVEL_DESIGN.md §5.2/§5.3/§5.5) ------------
// Shift and Rotate both move every entity on a fixed cycle of tiles (a
// row/column, wrapping at the board edge; the 8-tile ring around a rotation
// center) one step around that cycle. With no wall on the cycle this is a
// simple permutation — nothing can ever collide, since every occupant moves
// together — so `resolveCycleOutcome` short-circuits to that in the common
// case. A wall breaks the cycle into one or more open arcs; the arc(s) that
// end at the wall need the same destructible/collectible peeling Move uses,
// scoped to just the entities running into that specific wall.

// Builds the 8 ring positions around `center`, in the *travel* direction: the
// occupant of `order[i]` moves to `order[i + 1]` (wrapping). Reversing the
// normal clockwise `RING` order encodes anticlockwise travel (LEVEL_DESIGN.md
// §5.2's `(idx - 1 + n) % n` step, just expressed as a walk direction instead
// of an index delta).
export function rotationOrder(center, clockwise, size) {
  const ring = RING.map((o) => ({
    x: wrap(center.x + o.x, size),
    y: wrap(center.y + o.y, size),
  }));
  return clockwise ? ring : ring.slice().reverse();
}

// Builds the `size` row/column positions, in the travel direction: the
// occupant of `order[i]` moves to `order[i + 1]` (wrapping). Right/Down walk
// index ascending; Left/Up walk it descending, matching shiftEntity's delta.
export function shiftOrder(axis, index, direction, size) {
  const positions = [];
  for (let k = 0; k < size; k++) {
    positions.push(axis === 'row' ? { x: k, y: index } : { x: index, y: k });
  }
  const forward = direction === 'Right' || direction === 'Down';
  return forward ? positions : positions.slice().reverse();
}

// Resolves one full trip around `order` (an 8-tile ring for Rotate, or a
// `size`-tile row/column for Shift) into a list of outcomes, one per occupied
// tile: `{ entity, outcome: 'move', dest }` (moves to the next tile in
// `order`), `{ entity, outcome: 'stay' }` (blocked, doesn't move, not
// destroyed), `{ entity, outcome: 'destroy', dest }` (a crate crushed against
// something that can't move — removed from the board; `dest` is the tile it
// was trying, and failing, to reach, for the UI's "it tried to push through
// first" animation), or `{ entity, outcome: 'pickup', collectible }` (a
// character and a collectible end up adjacent in a jammed run — always a
// pickup regardless of which one of the two was queued closer to the wall:
// either the character's forced step lands on a stuck collectible ahead of
// it, in which case the character moves onto the collectible's tile, or a
// collectible is pushed into a character that's stuck at the wall ahead of
// *it*, in which case the character stays put and the collectible is the one
// that's reported as having moved, via `characterStays: true`). An empty/
// all-open cycle returns `[]` — still a legal, budget-costing no-op
// (LEVEL_DESIGN.md §5.2/§5.3).
export function resolveCycleOutcome(wallSet, entities, order) {
  const n = order.length;
  const occupantAt = (pos) => entities.find((e) => samePos(e.pos, pos));
  const blockedAfter = order.map((p, i) => isWallBetween(wallSet, p, order[(i + 1) % n]));

  if (!blockedAfter.some(Boolean)) {
    // No wall anywhere on this cycle: a pure permutation, always collision-free.
    return order
      .map((p, i) => ({ entity: occupantAt(p), dest: order[(i + 1) % n] }))
      .filter(({ entity }) => entity)
      .map(({ entity, dest }) => ({ entity, outcome: 'move', dest }));
  }

  const outcomes = [];
  const resolved = new Array(n).fill(false);

  for (let i = 0; i < n; i++) {
    if (!blockedAfter[i] || resolved[i]) continue;

    // Collect the contiguous occupied run ending at order[i] (touching the
    // wall), front (closest to the wall) to back — each entry keeps its own
    // index into `order` so a destroyed entity's attempted destination
    // (order[idx + 1]) can still be reported even though it never moves there.
    const run = [];
    let j = i;
    for (;;) {
      const e = occupantAt(order[j]);
      if (!e) break;
      run.push({ entity: e, idx: j });
      resolved[j] = true;
      const prevIdx = (j - 1 + n) % n;
      if (blockedAfter[prevIdx]) break; // that step is its own separate run boundary
      j = prevIdx;
      if (j === i) break; // safety net against a pathological full-cycle wrap
    }

    // Peel front-to-back. The frontmost tile is directly blocked by the wall;
    // every tile behind it is blocked only because the one ahead of it didn't
    // move. At most one entity in the whole run is destroyed or picked up —
    // everything else just stays (LEVEL_DESIGN.md §5.5's single-casualty rule).
    let settled = false;
    run.forEach(({ entity, idx }, k) => {
      const dest = order[(idx + 1) % n];
      if (settled) {
        outcomes.push({ entity, outcome: 'stay' });
        return;
      }
      const ahead = k === 0 ? null : run[k - 1].entity;
      if (k === 0) {
        if (isDestructible(entity)) {
          outcomes.push({ entity, outcome: 'destroy', dest });
          settled = true;
        } else {
          outcomes.push({ entity, outcome: 'stay' });
        }
      } else if (entity.kind === 'character' && isCollectible(ahead)) {
        outcomes.push({ entity, outcome: 'pickup', collectible: ahead });
        settled = true;
      } else if (isCollectible(entity) && ahead.kind === 'character') {
        // Reversed pairing: the collectible is the one queued behind, being
        // pushed into a character that's already stuck at the wall ahead of
        // it. Still a pickup — the character never treats a collectible as
        // an obstacle — but here it's the collectible that's reported as the
        // mover (onto the character's tile) since the character itself isn't
        // going anywhere.
        outcomes.push({ entity: ahead, outcome: 'pickup', collectible: entity, characterStays: true });
        settled = true;
      } else if (isDestructible(entity)) {
        outcomes.push({ entity, outcome: 'destroy', dest });
        settled = true;
      } else {
        outcomes.push({ entity, outcome: 'stay' });
      }
    });
  }

  // Every occupied tile not part of a blocked run has an open tile ahead of
  // it and simply moves there, exactly like the no-wall fast path above.
  order.forEach((p, i) => {
    if (resolved[i]) return;
    const e = occupantAt(p);
    if (e) outcomes.push({ entity: e, outcome: 'move', dest: order[(i + 1) % n] });
  });

  return outcomes;
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
