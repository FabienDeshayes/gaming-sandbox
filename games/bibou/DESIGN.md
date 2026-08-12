# Bibou

> Mini puzzle game about moving tiles on a grid to reach a goal state.

> See [`LEVEL_DESIGN.md`](./LEVEL_DESIGN.md) for the coordinate system, precise action specs, and per-level data.
> See [`TESTING.md`](./TESTING.md) for how to drive the game in a headless browser and verify a level.

> **Doc convention:** these docs describe the game *as it is now*. When something changes, edit the
> relevant sections in place — don't leave "superseded"/"previously"/"was X, now Y" notes. Git history
> is the changelog; this doc is the current source of truth.

## 1. One-liner

A turn-based grid puzzle game where you rearrange tiles to guide a character to their goal.

## 2. Pitch

Bibou is a minimal, turn-based puzzle game on a small grid where you use tile-moving actions to get a character from their starting position to a goal (treasure chest, exit door, etc.). Each turn gives you time to think through your moves. The puzzle evolves as you discover how tiles interact and what sequences of moves lead to victory.

## 3. Core loop

Getting the character to their goal tile through a series of actions.

1. Player reads the board: where the character is, where the goal is, what's in the way, and how many actions are left
2. Player picks an action, applies it to a target on the board, and confirms
3. Board updates; the action budget drops by 1
4. If the character is on the goal tile → win. If the budget is spent → retry. Otherwise, back to step 1.

## 4. Core mechanics

The Board (the whole 5×5 grid) has two layers:
- **Background layer** (static): floor tiles, walls, and the goal tile. Never moves. Defines where entities can and can't go — including which tiles block entities regardless of the wraparound mechanic below.
- **Entity layer** (movable): the character and crates. This is the only layer actions ever affect.

| Mechanic | Description |
|---|---|
| Background constraints | Walls block entity movement; the goal tile triggers a win when the character enters it. Static — defined by the puzzle layout. |
| Goal detection | Win condition triggered when the character enters the goal tile. Checked automatically after each action resolves. |
| Action budget | Budgets are **per action type**: a puzzle grants each action it offers its own pool of uses, and spending one only draws down that action's pool. Each card shows its own remaining count; a spent action greys out while the others keep working. |
| Crates | A second kind of entity. No rules of its own beyond pushing — every action moves it exactly like the character, and only the character can win. It exists so puzzles have something else on the board to rearrange, and something for Move to push. |
| Pushing | No two entities may occupy the same tile. Moving an entity onto an occupied tile pushes whatever's there one step further in the same direction first, and so on down the chain if that tile is occupied too — a character can push a crate that pushes another crate. Rotate, Shift, and Flip never need this: they displace every affected entity at once as a single reshuffle, so entities never land on each other. |

## 5. Actions

Actions are the elements the player chooses to affect the tiled board. They are presented as cards at the bottom of the screen. Every action costs 1 use from **its own** budget and only ever affects the Entity layer — the Background layer is untouchable.

Selecting an action follows a **tap the card → tap the target on the board → confirm** flow. For **Move**, choosing the direction *is* the confirming beat — there is no separate Confirm button: after tapping an entity, four directional arrows appear around it, and the player taps an arrow or swipes in a cardinal direction to pick the direction and execute the move in one gesture. **Shift** and **Flip** skip the target-tap step entirely: selecting the card immediately shows the arrows that stand for every possible use of it, and tapping one both picks the target and executes in one gesture.

| Action | Effect on the board | Target selection |
|---|---|---|
| Move | Moves a single entity — the character *or* a crate — one cell in a cardinal direction. If the destination is occupied, the entity there is pushed one step in the same direction first (and so on down the chain); blocked only by a wall the chain runs into. The board is borderless and wraps, so a push chain can wrap around — if it wraps all the way back to the mover's own tile (every tile on that line occupied), the whole line rotates by one instead of deadlocking. | Tap entity → tap a direction arrow (or swipe) — the move executes on direction, no separate confirm |
| Rotate | Shifts the 8 tiles surrounding a chosen center tile one step around their ring, clockwise or anticlockwise. Entities inside move with it; empty cells rotate too; the center tile is untouched. See `LEVEL_DESIGN.md` §5.2 for the exact ring order. | Tap center tile → tap a rotation arrow (↺/↻) or swipe right (CW) / left (CCW) |
| Shift | Shifts every entity in a row or column one cell in a direction. | Tap Shift card → arrows appear pointing inward around every row/column edge → tap one to shift that row/column in that direction, no separate confirm |
| Flip | Mirrors the **whole** entity layer across the board's middle row or middle column — every entity on the board moves at once. The biggest-impact action in the game: it can cross the board in a single use, and it moves crates just as far as the character. | Tap Flip card → both mirror lines highlight, with `↔` above the middle column and `↕` beside the middle row → tap one (or swipe horizontally/vertically) to flip across that line, no separate confirm |

Notes:
- An action that would produce an illegal result (pushing an entity into a wall) is rejected before confirmation, and costs nothing. Moving off the grid is never illegal — the board wraps.
- Rotate, Shift, and Flip are all useful with a single entity (Rotate and Shift move it one cardinal step per use, Flip can throw it across the board), and get more interesting once there is more than one entity on the board — puzzle 1 is solvable with Move alone.
- Because budgets are per action type, a level's difficulty comes as much from the *mix* it offers as from the total count: two actions of one type play very differently from one each of two types.
- This section is where new action types get added; the card UI lays out up to four cards, shrinking them as the row fills.

## 6. Constraints

- Grid size: 5×5 (or similar small, digestible size)
- Board is borderless and loops: an entity moving past index 4 wraps to index 0 (and vice versa) on both axes — there is no "off the grid". Wraparound only affects how the destination coordinate is computed; a blocking tile on the Background layer (e.g. a wall) still blocks the move.
- Two-layer grid: static Background layer (floor/walls/goal) + movable Entity layer (character and crates) — actions only ever affect the Entity layer
- No two entities may share a cell: Move pushes whatever occupies its destination, one step at a time down the chain; Rotate, Shift, and Flip move everything they affect at once, so they never produce a collision to resolve
- Limited action budget per puzzle, granted **per action type** (exact counts vary by puzzle design)
- Turn-based only (no real-time pressure)
- Four action types: move, rotate, shift, flip
- No build tooling: Phaser 3 loaded via CDN `<script>` tag; the game itself is plain ES modules, no bundler

## 7. Win / lose conditions

- **Win:** Character reaches the goal tile within the action budget (crates on the goal do nothing)
- **Lose:** Every action's budget exhausted before the character reaches the goal → retry puzzle from start. A level is only lost once *no* action has uses left, so a spent Move doesn't end the puzzle while Flip still has a use.
- **Session end:** Player completes a puzzle (win) or gives up; victory screen shows action count used vs. budget and offers next puzzle

## 8. Controls

Primary interaction is touch (card-based selection). Keyboard controls are not yet implemented — the Level 1 build is mobile-first (tap/swipe only); mouse works because clicks map to taps.

| Action | Input (touch — primary) | Input (keyboard/mouse) |
|---|---|---|
| Select action card | Tap card at bottom of screen | Click card |
| Select target (tile/entity/area/row/column) | Tap on grid | Click on grid |
| Choose direction / confirm Move | Tap a direction arrow, or swipe in a cardinal direction (executes the move) | Click a direction arrow |
| Cancel selection | Tap card again, or tap the character again to clear the arrows | Click card again |
| Undo last action *(not in MVP)* | Undo button | Press U or Ctrl+Z |

## 9. Scope — MVP vs. cut

**MVP (must have to test if the core loop is fun):**
- Two-layer grid rendering: static Background layer (floor, walls, goal tile) + movable Entity layer (character, crates)
- Card-based action UI: tap card → tap target → confirm
- Move, Rotate, Shift, and Flip actions implemented on the Entity layer
- Per-action budget counters (each card shows its own remaining uses)
- Win detection (character enters goal tile)
- Lose detection (every action's budget exhausted, no win)
- Puzzle 1: a simple grid solvable with Move alone (introduces the loop before the other actions matter)
- Retry button when puzzle is lost or won

**Nice to have (only after MVP works):**
- Undo / redo system
- Multiple puzzle levels with progressive difficulty, including puzzles that require Rotate, Shift, and Flip
- Further crate rules beyond pushing/blocking (crate-on-target goals, crate-specific win conditions)
- Puzzle selector / level menu
- Background layer variety (obstacles, springs, etc.) with special behaviors
- Character/goal animations
- Tutorial or hints system

**Explicitly out of scope:**
- Sound effects or music
- Complex narrative or story
- Leaderboards or scoring
- Mobile app (web-only for now)

## 10. Art & audio style

- **Visual style:** Flat colors, minimalist; Background layer tiles (floor/wall/goal) and Entity layer sprites (character, crates) must read as visually distinct — the entity sits "on top of" whatever background tile is beneath it. The character is a light-blue square with a white outline, crates are brown with a dark outline, and the character draws above crates so a shared cell still reads as "the character is here"
- **Reference images/games:** Sokoban (puzzle focus), Puzzle & Dragons (grid + turn-based), Threes (tile sliding)
- **Audio:** None for prototype; can revisit after core loop works

## 11. Theme

Mechanics-first prototype. "Bibou" could be a character name (the one you're moving), or just a working title. No narrative required yet — the puzzle is the game.

## 12. Tech notes

- **Platform:** Web (2D)
- **Engine/library:** Phaser 3, via CDN
- **Source layout:** `index.html` loads `src/main.js` as an ES module (`<script type="module">`); there is no build step, the browser resolves the imports. Phaser stays a CDN global — classic scripts run before deferred modules, so `Phaser` is always defined by the time a module body runs. Because ES modules are blocked over `file://`, the game must be opened through a web server (static hosting, or any local server).

  | Path | Holds |
  |---|---|
  | `src/main.js` | `Phaser.Game` config and scene registration — boot only |
  | `src/config.js` | Screen/board layout constants and the colour palette |
  | `src/data/levels.js` | Level definitions and the `LEVELS` list — where a new level goes |
  | `src/core/rules.js` | Pure grid math (`wrap`, `moveEntity`, `rotateEntity`, `shiftEntity`, `flipEntity`, `isBlocked`). No Phaser, no scene state, so it is importable from Node for tests |
  | `src/ui/button.js` | The shared text button, with a resting colour callers can change (idle / selected / out of budget) |
  | `src/ui/BoardView.js` | Grid/goal/entity rendering, cell↔pixel mapping, and the transient action arrows. Holds no game state |
  | `src/scenes/` | `TitleScene`, `LevelSelectScene`, `PuzzleScene` |
- **Screen size / aspect ratio:** 480x854 (portrait, ~9:16), fixed size
- **Grid rendering:** Canvas or Phaser Graphics API (simple rects + text)
- **Key technical risks:** Tile movement input/state (ensuring clean tile-by-tile motion, not continuous)
- **Level selection:** both **Start** and **Test** on the title screen lead to a level picker (currently Levels 1–5) before the puzzle loads, so any level can be chosen directly. Start launches the chosen level with its normal budgets; Test launches it with unlimited budgets.
- **Test mode:** the title screen has a **Test** entry alongside Start. Via the level picker it launches any level with an *unlimited* budget for **every** action it offers (each card shows `∞ left`), so the game can be explored freely for development/testing without the normal player-facing limits. The lose condition never fires in test mode; the win condition still works.
