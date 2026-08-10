# Bibou — Level Design

> Companion to [`DESIGN.md`](./DESIGN.md). That document covers the pitch, loop, and scope. This one specifies the board, coordinate system, and action mechanics precisely enough to implement, and defines each level's data.

## 1. Board

- **Size:** 5×5 tiles, fixed for now (all levels in this doc use this size).
- **Layers:** every tile has a cell on each of two layers, stacked at the same coordinate.
  - **Board layer** (static): floor, walls (post-MVP), and the goal tile. Never changes during play. Defines where the Entity layer is allowed to end up and where the win condition fires.
  - **Entity layer** (movable): the character, and later (post-MVP) pushable items. Every action reads and writes this layer only — the Board layer is read-only during play.

## 2. Coordinate system

- Coordinates are `(x, y)`. **`x` is horizontal (column), `y` is vertical (row).**
- Origin `(0, 0)` is the **top-left** tile.
- Valid range for both axes on a 5×5 board: `0`–`4`.

```
        x=0   x=1   x=2   x=3   x=4
y=0   [0,0] [1,0] [2,0] [3,0] [4,0]
y=1   [0,1] [1,1] [2,1] [3,1] [4,1]
y=2   [0,2] [1,2] [2,2] [3,2] [4,2]
y=3   [0,3] [1,3] [2,3] [3,3] [4,3]
y=4   [0,4] [1,4] [2,4] [3,4] [4,4]
```

Implementation note: store each layer as a 2D array indexed `grid[y][x]` (row-major) to match this diagram — indexing `[x][y]` will transpose it.

### 2.1 Borderless wraparound

The board has no edges — it loops. This applies to **any** entity movement on the board, regardless of which action causes it (Move today; Rotate/Shift once they're specified).

- If a move would take a coordinate to index `5` (or beyond), it wraps to index `0`.
- If a move would take a coordinate to index `-1` (or below), it wraps to index `4`.
- Formally, for board size `N` (currently 5): `newCoord = ((coord + delta) % N + N) % N`.
- Wraparound is unconditional — it is not blocked by anything and always succeeds. Walls (post-MVP) are the only thing that can stop a move; the edge itself never does.

This supersedes the "blocked by ... board edges" language for Move in `DESIGN.md` — moving off one side is always legal and lands on the opposite side.

## 3. Entities

| Entity | Layer | Notes |
|---|---|---|
| Character | Entity | The thing the player is trying to get onto the goal tile. One per level (MVP). |
| Goal | Board | A single tile marked as the win condition. Static — part of the Board layer, not something that moves. |

## 4. Win condition

Checked automatically after every action resolves: if the Entity-layer cell holding the character has the same `(x, y)` as the Board-layer goal tile, the level is won.

## 5. Actions

Every action is defined by:
- **Name** — identifier shown on its card.
- **Parameters** — the inputs needed to fully specify one use of the action.
- **Effect** — what it does to the Entity layer when executed.
- **Legality** — conditions checked before the action is allowed to confirm; an illegal action is rejected and costs nothing (per `DESIGN.md` §5).
- **Cost** — spent from the level's action budget on successful execution. All actions cost 1 (per `DESIGN.md` §4).

### 5.1 Move

| Field | Value |
|---|---|
| Parameters | `startTile: (x, y)` — the tile to move; `direction: Up \| Down \| Left \| Right` |
| Effect | Whatever occupies the Entity layer at `startTile` is displaced to the adjacent tile in `direction`, with wraparound applied (§2.1). `startTile` becomes empty; the destination takes its former contents. The Board layer is untouched. |
| Legality | `startTile` must currently hold an entity on the Entity layer. The destination tile (after wraparound) must not be a wall on the Board layer. *(MVP has no walls, so this check is always satisfied until walls are added.)* |
| Cost | 1 |
| Target selection | Tap entity → tap direction (per `DESIGN.md` §5) |

Direction deltas: `Up = (0, -1)`, `Down = (0, +1)`, `Left = (-1, 0)`, `Right = (+1, 0)`.

Example: character at `(4, 2)` moves `Right` → destination `x = (4 + 1) % 5 = 0` → character ends at `(0, 2)`.

### 5.2 Rotate, Shift

Named and scoped in `DESIGN.md` §5 but not yet needed by any level below — they only matter once a level has more than one entity. Full parameter/effect specs will be added here once a level requires them, following the same table format as Move above.

## 6. Level data format

Suggested shape for encoding a level, for whoever implements level loading:

```json
{
  "id": 1,
  "gridSize": 5,
  "board": {
    "goal": { "x": 1, "y": 4 }
  },
  "entities": {
    "character": { "x": 1, "y": 2 }
  },
  "actionBudget": {
    "move": 2
  }
}
```

`actionBudget` is keyed per action type so a level can restrict which actions are available at all (an action type absent or `0` means it can't be used) — this is how Level 1 offers only Move.

## 7. Levels

### Level 1

The introductory level: solvable with Move alone, per `DESIGN.md`'s scope for Puzzle 1.

| Field | Value |
|---|---|
| Grid | 5×5, no walls |
| Character start | `(1, 2)` |
| Goal | `(1, 4)` |
| Available actions | Move only |
| Action budget | 2 |

**Intended solution:** the goal is 2 tiles straight down from the start (`y: 2 → 4`, same `x`). Moving `Down` twice solves it with zero slack:

1. Move `(1, 2)` `Down` → character now at `(1, 3)`
2. Move `(1, 3)` `Down` → character now at `(1, 4)` = goal → **win**

The tight budget (exactly 2, no margin for a wrong move) is intentional: it teaches the Move action and the coordinate system without offering an easier alternate path. No wraparound is required to solve Level 1, since the shortest path stays within the grid — wraparound remains available but isn't needed here.
