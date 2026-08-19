# Testing Pitchou

Two suites, and they check different things.

```bash
cd games/pitchou
npm install        # phaser + playwright-core, from the allowed npm registry
                   # — do NOT run `playwright install`
npm test           # both suites, rules first
npm run test:rules # node --test tests/rules.test.mjs
npm run test:ui    # node tests/game.test.js
```

## `tests/rules.test.mjs` — the rules

Plain `node:test` against `src/core/rules.js`, no browser. This is where a rule the
tuning rests on gets pinned: the drain schedule, the halved bust, the cap clamp, a
tool rewriting the shore, the storm's scheduled waves, a seed replaying exactly.

Its helper `stackBag(state, tokens)` reverses the tokens into `state.bag`, because
`search()` pops the bag from the end — **the last element is drawn first.** Anything
that hands the rules a rigged bag has to respect that.

## `tests/game.test.js` — the screen

Playwright against the real canvas. `unit(...)` tests run pure rules math with no
browser; `test(...)` tests each get a fresh page.

`tests/harness.js` holds three things:

- **A local server** that serves the real game directory and rewrites the blocked CDN
  `<script src>` to a locally-served copy of the npm Phaser **in the response**.
  `index.html` on disk is never modified — do not "fix" it to point at node_modules.
- **A driver.** `startRun()`, `tapSearch()`, `tapGoHome()`, `tapStack(resource)`,
  `tapTool(name)`, `clickText(label)`, `clickTextMatching(pattern)`, `texts()`,
  `state()` (a read-only snapshot of `NightScene`), `settle()`, `canvasFit()`.
  Chromium is found under `/opt/pw-browsers/` (override with `CHROMIUM_PATH`).
- **A runner** with `test`, `unit`, `assert`, `assertEqual`, `run`.

Two rules the suite is built on:

**Nothing reaches into a running scene.** Tests send the pointer events a player
would and only read state back. The single exception is `openGame`'s `prefs`, which
plants the Settings in `localStorage` *before* the page loads — that is a player who
had already turned the sound off, not a reach into a live scene.

**No test hardcodes a draw.** There are no authored levels; a night is whatever the
shuffled shore gives. A test that needs a particular kind of night — one that
overfills a meter, a season that is winnable, a season that is not — finds the seed by
replaying seasons against `src/core/rules.js` first (`findSeed`, `playSeason` at the
top of the file), then plays that same seed through the UI with `{ seed }`. If you
find yourself typing a coordinate or a seed constant, derive it instead.

Long seasons pass `prefs: { motion: false }`, which collapses every tween without
changing what is shown — a twelve-night season is a few hundred taps.

Every test fails on page errors and on non-favicon console errors.

## Adding a test

Add one whenever a fix covers something a player could hit by just playing. The dawn
panel reporting a full basket as "nothing survived the walk home" is the example
already in the suite: it was found by looking at a screenshot, and it now has a test.

For sanity-checking a tuning question rather than the screen, don't write a test —
`npm run sim` plays 20,000 seasons per policy and `npm run sweep` puts the ablations
next to the current numbers. `DESIGN.md` §8 records what those runs settled and why.
