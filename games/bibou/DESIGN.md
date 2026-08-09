# Bibou

> Mini puzzle game about moving tiles on a grid to reach a goal state.

## 1. One-liner

A turn-based grid puzzle game where you rearrange tiles to guide a character to their goal.

## 2. Pitch

Bibou is a minimal, turn-based puzzle game on a small grid where you use tile-moving actions to get a character from their starting position to a goal (treasure chest, exit door, etc.). Each turn gives you time to think through your moves. The puzzle evolves as you discover how tiles interact and what sequences of moves lead to victory.

## 3. Core loops

1. Player observes the current grid state and counts remaining action budget
2. Player selects an action: swap adjacent tiles, rotate a 2×2 square, or shift a row/column
3. Game applies the action and updates the grid (action budget decreases by 1)
4. Player checks if goal is reached; if yes, victory; if no and actions remain, loop to step 1
5. If actions exhausted and goal not reached: retry puzzle from start

## 4. Core mechanics

| Mechanic | Description | Input |
|---|---|---|
| Swap | Swap two adjacent tiles (horizontal or vertical) | Select first tile, select adjacent tile |
| Rotate | Rotate four tiles in a 2×2 square 90° clockwise | Select center of 2×2 area, confirm rotation |
| Shift | Shift an entire row or column one tile in a direction | Select row/column, select direction |
| Character positioning | A character occupies a tile; affected by all tile actions | Implicit (character moves with its tile) |
| Goal detection | Win condition triggered when character's tile reaches goal | Automatic check after each action |
| Action budget | Limited number of actions per puzzle (exact number TBD per puzzle) | Displayed UI counter |

## 5. Constraints

- Grid size: 5×5 (or similar small, digestible size)
- Limited action budget per puzzle (exact count varies by puzzle design)
- Turn-based only (no real-time pressure)
- Three action types only in MVP: swap, rotate, shift
- No build tooling: Phaser 3 loaded via CDN `<script>` tag, plain JS
- Portrait/mobile aspect ratio (~9:16)

## 6. Win / lose conditions

- **Win:** Character reaches the goal tile within the action budget
- **Lose:** Action budget exhausted before character reaches goal → retry puzzle from start
- **Session end:** Player completes a puzzle (win) or gives up; victory screen shows action count used vs. budget and offers next puzzle

## 7. Controls

| Action | Input (keyboard) | Input (touch/gamepad) |
|---|---|---|
| Select tile/area | Click tile | Tap tile |
| Swap adjacent tiles | Select first tile, then adjacent tile + confirm | Tap first tile, tap adjacent, confirm |
| Rotate 2×2 square | Select 2×2 area center, press R | Select center, tap rotate button |
| Shift row/column | Select row/column, press direction key | Select row/column, tap direction |
| Undo last action | Press U or Ctrl+Z | Undo button (if MVP supports) |

## 8. Scope — MVP vs. cut

**MVP (must have to test if the core loop is fun):**
- 5×5 grid rendering with tiles and visual identification
- One character tile, one goal tile
- Three action types: swap adjacent, rotate 2×2, shift row/column
- Action budget counter (e.g., "5 / 8 actions used")
- Win detection (character on goal)
- Lose detection (budget exhausted, no win)
- One hand-crafted puzzle that requires all three action types to solve
- Retry button when puzzle is lost or won

**Nice to have (only after MVP works):**
- Undo / redo system
- Multiple puzzle levels with progressive difficulty
- Puzzle selector / level menu
- Visual tile types (solid blocks, obstacles, springs, etc.) with special behaviors
- Character/goal animations
- Tutorial or hints system

**Explicitly out of scope:**
- Sound effects or music
- Complex narrative or story
- Leaderboards or scoring
- Mobile app (web-only for now)

## 9. Art & audio style

- **Visual style:** Flat colors, minimalist; each tile is a simple colored square or icon
- **Reference images/games:** Sokoban (puzzle focus), Puzzle & Dragons (grid + turn-based), Threes (tile sliding)
- **Audio:** None for prototype; can revisit after core loop works

## 10. Theme

Mechanics-first prototype. "Bibou" could be a character name (the one you're moving), or just a working title. No narrative required yet — the puzzle is the game.

## 11. Tech notes

- **Platform:** Web (2D)
- **Engine/library:** Phaser 3, via CDN
- **Screen size / aspect ratio:** 480x854 (portrait, ~9:16), fixed size
- **Grid rendering:** Canvas or Phaser Graphics API (simple rects + text)
- **Key technical risks:** Tile movement input/state (ensuring clean tile-by-tile motion, not continuous)
