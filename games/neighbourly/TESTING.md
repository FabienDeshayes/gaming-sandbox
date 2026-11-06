# Testing Neighbourly

> **Doc convention:** this describes the tests *as they are now*. Edit in place; git history is
> the changelog.

```bash
cd games/neighbourly
npm install        # phaser + playwright-core from npm — do NOT run `playwright install`
npm test           # every suite, pure first (a few seconds, then about half a minute of browser)
npm run test:rules # the three pure suites only, under a second
npm run test:ui    # the browser suite only
npm run sim        # the simulator (not a test; see sim/README.md)
```

## The suites

| Suite | Kind | Holds |
|---|---|---|
| `tests/pieces.test.mjs` | pure | Every piece scores what its card says, one test per piece named after its card. A last test fails if a piece in the data has no test. |
| `tests/rules.test.mjs` | pure | What every piece leans on: the board is a sum, auras stack and never reach their giver, the floor at 0, the preview equals the placement (tiles included, replacements included), which sets and pieces a run can be offered, a run's levels, and the info panel's read-out adding up. |
| `tests/data.test.mjs` | pure | The data holds together: one base set of twelve and special sets of six, every piece with words and a sprite, every sprite 16×16 in palette colours, every colour role naming a palette colour, and the dev pages' file writers reproducing each data file byte for byte. |
| `tests/game.test.js` | browser | What is drawn, what a tap does, and what the URL sets up, on the real canvas. |

`tests/board.mjs` is shared by the pure suites: `board([[x, y, id], …])` builds a board, `full(id)`
fills one, `scoreAt(b, x, y)` reads a tile.

## The two kinds of test

- **Pure (`node:test`)** imports `src/` directly. Anything that can be said as "given this board,
  this scores" belongs here: it runs in milliseconds and a failure points at a rule.
- **Browser (`tests/harness.js`)** drives the real canvas through Playwright: a local server that
  rewrites the blocked CDN Phaser `<script src>` to the npm copy in the response (never edit
  `index.html` for it), a Chromium found under `/opt/pw-browsers`, and a driver whose
  `tapTile(i)` / `tapOffer(k)` read their positions off the scene's own geometry and whose
  `state()` reads the run, the info panel, the +n/−n tabs and which sprite each tile and card
  draws.

### What earns a test

A test has to fail when the game is wrong, not when the code is merely rearranged. In practice:

- **A rule** (pure): a piece's score, how parts add up, what the preview promises, which pieces a
  run can see. Assert the number the rule says, on a board built so only that rule moves it.
- **What is drawn, what an input does, what the URL sets up** (browser): the sprite on a tile, a
  preview marking exactly the tiles that move, a panel blocking the board, `?seed=`/`?set=`.

What does *not* earn one: that a button opens what it says, that a constant equals itself, that a
layout fits its own numbers. Those pass forever and fail only when the layout is reworked.

## Rules for writing one

- **Words come from `src/text.js`.** A test looks for `HUD.place`, `LEVEL_END.cleared(1)`,
  `PIECE_TEXT[id].rule`, never a spelled-out string, so rewording the game never breaks a test.
- **Moves are derived, not hardcoded.** When a test needs an outcome (clearing level 1, losing it),
  it works the moves out by replaying the same offer script through `rules.js` first, and asserts
  the line really does what the test needs before relying on it.
- **Targets are overridden, never edited.** A run that must pass or fail a level gets
  `{ ...DEFAULT_TUNING, targets: [...] }`, so retuning the targets never breaks a rules test.
- **A new piece needs a test in `pieces.test.mjs`.** The suite fails by name until it has one.
- **A new count, condition or reach needs a read-out in `SUM`.** `data.test.mjs` and the
  read-out test in `rules.test.mjs` fail until it has one.

## What the simulator is, and why no test covers it

`sim/` plays thousands of runs to say how hard the targets are and which pieces carry a run. A
measurement a test pins is a measurement that can never move, so nothing in `sim/` is asserted on;
the rules it rests on are covered above.
