// Draws a world: its tiles and ground, what machines have left on each tile,
// and the machines standing on it, one per tile. Used big for the Playground
// and small for the test world round the Workbench. Holds no state — the scene
// hands it the units, the tiles and a record for each machine, and it draws
// that.

import { COLORS, EFFECT_STYLE, FONT, TEXT_RESOLUTION } from '../config.js';
import { terrainAt } from '../core/machine.js';
import { drawMachine } from './machineArt.js';
import { drawTerrain, drawTileEffects } from './tileArt.js';

const BODY = 0.8; // machine body as a share of the tile

export class WorldView {
  // opts: { x, y, tile, coords (letters and numbers round the edge), names
  // (machine names on their tiles), depth }
  constructor(scene, world, opts) {
    this.scene = scene;
    this.world = world;
    this.x0 = opts.x;
    this.y0 = opts.y;
    this.tile = opts.tile;
    this.names = !!opts.names;
    this.width = world.cols * this.tile;
    this.height = world.rows * this.tile;
    const depth = opts.depth ?? 1;
    this.ground = scene.add.graphics().setDepth(depth);
    this.bodies = scene.add.graphics().setDepth(depth + 1);
    this.overlay = scene.add.graphics().setDepth(depth + 3);
    this.labels = [];
    this.coords = [];
    this.labelDepth = depth + 2;
    this.shown = true;

    if (opts.coords) {
      const style = { fontFamily: FONT, fontSize: '14px', color: COLORS.muted, resolution: TEXT_RESOLUTION };
      for (let c = 0; c < world.cols; c++) {
        this.coords.push(scene.add.text(this.x0 + c * this.tile + this.tile / 2, this.y0 - 14, String.fromCharCode(65 + c), style).setOrigin(0.5));
      }
      for (let r = 0; r < world.rows; r++) {
        this.coords.push(scene.add.text(this.x0 - 14, this.y0 + r * this.tile + this.tile / 2, `${r + 1}`, style).setOrigin(0.5));
      }
    }
  }

  setShown(on) {
    this.shown = on;
    for (const o of [this.ground, this.bodies, this.overlay, ...this.labels, ...this.coords]) o.setVisible(on);
  }

  setWorld(world) {
    this.world = world;
  }

  center(x, y) {
    return { x: this.x0 + x * this.tile + this.tile / 2, y: this.y0 + y * this.tile + this.tile / 2 };
  }

  tileAt(px, py) {
    if (!this.shown) return null;
    const x = Math.floor((px - this.x0) / this.tile);
    const y = Math.floor((py - this.y0) / this.tile);
    if (x < 0 || y < 0 || x >= this.world.cols || y >= this.world.rows) return null;
    return [x, y];
  }

  // state: { units, tiles: { [key]: tileState }, records: { [unitId]: record },
  // ghostId, highlight: Set, area: [{ x, y, kind }] }
  render(state) {
    const { units, tiles, records } = state;
    const t = this.tile;
    this.ground.clear();
    this.bodies.clear();
    this.overlay.clear();
    for (const l of this.labels) l.destroy();
    this.labels = [];

    for (let y = 0; y < this.world.rows; y++) {
      for (let x = 0; x < this.world.cols; x++) {
        const px = this.x0 + x * t;
        const py = this.y0 + y * t;
        this.ground.fillStyle(COLORS.tileHex, 1);
        this.ground.fillRect(px + 1, py + 1, t - 2, t - 2);
        const terrain = terrainAt(this.world, x, y);
        if (terrain) drawTerrain(this.ground, terrain.id, px, py, t);
      }
    }
    this.ground.lineStyle(1, COLORS.tileEdgeHex, 1);
    this.ground.strokeRect(this.x0, this.y0, this.width, this.height);

    for (const [key, tile] of Object.entries(tiles)) {
      const [x, y] = key.split(',').map(Number);
      drawTileEffects(this.ground, tile, this.x0 + x * t, this.y0 + y * t, t);
    }

    const size = t * BODY;
    for (const unit of units) {
      const c = this.center(unit.x, unit.y);
      const ghost = unit.id === state.ghostId;
      drawMachine(this.bodies, unit.machine.parts, unit.rot, c.x, c.y, size, {
        record: records[unit.id],
        alpha: ghost ? 0.7 : 1,
        label: this.names,
      });
      if (this.names) {
        const name = this.scene.add
          .text(c.x, c.y + size / 2 - 1, unit.machine.name, {
            fontFamily: FONT,
            fontSize: '11px',
            fontStyle: 'bold',
            color: COLORS.text,
            align: 'center',
            wordWrap: { width: t + 6 },
            padding: { x: 2, y: 0 },
            resolution: TEXT_RESOLUTION,
          })
          .setOrigin(0.5, 1)
          .setDepth(this.labelDepth)
          .setAlpha(ghost ? 0.8 : 1)
          .setVisible(this.shown);
        this.labels.push(name);
      }
    }

    // Where the hovered machine (or effector) reaches, before it is even fed.
    for (const { x, y, kind } of state.area ?? []) {
      this.overlay.lineStyle(3, EFFECT_STYLE[kind], 0.9);
      this.overlay.strokeRect(this.x0 + x * t + 4, this.y0 + y * t + 4, t - 8, t - 8);
    }
    const ring = (unit, width, alpha, inset) => {
      const c = this.center(unit.x, unit.y);
      this.overlay.lineStyle(width, COLORS.highlightHex, alpha);
      this.overlay.strokeRoundedRect(c.x - t / 2 + inset, c.y - t / 2 + inset, t - inset * 2, t - inset * 2, 10);
    };
    for (const unit of units) {
      if (state.highlight?.has(unit.id)) ring(unit, 3, 0.95, 2);
      if (unit.id === state.ghostId) ring(unit, 2, 0.8, 3);
    }
  }
}
