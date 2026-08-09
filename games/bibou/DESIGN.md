# Bibou

> Mini puzzle game about moving tiles on a grid to reach a goal state.

## 1. One-liner

A turn-based grid puzzle game where you rearrange tiles to guide a character to their goal.

## 2. Pitch

Bibou is a minimal, turn-based puzzle game on a small grid where you use tile-moving actions to get a character from their starting position to a goal (treasure chest, exit door, etc.). Each turn gives you time to think through your moves. The puzzle evolves as you discover how tiles interact and what sequences of moves lead to victory.

## 3. Core loops

1. Player observes the current grid state and identifies their goal position
2. Player selects an action (move tile in a direction, or similar mechanic)
3. Game applies the action and updates the grid
4. Player checks if goal is reached; if not, repeat with new state to analyze
5. (Escalate: later puzzles have more tiles, tighter spaces, or more complex interactions)

## 4. Core mechanics

| Mechanic | Description | Input |
|---|---|---|
| Tile movement | Move a tile (or group of tiles) in a cardinal direction | Click/tap tile + arrow key or directional pad |
| Character positioning | A character occupies a tile; moving that tile moves the character | Implicit (character is on a tile) |
| Goal detection | Win condition is reached when the character's tile occupies a goal tile | Automatic check each turn |

## 5. Constraints

- Grid size: 5×5 (or similar small, digestible size)
- Turn-based only (no real-time pressure)
- No build tooling: Phaser 3 loaded via CDN `<script>` tag, plain JS
- Portrait/mobile aspect ratio (~9:16)

## 6. Win / lose conditions

- **Win:** Character reaches the goal tile (treasure, exit, etc.)
- **Lose:** (TBD — unclear if you lose, or just take more turns)
- **Session end:** One puzzle per session; victory screen shows turn count and offers next puzzle

## 7. Controls

| Action | Input (keyboard) | Input (touch/gamepad) |
|---|---|---|
| Select tile | Click tile | Tap tile |
| Move tile up | Press ↑ or W | D-pad ↑ |
| Move tile down | Press ↓ or S | D-pad ↓ |
| Move tile left | Press ← or A | D-pad ← |
| Move tile right | Press → or D | D-pad → |
| Undo move | Press U or Ctrl+Z | Long-press tile (TBD) |

## 8. Scope — MVP vs. cut

**MVP (must have to test if the core loop is fun):**
- 5×5 grid rendering with visible tiles
- One character tile and one goal tile
- Tile movement in four cardinal directions (press arrow, tile moves)
- Turn counter
- Win detection (character reaches goal)
- One playable puzzle

**Nice to have (only after MVP works):**
- Undo / redo system
- Multiple puzzle levels
- A puzzle selector / level menu
- Tile types (solid, slippery, springs, etc.)
- Character animations during movement

**Explicitly out of scope:**
- Sound effects or music (can add later)
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
