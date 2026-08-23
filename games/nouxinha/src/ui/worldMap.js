// The map overlay: everywhere this run has walked, seen at once.
//
// It draws the same three visibility states the viewport does and adds nothing
// to them — ground you have never lit is not on your map, because a map you
// didn't draw isn't a map (DESIGN.md §4.6). What it adds is scale: the whole
// walk in one screen instead of nine tiles at a time.
//
// A campaign's walk outgrows a phone screen long before it ends, so the whole
// walk at once is the opening view rather than the only one: the drawing is
// laid out to fill the width of the screen and can then be pinched, dragged,
// wheeled and buttoned into, the way any other map on a phone is.
//
// Items are deliberately absent. They move every time the world respawns, so a
// map of them would be a lie by the time it was drawn; what doesn't move is the
// ground, the hut, the merchant and the sanctums.

import { FONT, GAME_HEIGHT, GAME_WIDTH, TILE, gemColour, getPalette, hex } from '../config.js';
import { landmarks, sanctums, terrainAt } from '../core/world.js';
import { itemDef } from '../data/items.js';
import { makeButton } from './button.js';

const TEXTURE = 'worldmap-canvas';

// The drawing gets the full width of the screen and everything between the
// header and the controls: a campaign 260 tiles across has no pixels to spare,
// and a margin was costing it a tenth of them on each side. What keeps the
// drawing inside that box while it is dragged around is a mask, not a margin.
const VIEW_X = 0;
const VIEW_Y = 78;
const VIEW_W = GAME_WIDTH;
const VIEW_H = 628;

// A fresh campaign has barely anything explored, so the tightest-fit pixel
// size below would otherwise blow each tile up arbitrarily large. Capping the
// *opening* scale at the live viewport's own tile size means a young map never
// starts zoomed in closer than the game itself is — it just doesn't yet fill
// the screen, the way a mostly-dark map is supposed to look. Past that, the
// width of the screen is what wins and the drawing grows to fill it.
const MAX_PIXEL = TILE;

// How far in a zoom can go: a tile the size of a viewport tile, and never less
// than double the opening view, so even a tiny map has somewhere to go.
const maxScaleFor = (fit) => Math.max(fit * 2, TILE);
const ZOOM_STEP = 1.6;
// A wheel notch is ~100 deltaY in most browsers, which this turns into about a
// 16% step — small enough that a trackpad's stream of tiny deltas reads as a
// smooth zoom rather than a jump.
const WHEEL_RATE = 1.0015;

// Markers and the you-are-here dot are chrome, not cartography: they are
// counter-scaled on every zoom so they stay the same size on screen while the
// ground under them grows.
const MARKER_SCALE = 1.1;
const DOT_RADIUS = 5;
const RING_RADIUS = 11;

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

    this.view = null;
    this.markers = [];
    this.touches = new Map();
    this.drag = null;
    this.pinch = null;

    // Two fingers on the glass is how a phone zooms anything, and Phaser only
    // tracks a second one if it was asked to before it arrives.
    scene.input.addPointer(2);

    this.viewMask = scene.make.graphics({ x: 0, y: 0, add: false });
    this.viewMask.fillStyle(0xffffff);
    this.viewMask.fillRect(VIEW_X, VIEW_Y, VIEW_W, VIEW_H);

    // Listening on the scene rather than on a hit zone: a drag or a pinch that
    // wanders off the drawing mid-gesture shouldn't stop dead, and every one of
    // these is a no-op while the overlay is closed.
    scene.input.on('pointerdown', (p) => this.onDown(p));
    scene.input.on('pointermove', (p) => this.onMove(p));
    scene.input.on('pointerup', (p) => this.onUp(p));
    scene.input.on('pointerupoutside', (p) => this.onUp(p));
    scene.input.on('wheel', (p, over, dx, dy) => this.onWheel(p, dy));
  }

  isOpen() {
    return this.open;
  }

  show(run) {
    const pal = getPalette();
    const scene = this.scene;
    this.container.removeAll(true);
    this.view = null;
    this.markers = [];
    this.touches.clear();
    this.drag = null;
    this.pinch = null;

    const backdrop = scene.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, pal.bg, 0.97)
      .setOrigin(0)
      .setInteractive();
    const parts = [backdrop];

    parts.push(
      scene.add
        .text(GAME_WIDTH / 2, 34, 'THE MAP', {
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
      parts.push(
        scene.add
          .text(GAME_WIDTH / 2, 60, `${run.explored.size} TILES WALKED`, {
            fontFamily: FONT,
            fontSize: '12px',
            color: hex(pal.fg),
          })
          .setOrigin(0.5)
      );
      parts.push(...this.drawGround(run, bounds, pal));
      parts.push(...this.buildZoomControls());
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
  //
  // Everything drawn lives in one container in *tile* coordinates, so zooming
  // and panning are that container's scale and position and nothing here has to
  // know about either.
  drawGround(run, bounds, pal) {
    const scene = this.scene;
    const w = bounds.maxX - bounds.minX + 1;
    const h = bounds.maxY - bounds.minY + 1;

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

    this.tilesW = w;
    this.tilesH = h;
    this.fitScale = Math.min(MAX_PIXEL, VIEW_W / w, VIEW_H / h);
    this.minScale = this.fitScale;
    this.maxScale = maxScaleFor(this.fitScale);
    this.scale = this.fitScale;

    const view = scene.add.container(0, 0);
    view.setMask(this.viewMask.createGeometryMask());
    this.view = view;

    view.add(scene.add.image(0, 0, TEXTURE).setOrigin(0));

    // Markers for the unique objects this run has actually laid eyes on, plus
    // the hut, which you always know the way to, and where you are standing now.
    const tile = (tx, ty) => ({ x: tx - bounds.minX + 0.5, y: ty - bounds.minY + 0.5 });
    const mark = (tx, ty, sprite, hue) => {
      const at = tile(tx, ty);
      const marker = scene.add
        .image(at.x, at.y, sprite)
        .setScale(MARKER_SCALE)
        .setTint(gemColour(hue || 0));
      this.markers.push({ object: marker, base: MARKER_SCALE });
      view.add(marker);
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
    const you = tile(run.x, run.y);

    const dot = scene.add.graphics().setPosition(you.x, you.y);
    dot.fillStyle(pal.fg, 1);
    dot.fillCircle(0, 0, DOT_RADIUS);
    this.markers.push({ object: dot, base: 1 });
    view.add(dot);

    // The pulse tweens the ring itself, inside a wrapper that carries the
    // counter-scale — otherwise zooming and pulsing would be fighting over the
    // same scale property.
    const ringWrap = scene.add.container(you.x, you.y);
    const ring = scene.add.graphics();
    ring.lineStyle(2, pal.fg, 1);
    ring.strokeCircle(0, 0, RING_RADIUS);
    ringWrap.add(ring);
    this.markers.push({ object: ringWrap, base: 1 });
    view.add(ringWrap);

    if (this.hereTween) this.hereTween.stop();
    this.hereTween = scene.tweens.add({
      targets: ring,
      scale: { from: 1, to: 2.4 },
      alpha: { from: 0.9, to: 0 },
      duration: 1100,
      repeat: -1,
      ease: 'Sine.easeOut',
    });

    // Opens centred on the whole walk, which is what the map is for; where the
    // player then goes with it is up to their fingers.
    this.offsetX = VIEW_X + (VIEW_W - w * this.scale) / 2;
    this.offsetY = VIEW_Y + (VIEW_H - h * this.scale) / 2;
    this.applyView();

    return [view];
  }

  // Zoom by finger, wheel, or these — all three land in `zoomAbout`, so the
  // buttons are a way of doing the pinch that doesn't need two hands.
  buildZoomControls() {
    const scene = this.scene;
    const y = GAME_HEIGHT - 122;
    const opts = { width: 92, height: 40, fontSize: 15 };
    const out = () => this.stepZoom(1 / ZOOM_STEP);
    const into = () => this.stepZoom(ZOOM_STEP);
    this.zoomOutButton = makeButton(scene, GAME_WIDTH / 2 - 102, y, '-', out, opts);
    this.fitButton = makeButton(scene, GAME_WIDTH / 2, y, 'FIT', () => this.fit(), opts);
    this.zoomInButton = makeButton(scene, GAME_WIDTH / 2 + 102, y, '+', into, opts);
    this.refreshZoomControls();
    return [this.zoomOutButton, this.fitButton, this.zoomInButton];
  }

  refreshZoomControls() {
    if (!this.zoomInButton) return;
    this.zoomInButton.setEnabled(this.scale < this.maxScale - 0.001);
    this.zoomOutButton.setEnabled(this.scale > this.minScale + 0.001);
    this.fitButton.setEnabled(this.scale > this.minScale + 0.001);
  }

  // --- Zoom and pan -----------------------------------------------------------

  applyView() {
    if (!this.view) return;
    this.view.setScale(this.scale).setPosition(this.offsetX, this.offsetY);
    // Markers hold their size on screen: the ground is the thing being zoomed.
    for (const { object, base } of this.markers) object.setScale(base / this.scale);
    this.refreshZoomControls();
  }

  // Pan, clamped so the drawing can never be dragged off the screen: an axis
  // bigger than the window stops at its own edges, one smaller than it stays
  // centred, so there is always a map under the finger.
  panTo(x, y) {
    const w = this.tilesW * this.scale;
    const h = this.tilesH * this.scale;
    this.offsetX =
      w <= VIEW_W
        ? VIEW_X + (VIEW_W - w) / 2
        : Math.min(VIEW_X, Math.max(VIEW_X + VIEW_W - w, x));
    this.offsetY =
      h <= VIEW_H
        ? VIEW_Y + (VIEW_H - h) / 2
        : Math.min(VIEW_Y, Math.max(VIEW_Y + VIEW_H - h, y));
    this.applyView();
  }

  // Zoom holding one point of the ground still under the screen point given:
  // the pinch's midpoint, the wheel's cursor, the middle of the window for a
  // button. Zooming around anything else slides the map out from under the
  // thing being looked at.
  zoomAbout(scale, screenX, screenY) {
    if (!this.view) return;
    const next = Math.min(this.maxScale, Math.max(this.minScale, scale));
    const tileX = (screenX - this.offsetX) / this.scale;
    const tileY = (screenY - this.offsetY) / this.scale;
    this.scale = next;
    this.panTo(screenX - tileX * next, screenY - tileY * next);
  }

  stepZoom(factor) {
    this.zoomAbout(this.scale * factor, VIEW_X + VIEW_W / 2, VIEW_Y + VIEW_H / 2);
  }

  fit() {
    if (!this.view) return;
    this.scale = this.fitScale;
    this.panTo(
      VIEW_X + (VIEW_W - this.tilesW * this.scale) / 2,
      VIEW_Y + (VIEW_H - this.tilesH * this.scale) / 2
    );
  }

  // --- Gestures ---------------------------------------------------------------

  // Only pointers that went down on the drawing itself count, so a press on
  // CLOSE or on a zoom button is never also the start of a drag.
  inView(x, y) {
    return x >= VIEW_X && x <= VIEW_X + VIEW_W && y >= VIEW_Y && y <= VIEW_Y + VIEW_H;
  }

  onDown(pointer) {
    if (!this.open || !this.view || !this.inView(pointer.x, pointer.y)) return;
    this.touches.set(pointer.id, { x: pointer.x, y: pointer.y });
    if (this.touches.size >= 2) this.beginPinch();
    else this.drag = { x: pointer.x, y: pointer.y, ox: this.offsetX, oy: this.offsetY };
  }

  onMove(pointer) {
    if (!this.open || !this.view || !this.touches.has(pointer.id)) return;
    this.touches.set(pointer.id, { x: pointer.x, y: pointer.y });

    if (this.pinch && this.touches.size >= 2) {
      const [a, b] = [...this.touches.values()];
      const spread = Math.hypot(a.x - b.x, a.y - b.y);
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      // Measured from where the pinch started rather than from the last frame,
      // so a fumbled finger can't accumulate drift: the two fingers moving
      // apart is the zoom, and the pair of them moving together is the pan.
      const next = Math.min(
        this.maxScale,
        Math.max(this.minScale, this.pinch.scale * (spread / this.pinch.spread))
      );
      this.scale = next;
      this.panTo(midX - this.pinch.tileX * next, midY - this.pinch.tileY * next);
      return;
    }

    if (this.drag)
      this.panTo(this.drag.ox + (pointer.x - this.drag.x), this.drag.oy + (pointer.y - this.drag.y));
  }

  onUp(pointer) {
    if (!this.touches.delete(pointer.id)) return;
    this.pinch = null;
    this.drag = null;
    // A finger lifted out of a pinch leaves the other one dragging, from where
    // it is now rather than from where the pinch began.
    if (this.touches.size === 1) {
      const [only] = [...this.touches.values()];
      this.drag = { x: only.x, y: only.y, ox: this.offsetX, oy: this.offsetY };
    }
  }

  beginPinch() {
    const [a, b] = [...this.touches.values()];
    const spread = Math.hypot(a.x - b.x, a.y - b.y);
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    this.drag = null;
    this.pinch = {
      spread: Math.max(1, spread),
      scale: this.scale,
      tileX: (midX - this.offsetX) / this.scale,
      tileY: (midY - this.offsetY) / this.scale,
    };
  }

  onWheel(pointer, dy) {
    if (!this.open || !this.view || !this.inView(pointer.x, pointer.y)) return;
    this.zoomAbout(this.scale * Math.pow(WHEEL_RATE, -dy), pointer.x, pointer.y);
  }

  // What the drawing currently shows, for the tests to read back: everything a
  // gesture can change and the limits it can change it between.
  viewState() {
    if (!this.open || !this.view) return null;
    return {
      scale: this.scale,
      fitScale: this.fitScale,
      minScale: this.minScale,
      maxScale: this.maxScale,
      x: this.offsetX,
      y: this.offsetY,
      width: this.tilesW * this.scale,
      height: this.tilesH * this.scale,
      viewport: { x: VIEW_X, y: VIEW_Y, width: VIEW_W, height: VIEW_H },
    };
  }

  hide() {
    if (this.hereTween) {
      this.hereTween.stop();
      this.hereTween = null;
    }
    this.container.setVisible(false);
    this.container.removeAll(true);
    this.view = null;
    this.markers = [];
    this.touches.clear();
    this.drag = null;
    this.pinch = null;
    this.zoomInButton = null;
    this.zoomOutButton = null;
    this.fitButton = null;
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
