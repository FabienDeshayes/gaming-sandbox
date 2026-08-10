# Bibou — Level Design

> Companion to [`DESIGN.md`](./DESIGN.md). That document covers the pitch, loop, and scope. This one specifies the board, coordinate system, and action mechanics precisely enough to implement, and defines each level's data.

> **Doc convention:** this doc describes the game *as it is now* — edit sections in place when things change, rather than logging what changed (see `DESIGN.md`). To verify a level actually plays as specified here, see [`TESTING.md`](./TESTING.md).

## 1. Board

The **Board** is the whole 5×5 tile grid for a level — the union of both layers, at every coordinate.

- **Size:** 5×5 tiles, fixed for now (all levels in this doc use this size).
- **Layers:** every tile on the Board has a cell on each of two layers, stacked at the same coordinate.
  - **Background layer** (static): floor, walls (post-MVP), and the goal tile. Never changes during play. Defines where the Entity layer is allowed to end up and where the win condition fires.
  - **Entity layer** (movable): the character, and later (post-MVP) pushable items. Every action reads and writes this layer only — the Background layer is read-only during play.

### 1.1 Background tile types

| Tile type | Blocks entities? | Notes |
|---|---|---|
| Floor | No | Default background tile; entities can freely move onto it. |
| Wall *(post-MVP)* | Yes | An entity cannot end a move on a wall tile — see §5.1. Not used by any level in this doc yet. |
| Goal | No | Triggers win when the character's Entity-layer cell lands on it (§4). |

Whether a background tile blocks entities is a property of the tile type, independent of the wraparound mechanic (§2.1) — wraparound only changes *how a destination coordinate is computed*, never whether that destination is legal to land on.

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

The board has no edges — it loops. This applies to **any** entity movement on the board, regardless of which action causes it (Move and Rotate today; Shift once it's specified).

- If a move would take a coordinate to index `5` (or beyond), it wraps to index `0`.
- If a move would take a coordinate to index `-1` (or below), it wraps to index `4`.
- Formally, for board size `N` (currently 5): `newCoord = ((coord + delta) % N + N) % N`.
- Wraparound itself is unconditional — computing the wrapped destination never fails, and the edge itself never blocks a move. Whether the move actually succeeds still depends on what's at that destination: if the wrapped-to tile is a blocking Background-layer tile (e.g. a wall, §1.1), the move is illegal for the same reason a non-wrapped move onto a wall would be.

Moving off one side of the board is therefore always legal *as far as the edge is concerned* and lands on the opposite side, subject only to the normal Background-layer legality check.

## 3. Entities

| Entity | Layer | Notes |
|---|---|---|
| Character | Entity | The thing the player is trying to get onto the goal tile. One per level (MVP). |
| Goal | Background | A single tile marked as the win condition. Static — part of the Background layer, not something that moves. |

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
| Effect | Whatever occupies the Entity layer at `startTile` is displaced to the adjacent tile in `direction`, with wraparound applied (§2.1). `startTile` becomes empty; the destination takes its former contents. The Background layer is untouched. |
| Legality | `startTile` must currently hold an entity on the Entity layer. The destination tile (after wraparound) must not be a blocking tile on the Background layer (§1.1 — e.g. a wall). *(MVP has no walls, so this check is always satisfied until walls are added.)* |
| Cost | 1 |
| Target selection | Tap the Move card → tap the entity (character) → four directional arrows appear around it; tap an arrow **or** swipe in a cardinal direction to choose the direction. Choosing the direction executes the move immediately — there is no separate confirm step (per `DESIGN.md` §5). |

Direction deltas: `Up = (0, -1)`, `Down = (0, +1)`, `Left = (-1, 0)`, `Right = (+1, 0)`.

Example: character at `(4, 2)` moves `Right` → destination `x = (4 + 1) % 5 = 0` → character ends at `(0, 2)`.

### 5.2 Rotate

| Field | Value |
|---|---|
| Parameters | `center: (x, y)` — the tile at the middle of the rotation; `direction: Clockwise \| Anticlockwise` |
| Effect | The 8 tiles surrounding `center` (its Chebyshev-distance-1 neighbours, with wraparound §2.1) form a ring. Each tile's Entity-layer contents shift **one step** around that ring in `direction`. The `center` tile itself is untouched, as is the Background layer. Empty ring tiles "rotate" too — they just carry nothing. |
| Legality | Always legal in the MVP: there are no walls, and empty tiles are allowed to rotate. (Once walls exist, a rotation that would land an entity on a blocking Background tile is rejected and costs nothing, same rule as Move.) |
| Cost | 1 |
| Target selection | Tap the Rotate card → tap a tile to set the rotation **center** → two rotation arrows appear above the center (`↺` anticlockwise, `↻` clockwise); tap an arrow **or** swipe **right** (clockwise) / **left** (anticlockwise) to choose the direction and execute in one gesture. Tapping the center tile again cancels; tapping a different tile re-centers. |

**Ring order.** The 8 surrounding tiles, in clockwise order starting from the top-left corner:

```
index:  0    1    2
        TL   T    TR         TL=(cx-1,cy-1)  T=(cx,cy-1)  TR=(cx+1,cy-1)
        7  center 3           L=(cx-1,cy)               R=(cx+1,cy)
        L        R
        6    5    4
        BL   B    BR         BL=(cx-1,cy+1)  B=(cx,cy+1)  BR=(cx+1,cy+1)
```

Clockwise order is `TL → T → TR → R → BR → B → BL → L → (back to TL)` — i.e. ring indices `0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 0`.

- **Clockwise:** the contents at ring index `i` move to index `(i + 1) mod 8`.
- **Anticlockwise:** the contents at ring index `i` move to index `(i - 1 + 8) mod 8`.

Because adjacent ring positions are always cardinally adjacent, a single rotation displaces any one entity by exactly **one cell in a cardinal direction** — a corner tile shifts to an edge tile and vice-versa. This is what makes Rotate usable to walk the character around the board.

Example: `center = (2, 3)`, character at the top-left ring tile `(1, 2)` (index 0). A **clockwise** rotation moves it to index 1, the `T` tile → character ends at `(2, 2)`.

### 5.3 Shift

Named and scoped in `DESIGN.md` §5 but not yet needed by any level below — it only matters once a level has more than one entity. Full parameter/effect specs will be added here once a level requires it, following the same table format as Move above.

## 6. Level data format

Suggested shape for encoding a level, for whoever implements level loading:

```json
{
  "id": 1,
  "gridSize": 5,
  "background": {
    "goal": { "x": 3, "y": 2 }
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
| Goal | `(3, 2)` |
| Available actions | Move only |
| Action budget | 2 |

**Intended solution:** the goal is 2 tiles to the right of the start (`x: 1 → 3`, same `y`). Moving `Right` twice solves it with zero slack:

1. Move `(1, 2)` `Right` → character now at `(2, 2)`
2. Move `(2, 2)` `Right` → character now at `(3, 2)` = goal → **win**

The tight budget (exactly 2, no margin for a wrong move) is intentional: it teaches the Move action and the coordinate system without offering an easier alternate path. No wraparound is required to solve Level 1, since the shortest path stays within the grid — wraparound remains available but isn't needed here.

### Level 2

Introduces the Rotate action (§5.2). The only action available is Rotate; there is no Move.

| Field | Value |
|---|---|
| Grid | 5×5, no walls |
| Character start | `(1, 2)` |
| Goal | `(2, 3)` |
| Available actions | Rotate only |
| Action budget | 2 |

**Intended solution:** the goal is one tile down-and-right of the start (a diagonal, `(1,2) → (2,3)`). A single rotation only moves the character one cardinal step (§5.2), so a diagonal takes two rotations:

1. Rotate around center `(2, 3)` **clockwise** → the character sits at that center's top-left ring tile `(1, 2)` (index 0) and shifts to index 1, the `T` tile → character now at `(2, 2)`.
2. Rotate around center `(1, 3)` **clockwise** → the character sits at that center's top-right ring tile `(2, 2)` (index 2) and shifts to index 3, the `R` tile → character now at `(2, 3)` = goal → **win**.

Budget 2 is exactly the shortest solution length, mirroring Level 1's tightness — this time to teach that one rotation equals one cardinal step and that reaching a diagonal needs two of them.
