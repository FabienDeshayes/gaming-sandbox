// Which way the compass points.
//
// The compass exists because the world is unbounded and the interesting things
// in it are single tiles (DESIGN.md §4.6). It deliberately points at objects the
// player has *not* found yet — that is the whole value of it — but only at ones
// this run could actually walk into, so it never sends anyone to a gate they
// can't open.
//
// Pure: no Phaser, no run mutation.

import { BASE_X, BASE_Y, chebyshev, chests, sanctums, sites } from './world.js';
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

  const built = sanctums(state.seed);
  // A gem is available once this run holds the key to its gate, and stops being
  // once it's yours. The hall keeps no gem, and is worth pointing at on exactly
  // the terms the story gives it (DESIGN.md §4.9): once every colour in the
  // world is in hand, the one tool that says what is worth walking to next
  // stops saying anything else.
  const colours = built.filter((sanctum) => sanctum.gem).length;
  for (const sanctum of built) {
    if (sanctum.hall) {
      if (state.gems >= colours && (!sanctum.key || state.keys.has(sanctum.key)))
        out.push({
          id: 'hall',
          sprite: 'sorcerer',
          hue: 0,
          x: sanctum.centre.x,
          y: sanctum.centre.y,
        });
      continue;
    }
    if (!sanctum.gem) continue;
    const def = itemDef(sanctum.gem);
    if (def.gem <= state.gems) continue;
    if (sanctum.key && !state.keys.has(sanctum.key)) continue;
    out.push(fromItem(sanctum.gem, sanctum.centre.x, sanctum.centre.y));
  }

  // A chest is worth pointing at while it is still shut, and stops being the
  // moment the lid is up — which is the whole reason a key is findable at all:
  // a box you have to stumble on would leave the campaign stuck behind a gate.
  // Whether it holds a key or a hoard is not the needle's business, so every
  // shut chest reads the same.
  for (const chest of chests(state.seed))
    if (!state.chests.has(chest.id))
      out.push({ id: chest.id, sprite: 'chest', hue: 0, x: chest.x, y: chest.y });

  for (const site of sites(state.seed)) {
    if (site.item) {
      // A tool you already own isn't lying there any more.
      if (!state.tools.has(site.item)) out.push(fromItem(site.item, site.x, site.y));
      continue;
    }
    // A merchant is worth pointing at while it still has something you can
    // only get there once — after that it's a shop you know the way to. Each
    // stall keeps its own id, so the needle can tell two apart.
    if (state.tools.size < 2)
      out.push({ id: site.id, sprite: 'merchant', hue: 0, x: site.x, y: site.y });
  }

  // Landmarks are deliberately **not** on the needle (DESIGN.md §4.10). They
  // have a way of being found already, and it is the eight posts standing
  // around the world with their names on: the compass is the instrument and a
  // signpost is somebody's directions, and pointing both at the same thing
  // would spend the instrument on the one thing that doesn't need it. It would
  // also cost the hall its moment — the Mint stands 12 tiles out, so a needle
  // that counted landmarks would rarely be pointing anywhere else.

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
