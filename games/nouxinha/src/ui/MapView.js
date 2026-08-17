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
  getPalette,
} from '../config.js';
import { decorAt, isBase, isWalkable } from '../core/world.js';
import { itemOnTile, litTiles, tileKey } from '../core/rules.js';
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
        // Three layers per tile: ground, then decoration or the base hut, then
        // whatever is lying on it.
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
  refresh(run) {
    const lit = new Set(litTiles(run).map((t) => tileKey(t.x, t.y)));

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
      const rock = !isWalkable(wx, wy, run.seed);

      cell.ground
        .setTexture(rock ? 'rock' : this.floorVariant(run, wx, wy))
        .setVisible(true)
        .setAlpha(alpha);

      if (rock) {
        cell.overlay.setVisible(false);
        cell.item.setVisible(false);
        continue;
      }

      // The wizard stands in the doorway of the base rather than on top of it:
      // both sprites are dense, and together they read as one unidentifiable blob.
      const underCharacter = cell.dx === 0 && cell.dy === 0;
      if (isBase(wx, wy)) {
        cell.overlay.setTexture('base').setVisible(!underCharacter).setAlpha(alpha);
      } else {
        cell.overlay
          .setTexture(`decor-${decorAt(wx, wy, run.seed)}`)
          .setVisible(true)
          .setAlpha(alpha);
      }

      const item = itemOnTile(run, wx, wy);
      if (item) {
        cell.item.setTexture(itemDef(item).sprite).setVisible(true).setAlpha(alpha);
      } else {
        cell.item.setVisible(false);
      }
    }

    this.wizard.setTexture(`wizard-${run.facing}`);
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
