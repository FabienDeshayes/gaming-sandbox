# Bibou

> Mini puzzle game about moving tiles on a grid to reach a goal state.

## 1. One-liner

A turn-based grid puzzle game where you rearrange tiles to guide a character to their goal.

## 2. Pitch

Bibou is a minimal, turn-based puzzle game on a small grid where you use tile-moving actions to get a character from their starting position to a goal (treasure chest, exit door, etc.). Each turn gives you time to think through your moves. The puzzle evolves as you discover how tiles interact and what sequences of moves lead to victory.

## 3. Core loops

1. Player observes the grid: the static Board layer (walls, goal tile) and the Entity layer (character position), plus remaining action budget
2. Player taps an action card at the bottom of the screen (Move / Rotate / Shift) to select it
3. Player taps the target tile(s) or entity the action applies to, then confirms with another tap
4. Game applies the action to the Entity layer and decreases the action budget by 1
5. Player checks if the character has reached the goal tile; if yes, victory; if no and actions remain, loop to step 1
6. If actions are exhausted and the goal isn't reached: retry puzzle from start

## 4. Core mechanics

The grid has two layers:
- **Board layer** (static): floor tiles, walls, and the goal tile. Never moves. Defines where entities can and can't go.
- **Entity layer** (movable): the character, and later (post-MVP) pushable items. This is the only layer actions ever affect.

| Mechanic | Description | Input |
|---|---|---|
| Move | Move a single entity one cell in a cardinal direction, into an adjacent open cell | Tap Move card → tap entity → tap direction → confirm |
| Rotate | Rotate the entities within a 2×2 area 90° clockwise | Tap Rotate card → tap 2×2 area → confirm |
| Shift | Shift all entities within a row/column one cell in a direction | Tap Shift card → tap row/column → tap direction → confirm |
| Board constraints | Walls block entity movement; the goal tile triggers a win when the character enters it | Static — defined by puzzle layout, no player input |
| Goal detection | Win condition triggered when the character enters the goal tile | Automatic check after each action |
| Action budget | Limited number of card uses per puzzle (exact number TBD per puzzle) | Displayed UI counter |

## 5. Constraints

- Grid size: 5×5 (or similar small, digestible size)
- Two-layer grid: static Board layer (floor/walls/goal) + movable Entity layer (character, later items) — actions only ever affect the Entity layer
- Limited action budget per puzzle (exact count varies by puzzle design)
- Turn-based only (no real-time pressure)
- Three action types only in MVP: move, rotate, shift
- No build tooling: Phaser 3 loaded via CDN `<script>` tag, plain JS
- Portrait/mobile aspect ratio (~9:16)

## 6. Win / lose conditions

- **Win:** Character reaches the goal tile within the action budget
- **Lose:** Action budget exhausted before character reaches goal → retry puzzle from start
- **Session end:** Player completes a puzzle (win) or gives up; victory screen shows action count used vs. budget and offers next puzzle

## 7. Controls

Primary interaction is touch (card-based selection); keyboard/mouse is a secondary equivalent for desktop testing.

| Action | Input (touch — primary) | Input (keyboard/mouse) |
|---|---|---|
| Select action card | Tap card at bottom of screen | Click card |
| Select target (tile/entity/area/row/column) | Tap on grid | Click on grid |
| Confirm action | Tap confirm | Press Enter or click confirm |
| Cancel selection | Tap card again, or tap outside grid | Press Esc |
| Undo last action | Undo button (if MVP supports) | Press U or Ctrl+Z |

## 8. Scope — MVP vs. cut

**MVP (must have to test if the core loop is fun):**
- Two-layer grid rendering: static Board layer (floor, walls, goal tile) + movable Entity layer (character)
- Card-based action UI: tap card → tap target → confirm
- Move, Rotate, and Shift actions implemented on the Entity layer
- Action budget counter (e.g., "5 / 8 actions used")
- Win detection (character enters goal tile)
- Lose detection (budget exhausted, no win)
- Puzzle 1: a simple grid solvable with Move alone (introduces the loop before Rotate/Shift matter)
- Retry button when puzzle is lost or won

**Nice to have (only after MVP works):**
- Undo / redo system
- Multiple puzzle levels with progressive difficulty, including puzzles that require Rotate and Shift
- Pushable items on the Entity layer (beyond just the character)
- Puzzle selector / level menu
- Board layer variety (obstacles, springs, etc.) with special behaviors
- Character/goal animations
- Tutorial or hints system

**Explicitly out of scope:**
- Sound effects or music
- Complex narrative or story
- Leaderboards or scoring
- Mobile app (web-only for now)

## 9. Art & audio style

- **Visual style:** Flat colors, minimalist; Board layer tiles (floor/wall/goal) and Entity layer sprites (character) must read as visually distinct — the entity sits "on top of" whatever board tile is beneath it
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
