import {
  ACTION_LABELS,
  BOARD_PX,
  BOARD_X,
  BUMP_TWEEN_MS,
  CARD_COUNT_Y,
  CARD_LAYOUTS,
  CARD_Y,
  COLLECTIBLE_LABELS,
  COLORS,
  CRATE_TEXTURE_KEY,
  CRATE_TEXTURE_PATH,
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
  resolveCycleOutcome,
  resolveMoveChain,
  rotationOrder,
  samePos,
  shiftOrder,
} from '../core/rules.js';
import { LEVELS } from '../data/levels.js';
import { BoardView } from '../ui/BoardView.js';
import { createActionCard } from '../ui/actionCard.js';
import { createButton } from '../ui/button.js';

// Owns the puzzle's state and the action selection flow. Board drawing and the
// transient arrows live in BoardView; the grid math lives in core/rules.js.
export class PuzzleScene extends Phaser.Scene {
  constructor() {
    super('PuzzleScene');
  }

  preload() {
    this.load.image(CRATE_TEXTURE_KEY, CRATE_TEXTURE_PATH);
  }

  create(data) {
    // Pixel-art crate texture: keep its small source pixels crisp when
    // scaled up instead of letting the renderer blur them.
    this.textures.get(CRATE_TEXTURE_KEY).setFilter(Phaser.Textures.FilterMode.NEAREST);

    this.level = data.level;
    this.unlimited = data.unlimited === true;

    const size = this.level.gridSize;
    this.size = size;

    // The entity layer: character, crates, and collectibles, in render order.
    // No two entities may share a tile. Move/Shift/Rotate push whatever's in
    // the way — except a collectible, which is an indestructible obstacle
    // that never blocks the character (it's picked up instead) and can crush
    // a crate that gets pushed into it and can't move it out of the way; see
    // LEVEL_DESIGN.md §3/§5.5. Only the character can win.
    this.entities = [
      { kind: 'character', pos: { ...this.level.entities.character } },
      ...(this.level.entities.crates ?? []).map((pos) => ({
        kind: 'crate',
        pos: { ...pos },
      })),
      ...(this.level.entities.collectibles ?? []).map((c) => ({
        kind: 'collectible',
        type: c.type,
        required: c.required === true,
        pos: { x: c.x, y: c.y },
      })),
    ];
    // `requiredTypes` is fixed at level load (not re-derived from `entities`,
    // which loses collected collectibles as they're picked up) so the
    // objective text can still report "reach the goal" once every required
    // type has been collected.
    this.requiredTypes = [
      ...new Set(
        this.entities.filter((e) => e.kind === 'collectible' && e.required).map((e) => e.type)
      ),
    ];
    this.collectedTypes = new Set();

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
    // Phaser reuses one Scene instance across scene.start, so every flag that
    // gate-keeps input has to be reset here, not just where it's set. Exiting
    // from the confirm panel leaves this true, and a stale `true` would make
    // the *next* run of this scene silently ignore every tap.
    this.exitConfirmOpen = false;

    this.board = new BoardView(this, size, this.goalPos);
    this.board.drawBoard(this.requiredTypes.length > 0);
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
    // Only shown when the level has at least one `required` collectible —
    // levels without one (e.g. Levels 1-8) keep the plain HUD.
    if (this.requiredTypes.length > 0) {
      this.objectiveText = this.add.text(BOARD_X, 195, '', {
        fontFamily: 'sans-serif',
        fontSize: '18px',
        color: COLORS.objective,
        wordWrap: { width: BOARD_PX },
      });
      this.updateObjective();
    }
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

  // --- Collectibles & destruction (LEVEL_DESIGN.md §3/§5.5) ---
  // Removes a crushed crate from the board with a "crushed" flourish, then
  // calls `onComplete`. `dest` is the tile the crate was crushed trying (and
  // failing) to reach — the crushed flourish nudges toward it first, reading
  // as "it tried to push through," before it explodes. Used whenever
  // Move/Shift/Rotate resolves a crate as destroyed instead of moved.
  destroyEntity(entity, dest, onComplete) {
    const index = this.entities.indexOf(entity);
    this.board.destroyEntitySprite(index, entity.pos, dest, () => {
      this.entities.splice(index, 1);
      this.board.removeEntitySpriteAt(index);
      onComplete?.();
    });
  }

  // Removes a picked-up collectible from the board with a "collected"
  // flourish, records its type, and refreshes the objective/goal-lock state.
  collectEntity(collectible, onComplete) {
    const index = this.entities.indexOf(collectible);
    this.collectedTypes.add(collectible.type);
    this.board.collectEntitySprite(index, () => {
      this.entities.splice(index, 1);
      this.board.removeEntitySpriteAt(index);
      this.updateObjective();
      onComplete?.();
    });
  }

  requirementsMet() {
    return this.requiredTypes.every((t) => this.collectedTypes.has(t));
  }

  // Refreshes the objective line and the goal's locked/unlocked marker from
  // which required collectibles are still outstanding.
  updateObjective() {
    if (!this.objectiveText) return;
    const remaining = this.requiredTypes.filter((t) => !this.collectedTypes.has(t));
    this.objectiveText.setText(
      remaining.length > 0
        ? `Objective: find the ${remaining
            .map((t) => COLLECTIBLE_LABELS[t] ?? t)
            .join(', ')} to unlock the goal`
        : 'Objective: reach the goal'
    );
    this.board.setGoalLocked(remaining.length > 0);
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
      this.actionCards[action] = createActionCard(
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
        card.setBaseColor(COLORS.cardBorderDisabledHex);
        card.setColor(COLORS.disabledText);
      } else if (this.selectedAction !== action) {
        card.setBaseColor(COLORS.cardBorderHex);
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
    this.actionCards[action].setBaseColor(COLORS.accentHex);
    if (action === 'move') {
      // Move only ever acts on the character (there's exactly one), so there's
      // no target-tap step — the arrows appear immediately.
      this.targetSelected = true;
      this.board.showMoveArrows(this.characterPos, (dir) => this.applyMove(dir));
      this.setHint('Tap an arrow or swipe a direction');
    } else if (action === 'rotate') {
      this.board.showRotateCenterHints();
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
      this.board.showRotateCenterHints();
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

    const onGoal = samePos(this.characterPos, this.goalPos);
    if (onGoal && this.requirementsMet()) {
      // Let the "that worked" pulse play before the overlay covers the board.
      const idx = this.entities.findIndex((e) => e.kind === 'character');
      this.animating = true;
      this.board.pulseEntity(idx, GOAL_PULSE_MS, () => {
        this.animating = false;
        this.showOverlay(true);
      });
    } else if (!this.actionsLeft()) {
      this.showOverlay(false);
    } else if (onGoal) {
      // On the goal tile but a required collectible is still outstanding
      // (LEVEL_DESIGN.md §4) — the goal marker itself already reads 🔒.
      const missing = this.requiredTypes
        .filter((t) => !this.collectedTypes.has(t))
        .map((t) => COLLECTIBLE_LABELS[t] ?? t);
      this.setHint(`Get the ${missing.join(', ')} first`);
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
    // resolveMoveChain (LEVEL_DESIGN.md §5.1/§5.5).
    const result = resolveMoveChain(
      this.wallSet,
      this.entities,
      this.characterPos,
      direction,
      this.size
    );

    if (result.kind === 'illegal') {
      this.setHint('Blocked by a wall — try another direction');
      const idx = this.entities.findIndex((e) => e.kind === 'character');
      this.animating = true;
      this.board.animateBump(idx, direction, BUMP_TWEEN_MS, () => {
        this.animating = false;
      });
      return;
    }

    if (result.kind === 'destroy') {
      // The character itself doesn't move (§5.5: nothing behind a crushed
      // crate advances) — only the crate is removed.
      this.animating = true;
      this.board.clearControls();
      this.destroyEntity(result.victim, result.dest, () => {
        this.animating = false;
        this.finishAction('move');
      });
      return;
    }

    if (result.kind === 'pickup') {
      // The character's own next step is a collectible: it's always
      // collected rather than pushed, and the character does advance onto
      // that tile (this is the pre-existing pickup rule, unaffected by
      // §5.5's "nothing advances after a destruction").
      const character = this.entities.find((e) => e.kind === 'character');
      const move = {
        index: this.entities.indexOf(character),
        from: { ...character.pos },
        to: { ...result.path[1] },
      };
      character.pos = { ...result.path[1] };

      this.animating = true;
      this.board.clearControls();
      let pending = 2;
      const finishOnce = () => {
        pending -= 1;
        if (pending === 0) {
          this.animating = false;
          this.finishAction('move');
        }
      };
      this.board.animateEntitiesTo([move], MOVE_TWEEN_MS, finishOnce);
      this.collectEntity(result.collectible, finishOnce);
      return;
    }

    // 'open' or 'loop': the ordinary successful push chain.
    const chain = result.path;
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
  // unaffected, but the action still costs 1. If a wall (§1.2) stops an
  // entity's one-step move around the ring, that entity (and anything queued
  // behind it) is resolved via resolveCycleOutcome (§5.5): a crate crushed
  // against the wall or against something else that can't move is destroyed,
  // the character always collects a collectible it's forced into, and if
  // nothing on the ring can be sacrificed the whole rotation is illegal.
  applyRotate(clockwise) {
    if (
      this.gameOver ||
      this.animating ||
      this.selectedAction !== 'rotate' ||
      !this.targetSelected
    )
      return;

    const order = rotationOrder(this.rotateCenter, clockwise, this.size);
    const outcomes = resolveCycleOutcome(this.wallSet, this.entities, order);
    this.resolveCycleAction(outcomes, 'rotate', ROTATE_TWEEN_MS, 'Blocked by a wall — try the other direction');
  }

  // Rows/columns with no entity on them are unaffected, but the action still
  // costs 1, same as an empty Rotate ring. Same wall/destruction rules as
  // Rotate (§5.5), just around a row/column instead of a ring.
  applyShift(axis, index, direction) {
    if (this.gameOver || this.animating || this.selectedAction !== 'shift') return;

    const order = shiftOrder(axis, index, direction, this.size);
    const outcomes = resolveCycleOutcome(this.wallSet, this.entities, order);
    this.resolveCycleAction(outcomes, 'shift', 0, 'Blocked by a wall — try another edge');
  }

  // Shared resolution for Shift and Rotate (LEVEL_DESIGN.md §5.5): applies
  // every `move`/`pickup`/`destroy` outcome from resolveCycleOutcome, waits
  // for all of their animations, then spends the action. An all-`stay`
  // result (nothing moved, nothing could be sacrificed) is illegal and free;
  // an empty result (nothing on the ring/line) is a legal no-op that still
  // costs the action, matching Rotate/Shift's existing empty-target rule.
  // `moveDuration: 0` skips the tween for normal moves (Shift snaps today).
  resolveCycleAction(outcomes, action, moveDuration, blockedHint) {
    if (outcomes.length === 0) {
      this.finishAction(action);
      return;
    }
    if (outcomes.every((o) => o.outcome === 'stay')) {
      this.setHint(blockedHint);
      return;
    }

    const moveOutcomes = outcomes.filter((o) => o.outcome === 'move');
    const destroyOutcomes = outcomes.filter((o) => o.outcome === 'destroy');
    const pickupOutcomes = outcomes.filter((o) => o.outcome === 'pickup');

    const moves = moveOutcomes.map((o) => ({
      index: this.entities.indexOf(o.entity),
      from: { ...o.entity.pos },
      to: { ...o.dest },
    }));
    // Ordinarily the character is the one who advances onto the collectible's
    // tile. When `characterStays` is set (rules.js: the collectible was queued
    // behind a character already stuck at the wall), it's the reverse — the
    // character doesn't move, so the collectible is reported as sliding onto
    // *its* tile instead, purely for the animation; either way the character
    // ends up holding the collectible.
    pickupOutcomes.forEach((o) => {
      const [mover, dest] = o.characterStays
        ? [o.collectible, o.entity.pos]
        : [o.entity, o.collectible.pos];
      moves.push({
        index: this.entities.indexOf(mover),
        from: { ...mover.pos },
        to: { ...dest },
      });
    });

    moveOutcomes.forEach((o) => {
      o.entity.pos = { ...o.dest };
    });
    pickupOutcomes.forEach((o) => {
      if (o.characterStays) {
        o.collectible.pos = { ...o.entity.pos };
      } else {
        o.entity.pos = { ...o.collectible.pos };
      }
    });

    this.animating = true;
    this.board.clearControls();

    let pending = 1;
    const finishOnce = () => {
      pending -= 1;
      if (pending === 0) {
        this.animating = false;
        this.finishAction(action);
      }
    };

    destroyOutcomes.forEach((o) => {
      pending += 1;
      this.destroyEntity(o.entity, o.dest, finishOnce);
    });
    pickupOutcomes.forEach((o) => {
      pending += 1;
      this.collectEntity(o.collectible, finishOnce);
    });

    if (moveDuration > 0) {
      this.board.animateEntitiesTo(moves, moveDuration, finishOnce);
    } else {
      this.board.renderEntities(this.entities);
      finishOnce();
    }
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

    // Offer to continue straight into the next level, but only when there is
    // one — the last level in LEVELS gets the ordinary three buttons.
    const nextLevel = won
      ? LEVELS[LEVELS.findIndex((l) => l.id === this.level.id) + 1]
      : undefined;

    let y = 470;
    if (nextLevel) {
      createButton(this, GAME_WIDTH / 2, y, 'Next level', () =>
        this.scene.restart({ level: nextLevel, unlimited: this.unlimited })
      ).setDepth(11);
      y += 80;
    }
    createButton(this, GAME_WIDTH / 2, y, 'Retry', () =>
      this.scene.restart({ level: this.level, unlimited: this.unlimited })
    ).setDepth(11);
    y += 80;
    createButton(this, GAME_WIDTH / 2, y, 'Level select', () =>
      this.scene.start('LevelSelectScene', { unlimited: this.unlimited })
    ).setDepth(11);
    y += 80;
    createButton(this, GAME_WIDTH / 2, y, 'Back to title', () =>
      this.scene.start('TitleScene')
    ).setDepth(11);
  }
}
