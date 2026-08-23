// The map overlay: everywhere this run has walked, seen at once.
//
// It draws the same three visibility states the viewport does and adds nothing
// to them — ground you have never lit is not on your map, because a map you
// didn't draw isn't a map (DESIGN.md §4.6). What it adds is scale: the whole
// walk in one screen instead of nine tiles at a time.
//
// Items are deliberately absent. They move every time the world respawns, so a
// map of them would be a lie by the time it was drawn; what doesn't move is the
// ground, the hut, the merchant and the sanctums.

import { FONT, GAME_HEIGHT, GAME_WIDTH, gemColour, getPalette, hex } from '../config.js';
import { landmarks, sanctums, terrainAt } from '../core/world.js';
import { itemDef } from '../data/items.js';
import { makeButton } from './button.js';

const TEXTURE = 'worldmap-canvas';
const DRAW_MARGIN = 12;
const DRAW_W = GAME_WIDTH - DRAW_MARGIN * 2;
const DRAW_H = 560;
const MAX_PIXEL = 6;

// Rock and sanctum wall are the shape of the world; floor is the ground you
// crossed. Same two-colour discipline as the viewport, done with alpha.
const SOLID_ALPHA = 255;
const FLOOR_ALPHA = 90;

export class WorldMap {
  constructor(scene, { onClose }) {
    this.scene = scene;
    this.onClose = onClose;
    this.open = false;
    this.container = scene.add.container(0, 0).setVisible(false).setDepth(210);
  }

  isOpen() {
    return this.open;
  }

  show(run) {
    const pal = getPalette();
    const scene = this.scene;
    this.container.removeAll(true);

    const backdrop = scene.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, pal.bg, 0.97)
      .setOrigin(0)
      .setInteractive();
    const parts = [backdrop];

    parts.push(
      scene.add
        .text(GAME_WIDTH / 2, 42, 'THE MAP', {
          fontFamily: FONT,
          fontSize: '20px',
          color: hex(pal.fg),
        })
        .setOrigin(0.5)
    );

    const bounds = boundsOf(run.explored);
    if (!bounds) {
      parts.push(
        scene.add
          .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'NOTHING WALKED YET.', {
            fontFamily: FONT,
            fontSize: '14px',
            color: hex(pal.fg),
          })
          .setOrigin(0.5)
      );
    } else {
      parts.push(...this.drawGround(run, bounds, pal));
    }

    parts.push(
      makeButton(scene, GAME_WIDTH / 2, GAME_HEIGHT - 70, 'CLOSE', () => this.onClose(), {
        width: 170,
        height: 44,
        fontSize: 13,
      })
    );

    this.container.add(parts);
    this.container.setVisible(true);
    this.open = true;
  }

  // Ground goes into a canvas texture a pixel per tile and is then scaled up,
  // rather than into thousands of rectangles: a long campaign can have walked
  // tens of thousands of tiles, and `pixelArt` scaling keeps the result crisp.
  drawGround(run, bounds, pal) {
    const scene = this.scene;
    const w = bounds.maxX - bounds.minX + 1;
    const h = bounds.maxY - bounds.minY + 1;
    const pixel = Math.max(1, Math.min(MAX_PIXEL, Math.floor(Math.min(DRAW_W / w, DRAW_H / h))));

    if (scene.textures.exists(TEXTURE)) scene.textures.remove(TEXTURE);
    const canvas = scene.textures.createCanvas(TEXTURE, w, h);
    const ctx = canvas.getContext();
    const image = ctx.createImageData(w, h);
    const r = (pal.fg >> 16) & 0xff;
    const g = (pal.fg >> 8) & 0xff;
    const b = pal.fg & 0xff;

    for (const key of run.explored) {
      const comma = key.indexOf(',');
      const x = Number(key.slice(0, comma)) - bounds.minX;
      const y = Number(key.slice(comma + 1)) - bounds.minY;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const terrain = terrainAt(x + bounds.minX, y + bounds.minY, run.seed);
      // Outside the world: left unpainted, so the drawing's own outline is the
      // shape of the world rather than a box around it (DESIGN.md §4.7).
      if (terrain === 'dark') continue;
      const at = (y * w + x) * 4;
      image.data[at] = r;
      image.data[at + 1] = g;
      image.data[at + 2] = b;
      image.data[at + 3] = terrain === 'floor' ? FLOOR_ALPHA : SOLID_ALPHA;
    }
    ctx.putImageData(image, 0, 0);
    canvas.refresh();

    const cx = GAME_WIDTH / 2;
    const cy = 80 + DRAW_H / 2;
    const originX = cx - (w * pixel) / 2;
    const originY = cy - (h * pixel) / 2;
    const screen = (tx, ty) => ({
      x: originX + (tx - bounds.minX + 0.5) * pixel,
      y: originY + (ty - bounds.minY + 0.5) * pixel,
    });

    const ground = scene.add.image(cx, cy, TEXTURE).setScale(pixel);
    const parts = [ground];

    // Markers for the unique objects this run has actually laid eyes on, plus
    // the hut, which you always know the way to, and where you are standing now.
    const mark = (tx, ty, sprite, hue) => {
      const at = screen(tx, ty);
      parts.push(
        scene.add
          .image(at.x, at.y, sprite)
          .setScale(1.1)
          .setTint(gemColour(hue || 0))
      );
    };

    mark(0, 0, 'base', 0);
    for (const sanctum of sanctums(run.seed))
      if (sanctum.gem && run.seenUnique.has(sanctum.gem))
        mark(sanctum.centre.x, sanctum.centre.y, 'gem', itemDef(sanctum.gem).hue);
    for (const landmark of landmarks(run.seed))
      if (run.seenUnique.has(landmark.id))
        mark(landmark.x, landmark.y, landmark.item ? itemDef(landmark.item).sprite : 'merchant', 0);

    // Current position: a solid dot that holds still, plus a ring that
    // continually pulses outward from it. Every other marker on this map is a
    // static sprite, so motion is what tells "you are here" apart from a
    // landmark at a glance rather than relying on a colour the two-colour
    // rule doesn't have to spend (DESIGN.md §9).
    const you = screen(run.x, run.y);
    const dotRadius = Math.max(3, pixel * 0.8);
    const ringRadius = Math.max(5, pixel * 2);

    const dot = scene.add.graphics().setPosition(you.x, you.y);
    dot.fillStyle(pal.fg, 1);
    dot.fillCircle(0, 0, dotRadius);
    parts.push(dot);

    const ring = scene.add.graphics().setPosition(you.x, you.y);
    ring.lineStyle(2, pal.fg, 1);
    ring.strokeCircle(0, 0, ringRadius);
    parts.push(ring);

    if (this.hereTween) this.hereTween.stop();
    this.hereTween = scene.tweens.add({
      targets: ring,
      scale: { from: 1, to: 2.4 },
      alpha: { from: 0.9, to: 0 },
      duration: 1100,
      repeat: -1,
      ease: 'Sine.easeOut',
    });

    parts.push(
      scene.add
        .text(GAME_WIDTH / 2, GAME_HEIGHT - 118, `${run.explored.size} TILES WALKED`, {
          fontFamily: FONT,
          fontSize: '12px',
          color: hex(pal.fg),
        })
        .setOrigin(0.5)
    );
    return parts;
  }

  hide() {
    if (this.hereTween) {
      this.hereTween.stop();
      this.hereTween = null;
    }
    this.container.setVisible(false);
    this.container.removeAll(true);
    this.open = false;
  }
}

function boundsOf(explored) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const key of explored) {
    const comma = key.indexOf(',');
    const x = Number(key.slice(0, comma));
    const y = Number(key.slice(comma + 1));
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  // The hut is always on the map (DESIGN.md §4.3), so the window always contains it.
  if (minX === Infinity) return null;
  return {
    minX: Math.min(minX, 0),
    minY: Math.min(minY, 0),
    maxX: Math.max(maxX, 0),
    maxY: Math.max(maxY, 0),
  };
}
