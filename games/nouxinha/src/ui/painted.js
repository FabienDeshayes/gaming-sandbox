// Drawing a tile that is more than one colour.
//
// Every texture in the game is a flat 1-bit mask, so a sprite can only ever
// take one tint. A tile that has to carry a colour a gem gave back *and* the
// colour everything else is drawn in is therefore not one sprite but a stack of
// them: one image per zone (`src/data/paint.js`), each tinted separately, sat
// on top of each other in the same place. The zones are cut so they never
// overlap, which is what keeps the stack looking like the single silhouette it
// came off the sheet as — at any alpha, which a stack of overlapping sprites
// would not survive.
//
// A tile with no paint on it is the same stack with one layer showing, so
// everything on screen can go through here and nothing has to know which tiles
// are painted and which aren't.

import { PAINT_ZONES, paintOf, zoneKey } from '../data/paint.js';
import { gemColour, getPalette } from '../config.js';

// A container of PAINT_ZONES stacked images. `key` is set by `paintTile` and is
// the sprite the stack is currently drawing — the layers carry zone textures
// whose names nothing outside here should have to know.
export function makePainted(scene, x, y, scale) {
  const tile = scene.add.container(x, y);
  tile.layers = [];
  for (let zone = 0; zone < PAINT_ZONES; zone++) {
    const layer = scene.add.image(0, 0, 'floor').setScale(scale).setVisible(false);
    tile.layers.push(layer);
    tile.add(layer);
  }
  tile.key = null;
  return tile;
}

// The colour one hue resolves to. A hue naming a gem draws in that gem's colour
// once it is held and in the base colour until then, which is what makes a tile
// gain colour as the campaign goes on rather than showing a colour the world
// has not been given back yet. `roles` supplies the hues that depend on where
// the tile is rather than on what it is — see src/data/paint.js.
//
// A role can resolve two ways. A number is a gem, and the gems in hand decide
// whether it is drawn. `{ colour }` is a colour outright — a landmark's own,
// which is not a gem's and so is not gated on one; the caller has already
// decided whether the campaign has earned it, and passes 0 where it hasn't.
export function hueColour(hue, { gems = 0, base, roles = {} } = {}) {
  const fallback = base === undefined ? getPalette().fg : base;
  const value = typeof hue === 'string' ? roles[hue] || 0 : hue;
  if (value && typeof value === 'object') return value.colour || fallback;
  return value && gems >= value ? gemColour(value) : fallback;
}

// The colour each of a key's zones is drawn in, longest-first so a caller can
// read one off by zone. Zone 0 is the base colour by definition, and so is
// every zone the key doesn't paint.
export function zoneTints(key, options = {}) {
  const base = options.base === undefined ? getPalette().fg : options.base;
  const entry = paintOf(key);
  const tints = Array.from({ length: PAINT_ZONES }, () => base);
  if (entry) entry.hues.forEach((hue, i) => (tints[i + 1] = hueColour(hue, { ...options, base })));
  return tints;
}

// Points a stack at a sprite and colours it. Every layer is tinted, shown or
// not, so anything reading a zone's colour back gets the same answer whether
// the zone has pixels in it or not.
export function paintTile(tile, key, options = {}) {
  const entry = paintOf(key);
  const tints = zoneTints(key, options);
  tile.key = key;
  tile.layers.forEach((layer, zone) => {
    layer.setTint(tints[zone]);
    const drawn = zone === 0 || (entry && zone <= entry.hues.length);
    if (drawn) layer.setTexture(entry ? zoneKey(key, zone) : key);
    layer.setVisible(drawn);
  });
  return tile;
}
