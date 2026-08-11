import {
  ACTION_LABELS,
  BOARD_X,
  COLORS,
  GAME_HEIGHT,
  GAME_WIDTH,
  SWIPE_THRESHOLD,
} from '../config.js';
import {
  isBlocked,
  moveEntity,
  rotateEntity,
  samePos,
  shiftEntity,
} from '../core/rules.js';
import { BoardView } from '../ui/BoardView.js';
import { createButton } from '../ui/button.js';

// Owns the puzzle's state and the action selection flow. Board drawing and the
// transient arrows live in BoardView; the grid math lives in core/rules.js.
export class PuzzleScene extends Phaser.Scene {
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

    this.selectedAction = null; // null | 'move' | 'rotate' | 'shift'
    this.targetSelected = false; // move: character tapped; rotate: center tapped
    this.rotateCenter = null; // {x, y} once a rotation center is chosen
    this.gameOver = false;

    this.board = new BoardView(this, size, this.goalPos);
    this.board.drawBoard();
    this.board.createCharacter();
    this.board.renderCharacter(this.characterPos);

    this.buildHud();
    this.buildActionCards();
    this.setupBoardInput();
  }

  // --- HUD ---
  buildHud() {
    const budgetLabel = this.unlimited ? '∞' : this.budget;
    this.hudText = this.add.text(
      BOARD_X,
      160,
      `Actions: ${this.movesUsed} / ${budgetLabel}`,
      { fontFamily: 'sans-serif', fontSize: '28px', color: COLORS.text }
    );
    if (this.unlimited) {
      this.add
        .text(GAME_WIDTH - BOARD_X, 165, 'TEST', {
          fontFamily: 'sans-serif',
          fontSize: '22px',
          color: COLORS.highlight,
        })
        .setOrigin(1, 0);
    }
  }

  updateHud() {
    const budgetLabel = this.unlimited ? '∞' : this.budget;
    this.hudText.setText(`Actions: ${this.movesUsed} / ${budgetLabel}`);
  }

  // --- Action cards ---
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
        color: COLORS.hint,
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
    this.actionCards[action].setStyle({ backgroundColor: COLORS.accent });
    if (action === 'move') {
      this.setHint('Tap the character');
    } else if (action === 'rotate') {
      this.setHint('Tap a tile for the rotation center');
    } else if (action === 'shift') {
      // Unlike Move/Rotate, Shift has no separate target-tap step: the
      // arrows themselves (one per row/column edge) are the target.
      this.targetSelected = true;
      this.board.showShiftArrows((axis, index, dir) =>
        this.applyShift(axis, index, dir)
      );
      this.setHint('Tap an arrow to shift that row or column');
    }
  }

  clearSelection() {
    this.selectedAction = null;
    this.targetSelected = false;
    this.rotateCenter = null;
    this.board.clearControls();
    Object.values(this.actionCards).forEach((c) =>
      c.setStyle({ backgroundColor: COLORS.button })
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
      const cell = this.board.pointerToCell(pointer);
      if (!cell) return;
      this.handleBoardTap(cell);
    });
  }

  handleBoardTap(cell) {
    if (this.selectedAction === 'move') this.handleMoveTap(cell);
    else if (this.selectedAction === 'rotate') this.handleRotateTap(cell);
  }

  handleMoveTap(cell) {
    const onCharacter = samePos(cell, this.characterPos);

    if (!this.targetSelected) {
      if (onCharacter) {
        this.targetSelected = true;
        this.board.showMoveArrows(this.characterPos, (dir) =>
          this.applyMove(dir)
        );
        this.setHint('Tap an arrow or swipe a direction');
      }
      return;
    }
    // Target already selected: tapping the character again cancels.
    if (onCharacter) {
      this.targetSelected = false;
      this.board.clearControls();
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
    if (samePos(cell, this.rotateCenter)) {
      this.targetSelected = false;
      this.rotateCenter = null;
      this.board.clearControls();
      this.setHint('Tap a tile for the rotation center');
    } else {
      this.rotateCenter = { ...cell };
      this.showRotateControls();
    }
  }

  showRotateControls() {
    this.board.showRotateControls(this.rotateCenter, (clockwise) =>
      this.applyRotate(clockwise)
    );
  }

  // --- Actions ---
  // Spend an action and resolve the outcome (win → budget → continue).
  finishAction() {
    this.movesUsed += 1;
    this.clearSelection();
    this.board.renderCharacter(this.characterPos);
    this.updateHud();

    if (samePos(this.characterPos, this.goalPos)) {
      this.showOverlay(true);
    } else if (this.movesUsed >= this.budget) {
      this.showOverlay(false);
    } else {
      this.setHint('Select an action to continue');
    }
  }

  applyMove(direction) {
    if (this.gameOver || this.selectedAction !== 'move' || !this.targetSelected)
      return;

    const dest = moveEntity(this.characterPos, direction, this.size);

    // Legality: no walls in the MVP, so any destination is legal. Structured
    // this way so a blocking-tile check can be added later (LEVEL_DESIGN §5.1).
    if (isBlocked(this.level, dest)) {
      this.setHint('Blocked — try another direction');
      return;
    }

    this.characterPos = dest;
    this.finishAction();
  }

  // Only the character is an entity today, so we relocate it if it sits on the
  // ring; empty tiles rotate too, so the action is always legal and costs 1.
  applyRotate(clockwise) {
    if (
      this.gameOver ||
      this.selectedAction !== 'rotate' ||
      !this.targetSelected
    )
      return;

    this.characterPos = rotateEntity(
      this.characterPos,
      this.rotateCenter,
      clockwise,
      this.size
    );
    this.finishAction();
  }

  // Rows/columns the character isn't on are unaffected, but the action still
  // costs 1, same as an empty Rotate ring.
  applyShift(axis, index, direction) {
    if (this.gameOver || this.selectedAction !== 'shift') return;

    this.characterPos = shiftEntity(
      this.characterPos,
      axis,
      index,
      direction,
      this.size
    );
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
        color: won ? COLORS.goalMark : COLORS.lose,
      })
      .setOrigin(0.5);

    const budgetLabel = this.unlimited ? '∞' : this.budget;
    this.add
      .text(
        GAME_WIDTH / 2,
        370,
        `Actions used: ${this.movesUsed} / ${budgetLabel}`,
        { fontFamily: 'sans-serif', fontSize: '26px', color: COLORS.text }
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
