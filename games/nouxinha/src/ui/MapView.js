// The map viewport: a fixed pool of tile sprites reassigned around the
// character each step.
//
// The world is infinite, so nothing here ever grows — VIEW_COLS x VIEW_ROWS
// sprites are created once and repointed at whatever tile now sits at their
// screen position. Holds no game state; everything it draws it reads from a run.

import {
  GAME_WIDTH,
  LIT_ALPHA,
  REMEMBERED_ALPHA,
  SPRITE_SCALE,
  TILE,
  VIEW_CX,
  VIEW_CY,
  VIEW_COLS,
  VIEW_H,
  VIEW_ROWS,
  gemColour,
  getPalette,
} from '../config.js';
import { isBase, terrainAt } from '../core/world.js';
import { gateOnTile, itemOnTile, litTiles, tileKey } from '../core/rules.js';
import { itemDef } from '../data/items.js';

export class MapView {
  constructor(scene) {
    this.scene = scene;
    const pal = getPalette();

    // Tiles live in their own container so a step can slide the whole world at
    // once while the character stays pinned to the centre of the screen.
    this.layer = scene.add.container(0, 0);

    const mask = scene.make.graphics({ x: 0, y: 0, add: false });
    mask.fillStyle(0xffffff);
    mask.fillRect(0, 0, GAME_WIDTH, VIEW_H);
    this.layer.setMask(mask.createGeometryMask());

    const midCol = Math.floor(VIEW_COLS / 2);
    const midRow = Math.floor(VIEW_ROWS / 2);

    this.cells = [];
    for (let row = 0; row < VIEW_ROWS; row++) {
      for (let col = 0; col < VIEW_COLS; col++) {
        const px = VIEW_CX + (col - midCol) * TILE;
        const py = VIEW_CY + (row - midRow) * TILE;
        const make = () =>
          scene.add
            .image(px, py, 'floor')
            .setScale(SPRITE_SCALE)
            .setTint(pal.fg)
            .setVisible(false);
        // Three layers per tile: ground, then the base hut where there is one,
        // then whatever is lying on it.
        const cell = {
          dx: col - midCol,
          dy: row - midRow,
          ground: make(),
          overlay: make(),
          item: make(),
        };
        this.layer.add([cell.ground, cell.overlay, cell.item]);
        this.cells.push(cell);
      }
    }

    this.wizard = scene.add
      .image(VIEW_CX, VIEW_CY, 'wizard-up')
      .setScale(SPRITE_SCALE)
      .setTint(pal.fg);
  }

  // Repaints every tile from the run's current position. Three visibility
  // states: unknown tiles are simply not drawn, remembered ones are dimmed, and
  // the lit shape draws at full brightness.
  //
  // Tints are reassigned here rather than once at construction, because what
  // colour a tile is drawn in now depends on the run: a gate takes the colour
  // of the gem that opened it, and an item takes the colour of the gem that
  // made it visible (DESIGN.md §9).
  refresh(run) {
    const lit = new Set(litTiles(run).map((t) => tileKey(t.x, t.y)));
    const fg = getPalette().fg;

    for (const cell of this.cells) {
      const wx = run.x + cell.dx;
      const wy = run.y + cell.dy;
      const key = tileKey(wx, wy);

      if (!run.explored.has(key)) {
        cell.ground.setVisible(false);
        cell.overlay.setVisible(false);
        cell.item.setVisible(false);
        continue;
      }

      const alpha = lit.has(key) ? LIT_ALPHA : REMEMBERED_ALPHA;
      const terrain = terrainAt(wx, wy, run.seed);
      const underCharacter = cell.dx === 0 && cell.dy === 0;
      const gate = terrain === 'gate' ? gateOnTile(run, wx, wy) : null;
      // Standing in an open gateway, the arch gives way to plain floor. The
      // wizard and a gate are both dense sprites and one on top of the other
      // reads as a single blob — the same reason the hut isn't drawn underneath
      // them either. A shut gate never has to worry about it: you can't stand
      // on one.
      const showGate = gate && !underCharacter;

      // A gate fills its tile the way rock and wall do — it *is* the ring it
      // stands in, not something lying on the floor. Shut, it's drawn in the
      // palette's own foreground, because a gate you can't open yet is just
      // more wall; open, it's the colour of the gem that opened it.
      const ground = showGate
        ? gate.open
          ? 'gate-open'
          : 'gate'
        : terrain === 'rock'
          ? 'rock'
          : terrain === 'wall'
            ? 'wall'
            : this.floorVariant(run, wx, wy);

      cell.ground
        .setTexture(ground)
        .setTint(showGate && gate.open ? gemColour(gate.requires) : fg)
        .setVisible(true)
        .setAlpha(alpha);

      // Nothing lies on rock, on wall, or in a gateway.
      if (terrain !== 'floor') {
        cell.overlay.setVisible(false);
        cell.item.setVisible(false);
        continue;
      }

      // The base is the only thing that sits on top of bare floor. The wizard
      // stands in its doorway rather than on top of it: both sprites are dense,
      // and together they read as one unidentifiable blob.
      cell.overlay
        .setTexture('base')
        .setTint(fg)
        .setVisible(isBase(wx, wy) && !underCharacter)
        .setAlpha(alpha);

      const item = itemOnTile(run, wx, wy);
      if (item) {
        const def = itemDef(item);
        cell.item
          .setTexture(def.sprite)
          .setTint(gemColour(def.hue || 0))
          .setVisible(true)
          .setAlpha(alpha);
      } else {
        cell.item.setVisible(false);
      }
    }

    // The wizard carries the newest colour they've brought back (DESIGN.md §9).
    this.wizard.setTexture(`wizard-${run.facing}`).setTint(gemColour(run.gems));
  }


  // A floor tile draws its top and left edges always, and closes off its right
  // or bottom edge only where the neighbour there is still unknown — so the
  // shared edge between two known tiles is drawn once, and the frontier of
  // explored ground still reads as an edge rather than trailing off.
  floorVariant(run, x, y) {
    const openRight = !run.explored.has(tileKey(x + 1, y));
    const openBottom = !run.explored.has(tileKey(x, y + 1));
    if (openRight && openBottom) return 'floor-rb';
    if (openRight) return 'floor-r';
    if (openBottom) return 'floor-b';
    return 'floor';
  }

  // Starts the world one tile off-centre in the direction just walked and
  // slides it home, so a step reads as the world moving around the character.
  slide(scene, dir, onDone) {
    this.layer.x = dir.dx * TILE;
    this.layer.y = dir.dy * TILE;
    scene.tweens.add({
      targets: this.layer,
      x: 0,
      y: 0,
      duration: 90,
      onComplete: onDone,
    });
  }

  // A blocked step doesn't move anything, so the wizard bumps into the rock instead.
  bump(scene, dir, onDone) {
    scene.tweens.add({
      targets: this.wizard,
      x: VIEW_CX + dir.dx * 7,
      y: VIEW_CY + dir.dy * 7,
      duration: 60,
      yoyo: true,
      onComplete: onDone,
    });
  }
}
