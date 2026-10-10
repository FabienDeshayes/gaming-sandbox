# Testing Combinator

```bash
cd games/combinator
npm install        # phaser + playwright-core, from the allowed npm registry
                   # — do NOT run `playwright install`
npm test           # both suites, rules first
npm run test:rules # node --test tests/rules.test.mjs
npm run test:ui    # node tests/game.test.js
```

## `tests/rules.test.mjs` — the rules

Plain `node:test` against `src/core/machine.js`, no browser: how an input
takes the nearest untaken flow to its left along a machine's row, sources
running out, open inputs drawing from the ground under the machine, spills
onto its tile, controls, waste heat and burning, steam, effect areas facing
the machine's front, machines meeting through shared tiles in a round,
determinism whatever order machines are listed in,
and the readouts naming the real cause of a stop. Each test builds its own
small machine (and world) inline, and reads tuned numbers (charges,
`TUNING.burnTurns`) from the data tables instead of writing them down twice.

## `tests/game.test.js` — the screen

Playwright against the real canvas, through `tests/harness.js` (copied from
Pitchou's and trimmed). Every test gets a fresh page with empty
`localStorage`, so it opens on the Workbench with the three starting machines
saved and placed; tests that build from scratch press **New** first. Tests only
send the pointer and key events a player would, flip screens with
`game.open('Playground')`, and read the shown scene's `testState()` back
(`game.state()`). `game.slot(i)` is slot i of the Workbench row and
`game.tile(x, y)` a tile of the Playground. `game.reload()` reloads the page and keeps storage, for
anything that has to survive a visit.

The harness serves the game folder and rewrites the blocked CDN Phaser
`<script src>` to the npm copy in the response. `index.html` on disk is never
modified.

Tests opened with `{ phone: true }` get a portrait touch screen (390×844, three
device pixels per CSS pixel), and so the mobile layout. They drive it the way a
finger would: `game.tap`, `game.tapText`, and `game.swipe` for a drag, sent as
touch events rather than mouse ones. Design coordinates still work everywhere:
the harness divides out the mobile layout's camera zoom.

`node tests/shot-phone.mjs <dir>` screenshots the mobile layout, each screen
with each of its tabs.

`node tests/shot.mjs <dir>` screenshots each starting machine on the Workbench
and the starting Playground, for a quick look at the screens. It is not a test.
