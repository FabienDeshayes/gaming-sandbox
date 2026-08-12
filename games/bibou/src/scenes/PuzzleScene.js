import {
  ACTION_LABELS,
  BOARD_X,
  CARD_COUNT_Y,
  CARD_LAYOUTS,
  CARD_Y,
  COLORS,
  GAME_HEIGHT,
  GAME_WIDTH,
  SWIPE_THRESHOLD,
} from '../config.js';
import {
  applyMoveChain,
  flipEntity,
  resolveMoveChain,
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

    // The entity layer: the character plus any crates, in render order. No two
    // entities may share a tile — Move pushes whatever's in the way — and only
    // the character can win (LEVEL_DESIGN.md §3).
    this.entities = [
      { kind: 'character', pos: { ...this.level.entities.character } },
      ...(this.level.entities.crates ?? []).map((pos) => ({
        kind: 'crate',
        pos: { ...pos },
      })),
    ];
    this.goalPos = { ...this.level.background.goal };
    this.movesUsed = 0;

    // Budgets are per action type: the keys of actionBudget with a positive
    // budget are the actions this level offers, and each one has its own pool
    // that only its own uses draw down (LEVEL_DESIGN.md §6).
    this.availableActions = Object.keys(this.level.actionBudget).filter(
      (k) => this.level.actionBudget[k] > 0
    );
    this.remaining = {};
    this.availableActions.forEach((action) => {
      this.remaining[action] = this.unlimited
        ? Infinity
        : this.level.actionBudget[action];
    });
    this.budget = this.unlimited
      ? Infinity
      : this.availableActions.reduce(
          (sum, a) => sum + this.level.actionBudget[a],
          0
        );

    this.selectedAction = null; // null | 'move' | 'rotate' | 'shift' | 'flip'
    this.targetSelected = false; // move: entity tapped; rotate: center tapped
    this.moveTarget = null; // the entity Move will displace, once tapped
    this.rotateCenter = null; // {x, y} once a rotation center is chosen
    this.gameOver = false;

    this.board = new BoardView(this, size, this.goalPos);
    this.board.drawBoard();
    this.board.createEntities(this.entities);
    this.board.renderEntities(this.entities);

    this.buildHud();
    this.buildActionCards();
    this.setupBoardInput();
  }

  // The character is the only entity the win condition cares about, and the
  // test harness reads it straight off the scene, so expose it by name.
  get characterPos() {
    return this.entities.find((e) => e.kind === 'character').pos;
  }

  get hasCrates() {
    return this.entities.some((e) => e.kind === 'crate');
  }

  // Topmost entity on a cell — the character wins ties, since it is the one the
  // player is most likely aiming for when entities share a cell.
  entityAt(cell) {
    return (
      this.entities.find(
        (e) => e.kind === 'character' && samePos(e.pos, cell)
      ) ?? this.entities.find((e) => samePos(e.pos, cell))
    );
  }

  // --- HUD ---
  buildHud() {
    this.hudText = this.add.text(BOARD_X, 160, '', {
      fontFamily: 'sans-serif',
      fontSize: '28px',
      color: COLORS.text,
    });
    this.updateHud();
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
    // Lay the available action cards out in a centered row near the bottom,
    // shrinking them as the row fills up, with each card's own remaining budget
    // printed above it.
    this.actionCards = {};
    this.cardCounts = {};
    const n = this.availableActions.length;
    const layout = CARD_LAYOUTS[n] ?? CARD_LAYOUTS[4];
    const startX = GAME_WIDTH / 2 - ((n - 1) * layout.spacing) / 2;

    this.availableActions.forEach((action, i) => {
      const x = startX + i * layout.spacing;
      this.actionCards[action] = createButton(
        this,
        x,
        CARD_Y,
        ACTION_LABELS[action],
        () => this.toggleActionCard(action),
        { fontSize: layout.fontSize, padX: layout.padX }
      );
      this.cardCounts[action] = this.add
        .text(x, CARD_COUNT_Y, '', {
          fontFamily: 'sans-serif',
          fontSize: '20px',
          color: COLORS.hint,
        })
        .setOrigin(0.5);
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

    this.updateActionCards();
  }

  // Repaint each card from its own remaining budget: a spent action greys out
  // and stops responding, while the others carry on.
  updateActionCards() {
    this.availableActions.forEach((action) => {
      const left = this.remaining[action];
      const spent = left <= 0;
      const card = this.actionCards[action];
      this.cardCounts[action].setText(
        this.unlimited ? '∞ left' : `${left} left`
      );
      this.cardCounts[action].setColor(spent ? COLORS.disabledText : COLORS.hint);
      if (spent) {
        card.setBaseColor(COLORS.disabled);
        card.setColor(COLORS.disabledText);
      } else if (this.selectedAction !== action) {
        card.setBaseColor(COLORS.button);
        card.setColor(COLORS.text);
      }
    });
  }

  actionsLeft() {
    return this.availableActions.some((a) => this.remaining[a] > 0);
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
    if (this.remaining[action] <= 0) {
      this.setHint(`No ${ACTION_LABELS[action]} actions left`);
      return;
    }
    this.clearSelection();
    this.selectedAction = action;
    this.actionCards[action].setBaseColor(COLORS.accent);
    if (action === 'move') {
      this.setHint(this.hasCrates ? 'Tap the character or a crate' : 'Tap the character');
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
    } else if (action === 'flip') {
      // Flip has no target either — it always mirrors the whole board, so the
      // only choice is which of the two mirror lines to use.
      this.targetSelected = true;
      this.board.showFlipControls((axis) => this.applyFlip(axis));
      this.setHint('Tap ↔ / ↕ or swipe to flip the board');
    }
  }

  clearSelection() {
    this.selectedAction = null;
    this.targetSelected = false;
    this.moveTarget = null;
    this.rotateCenter = null;
    this.board.clearControls();
    this.updateActionCards();
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
        } else if (this.selectedAction === 'flip') {
          // The swipe direction is the direction the board's contents travel:
          // a horizontal swipe mirrors across the middle column, a vertical one
          // across the middle row.
          this.applyFlip(Math.abs(dx) > Math.abs(dy) ? 'column' : 'row');
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
    const entity = this.entityAt(cell);

    if (!this.targetSelected) {
      if (entity) {
        this.moveTarget = entity;
        this.targetSelected = true;
        this.board.showMoveArrows(entity.pos, (dir) => this.applyMove(dir));
        this.setHint('Tap an arrow or swipe a direction');
      }
      return;
    }
    // Target already selected: tapping it again cancels, tapping a different
    // entity re-targets the move.
    if (entity === this.moveTarget) {
      this.targetSelected = false;
      this.moveTarget = null;
      this.board.clearControls();
      this.setHint(this.hasCrates ? 'Tap the character or a crate' : 'Tap the character');
    } else if (entity) {
      this.moveTarget = entity;
      this.board.showMoveArrows(entity.pos, (dir) => this.applyMove(dir));
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
  // Spend one use of `action` from its own budget and resolve the outcome
  // (win → out of actions → continue).
  finishAction(action) {
    this.movesUsed += 1;
    if (!this.unlimited) this.remaining[action] -= 1;
    this.clearSelection();
    this.board.renderEntities(this.entities);
    this.updateHud();

    if (samePos(this.characterPos, this.goalPos)) {
      this.showOverlay(true);
    } else if (!this.actionsLeft()) {
      this.showOverlay(false);
    } else {
      this.setHint('Select an action to continue');
    }
  }

  applyMove(direction) {
    if (
      this.gameOver ||
      this.selectedAction !== 'move' ||
      !this.targetSelected ||
      !this.moveTarget
    )
      return;

    // An entity in the way gets pushed first, and so on down the chain — see
    // resolveMoveChain (LEVEL_DESIGN.md §5.1). Only a blocking Background tile
    // (post-MVP wall) can make this illegal.
    const chain = resolveMoveChain(
      this.level,
      this.entities,
      this.moveTarget.pos,
      direction,
      this.size
    );
    if (!chain) {
      this.setHint('Blocked — try another direction');
      return;
    }

    applyMoveChain(this.entities, chain);
    this.finishAction('move');
  }

  // Every entity on the ring moves; entities elsewhere (and empty tiles) are
  // unaffected, but the action still costs 1.
  applyRotate(clockwise) {
    if (
      this.gameOver ||
      this.selectedAction !== 'rotate' ||
      !this.targetSelected
    )
      return;

    this.entities.forEach((e) => {
      e.pos = rotateEntity(e.pos, this.rotateCenter, clockwise, this.size);
    });
    this.finishAction('rotate');
  }

  // Rows/columns with no entity on them are unaffected, but the action still
  // costs 1, same as an empty Rotate ring.
  applyShift(axis, index, direction) {
    if (this.gameOver || this.selectedAction !== 'shift') return;

    this.entities.forEach((e) => {
      e.pos = shiftEntity(e.pos, axis, index, direction, this.size);
    });
    this.finishAction('shift');
  }

  // Flip always moves the whole entity layer, so it never has nothing to do —
  // though an entity sitting exactly on the mirror line stays put.
  applyFlip(axis) {
    if (this.gameOver || this.selectedAction !== 'flip') return;

    this.entities.forEach((e) => {
      e.pos = flipEntity(e.pos, axis, this.size);
    });
    this.finishAction('flip');
  }

  // --- Overlay ---
  showOverlay(won) {
    this.gameOver = true;
    this.clearSelection();

    this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.72)
      .setOrigin(0, 0)
      .setDepth(10);

    this.add
      .text(GAME_WIDTH / 2, 300, won ? 'You win!' : 'Out of actions', {
        fontFamily: 'sans-serif',
        fontSize: '44px',
        color: won ? COLORS.goalMark : COLORS.lose,
      })
      .setOrigin(0.5)
      .setDepth(11);

    const budgetLabel = this.unlimited ? '∞' : this.budget;
    this.add
      .text(
        GAME_WIDTH / 2,
        370,
        `Actions used: ${this.movesUsed} / ${budgetLabel}`,
        { fontFamily: 'sans-serif', fontSize: '26px', color: COLORS.text }
      )
      .setOrigin(0.5)
      .setDepth(11);

    createButton(this, GAME_WIDTH / 2, 470, 'Retry', () =>
      this.scene.restart({ level: this.level, unlimited: this.unlimited })
    ).setDepth(11);
    createButton(this, GAME_WIDTH / 2, 550, 'Level select', () =>
      this.scene.start('LevelSelectScene', { unlimited: this.unlimited })
    ).setDepth(11);
    createButton(this, GAME_WIDTH / 2, 630, 'Back to title', () =>
      this.scene.start('TitleScene')
    ).setDepth(11);
  }
}
