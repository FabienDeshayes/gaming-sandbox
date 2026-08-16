# Bibou — Level Design

> Companion to [`DESIGN.md`](./DESIGN.md). That document covers the pitch, loop, and scope. This one specifies the board, coordinate system, and action mechanics precisely enough to implement, and defines each level's data.

> **Doc convention:** this doc describes the game *as it is now* — edit sections in place when things change, rather than logging what changed (see `DESIGN.md`). To verify a level actually plays as specified here, see [`TESTING.md`](./TESTING.md).

## 1. Board

The **Board** is the whole 5×5 tile grid for a level — the union of all three layers.

- **Size:** 5×5 tiles, fixed for now (all levels in this doc use this size).
- **Layers:**
  - **Background layer** (static): floor and the goal tile, indexed by tile coordinate like the Entity layer. Never changes during play.
  - **Wall layer** (static): a set of *edges* between adjacent tiles — see §1.2. Not indexed by tile coordinate at all; this is the layer that "doesn't follow the same coordinate system" the other two do.
  - **Entity layer** (movable): the character and crates. Every action reads and writes this layer only — the Background and Wall layers are read-only during play.

### 1.1 Background tile types

| Tile type | Notes |
|---|---|
| Floor | Default background tile; entities can freely move onto it. |
| Goal | Triggers win when the character's Entity-layer cell lands on it (§4). |

### 1.2 Wall layer

A **wall** blocks entity movement between exactly two tiles, in both directions. It is expressed as a pair of tile coordinates — the two tiles it sits between — rather than as a coordinate of its own, since a wall lives on the edge shared by two tiles, not on a tile:

```json
{ "walls": [[{ "x": 0, "y": 1 }, { "x": 0, "y": 2 }]] }
```

This one wall stops an entity moving between `(0,1)` and `(0,2)` in either direction; it says nothing about any other pair of tiles, including ones that are diagonally or otherwise near it.

**Validity.** A wall's two coordinates must be **cardinally adjacent** — exactly one cell apart on exactly one axis. Two exceptions/clarifications:

- **Diagonal pairs are invalid.** A wall never connects two tiles that differ on both axes.
- **Non-adjacent pairs are invalid.** A wall never connects two tiles that are more than one step apart on the same row/column (e.g. `(0,0)` and `(2,0)`).
- **Wraparound is the one case where "one step apart" isn't "adjacent indices."** Because the board loops (§2.1), the tile at index `0` and the tile at index `size - 1` on the same row/column are cardinally adjacent through the seam, even though their coordinates are `size - 1` apart. A wall between them is valid, and it is the *only* combination of far-apart indices that is: for a fixed `size`, index pairs `size - 1` apart are exactly `{0, size - 1}`, so no other "distance `size - 1`" pair can occur on an in-range board.

Levels are checked against these rules when they're loaded (`validateLevelWalls` in `src/core/rules.js`, called for every entry in `src/data/levels.js`'s `LEVELS`) — an invalid wall throws immediately rather than silently drawing or blocking the wrong thing.

**Rendering.** A wall draws as a brick-coloured band with mortar joints (prototype styling, `DESIGN.md` §10) on the edge its two tiles share. A wraparound wall has no shared edge on screen — its two tiles are drawn on opposite sides of the board — so it draws as two segments instead, one on each tile's outer board edge. Both segments are one logical wall; see `BoardView.drawWalls`/`drawBrickSegment`.

**Legality by action.** Move, Rotate, and Shift each move an entity exactly one cardinal step at a time, so each checks the wall between an entity's current tile and the tile it's about to step onto — see §5.1/§5.2/§5.3 for exactly how. Flip does not check walls at all: it reflects an entity directly to its mirrored coordinate rather than stepping it across the board, so it never crosses an edge in the sense a wall guards — see §5.4.

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
- Wraparound itself is unconditional — computing the wrapped destination never fails, and the edge itself never blocks a move. Whether the move actually succeeds still depends on what's between the source and destination tile: a wraparound wall (§1.2) blocks a wrapped step for exactly the same reason a regular wall blocks a non-wrapped one.

Moving off one side of the board is therefore always legal *as far as the edge is concerned* and lands on the opposite side, subject only to the normal wall legality check (§1.2).

## 3. Entities

| Entity | Layer | Notes |
|---|---|---|
| Character | Entity | The thing the player is trying to get onto the goal tile. One per level (MVP). Not destructible, and never treats a collectible as an obstacle — see §5.5. |
| Crate | Entity | Any number per level, optional. **Destructible**: every action displaces a crate exactly as it displaces the character, a crate on the goal tile does nothing, Move can target a crate as readily as the character — but if it's ever crushed against something that can't move out of its way (a wall, or another stuck entity), it's destroyed instead of the whole action being rejected. See §5.5. |
| Collectible | Entity | Any number per level, optional (`entities.collectibles`, §6). Occupies a tile exactly like a crate — Move/Shift/Rotate can displace one — but it's **indestructible**: when it can't move out of the way, it just stays put and becomes an obstruction rather than being destroyed. The character is the sole exception to all of this: it never treats a collectible as an obstacle, always picking one up (instantly, whether or not that collectible could otherwise have moved) instead of blocking on or pushing it. A collectible with `required: true` gates the win condition — see §4. Not yet pickable by crates; per the game's design notes, only the character (and, later, enemies) can collect one. |
| Goal | Background | A single tile marked as the win condition. Static — part of the Background layer, not something that moves. |

**No two entities may occupy the same tile at rest.** When Move would displace an entity onto a tile another entity already occupies, the entity already there is pushed one step further in the same direction first — and if *that* tile is occupied too, the push cascades down the chain before anything actually moves. See §5.1 for exactly how a push chain resolves, including the case where the chain wraps all the way around the board, and §5.5 for what happens when that chain runs into a wall instead of an open tile. The one moment two entities *do* share a tile is transiently when the character picks up a collectible — resolved instantly as part of the same action, never left as board state.

Pushing is a Move-only concern in the ordinary (unblocked) case. Rotate, Shift, and Flip each displace every entity they affect in one simultaneous reshuffle — a permutation of positions, not a sequence of single-entity displacements — so two entities can never end up sharing a tile as a result of those actions when nothing is blocked. Move is the only action where one entity moves into a tile that isn't moving along with it, so it's the only one that ever needs to push a *chain*; Rotate and Shift instead resolve a *blocked* reshuffle with the same peeling logic Move uses (§5.5), just walked around a ring or along a row/column instead of from a single mover.

Since entities never share a tile outside of an in-progress action, a Move tap on a cell always targets the one entity present there; the character is still drawn above crates and collectibles in `BoardView` for legibility, but that no longer needs to break a tie.

## 4. Win condition

Checked automatically after every action resolves: if the Entity-layer cell holding the character has the same `(x, y)` as the Board-layer goal tile, **and** every `required` collectible the level places has already been picked up, the level is won.

Reaching the goal while a required collectible is still outstanding does nothing — no win, no penalty, the action is still spent. The goal marker itself reflects this: it draws as 🔒 while any required collectible remains, and swaps to ★ the instant the last one is picked up (`BoardView.setGoalLocked`), so a player standing on a locked goal can see why nothing happened without reading the hint text. A level with no collectibles, or none marked `required`, behaves exactly as before this section existed — the goal is always ★ and any entry is a win.

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
| Parameters | `startTile: (x, y)` — always the character's current tile (see Target selection); `direction: Up \| Down \| Left \| Right` |
| Effect | The character, at `startTile`, is displaced to the adjacent tile in `direction`, with wraparound applied (§2.1). If that destination tile is occupied, the entity there is displaced one step further in `direction` first, and so on down the chain (§5.1.1) — every entity in the chain ends up shifted one step. The Background and Wall layers are untouched. |
| Legality | Walking the push chain from `startTile` in `direction` must not cross a wall (§1.2) before it resolves. |
| Cost | 1 Move |
| Target selection | Move always targets the character — there is only ever one, so there's no tap-to-select step. Tapping the Move card immediately shows four directional arrows around the character; tap an arrow **or** swipe in a cardinal direction to choose the direction. Choosing the direction executes the move immediately — there is no separate confirm step (per `DESIGN.md` §5). Crates cannot be targeted directly; they only move when the character's push chain (§5.1.1) reaches them. |

Direction deltas: `Up = (0, -1)`, `Down = (0, +1)`, `Left = (-1, 0)`, `Right = (+1, 0)`.

Example (no push): character at `(4, 2)` moves `Right` → destination `x = (4 + 1) % 5 = 0` → character ends at `(0, 2)`.

#### 5.1.1 Push chains

Moving an entity onto an occupied tile pushes a chain, not just one neighbour: starting at `startTile`, walk the line of tiles in `direction` — `startTile`, then one step further, then one step further again — following whichever entity occupies each tile, until one of three things happens:

1. **An unoccupied tile is found.** The chain resolves there: every entity from `startTile` up to (but not including) that tile shifts one step forward into the next tile in the chain. This is the common case — pushing one crate, or a crate that pushes another crate.
2. **A wall is hit** (§1.2) — the next step in the walk would cross a wall. If nothing in the chain is destructible, the whole move is illegal and nothing moves — same as any other illegal action (`DESIGN.md` §5). If a crate is crushed against the wall (or against something else in the chain that can't move), it's destroyed instead — see §5.5. Level 7 (§7) is built to exercise the plain-illegal case, including the wraparound wall variant in Level 8; Levels 10–11 exercise the destruction case.
3. **The walk wraps all the way back to `startTile` itself**, because the board is borderless (§2.1) and every tile on that row/column is occupied by an entity. There is no open tile to resolve into, but this is *not* a deadlock: every entity in the chain still shifts one step forward, including the entity that was at `startTile` — the net effect is the entire line rotating by one, identical to a Shift on that line. This is the case Level 6 (§7) is built to exercise.

Implementation: `resolveMoveChain` (in `src/core/rules.js`, taking a wall lookup built by `buildWallSet` rather than the raw level) walks the chain and returns a discriminated result — `{ kind: 'open' | 'loop', path }` for cases 1 and 3 (`applyMoveChain` then shifts every entity in `path` forward by one), or `{ kind: 'pickup' | 'destroy' | 'illegal', ... }` for case 2 and the character's own pickup shortcut — see §5.5 for what each of those means.

Example (push, no loop): row has crates at `(2, 2)` and `(3, 2)`, character at `(1, 2)`. Character moves `Right`: destination `(2, 2)` is occupied, so the chain walks to `(3, 2)` (also occupied), then to `(4, 2)` (open) — chain resolves. Character ends at `(2, 2)`, the first crate at `(3, 2)`, the second crate at `(4, 2)`.

Example (full-loop push): see Level 6 (§7) — a row completely filled by 5 entities, where a single Move rotates the whole row by one.

### 5.2 Rotate

| Field | Value |
|---|---|
| Parameters | `center: (x, y)` — the tile at the middle of the rotation; `direction: Clockwise \| Anticlockwise` |
| Effect | The 8 tiles surrounding `center` (its Chebyshev-distance-1 neighbours, with wraparound §2.1) form a ring. Each tile's Entity-layer contents shift **one step** around that ring in `direction`. The `center` tile itself is untouched, as are the Background and Wall layers. Empty ring tiles "rotate" too — they just carry nothing. |
| Legality | Empty tiles are always allowed to rotate. If any occupied ring tile's one-step move to its next ring position would cross a wall (§1.2), the **whole** rotation is illegal and rejected before anything moves — same all-or-nothing rule as Move's push chain, just checked across every entity on the ring instead of one chain. |
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
| Effect | Every entity currently on the Entity layer at `y = index` (row) or `x = index` (column) moves one cell in `direction`, with wraparound (§2.1). Tiles on that row/column not holding an entity stay empty; the Background and Wall layers are untouched. |
| Legality | A row/column with no entity on it "shifts" without visible effect and is always legal. If any occupied tile's one-step move would cross a wall (§1.2), the whole shift is illegal and rejected before anything moves — same all-or-nothing rule as Rotate. |
| Cost | 1 Shift |
| Target selection | Tap the Shift card → arrows appear immediately around **every** row and column edge, pointing inward (`▶` on the left edge / `◀` on the right edge of each row; `▼` above / `▲` below each column) → tap one arrow to shift that row or column in that direction and execute immediately. Unlike Move/Rotate, there is no separate tap-a-target step first — which arrow you tap picks the row/column *and* the direction in one gesture. |

Example: `line = { axis: Row, index: 3 }`, `direction = Right`, character at `(2, 3)` → destination `x = (2 + 1) % 5 = 3` → character ends at `(3, 3)`; a character on any other row is unaffected.

### 5.4 Flip

The board's highest-impact action: it mirrors the **entire** entity layer in one use, so every entity moves at once and an entity can cross the whole board in a single action.

| Field | Value |
|---|---|
| Parameters | `axis: Row \| Column` — the **mirror line**, i.e. the middle row or the middle column of the board |
| Effect | Every entity on the Entity layer is reflected across that middle line. `axis: Row` mirrors across the middle row, so `y` flips and the board turns top-to-bottom; `axis: Column` mirrors across the middle column, so `x` flips and the board turns left-to-right. The other coordinate is unchanged. The Background and Wall layers are untouched — the goal tile does **not** move. |
| Legality | Always legal: mirroring never leaves the grid, and Flip never checks walls (§1.2). A wall blocks movement between two adjacent tiles that an entity steps across; Flip reflects an entity straight to its mirrored coordinate without stepping through anything in between, so there's no edge for a wall to guard here — unlike Move, Rotate, and Shift, which all move one cardinal step at a time. |
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

### 5.5 Destruction and pickup at a jam

Move, Shift, and Rotate all resolve to the same underlying shape: entities lined up along a direction (a linear chain for Move, a row/column for Shift, the 8-tile ring for Rotate), each trying to step one cell forward into the next tile in that line. Ordinarily this always succeeds — the destination is open, or the whole line permutes at once with nothing left in anyone's way. This section covers what happens when a wall stops a tile in that line from ever opening up.

**Which entities are involved:**
- **The character** is never destructible, and never treats a collectible as an obstacle (see the character-yields case below) — it can still be blocked by a wall or by a stuck crate, exactly as before this mechanic existed.
- **Crates are destructible.** A crate that ends up unable to complete its forced move — because the tile ahead of it is a wall, or is occupied by an entity that itself can't move — is destroyed instead of the whole action being rejected.
- **Collectibles are indestructible.** A collectible that can't move just stays exactly where it is, becoming an obstruction for whatever's behind it. (Future enemies are expected to behave the same way as the character here: not destructible, and not yielding to a collectible either.)

**Resolution, per jammed run:** a "run" is a maximal, consecutive stretch of occupied tiles ending at a step that crosses a wall. Walk it from the tile touching the wall backward, toward whatever's pushing the run:

1. The tile touching the wall: if it holds a crate, that crate is destroyed and resolution for this run stops there. Otherwise (character or collectible) it just stays.
2. Each tile behind that, in turn, is evaluated against the entity immediately ahead of it (which by now is known to be staying put):
   - if the entity behind is the **character** and the one ahead is a **collectible**, the character picks it up and moves onto its tile — the one case in this whole section where something *does* advance, because it's the pre-existing pickup rule (§3), not new.
   - if the entity behind is a **collectible** and the one ahead is the **character** — the mirror image of the case above, where the character is the one stuck at (or nearer) the wall and the collectible is what's being pushed into it from behind — it's still a pickup: the character never treats a collectible as an obstacle regardless of which of the two was queued closer to the wall. The character stays exactly where it is (it has nothing to advance onto), and the collectible is simply consumed.
   - if the entity behind is a **crate**, it's destroyed, and resolution for this run stops there.
   - otherwise, it just stays too, and the walk continues one tile further back.
3. **Exactly one outcome — a single destruction or a single pickup — happens per jammed run**, whichever comes first walking backward from the wall. Everything else in that run, including the mover that initiated the action, does not move. If the walk never finds a crate to destroy or a character-behind-a-collectible to resolve as a pickup (e.g. the character alone hits a wall, or a run of collectibles all just sit there), nothing in the run changes at all — same as an ordinary blocked, illegal action: rejected, free, no cost.

An action still costs its budget if *any* run on the affected line/ring/chain produced a destruction or a pickup, even if nothing physically relocated — a crate visibly dying (or a collectible visibly vanishing into inventory) is enough of an effect to spend the action. It's only "nothing happened at all, anywhere" that's illegal and free. A part of the line/ring/chain not touching any wall is unaffected by all of this and moves normally in the same action.

**Move** is the special case of a single run, always starting at the character. Its own extra wrinkle: if the character's *very own* next step (not something being pushed ahead of it) lands on a collectible, that's always a pickup — regardless of whether the collectible could itself have moved further, and regardless of anything sitting beyond it. A collectible only ever needs the general jam logic above when something *other* than the character (a crate) is what's trying to displace it.

**Flip is exempt.** It reflects every entity straight to its mirrored coordinate without stepping through anything in between (§5.4), so there's never a "jam" for it to resolve — collectibles and crates move with it exactly like the character does, unconditionally.

**Rendering a destruction.** A destroyed crate doesn't just disappear: it nudges toward the tile it was crushed trying (and failing) to reach — `CRUSH_NUDGE_MS`, the same "hit something solid" read `animateBump` gives a directly wall-blocked Move — then bursts into a small ring of fragments that fly outward and fade (`EXPLOSION_TWEEN_MS`), rather than fading or shrinking in place. `dest` on a `destroy` outcome (from either `resolveMoveChain` or `resolveCycleOutcome`) is exactly that attempted tile, computed from the same directional step the rest of the jammed run was trying to take, and is what `BoardView.destroyEntitySprite` nudges toward.

Implementation: `resolveMoveChain` (Move) and `resolveCycleOutcome` (Shift/Rotate, via `rotationOrder`/`shiftOrder` to build the ordered ring/line) in `src/core/rules.js`; `BoardView.destroyEntitySprite`/`explodeAt` for the crushed-then-exploded animation.

## 6. Level data format

Suggested shape for encoding a level, for whoever implements level loading:

```json
{
  "id": 1,
  "gridSize": 5,
  "background": {
    "goal": { "x": 3, "y": 2 }
  },
  "walls": [
    [{ "x": 0, "y": 1 }, { "x": 0, "y": 2 }]
  ],
  "entities": {
    "character": { "x": 1, "y": 2 },
    "crates": [{ "x": 0, "y": 0 }],
    "collectibles": [{ "x": 1, "y": 0, "type": "key", "required": true }]
  },
  "actionBudget": {
    "move": 2,
    "flip": 1
  }
}
```

`entities.crates` is optional — omit it for a level with no crates. Each entry is one crate's starting position (§3).

`entities.collectibles` is optional — omit it for a level with no collectibles. Each entry is `{ x, y, type, required }` (§3): `type` selects the on-board glyph and the HUD label (`src/config.js`'s `COLLECTIBLE_GLYPHS`/`COLLECTIBLE_LABELS` — `"key"` is the only type so far); `required` (default `false` if omitted) marks whether the goal stays locked until that collectible is picked up (§4).

`walls` is optional — omit it for a level with no walls. Each entry is a `[a, b]` pair of cardinally adjacent tile coordinates naming one wall (§1.2); `validateLevelWalls` (`src/core/rules.js`) rejects an invalid pair when the level loads.

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

### Level 7

Introduces walls (§1.2). A wall sits directly between the character and the goal, so the 1-move direct approach is illegal.

| Field | Value |
|---|---|
| Grid | 5×5 |
| Character start | `(1, 2)` |
| Goal | `(2, 2)` |
| Walls | `(1, 2)`–`(2, 2)` |
| Available actions | Move only |
| Action budget | Move: 3 |

**Intended solution:** the wall blocks the 1-move direct path, so the character detours one row up, across, and back down:

1. Move `Up` → `(1, 2) → (1, 1)`.
2. Move `Right` → `(1, 1) → (2, 1)`.
3. Move `Down` → `(2, 1) → (2, 2)` = goal → **win**.

Going the other way around the board via wraparound (§2.1) would take 4 moves — the "long way" around a 5-wide row from an adjacent tile is `size - 1 = 4` steps — so it isn't a shortcut here; the 3-move detour through the next row is the actual shortest legal path, which is why the budget is exactly 3.

### Level 8

Exercises a **wraparound** wall (§1.2/§2.1): the wall sits on the seam between `x = 0` and `x = 4` on row `y = 2`, so the short way around the loop is blocked.

| Field | Value |
|---|---|
| Grid | 5×5 |
| Character start | `(1, 2)` |
| Goal | `(4, 2)` |
| Walls | `(0, 2)`–`(4, 2)` (wraparound) |
| Available actions | Move only |
| Action budget | Move: 3 |

Without the wall, the shortest path would be leftward through the wraparound seam — `(1,2) → (0,2) → (4,2)`, 2 moves. The wall sits on exactly that seam, so the second of those two moves is illegal; the character has to go the long way instead:

1. Move `Right` → `(1, 2) → (2, 2)`.
2. Move `Right` → `(2, 2) → (3, 2)`.
3. Move `Right` → `(3, 2) → (4, 2)` = goal → **win**.

Zero slack: 3 is the shortest path once the wraparound shortcut is blocked, and none of these three rightward moves cross the wall (it only ever blocks the specific `(0,2)`–`(4,2)` step).

### Level 9

Introduces collectibles (§3/§4): a `required` key the character must pick up before the goal will accept them.

| Field | Value |
|---|---|
| Grid | 5×5, no walls |
| Character start | `(1, 2)` |
| Collectibles | key at `(1, 0)`, `required: true` |
| Goal | `(3, 2)` |
| Available actions | Move only |
| Action budget | Move: 6 |

The goal sits directly 2 moves to the right of the start — the same shape as Level 1 — but the key sits off that line, so a player who ignores it and walks straight to the goal finds it locked (🔒, and the hint reads "Get the key first"): the 2 direct moves do nothing but spend the budget.

**Intended solution:** collect the key first, then go to the goal — either order of axes works once at the key:

1. Move `Up` → `(1, 2) → (1, 1)`.
2. Move `Up` → `(1, 1) → (1, 0)` = key → picked up; the HUD objective updates and the goal marker flips to ★.
3. Move `Right` → `(1, 0) → (2, 0)`.
4. Move `Right` → `(2, 0) → (3, 0)`.
5. Move `Down` → `(3, 0) → (3, 1)`.
6. Move `Down` → `(3, 1) → (3, 2)` = goal, key already held → **win**.

Zero slack: 6 is the shortest path that visits the key before the goal (2 moves up to the key, then 2 right + 2 down to the goal), and the budget doesn't leave room to try the direct 2-move path first and still recover — reaching the goal without the key wastes those moves rather than winning.

### Level 10

Introduces destructible crates (§5.5): the key sits stuck against a wall, and a crate sits directly between the character and it on the same row.

| Field | Value |
|---|---|
| Grid | 5×5 |
| Character start | `(0, 2)` |
| Crates | `(1, 2)` |
| Collectibles | key at `(2, 2)`, `required: true` |
| Goal | `(3, 2)` |
| Walls | `(2, 2)`–`(3, 2)` |
| Available actions | Move only |
| Action budget | Move: 6 |

The key can never step across the `(2,2)`–`(3,2)` wall, so it's permanently stuck the moment anything pushes it there. The crate sits right between the character and the key, so the direct approach immediately jams: character pushes crate, crate pushes key, key can't move — the crate is crushed (§5.5), and (per that section's "nothing behind a destruction advances" rule) the character itself does not move on that action either.

**Intended solution:**

1. Move `Right` → character pushes the crate into the stuck key; the crate is destroyed, the key stays put, the character stays at `(0, 2)` — 1 move spent, nothing moved.
2. Move `Right` → `(0, 2) → (1, 2)`, now empty.
3. Move `Right` → `(1, 2) →` the key's tile `(2, 2)` → the character's own direct step onto a collectible is always a pickup (§5.5) → key collected, character now at `(2, 2)`.
4. Move `Up` → `(2, 2) → (2, 1)`.
5. Move `Right` → `(2, 1) → (3, 1)`.
6. Move `Down` → `(3, 1) → (3, 2)` = goal, key already held → **win**.

Zero slack: going around the crate instead of destroying it (up, right, right, down to reach the key, then the same 3-move detour to the goal) costs 7 moves — one more than the budget allows — so the crate-crushing shortcut isn't optional flavor, it's the only way the level fits its budget.

### Level 11

The same layout and puzzle as Level 10, but the crate is crushed with the level's one Shift instead of a Move, to exercise the identical destruction rule (§5.5) through a different action.

| Field | Value |
|---|---|
| Grid | 5×5 |
| Character start | `(0, 2)` |
| Crates | `(1, 2)` |
| Collectibles | key at `(2, 2)`, `required: true` |
| Goal | `(3, 2)` |
| Walls | `(2, 2)`–`(3, 2)` |
| Available actions | Shift and Move |
| Action budget | Shift: 1, Move: 5 |

**Intended solution:**

1. Shift row `y = 2` **Right** → the same three-entity jam as Level 10 (character, crate, key, all on row 2), resolved the same way: the crate touching the key is destroyed, and — because nothing behind a destruction advances (§5.5) — neither the key nor the character move. 1 Shift spent, nothing moved but the crate.
2. Move `Right` → `(0, 2) → (1, 2)`.
3. Move `Right` → `(1, 2) →` key's tile `(2, 2)` → pickup.
4. Move `Up` → `(2, 2) → (2, 1)`.
5. Move `Right` → `(2, 1) → (3, 1)`.
6. Move `Down` → `(3, 1) → (3, 2)` = goal → **win**.

Zero slack in both pools: the level is solvable only by spending the single Shift on the crate (there's no other legal use for it that helps), and Move's budget of 5 is exactly what's left for the rest of the route.
