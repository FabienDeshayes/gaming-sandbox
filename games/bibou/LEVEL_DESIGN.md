# Bibou — Level Design

> Companion to [`DESIGN.md`](./DESIGN.md). That document covers the pitch, loop, and scope. This one specifies the board, coordinate system, and action mechanics precisely enough to implement, and defines each level's data.

> **Doc convention:** this doc describes the game *as it is now* — edit sections in place when things change, rather than logging what changed (see `DESIGN.md`). To verify a level actually plays as specified here, see [`TESTING.md`](./TESTING.md).

## 1. Board

The **Board** is the whole 5×5 tile grid for a level — the union of all three layers.

- **Size:** 5×5 tiles, fixed for now (all levels in this doc use this size).
- **Layers:**
  - **Background layer** (static): floor and the goal tile, indexed by tile coordinate like the Entity layer. Never changes during play.
  - **Wall layer** (static): a set of *edges* between adjacent tiles — see §1.2. Not indexed by tile coordinate at all; this is the layer that "doesn't follow the same coordinate system" the other two do.
  - **Entity layer** (movable): the character, crates, and collectibles. Every action reads and writes this layer only — the Background and Wall layers are read-only during play.

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

**Legality by action.** Move and Shift each move an entity exactly one cardinal step at a time, so each checks the wall between an entity's current tile and the tile it's about to step onto — see §5.1/§5.2 for exactly how. Flip does not check walls at all: it reflects an entity directly to its mirrored coordinate rather than stepping it across the board, so it never crosses an edge in the sense a wall guards — see §5.3. That asymmetry is a design tool, not an accident: a cell walled off on all four edges is unreachable by walking *and* unreachable by Shift, so **Flip is the only way in or out of a sealed cell** — which is exactly what Level 4 is built on.

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

The board has no edges — it loops. This applies to **any** entity movement on the board, regardless of which action causes it (Move and Shift). Flip (§5.3) is the exception, and only because it never needs wrapping: mirroring a coordinate inside the grid always lands inside the grid.

- If a move would take a coordinate to index `5` (or beyond), it wraps to index `0`.
- If a move would take a coordinate to index `-1` (or below), it wraps to index `4`.
- Formally, for board size `N` (currently 5): `newCoord = ((coord + delta) % N + N) % N`.
- Wraparound itself is unconditional — computing the wrapped destination never fails, and the edge itself never blocks a move. Whether the move actually succeeds still depends on what's between the source and destination tile: a wraparound wall (§1.2) blocks a wrapped step for exactly the same reason a regular wall blocks a non-wrapped one.

Moving off one side of the board is therefore always legal *as far as the edge is concerned* and lands on the opposite side, subject only to the normal wall legality check (§1.2).

## 3. Entities

| Entity | Layer | Notes |
|---|---|---|
| Character | Entity | The thing the player is trying to get onto the goal tile. One per level (MVP). Not destructible, and never treats a collectible as an obstacle — see §5.4. |
| Crate | Entity | Any number per level, optional. **Destructible**: every action displaces a crate exactly as it displaces the character, a crate on the goal tile does nothing, Move can target a crate as readily as the character — but if it's ever crushed against something that can't move out of its way (a wall, or another stuck entity), it's destroyed instead of the whole action being rejected. See §5.4. A crate may also **contain a collectible** (`contains`, §6), which it drops onto the tile it died on the instant it's destroyed — the collectible is not on the board, and cannot be reached or displaced, until the crate breaks. |
| Collectible | Entity | Any number per level, optional (`entities.collectibles`, §6), plus any dropped by a broken crate. Occupies a tile exactly like a crate — Move and Shift can displace one — but it's **indestructible**: when it can't move out of the way, it just stays put and becomes an obstruction rather than being destroyed. The character is the sole exception to all of this: it never treats a collectible as an obstacle, always picking one up (instantly, whether or not that collectible could otherwise have moved) instead of blocking on or pushing it. A collectible with `required: true` gates the win condition — see §4. Not yet pickable by crates; per the game's design notes, only the character (and, later, enemies) can collect one. |
| Goal | Background | A single tile marked as the win condition. Static — part of the Background layer, not something that moves. |

**No two entities may occupy the same tile at rest.** When Move would displace an entity onto a tile another entity already occupies, the entity already there is pushed one step further in the same direction first — and if *that* tile is occupied too, the push cascades down the chain before anything actually moves. See §5.1 for exactly how a push chain resolves, including the case where the chain wraps all the way around the board, and §5.4 for what happens when that chain runs into a wall instead of an open tile. The one moment two entities *do* share a tile is transiently when the character picks up a collectible — resolved instantly as part of the same action, never left as board state.

Pushing is a Move-only concern in the ordinary (unblocked) case. Shift and Flip each displace every entity they affect in one simultaneous reshuffle — a permutation of positions, not a sequence of single-entity displacements — so two entities can never end up sharing a tile as a result of those actions when nothing is blocked. Move is the only action where one entity moves into a tile that isn't moving along with it, so it's the only one that ever needs to push a *chain*; Shift instead resolves a *blocked* reshuffle with the same peeling logic Move uses (§5.4), just walked along a row/column instead of from a single mover.

Since entities never share a tile outside of an in-progress action, a Move tap on a cell always targets the one entity present there; the character is still drawn above crates and collectibles in `BoardView` for legibility, but that no longer needs to break a tie.

## 4. Win condition

Checked automatically after every action resolves: if the Entity-layer cell holding the character has the same `(x, y)` as the Board-layer goal tile, **and** every `required` collectible the level places has already been picked up, the level is won.

Reaching the goal while a required collectible is still outstanding does nothing — no win, no penalty. The goal marker itself reflects this: it draws as 🔒 while any required collectible remains, and swaps to ★ the instant the last one is picked up (`BoardView.setGoalLocked`), so a player standing on a locked goal can see why nothing happened without reading the hint text. A level with no collectibles, or none marked `required`, would have an always-★ goal, though every level currently ships a required key.

`requiredTypes` is computed from the level definition, not from what's on the board: a key sealed inside a crate (§3) counts from the moment the level loads, so the goal starts locked and the objective line names the key before the player has any way of seeing it.

### 4.1 There is no lose condition

Move is free and unlimited (§5.1), so a run can't run out of anything. A level *can* still be made unwinnable — spending the level's one Flip on the wrong axis in Level 4 leaves the key sealed for good — but the game doesn't attempt to detect that; proving a board unsolvable is not something the scene can do in general. Instead:

- a **retry button (↻)** sits in the HUD for the whole run, next to the exit button, and restarts the level immediately;
- once every action pool is empty, the resting hint changes to `No actions left — tap ↻ to retry`, so a stuck player is told where to go.

An action that changes nothing is also **free**: a Shift of a line with nothing on it, or one where every entity is walled against its step, is rejected with a hint and costs no budget (§5.2). That matters when a level grants exactly one Shift — probing the board to work out *which* line to shift must not be what loses the level.

## 5. Actions

Every action is defined by:
- **Name** — identifier shown on its card (Move has no card; see below).
- **Parameters** — the inputs needed to fully specify one use of the action.
- **Effect** — what it does to the Entity layer when executed.
- **Legality** — conditions checked before the action is allowed to run; an illegal action is rejected and costs nothing (per `DESIGN.md` §5).
- **Cost** — spent from **that action's own** budget on successful execution. Every budgeted action costs 1 use of itself and nothing from any other action's pool (§6).

There are two tiers. **Move is free and unlimited** — no card, no budget, no selection step, available on every level. **Shift and Flip are budgeted**, and a level grants each of them its own small pool (usually exactly 1). A level's difficulty is which budgeted action to spend and on what, never how many steps it took to walk there.

### 5.1 Move

| Field | Value |
|---|---|
| Parameters | `startTile: (x, y)` — always the character's current tile (see Target selection); `direction: Up \| Down \| Left \| Right` |
| Effect | The character, at `startTile`, is displaced to the adjacent tile in `direction`, with wraparound applied (§2.1). If that destination tile is occupied, the entity there is displaced one step further in `direction` first, and so on down the chain (§5.1.1) — every entity in the chain ends up shifted one step. The Background and Wall layers are untouched. |
| Legality | Walking the push chain from `startTile` in `direction` must not cross a wall (§1.2) before it resolves. |
| Cost | **None.** Move is unlimited: it never appears in `actionBudget`, never draws down a pool, and can never end a level. It's counted (the HUD shows a running `Moves:` tally, and the win overlay reports it) but never limited. |
| Target selection | Move always targets the character — there is only ever one, so there's no tap-to-select step, and no card either. Whenever no action card is selected, four directional arrows sit around the character; tap an arrow **or** swipe in a cardinal direction anywhere on screen to move. Choosing the direction executes the move immediately. Crates cannot be targeted directly; they only move when the character's push chain (§5.1.1) reaches them. |

Direction deltas: `Up = (0, -1)`, `Down = (0, +1)`, `Left = (-1, 0)`, `Right = (+1, 0)`.

Example (no push): character at `(4, 2)` moves `Right` → destination `x = (4 + 1) % 5 = 0` → character ends at `(0, 2)`.

**Implementation note on the arrows.** The four Move arrows are created once per level and then repositioned and shown/hidden — never destroyed and rebuilt like every other control. Phaser only folds a newly-interactive object into its hit-test list on the *following* frame, so arrows rebuilt at the end of each move would be visible but untappable for a frame. Hiding them keeps them permanently in that list, and a hidden object fails Phaser's `willRender` check, so it can't be tapped while it's parked. See `BoardView.showMoveArrows`/`hideMoveArrows`.

#### 5.1.1 Push chains

Moving an entity onto an occupied tile pushes a chain, not just one neighbour: starting at `startTile`, walk the line of tiles in `direction` — `startTile`, then one step further, then one step further again — following whichever entity occupies each tile, until one of three things happens:

1. **An unoccupied tile is found.** The chain resolves there: every entity from `startTile` up to (but not including) that tile shifts one step forward into the next tile in the chain. This is the common case — pushing one crate, or a crate that pushes another crate.
2. **A wall is hit** (§1.2) — the next step in the walk would cross a wall. If nothing in the chain is destructible, the whole move is illegal and nothing moves — same as any other illegal action (`DESIGN.md` §5). If a crate is crushed against the wall (or against something else in the chain that can't move), it's destroyed instead — see §5.4. Level 2 (§7) exercises the plain-illegal case; Level 3 exercises the destruction case.
3. **The walk wraps all the way back to `startTile` itself**, because the board is borderless (§2.1) and every tile on that row/column is occupied by an entity. There is no open tile to resolve into, but this is *not* a deadlock: every entity in the chain still shifts one step forward, including the entity that was at `startTile` — the net effect is the entire line rotating by one, identical to a Shift on that line.

Implementation: `resolveMoveChain` (in `src/core/rules.js`, taking a wall lookup built by `buildWallSet` rather than the raw level) walks the chain and returns a discriminated result — `{ kind: 'open' | 'loop', path }` for cases 1 and 3 (`applyMoveChain` then shifts every entity in `path` forward by one), or `{ kind: 'pickup' | 'destroy' | 'illegal', ... }` for case 2 and the character's own pickup shortcut — see §5.4 for what each of those means.

Example (push, no loop): row has crates at `(2, 2)` and `(3, 2)`, character at `(1, 2)`. Character moves `Right`: destination `(2, 2)` is occupied, so the chain walks to `(3, 2)` (also occupied), then to `(4, 2)` (open) — chain resolves. Character ends at `(2, 2)`, the first crate at `(3, 2)`, the second crate at `(4, 2)`.

### 5.2 Shift

| Field | Value |
|---|---|
| Parameters | `line: { axis: Row \| Column, index }` — which row (`y = index`) or column (`x = index`) to shift; `direction: Left \| Right` for a row, `Up \| Down` for a column |
| Effect | Every entity currently on the Entity layer at `y = index` (row) or `x = index` (column) moves one cell in `direction`, with wraparound (§2.1). Tiles on that row/column not holding an entity stay empty; the Background and Wall layers are untouched. |
| Legality | If any occupied tile's one-step move would cross a wall (§1.2), that entity and anything queued behind it are resolved by §5.4 — crushed, collected, or left standing. A shift that changes nothing at all — an empty line, or one where every entity is walled in place with nothing to sacrifice — is rejected and **costs nothing**. |
| Cost | 1 Shift, unless it was rejected as a no-op above. |
| Target selection | Tap the Shift card → arrows appear immediately around **every** row and column edge, pointing inward (`▶` on the left edge / `◀` on the right edge of each row; `▼` above / `▲` below each column) → tap one arrow to shift that row or column in that direction and execute immediately. There is no separate tap-a-target step first — which arrow you tap picks the row/column *and* the direction in one gesture. A rejected (free) shift leaves the card selected, so the next arrow can be tried straight away. |

Example: `line = { axis: Row, index: 3 }`, `direction = Right`, character at `(2, 3)` → destination `x = (2 + 1) % 5 = 3` → character ends at `(3, 3)`; a character on any other row is unaffected.

**What Shift is for.** Because Shift respects walls exactly as Move does, it can never reach a tile Move can't. Its distinctive powers are the other two:

- **It acts at a distance.** It moves entities the character isn't standing next to — including ones the character will never be next to.
- **It pushes from a side the character can't occupy.** Move can only push an entity in direction `d` if the character can stand on the tile behind it; Shift needs no pusher at all. An entity walled in on the shift axis is therefore crushable by Shift and by nothing else, which is exactly what Level 5 (§7) is built on.

### 5.3 Flip

The board's highest-impact action: it mirrors the **entire** entity layer in one use, so every entity moves at once and an entity can cross the whole board in a single action.

| Field | Value |
|---|---|
| Parameters | `axis: Row \| Column` — the **mirror line**, i.e. the middle row or the middle column of the board |
| Effect | Every entity on the Entity layer is reflected across that middle line. `axis: Row` mirrors across the middle row, so `y` flips and the board turns top-to-bottom; `axis: Column` mirrors across the middle column, so `x` flips and the board turns left-to-right. The other coordinate is unchanged. The Background and Wall layers are untouched — the goal tile and the walls do **not** move. |
| Legality | Always legal: mirroring never leaves the grid, and Flip never checks walls (§1.2). A wall blocks movement between two adjacent tiles that an entity steps across; Flip reflects an entity straight to its mirrored coordinate without stepping through anything in between, so there's no edge for a wall to guard here — unlike Move and Shift, which both move one cardinal step at a time. |
| Cost | 1 Flip |
| Target selection | Tap the Flip card → both mirror lines highlight, with `↔` above the middle column and `↕` to the left of the middle row → tap one arrow, **or** swipe horizontally (mirror across the middle column) / vertically (mirror across the middle row), to execute immediately. Like Shift, there is no separate tap-a-target step — Flip always affects the whole board, so the only choice is which line to mirror across. |

**Formula.** For board size `N`, mirroring coordinate `c` gives `N - 1 - c`:

- `axis: Row` → `(x, y)` becomes `(x, N - 1 - y)`
- `axis: Column` → `(x, y)` becomes `(N - 1 - x, y)`

No wraparound is involved (§2.1) — the mirror of an in-range coordinate is always in range.

**Properties worth designing around:**

- **Flip ignores walls, and it's the only thing that does.** A cell sealed on all four edges can't be walked into and can't be shifted out of, but its contents flip out of it freely — because the walls stay where they are while the entity teleports. This is the single most important design lever in the game, and Level 4 is built entirely on it.
- **Flip is its own inverse.** Flipping twice across the same line returns every entity to where it started, wasting two actions.
- **The middle line is a fixed point.** On the 5×5 board, an entity at `y = 2` is unmoved by a row flip, and one at `x = 2` is unmoved by a column flip. An entity at `(2, 2)` is unmoved by either. The two mirror lines are highlighted while Flip is selected precisely so this is visible before committing — and putting a sealed key *on* one of those lines is how Level 4 makes the axis choice matter.
- **Distance travelled depends on where you are.** An entity on an edge (`0` or `4`) jumps 4 cells; one adjacent to the middle jumps 2. Flip is strongest from the edges and weakest near the center.
- **The goal never moves,** so a flip changes the character's relationship to the goal — unlike Shift, it can close a large gap or open one just as fast.

Example: `axis: Column` on a 5×5 board, character at `(1, 1)` → `x = 5 - 1 - 1 = 3` → character ends at `(3, 1)`. A crate at `(0, 0)` moves to `(4, 0)` in the same action.

### 5.4 Destruction and pickup at a jam

Move and Shift both resolve to the same underlying shape: entities lined up along a direction (a linear chain for Move, a row/column for Shift), each trying to step one cell forward into the next tile in that line. Ordinarily this always succeeds — the destination is open, or the whole line permutes at once with nothing left in anyone's way. This section covers what happens when a wall stops a tile in that line from ever opening up.

**Which entities are involved:**
- **The character** is never destructible, and never treats a collectible as an obstacle (see the character-yields case below) — it can still be blocked by a wall or by a stuck crate.
- **Crates are destructible.** A crate that ends up unable to complete its forced move — because the tile ahead of it is a wall, or is occupied by an entity that itself can't move — is destroyed instead of the whole action being rejected. If it was carrying a collectible (§3), that collectible appears on the crate's own tile as it dies.
- **Collectibles are indestructible.** A collectible that can't move just stays exactly where it is, becoming an obstruction for whatever's behind it. (Future enemies are expected to behave the same way as the character here: not destructible, and not yielding to a collectible either.)

**Resolution, per jammed run:** a "run" is a maximal, consecutive stretch of occupied tiles ending at a step that crosses a wall. Walk it from the tile touching the wall backward, toward whatever's pushing the run:

1. The tile touching the wall: if it holds a crate, that crate is destroyed and resolution for this run stops there. Otherwise (character or collectible) it just stays.
2. Each tile behind that, in turn, is evaluated against the entity immediately ahead of it (which by now is known to be staying put):
   - if the entity behind is the **character** and the one ahead is a **collectible**, the character picks it up and moves onto its tile — the one case in this whole section where something *does* advance, because it's the pre-existing pickup rule (§3), not new.
   - if the entity behind is a **collectible** and the one ahead is the **character** — the mirror image of the case above, where the character is the one stuck at (or nearer) the wall and the collectible is what's being pushed into it from behind — it's still a pickup: the character never treats a collectible as an obstacle regardless of which of the two was queued closer to the wall. The character stays exactly where it is (it has nothing to advance onto), and the collectible is simply consumed.
   - if the entity behind is a **crate**, it's destroyed, and resolution for this run stops there.
   - otherwise, it just stays too, and the walk continues one tile further back.
3. **Exactly one outcome — a single destruction or a single pickup — happens per jammed run**, whichever comes first walking backward from the wall. Everything else in that run, including the mover that initiated the action, does not move. If the walk never finds a crate to destroy or a character-behind-a-collectible to resolve as a pickup (e.g. the character alone hits a wall, or a run of collectibles all just sit there), nothing in the run changes at all — same as an ordinary blocked, illegal action: rejected, free, no cost.

An action still costs its budget if *any* run on the affected line/chain produced a destruction or a pickup, even if nothing physically relocated — a crate visibly dying (or a collectible visibly vanishing into inventory) is enough of an effect to spend the action. It's only "nothing happened at all, anywhere" that's rejected and free. A part of the line/chain not touching any wall is unaffected by all of this and moves normally in the same action.

**Move** is the special case of a single run, always starting at the character. Its own extra wrinkle: if the character's *very own* next step (not something being pushed ahead of it) lands on a collectible, that's always a pickup — regardless of whether the collectible could itself have moved further, and regardless of anything sitting beyond it. A collectible only ever needs the general jam logic above when something *other* than the character (a crate) is what's trying to displace it.

**Flip is exempt.** It reflects every entity straight to its mirrored coordinate without stepping through anything in between (§5.3), so there's never a "jam" for it to resolve — collectibles and crates move with it exactly like the character does, unconditionally.

**Rendering a destruction.** A destroyed crate doesn't just disappear: it nudges toward the tile it was crushed trying (and failing) to reach — `CRUSH_NUDGE_MS`, the same "hit something solid" read `animateBump` gives a directly wall-blocked Move — then bursts into a small ring of fragments that fly outward and fade (`EXPLOSION_TWEEN_MS`), rather than fading or shrinking in place. `dest` on a `destroy` outcome (from either `resolveMoveChain` or `resolveCycleOutcome`) is exactly that attempted tile, computed from the same directional step the rest of the jammed run was trying to take, and is what `BoardView.destroyEntitySprite` nudges toward. A collectible the crate was carrying pops into place on the crate's own tile as the fragments clear (`SPAWN_TWEEN_MS`, `BoardView.spawnEntitySprite`).

Implementation: `resolveMoveChain` (Move) and `resolveCycleOutcome` (Shift, via `shiftOrder` to build the ordered line) in `src/core/rules.js`; `BoardView.destroyEntitySprite`/`explodeAt`/`spawnEntitySprite` for the crushed-then-exploded-then-revealed animation.

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
    "crates": [
      { "x": 0, "y": 0 },
      { "x": 2, "y": 2, "contains": { "type": "key", "required": true } }
    ],
    "collectibles": [{ "x": 1, "y": 0, "type": "key", "required": true }]
  },
  "actionBudget": {
    "flip": 1
  }
}
```

`entities.crates` is optional — omit it for a level with no crates. Each entry is one crate's starting position (§3), plus an optional `contains: { type, required }`: the collectible that crate is holding, which drops onto its tile when it's destroyed (§5.4). A crate's contents count toward the level's required collectibles from the moment it loads, so the goal starts locked even though the key isn't on the board yet (§4).

`entities.collectibles` is optional — omit it for a level with no loose collectibles. Each entry is `{ x, y, type, required }` (§3): `type` selects the on-board glyph and the HUD label (`src/config.js`'s `COLLECTIBLE_GLYPHS`/`COLLECTIBLE_LABELS` — `"key"` is the only type so far); `required` (default `false` if omitted) marks whether the goal stays locked until that collectible is picked up (§4).

`walls` is optional — omit it for a level with no walls. Each entry is a `[a, b]` pair of cardinally adjacent tile coordinates naming one wall (§1.2); `validateLevelWalls` (`src/core/rules.js`) rejects an invalid pair when the level loads.

**`actionBudget` is per action type, in two senses:**

1. **Which actions the level offers.** An action type absent from the map, or set to `0`, cannot be used at all — this is how Levels 1–3 offer no cards whatsoever. Only the listed actions get a card.
2. **How many times each may be used.** Each key is that action's own private pool. Using Flip draws down `flip` and nothing else, so `{ "shift": 1, "flip": 1 }` means *exactly one Shift and exactly one Flip* — not "two actions, spend them however you like".

**Move is never listed.** It's free and unlimited on every level (§5.1), so `"actionBudget": {}` is a complete, valid budget: a pure movement puzzle with no cards at all.

Each card displays its own remaining count and greys out when spent. In Test mode every pool is unlimited.

This is the main knob for level difficulty. Levels usually grant exactly **one** use of exactly **one** action, so the puzzle is identifying the single right target for it — see §4.1 on why getting that wrong costs a retry rather than a loss.

## 7. Levels

Every level places exactly one `required` key, either loose on the board or sealed inside a crate, so the shape of every puzzle is *find the key, then reach the exit*. The five levels each introduce exactly one idea, in order: walking and the lock, wraparound, crates and crushing, Flip, Shift.

### Level 1 — the key and the door

Teaches the whole loop with no actions at all: swipe to walk, and the goal doesn't open until you're holding the key.

| Field | Value |
|---|---|
| Grid | 5×5, no walls |
| Character start | `(1, 2)` |
| Collectibles | key at `(2, 0)`, `required: true` |
| Goal | `(3, 2)` |
| Available actions | None (Move only, free and unlimited) |

The goal sits 2 steps directly right of the start, so walking straight at it is the obvious first thing a player tries — and it does nothing: the marker reads 🔒 and the hint says `Get the key first`. Because moves are free, that mistake *teaches* the lock instead of punishing it, which is the point of putting the key off the direct line.

**Intended solution:** `Right`, `Up`, `Up` to `(2, 0)` collects the key (the marker flips to ★ and the objective line updates), then `Right`, `Down`, `Down` to `(3, 2)` = goal → **win**. Six moves, though any route works.

### Level 2 — the board has no edges

Teaches wraparound (§2.1) by making the seam the *only* way in.

| Field | Value |
|---|---|
| Grid | 5×5 |
| Character start | `(1, 2)` |
| Collectibles | key at `(0, 2)`, `required: true` |
| Goal | `(3, 2)` |
| Walls | `(0,1)`–`(0,2)`, `(0,2)`–`(0,3)`, `(0,2)`–`(1,2)` |
| Available actions | None (Move only) |

The key's tile has four edges. Three of them are walled: up to `(0,1)`, down to `(0,3)`, and right to `(1,2)`. The fourth is the wraparound edge to `(4,2)`, which is deliberately left open — so the character has to walk *off* the right-hand side of the board to get in, and back out the same way.

**Intended solution:**

1. `Right` ×3 → `(1,2) → (4,2)`, passing over the locked goal at `(3,2)` on the way, which shows the 🔒 in passing.
2. `Right` → wraps to `(0,2)` = key → collected.
3. `Left` → wraps back to `(4,2)`; `Left` → `(3,2)` = goal → **win**.

Walking straight at the key from `(1,2)` is the natural first attempt and is rejected with the wall bump, which is what sends the player looking for the other way round.

### Level 3 — the key is inside the crate

Introduces crates, pushing (§5.1.1), and the crate-carries-a-collectible rule (§3/§5.4). Still no action cards — this is all Move.

| Field | Value |
|---|---|
| Grid | 5×5 |
| Character start | `(0, 2)` |
| Crates | `(1, 2)`, containing a `required` key |
| Goal | `(3, 2)` |
| Walls | `(2,2)`–`(3,2)` |
| Available actions | None (Move only) |

The key is nowhere on the board at the start — the objective line names it anyway, which is the hint that it must be inside something. The board's single wall is the tool: a crate crushed against it breaks open.

**Intended solution:**

1. `Right` → the crate is pushed from `(1,2)` to `(2,2)`; character to `(1,2)`.
2. `Right` → the crate's next step would cross the `(2,2)`–`(3,2)` wall, so it's crushed (§5.4) and drops its key on `(2,2)`. Nothing behind a destruction advances, so the character stays at `(1,2)`.
3. `Right` → the character's own step lands on the key → collected, character now at `(2,2)`.
4. `Up`, `Right`, `Down` → `(2,2) → (2,1) → (3,1) → (3,2)` = goal, detouring around the wall → **win**.

Six moves, but the count doesn't matter: pushing the crate the wrong way is fully recoverable, since the board is otherwise open and the character can always walk around and push it back.

### Level 4 — only Flip reaches through walls

Introduces Flip (§5.3) and the one thing it can do that nothing else can.

| Field | Value |
|---|---|
| Grid | 5×5 |
| Character start | `(0, 2)` |
| Crates | `(1, 1)` |
| Collectibles | key at `(2, 0)`, `required: true` |
| Goal | `(4, 2)` |
| Walls | `(1,0)`–`(2,0)`, `(2,0)`–`(3,0)`, `(2,0)`–`(2,1)`, `(2,0)`–`(2,4)` *(wraparound)* |
| Available actions | Flip |
| Action budget | Flip: 1 |

The key at `(2,0)` is sealed on **all four** edges, including the wraparound one down to `(2,4)`. No route reaches it and no shift could move it out (a wall blocks a shift exactly as it blocks a step, §5.2). Flip is the only action that ignores walls, so it's the only way in.

**The puzzle is the axis.** `(2,0)` sits on the middle column, which is a flip fixed point (§5.3): the `↔` arrow leaves the key exactly where it is and burns the level's only Flip. Only `↕` moves it, to `(2,4)` — a tile whose other three edges are open.

**Intended solution:**

1. Flip across the middle **row** (`↕`, or a vertical swipe) → key `(2,0) → (2,4)`. The character is at `y = 2`, the row-flip fixed line, so it doesn't move; the crate at `(1,1)` visibly jumps to `(1,3)`, confirming the flip did something even though the character didn't move.
2. `Down` ×2, `Right` ×2 → `(0,2) → (0,4) → (1,4) → (2,4)` = key → collected.
3. `Right` ×2, `Up` ×2 → `(2,4) → (4,4) → (4,2)` = goal → **win**.

The crate carries no rules here; it exists so the player can see the flip move the *whole* entity layer, and see it move while the key doesn't — which is the tell for the fixed-point rule. Spending the flip on the wrong axis makes the level unwinnable, which is what the retry button (§4.1) is for.

### Level 5 — Shift pushes from a side you can't stand on

Introduces Shift (§5.2) on a board where Move provably cannot do its job.

| Field | Value |
|---|---|
| Grid | 5×5 |
| Character start | `(0, 2)` |
| Crates | `(2, 2)`, containing a `required` key |
| Goal | `(4, 2)` |
| Walls | `(x,1)`–`(x,2)` and `(x,2)`–`(x,3)` for every `x` in `0..4` — 10 walls |
| Available actions | Shift |
| Action budget | Shift: 1 |

Those ten walls turn row `y = 2` into a **sealed one-tile corridor**: it's cut off from the rows above and below at every column, and it wraps, so it's a closed ring. The character, the crate, and the goal all live in it, and the character can never leave it.

**Why Move can't solve it.** The crate holds the key, so it has to be crushed. Crushing needs a wall in the push direction, and the only walls are the corridor's own — above and below every tile. To push the crate upward the character would have to stand *below* it and step up, but that step crosses a corridor wall and is illegal; likewise downward. Pushing left or right just slides the crate along the corridor forever, since there's no wall in the corridor to crush it against. So no sequence of moves, however long, can ever break the crate.

**Why Shift can.** Shift needs no pusher. Shifting the crate's **column** tries to step it straight into a corridor wall, and a crate that can't complete its forced move is destroyed (§5.4) — which drops the key inside the corridor, where the character can simply walk to it. Either direction works; the choice that matters is *which column*.

**Intended solution:**

1. Walk to a comfortable spot if you like — pushing the crate along the corridor is free and changes nothing structurally.
2. Shift the crate's column (`▼` or `▲` on that column) → the crate is crushed against the corridor wall and drops its key on its own tile. Shifting a column with nothing on row 2 is a free no-op, and shifting the character's own column is blocked and free (§4.1), so hunting for the right column costs nothing.
3. Walk onto the dropped key, then along the corridor to the goal at `(4,2)` → **win**.
