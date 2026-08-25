# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A sandbox for quickly iterating on small web-based 2D game prototypes, driven by remote prompts. The repo root is a static home page (`index.html`) that links to each prototype under `games/`. There is no monorepo tooling, no shared package.json, and no cross-game code — each game is a self-contained folder.

## Starting a new game prototype

Use the `new-game` skill (`.claude/skills/new-game/SKILL.md`) to scaffold a game: it asks for the game's display name, derives a slug, copies `templates/game/` into `games/<slug>/` with `{{GAME_NAME}}` placeholders replaced, copies `templates/GAME_DESIGN_DOC_TEMPLATE.md` to `games/<slug>/DESIGN.md`, and links the new game from the root `index.html`.

To do it by hand instead, follow the same steps in `README.md`.

The template convention (`templates/game/index.html` + `main.js`): Phaser 3 loaded via CDN `<script>` tag, no build step, a single `TitleScene`. New games are expected to grow their own scene/module structure from there as needed — see `games/bibou/` for what a more developed prototype looks like.

## Design doc convention

Every game has a `DESIGN.md` (from `templates/GAME_DESIGN_DOC_TEMPLATE.md`) that documents the game **as it currently is**, not as a changelog. When a mechanic changes, edit the relevant section in place — never leave "previously X, now Y" or "superseded" notes. Git history is the changelog; the doc is the current source of truth. This convention applies to all docs in a game folder (e.g. `games/bibou/DESIGN.md`, `LEVEL_DESIGN.md`, `TESTING.md`).

## Working in `games/nouxinha/`

Nouxinha is a grid exploration game: a wizard walks a vast procedurally-generated dark, and the light sources they carry burn down one step at a time. Read `games/nouxinha/DESIGN.md` before changing it, and `games/nouxinha/TESTING.md` before adding a test.

Things that are easy to break by not knowing them:

- **The world is derived, never stored.** Terrain and item spawns are pure functions of `(x, y, seed)` in `src/core/world.js`. A run stores only which tiles it has *seen*, which item tiles it has emptied, and the few tallies the end-of-run recap reports. Don't add a world array.
- **Light is cut back by what stands in the way.** A shape says how far a light reaches; `visibleTiles` takes an optional `isOpaque` predicate and drops everything it can't see round, and `blocksSight` in `core/world.js` is the terrain half (rock, trees, masonry always; a gate only while it is shut; a chest *never*). Three rules are load-bearing: the blocker itself is always lit, nothing a step away can ever be hidden — which is what keeps the never-stuck promise and makes a radius-1 torch shadow-proof — and `litTiles` is the only place shape, edge choke and shadow compose.
- **Gates want keys, and keys come out of chests.** A gate's `key` in `SANCTUM_PLAN` is what opens it and its `colour` is the gem whose colour both the gate and that key are drawn in — gems no longer gate anything, they only widen the water ceiling and upgrade the scatter. `entryKey`/`canEnter` in `core/world.js` take the run's *key set*, never a gem count. Chests (`CHEST_PLAN`) are placed like landmarks, are their own impassable terrain that doesn't block sight, and are opened by walking into them — a bump that costs no step (`openChest` in `core/rules.js`). A chest opens once, forever, and both the keys and the set of opened chests are banked at the hut like a gem, so a run that dies walks back out to a shut lid with its key still inside.
- **Each save slot is its own world, and the world has an edge.** The seed is drawn when NEW GAME claims a slot and lives in the save from then on — `createRun` reads it from there, and `bankRun` rebuilds the save from scratch so it has to carry the seed over by hand. Beyond `EDGE_RADIUS` (200, a true radius, not Chebyshev) terrain is `'dark'`: impassable, drawn as nothing. Approaching it, `chokeAt` narrows whatever light is burning by a tile per ten walked, applied in `activeShape` — so anything reading a light's shape must go through `activeShape`, never `itemDef(id).shape`. Nothing outside the world is ever lit or explored (`litTiles` filters), which is what keeps both map renderers honest.
- **A world is one of four biomes, and the seed says which.** `biomeOf(seed)` in `core/world.js` picks one of the four in `src/data/biomes.js` (temperate, frozen, desert, mystical realm), so a biome is derived like everything else about the world rather than stored — nothing in a save carries it, and `createRun`/`resumeRun` put it on the run as `state.biome`. A biome is two things: the palette a world is drawn in for a player who has never picked one in Settings (`setDefaultPalette` in `config.js` — an explicit pick always wins), and the tiles it draws the world with (`BIOME_TILES` in `data/tiles.js`, all four empty today). It is *not* a set of generation parameters yet: rock, groves, scatter and distances are one set of numbers for every world.
- **A run validates its seed at start.** `pickSeed` flood-fills a window around the base and bumps the seed if the spawn is sealed into a pocket — the design promises the character is never permanently stuck.
- **Sprites are coordinates on one tile sheet.** `assets/tiles.png` is 49×22 tiles of 16px, 1px apart; `src/data/tiles.js` maps each sprite key to the `[col, row]` it is cut from — or to a *list* of them, for a terrain that alternates (rock, trees), picked per world tile by `variantAt`. The sanctum wall is a nine-slice picked by `wallSprite`. A biome can repoint the *world's* own tiles (terrain, masonry, gates, chests, hut, stall — the `BIOME_KEYS` list) in `BIOME_TILES`, and anything it doesn't name is the shared tile: `biomeKey(key, biome)` hands back a key of the biome's own (`rock@frozen`) only where it actually repoints one, so four biomes of the same art cost one set of textures. Items and the character are deliberately not repointable — the HUD and the item card draw them with no world to ask. That table is the only place that knows the sheet exists. Tiles are cut into masks and baked to greyscale textures at boot (`src/ui/textures.js`), then tinted with the palette's foreground at draw time; a mask pixel is full strength or `FLOOR_TEXTURE_LEVEL` of it, which is how floor gets texture without a second colour. That tinting is what enforces the two-colour rule, so anything drawn must be tinted. What the sheet can't give is derived in `src/data/sprites.js`: the floor's half-strength ground texture, and the colour zones below. Open `games/nouxinha/tiles.html` through a server to see the sheet with its coordinates on it; `games/nouxinha/paint.html` is the separate tool for painting a tile's colour zones, and `games/nouxinha/draw.html` the one for drawing a tile's own pixels and exporting the sheet back out as a PNG to save over `assets/tiles.png` (the three link to each other).
- **A tile can be more than one colour, and `src/data/paint.js` says which parts.** An entry there gives a sprite key a 16×16 *zone map* (`1`/`2`/`3` claim a pixel, anything else leaves it in zone 0) and a *hue* per zone: `0-3` for a gem's colour, or the roles `'gem'` and `'opened'`, which the drawing code resolves from where the tile stands (a sanctum's own gem; the gem that opened a gate). `buildSprites` cuts one mask per zone (a biome's own version of a tile included, and `paintOf` falls back from `rock@frozen-1` to `rock-1`), `src/ui/painted.js` stacks them back into the silhouette and tints each separately, and **a hue always falls back to the plain foreground until that gem is held** — so a tile gains colour as the campaign goes on and nothing is ever shown in a colour the run hasn't brought back. Everything on screen goes through `paintTile`, painted or not. Don't hand-author a zone map: `paint.html` draws it on the real tile, previews the tile at nought to three gems, and writes the entry to paste in.
- **The game's own voice is the text panel** (`src/ui/textPanel.js`): a bordered box across the bottom band, covering the HUD and leaving the world above it on screen, that types its copy out a character at a time with a blip every couple of them and takes one tap per block. It is reusable by construction — hand `show` a list of blocks and a callback — and its two callers are setting out on a fresh expedition and opening a chest; a walk merely *carried on* (resumed off a slot, or back from Settings mid-run) is not read it again. It counts as a modal: `modalOpen()` in `ExploreScene` includes it, and anywhere on screen is its tap target. `startRun` in the harness reads it out on the way past, so no other test has to know it exists.
- **Every word the player reads is in `src/text.js`.** Screen titles, buttons, counters, status lines, dialog copy, palette and biome names, and each item's name and card text: one table, imported by the scenes, the UI widgets, `data/items.js`, `config.js` and the test suites. Anything that varies is a function of what it varies on (`HUD.water(water, ceiling)`, `SETTINGS.cheats(on)`), so no scene ever spells a player-facing string itself and no test hardcodes one — rewording the game means editing that file and nothing else. Sprite keys, scene names, storage keys and item ids are not text and stay where they are.
- **Every gameplay number is in `src/balance.js`.** Item frequency, the separation rule, sanctum and landmark distances, water, light durability and shapes, prices, the edge of the world: one table, imported by `core/` and `data/`, importing nothing itself. `src/config.js` is the other half — layout, palette, type, and the settings a player toggles — and holds no gameplay numbers. Retuning the game should never mean editing a file under `core/`.
- **Tests derive their routes, and live in suites.** There are no hand-authored levels, so `tests/world.js` BFSes the real world to find the nearest torch, the nearest rock to bump, the first gem, the first key chest and the merchant, and every suite replays those paths. Don't hardcode coordinates. A browser test whose claim is what happens at the *far end* of a route plants the walk on the doorstep with `standingAt(route)` and walks only the last leg — the route being walkable at all is a pure claim. A `test(...)` has to be paying for what is drawn, what an input does, or what crosses between a run and a slot; anything else belongs in the pure suite or nowhere, and `TESTING.md` says why. `npm test` runs `tests/all.test.js` (every suite, about a minute); each `tests/*.test.js` also runs on its own, and `npm run test:pure` runs the seven browserless ones in under ten. The runner prints what every test cost, because a slow test is nearly always a bug in the test — a browser walk that should have been planted, or a pure loop calling `pickSeed` when it meant to call a hash.
- **Tests route with keys, not gems.** `bfs` in `tests/world.js` takes a key `Set` (`ALL_KEYS` is all three); a chest is routed to by its apron (`chestApproach`), never its own tile.
- **Saving is slot-based, and three different things save differently.** Three `localStorage` slots (`src/core/save.js`), picked through the title screen's NEW GAME / LOAD GAME. *Reaching* the hut banks progress — arriving writes the walk down whether or not the expedition ends there, so neither answer to its question can cost you what you carried home, and it fills the tank in the same moment (`depositRun`, and `bankRun` for the same thing plus the end of the run); the ground a run lit is written whichever way it ends, so a run never starts from black again; and the cogwheel menu's SAVE GAME suspends the whole expedition into the slot so LOAD GAME carries it on instead of setting out again — a bookmark, not a banking. A suspended run stores no world: seed, nonce, epoch and the tiles it has already emptied put the scatter back (`suspendRun`/`resumeRun` in `src/core/rules.js`). Coming home to the hut or dying of thirst clears it; leaving by EXIT GAME deliberately doesn't.
- **Cheats are a Settings toggle** (`getCheats()` in `src/config.js`, applied in `createRun`): the whole map revealed and one of everything, and a run under them never writes to a slot.
- **Blocking terrain is rock in two formations plus trees, and chests are a fourth kind that isn't terrain-like at all.** Rock masses and loose boulders are the same terrain drawing from the same tiles; trees are a third terrain value (`'tree'`) that blocks like rock and draws as foliage; `'chest'` blocks a step but not a light and is opened by bumping it. Anything switching on terrain has to handle all four, and anything added to the blocked share has to keep `pickSeed` able to find an open seed.
- **All audio is synthesised and shares one `AudioContext`.** The pickup blips are in `src/ui/sfx.js`, which owns the context; the music loop in `src/ui/music.js` borrows it and is started and stopped with `ExploreScene`. Both are best-effort — a browser with no audio must cost the player nothing.

Same test setup as Bibou (`cd games/nouxinha && npm install && npm test`), including the CDN-rewriting harness.

## Working in `games/pitchou/`

Pitchou is a push-your-luck survival game: a lighthouse keeper draws salvage from a
fully-visible bag to refill three draining meters, and wins by surviving twelve
nights. It is playable end to end. Read `games/pitchou/DESIGN.md` before changing it
and `games/pitchou/TESTING.md` before adding a test. `games/pitchou/TODO.md` is the
owner's notes — don't implement from it unless asked.

- **The hazard is called a FALL, and only that.** The keeper loses their footing and
  drops loot. It was once a squall/wave/storm depending on which line of the screen you
  read, and a playtest found that the single most confusing thing in the game — so
  `kind: 'fall'`, `fallBudget`, `fallDamage`, `COLORS.fall`, `FALL_LABEL`, one sprite.
  Don't reintroduce a second name for it anywhere, including in comments.
- **Nothing is hardcoded; everything lives in a tuning object.** `DEFAULT_TUNING` in
  `src/core/rules.js` holds every number, and each function takes the tuning from
  `state.tuning`. Don't inline a constant — the simulator sweeps these, and the tests
  read the numbers back out of it. The view layer holds no game numbers at all:
  `src/config.js` is layout, type scale, palette, labels and settings.
- **A token is a list of gains.** `{ kind: 'resource', gains: [{ resource, amount }] }`,
  or `{ resource, min, max }` for the 1-3 tokens, which `search()` rolls at the moment
  of the draw and stashes back as `token.rolled`. Two or three gains make a mixed
  token. Anything reading a token's value has to go through `rolled`/`gains`, never a
  `token.resource` that no longer exists.
- **The numbers are simulation-derived, and `DESIGN.md` §8 records why.** Five of them
  are load-bearing in a way that is easy to "simplify" and thereby break: one build per
  dawn (`buildsPerNight`) is what makes a twelve-tool shop a decision rather than a
  shopping list; the 4/4/4 shore is thin *because* the shop is big, and putting it back
  to 5/5/5 makes cautious play as good as pushing; a fall that ends the night keeps
  *half* the basket rather than none (all-or-nothing and pushing never pays); every
  fall costs a unit off the basket, not just the third; and the drain steps every five
  nights, with the tool tiers opening on exactly those nights. Re-run `npm run sweep`
  before changing any of them — it keeps those ablations next to the current tuning,
  including the pre-expansion six-tool workshop — and `npm run falls -- --fair`
  compares whole fall structures at matched difficulty.
- **`sim/simulate.mjs` is the tuning tool**: `npm run sim` for the policy table,
  `npm run sweep` for the ablations, `npm run falls` for fall structures, `npm run
  search` to grid-search tunings scored on whether building and pushing actually beat
  playing safe. Policies in `sim/policies.mjs` stand in for players — when a policy
  loses, check it isn't just playing badly before concluding the mechanic is broken.
- **The UI mirrors `playSeason` in `sim/simulate.mjs`, and has to.** Three things are
  easy to get wrong: death happens inside `beginNight` and leaves the phase at
  `'dusk'`, so the status is re-checked right after it; `search()` can move to
  `'dawn'` by itself (a fall that ends the night, or a bag drawn dry), so GO HOME is
  re-gated after every draw or `goHome` throws; and a dawn policy has to decide *after*
  allocation, or it is playing a different game from the simulator (see `TESTING.md`).
  `NightScene` is the whole run — dawn is an in-canvas overlay, not a second scene,
  like every other modal in this repo.
- **Type has a floor and the layout is built around it.** `FONT_SM` (16px) in
  `src/config.js` is the smallest size in the game; the vertical bands were laid out to
  fit the type, not the other way round. The shore grid sizes its own tiles
  (`layoutFor` in `src/ui/ShoreView.js`) so a small shore is drawn big.
- **Sprites are text, and sound is synthesised.** 16×16 `#`/`.` masks in
  `src/data/sprites.js` baked to white textures and tinted at draw time
  (`src/ui/textures.js`); `src/ui/sfx.js` builds every sound through WebAudio. Nothing
  is loaded, so nothing can fail to load.
- `npm test` runs both suites: `test:rules` (`node --test tests/rules.test.mjs`) for
  the rules the numbers rest on, and `test:ui` (`node tests/game.test.js`) driving the
  real canvas through Playwright with the same CDN-rewriting harness Bibou uses. Tests
  derive their seeds by replaying seasons against `rules.js` — there are no authored
  levels, so nothing is hardcoded.

## Working in `games/bibou/` (the reference prototype)

Bibou is a turn-based grid puzzle game (move tiles to get a character to a goal). It's the most fleshed-out prototype and the one with a real test suite — read its docs before making changes:

- `DESIGN.md` — mechanics, actions (free unlimited Move, plus budgeted Shift/Flip), win condition, source layout table.
- `LEVEL_DESIGN.md` — coordinate system, precise action specs, per-level data.
- `TESTING.md` — how to test a level, including a full runnable headless-browser harness.

### Running tests

```bash
cd games/bibou
npm install     # playwright-core + phaser, from the allowed npm registry — do NOT run `playwright install`
npm test        # node tests/game.test.js
```

- Chromium is preinstalled in the sandbox under `/opt/pw-browsers/`; the harness (`tests/harness.js`) finds it automatically (override with `CHROMIUM_PATH`).
- `tests/harness.js` — local static server + Playwright driver (click a label, tap a cell, swipe, read Phaser scene state back out) + a minimal runner/assertions.
- `tests/game.test.js` — the suite itself. `unit(...)` tests exercise pure `src/core/rules.js` math with no browser; `test(...)` tests each drive a fresh page against the real canvas.
- `node_modules/` is gitignored; `package.json` is committed and is test-only — the game itself needs no build step and runs straight from `index.html`.
- Add a test whenever a bug fix covers something a player could hit by just playing. `TESTING.md` also covers "rule-math only" checks (import `src/core/rules.js` directly into a `.mjs`/ESM scratch file) for sanity-checking a new level's solution before wiring up the UI.
- `tests/solver.js` replays a level through the real rules and searches its whole state space. Every level in `LEVELS` is checked by the suite for being winnable *and* for genuinely needing the actions it grants — so a new level that walking alone can solve fails `npm test`. Use it (`solve(level, { allow, prefix })`) while designing, before touching the UI.

**Sandbox gotcha:** `index.html` loads Phaser from `cdn.jsdelivr.net`, but outbound CDN requests are blocked in this environment. The test harness works around this by installing Phaser from npm and serving it locally, rewriting the CDN `<script src>` on the fly in its own local server — never edit `index.html` itself to work around this.

### Source layout (`games/bibou/src/`)

| Path | Holds |
|---|---|
| `main.js` | `Phaser.Game` config and scene registration — boot only |
| `config.js` | Screen/board layout constants and the colour palette |
| `data/levels.js` | Level definitions, the `LEVELS` list — where a new level goes |
| `core/rules.js` | Pure grid math: `wrap`, `moveEntity`, `shiftEntity`, `flipEntity`, wall logic (`isValidWallPair`, `validateLevelWalls`, `buildWallSet`, `isWallBetween`), and jam/push resolution (`resolveMoveChain`, `resolveCycleOutcome`). No Phaser, no scene state — importable straight into Node for tests. |
| `ui/button.js` | Shared text button (nav/overlay) |
| `ui/actionCard.js` | Bordered "playable card" control for the four action buttons |
| `ui/BoardView.js` | Grid/goal/wall/entity rendering, cell↔pixel mapping, transient action-preview arrows. Holds no game state. |
| `scenes/` | `TitleScene`, `LevelSelectScene`, `PuzzleScene` |
| `assets/sprites/` | Image assets loaded via `this.load.image` |

Board/entity model: a 5×5 grid with three layers — static Background (floor/goal), static Wall (edges between adjacent tiles, not tile-indexed), and movable Entity (character, crates, collectibles). Actions only ever touch the Entity layer. The board wraps (borderless). Move is free and unlimited (no card, no budget); only Shift and Flip are budgeted, and every level places one `required` key gating the goal — a level can be won or retried, never lost. See `DESIGN.md` §4-6 for the full mechanics and `LEVEL_DESIGN.md` for exact coordinate/action semantics before changing `core/rules.js`.

## Conventions across the repo

- No build tooling anywhere in this repo: games are plain ES modules loaded via `<script type="module">`, with Phaser pulled from a CDN `<script>` tag. Because ES modules don't work over `file://`, any game must be opened through a web server, not opened as a local file.
- Keep `templates/game/` and `templates/GAME_DESIGN_DOC_TEMPLATE.md` generic — they're the skeleton every new prototype starts from, not a place for Bibou-specific logic.
