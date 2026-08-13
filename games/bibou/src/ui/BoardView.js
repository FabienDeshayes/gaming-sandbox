import {
  BOARD_PX,
  BOARD_X,
  BOARD_Y,
  CELL,
  COLORS,
  EDGE_ARROW_INSET,
} from '../config.js';
import { DIRECTIONS, RING, wrap } from '../core/rules.js';

// Per-action arrow styling, kept identical to the pre-split look.
const MOVE_ARROW = { fontSize: '34px', padding: { x: 6, y: 2 } };
const ROTATE_ARROW = { fontSize: '38px', padding: { x: 8, y: 2 } };
const SHIFT_ARROW = { fontSize: '20px', padding: { x: 4, y: 2 } };
const FLIP_ARROW = { fontSize: '30px', padding: { x: 8, y: 2 } };

// Everything anchored to the board: the static grid, the character sprite, the
// design-space <-> cell coordinate mapping, and the transient controls (arrows
// and highlights) an action shows while it waits for a direction.
//
// BoardView holds no game state — the selection state machine lives in
// PuzzleScene, which passes callbacks into the show*() methods.
export class BoardView {
  constructor(scene, size, goalPos) {
    this.scene = scene;
    this.size = size;
    this.goalPos = goalPos;
    this.controls = []; // transient UI (arrows, highlights)
  }

  // --- Coordinate helpers ---
  cellCenter(x, y) {
    return {
      px: BOARD_X + x * CELL + CELL / 2,
      py: BOARD_Y + y * CELL + CELL / 2,
    };
  }

  pointerToCell(pointer) {
    const x = Math.floor((pointer.x - BOARD_X) / CELL);
    const y = Math.floor((pointer.y - BOARD_Y) / CELL);
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return null;
    return { x, y };
  }

  // --- Rendering ---
  drawBoard() {
    const g = this.scene.add.graphics();
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const isGoal = x === this.goalPos.x && y === this.goalPos.y;
        g.fillStyle(isGoal ? COLORS.goalHex : COLORS.floorHex, 1);
        g.fillRect(BOARD_X + x * CELL, BOARD_Y + y * CELL, CELL, CELL);
        g.lineStyle(2, COLORS.gridLineHex, 1);
        g.strokeRect(BOARD_X + x * CELL, BOARD_Y + y * CELL, CELL, CELL);
      }
    }
    // Goal marker on top of the goal cell so it reads as the target.
    const goal = this.cellCenter(this.goalPos.x, this.goalPos.y);
    this.scene.add
      .text(goal.px, goal.py, '★', {
        fontFamily: 'sans-serif',
        fontSize: '40px',
        color: COLORS.goalMark,
      })
      .setOrigin(0.5);
  }

  // Walls (LEVEL_DESIGN.md §1.2): a red line on the edge shared by the two
  // tiles a wall connects. A wraparound wall (its two tiles sit at opposite
  // extremes of a row/column) has no shared edge on screen, so it draws on
  // *both* tiles' outer board edge instead — the two segments are one logical
  // wall, split across the two places it visually touches.
  drawWalls(walls) {
    const g = this.scene.add.graphics();
    g.lineStyle(4, COLORS.wallHex, 1);
    (walls ?? []).forEach(([a, b]) => {
      if (a.y === b.y) {
        const y0 = BOARD_Y + a.y * CELL;
        if (Math.abs(a.x - b.x) === 1) {
          const x = BOARD_X + Math.max(a.x, b.x) * CELL;
          g.lineBetween(x, y0, x, y0 + CELL);
        } else {
          g.lineBetween(BOARD_X, y0, BOARD_X, y0 + CELL);
          g.lineBetween(BOARD_X + BOARD_PX, y0, BOARD_X + BOARD_PX, y0 + CELL);
        }
      } else {
        const x0 = BOARD_X + a.x * CELL;
        if (Math.abs(a.y - b.y) === 1) {
          const y = BOARD_Y + Math.max(a.y, b.y) * CELL;
          g.lineBetween(x0, y, x0 + CELL, y);
        } else {
          g.lineBetween(x0, BOARD_Y, x0 + CELL, BOARD_Y);
          g.lineBetween(x0, BOARD_Y + BOARD_PX, x0 + CELL, BOARD_Y + BOARD_PX);
        }
      }
    });
  }

  // One sprite per entity, in the same order as the list PuzzleScene owns.
  // Crates sit below the character in draw order — no two entities ever share
  // a tile now (LEVEL_DESIGN.md §3), but this keeps the character legible if a
  // future entity type ever does.
  createEntities(entities) {
    this.entitySprites = entities.map((entity) => {
      if (entity.kind === 'crate') {
        return this.scene.add
          .rectangle(0, 0, CELL * 0.62, CELL * 0.62, COLORS.crateHex)
          .setStrokeStyle(3, COLORS.crateStrokeHex)
          .setDepth(1);
      }
      return this.scene.add
        .rectangle(0, 0, CELL * 0.6, CELL * 0.6, COLORS.characterHex)
        .setStrokeStyle(3, 0xffffff)
        .setDepth(2);
    });
    return this.entitySprites;
  }

  renderEntities(entities) {
    entities.forEach((entity, i) => {
      const c = this.cellCenter(entity.pos.x, entity.pos.y);
      this.entitySprites[i].setPosition(c.px, c.py);
    });
  }

  // --- Transitions ---
  // Move and Rotate both resolve to a set of "this entity steps from tile A to
  // tile B" pairs (§5.1/§5.3) — this is the shared engine behind both. Every
  // pair in `moves` animates at once so a multi-entity chain or ring reads as
  // one simultaneous motion rather than a sequence.
  animateEntitiesTo(moves, duration, onComplete) {
    if (moves.length === 0) {
      onComplete?.();
      return;
    }
    let remaining = moves.length;
    moves.forEach(({ index, from, to }) => {
      this.animateStep(this.entitySprites[index], from, to, duration, () => {
        remaining -= 1;
        if (remaining === 0) onComplete?.();
      });
    });
  }

  // One entity's one-cell step. Ordinarily a straight slide between the two
  // cell centers, but a wraparound step (the board loops, LEVEL_DESIGN.md
  // §2.1) lands on a tile that isn't anywhere near the source tile on screen —
  // sliding straight there would drag the sprite across the whole board. So a
  // wrapped step instead slides out through the near edge, jumps to the
  // matching point on the far edge (invisible mid-tween, alpha 0), and slides
  // in — reading as "exits here, enters there" rather than "teleports."
  animateStep(sprite, fromPos, toPos, duration, onComplete) {
    const from = this.cellCenter(fromPos.x, fromPos.y);
    const to = this.cellCenter(toPos.x, toPos.y);
    const dx = toPos.x - fromPos.x;
    const dy = toPos.y - fromPos.y;
    const wrapped = Math.abs(dx) > 1 || Math.abs(dy) > 1;

    if (!wrapped) {
      this.scene.tweens.add({
        targets: sprite,
        x: to.px,
        y: to.py,
        duration,
        ease: 'Quad.easeInOut',
        onComplete: () => onComplete?.(),
      });
      return;
    }

    const dirX = dx === 0 ? 0 : -Math.sign(dx);
    const dirY = dy === 0 ? 0 : -Math.sign(dy);
    const exitPx = from.px + dirX * CELL * 0.6;
    const exitPy = from.py + dirY * CELL * 0.6;
    const enterPx = to.px - dirX * CELL * 0.6;
    const enterPy = to.py - dirY * CELL * 0.6;

    this.scene.tweens.add({
      targets: sprite,
      x: exitPx,
      y: exitPy,
      alpha: 0,
      duration: duration * 0.4,
      ease: 'Quad.easeIn',
      onComplete: () => {
        sprite.setPosition(enterPx, enterPy);
        this.scene.tweens.add({
          targets: sprite,
          x: to.px,
          y: to.py,
          alpha: 1,
          duration: duration * 0.6,
          ease: 'Quad.easeOut',
          onComplete: () => onComplete?.(),
        });
      },
    });
  }

  // Blocked Move (LEVEL_DESIGN.md §5.1: a wall rejects the step before
  // anything moves): the character nudges toward the wall and springs back,
  // reading as bumping into it rather than the tap being silently ignored.
  animateBump(index, direction, duration, onComplete) {
    const sprite = this.entitySprites[index];
    const delta = DIRECTIONS[direction];
    const startX = sprite.x;
    const startY = sprite.y;
    this.scene.tweens.add({
      targets: sprite,
      x: startX + delta.x * CELL * 0.28,
      y: startY + delta.y * CELL * 0.28,
      duration: duration / 2,
      ease: 'Quad.easeOut',
      yoyo: true,
      onComplete: () => {
        sprite.setPosition(startX, startY);
        onComplete?.();
      },
    });
  }

  // Flip (LEVEL_DESIGN.md §5.4): every entity's sprite squashes flat along the
  // mirrored axis, swaps to its reflected tile at the flattest instant (so the
  // position jump is hidden behind zero width/height), then unsquashes — the
  // whole layer reads as one mirror pass rather than entities teleporting.
  animateFlip(moves, axis, duration, onComplete) {
    if (moves.length === 0) {
      onComplete?.();
      return;
    }
    const scaleProp = axis === 'column' ? 'scaleX' : 'scaleY';
    let remaining = moves.length;
    moves.forEach(({ to }, i) => {
      const sprite = this.entitySprites[i];
      const toCenter = this.cellCenter(to.x, to.y);
      this.scene.tweens.add({
        targets: sprite,
        [scaleProp]: 0,
        duration: duration / 2,
        ease: 'Quad.easeIn',
        onComplete: () => {
          sprite.setPosition(toCenter.px, toCenter.py);
          this.scene.tweens.add({
            targets: sprite,
            [scaleProp]: 1,
            duration: duration / 2,
            ease: 'Quad.easeOut',
            onComplete: () => {
              remaining -= 1;
              if (remaining === 0) onComplete?.();
            },
          });
        },
      });
    });
  }

  // Reaching the goal (finishAction's win check): the character grows and
  // settles back before the win overlay appears, reading as "that worked"
  // rather than the game just freezing on the spot.
  pulseEntity(index, duration, onComplete) {
    const sprite = this.entitySprites[index];
    this.scene.tweens.add({
      targets: sprite,
      scaleX: 1.35,
      scaleY: 1.35,
      duration: duration / 2,
      ease: 'Quad.easeOut',
      yoyo: true,
      onComplete: () => onComplete?.(),
    });
  }

  // --- Transient controls ---
  // Four direction arrows around the character. `onDirection` gets 'Up' |
  // 'Down' | 'Left' | 'Right'.
  showMoveArrows(pos, onDirection) {
    this.clearControls();
    const c = this.cellCenter(pos.x, pos.y);
    const offset = CELL * 0.7;
    const specs = [
      { dir: 'Up', glyph: '▲', dx: 0, dy: -offset },
      { dir: 'Down', glyph: '▼', dx: 0, dy: offset },
      { dir: 'Left', glyph: '◀', dx: -offset, dy: 0 },
      { dir: 'Right', glyph: '▶', dx: offset, dy: 0 },
    ];
    specs.forEach((s) => {
      this.addControlArrow(c.px + s.dx, c.py + s.dy, s.glyph, MOVE_ARROW, () =>
        onDirection(s.dir)
      );
    });
  }

  // Highlights the rotation center plus its 8-tile ring, and shows the two
  // rotation arrows. `onRotate` gets `true` for clockwise.
  showRotateControls(center, onRotate) {
    this.clearControls();
    const c = this.cellCenter(center.x, center.y);

    // Outline the center tile and the 8 surrounding tiles that will rotate.
    const centerHl = this.scene.add
      .rectangle(c.px, c.py, CELL, CELL, 0x000000, 0)
      .setStrokeStyle(3, COLORS.highlightHex);
    this.controls.push(centerHl);
    RING.forEach((o) => {
      const rx = wrap(center.x + o.x, this.size);
      const ry = wrap(center.y + o.y, this.size);
      const rc = this.cellCenter(rx, ry);
      const ring = this.scene.add
        .rectangle(rc.px, rc.py, CELL - 6, CELL - 6, 0x000000, 0)
        .setStrokeStyle(2, COLORS.accentHex);
      this.controls.push(ring);
    });

    // Two rotation arrows above the center (drop below if there's no room).
    let ay = c.py - CELL * 0.9;
    if (ay < BOARD_Y + CELL * 0.2) ay = c.py + CELL * 0.9;
    const specs = [
      { glyph: '↺', dx: -30, clockwise: false }, // anticlockwise
      { glyph: '↻', dx: 30, clockwise: true }, // clockwise
    ];
    specs.forEach((s) => {
      this.addControlArrow(c.px + s.dx, ay, s.glyph, ROTATE_ARROW, () =>
        onRotate(s.clockwise)
      );
    });
  }

  // Arrows around every row/column edge, pointing inward. One pair per row
  // (left edge → shift right, right edge → shift left) and one pair per
  // column (top edge → shift down, bottom edge → shift up). `onShift` gets
  // (axis, index, direction).
  showShiftArrows(onShift) {
    this.clearControls();
    for (let y = 0; y < this.size; y++) {
      const c = this.cellCenter(0, y);
      this.addControlArrow(BOARD_X - EDGE_ARROW_INSET, c.py, '▶', SHIFT_ARROW, () =>
        onShift('row', y, 'Right')
      );
      this.addControlArrow(
        BOARD_X + BOARD_PX + EDGE_ARROW_INSET,
        c.py,
        '◀',
        SHIFT_ARROW,
        () => onShift('row', y, 'Left')
      );
    }
    for (let x = 0; x < this.size; x++) {
      const c = this.cellCenter(x, 0);
      this.addControlArrow(c.px, BOARD_Y - EDGE_ARROW_INSET, '▼', SHIFT_ARROW, () =>
        onShift('column', x, 'Down')
      );
      this.addControlArrow(
        c.px,
        BOARD_Y + BOARD_PX + EDGE_ARROW_INSET,
        '▲',
        SHIFT_ARROW,
        () => onShift('column', x, 'Up')
      );
    }
  }

  // The two mirror lines and their arrows. `↔` sits above the middle column and
  // mirrors the board left-to-right; `↕` sits left of the middle row and mirrors
  // it top-to-bottom. Both outlines are drawn so the player can see the two
  // axes before committing. `onFlip` gets 'row' | 'column' — the mirror line.
  showFlipControls(onFlip) {
    this.clearControls();
    const midPx = BOARD_X + BOARD_PX / 2;
    const midPy = BOARD_Y + BOARD_PX / 2;

    // Outline the middle column and middle row (only meaningful on an odd-sized
    // board, where the mirror line runs through a line of cells rather than
    // between two of them).
    if (this.size % 2 === 1) {
      const mid = Math.floor(this.size / 2);
      const col = this.cellCenter(mid, 0);
      const row = this.cellCenter(0, mid);
      [
        this.scene.add.rectangle(col.px, midPy, CELL, BOARD_PX, 0x000000, 0),
        this.scene.add.rectangle(midPx, row.py, BOARD_PX, CELL, 0x000000, 0),
      ].forEach((hl) => {
        hl.setStrokeStyle(2, COLORS.accentHex);
        this.controls.push(hl);
      });
    }

    this.addControlArrow(midPx, BOARD_Y - EDGE_ARROW_INSET, '↔', FLIP_ARROW, () =>
      onFlip('column')
    );
    this.addControlArrow(BOARD_X - EDGE_ARROW_INSET, midPy, '↕', FLIP_ARROW, () =>
      onFlip('row')
    );
  }

  // One tappable arrow glyph, tracked so clearControls() can destroy it. The
  // pointerdown is stopped so the board's own tap handler doesn't also fire.
  addControlArrow(px, py, glyph, style, onPress) {
    const arrow = this.scene.add
      .text(px, py, glyph, {
        fontFamily: 'sans-serif',
        fontSize: style.fontSize,
        color: COLORS.text,
        backgroundColor: COLORS.accent,
        padding: style.padding,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    arrow.on('pointerdown', (pointer, lx, ly, event) => {
      if (event) event.stopPropagation();
      onPress();
    });
    this.controls.push(arrow);
    return arrow;
  }

  clearControls() {
    this.controls.forEach((a) => a.destroy());
    this.controls = [];
  }
}
