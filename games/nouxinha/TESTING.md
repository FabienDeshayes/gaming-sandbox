# Testing Nouxinha

> These docs describe the game *as it is now*. When something changes, edit the affected sections
> in place rather than appending notes about what changed — git history is the changelog.

## Running the suite

```bash
cd games/nouxinha
npm install     # playwright-core + phaser, from the allowed npm registry — do NOT run `playwright install`
npm test        # node tests/game.test.js
```

`node_modules/` is gitignored. `package.json` is test-only: the game itself has no build step and
runs straight from `index.html` through any static server.

## The two kinds of test

`tests/game.test.js` registers both against the same runner:

- **`unit(name, fn)`** — no browser. Imports `src/core/*` and `src/data/*` directly and exercises
  the rules as plain functions: light shapes, durability and burnout ordering, world determinism,
  spawn bands. This is where anything expressible as "given this state, this happens" belongs,
  because it runs in milliseconds and the failure points at a line of logic.
- **`test(name, fn)`** — a fresh page driving the real canvas via Playwright. This is where
  anything a player *does* belongs: tapping the D-pad, swiping the map, opening the item card,
  equipping a torch and seeing the lit area grow.

Every browser test gets its own page, so no test inherits another's run. Any uncaught page error or
console error fails the test that provoked it.

## Sandbox gotcha

`index.html` loads Phaser from `cdn.jsdelivr.net`, which this sandbox blocks. `tests/harness.js`
works around it by serving the game from its own local server and rewriting the CDN `<script src>`
to the npm copy of Phaser **on the fly** — `index.html` itself is never modified. Don't "fix" the
CDN URL in the page to make tests pass.

Chromium is preinstalled under `/opt/pw-browsers/`; the harness finds it automatically. Override
with `CHROMIUM_PATH` if it isn't there.

## Driving the game (`tests/harness.js`)

The driver only ever sends input a player could send, and reads state back to assert on — no test
reaches in to *set* game state.

| Helper | Does |
|---|---|
| `clickText(label, nth)` | Taps an on-screen label, searching inside containers (buttons and the item card build their text into one) |
| `startRun(slot)` | Title screen to a walking run the way a player gets there: **NEW GAME** or **LOAD GAME**, then a slot. Loads slot 1 when a save was planted there, starts a fresh campaign in it otherwise |
| `tapDpad(dir)` | Taps a D-pad arrow |
| `swipe(dir)` | Swipes across the map area from its centre |
| `press(key)` | Sends a keyboard key |
| `tapSlot(i)` / `tapCoins()` | Opens an inventory slot's item card / the coin card |
| `state()` | The live run: position, facing, steps, coins, water, gems, seed, **nonce and epoch** (which together make the consumable salt), tools owned, unique objects seen, the banked save, explored count, furthest distance, inventory, active light, and which overlay is open — item card, inventory, hut dialog, merchant's counter or map |
| `visibleTiles()` | What is actually **drawn**: per tile, its world coordinate, ground texture, alpha, **tint**, overlay, item and item tint. This is the render, not the model — it's how the three visibility states get asserted, and the only way to see that a gem's colour actually reached the screen |
| `wizardTexture()` / `wizardZoneTints()` | Which of the four facing sprites is showing, and the tint of each of its four colour-zone layers — the wizard wears one colour per gem carried, plus the base colour |
| `tapShopRow(i)` / `tapMapButton()` | Taps a line of the merchant's stock, or the **MAP** button in the navigation rail |
| `save(slot)` | A save slot straight out of `localStorage`, slot 1 by default. A gem is only *kept* if the run banked it at the hut, so asserting that has to read the save rather than the run that found it |
| `music()` | Whether the music loop's scheduler is running — read out of `src/ui/music.js` itself, since a headless browser can't be asked to listen |
| `settle()` | Waits out the step slide, so a read isn't taken mid-tween |
| `canvasFit()` | Where the canvas actually sits against the browser viewport, and whether the page scrolls behind it |
| `openAnother(opts)` | A second page on the same server, for the few things only testable at another screen size. Closed with its parent, and its page errors count as the parent's |

### Testing a screen size

Pages open at the 480×854 design size, where the canvas is 1:1 and every design coordinate is a
screen coordinate. `openAnother({ viewport })` opens one at a real device size instead, which is how
"the whole game fits a portrait phone screen" checks that Phaser's `FIT` scaling leaves the canvas
inside the viewport with no page scroll — the failure mode there is a canvas wider than the screen,
which pushes controls off the edge and lets a tap turn into a sideways pan instead of a press.

## Writing a test against an infinite procedural world

The world has no hand-authored level to write coordinates against, so **derive the route instead of
hardcoding it**. `tests/game.test.js` runs a BFS over the real world at load time to find the
nearest medium torch, the nearest spot with a rock to walk into and the nearest one with a tree,
then replays those paths in the browser:

```js
const SEED = pickSeed(DEFAULT_SEED);
const TORCH_ROUTE = bfs(SEED, (x, y) => itemAt(x, y, SEED) === 'torch-medium');
```

This keeps the suite honest if the noise is ever retuned: the route moves with the world instead of
silently pointing at a tile that is now rock. Hardcoding `(-8, 0)` would pass today and rot at the
next threshold change.

**Consumables move; terrain and unique objects don't.** Coins, water and lights are salted with a
nonce the run draws at the start and re-salted every time the world respawns (DESIGN.md §4.3), so a
route to one is only valid for a run with that salt. The suite pins one:

```js
const NONCE = 20260818;
const SALT = saltOf(NONCE, 0);
const scatter = (x, y, gems = 0, salt = SALT) => itemAt(x, y, SEED, { salt, gems });
```

Pure tests build their runs with `createRun(SEED, save, NONCE)`. Browser tests open the page on the
same world — the game reads a seed and a nonce off its own URL, which is what `WORLD` passes:

```js
const WORLD = `seed=${DEFAULT_SEED}&nonce=${NONCE}`;
test('...', async (game) => { ... }, { query: WORLD });
```

Routes to terrain (the nearest rock or tree to bump into) and to unique objects (a gem, the
merchant, the compass lying in the dark) need none of this — those don't move with the nonce.

**`bfsChain` strikes off every tile a leg walks over**, not just the one it stops on. With items
spread `MIN_SEPARATION` tiles apart, legs are long enough that an earlier one routinely picks up in
passing the item a later one was aiming at — which fails as a flake rather than as a bug.

The same applies to the sanctums, which move with the seed: a test that wants the first gem asks
`sanctums(SEED)[0].centre` for it rather than naming a tile.

```js
const FIRST_GEM = sanctums(SEED)[0];
const GEM_ROUTE = bfs(SEED, (x, y) => x === FIRST_GEM.centre.x && y === FIRST_GEM.centre.y, 90);
```

**Route with the gems the walker is carrying.** `bfs` takes a `gems` argument and steps with
`canEnter`, not `isWalkable`, because a sanctum gate is only walkable to a run holding the gem it
wants. Routing with the default 0 sends a test around the outside of a sanctum it was supposed to
walk into — and the maximum depth has to be raised too, since the sanctums sit 20 to 110 tiles out
and the default 24 will never reach one.

## Testing the gem chain

A gem changes three things and each is asserted where it actually lives:

- **The rules** — that a gate is shut, that a step into one is rejected as `locked` rather than
  `blocked`, that a tier of items is invisible below its gem count — are pure, so they're `unit(...)`
  tests that build runs with `createRun(SEED, { ...emptySave(), gems: n })`. Passing a save is the
  public way to set a run's starting gems; nothing reaches into a live run to change it.
- **The render** — that the colour reached the screen — needs the browser, and is asserted from
  `wizardZoneTints()` and the `tint` fields of `visibleTiles()` against `gemColour(n)` from `src/config.js`
  rather than a hardcoded hex, so the assertions track the palette rule instead of restating it.
- **The save** — that a gem is only kept if the run banked it at the hut — is read back with
  `save()`. Every browser test gets its own page and so its own empty `localStorage`; no test
  inherits another's save. What a run keeps *however* it ends is the ground it lit, so the tests that
  pin that read `mapped` back out of the slot rather than the run (DESIGN.md §6.1).

## Starting from a player who already has something

A run's starting gems come from the save it is handed, and so do its coins and its tools. In a pure
test that is `createRun(SEED, { ...emptySave(), gems: 2, compass: true }, NONCE)`. In a browser test
it is the `save` page option, which plants save slot 1 before the page loads — `startRun()` then
takes that campaign up through **LOAD GAME** instead of starting a new one over it:

```js
test('the compass sits in the corner', async (game) => { ... },
  { query: WORLD, save: { ...emptySave(), compass: true } });
```

That is prior state, not live state — the browser's version of handing `createRun` a save. Nothing in
the harness ever reaches into a running scene to change it, which is still the rule.

The `cheats` page option is the same idea for the Settings switch (DESIGN.md §6.2): it turns cheats on
before the page loads, so a test can open straight onto a run holding everything. The test that pins
the switch itself does it the player's way instead, through Settings.

## Testing the world's three layers

The separation rule is the one thing here worth asserting outright rather than sampling: a test walks
a 141x141 window, buckets every consumable by kind, and checks no two of a kind are within
`MIN_SEPARATION` — the constant, never the number, so retuning the drop rate is a one-line change. It
is quadratic in the number of items per kind and still runs in milliseconds, because the whole point
of the rule is that there aren't many. Sanctum clearings are skipped — a clearing is a deliberate
hoard with its own cap (two of a kind), tested separately.

The other two invariants worth keeping honest:

- **A gem swaps one kind for one kind.** Count the window at 0, 1, 2 and 3 gems: the totals stay
  within a few percent and the number of distinct kinds stays equal. A retired kind disappearing and
  its replacement appearing is asserted by name.
- **A respawn puts everything back somewhere new.** Empty every item in a window by hand
  (`state.collected.add(...)`), call `respawn(state)`, and assert the window refills, that some of it
  landed on tiles that were empty before, and that nothing is under the character.

Walking a browser test to a sanctum costs roughly 200ms a step, so only the first (20 tiles out) is
driven through the real canvas. Gates further out are covered by the pure tests, which reach them
for free.

## Testing the tile sheet

The art is cut out of `assets/tiles.png` at boot (§9 of `DESIGN.md`), which splits the testing in
two:

- **The derivation is pure and tested without a browser.** `buildSprites(readTile)` in
  `src/data/sprites.js` takes a `readTile(col, row) -> mask` rather than an image, so a `unit(...)`
  test hands it a fake sheet whose every tile is its own coordinate spelled out in pixels — no two
  tiles alike — and can then assert that a sprite really is the tile `src/data/tiles.js` points it
  at, that a terrain naming several tiles gets one sprite each with the bare key aliasing the first,
  that stacking the four colour bands back up reproduces the whole silhouette, and that a floor tile
  draws its border at full strength over ground texture at half. `wallSprite` is pure too, so
  walking a whole ring and counting the pieces it asks for needs no browser either.
- **That the real sheet loaded and was cut is a browser test.** Reading a PNG needs a canvas, so one
  `test(...)` asserts the sheet is the size `src/data/tiles.js` says it is and that every sprite key
  came out as a 16×16 texture. A sprite pointed off the sheet, or a sheet swapped for one of another
  size, fails at boot with a page error — which fails whichever test provoked it.

Don't assert on the *contents* of a real tile: which tile a sprite points at is a design choice that
is meant to be repointed by editing one pair of numbers, and a test that pins the pixels would make
that edit a test failure.

## Adding a test

Add one whenever a fix covers something a player could hit by just playing. Prefer a `unit(...)`
test if the behaviour is expressible in the pure core — `src/core/rules.js`, `src/core/light.js`,
and `src/core/world.js` have no Phaser in them precisely so that most of the game can be tested
without a browser. Reach for a `test(...)` when the bug lives in what's rendered or what a tap does.
