// The map viewport: a fixed pool of tile sprites reassigned around the
// character each step.
//
// The world is infinite, so nothing here ever grows — VIEW_COLS x VIEW_ROWS
// sprites are created once and repointed at whatever tile now sits at their
// screen position. Holds no game state; everything it draws it reads from a run.

import { BLACKOUT_MEMORY_RADIUS } from '../balance.js';
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
import { isBase, isMerchant, sanctumAt, terrainAt, variantAt } from '../core/world.js';
import { gateOnTile, isBlackout, itemOnTile, litTiles, tileKey } from '../core/rules.js';
import { itemDef } from '../data/items.js';
import { variantKey, wallSprite } from '../data/tiles.js';
import { makePainted, paintTile } from './painted.js';
import { makeWizard, paintWizard } from './wizard.js';

// Which piece of the wall nine-slice a sanctum's ring tile draws. The ring is a
// square one tile thick, so where a tile sits on it is enough — no need to look
// at what its neighbours are, which would not tell a top run from a bottom one
// anyway (both have wall to the left and right and open ground above and
// below).
function wallPiece(site, x, y) {
  if (!site) return 'wall';
  const { centre, radius } = site.sanctum;
  return wallSprite(x - centre.x, y - centre.y, radius);
}

// The gem a sanctum is the colour of (DESIGN.md §9): the one it keeps, or — for
// the last one, which keeps none — the one its gate wanted, so that the walk
// gem three pays for still arrives somewhere wearing a colour.
function sanctumHue(sanctum) {
  const gem = itemDef(sanctum.gem);
  return gem ? gem.hue : sanctum.requires;
}

export class MapView {
  constructor(scene) {
    this.scene = scene;

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
        const make = () => makePainted(scene, px, py, SPRITE_SCALE).setVisible(false);
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

    this.wizard = makeWizard(scene, VIEW_CX, VIEW_CY, 'up', SPRITE_SCALE);
  }

  // Repaints every tile from the run's current position. Three visibility
  // states: unknown tiles are simply not drawn, remembered ones are dimmed, and
  // the lit shape draws at full brightness.
  //
  // Tints are reassigned here rather than once at construction, because what
  // colour a tile is drawn in depends on the run: a sanctum wears the colour of
  // the gem it keeps, a gate the colour of the gem that opened it, an item the
  // colour of the gem that made it visible — and every painted tile only wears
  // a colour once that gem has actually been picked up (DESIGN.md §9).
  refresh(run) {
    const lit = new Set(litTiles(run).map((t) => tileKey(t.x, t.y)));
    const fg = getPalette().fg;
    const blackout = isBlackout(run);

    for (const cell of this.cells) {
      const wx = run.x + cell.dx;
      const wy = run.y + cell.dy;
      const key = tileKey(wx, wy);
      // In blackout, memory itself shrinks to a fog of war around the
      // character — remembered ground further out is hidden again rather
      // than staying legible, which is what makes running out of light
      // actually dangerous to walk through (DESIGN.md §4).
      const tooFarInBlackout =
        blackout &&
        !lit.has(key) &&
        Math.max(Math.abs(cell.dx), Math.abs(cell.dy)) > BLACKOUT_MEMORY_RADIUS;

      if (!run.explored.has(key) || tooFarInBlackout) {
        cell.ground.setVisible(false);
        cell.overlay.setVisible(false);
        cell.item.setVisible(false);
        continue;
      }

      const alpha = lit.has(key) ? LIT_ALPHA : REMEMBERED_ALPHA;
      const terrain = terrainAt(wx, wy, run.seed);

      // Outside the world. Nothing is drawn there — the boundary is read by
      // seeing the ground stop, not by seeing a wall (DESIGN.md §4.7). Lit
      // tiles never include one of these, so this only catches ground an older
      // save remembers walking before the world had an edge.
      if (terrain === 'dark') {
        cell.ground.setVisible(false);
        cell.overlay.setVisible(false);
        cell.item.setVisible(false);
        continue;
      }

      const underCharacter = cell.dx === 0 && cell.dy === 0;
      // Masonry: which sanctum this tile belongs to decides both which piece of
      // the nine-slice it draws and which gem's colour it wears.
      const site =
        terrain === 'wall' || terrain === 'gate' ? sanctumAt(wx, wy, run.seed) : null;
      const gate = terrain === 'gate' ? gateOnTile(run, wx, wy) : null;
      // Standing in an open gateway, the arch gives way to plain floor. The
      // wizard and a gate are both dense sprites and one on top of the other
      // reads as a single blob — the same reason the hut isn't drawn underneath
      // them either. A shut gate never has to worry about it: you can't stand
      // on one.
      const showGate = gate && !underCharacter;

      // A gate fills its tile the way rock and wall do — it *is* the ring it
      // stands in, not something lying on the floor.
      const ground = showGate
        ? gate.open
          ? 'gate-open'
          : 'gate'
        : terrain === 'rock' || terrain === 'tree'
          ? variantKey(terrain, variantAt(wx, wy, run.seed))
          : terrain === 'wall'
            ? wallPiece(site, wx, wy)
            : 'floor';

      // The two hues a tile can only get from where it stands: the gem the
      // sanctum around it keeps, and the gem whose colour opened its gate. Both
      // resolve to the plain foreground until that gem is in hand, so a gate
      // you can't open yet is just more wall and an unclaimed sanctum is just
      // more masonry.
      const roles = site
        ? { gem: sanctumHue(site.sanctum), opened: gate ? gate.requires : 0 }
        : {};

      cell.ground.setVisible(true).setAlpha(alpha);
      paintTile(cell.ground, ground, { gems: run.gems, base: fg, roles });

      // Nothing lies on rock, on trees, on wall, or in a gateway.
      if (terrain !== 'floor') {
        cell.overlay.setVisible(false);
        cell.item.setVisible(false);
        continue;
      }

      // The hut and the merchant's stall are the two things that sit on top of
      // bare floor. The wizard stands in the doorway rather than on top of
      // either: both sprites are dense, and together they read as one
      // unidentifiable blob.
      const structure = isBase(wx, wy)
        ? 'base'
        : isMerchant(wx, wy, run.seed)
          ? 'merchant'
          : null;
      cell.overlay.setVisible(!!structure && !underCharacter).setAlpha(alpha);
      paintTile(cell.overlay, structure || 'base', { gems: run.gems, base: fg });

      const item = itemOnTile(run, wx, wy);
      if (item) {
        const def = itemDef(item);
        const hue = def.hue || 0;
        cell.item.setVisible(true).setAlpha(alpha);
        // An item of a gem's tier is drawn in that gem's colour outright — it
        // is only in the world at all because that gem is (DESIGN.md §4.3) —
        // and anything its own paint adds sits on top of that.
        paintTile(cell.item, def.sprite, {
          gems: run.gems,
          base: gemColour(hue),
          roles: { gem: hue },
        });
      } else {
        cell.item.setVisible(false);
      }
    }

    // The wizard wears one colour per gem carried, on top of the base colour
    // they start with (DESIGN.md §9).
    paintWizard(this.wizard, run.facing, run.gems);
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
