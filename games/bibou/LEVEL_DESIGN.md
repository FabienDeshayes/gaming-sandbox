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
3. **The walk wraps all the way back to `startTile` itself**, because the board is borderless (§2.1) and every tile on that row/column is occupied by an entity. There is no open tile to resolve into, but this is *not* a deadlock: every entity in the chain still shifts one step forward, including the entity that was at `startTile` — the net effect is the entire line rotating by one, identical to a Shift on that line. Level 6 (§7) is built entirely on this case: it packs a sealed corridor edge to edge, so rotating is the only way the character can move at all.

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

1. **Which actions the level offers.** An action type absent from the map, or set to `0`, cannot be used at all — this is how Levels 1–3 and 8–13 offer no cards whatsoever. Only the listed actions get a card.
2. **How many times each may be used.** Each key is that action's own private pool. Using Flip draws down `flip` and nothing else, so `{ "shift": 1, "flip": 1 }` means *exactly one Shift and exactly one Flip* — not "two actions, spend them however you like".

**Move is never listed.** It's free and unlimited on every level (§5.1), so `"actionBudget": {}` is a complete, valid budget: a pure movement puzzle with no cards at all.

Each card displays its own remaining count and greys out when spent. In Test mode every pool is unlimited.

This is the main knob for level difficulty. Levels usually grant exactly **one** use of exactly **one** action, so the puzzle is identifying the single right target for it — see §4.1 on why getting that wrong costs a retry rather than a loss.

## 7. Levels

Every level places exactly one `required` key, either loose on the board or sealed inside a crate, so the shape of every puzzle is *find the key, then reach the exit*. Each level is built on exactly one idea, and the list is in teaching order:

| Levels | What they are about |
|---|---|
| 1–7 | One introduction each: walking and the lock, wraparound, crates and crushing, Flip, Shift, the full-loop push, then both budgeted actions at once. |
| 8–13 | How far free Move goes on its own: which entity a jam claims, where a broken crate leaves its key, pushing from a side you have to walk the long way round to, chains that wrap, a packed line that *can't* rotate, and reaching into a corridor from outside it. |
| 14–15 | Shift, where Move provably can't reach: breaking the spacing of a rotating line, and a guess the budget lets you get wrong. |
| 16–25 | Flip, the only action that ignores walls — sealed keys, sealed exits, sealed characters, the fixed lines, the mirror tile you happen to be standing on, and what a second Flip is for. |
| 26–27 | Both budgeted actions on one board, where the order and the tile you stand on both decide the run. |

The wall lists below name a few structures by the helper that builds them in `src/data/levels.js`: **sealed tile** (all four edges of one cell — walk-proof and shift-proof, so Flip-only), **sealed row/column** (a one-tile corridor cut off from its neighbours at every index, wrapping into a closed ring unless a wall inside it says otherwise), and **door** (one edge of such a corridor deliberately left open).

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

### Level 6 — a full row still moves

Built on the full-loop push (§5.1.1 case 3), the one push case that has no open tile to resolve into.

| Field | Value |
|---|---|
| Grid | 5×5 |
| Character start | `(1, 2)` |
| Crates | `(0, 2)`, `(2, 2)`, `(3, 2)`, `(4, 2)` |
| Collectibles | key at `(2, 4)`, `required: true` |
| Goal | `(2, 2)` |
| Walls | `(x,1)`–`(x,2)` for every `x` in `0..4`, and `(x,2)`–`(x,3)` for `x` in `0..3` — 9 walls |
| Available actions | None (Move only) |

The board is Level 5's sealed corridor with **one door**: `(4,2)` is left open downward onto `(4,3)`, and that's the only tile connecting row 2 to the rest of the board. Inside, the character and four crates fill all five tiles.

**Why every step is a rotation.** Up and down are walled at every column but the door, so the character can only move along the row — and the row has no empty tile. `resolveMoveChain` walks the whole line, wraps back to the character's own tile, and resolves as case 3: everything shifts one step, the crate at the far end wrapping around the board edge. The character advances by one and the entire row turns with it. There is no other way to move in here, which is what makes the case load-bearing rather than decorative.

**Intended solution:**

1. `Left` ×2 → two full-row rotations carry the character `(1,2) → (0,2) → (4,2)`, the door tile. (`Right` ×3 gets there too.)
2. `Down` through the door → `(4,3)`, then walk to the key at `(2,4)` and collect it. The corridor now has four crates and the gap the character left at `(4,2)`; nothing out here can move them.
3. Back to `(4,3)` and `Up` into `(4,2)` — the row is packed again.
4. `Right` ×3 → three more rotations to `(0,2) → (1,2) → (2,2)` = goal → **win**.

The goal sits inside the corridor and is sealed above and below like every other tile in it, so it can only ever be entered along the row — i.e. by a rotation. No crate can leave the corridor either: pushing one through the door would need the character standing above it at `(4,1)`, which is walled off.

### Level 7 — one Shift, one Flip, one order

The capstone: both budgeted actions, one use each, and only one sequence works.

| Field | Value |
|---|---|
| Grid | 5×5 |
| Character start | `(2, 4)` |
| Collectibles | key at `(1, 2)`, `required: true` |
| Goal | `(0, 2)` |
| Walls | `(0,y)`–`(1,y)` and `(1,y)`–`(2,y)` for every `y` in `0..4` (column 1 sealed down both sides), plus `(2,2)`–`(3,2)`, `(3,2)`–`(4,2)`, `(3,1)`–`(3,2)`, `(3,2)`–`(3,3)` (a one-tile cage at `(3,2)`) — 14 walls |
| Available actions | Shift and Flip |
| Action budget | Shift: 1, Flip: 1 |

The board has two prisons. Column 1 is sealed down both its long sides, so the key inside can slide **up and down** freely — nothing blocks a vertical step within the column — but can never cross out sideways. And `(3,2)`, drawn as a small empty cage, is sealed on all four edges.

**Why each action is needed.** Walking can't reach column 1 at all, and no Shift can move the key out of it (a wall stops a shifted step exactly as it stops a walked one, §5.2), so **Flip is the only way out**. But `(1,2)` mirrors onto `(3,2)` under a column flip — straight from one prison into the other — and a row flip does nothing at all, since the key sits on the middle row (§5.3). So **Shift is what makes the Flip land somewhere useful**: one shift of column 1 slides the key off row 2, and *then* its mirror image is an open tile.

**Intended solution:**

1. Shift column 1, either direction → key `(1,2) → (1,3)` (or `(1,1)`). Still sealed, but no longer on the mirror row.
2. Flip across the middle **column** (`↔`) → key `(1,3) → (3,3)`, an open tile beside the cage. The character starts at `(2,4)`, on the middle column, so this leaves it exactly where it is.
3. Walk to `(3,3)`, collect the key, then round to the goal at `(0,2)` — reached through the wraparound seam from `(4,2)`.

**The traps, all of them visible on the board before committing:**

- *Flip first.* The key drops into the cage at `(3,2)` and nothing can ever get it out again — a later shift of column 3 is rejected as a no-op (and costs nothing, §5.2), which is the game telling you the run is over. Retry.
- *The wrong flip axis.* A row flip leaves the key on `(1,2)`, untouched.
- *Shifting the key's row instead of its column.* Walls on both sides mean the key can't move, so it's rejected and free — safe to try.
- *Flipping yourself in.* From column 3 the character can flip itself into column 1 and collect the key by hand. It's then sealed in there with no flip left, and the goal is outside. A genuine dead end, and a good way to learn that Flip moves the character too.

### Level 8 — the far crate breaks first

Teaches which entity a jam actually claims (§5.4): the one *touching the wall*, not the one being pushed.

| Field | Value |
|---|---|
| Grid | 5×5 |
| Character start | `(1, 2)` |
| Crates | `(2, 2)` containing a `required` key, `(3, 2)` |
| Goal | `(4, 2)` |
| Walls | `(3,2)`–`(4,2)` — 1 wall |
| Available actions | None (Move only) |

Both crates look identical, and pushing right jams them against the one wall. The crate that dies is the far one — the empty one — because the peel walks backward from the wall. Only once that shield is gone can the same push crush the near crate and spill the key.

**Intended solution:** `Right` crushes the far crate; `Right` pushes the key crate into the freed tile; `Right` crushes it there, dropping the key on `(3,2)`; `Right` collects it; `Up`, `Right`, `Down` rounds the wall to the goal → **win** (7 moves).

### Level 9 — a crate drops its key where it dies

The tile a crushed crate leaves its key on is its *own* tile, not the one it was pushed toward — so here the crate is pushed onto the exit and breaks open on it.

| Field | Value |
|---|---|
| Grid | 5×5 |
| Character start | `(4, 4)` |
| Crates | `(2, 2)` containing a `required` key |
| Goal | `(0, 2)` |
| Walls | row 2 sealed, with a door below `(4,2)`, plus `(4,2)`–`(0,2)` — 10 walls |
| Available actions | None (Move only) |

The seam wall turns Level 6's ring into a dead-end line, and the door at `(4,3)` is the only way in — which puts the character to the *right* of the crate for good. It can only ever be pushed left, into the dead end at `(0,2)`, which is the goal.

**Intended solution:** `Up`, `Up` through the door; `Left` ×3 walks the crate to `(0,2)`; the fourth `Left` crushes it there and the key lands on the goal; the fifth `Left` steps onto it → **win** (7 moves).

### Level 10 — push from the side you have to walk round to

A crate is only crushable from the side that pushes it into the wall, and that side can be a whole lap away.

| Field | Value |
|---|---|
| Grid | 5×5 |
| Character start | `(2, 0)` |
| Crates | `(2, 2)` containing a `required` key |
| Goal | `(2, 1)` |
| Walls | column 2 sealed, plus `(2,1)`–`(2,2)` — 11 walls |
| Available actions | None (Move only) |

Column 2 is a sealed ring cut by one wall, and the character starts on the wrong side of it: walking down at the crate pushes it away from the only wall it can break on. Going the other way — up, through the wraparound seam — arrives underneath it.

**Intended solution:** `Up` ×3 to `(2,3)` (via the seam); `Up` crushes the crate against the `(2,1)`–`(2,2)` wall; `Up` collects the key at `(2,2)`; `Down` ×4 rounds the ring again to the goal at `(2,1)` → **win** (8 moves).

### Level 11 — the chain wraps, and so does the casualty

A push chain walks through the seam (§2.1), so the crate a push destroys can be on the opposite side of the board from the push.

| Field | Value |
|---|---|
| Grid | 5×5 |
| Character start | `(2, 2)` |
| Crates | `(3, 2)`, `(4, 2)`, `(0, 2)` containing a `required` key |
| Goal | `(1, 2)` |
| Walls | `(0,2)`–`(1,2)` — 1 wall |
| Available actions | None (Move only) |

Pushing right walks the chain `(3,2) → (4,2) → (0,2)` and then into the wall, so the key crate — three tiles to the *right*, which is to say one to the left — is the one that jams and breaks. The same wall then stops the character stepping onto the key it dropped, so the way in is round through row 1.

**Intended solution:** `Right` crushes the wrapped crate and drops the key on `(0,2)`; `Up`, `Left`, `Left`, `Down` comes round to it; `Up`, `Right`, `Down` returns to the goal at `(1,2)` → **win** (8 moves).

### Level 12 — a packed row with a wall in it can't rotate

The counterpart to Level 6: the full-loop push (§5.1.1 case 3) needs the loop, and one wall inside the ring takes it away.

| Field | Value |
|---|---|
| Grid | 5×5 |
| Character start | `(2, 2)` |
| Crates | `(0, 2)` containing a `required` key, `(1, 2)`, `(3, 2)`, `(4, 2)` |
| Goal | `(4, 2)` |
| Walls | row 2 sealed, plus `(4,2)`–`(0,2)` — 11 walls |
| Available actions | None (Move only) |

Five entities fill five tiles, so there is no open tile for a push to resolve into — and with the ring cut, no rotation either. Every step is therefore a jam, and every jam breaks the crate at the far end of the line. Demolition is the only way to move, and the key is in the crate at the left end.

**Intended solution:** `Left` ×4 breaks through to the key and collects it; `Right` ×6 breaks back down the line to the goal at `(4,2)` → **win** (10 moves).

### Level 13 — out one door, round, and in the other

A sealed corridor has no wall along its own axis, so nothing inside it can be crushed from inside it — but a door is a tile the character can stand *beside* the corridor at.

| Field | Value |
|---|---|
| Grid | 5×5 |
| Character start | `(0, 2)` |
| Crates | `(1, 2)` containing a `required` key |
| Goal | `(4, 2)` |
| Walls | row 2 sealed, with a door below `(2,2)` and a door above `(3,2)` — 8 walls |
| Available actions | None (Move only) |

Pushing the crate along the corridor never crushes it. The lower door is the way out, the upper door is the way back in — and standing at `(3,1)`, above the corridor, is the one position from which a push drives the crate into the corridor's own floor.

**Intended solution:** `Right` ×2 leaves the crate at `(3,2)` and the character at `(2,2)`; `Down` ×4 exits by the lower door and comes round the seam to `(2,1)`; `Right` to `(3,1)`; `Down` crushes the crate against `(3,2)`–`(3,3)`; `Down` steps onto the key; `Right` to the goal → **win** (10 moves).

### Level 14 — a full row only rotates

Introduces the other half of the rotation rule: a rotation moves *every* entity on the line by one, so the gaps between them never change, and walking can never close the two tiles between the character and the key.

| Field | Value |
|---|---|
| Grid | 5×5 |
| Character start | `(0, 2)` |
| Crates | `(1, 2)`, `(3, 2)`, `(4, 2)` |
| Collectibles | key at `(2, 2)`, `required: true` |
| Goal | `(4, 2)` |
| Walls | row 2 sealed — 10 walls |
| Available actions | Shift |
| Action budget | Shift: 1 |

The character can walk forever and the board simply turns underneath it. The one Shift crushes a crate across the corridor (§5.2), and the hole it leaves is what finally lets the line move relative to itself.

**Intended solution:** `Right` ×2 (two rotations, key still two ahead); Shift the column holding a crate — `▲` or `▼` on column 3 — to crush it; `Right` into the hole; `Right` onto the key, which is now on the goal → **win** (5 actions).

### Level 15 — two crates, no telling them apart

A crate's contents are invisible until it breaks (a known art gap — crates are drawn identically), so this level never asks the player to guess: it hands out two Shifts.

| Field | Value |
|---|---|
| Grid | 5×5 |
| Character start | `(2, 4)` |
| Crates | `(2, 1)` containing a `required` key, `(2, 3)` |
| Goal | `(2, 0)` |
| Walls | column 2 sealed — 10 walls |
| Available actions | Shift |
| Action budget | Shift: 2 |

Level 5's corridor turned on its side, with two candidates in it. Either crate can be crushed by shifting its row; the wrong one costs a Shift, not the run.

**Intended solution:** `Down` (through the seam to `(2,0)`); Shift row 1 either way to crush the crate at `(2,1)`; `Down` onto the key it drops; `Up` to the goal → **win** (4 actions). Breaking the other crate first costs one extra Shift and still wins.

### Level 16 — the middle column never moves

The shortest level in the game, and the clearest statement of the fixed-line rule (§5.3).

| Field | Value |
|---|---|
| Grid | 5×5 |
| Character start | `(2, 2)` |
| Collectibles | key at `(3, 2)`, `required: true` |
| Goal | `(0, 2)` |
| Walls | row 2 sealed, plus `(2,2)`–`(3,2)` and `(4,2)`–`(0,2)` — 12 walls |
| Available actions | Flip |
| Action budget | Flip: 1 |

Two walls inside the corridor cut it into rooms `{0,1,2}` and `{3,4}`. Neither Move nor Shift crosses a wall, so the key in the small room is unreachable — but a column flip mirrors `(3,2)` onto `(1,2)`, inside the character's room. The character stands on the middle column, so it watches the board move without moving; the row flip, with everything on the middle row, changes nothing at all and ends the run.

**Intended solution:** Flip across the middle column (`↔`); `Left` onto the key at `(1,2)`; `Left` to the goal → **win** (3 actions).

### Level 17 — flip out of the cage, not into the next one

Level 4 sealed the key in. This one seals the character in, which makes the axis choice a choice about where *you* land.

| Field | Value |
|---|---|
| Grid | 5×5 |
| Character start | `(3, 1)`, a sealed tile |
| Collectibles | key at `(0, 0)`, `required: true` |
| Goal | `(4, 2)` |
| Walls | `(3,1)` sealed, plus row 3 sealed — 14 walls |
| Available actions | Flip |
| Action budget | Flip: 1 |

`(3,1)` mirrors onto `(3,3)` under a row flip — which is inside the sealed row-3 corridor, with no flip left to get out again: one prison traded for another. The column flip, to `(1,1)`, opens onto the rest of the board.

**Intended solution:** Flip across the middle column (`↔`) → character to `(1,1)`, and the key — which mirrors too — from `(0,0)` to `(4,0)`; `Up` to `(1,0)`; `Left`, `Left` through the seam onto the key at `(4,0)`; `Down`, `Down` to the goal at `(4,2)` → **win** (6 actions).

### Level 18 — two rooms, one flip

Both seams walled down the columns split the board into `{0,1}` and `{2,3,4}`, and the single flip is the only crossing — so it has to be spent holding the key.

| Field | Value |
|---|---|
| Grid | 5×5 |
| Character start | `(0, 0)` |
| Collectibles | key at `(1, 3)`, `required: true` |
| Goal | `(4, 2)` |
| Walls | `(1,y)`–`(2,y)` and `(4,y)`–`(0,y)` for every `y`, plus `(3,3)` sealed — 14 walls |
| Available actions | Flip |
| Action budget | Flip: 1 |

The key's own mirror tile, `(3,3)`, is a sealed cage: flipping before picking it up throws it across the board and into a cell nothing can reach. The character's landing matters for exactly the same reason — flipping while standing on `(1,3)` puts *it* in that cage instead.

**Intended solution:** `Up`, `Up` (through the seam to `(0,3)`); `Right` onto the key at `(1,3)`; `Up`, `Left` to `(0,2)`; Flip across the middle column → `(4,2)`, the goal → **win** (6 actions).

### Level 19 — you are standing where the key lands

A flip is a reflection of the whole entity layer, so two entities on mirrored tiles simply trade places — it is not a pickup.

| Field | Value |
|---|---|
| Grid | 5×5 |
| Character start | `(3, 2)` |
| Collectibles | key at `(1, 2)`, `required: true` |
| Goal | `(0, 0)` |
| Walls | `(1,2)` sealed — 4 walls |
| Available actions | Flip |
| Action budget | Flip: 1 |

`(3,2)` is exactly the tile `(1,2)` mirrors onto. Flipping from there frees the key and puts the character in the cage it came out of, with nothing left to spend. One step off the mirror line first is the entire puzzle.

**Intended solution:** `Left` to `(2,2)`; Flip across the middle column → key to `(3,2)`, character to `(2,2)`; `Right` onto the key; `Up`, `Up`, `Right`, `Right` to the goal at `(0,0)` through the seam → **win** (7 actions).

### Level 20 — bring it out before you break it

The key is in a crate inside a sealed ring, so Move can't reach it and a Shift could only crush it out of sight. Flip lifts the crate over the wall — and parks it against the far face of that same wall.

| Field | Value |
|---|---|
| Grid | 5×5 |
| Character start | `(0, 2)` |
| Crates | `(1, 0)` containing a `required` key |
| Goal | `(3, 2)` |
| Walls | row 0 sealed — 10 walls |
| Available actions | Flip |
| Action budget | Flip: 1 |

Row 0 is sealed from row 1 and, across the seam, from row 4. A row flip drops the crate on `(1,4)`, whose downward step is that same seam wall: exactly the anvil the character needs. A column flip only slides it along its own prison and ends the run.

**Intended solution:** `Up`, `Right` to `(1,1)`; Flip across the middle row (`↕`) → crate to `(1,4)`, character to `(1,3)`; `Down` crushes the crate against the seam wall; `Down` collects the key at `(1,4)`; `Up`, `Up`, `Right`, `Right` to the goal → **win** (9 actions).

### Level 21 — break it open in here, then flip yourself out

| Field | Value |
|---|---|
| Grid | 5×5 |
| Character start | `(0, 1)` |
| Crates | `(2, 1)` containing a `required` key |
| Goal | `(2, 3)` |
| Walls | row 1 sealed, plus `(4,1)`–`(0,1)` — 11 walls |
| Available actions | Flip |
| Action budget | Flip: 1 |

The character is shut in with the crate, in a corridor whose ring is cut — so unlike Level 14's, this line has a wall at each end, and Move can crush the crate on it. The flip is then the way out to the goal, which is outside. Flipping first isn't fatal (the crate is carried out too, and the corridor's outer wall cracks it just as well from that side), but the *column* flip is: it mirrors the corridor onto itself, so nothing ever leaves it.

**Intended solution:** `Right` ×4 walks the crate to `(4,1)` and crushes it against the seam wall; `Right` collects the key; `Left`, `Left` to `(2,1)`; Flip across the middle row → `(2,3)`, the goal → **win** (8 actions).

### Level 22 — tip the whole corridor out

Level 14's trap, without a Shift to break it: the packed corridor rotates, the key stays two tiles away forever, and the answer is to stop working inside the corridor at all.

| Field | Value |
|---|---|
| Grid | 5×5 |
| Character start | `(0, 1)` |
| Crates | `(1, 1)`, `(2, 1)`, `(4, 1)` |
| Collectibles | key at `(3, 1)`, `required: true` |
| Goal | `(2, 0)` |
| Walls | row 1 sealed — 10 walls |
| Available actions | Flip |
| Action budget | Flip: 1 |

One row flip empties the corridor onto row 3, out in the open, where the character can walk *around* the crates instead of pushing them — and where the goal is.

**Intended solution:** `Left` (a rotation, to line the key up); Flip across the middle row → everything lands on row 3; `Up`, `Left`, `Down`, `Left` walks round to the key; `Down`, `Down` to the goal at `(2,0)` through the seam → **win** (8 actions).

### Level 23 — the exit is sealed, so land on it

| Field | Value |
|---|---|
| Grid | 5×5 |
| Character start | `(0, 0)` |
| Collectibles | key at `(4, 4)`, `required: true` |
| Goal | `(3, 3)`, a sealed tile |
| Walls | `(3,3)` sealed, plus row 1 sealed — 14 walls |
| Available actions | Flip |
| Action budget | Flip: 1 |

The goal has four walled edges, so the only way onto it is to *arrive* there — from `(1,3)`, the tile it mirrors onto under a column flip. (The other candidate, `(3,1)`, is inside the sealed row-1 corridor, where the character can't stand.) That makes the flip the last action of the run, which means the key has to be in hand before it's spent.

**Intended solution:** `Up`, `Left` collects the key at `(4,4)` through the seam; `Up`, `Right`, `Right` to `(1,3)`; Flip across the middle column → `(3,3)`, the goal → **win** (6 actions).

### Level 24 — flip in, take the key, flip back

Flip is its own inverse (§5.3) — but the character isn't, and a collected key doesn't flip back.

| Field | Value |
|---|---|
| Grid | 5×5 |
| Character start | `(3, 1)` |
| Collectibles | key at `(2, 1)`, a sealed tile, `required: true` |
| Goal | `(0, 0)` |
| Walls | `(2,1)` sealed, plus the sealed two-tile room `{(2,3), (3,3)}` (every edge but the one between them) — 10 walls |
| Available actions | Flip |
| Action budget | Flip: 2 |

A row flip drops the caged key into the sealed room at the bottom *and* carries the character — standing on `(3,1)`, which mirrors onto the room's other half — in with it. Collect it there, step back across to `(3,3)`, and flip again: the board returns to exactly where it started, except the key is now in hand. Flipping back from `(2,3)` instead lands in the empty cage, and a column flip at any point moves only the character, since the key sits on the middle column.

**Intended solution:** Flip across the middle row → character `(3,3)`, key `(2,3)`; `Left` collects it; `Right` back to `(3,3)`; Flip across the middle row → `(3,1)`; `Up`, `Right`, `Right` to the goal at `(0,0)` through the seam → **win** (7 actions).

### Level 25 — two flips, two axes, a half turn

| Field | Value |
|---|---|
| Grid | 5×5 |
| Character start | `(2, 2)` |
| Collectibles | key at `(1, 0)`, a sealed tile, `required: true` |
| Goal | `(0, 2)` |
| Walls | `(1,0)` sealed, `(1,4)` sealed, `(3,0)` sealed — 11 walls |
| Available actions | Flip |
| Action budget | Flip: 2 |

Both of the key's single mirrors are cages too: `(1,4)` under a row flip, `(3,0)` under a column flip. Neither flip alone frees it and two flips on the same axis put it back where it started, so the only line is one flip of each — a half turn, landing it on the open corner `(3,4)`. The character sits on `(2,2)`, the one tile both axes leave alone, and doesn't move for either.

**Intended solution:** Flip across the middle row, then across the middle column (either order) → key `(1,0) → (1,4) → (3,4)`, character unmoved throughout; `Right`, `Down`, `Down` to `(3,4)` collects it; `Up`, `Up`, `Right`, `Right` rounds to the goal at `(0,2)` through the seam → **win** (9 actions).

### Level 26 — slide it clear before you flip it out

The first of the two-action boards, and the one where both actions land on the same crate.

| Field | Value |
|---|---|
| Grid | 5×5 |
| Character start | `(0, 2)` |
| Crates | `(2, 0)` containing a `required` key |
| Goal | `(4, 2)` |
| Walls | row 0 sealed, plus `(2,4)` sealed (its top edge is the corridor's own seam wall) — 13 walls |
| Available actions | Shift and Flip |
| Action budget | Shift: 1, Flip: 1 |

Level 20's board with a cage added directly under the crate's landing tile. Flipping first drops the crate into `(2,4)`, where nothing reaches it again. Shifting **row 0** first slides the crate one tile along its prison, so the flip lands it at `(1,4)` or `(3,4)` — in the open, against the seam wall it can be crushed on. Spending the Shift on the crate's **column** instead cracks it open where it stands and leaves the *key* to be flipped into that same cage: the same dead end, one step later.

**Intended solution:** `Up`, `Left`, `Left` to `(3,1)`; Shift row 0 right → crate to `(3,0)`; Flip across the middle row → crate to `(3,4)`, character to `(3,3)`; `Down` crushes the crate against the seam wall and drops the key on `(3,4)`; `Down` collects it; `Up`, `Up`, `Right` to the goal at `(4,2)` → **win** (10 actions).

### Level 27 — stand where the cage is going to land

The capstone: a flip moves the whole entity layer, so what matters is where *you* are when it lands.

| Field | Value |
|---|---|
| Grid | 5×5 |
| Character start | `(4, 0)` |
| Crates | `(1, 1)`, a sealed tile, containing a `required` key |
| Goal | `(4, 3)` |
| Walls | `(1,1)` sealed, plus row 3 sealed — 14 walls |
| Available actions | Shift and Flip |
| Action budget | Shift: 1, Flip: 1 |

The goal is inside a sealed corridor with no door: the character has to arrive by flip, and can never leave again. Row 1 mirrors onto row 3, so it has to be standing **on row 1** when it flips, to come down inside the corridor alongside whatever the cage was holding. The Shift is what opens the crate — against the cage's own walls before the flip, or against the corridor's after it; either order works. Flipping from any other row lands the character outside the corridor with the key inside it, and ends the run.

**Intended solution:** `Down` to `(4,1)`; Shift row 1 right — the caged crate is crushed against its own wall and drops the key on `(1,1)`, and the character rides the same shift round the seam to `(0,1)`; Flip across the middle row → character `(0,3)`, key `(1,3)`, both inside the corridor; `Right` collects the key; `Left`, `Left` to the goal at `(4,3)` through the seam → **win** (6 actions).
