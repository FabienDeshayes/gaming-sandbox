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
| `tapDpad(dir)` | Taps a D-pad arrow |
| `swipe(dir)` | Swipes across the map area from its centre |
| `press(key)` | Sends a keyboard key |
| `tapSlot(i)` / `tapCoins()` | Opens an inventory slot's item card / the coin card |
| `state()` | The live run: position, facing, steps, coins, seed, explored count, furthest distance, inventory, active light, and whether the item card or the hut dialog is open |
| `visibleTiles()` | What is actually **drawn**: per tile, its world coordinate, ground texture, alpha, overlay and item. This is the render, not the model — it's how the three visibility states get asserted |
| `wizardTexture()` | Which of the four facing sprites is showing |
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
nearest medium torch and the nearest spot with a rock to walk into, then replays those paths in the
browser:

```js
const SEED = pickSeed(DEFAULT_SEED);
const TORCH_ROUTE = bfs(SEED, (x, y) => itemAt(x, y, SEED) === 'torch-medium');
```

This keeps the suite honest if the noise is ever retuned: the route moves with the world instead of
silently pointing at a tile that is now rock. Hardcoding `(-8, 0)` would pass today and rot at the
next threshold change.

## Adding a test

Add one whenever a fix covers something a player could hit by just playing. Prefer a `unit(...)`
test if the behaviour is expressible in the pure core — `src/core/rules.js`, `src/core/light.js`,
and `src/core/world.js` have no Phaser in them precisely so that most of the game can be tested
without a browser. Reach for a `test(...)` when the bug lives in what's rendered or what a tap does.
