import {
  ACTION_LABELS,
  BOARD_X,
  BUMP_TWEEN_MS,
  CARD_COUNT_Y,
  CARD_LAYOUTS,
  CARD_Y,
  COLORS,
  FLIP_TWEEN_MS,
  GAME_HEIGHT,
  GAME_WIDTH,
  GOAL_PULSE_MS,
  MOVE_TWEEN_MS,
  ROTATE_TWEEN_MS,
  SWIPE_THRESHOLD,
} from '../config.js';
import {
  applyMoveChain,
  buildWallSet,
  flipEntity,
  isRotateBlocked,
  isShiftBlocked,
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
    // Walls are their own layer, keyed by tile-pair edges rather than tile
    // coordinates (LEVEL_DESIGN.md §1.2). Levels are validated at load time
    // (src/data/levels.js), so this set can be trusted here.
    this.wallSet = buildWallSet(this.level.walls);
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
    this.targetSelected = false; // move: always true once selected; rotate: center tapped
    this.rotateCenter = null; // {x, y} once a rotation center is chosen
    this.gameOver = false;
    this.animating = false; // true while a transition tween owns the entity sprites

    this.board = new BoardView(this, size, this.goalPos);
    this.board.drawBoard();
    this.board.drawWalls(this.level.walls);
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
    this.buildExitButton();
  }

  // Top-right icon button, tappable any time play isn't already blocked
  // (gameOver/animating/exitConfirmOpen) — it opens showExitConfirm rather
  // than leaving immediately, so an accidental tap doesn't drop a run.
  buildExitButton() {
    this.exitButton = this.add
      .text(GAME_WIDTH - 20, 20, '✕', {
        fontFamily: 'sans-serif',
        fontSize: '26px',
        color: COLORS.text,
        backgroundColor: COLORS.button,
        padding: { x: 10, y: 6 },
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true })
      .setDepth(5);
    this.exitButton.on('pointerover', () =>
      this.exitButton.setStyle({ backgroundColor: COLORS.buttonHover })
    );
    this.exitButton.on('pointerout', () =>
      this.exitButton.setStyle({ backgroundColor: COLORS.button })
    );
    this.exitButton.on('pointerdown', (pointer, lx, ly, event) => {
      if (event) event.stopPropagation();
      this.showExitConfirm();
    });
  }

  // In-canvas confirmation panel — mirrors showOverlay's dim-background +
  // buttons look. Exit always returns to *this* level's LevelSelectScene
  // (real vs. test, per `unlimited`), same destination as the overlay's own
  // "Level select" button.
  showExitConfirm() {
    if (this.gameOver || this.animating || this.exitConfirmOpen) return;
    this.exitConfirmOpen = true;
    this.board.clearControls();

    const panel = [];
    panel.push(
      this.add
        .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.72)
        .setOrigin(0, 0)
        .setDepth(20)
        .setInteractive()
    );
    panel.push(
      this.add
        .text(GAME_WIDTH / 2, 340, 'Exit to level select?', {
          fontFamily: 'sans-serif',
          fontSize: '34px',
          color: COLORS.text,
        })
        .setOrigin(0.5)
        .setDepth(21)
    );
    panel.push(
      createButton(this, GAME_WIDTH / 2, 430, 'Exit', () =>
        this.scene.start('LevelSelectScene', { unlimited: this.unlimited })
      ).setDepth(21)
    );
    panel.push(
      createButton(this, GAME_WIDTH / 2, 510, 'Cancel', () => {
        this.exitConfirmOpen = false;
        panel.forEach((p) => p.destroy());
      }).setDepth(21)
    );
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
    if (this.gameOver || this.animating || this.exitConfirmOpen) return;
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
      // Move only ever acts on the character (there's exactly one), so there's
      // no target-tap step — the arrows appear immediately.
      this.targetSelected = true;
      this.board.showMoveArrows(this.characterPos, (dir) => this.applyMove(dir));
      this.setHint('Tap an arrow or swipe a direction');
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
      if (this.gameOver || this.animating || this.exitConfirmOpen) return;
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
    if (this.selectedAction === 'rotate') this.handleRotateTap(cell);
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
  // (win → out of actions → continue). Called once the action's transition
  // tween has finished, so it's the entity sprites' final resting state that
  // updateHud/showOverlay follow.
  finishAction(action) {
    this.movesUsed += 1;
    if (!this.unlimited) this.remaining[action] -= 1;
    this.clearSelection();
    this.board.renderEntities(this.entities);
    this.updateHud();

    if (samePos(this.characterPos, this.goalPos)) {
      // Let the "that worked" pulse play before the overlay covers the board.
      const idx = this.entities.findIndex((e) => e.kind === 'character');
      this.animating = true;
      this.board.pulseEntity(idx, GOAL_PULSE_MS, () => {
        this.animating = false;
        this.showOverlay(true);
      });
    } else if (!this.actionsLeft()) {
      this.showOverlay(false);
    } else {
      this.setHint('Select an action to continue');
    }
  }

  applyMove(direction) {
    if (
      this.gameOver ||
      this.animating ||
      this.selectedAction !== 'move' ||
      !this.targetSelected
    )
      return;

    // An entity in the way gets pushed first, and so on down the chain — see
    // resolveMoveChain (LEVEL_DESIGN.md §5.1). Only a wall (§1.2) can make
    // this illegal.
    const chain = resolveMoveChain(
      this.wallSet,
      this.entities,
      this.characterPos,
      direction,
      this.size
    );
    if (!chain) {
      this.setHint('Blocked by a wall — try another direction');
      const idx = this.entities.findIndex((e) => e.kind === 'character');
      this.animating = true;
      this.board.animateBump(idx, direction, BUMP_TWEEN_MS, () => {
        this.animating = false;
      });
      return;
    }

    // Capture each mover's start/end tile before applyMoveChain overwrites
    // `pos`, so the transition can animate every entity in the chain at once.
    const occupants = chain
      .slice(0, -1)
      .map((p) => this.entities.find((e) => samePos(e.pos, p)));
    const moves = occupants.map((entity, i) => ({
      index: this.entities.indexOf(entity),
      from: { ...chain[i] },
      to: { ...chain[i + 1] },
    }));

    applyMoveChain(this.entities, chain);
    this.animating = true;
    this.board.clearControls();
    this.board.animateEntitiesTo(moves, MOVE_TWEEN_MS, () => {
      this.animating = false;
      this.finishAction('move');
    });
  }

  // Every entity on the ring moves; entities elsewhere (and empty tiles) are
  // unaffected, but the action still costs 1. If a wall (§1.2) would stop any
  // one entity's one-step move around the ring, the whole rotation is illegal
  // and rejected before anything moves — same rule as Move (DESIGN.md §5).
  applyRotate(clockwise) {
    if (
      this.gameOver ||
      this.animating ||
      this.selectedAction !== 'rotate' ||
      !this.targetSelected
    )
      return;

    if (
      isRotateBlocked(this.wallSet, this.entities, this.rotateCenter, clockwise, this.size)
    ) {
      this.setHint('Blocked by a wall — try the other direction');
      return;
    }

    // Every entity's destination is computed from the *original* positions
    // first so the transition (all of them at once) matches the mutation.
    const newPositions = this.entities.map((e) =>
      rotateEntity(e.pos, this.rotateCenter, clockwise, this.size)
    );
    const moves = [];
    this.entities.forEach((e, i) => {
      if (!samePos(newPositions[i], e.pos)) {
        moves.push({ index: i, from: { ...e.pos }, to: newPositions[i] });
      }
    });
    this.entities.forEach((e, i) => {
      e.pos = newPositions[i];
    });

    this.animating = true;
    this.board.clearControls();
    this.board.animateEntitiesTo(moves, ROTATE_TWEEN_MS, () => {
      this.animating = false;
      this.finishAction('rotate');
    });
  }

  // Rows/columns with no entity on them are unaffected, but the action still
  // costs 1, same as an empty Rotate ring. Same wall-rejection rule as Rotate.
  applyShift(axis, index, direction) {
    if (this.gameOver || this.animating || this.selectedAction !== 'shift') return;

    if (isShiftBlocked(this.wallSet, this.entities, axis, index, direction, this.size)) {
      this.setHint('Blocked by a wall — try another edge');
      return;
    }

    this.entities.forEach((e) => {
      e.pos = shiftEntity(e.pos, axis, index, direction, this.size);
    });
    this.finishAction('shift');
  }

  // Flip always moves the whole entity layer, so it never has nothing to do —
  // though an entity sitting exactly on the mirror line stays put. All of them
  // flip in the same synchronized pass (LEVEL_DESIGN.md §5.4), never one at a
  // time, since it's a single reflection of the whole board.
  applyFlip(axis) {
    if (this.gameOver || this.animating || this.selectedAction !== 'flip') return;

    const moves = this.entities.map((e) => ({
      from: { ...e.pos },
      to: flipEntity(e.pos, axis, this.size),
    }));
    this.entities.forEach((e, i) => {
      e.pos = moves[i].to;
    });

    this.animating = true;
    this.board.clearControls();
    this.board.animateFlip(moves, axis, FLIP_TWEEN_MS, () => {
      this.animating = false;
      this.finishAction('flip');
    });
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
