// What a light shows: the shapes, and what the dark at the edge of the world
// leaves of them. Pure — no browser.

import { assert, assertEqual, runIfMain, unit } from './harness.js';
import { chokeShape, visibleTiles } from '../src/core/light.js';
import { ITEMS } from '../src/data/items.js';

unit('a radius light lights the block around you, as wide as its radius', () => {
  const small = visibleTiles(ITEMS['torch-small'].shape, 0, 0, 'up');
  assertEqual(small.length, 9, 'radius 1 is the 3x3 block');
  assert(small.some((t) => t.x === 1 && t.y === 1), 'including the diagonal');

  assertEqual(visibleTiles(ITEMS['torch-medium'].shape, 0, 0, 'up').length, 25, 'radius 2 is 5x5');
  assertEqual(visibleTiles(ITEMS['torch-beacon'].shape, 0, 0, 'up').length, 49, 'radius 3 is 7x7');
});

unit('the lamp is a cone that widens with distance and re-aims with facing', () => {
  const up = visibleTiles(ITEMS['torch-lamp'].shape, 0, 0, 'up');
  // own tile + 3 + 5 + 7 + 9
  assertEqual(up.length, 25, 'tile count');
  assert(up.some((t) => t.x === 0 && t.y === -4), 'reaches 4 ahead');
  assert(up.some((t) => t.x === -4 && t.y === -4), 'is 9 wide at 4 ahead');
  assert(!up.some((t) => t.y > 0), 'and shows nothing behind');

  // Turning re-aims it, which is why the lamp rewards committing to a direction.
  const right = visibleTiles(ITEMS['torch-lamp'].shape, 0, 0, 'right');
  assert(right.some((t) => t.x === 4 && t.y === 0), 'reaches 4 to the right');
  assert(!right.some((t) => t.x < 0), 'and nothing behind, whichever way that is');
});

unit('no light at all is the tile underfoot', () => {
  assertEqual(visibleTiles(null, 3, -2), [{ x: 3, y: -2 }], 'blackout shows one tile');
});

unit('the dark at the edge narrows a shape without changing the light', () => {
  const beacon = { kind: 'radius', radius: 3 };
  assertEqual(chokeShape(beacon, 5), beacon, 'a light with room to spare is untouched');
  assertEqual(chokeShape(beacon, 1).radius, 1, 'and choked down where there is none');
  assertEqual(chokeShape({ kind: 'cone', depth: 4 }, 2).depth, 2, 'cones narrow the same way');
  // A copy, never the shape the item table holds — a beacon choked at the rim
  // has to be a beacon again on the way back in.
  assertEqual(ITEMS['torch-beacon'].shape.radius, 3, 'the item is left as it was');
});

// --- Shadows -----------------------------------------------------------------
//
// A shape and what it can actually see round are two different questions, and
// `visibleTiles` only asks the second when it is handed something to ask about
// — so the shape tests above are also the proof that nothing changed for a
// caller that doesn't care about terrain.

const BEACON = ITEMS['torch-beacon'].shape;
const blockers = (...keys) => {
  const set = new Set(keys);
  return (x, y) => set.has(`${x},${y}`);
};
const seen = (shape, isOpaque, facing = 'up') =>
  new Set(visibleTiles(shape, 0, 0, facing, isOpaque).map((t) => `${t.x},${t.y}`));

unit('a light shows the wall and not the ground behind it', () => {
  const lit = seen(BEACON, blockers('0,-1'));
  assert(lit.has('0,-1'), 'the rock in the way is lit — a wall that hid itself is one you walk into');
  assert(!lit.has('0,-2'), 'the tile directly behind it is not');
  assert(!lit.has('0,-3'), 'nor anything further along the same line');
  assert(lit.has('3,-3') && lit.has('-3,-3'), 'ground the rock is not standing in front of still lights');
});

unit('shadow is cast by what stands in the way, not by what a tile is made of', () => {
  // The same tile, seen from a light with nothing between it and the target:
  // a blocker one step to the side costs the far tile nothing.
  assert(seen(BEACON, blockers('1,-1')).has('0,-3'), 'a boulder beside the line does not block it');
  assert(!seen(BEACON, blockers('0,-2')).has('0,-3'), 'one on the line does');
});

unit('light spills through a gap in a wall, widening as it goes', () => {
  const wall = blockers('-3,-1', '-2,-1', '-1,-1', '1,-1', '2,-1', '3,-1');
  const lit = seen(BEACON, wall);
  assert(lit.has('0,-2') && lit.has('0,-3'), 'the gap itself sees straight through');
  assert(lit.has('-1,-3') && lit.has('1,-3'), 'and the cone through it widens with distance');
  assert(!lit.has('-3,-2') && !lit.has('3,-2'), 'while the ground behind the wall stays dark');
  // Sealed, the same wall shows nothing at all beyond itself.
  const sealed = seen(BEACON, blockers('-3,-1', '-2,-1', '-1,-1', '0,-1', '1,-1', '2,-1', '3,-1'));
  for (const key of ['-1,-2', '0,-2', '1,-2', '0,-3'])
    assert(!sealed.has(key), `nothing gets past a solid wall (${key})`);
});

unit('nothing a step away can ever be hidden', () => {
  // The promise the whole design rests on (DESIGN.md §5): a player can always
  // see the tiles they could step onto, so no shadow can ever strand them.
  // There is no tile between you and your neighbour for anything to stand on.
  const everything = () => true;
  const lit = seen(BEACON, everything);
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]])
    assert(lit.has(`${dx},${dy}`), `the tile at ${dx},${dy} is lit however solid the world is`);
  assert(lit.has('0,0'), 'and so is the one underfoot');
  // A radius-1 torch is therefore never affected by shadow at all.
  assertEqual(seen(ITEMS['torch-small'].shape, everything).size, 9, 'the small torch is shadow-proof');
});

unit('blackout is one tile, walled in or not', () => {
  assertEqual([...seen(null, () => true)], ['0,0'], 'no light left shows the tile underfoot');
});

unit('a cone is cut back by what it is aimed at', () => {
  const lamp = ITEMS['torch-lamp'].shape;
  const open = seen(lamp, blockers());
  // A wall one tile ahead leaves the lamp showing almost nothing — which is the
  // point of aiming it, and the worst case worth knowing is survivable.
  const blocked = seen(lamp, blockers('-1,-1', '0,-1', '1,-1'));
  assert(blocked.size < open.size, 'a wall across the cone costs it most of its reach');
  assert(blocked.has('0,-1'), 'the wall is still drawn');
  assert(!blocked.has('0,-4'), 'and nothing four tiles beyond it is');
  // Turning away from the wall gets the whole cone back: shadow is about where
  // things stand, never about the light.
  assertEqual(seen(lamp, blockers('-1,-1', '0,-1', '1,-1'), 'down').size, 25, 'facing away is a full cone');
});

runIfMain(import.meta.url);
