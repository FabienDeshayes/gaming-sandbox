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

Getting the character to their goal tile — via the key that unlocks it — by walking, and by spending the level's one or two special actions on the right target.

1. Player reads the board: where the character is, where the key and the goal are, what's in the way, and which actions the level grants
2. Player swipes to walk, freely and as often as they like — Move costs nothing
3. Where walking alone can't get there, the player spends one of the level's budgeted actions (Shift, Flip) on a target
4. If the character is on the goal tile with every required collectible in hand → win. Otherwise, back to step 1.

The challenge is deliberately **not** a move budget. It's working out *which* action to spend, on *what*, and *when* — a level's whole difficulty is usually one correct use of one action. Walking is free so that experimenting, backtracking, and reading the board never cost anything.

## 4. Core mechanics

The Board (the whole 5×5 grid) has three layers:
- **Background layer** (static): floor tiles and the goal tile. Never moves.
- **Wall layer** (static): a set of edges between adjacent tiles that block entity movement across them. Unlike the other two layers it isn't indexed by tile coordinates — each wall names the pair of adjacent tiles it sits between. See `LEVEL_DESIGN.md` §1.2.
- **Entity layer** (movable): the character, crates, and collectibles. This is the only layer actions ever affect.

Collectibles (the key, and future pickups) are part of the Entity layer, like crates — Move and Shift can both displace one — but they're indestructible: when a collectible can't move out of the way (a wall, or something else stuck ahead of it), it simply stays put and becomes an obstruction rather than being destroyed. The character is the one exception to all of this: it never treats a collectible as an obstacle at all, and always picks one up — instantly, regardless of whether that collectible could otherwise have moved — rather than blocking on or pushing it. See `LEVEL_DESIGN.md` §3/§5.4.

| Mechanic | Description |
|---|---|
| Wall constraints | A wall blocks entity movement between the two specific tiles it connects, in both directions. Static — defined by the puzzle layout. |
| Goal detection | Win condition triggered when the character enters the goal tile, provided every `required` collectible the level places has already been picked up. Checked automatically after each action resolves. |
| Free movement | Move is unlimited and costs nothing. It has no card and needs no selection: the four direction arrows sit around the character from the moment a level loads, and a cardinal swipe anywhere walks. A level may grant *no* budgeted actions at all, in which case walking is the whole puzzle. |
| Action budget | Budgets are **per action type**, and cover only the special actions (Shift, Flip) — never Move. A puzzle grants each action it offers its own pool of uses, and spending one only draws down that action's pool. Each card shows its own remaining count; a spent action greys out while the others keep working. An action that changes nothing (a shift of an empty line, or one every entity on it is walled against) is rejected and costs nothing. |
| Crates | A second kind of entity, and the game's only **destructible** one: every action moves it exactly like the character, but if it ends up crushed against something that can never move out of its way — a wall, a stuck collectible, or a stuck character — it's destroyed instead of the whole action being rejected (§5.4 below). A crate can be **carrying a collectible**, which it drops onto the tile it died on: breaking a crate open is one of the two ways a level hides its key. Only the character can win. |
| Pushing | No two entities may occupy the same tile. Moving an entity onto an occupied tile pushes whatever's there one step further in the same direction first, and so on down the chain if that tile is occupied too — a character can push a crate that pushes another crate (or a collectible, which is displaced the same way unless it's stuck). Shift and Flip never need a push *chain* the way Move does: they displace every affected entity at once as a single reshuffle — though Shift shares the same destruction rule as Move when that reshuffle runs into a wall (§5.4). |
| Collectibles | Pickups (the key) that occupy a tile on the Entity layer like a crate does, but are indestructible and are never treated as an obstacle by the character, who always collects one instead of blocking on or pushing it. A collectible marked `required` must be collected before the character can win: the goal marker shows 🔒 instead of ★, and the HUD prints an objective line naming what's still missing, until every required collectible is gone. Every level places exactly one required key — either loose on the board or sealed inside a crate — so "find the key, then leave" is the shape of every puzzle. |
| Destruction on a jam (§5.4) | When Move or Shift would move an entity across a wall — or into another entity that itself can't move — exactly one destructible entity in that jam (the one actually touching the wall or the stuck neighbor) is destroyed instead of the whole action being rejected. It plays a short nudge toward the tile it was crushed trying to reach (same read as a blocked Move's wall-bump), then bursts into fragments — an explosion, not a fade — and anything it was carrying pops into place on that tile. Nothing behind it advances into the freed tile; if nothing in the jam is destructible, the action is illegal and free. Flip is exempt — it teleports rather than stepping through anything, so it never has a "jam" to resolve. |

## 5. Actions

Actions only ever affect the Entity layer — the Background and Wall layers are untouchable. There are two kinds:

- **Move is free.** It has no card, no budget, and no selection step: the four direction arrows sit around the character whenever nothing else is selected, and a cardinal swipe anywhere walks. This is the resting state of the board.
- **Shift and Flip are budgeted**, presented as cards at the bottom of the screen. Each costs 1 use from **its own** pool. Neither has a tap-a-target step: selecting the card immediately shows the arrows that stand for every possible use of it, and tapping one both picks the target and executes in one gesture.

| Action | Effect on the board | Target selection |
|---|---|---|
| Move *(free, unlimited)* | Moves the character one cell in a cardinal direction. If the destination is occupied (by a crate), the entity there is pushed one step in the same direction first (and so on down the chain); blocked only by a wall the chain runs into. The board is borderless and wraps, so a push chain can wrap around — if it wraps all the way back to the character's own tile (every tile on that line occupied), the whole line rotates by one instead of deadlocking. Crates can only be moved indirectly, by being pushed. | Always available. Tap a direction arrow around the character, or swipe in a cardinal direction — the move executes immediately |
| Shift | Shifts every entity in a row or column one cell in a direction. Its distinctive power is reach: it pushes entities the character isn't next to, and pushes them in directions the character has no tile to stand on and push from. | Tap Shift card → arrows appear pointing inward around every row/column edge → tap one to shift that row/column in that direction, no separate confirm |
| Flip | Mirrors the **whole** entity layer across the board's middle row or middle column — every entity on the board moves at once. The biggest-impact action in the game, and the only one that ignores walls: it can cross the board — or a sealed cell — in a single use, and it moves crates just as far as the character. | Tap Flip card → both mirror lines highlight, with `↔` above the middle column and `↕` beside the middle row → tap one (or swipe horizontally/vertically) to flip across that line, no separate confirm |

Notes:
- An action that would produce an illegal result (moving an entity across a wall), or that would change nothing at all, is rejected and costs nothing. Moving off the grid is never illegal — the board wraps. Flip is the one exception to the wall rule: it never checks walls, since it teleports entities directly rather than stepping them across an edge (see `LEVEL_DESIGN.md` §5.3).
- Because Move is free, a level's difficulty is never "did you have enough moves". It's "did you spend your one Shift, or your one Flip, on the right thing" — which is why most levels grant exactly one.
- This section is where new action types get added; the card UI lays out up to four cards, shrinking them as the row fills.

## 6. Constraints

- Grid size: 5×5 (or similar small, digestible size)
- Board is borderless and loops: an entity moving past index 4 wraps to index 0 (and vice versa) on both axes — there is no "off the grid". Wraparound only affects how the destination coordinate is computed; a wall between the source and destination tile still blocks the move, wraparound included.
- Three-layer grid: static Background layer (floor/goal) + static Wall layer (edges between tiles) + movable Entity layer (character and crates) — actions only ever affect the Entity layer
- No two entities may share a cell: Move pushes whatever occupies its destination, one step at a time down the chain; Shift and Flip move everything they affect at once, so they never produce a collision to resolve
- Move is unlimited and free; the budgeted actions are granted **per action type** (exact counts vary by puzzle design, and are usually 1)
- Turn-based only (no real-time pressure)
- Three action types: move (free), shift, flip
- No build tooling: Phaser 3 loaded via CDN `<script>` tag; the game itself is plain ES modules, no bundler

## 7. Win / lose conditions

- **Win:** Character reaches the goal tile having picked up every `required` collectible the level places (crates on the goal do nothing)
- **No lose condition.** Move is free and unlimited, so a run can never simply time out. What *can* happen is a dead end — the level's one Flip spent on the wrong axis, say, leaving the key sealed forever. The game doesn't try to detect that (it can't, in general); instead a **retry button (↻) sits in the HUD at all times**, and the hint line points at it once every action pool is empty.
- **Session end:** Player completes a puzzle (win) or gives up; victory screen shows moves used, and actions used vs. budget, and offers the next puzzle

## 8. Controls

Primary interaction is touch (card-based selection). Keyboard controls are not yet implemented — the Level 1 build is mobile-first (tap/swipe only); mouse works because clicks map to taps.

| Action | Input (touch — primary) | Input (keyboard/mouse) |
|---|---|---|
| Select action card | Tap card at bottom of screen | Click card |
| Move | Tap a direction arrow around the character, or swipe in a cardinal direction — no selection needed | Click a direction arrow |
| Cancel selection | Tap the card again (the Move arrows come back) | Click card again |
| Retry the level | Tap ↻ in the top-right | Click ↻ |
| Undo last action *(not in MVP)* | Undo button | Press U or Ctrl+Z |

## 9. Scope — MVP vs. cut

**MVP (must have to test if the core loop is fun):**
- Three-layer grid rendering: static Background layer (floor, goal tile) + static Wall layer (edges between tiles) + movable Entity layer (character, crates)
- Free, always-available Move (arrows around the character + swipe), plus card-based Shift and Flip
- Per-action budget counters (each card shows its own remaining uses)
- A `required` key on every level, gating the goal
- Win detection (character enters goal tile holding every required collectible)
- Puzzle 1: a simple grid solvable by walking alone (introduces the loop before the actions matter)
- Retry button, always available

**Nice to have (only after MVP works):**
- Undo / redo system
- Multiple puzzle levels with progressive difficulty, including puzzles that require Shift and Flip
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

- **Visual style:** Dark, low-saturation palette with flat colors elsewhere, minimalist; Background layer tiles (floor/goal) and Entity layer sprites (character, crates) must read as visually distinct — the entity sits "on top of" whatever background tile is beneath it. The character is a light-blue ball with a white outline, two eyes, and a smile; crates are a small pixel-art sprite (`assets/sprites/crate.png`, nearest-filtered so it stays crisp when scaled up) so they read as a different material from the character's flat shape; the character draws above crates so a shared cell still reads as "the character is here". Walls draw as a brick-coloured band with mortar joints on the edge they block — a placeholder while the game is in prototype (see `LEVEL_DESIGN.md` §1.2). The action-preview arrows (Move/Shift/Flip targets) always draw above every board/entity layer (`CONTROL_DEPTH` in `config.js`) and use a deliberately low-contrast translucent style so they read as a preview overlay, not another entity.
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
  | `src/core/rules.js` | Pure grid math (`wrap`, `moveEntity`, `shiftEntity`, `flipEntity`) and wall logic (`isValidWallPair`, `validateLevelWalls`, `buildWallSet`, `isWallBetween`). `resolveMoveChain` resolves a Move's push chain (including the destroy/pickup cases, §5.4); `resolveCycleOutcome` (with `shiftOrder`) does the same for Shift. No Phaser, no scene state, so it is importable from Node for tests |
  | `src/ui/button.js` | The shared text button (nav/overlay buttons), with a resting colour callers can change (idle / selected / out of budget) |
  | `src/ui/actionCard.js` | The bordered "playable card" control used for the budgeted action buttons — a Graphics panel behind a plain interactive Text, same resting-colour shape as `button.js` |
  | `src/ui/BoardView.js` | Grid/goal/wall/entity rendering, cell↔pixel mapping, and the transient action arrows. Holds no game state |
  | `src/scenes/` | `TitleScene`, `LevelSelectScene`, `PuzzleScene` |
  | `assets/sprites/` | Image assets loaded via `this.load.image` (currently just the crate sprite) |
- **Screen size / aspect ratio:** 480x854 (portrait, ~9:16), fixed size
- **Grid rendering:** Canvas or Phaser Graphics API (simple rects + text)
- **Key technical risks:** Tile movement input/state (ensuring clean tile-by-tile motion, not continuous)
- **Level selection:** both **Start** and **Test** on the title screen lead to a level picker before the puzzle loads, so any level can be chosen directly. Start launches the chosen level with its normal budgets; Test launches it with unlimited budgets. Each level's button carries a one-line description of what it teaches; the list is a fixed-height row per level, scrollable (drag, or wheel on desktop) rather than shrunk to fit, so it reads the same regardless of how many levels there are.
- **Test mode:** the title screen has a **Test** entry alongside Start. Via the level picker it launches any level with an *unlimited* budget for **every** action it offers (each card shows `∞ left`), so a level's wrong turns can be explored without restarting. The win condition still works.
