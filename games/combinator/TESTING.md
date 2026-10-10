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

Plain `node:test` against `src/core/machine.js`, no browser: how ports link,
sources running out, open ports spilling and drawing, controls, loops with no
source, waste heat and burning, steam, effect areas, determinism, and the
readout naming the real cause of a stop. Each test builds its own small bench
inline, and reads tuned numbers (charges, `TUNING.burnTurns`) from the data
tables instead of writing them down twice.

## `tests/game.test.js` — the screen

Playwright against the real canvas, through `tests/harness.js` (copied from
Pitchou's and trimmed). Every test gets a fresh page that opens on the first
example machine; tests that build from scratch press **Clear bench** first.
Tests only send the pointer and key events a player would, then read
`BenchScene` state back (`game.state()`).

The harness serves the game folder and rewrites the blocked CDN Phaser
`<script src>` to the npm copy in the response. `index.html` on disk is never
modified.

`node tests/shot.mjs <dir>` screenshots each example machine, for a quick look
at the screen. It is not a test.
