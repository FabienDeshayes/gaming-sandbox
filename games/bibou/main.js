const GAME_WIDTH = 480;
const GAME_HEIGHT = 854;

// --- Levels (see LEVEL_DESIGN.md §6/§7) --------------------------------------
const LEVEL_1 = {
  id: 1,
  gridSize: 5,
  background: { goal: { x: 3, y: 2 } },
  entities: { character: { x: 1, y: 2 } },
  actionBudget: { move: 2 },
};

// Level 2 introduces Rotate (see LEVEL_DESIGN.md §5.3/§7). Solvable with two
// rotations: char (1,2) → (2,2) via CW rotate around (2,3), then (2,2) → (2,3)
// via CW rotate around (1,3).
const LEVEL_2 = {
  id: 2,
  gridSize: 5,
  background: { goal: { x: 2, y: 3 } },
  entities: { character: { x: 1, y: 2 } },
  actionBudget: { rotate: 2 },
};

// Level 3 introduces Shift (see LEVEL_DESIGN.md §5.3/§7). Solvable with two
// shifts: char (2,3) → (3,3) via row-3 Right, then (3,3) → (3,2) via
// column-3 Up.
const LEVEL_3 = {
  id: 3,
  gridSize: 5,
  background: { goal: { x: 3, y: 2 } },
  entities: { character: { x: 2, y: 3 } },
  actionBudget: { shift: 2 },
};

const LEVELS = [LEVEL_1, LEVEL_2, LEVEL_3];

// Direction deltas, per LEVEL_DESIGN.md §5.1.
const DIRECTIONS = {
  Up: { x: 0, y: -1 },
  Down: { x: 0, y: 1 },
  Left: { x: -1, y: 0 },
  Right: { x: 1, y: 0 },
};

// The 8 tiles surrounding a rotation center, listed in CLOCKWISE order starting
// from the top-left. Rotate shifts each surrounding tile's contents one step
// along this ring (clockwise, or the reverse for anticlockwise). See
// LEVEL_DESIGN.md §5.3.
const RING = [
  { x: -1, y: -1 }, // TL (0)
  { x: 0, y: -1 }, // T  (1)
  { x: 1, y: -1 }, // TR (2)
  { x: 1, y: 0 }, // R  (3)
  { x: 1, y: 1 }, // BR (4)
  { x: 0, y: 1 }, // B  (5)
  { x: -1, y: 1 }, // BL (6)
  { x: -1, y: 0 }, // L  (7)
];

const ACTION_LABELS = { move: 'Move', rotate: 'Rotate', shift: 'Shift' };

// Distance from the board edge, in px, at which Shift's inward-pointing
// arrows are drawn (see showShiftArrows). See LEVEL_DESIGN.md §5.3.
const SHIFT_ARROW_EDGE = 20;

// --- Shared UI helper --------------------------------------------------------
// A single interactive text button, reused by every scene. `onClick` is the
// action to run on tap/click — the template left this empty, we always wire it.
function createButton(scene, x, y, label, onClick) {
  const text = scene.add
    .text(x, y, label, {
      fontFamily: 'sans-serif',
      fontSize: '32px',
      color: '#ffffff',
      backgroundColor: '#333333',
      padding: { x: 24, y: 12 },
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });

  text.on('pointerover', () => text.setStyle({ backgroundColor: '#555555' }));
  text.on('pointerout', () => text.setStyle({ backgroundColor: '#333333' }));
  text.on('pointerdown', () => onClick && onClick());
  return text;
}

// --- Title screen ------------------------------------------------------------
class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create() {
    const centerX = this.cameras.main.width / 2;

    this.add
      .text(centerX, 220, 'Bibou', {
        fontFamily: 'sans-serif',
        fontSize: '64px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    // Start and Test both lead to a level picker; Test carries the unlimited
    // flag through so any chosen level runs with an unlimited action budget.
    createButton(this, centerX, 440, 'Start', () =>
      this.scene.start('LevelSelectScene', { unlimited: false })
    );
    createButton(this, centerX, 520, 'Settings', () => {});
    createButton(this, centerX, 600, 'Test', () =>
      this.scene.start('LevelSelectScene', { unlimited: true })
    );
  }
}

// --- Level selection ---------------------------------------------------------
class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super('LevelSelectScene');
  }

  create(data) {
    const unlimited = data.unlimited === true;
    const centerX = this.cameras.main.width / 2;

    this.add
      .text(centerX, 200, unlimited ? 'Test — Select Level' : 'Select Level', {
        fontFamily: 'sans-serif',
        fontSize: unlimited ? '38px' : '44px',
        color: unlimited ? '#ffb74d' : '#ffffff',
      })
      .setOrigin(0.5);

    LEVELS.forEach((level, i) => {
      createButton(this, centerX, 320 + i * 90, `Level ${level.id}`, () =>
        this.scene.start('PuzzleScene', { level, unlimited })
      );
    });

    createButton(this, centerX, 320 + LEVELS.length * 90 + 40, 'Back', () =>
      this.scene.start('TitleScene')
    );
  }
}

// --- Puzzle -----------------------------------------------------------------
const CELL = 80;
const BOARD_PX = CELL * 5; // 400
const BOARD_X = (GAME_WIDTH - BOARD_PX) / 2; // 40
const BOARD_Y = 230;
const SWIPE_THRESHOLD = 24; // px — below this a pointer up is a tap, not a swipe

class PuzzleScene extends Phaser.Scene {
  constructor() {
    super('PuzzleScene');
  }

  create(data) {
    this.level = data.level;
    this.unlimited = data.unlimited === true;

    const size = this.level.gridSize;
    this.size = size;
    this.characterPos = { ...this.level.entities.character };
    this.goalPos = { ...this.level.background.goal };
    this.movesUsed = 0;

    // Available actions are the keys of actionBudget with a positive budget;
    // the shared action pool is their sum (each action costs 1).
    this.availableActions = Object.keys(this.level.actionBudget).filter(
      (k) => this.level.actionBudget[k] > 0
    );
    const totalBudget = Object.values(this.level.actionBudget).reduce(
      (a, b) => a + b,
      0
    );
    this.budget = this.unlimited ? Infinity : totalBudget;

    this.selectedAction = null; // null | 'move' | 'rotate'
    this.targetSelected = false; // move: character tapped; rotate: center tapped
    this.rotateCenter = null; // {x, y} once a rotation center is chosen
    this.controls = []; // transient UI (arrows, highlights)
    this.gameOver = false;

    this.drawBackground();
    this.characterSprite = this.add
      .rectangle(0, 0, CELL * 0.6, CELL * 0.6, 0x4fc3f7)
      .setStrokeStyle(3, 0xffffff);
    this.renderCharacter();

    this.buildHud();
    this.buildActionCards();
    this.setupBoardInput();
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
  drawBackground() {
    const g = this.add.graphics();
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const isGoal = x === this.goalPos.x && y === this.goalPos.y;
        g.fillStyle(isGoal ? 0x2e7d32 : 0x222222, 1);
        g.fillRect(BOARD_X + x * CELL, BOARD_Y + y * CELL, CELL, CELL);
        g.lineStyle(2, 0x444444, 1);
        g.strokeRect(BOARD_X + x * CELL, BOARD_Y + y * CELL, CELL, CELL);
      }
    }
    // Goal marker on top of the goal cell so it reads as the target.
    const goal = this.cellCenter(this.goalPos.x, this.goalPos.y);
    this.add
      .text(goal.px, goal.py, '★', {
        fontFamily: 'sans-serif',
        fontSize: '40px',
        color: '#a5d6a7',
      })
      .setOrigin(0.5);
  }

  renderCharacter() {
    const c = this.cellCenter(this.characterPos.x, this.characterPos.y);
    this.characterSprite.setPosition(c.px, c.py);
  }

  buildHud() {
    const budgetLabel = this.unlimited ? '∞' : this.budget;
    this.hudText = this.add.text(
      BOARD_X,
      160,
      `Actions: ${this.movesUsed} / ${budgetLabel}`,
      { fontFamily: 'sans-serif', fontSize: '28px', color: '#ffffff' }
    );
    if (this.unlimited) {
      this.add
        .text(GAME_WIDTH - BOARD_X, 165, 'TEST', {
          fontFamily: 'sans-serif',
          fontSize: '22px',
          color: '#ffb74d',
        })
        .setOrigin(1, 0);
    }
  }

  updateHud() {
    const budgetLabel = this.unlimited ? '∞' : this.budget;
    this.hudText.setText(`Actions: ${this.movesUsed} / ${budgetLabel}`);
  }

  buildActionCards() {
    // Lay the available action cards out in a centered row near the bottom.
    this.actionCards = {};
    const n = this.availableActions.length;
    const spacing = 170;
    const startX = GAME_WIDTH / 2 - ((n - 1) * spacing) / 2;
    this.availableActions.forEach((action, i) => {
      this.actionCards[action] = createButton(
        this,
        startX + i * spacing,
        720,
        ACTION_LABELS[action],
        () => this.toggleActionCard(action)
      );
    });

    this.beginHint =
      n === 1
        ? `Tap ${ACTION_LABELS[this.availableActions[0]]} to begin`
        : 'Select an action to begin';
    this.hintText = this.add
      .text(GAME_WIDTH / 2, 790, this.beginHint, {
        fontFamily: 'sans-serif',
        fontSize: '20px',
        color: '#aaaaaa',
      })
      .setOrigin(0.5);
  }

  setHint(msg) {
    this.hintText.setText(msg);
  }

  toggleActionCard(action) {
    if (this.gameOver) return;
    if (this.selectedAction === action) {
      this.clearSelection();
      this.setHint(this.beginHint);
      return;
    }
    this.clearSelection();
    this.selectedAction = action;
    this.actionCards[action].setStyle({ backgroundColor: '#1565c0' });
    if (action === 'move') {
      this.setHint('Tap the character');
    } else if (action === 'rotate') {
      this.setHint('Tap a tile for the rotation center');
    } else if (action === 'shift') {
      // Unlike Move/Rotate, Shift has no separate target-tap step: the
      // arrows themselves (one per row/column edge) are the target.
      this.targetSelected = true;
      this.showShiftArrows();
      this.setHint('Tap an arrow to shift that row or column');
    }
  }

  clearSelection() {
    this.selectedAction = null;
    this.targetSelected = false;
    this.rotateCenter = null;
    this.clearControls();
    Object.values(this.actionCards).forEach((c) =>
      c.setStyle({ backgroundColor: '#333333' })
    );
  }

  // --- Input ---
  setupBoardInput() {
    let downX = 0;
    let downY = 0;
    this.input.on('pointerdown', (pointer) => {
      downX = pointer.x;
      downY = pointer.y;
    });
    this.input.on('pointerup', (pointer) => {
      if (this.gameOver) return;
      const dx = pointer.x - downX;
      const dy = pointer.y - downY;
      const dist = Math.hypot(dx, dy);

      // Swipe: only meaningful once a target is selected.
      if (this.targetSelected && dist >= SWIPE_THRESHOLD) {
        if (this.selectedAction === 'move') {
          const dir =
            Math.abs(dx) > Math.abs(dy)
              ? dx > 0
                ? 'Right'
                : 'Left'
              : dy > 0
              ? 'Down'
              : 'Up';
          this.applyMove(dir);
        } else if (this.selectedAction === 'rotate') {
          // Right = clockwise, left = anticlockwise; vertical swipes are ignored.
          if (Math.abs(dx) > Math.abs(dy)) this.applyRotate(dx > 0);
        }
        return;
      }

      // Tap on the board.
      const cell = this.pointerToCell(pointer);
      if (!cell) return;
      this.handleBoardTap(cell);
    });
  }

  handleBoardTap(cell) {
    if (this.selectedAction === 'move') this.handleMoveTap(cell);
    else if (this.selectedAction === 'rotate') this.handleRotateTap(cell);
  }

  handleMoveTap(cell) {
    const onCharacter =
      cell.x === this.characterPos.x && cell.y === this.characterPos.y;

    if (!this.targetSelected) {
      if (onCharacter) {
        this.targetSelected = true;
        this.showArrows();
        this.setHint('Tap an arrow or swipe a direction');
      }
      return;
    }
    // Target already selected: tapping the character again cancels.
    if (onCharacter) {
      this.targetSelected = false;
      this.clearControls();
      this.setHint('Tap the character');
    }
  }

  handleRotateTap(cell) {
    if (!this.targetSelected) {
      this.rotateCenter = { ...cell };
      this.targetSelected = true;
      this.showRotateControls();
      this.setHint('Tap ↺ / ↻ or swipe left (CCW) / right (CW)');
      return;
    }
    // Center already chosen: tapping it again cancels, tapping elsewhere
    // re-centers the rotation on the new tile.
    if (cell.x === this.rotateCenter.x && cell.y === this.rotateCenter.y) {
      this.targetSelected = false;
      this.rotateCenter = null;
      this.clearControls();
      this.setHint('Tap a tile for the rotation center');
    } else {
      this.rotateCenter = { ...cell };
      this.showRotateControls();
    }
  }

  showArrows() {
    this.clearControls();
    const c = this.cellCenter(this.characterPos.x, this.characterPos.y);
    const offset = CELL * 0.7;
    const specs = [
      { dir: 'Up', glyph: '▲', dx: 0, dy: -offset },
      { dir: 'Down', glyph: '▼', dx: 0, dy: offset },
      { dir: 'Left', glyph: '◀', dx: -offset, dy: 0 },
      { dir: 'Right', glyph: '▶', dx: offset, dy: 0 },
    ];
    specs.forEach((s) => {
      const arrow = this.add
        .text(c.px + s.dx, c.py + s.dy, s.glyph, {
          fontFamily: 'sans-serif',
          fontSize: '34px',
          color: '#ffffff',
          backgroundColor: '#1565c0',
          padding: { x: 6, y: 2 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      arrow.on('pointerdown', (pointer, lx, ly, event) => {
        if (event) event.stopPropagation();
        this.applyMove(s.dir);
      });
      this.controls.push(arrow);
    });
  }

  showRotateControls() {
    this.clearControls();
    const c = this.cellCenter(this.rotateCenter.x, this.rotateCenter.y);

    // Outline the center tile and the 8 surrounding tiles that will rotate.
    const centerHl = this.add
      .rectangle(c.px, c.py, CELL, CELL, 0x000000, 0)
      .setStrokeStyle(3, 0xffb74d);
    this.controls.push(centerHl);
    RING.forEach((o) => {
      const rx = this.wrap(this.rotateCenter.x + o.x);
      const ry = this.wrap(this.rotateCenter.y + o.y);
      const rc = this.cellCenter(rx, ry);
      const ring = this.add
        .rectangle(rc.px, rc.py, CELL - 6, CELL - 6, 0x000000, 0)
        .setStrokeStyle(2, 0x1565c0);
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
      const arrow = this.add
        .text(c.px + s.dx, ay, s.glyph, {
          fontFamily: 'sans-serif',
          fontSize: '38px',
          color: '#ffffff',
          backgroundColor: '#1565c0',
          padding: { x: 8, y: 2 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      arrow.on('pointerdown', (pointer, lx, ly, event) => {
        if (event) event.stopPropagation();
        this.applyRotate(s.clockwise);
      });
      this.controls.push(arrow);
    });
  }

  // Arrows around every row/column edge, pointing inward. One pair per row
  // (left edge → shift right, right edge → shift left) and one pair per
  // column (top edge → shift down, bottom edge → shift up).
  showShiftArrows() {
    this.clearControls();
    for (let y = 0; y < this.size; y++) {
      const c = this.cellCenter(0, y);
      this.addShiftArrow(BOARD_X - SHIFT_ARROW_EDGE, c.py, '▶', () =>
        this.applyShift('row', y, 'Right')
      );
      this.addShiftArrow(BOARD_X + BOARD_PX + SHIFT_ARROW_EDGE, c.py, '◀', () =>
        this.applyShift('row', y, 'Left')
      );
    }
    for (let x = 0; x < this.size; x++) {
      const c = this.cellCenter(x, 0);
      this.addShiftArrow(c.px, BOARD_Y - SHIFT_ARROW_EDGE, '▼', () =>
        this.applyShift('column', x, 'Down')
      );
      this.addShiftArrow(c.px, BOARD_Y + BOARD_PX + SHIFT_ARROW_EDGE, '▲', () =>
        this.applyShift('column', x, 'Up')
      );
    }
  }

  addShiftArrow(px, py, glyph, onPress) {
    const arrow = this.add
      .text(px, py, glyph, {
        fontFamily: 'sans-serif',
        fontSize: '20px',
        color: '#ffffff',
        backgroundColor: '#1565c0',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    arrow.on('pointerdown', (pointer, lx, ly, event) => {
      if (event) event.stopPropagation();
      onPress();
    });
    this.controls.push(arrow);
  }

  clearControls() {
    this.controls.forEach((a) => a.destroy());
    this.controls = [];
  }

  // --- Shared helpers ---
  wrap(value) {
    const n = this.size;
    return ((value % n) + n) % n;
  }

  isBlocked() {
    // No blocking background tiles yet (walls are post-MVP).
    return false;
  }

  // Spend an action and resolve the outcome (win → budget → continue).
  finishAction() {
    this.movesUsed += 1;
    this.clearSelection();
    this.renderCharacter();
    this.updateHud();

    if (
      this.characterPos.x === this.goalPos.x &&
      this.characterPos.y === this.goalPos.y
    ) {
      this.showOverlay(true);
    } else if (this.movesUsed >= this.budget) {
      this.showOverlay(false);
    } else {
      this.setHint('Select an action to continue');
    }
  }

  // --- Move logic ---
  applyMove(direction) {
    if (this.gameOver || this.selectedAction !== 'move' || !this.targetSelected)
      return;

    const delta = DIRECTIONS[direction];
    const dest = {
      x: this.wrap(this.characterPos.x + delta.x),
      y: this.wrap(this.characterPos.y + delta.y),
    };

    // Legality: no walls in the MVP, so any destination is legal. Structured
    // this way so a blocking-tile check can be added later (LEVEL_DESIGN §5.1).
    if (this.isBlocked(dest)) {
      this.setHint('Blocked — try another direction');
      return;
    }

    this.characterPos = dest;
    this.finishAction();
  }

  // --- Rotate logic ---
  // Rotates the 8 tiles around `rotateCenter` one step along the ring. Only the
  // character is an entity today, so we relocate it if it sits on the ring;
  // empty tiles rotate too, so the action is always legal and costs 1.
  applyRotate(clockwise) {
    if (
      this.gameOver ||
      this.selectedAction !== 'rotate' ||
      !this.targetSelected
    )
      return;

    const center = this.rotateCenter;
    let idx = -1;
    for (let i = 0; i < RING.length; i++) {
      const rx = this.wrap(center.x + RING[i].x);
      const ry = this.wrap(center.y + RING[i].y);
      if (rx === this.characterPos.x && ry === this.characterPos.y) {
        idx = i;
        break;
      }
    }

    if (idx !== -1) {
      const n = RING.length;
      const next = clockwise ? (idx + 1) % n : (idx - 1 + n) % n;
      this.characterPos = {
        x: this.wrap(center.x + RING[next].x),
        y: this.wrap(center.y + RING[next].y),
      };
    }

    this.finishAction();
  }

  // --- Shift logic ---
  // Shifts every entity on row `index` (axis 'row') or column `index` (axis
  // 'column') one cell in `direction`, with wraparound. Only the character is
  // an entity today; rows/columns it isn't on are unaffected but the action
  // still costs 1, same as an empty Rotate ring.
  applyShift(axis, index, direction) {
    if (this.gameOver || this.selectedAction !== 'shift') return;

    const delta = DIRECTIONS[direction];
    if (axis === 'row' && this.characterPos.y === index) {
      this.characterPos = {
        x: this.wrap(this.characterPos.x + delta.x),
        y: this.characterPos.y,
      };
    } else if (axis === 'column' && this.characterPos.x === index) {
      this.characterPos = {
        x: this.characterPos.x,
        y: this.wrap(this.characterPos.y + delta.y),
      };
    }

    this.finishAction();
  }

  // --- Overlay ---
  showOverlay(won) {
    this.gameOver = true;
    this.clearSelection();

    this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.72)
      .setOrigin(0, 0);

    this.add
      .text(GAME_WIDTH / 2, 300, won ? 'You win!' : 'Out of actions', {
        fontFamily: 'sans-serif',
        fontSize: '44px',
        color: won ? '#a5d6a7' : '#ef9a9a',
      })
      .setOrigin(0.5);

    const budgetLabel = this.unlimited ? '∞' : this.budget;
    this.add
      .text(
        GAME_WIDTH / 2,
        370,
        `Actions used: ${this.movesUsed} / ${budgetLabel}`,
        { fontFamily: 'sans-serif', fontSize: '26px', color: '#ffffff' }
      )
      .setOrigin(0.5);

    createButton(this, GAME_WIDTH / 2, 470, 'Retry', () =>
      this.scene.restart({ level: this.level, unlimited: this.unlimited })
    );
    createButton(this, GAME_WIDTH / 2, 550, 'Level select', () =>
      this.scene.start('LevelSelectScene', { unlimited: this.unlimited })
    );
    createButton(this, GAME_WIDTH / 2, 630, 'Back to title', () =>
      this.scene.start('TitleScene')
    );
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#111111',
  // Keep the fixed 480x854 design space, but scale the canvas to fit the
  // screen (preserving aspect ratio) and center it, so it never crops on
  // narrower phone viewports.
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  scene: [TitleScene, LevelSelectScene, PuzzleScene],
});
