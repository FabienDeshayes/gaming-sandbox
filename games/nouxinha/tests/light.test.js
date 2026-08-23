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

runIfMain(import.meta.url);
