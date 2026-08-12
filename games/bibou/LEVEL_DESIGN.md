# Bibou — Level Design

> Companion to [`DESIGN.md`](./DESIGN.md). That document covers the pitch, loop, and scope. This one specifies the board, coordinate system, and action mechanics precisely enough to implement, and defines each level's data.

> **Doc convention:** this doc describes the game *as it is now* — edit sections in place when things change, rather than logging what changed (see `DESIGN.md`). To verify a level actually plays as specified here, see [`TESTING.md`](./TESTING.md).

## 1. Board

The **Board** is the whole 5×5 tile grid for a level — the union of both layers, at every coordinate.

- **Size:** 5×5 tiles, fixed for now (all levels in this doc use this size).
- **Layers:** every tile on the Board has a cell on each of two layers, stacked at the same coordinate.
  - **Background layer** (static): floor, walls (post-MVP), and the goal tile. Never changes during play. Defines where the Entity layer is allowed to end up and where the win condition fires.
  - **Entity layer** (movable): the character and crates. Every action reads and writes this layer only — the Background layer is read-only during play.

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

The board has no edges — it loops. This applies to **any** entity movement on the board, regardless of which action causes it (Move, Rotate, and Shift). Flip (§5.4) is the exception, and only because it never needs wrapping: mirroring a coordinate inside the grid always lands inside the grid.

- If a move would take a coordinate to index `5` (or beyond), it wraps to index `0`.
- If a move would take a coordinate to index `-1` (or below), it wraps to index `4`.
- Formally, for board size `N` (currently 5): `newCoord = ((coord + delta) % N + N) % N`.
- Wraparound itself is unconditional — computing the wrapped destination never fails, and the edge itself never blocks a move. Whether the move actually succeeds still depends on what's at that destination: if the wrapped-to tile is a blocking Background-layer tile (e.g. a wall, §1.1), the move is illegal for the same reason a non-wrapped move onto a wall would be.

Moving off one side of the board is therefore always legal *as far as the edge is concerned* and lands on the opposite side, subject only to the normal Background-layer legality check.

## 3. Entities

| Entity | Layer | Notes |
|---|---|---|
| Character | Entity | The thing the player is trying to get onto the goal tile. One per level (MVP). |
| Crate | Entity | Any number per level, optional. Carries **no rules of its own beyond pushing**: every action displaces a crate exactly as it displaces the character, a crate on the goal tile does nothing, and Move can target a crate as readily as the character. |
| Goal | Background | A single tile marked as the win condition. Static — part of the Background layer, not something that moves. |

**No two entities may occupy the same tile.** When Move would displace an entity onto a tile another entity already occupies, the entity already there is pushed one step further in the same direction first — and if *that* tile is occupied too, the push cascades down the chain before anything actually moves. See §5.1 for exactly how a push chain resolves, including the case where the chain wraps all the way around the board.

Pushing is a Move-only concern. Rotate, Shift, and Flip each displace every entity they affect in one simultaneous reshuffle — a permutation of positions, not a sequence of single-entity displacements — so two entities can never end up sharing a tile as a result of those actions, whatever the layout going in. Move is the only action where one entity moves into a tile that isn't moving along with it, so it's the only one that ever needs to push.

This section anticipates a future **collectible** entity type that would be picked up rather than pushed or blocked — not yet implemented, see `TODO.md`. Every entity in the MVP (character, crate) blocks and gets pushed.

Since entities never share a tile outside of an in-progress push resolution, a Move tap on a cell always targets the one entity present there; the character is still drawn above crates in `BoardView` for legibility, but that no longer needs to break a tie.

## 4. Win condition

Checked automatically after every action resolves: if the Entity-layer cell holding the character has the same `(x, y)` as the Board-layer goal tile, the level is won.

## 5. Actions

Every action is defined by:
- **Name** — identifier shown on its card.
- **Parameters** — the inputs needed to fully specify one use of the action.
- **Effect** — what it does to the Entity layer when executed.
- **Legality** — conditions checked before the action is allowed to confirm; an illegal action is rejected and costs nothing (per `DESIGN.md` §5).
- **Cost** — spent from **that action's own** budget on successful execution. Every action costs 1 use of itself and nothing from any other action's pool (§6).

### 5.1 Move

| Field | Value |
|---|---|
| Parameters | `startTile: (x, y)` — the tile to move; `direction: Up \| Down \| Left \| Right` |
| Effect | The entity on the Entity layer at `startTile` — character or crate — is displaced to the adjacent tile in `direction`, with wraparound applied (§2.1). If that destination tile is occupied, the entity there is displaced one step further in `direction` first, and so on down the chain (§5.1.1) — every entity in the chain ends up shifted one step. The Background layer is untouched. |
| Legality | `startTile` must currently hold an entity on the Entity layer. Walking the push chain from `startTile` in `direction` must not hit a blocking tile on the Background layer (§1.1 — e.g. a wall) before it resolves. *(MVP has no walls, so this check is always satisfied until walls are added.)* |
| Cost | 1 Move |
| Target selection | Tap the Move card → tap an entity (character or crate) → four directional arrows appear around it; tap an arrow **or** swipe in a cardinal direction to choose the direction. Choosing the direction executes the move immediately — there is no separate confirm step (per `DESIGN.md` §5). Tapping the selected entity again cancels; tapping a different entity re-targets the move. |

Direction deltas: `Up = (0, -1)`, `Down = (0, +1)`, `Left = (-1, 0)`, `Right = (+1, 0)`.

Example (no push): character at `(4, 2)` moves `Right` → destination `x = (4 + 1) % 5 = 0` → character ends at `(0, 2)`.

#### 5.1.1 Push chains

Moving an entity onto an occupied tile pushes a chain, not just one neighbour: starting at `startTile`, walk the line of tiles in `direction` — `startTile`, then one step further, then one step further again — following whichever entity occupies each tile, until one of three things happens:

1. **An unoccupied tile is found.** The chain resolves there: every entity from `startTile` up to (but not including) that tile shifts one step forward into the next tile in the chain. This is the common case — pushing one crate, or a crate that pushes another crate.
2. **A blocking Background tile is hit** (post-MVP wall). The whole move is illegal and nothing moves — same as any other illegal action (`DESIGN.md` §5).
3. **The walk wraps all the way back to `startTile` itself**, because the board is borderless (§2.1) and every tile on that row/column is occupied by an entity. There is no open tile to resolve into, but this is *not* a deadlock: every entity in the chain still shifts one step forward, including the entity that was at `startTile` — the net effect is the entire line rotating by one, identical to a Shift on that line. This is the case Level 6 (§7) is built to exercise.

Implementation: `resolveMoveChain` (in `src/core/rules.js`) walks the chain and returns the ordered list of tiles it passes through, or `null` for case 2; `applyMoveChain` shifts every entity in that list forward by one. Both cases 1 and 3 are the same function call — case 3 is simply what happens when the walk's terminating condition is "back at the start" instead of "found an empty tile".

Example (push, no loop): row has crates at `(2, 2)` and `(3, 2)`, character at `(1, 2)`. Character moves `Right`: destination `(2, 2)` is occupied, so the chain walks to `(3, 2)` (also occupied), then to `(4, 2)` (open) — chain resolves. Character ends at `(2, 2)`, the first crate at `(3, 2)`, the second crate at `(4, 2)`.

Example (full-loop push): see Level 6 (§7) — a row completely filled by 5 entities, where a single Move rotates the whole row by one.

### 5.2 Rotate

| Field | Value |
|---|---|
| Parameters | `center: (x, y)` — the tile at the middle of the rotation; `direction: Clockwise \| Anticlockwise` |
| Effect | The 8 tiles surrounding `center` (its Chebyshev-distance-1 neighbours, with wraparound §2.1) form a ring. Each tile's Entity-layer contents shift **one step** around that ring in `direction`. The `center` tile itself is untouched, as is the Background layer. Empty ring tiles "rotate" too — they just carry nothing. |
| Legality | Always legal in the MVP: there are no walls, and empty tiles are allowed to rotate. (Once walls exist, a rotation that would land an entity on a blocking Background tile is rejected and costs nothing, same rule as Move.) |
| Cost | 1 Rotate |
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

| Field | Value |
|---|---|
| Parameters | `line: { axis: Row \| Column, index }` — which row (`y = index`) or column (`x = index`) to shift; `direction: Left \| Right` for a row, `Up \| Down` for a column |
| Effect | Every entity currently on the Entity layer at `y = index` (row) or `x = index` (column) moves one cell in `direction`, with wraparound (§2.1). Tiles on that row/column not holding an entity stay empty; the Background layer is untouched. |
| Legality | Always legal in the MVP: there are no walls, and a row/column with no entity on it "shifts" without visible effect. (Once walls exist, a shift that would land an entity on a blocking Background tile is rejected and costs nothing, same rule as Move/Rotate.) |
| Cost | 1 Shift |
| Target selection | Tap the Shift card → arrows appear immediately around **every** row and column edge, pointing inward (`▶` on the left edge / `◀` on the right edge of each row; `▼` above / `▲` below each column) → tap one arrow to shift that row or column in that direction and execute immediately. Unlike Move/Rotate, there is no separate tap-a-target step first — which arrow you tap picks the row/column *and* the direction in one gesture. |

Example: `line = { axis: Row, index: 3 }`, `direction = Right`, character at `(2, 3)` → destination `x = (2 + 1) % 5 = 3` → character ends at `(3, 3)`; a character on any other row is unaffected.

### 5.4 Flip

The board's highest-impact action: it mirrors the **entire** entity layer in one use, so every entity moves at once and an entity can cross the whole board in a single action.

| Field | Value |
|---|---|
| Parameters | `axis: Row \| Column` — the **mirror line**, i.e. the middle row or the middle column of the board |
| Effect | Every entity on the Entity layer is reflected across that middle line. `axis: Row` mirrors across the middle row, so `y` flips and the board turns top-to-bottom; `axis: Column` mirrors across the middle column, so `x` flips and the board turns left-to-right. The other coordinate is unchanged. The Background layer is untouched — the goal tile does **not** move. |
| Legality | Always legal in the MVP: there are no walls, and mirroring never leaves the grid. (Once walls exist, a flip that would land an entity on a blocking Background tile is rejected and costs nothing, same rule as the other actions.) |
| Cost | 1 Flip |
| Target selection | Tap the Flip card → both mirror lines highlight, with `↔` above the middle column and `↕` to the left of the middle row → tap one arrow, **or** swipe horizontally (mirror across the middle column) / vertically (mirror across the middle row), to execute immediately. Like Shift, there is no separate tap-a-target step — Flip always affects the whole board, so the only choice is which line to mirror across. |

**Formula.** For board size `N`, mirroring coordinate `c` gives `N - 1 - c`:

- `axis: Row` → `(x, y)` becomes `(x, N - 1 - y)`
- `axis: Column` → `(x, y)` becomes `(N - 1 - x, y)`

No wraparound is involved (§2.1) — the mirror of an in-range coordinate is always in range.

**Properties worth designing around:**

- **Flip is its own inverse.** Flipping twice across the same line returns every entity to where it started, wasting two actions. This is the main way a player loses a Flip-only level.
- **The middle line is a fixed point.** On the 5×5 board, an entity at `y = 2` is unmoved by a row flip, and one at `x = 2` is unmoved by a column flip. An entity at `(2, 2)` is unmoved by either. The two mirror lines are highlighted while Flip is selected precisely so this is visible before committing.
- **Distance travelled depends on where you are.** An entity on an edge (`0` or `4`) jumps 4 cells; one adjacent to the middle jumps 2. Flip is strongest from the edges and weakest near the center.
- **The goal never moves,** so a flip changes the character's relationship to the goal — unlike Rotate/Shift, it can close a large gap or open one just as fast.

Example: `axis: Column` on a 5×5 board, character at `(1, 1)` → `x = 5 - 1 - 1 = 3` → character ends at `(3, 1)`. A crate at `(0, 0)` moves to `(4, 0)` in the same action.

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
    "character": { "x": 1, "y": 2 },
    "crates": [{ "x": 0, "y": 0 }]
  },
  "actionBudget": {
    "move": 2,
    "flip": 1
  }
}
```

`entities.crates` is optional — omit it for a level with no crates. Each entry is one crate's starting position (§3).

**`actionBudget` is per action type, in two senses:**

1. **Which actions the level offers.** An action type absent from the map, or set to `0`, cannot be used at all — this is how Level 1 offers only Move. Only the listed actions get a card.
2. **How many times each may be used.** Each key is that action's own private pool. Using Flip draws down `flip` and nothing else, so `{ "move": 1, "flip": 1 }` means *exactly one Move and exactly one Flip* — not "two actions, spend them however you like". A level is lost only when **every** listed action has hit `0` without the character reaching the goal.

Each card displays its own remaining count and greys out when spent, while the level's HUD counter shows total actions used against the sum of all pools. In Test mode every pool is unlimited.

This is the main knob for level difficulty: the *mix* matters as much as the total. Two of one action plays very differently from one each of two, since neither can cover for the other.

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

### Level 3

Introduces the Shift action (§5.3). The only action available is Shift; there is no Move or Rotate.

| Field | Value |
|---|---|
| Grid | 5×5, no walls |
| Character start | `(2, 3)` |
| Goal | `(3, 2)` |
| Available actions | Shift only |
| Action budget | 2 |

**Intended solution:** the goal is one tile up-and-right of the start (a diagonal, `(2,3) → (3,2)`). A single shift only moves the character one cardinal step along its row or column (§5.3), so a diagonal takes two shifts:

1. Shift row `y = 3` **Right** → character at `(2, 3)` is on that row, so `x = (2 + 1) % 5 = 3` → character now at `(3, 3)`.
2. Shift column `x = 3` **Up** → character at `(3, 3)` is on that column, so `y = (3 - 1 + 5) % 5 = 2` → character now at `(3, 2)` = goal → **win**.

Budget 2 is exactly the shortest solution length, mirroring Levels 1 and 2 — this time to teach that Shift moves an entity one cardinal step along a whole row/column at once, and that reaching a diagonal still needs two of them.

### Level 4

Introduces the Flip action (§5.4) **and** crates (§3). The only action available is Flip.

| Field | Value |
|---|---|
| Grid | 5×5, no walls |
| Character start | `(1, 1)` |
| Crates | `(0, 0)` and `(4, 2)` |
| Goal | `(3, 3)` |
| Available actions | Flip only |
| Action budget | Flip: 2 |

**Intended solution:** the goal sits diagonally opposite the start through the board's center (`(1,1) → (3,3)`), which is exactly one mirror per axis. The two flips commute, so either order works:

1. Flip across the middle **column** → character `x = 5 - 1 - 1 = 3` → character now at `(3, 1)`.
2. Flip across the middle **row** → character `y = 5 - 1 - 1 = 3` → character now at `(3, 3)` = goal → **win**.

(Row first gives `(1, 3)` then `(3, 3)` — same result.)

Budget 2 is exactly the shortest solution, matching Levels 1–3. The trap this level teaches is Flip's self-inverse property (§5.4): using the *same* axis twice returns the character to `(1, 1)` and loses the level, so the player has to notice that the two arrows do different things rather than tapping the same one twice.

The two crates carry no rules — they're here to make Flip's whole-board reach visible. They travel with the character on every flip: on the column-then-row solution, `(0, 0) → (4, 0) → (4, 4)` and `(4, 2) → (0, 2) → (0, 2)`. That second crate starts on the middle row, so the row flip leaves it exactly where it is — the fixed-point rule from §5.4, demonstrated on the board while the player watches.

### Level 5

The first level offering **two** action types, each with its own budget (§6) — one Move and one Flip. Neither can substitute for the other, so the level can only be solved by using each exactly once.

| Field | Value |
|---|---|
| Grid | 5×5, no walls |
| Character start | `(1, 2)` |
| Crates | `(1, 0)` |
| Goal | `(3, 3)` |
| Available actions | Move and Flip |
| Action budget | Move: 1, Flip: 1 |

**Intended solution:** a column flip covers the horizontal gap (`x: 1 → 3`) and the single Move covers the remaining step down. Either order works:

1. Flip across the middle **column** → character `x = 5 - 1 - 1 = 3` → character now at `(3, 2)`.
2. Move `Down` → character now at `(3, 3)` = goal → **win**.

(Move first gives `(1, 3)`, then the column flip gives `(3, 3)` — same result.)

Note the character starts on the middle row (`y = 2`), so a **row** flip does nothing to it (§5.4) and wastes the level's only Flip. The crate at `(1, 0)` is off the middle column, so it visibly jumps to `(3, 0)` on the correct flip, giving the player feedback that the action did something even when they mis-target.

This level is where the per-action budget teaches itself: spending the Move on the crate — which is legal, crates are movable entities (§3) — leaves the character able to reach only `(3, 2)`, one cell short, with Move already at `0`. The lose condition still waits until *both* pools are empty.

### Level 6

A push-chain test level, not a difficulty step: it exists to exercise the full-loop case in §5.1.1 — a row filled edge-to-edge by every entity on the board, so a single Move has to push all the way around the wraparound board and back into the mover's own tile.

| Field | Value |
|---|---|
| Grid | 5×5, no walls |
| Character start | `(1, 2)` |
| Crates | `(0, 2)`, `(2, 2)`, `(3, 2)`, `(4, 2)` |
| Goal | `(2, 2)` |
| Available actions | Move only |
| Action budget | Move: 1 |

Row `y = 2` holds five entities on a five-wide board — every tile on that row is occupied. `entities.crates` starts one of its four crates sitting on the goal tile itself, which is legal and does nothing (§4) — the goal only cares what the *character* is standing on.

**Intended solution:** Move the character `Right`. `resolveMoveChain` walks `(1,2) → (2,2) → (3,2) → (4,2) → (0,2) → (1,2)` — six tiles, because the sixth step wraps back to the character's own starting tile, having visited every occupied tile on the row exactly once (§5.1.1 case 3). The chain resolves as a full-row rotation:

- Character `(1, 2) → (2, 2)` = goal → **win**
- Crate `(2, 2) → (3, 2)`
- Crate `(3, 2) → (4, 2)`
- Crate `(4, 2) → (0, 2)`
- Crate `(0, 2) → (1, 2)`

One Move, zero slack, and it only works because the full-loop case resolves as a rotation rather than rejecting the move — if it were treated as blocked instead, this exact level would be unsolvable with the budget given.
