// Which way the compass points.
//
// The compass exists because the world is unbounded and the interesting things
// in it are seven tiles wide (DESIGN.md §4.6). It deliberately points at objects
// the player has *not* found yet — that is the whole value of it — but only at
// ones this run could actually walk into, so it never sends anyone to a gate
// they can't open.
//
// Pure: no Phaser, no run mutation.

import { BASE_X, BASE_Y, chebyshev, landmarks, sanctums } from './world.js';
import { itemDef } from '../data/items.js';

// The hut, which is what the compass falls back to when there is nothing left
// out there — and the thing it is most useful for anyway, walking home blind.
function hut() {
  return { id: 'hut', sprite: 'base', hue: 0, x: BASE_X, y: BASE_Y };
}

function fromItem(id, x, y) {
  const def = itemDef(id);
  return { id, sprite: def.sprite, hue: def.hue || 0, x, y };
}

// Everything the compass would consider pointing at, nearest last is not
// assumed — `compassTarget` sorts.
export function availableTargets(state) {
  const out = [];

  // A gem is available once its gate opens, and stops being once it's yours.
  for (const sanctum of sanctums(state.seed)) {
    if (!sanctum.gem) continue;
    const def = itemDef(sanctum.gem);
    if (def.gem <= state.gems) continue;
    if (sanctum.requires > state.gems) continue;
    out.push(fromItem(sanctum.gem, sanctum.centre.x, sanctum.centre.y));
  }

  for (const landmark of landmarks(state.seed)) {
    if (landmark.item) {
      // A tool you already own isn't lying there any more.
      if (!state.tools.has(landmark.item)) out.push(fromItem(landmark.item, landmark.x, landmark.y));
      continue;
    }
    // The merchant is worth pointing at while it still has something you can
    // only get there once — after that it's a shop you know the way to.
    if (state.tools.size < 2)
      out.push({ id: 'merchant', sprite: 'merchant', hue: 0, x: landmark.x, y: landmark.y });
  }

  return out;
}

// The nearest available unique object, or the hut when there is none. Ties break
// on id so the needle never flickers between two things the same distance away.
export function compassTarget(state) {
  const ranked = availableTargets(state)
    .map((target) => ({ ...target, distance: chebyshev(target.x, target.y, state.x, state.y) }))
    .sort((a, b) => a.distance - b.distance || (a.id < b.id ? -1 : 1));
  if (ranked.length) return ranked[0];
  const home = hut();
  return { ...home, distance: chebyshev(home.x, home.y, state.x, state.y) };
}

// The heading to walk, snapped to the four the needle can draw. Returns null
// when the target is the tile you're standing on.
//
// Four rather than eight because the sheet's chevrons are drawn pointing: a
// heading is a texture swap, not a rotation, and there are four of them
// (DESIGN.md §9). A target on an exact diagonal rounds clockwise, which is
// arbitrary but never flickers.
export const COMPASS_SECTORS = 4;

export function compassHeading(state, target) {
  const dx = target.x - state.x;
  const dy = target.y - state.y;
  if (!dx && !dy) return null;
  // Quarter turns, measured from north and going clockwise: 0 N, 1 E, 2 S, 3 W.
  const angle = Math.atan2(dx, -dy);
  const turns = Math.round((angle / (Math.PI * 2)) * COMPASS_SECTORS);
  return ((turns % COMPASS_SECTORS) + COMPASS_SECTORS) % COMPASS_SECTORS;
}
