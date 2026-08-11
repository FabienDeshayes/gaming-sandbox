import {
  BOARD_PX,
  BOARD_X,
  BOARD_Y,
  CELL,
  COLORS,
  SHIFT_ARROW_EDGE,
} from '../config.js';
import { RING, wrap } from '../core/rules.js';

// Per-action arrow styling, kept identical to the pre-split look.
const MOVE_ARROW = { fontSize: '34px', padding: { x: 6, y: 2 } };
const ROTATE_ARROW = { fontSize: '38px', padding: { x: 8, y: 2 } };
const SHIFT_ARROW = { fontSize: '20px', padding: { x: 4, y: 2 } };

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

  createCharacter() {
    this.characterSprite = this.scene.add
      .rectangle(0, 0, CELL * 0.6, CELL * 0.6, COLORS.characterHex)
      .setStrokeStyle(3, 0xffffff);
    return this.characterSprite;
  }

  renderCharacter(pos) {
    const c = this.cellCenter(pos.x, pos.y);
    this.characterSprite.setPosition(c.px, c.py);
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
      this.addControlArrow(BOARD_X - SHIFT_ARROW_EDGE, c.py, '▶', SHIFT_ARROW, () =>
        onShift('row', y, 'Right')
      );
      this.addControlArrow(
        BOARD_X + BOARD_PX + SHIFT_ARROW_EDGE,
        c.py,
        '◀',
        SHIFT_ARROW,
        () => onShift('row', y, 'Left')
      );
    }
    for (let x = 0; x < this.size; x++) {
      const c = this.cellCenter(x, 0);
      this.addControlArrow(c.px, BOARD_Y - SHIFT_ARROW_EDGE, '▼', SHIFT_ARROW, () =>
        onShift('column', x, 'Down')
      );
      this.addControlArrow(
        c.px,
        BOARD_Y + BOARD_PX + SHIFT_ARROW_EDGE,
        '▲',
        SHIFT_ARROW,
        () => onShift('column', x, 'Up')
      );
    }
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
