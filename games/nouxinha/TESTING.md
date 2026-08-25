# Testing Nouxinha

> These docs describe the game *as it is now*. When something changes, edit the affected sections
> in place rather than appending notes about what changed — git history is the changelog.

## Running the suite

```bash
cd games/nouxinha
npm install       # playwright-core + phaser, from the allowed npm registry — do NOT run `playwright install`
npm test          # every suite, one server and one browser: about three minutes
npm run test:pure # the seven pure suites only, no browser: about a second
```

`node_modules/` is gitignored. `package.json` is test-only: the game itself has no build step and
runs straight from `index.html` through any static server.

## The suites

`tests/all.test.js` is the whole run: it imports every `*.test.js` file and starts the runner once.
Each of those files registers into the same runner and is also runnable on its own —
`node tests/terrain.test.js` runs just that one, and a pure suite run alone never starts a browser
at all, which is the quick way to work on the rules.

| Suite | Covers |
|---|---|
| `light.test.js` | Light shapes, and what the dark at the edge leaves of them |
| `rules.test.js` | A step's costs, burnout and auto-swap, pickup, the inventory, the recap, cheats |
| `terrain.test.js` | What the noise grows, where the world stops, and that every bit of it can be walked to |
| `scatter.test.js` | The layer that moves: density, the separation rule, hoards, the gem swaps, respawn |
| `campaign.test.js` | Sanctums, key-locked gates, chests, gems, the water ladder, the landmarks, the merchant, the compass |
| `save.test.js` | The three slots, the ground a run keeps however it ends, suspend and resume |
| `sprites.test.js` | The tile sheet table, the derived sprites, the wall nine-slice, the palette rules |
| `ui-shell.test.js` | Title screen, Settings, audio, the canvas against a phone, the sheet actually loading |
| `ui-explore.test.js` | Walking, and the three visibility states the viewport draws |
| `ui-items.test.js` | The HUD counters, the item card, the inventory panel |
| `ui-campaign.test.js` | The hut, the recap, the slots, save/load, death, cheats, the merchant, the map, opening a chest |

Suites share `tests/world.js` — the seed, the pinned nonce, and every route BFSed out of the real
world (see below). Pure suites run first in `all.test.js`, so a broken rule fails in a second rather
than after three minutes of driving a canvas that was never going to agree with it.

## The two kinds of test

Both register against the same runner (`tests/harness.js`):

- **`unit(name, fn)`** — no browser. Imports `src/core/*` and `src/data/*` directly and exercises
  the rules as plain functions: light shapes, durability and burnout ordering, world determinism,
  spawn bands. This is where anything expressible as "given this state, this happens" belongs,
  because it runs in milliseconds and the failure points at a line of logic.
- **`test(name, fn)`** — a fresh page driving the real canvas via Playwright. This is where
  anything a player *does* belongs: tapping the D-pad, swiping the map, opening the item card,
  equipping a torch and seeing the lit area grow.

Every browser test gets its own page, so no test inherits another's run. Any uncaught page error or
console error fails the test that provoked it. A page costs a couple of seconds to open, which is
why a browser test that would only re-assert what a neighbouring one already walked to should be
folded into it rather than added beside it.

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
| `startRun(slot)` | Title screen to a walking run the way a player gets there: **NEW GAME** or **LOAD GAME**, then a slot, then reading the opening text panel out. Loads slot 1 when a save was planted there, starts a fresh campaign in it otherwise |
| `tapDpad(dir)` | Taps a D-pad arrow |
| `swipe(dir)` | Swipes across the map area from its centre |
| `press(key)` | Sends a keyboard key |
| `tapSlot(i)` / `tapCoins()` | Opens an inventory slot's item card / the coin card |
| `state()` | The live run: position, facing, steps, coins, water, gems, seed, **nonce and epoch** (which together make the consumable salt), tools owned, **keys held and chests opened**, unique objects seen, the banked save, explored count, furthest distance, inventory, active light, and which overlay is open — item card, inventory, dialog (and whether that dialog is the cogwheel menu), merchant's counter, map or text panel. `mapView` is the open map overlay's drawing: its scale, the fit/min/max it is allowed, where it sits, how big it is drawn and the window it is drawn in — `null` while the map is closed |
| `visibleTiles()` | What is actually **drawn**: per tile, its world coordinate, ground sprite, alpha, **tint**, **paint**, overlay, item and item tint. Every tile on screen is a stack of colour zones (`src/ui/painted.js`), so `tint` is the colour the bulk of the tile is in and `paint` the colours of the zones over it — a sanctum wearing its own gem's colour shows up there, not in `tint`. This is the render, not the model: it's how the three visibility states get asserted, and the only way to see that a gem's colour actually reached the screen |
| `wizardTexture()` / `wizardZoneTints()` | Which of the four facing sprites is showing, and the tint of each of its colour-zone layers — the silhouette the character set out in, plus the hood, robe and staff that turn the colours of gems one, two and three |
| `tapShopRow(i)` / `tapMapButton()` | Taps a line of the merchant's stock, or the **MAP** button in the navigation rail |
| `dragAt(x0, y0, x1, y1)` | A press-move-release drag in design coordinates, for a scrollable list or for panning the map — unlike `swipe`, it holds at the destination instead of releasing with momentum |
| `wheelAt(x, y, dy)` | A wheel notch over a point, which is how a mouse zooms the map |
| `pinch(x, y, from, to)` | Two fingers centred on a point, going from `from` to `to` pixels apart. Multi-touch is the one input Playwright's mouse can't send, so this goes down to CDP's raw touch events — which is what a phone sends anyway. Needs the page opened with `{ hasTouch: true }` |
| `tapMenuButton()` | Taps the **cogwheel** in the top right, which opens the in-run menu (SETTINGS, SAVE GAME, EXIT GAME, KEEP PLAYING) |
| `textPanel()` | What the text panel is showing: which block of how many, the characters of it on screen so far, and whether that block has finished typing — `null` while the panel is closed |
| `tapPanel()` / `readPanel()` | One tap on the panel, or as many as it takes to read it out and close it |
| `save(slot)` | A save slot straight out of `localStorage`, slot 1 by default. A gem is only *kept* if the run carried it back to the hut, so asserting that has to read the save rather than the run that found it — and since arriving is what banks, the slot is worth reading *before* the hut's dialog is answered as well as after |
| `music()` / `musicTrack()` | Whether the music loop's scheduler is running, and which of the two loops it is playing (`'menu'`, `'explore'`, or `null`) — read out of `src/ui/music.js` itself, since a headless browser can't be asked to listen |
| `sounds()` | Every sound played so far, in order — `'tap'`, `'text'`, `'coin'`, `'pickup'`, `'gem'`, `'chest'`, `'unlock'`, `'torch'`, `'death'`. Read out of `src/ui/sfx.js` the same way, and the only way to assert that a button makes a noise and the D-pad doesn't. The typewriter fires dozens of times a second, so a whole block being read out goes in as a single `'text'` — otherwise one sentence would push every other sound in the run off the end of the log |
| `settle()` | Waits out the step slide, so a read isn't taken mid-tween |
| `canvasFit()` | Where the canvas actually sits against the browser viewport, and whether the page scrolls behind it |
| `openAnother(opts)` | A second page on the same server, for the few things only testable at another screen size. Closed with its parent, and its page errors count as the parent's |

### Testing a screen size

Pages open at the 480×854 design size, where the canvas is 1:1 and every design coordinate is a
screen coordinate. `openAnother({ viewport })` opens one at a real device size instead, which is how
"the whole game fits a portrait phone screen" checks that Phaser's `FIT` scaling leaves the canvas
inside the viewport with no page scroll — the failure mode there is a canvas wider than the screen,
which pushes controls off the edge and lets a tap turn into a sideways pan instead of a press.

## Writing a test against a world with no authored levels

The world has no hand-authored level to write coordinates against, so **derive the route instead of
hardcoding it**. `tests/world.js` runs a BFS over the real world at load time to find the
nearest medium torch, the nearest spot with a rock to walk into and the nearest one with a tree,
then replays those paths in the browser:

```js
const SEED = pickSeed(DEFAULT_SEED);
export const TORCH_ROUTE = bfs(SEED, (x, y) => scatter(x, y) === 'torch-medium', 60);
```

That derivation lives in `tests/world.js` and every suite imports it, so it is paid for once. The
one expensive route — four chained legs to four copies of the same torch — is worked out on request
(`mediumTorchChain()`) rather than at load, so a suite that doesn't walk it doesn't pay for it.

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
export const test = (name, fn, opts = {}) => browserTest(name, fn, { query: WORLD, ...opts });
```

Importing `test` from `tests/world.js` opens on that world; importing `test` from `tests/harness.js`
opens on whatever world NEW GAME draws, which only the couple of tests that are *about* that want.

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

**Route with the keys the walker is carrying.** `bfs` takes a `keys` argument — a `Set`, or `null`
for empty-handed — and steps with `canEnter`, not `isWalkable`, because a sanctum gate is only
walkable to a run holding the key it wants. `ALL_KEYS` in `tests/world.js` is the whole set, for a
route that has to go through a gate; routing with the default `null` sends a test around the outside
of a sanctum it was supposed to walk into. The maximum depth has to be raised too, since the sanctums
sit 20 to 110 tiles out and the default 24 will never reach one.

**A chest is reached by its apron, not by its tile.** A chest can't be stepped on, so
`KEY_CHEST_ROUTE` in `tests/world.js` BFSes to `chestApproach(KEY_CHEST)` — one tile east of it — and
`KEY_CHEST_BUMP` is the direction the last input goes, which is the input that opens it. A test that
routed to the chest's own tile would never find a path.

## Testing the chest-and-key chain

Chests are placed like the landmarks — from the seed, never relaid by a respawn — so a test asks
`chests(SEED)` where they are rather than naming a tile, exactly as it asks `sanctums(SEED)`. Three
claims are worth keeping separate:

- **The terrain claim is pure**: a chest tile is its own terrain, blocks a step, opens for no key,
  casts no shadow, and has floor on all four sides. That is `terrain.test.js`, which walks every
  chest in the world rather than picking one.
- **The rules claim is pure too**: walking into a chest is a bump that costs no step, no water and no
  durability, hands over exactly one key or one hoard, and does *nothing at all* the second time.
  Banking is what keeps both the key and the shut lid, so the assertion that matters is the round
  trip through `bankRun` and back into `createRun` — a run that opened a chest and never got home
  walks back out to a shut one.
- **The render and the voice need the browser**: that the tile is drawn `chest` and then
  `chest-open`, that the text panel comes up over the world, and that the second visit says so in the
  status line instead. One `test(...)` in `ui-campaign.test.js` covers all of it.

`openChest(state, chest)` is the pure way to hand a run a key without walking to it, which is what
the save round-trip test uses — the same way it reaches for `state.tools.add('compass')`.

## Testing the gem chain

A gem changes three things and each is asserted where it actually lives:

- **The rules** — that a gate is shut, that a step into one is rejected as `locked` rather than
  `blocked`, that a tier of items is invisible below its gem count — are pure, so they're `unit(...)`
  tests that build runs with `createRun(SEED, { ...emptySave(), gems: n })`. Passing a save is the
  public way to set a run's starting gems, keys and opened chests; nothing reaches into a live run to
  change it. Note that gems no longer open gates — `keys: ['key-1']` is what does, and a run holding
  all three colours and no key is still standing outside.
- **The render** — that the colour reached the screen — needs the browser, and is asserted from
  `wizardZoneTints()` and the `tint` and `paint` fields of `visibleTiles()` against `gemColour(n)` from
  `src/config.js` rather than a hardcoded hex, so the assertions track the palette rule instead of
  restating it. Which zone a colour lands in is part of the claim: a sanctum's stonework staying the
  foreground while its crown turns its gem's colour is two assertions, not one.
- **The paint itself** — that a zone map is cut into masks that stack back into the whole tile, and
  that a hue waits for the gem it names — is pure, and lives in `tests/sprites.test.js` alongside the
  rest of the art. A new entry in `src/data/paint.js` is checked by that suite without being named in
  it: it walks the whole table.
- **The save** — that a gem is only kept if the run carried it back to the hut — is read back with
  `save()`. Every browser test gets its own page and so its own empty `localStorage`; no test
  inherits another's save. What a run keeps *however* it ends is the ground it lit, so the tests that
  pin that read `mapped` back out of the slot rather than the run (DESIGN.md §6.1).

## Testing a saved expedition

A slot can hold a walk in progress as well as a campaign (DESIGN.md §6.1), and the two are tested
from opposite ends:

- **The round trip is pure.** `suspendRun(state)` hands back the save it would have stored — Node has
  no `localStorage`, which is exactly what makes it readable — and `resumeRun(save)` builds the run
  back out of it. The assertion that matters is not that the fields survived but that *the world
  did*: the pure test walks a window of `itemOnTile` over both runs and expects zero differences,
  because the save stores no world at all, only the seed, the salt's two halves and the tiles the run
  had already emptied. Respawn the world before suspending, or the epoch half of that goes untested.
- **What a save costs and clears is a browser test**, since it needs a real slot to write into: save
  from the cogwheel, leave, and `save()` still holds the walk; die, and it doesn't. Getting to the
  death screen by playing would be 200 taps, so that test plants a suspended run with one mouthful of
  water in it through the `save` page option and lets **LOAD GAME** resume it — prior state, not live
  state, the same as any other planted save.

## Starting from a player who already has something

A run's starting gems come from the save it is handed, and so do its coins, its keys, its opened
chests and its tools. In a pure
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
the switch itself does it the player's way instead, through Settings. It is also how the map's zoom
and pan are tested: a cheat run's revealed world is the biggest drawing the game makes, and a map
that already fits the window has nothing to zoom out of and nowhere to pan to.

`hasTouch` makes the page a touchscreen, which is what `pinch` needs — the only test that asks for
one, since everything else a finger does is a tap or a drag the mouse can stand in for.

## Testing the world's three layers

The separation rule is the one thing here worth asserting outright rather than sampling: a test walks
a 141x141 window, buckets every consumable by kind, and checks no two of a kind are within
`MIN_SEPARATION` from `src/balance.js` — the constant, never the number, so retuning the drop rate is
a one-line change. It
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
  that stacking the four colour bands back up reproduces the whole silhouette, and that floor is drawn
  at half strength and nothing else is. `wallSprite` is pure too, so walking a whole ring and counting
  the pieces it asks for needs no browser either.
- **That the real sheet loaded and was cut is a browser test.** Reading a PNG needs a canvas, so one
  `test(...)` asserts the sheet is the size `src/data/tiles.js` says it is and that every sprite key
  came out as a 16×16 texture. A sprite pointed off the sheet, or a sheet swapped for one of another
  size, fails at boot with a page error — which fails whichever test provoked it.

Don't assert on the *contents* of a real tile: which tile a sprite points at is a design choice that
is meant to be repointed by editing one pair of numbers, and a test that pins the pixels would make
that edit a test failure.

## Testing the text panel

A fresh expedition opens with the text panel over the HUD, and it owns the input while it is up
(DESIGN.md §7) — so `startRun` reads it to the end on the way past, and no other test has to know
that setting out says anything. The one test that is *about* the panel takes the long way to a run
instead (**NEW GAME**, a slot, then straight into `textPanel()`), because `startRun` would have
dismissed the thing it came to look at.

Two things about it are worth asserting and easy to get wrong. **Progressive** is a claim about two
moments, not one: read `textPanel()`, wait a beat, read it again, and the same block has more of
itself on screen. And a tap **fills the block in rather than skipping it** — the assertion is that
the index has *not* moved and `shown` now equals `full`, which is the whole difference between a
text box and a dismiss button.

`full` is the block after wrapping, with real newlines in it, so a test comparing against
`src/text.js` has to put the newlines back to spaces rather than expect the raw string.

## Adding a test

Add one to the suite it belongs to, whenever a fix covers something a player could hit by just
playing. Prefer a `unit(...)` test if the behaviour is expressible in the pure core — `src/core/rules.js`, `src/core/light.js`,
and `src/core/world.js` have no Phaser in them precisely so that most of the game can be tested
without a browser. Reach for a `test(...)` when the bug lives in what's rendered or what a tap does.
