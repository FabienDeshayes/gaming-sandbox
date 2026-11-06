# Testing Neighbourly

```bash
cd games/neighbourly
npm install        # phaser + playwright-core from npm — do NOT run `playwright install`
npm test           # both suites, rules first
npm run test:rules # node --test tests/rules.test.mjs
npm run test:ui    # node tests/game.test.js
npm run sim        # the target-tuning simulator (not a test)
```

## `tests/rules.test.mjs`: the rules

Plain `node:test` against `src/core/rules.js`. Every piece is checked against the rule it
states, on the real terrain map: a test that needs water or rock uses a tile the first test
pins to that terrain, so editing the map fails there rather than quietly testing something
else. Also: the floor at 0, auras stacking, the fixed offer script, the preview equalling what
placing does, and a run's level transitions (with the targets swapped for 0 or 9999 through a
tuning override, never by editing `DEFAULT_TUNING`).

## `tests/game.test.js`: the screen

Playwright against the real canvas, through `tests/harness.js` (adapted from Pitchou's): a
local server that rewrites the blocked CDN Phaser `<script src>` to the npm copy in the
response (never edit `index.html` for it), a Chromium found under `/opt/pw-browsers`, and a
driver whose `tapTile(i)` / `tapOffer(k)` read their positions off the scene's own geometry.

Tests only tap and read back. When a test needs a particular outcome (clearing level 1, losing
it), it works the moves out by replaying the same offer script through `rules.js` first, and
asserts that the line really does what the test needs before relying on it.
