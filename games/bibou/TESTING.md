# Bibou — Testing a level

> How an agent (or a human) verifies that a level plays exactly as
> [`LEVEL_DESIGN.md`](./LEVEL_DESIGN.md) specifies: the character starts where it
> should, the action budget is right, the intended solution wins, and no wrong
> path sneaks in under budget.

Bibou is plain Phaser-via-CDN with no build step, so testing is done by **driving
the real game in a headless browser** and reading Phaser scene state back out.

## The committed suite: `npm test`

`tests/` holds a small regression suite covering the things that break the game
outright — booting, navigating between scenes, each action type, budgets, walls,
and *staying responsive after the player exits a level*. Run it from `games/bibou`:

```bash
npm install     # playwright-core + phaser, both from the allowed npm registry
npm test
```

Chromium is preinstalled in the sandbox; the harness finds it under
`/opt/pw-browsers/` on its own (override with `CHROMIUM_PATH`). Do **not** run
`playwright install`.

- `tests/harness.js` — the local server, the browser driver (click a label, tap a
  cell, swipe, read scene state), and a minimal runner/assertions.
- `tests/game.test.js` — the tests themselves. `unit(...)` tests are pure
  `src/core/rules.js` math and need no browser; `test(...)` tests each get a fresh
  page driving the real canvas.

`node_modules/` is gitignored; `package.json` is committed and test-only — the game
itself still needs no build step and runs straight from `index.html`.

Add a test here whenever you fix a bug that a player could hit by just playing.
The rest of this doc is for **per-level verification**, which the suite
deliberately doesn't try to cover exhaustively.

## Two levels of checking

1. **Rule math only (fast, no browser).** Move, Shift, and Flip are pure
   coordinate math living in `src/core/rules.js` (see `LEVEL_DESIGN.md` §5). You can
   import that module straight into Node and verify a solution's arithmetic without
   launching anything — good for sanity-checking a new level's intended solution
   before wiring the UI. See [Rule-math check](#rule-math-check).
2. **Full browser smoke test (authoritative).** Actually loads `index.html`, clicks
   the cards/arrows, swipes, and asserts the win overlay appears. This is what
   proves a level is playable end to end. See [Browser smoke test](#browser-smoke-test).

Prefer the browser test when claiming a level "works" — the math check can't catch
input wiring, budget, or scene-flow bugs.

## Source layout

The game is split into ES modules under `src/` (see `DESIGN.md` §12 for the full
table). Two facts matter for testing:

- **`src/core/rules.js` is pure** — no Phaser, no scene state, plain `{x, y}` in and
  out — so Node can import it directly.
- **`index.html` loads `src/main.js` with `<script type="module">`.** The harness
  below serves the directory over HTTP, so nested module paths resolve normally. ES
  modules do *not* work over `file://`, so always go through the local server.

## Sandbox gotcha: the CDN is blocked

`index.html` loads Phaser from `https://cdn.jsdelivr.net`. In the remote sandbox,
**outbound CDN requests are blocked** (you'll see `ERR_TUNNEL_CONNECTION_FAILED`),
so a headless browser can't fetch Phaser that way. The npm registry *is* reachable,
though, so install Phaser from npm and serve that copy locally, rewriting the CDN
`<script src>` on the fly. Do **not** change `index.html` itself — the swap happens
only in the test's local server.

```bash
cd games/bibou
npm install     # playwright-core + phaser, both from the allowed npm registry
```

Chromium is preinstalled in the sandbox; find it under `/opt/pw-browsers/` (e.g.
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`) and pass it as
`executablePath` — do not run `playwright install`. `tests/harness.js` already does
both of these things, so a one-off level check is usually easiest written against
it rather than from scratch.

## Rule-math check

Import the game's own rules — don't re-implement them, or you'll be testing your
copy instead of the game. Every function takes and returns a plain `{x, y}`, and an
entity an action doesn't touch (on another row, or on a flip's fixed line) comes
back unchanged.

Importing `src/data/levels.js` alongside them is often the fastest way to check a
new level: the level objects are plain data, so a scratch script can build the
entity list exactly as `PuzzleScene.create` does and replay the intended solution
against the real rules before any UI is involved.

Write the check as a plain `.js` file — `package.json` sets `"type": "module"`, so Node already treats it as ESM:

```js
// check.js — run from games/bibou with: node check.js
// (package.json sets "type": "module", so a plain .js file here is ESM.)
import {
  moveEntity,
  shiftEntity,
  flipEntity,
  resolveMoveChain,
  applyMoveChain,
  resolveCycleOutcome,
  shiftOrder,
  buildWallSet,
} from './src/core/rules.js';

const N = 5;
const eq = (a, b, label) =>
  console.log(label, a, a.x === b.x && a.y === b.y ? 'OK' : `WRONG (want ${JSON.stringify(b)})`);

// Wraparound (LEVEL_DESIGN.md §2.1) — how Level 2's key is reached.
eq(moveEntity({ x: 4, y: 2 }, 'Right', N), { x: 0, y: 2 }, 'wrap:');

// Shift moves only the addressed line (§5.2).
eq(shiftEntity({ x: 2, y: 3 }, 'row', 3, 'Right', N), { x: 3, y: 3 }, 'shift on row:');
eq(shiftEntity({ x: 2, y: 1 }, 'row', 3, 'Right', N), { x: 2, y: 1 }, 'shift other row:');

// Flip is its own inverse, and the middle line is a fixed point (§5.3) — the
// fixed point is the whole puzzle in Level 4, where the sealed key sits at
// (2,0), on the middle column.
eq(flipEntity(flipEntity({ x: 1, y: 1 }, 'row', N), 'row', N), { x: 1, y: 1 }, 'flip x2:');
eq(flipEntity({ x: 2, y: 0 }, 'column', N), { x: 2, y: 0 }, 'L4 wrong axis:');
eq(flipEntity({ x: 2, y: 0 }, 'row', N), { x: 2, y: 4 }, 'L4 right axis:');

// A wall makes the step across it illegal (§1.2) — Level 2's key is sealed off
// from three sides so only the wraparound edge is left.
const l2walls = buildWallSet([
  [{ x: 0, y: 1 }, { x: 0, y: 2 }],
  [{ x: 0, y: 2 }, { x: 0, y: 3 }],
  [{ x: 0, y: 2 }, { x: 1, y: 2 }],
]);
console.log(
  'L2 direct step blocked:',
  resolveMoveChain(l2walls, [{ kind: 'character', pos: { x: 1, y: 2 } }], { x: 1, y: 2 }, 'Left', N)
    .kind === 'illegal'
    ? 'OK'
    : 'WRONG'
);

// Full-loop push (§5.1.1 case 3): a row completely full rotates by one rather
// than deadlocking. No level relies on this today, but the rule is live.
const noWalls = buildWallSet([]);
const packed = [
  { kind: 'character', pos: { x: 1, y: 2 } },
  { kind: 'crate', pos: { x: 0, y: 2 } },
  { kind: 'crate', pos: { x: 2, y: 2 } },
  { kind: 'crate', pos: { x: 3, y: 2 } },
  { kind: 'crate', pos: { x: 4, y: 2 } },
];
const loop = resolveMoveChain(noWalls, packed, { x: 1, y: 2 }, 'Right', N);
console.log('full-loop push:', loop.kind === 'loop' && loop.path.length === 6 ? 'OK' : 'WRONG');
applyMoveChain(packed, loop.path);
eq(packed[0].pos, { x: 2, y: 2 }, 'loop char ->:');

// Level 3: a crate crushed against a wall is destroyed rather than the whole
// move being rejected (§5.4). `victim.contains` is the key it drops.
const l3walls = buildWallSet([[{ x: 2, y: 2 }, { x: 3, y: 2 }]]);
const l3 = [
  { kind: 'character', pos: { x: 1, y: 2 } },
  { kind: 'crate', pos: { x: 2, y: 2 }, contains: { type: 'key', required: true } },
];
const crush = resolveMoveChain(l3walls, l3, { x: 1, y: 2 }, 'Right', N);
console.log(
  'L3 crate crushed via Move:',
  crush.kind === 'destroy' && crush.victim.contains?.type === 'key' ? 'OK' : 'WRONG'
);

// Level 5: the corridor walls run perpendicular to the shift, so a Shift of the
// crate's column crushes it — the one thing Move can never do on that board.
const corridor = [];
for (let x = 0; x < N; x++) {
  corridor.push([{ x, y: 1 }, { x, y: 2 }]);
  corridor.push([{ x, y: 2 }, { x, y: 3 }]);
}
const l5crate = { kind: 'crate', pos: { x: 2, y: 2 }, contains: { type: 'key', required: true } };
const l5 = resolveCycleOutcome(buildWallSet(corridor), [l5crate], shiftOrder('column', 2, 'Down', N));
console.log('L5 crate crushed via Shift:', l5[0]?.outcome === 'destroy' ? 'OK' : 'WRONG');

// ... and that Move alone can't: pushing along the corridor just slides it, and
// the character can't enter the corridor from above to push down.
const l5move = resolveMoveChain(
  buildWallSet(corridor),
  [{ kind: 'character', pos: { x: 2, y: 1 } }, l5crate],
  { x: 2, y: 1 },
  'Down',
  N
);
console.log('L5 Move cannot reach the crate:', l5move.kind === 'illegal' ? 'OK' : 'WRONG');
```

> `package.json` sets `"type": "module"`, so a plain `.js` file in this directory
> is already ESM and can `import` the game's modules directly — a scratch file
> written as CommonJS (`require`) will *not* run here.

## Browser smoke test

The harness below loads the game, exposes the `Phaser.Game` instance, and gives you
helpers to click a button by its label, tap a board cell by `(x, y)`, swipe from a
cell, and read `characterPos` / the HUD out of the live `PuzzleScene`. Adapt the
"drive the level" section for whatever level you're checking.

### How it hangs together

- **Capture the game instance.** `src/main.js` calls `new Phaser.Game(...)` but never
  stores it globally. An `addInitScript` installs a setter trap on `window.Phaser`
  that wraps `Phaser.Game` in a `Proxy` so the constructed game lands on
  `window.__game`. From there, `window.__game.scene.getScene('PuzzleScene')` reaches
  live state.
- **Coordinate mapping.** The design space is fixed at 480×854 but the canvas is
  scaled with `Phaser.Scale.FIT`. Convert design coords → screen with the canvas's
  `getBoundingClientRect()` and the ratio `rect.width / game.scale.width`.
- **Board cells.** `BOARD_X = 40`, `BOARD_Y = 230`, `CELL = 80` (all from
  `src/config.js`); a cell center in design space is `(40 + x*80 + 40, 230 + y*80 + 40)`.
- **Move needs no card.** There is no `Move` button to click: the four direction
  arrows (`▲▼◀▶`) sit around the character whenever no action card is selected, so a
  test walks by clicking those directly, or by swiping. Move also costs nothing, so
  `scene.movesUsed` is a tally and `scene.actionsUsed`/`scene.remaining` are what
  the budget assertions look at.
- **The Move arrows are hidden, not destroyed,** while an action card owns the
  board (`BoardView.hideMoveArrows`), so a lookup by glyph must filter on
  `visible` — otherwise a parked `▶` collides with Shift's row arrows and throws
  the `nth` index off. `tests/harness.js`'s `texts()` and `clickText()` both do
  this, which is also the honest model: a player can't tap what isn't drawn.
- **Shift arrows share glyphs.** Each row's inward arrows are `▶` (left edge) and
  `◀` (right edge), and each column's are `▼` (top) and `▲` (bottom) — so a glyph
  lookup by text alone is ambiguous. Filter `children.list` for the glyph and index
  into the result; the arrows are created row 0..4 then column 0..4, so the Nth `▶`
  shifts row N right and the Nth `▼` shifts column N down. Flip's two arrows (`↔`
  above the middle column, `↕` left of the middle row) are unique, so a plain
  lookup by glyph works for those.
- **A control is tappable one frame after it's created.** Phaser folds a newly
  interactive object into its hit-test list on the following frame, so a click
  fired in the same frame an action resolves lands on nothing. `harness.js`'s
  `settle()` waits out the tween *and* one `requestAnimationFrame` for this
  reason; a hand-rolled driver that clicks the instant `animating` goes false
  will silently drop roughly every other input.
- **The level list scrolls.** `LevelSelectScene` gives every level a fixed-height
  row (button + description) and scrolls instead of shrinking to fit, so a level
  far enough down the list needs the list scrolled before its row is in the
  tappable viewport. `tests/harness.js` exposes `scrollToLevel(id)` for this (jumps
  straight to a level's row rather than simulating a drag); the standalone snippet
  below doesn't reproduce it, so copy that helper too if you add enough levels to
  push one below the fold.
- **Reading text.** Buttons, arrows (`▲◀▶▼`, `↔`, `↕`), the top-right `✕`/`↻`
  buttons, the HUD, the per-card `"N left"` counters, and the win overlay are all
  Phaser text objects — enumerate `scene.children.list` and read `.text` (filtering
  on `visible`, above). `"You win!"` present ⇒ the level was solved. There is **no
  lose overlay**: Move is free, so a level can only be won or restarted (`↻`).
- **Entity state.** `PuzzleScene.entities` is the entity layer: an array of
  `{ kind: 'character' | 'crate' | 'collectible', pos: {x, y} }`.
  `scene.characterPos` is a getter onto the character's `pos`; crates and
  collectibles read as `s.entities.filter(e => e.kind === ...)`. A crate carrying a
  key holds it in `crate.contains` and is *not* on the board as a collectible until
  the crate is destroyed — so "the key appeared" is asserted as a new entry in the
  collectibles list, on the tile the crate died on.
- **Per-action budgets.** `scene.remaining` maps each offered action to its own
  remaining uses (`Infinity` in Test mode, which serializes to `null` through
  `page.evaluate` — compare inside the browser context if you need the value).
  Move is never in it. `scene.budget` is the sum of all pools, and is `0` on a
  level that offers no actions at all.

### Runnable harness

`tests/harness.js` is the maintained version of everything below — for a one-off
check, prefer importing it (`import { startServer, launchBrowser, openGame } from
'./tests/harness.js'`) over copying this. The standalone listing is kept because it
shows, in one place, *why* each piece is there.

```js
// node smoke.cjs — standalone (CommonJS, hence .cjs: package.json is type:module)
const { chromium } = require('./node_modules/playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript' };

// Local server that serves the real files but swaps the CDN Phaser for the npm one.
const server = http.createServer((req, res) => {
  const p = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  if (p === '/phaser.min.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript' });
    res.end(fs.readFileSync(path.join(ROOT, 'node_modules/phaser/dist/phaser.min.js')));
    return;
  }
  const f = path.join(ROOT, p);
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); res.end('nf'); return; }
    let out = data;
    if (path.extname(f) === '.html')
      out = data.toString().replace(/https:\/\/cdn\.jsdelivr\.net\/[^"']*phaser[^"']*/, '/phaser.min.js');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'text/plain' });
    res.end(out);
  });
});

(async () => {
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const errors = [];

  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', // adjust to the installed build
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 480, height: 854 } });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  // Trap Phaser.Game so the constructed game is reachable as window.__game.
  await page.addInitScript(() => {
    let stored;
    Object.defineProperty(window, 'Phaser', {
      configurable: true,
      get() { return stored; },
      set(v) {
        if (v && v.Game)
          v.Game = new Proxy(v.Game, {
            construct(t, a) { const g = Reflect.construct(t, a); window.__game = g; return g; },
          });
        stored = v;
      },
    });
  });

  await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  // --- helpers ---
  const rect = () => page.evaluate(() => {
    const c = document.querySelector('canvas');
    const r = c.getBoundingClientRect();
    const g = window.__game;
    return { left: r.left, top: r.top, sx: r.width / g.scale.width, sy: r.height / g.scale.height };
  });
  const clickText = async (label) => {
    const pos = await page.evaluate((label) => {
      const s = window.__game.scene.getScenes(true).slice(-1)[0];
      const o = s.children.list.find((c) => c.text === label && c.input);
      if (!o) return null;
      const b = o.getBounds();
      return { x: b.centerX, y: b.centerY };
    }, label);
    if (!pos) throw new Error('button not found: ' + label);
    const R = await rect();
    await page.mouse.click(R.left + pos.x * R.sx, R.top + pos.y * R.sy);
    await page.waitForTimeout(250);
  };
  const cellXY = (x, y) => ({ px: 40 + x * 80 + 40, py: 230 + y * 80 + 40 });
  const clickCell = async (x, y) => {
    const R = await rect(); const { px, py } = cellXY(x, y);
    await page.mouse.click(R.left + px * R.sx, R.top + py * R.sy);
    await page.waitForTimeout(250);
  };
  const swipe = async (x, y, dx, dy) => {
    const R = await rect(); const { px, py } = cellXY(x, y);
    const x0 = R.left + px * R.sx, y0 = R.top + py * R.sy;
    await page.mouse.move(x0, y0); await page.mouse.down();
    await page.mouse.move(x0 + dx, y0 + dy, { steps: 5 }); await page.mouse.up();
    await page.waitForTimeout(250);
  };
  const state = () => page.evaluate(() => {
    const s = window.__game.scene.getScene('PuzzleScene');
    return {
      char: { x: s.characterPos.x, y: s.characterPos.y },
      crates: s.entities.filter((e) => e.kind === 'crate').map((e) => ({ x: e.pos.x, y: e.pos.y })),
      used: s.movesUsed,
      remaining: s.remaining,          // per action type — Infinity arrives as null
      budget: s.unlimited ? 'inf' : s.budget,
    };
  });
  const texts = () => page.evaluate(() =>
    window.__game.scene.getScenes(true).slice(-1)[0].children.list.filter((c) => c.text !== undefined).map((c) => c.text));

  // --- drive the level (example: Level 4 — one row flip frees the sealed key) ---
  await clickText('Start');          // use 'Test' instead for unlimited budgets
  await clickText('Level 4');
  console.log('start:', await state());

  await clickText('Flip');
  await swipe(2, 2, 0, 60);          // vertical swipe = mirror across the middle row
  console.log('after flip:', await state());  // key (2,0) -> (2,4), crate (1,1) -> (1,3)

  // Walking needs no card at all — just tap the arrows around the character.
  for (const glyph of ['▼', '▼', '▶', '▶']) await clickText(glyph);
  console.log('at the key:', await state());

  const end = await texts();
  const won = end.includes('You win!');
  console.log('texts:', end);
  console.log(won ? 'PASS: level solved' : 'FAIL: no win', 'errors:', errors);

  await browser.close();
  server.close();
  process.exit(won && errors.length === 0 ? 0 : 1);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
```

## A good level test covers

- **Setup:** character starts on the level's `entities.character`, crates on
  `entities.crates`, goal renders on `background.goal`, HUD shows `Moves: 0` (plus
  `Actions: 0 / <sum of budgets>` when the level offers any), and each card shows
  its own `"N left"` (or `∞` in Test mode). A level with `actionBudget: {}` must
  show no cards at all.
- **The key gates the goal:** every level places one `required` key. Assert the
  objective line names it from the start — *including* when it's sealed inside a
  crate and not yet on the board — that reaching the goal without it leaves
  `gameOver` false with the `"Get the ... first"` hint, and that the objective
  flips to `"Objective: reach the goal"` once it's collected.
- **Intended solution wins:** running the documented steps ends with `"You win!"`.
- **Move is free and never runs out:** walking a level far past any old budget must
  leave `gameOver` false, spend nothing from `scene.remaining`, and keep counting
  in `movesUsed`. A blocked move isn't even counted.
- **The right action is the puzzle:** each level's budgeted action has exactly one
  useful target. Assert the *wrong* one is either free (a no-op or wall-blocked
  Shift leaves `remaining` untouched — see Level 5) or genuinely wasteful (Level
  4's column flip leaves the key sealed), and that `↻` restores the level to its
  opening state either way.
- **Budgets are spent per action type:** after using one action, assert that only
  *its* entry in `scene.remaining` dropped. A spent action's card must grey out and
  stop responding (selecting it sets the hint `"No <Action> actions left"` and does
  not increment `actionsUsed`), while Move keeps working regardless.
- **Crates move with the board:** on a level with crates, assert their positions
  after Shift/Flip. Move always targets the character — there is no way to select a
  crate directly.
- **Pushing resolves correctly:** on a level where a Move's destination is occupied
  (Levels 3 and 5), assert every entity in the chain shifted by one, not just the
  character — including the full-loop case (`LEVEL_DESIGN.md` §5.1.1 case 3), where
  a fully-occupied row/column rotates by one instead of the move being rejected. No
  level relies on the full loop today, so cover it as rule math.
- **Walls block correctly, and only where drawn:** on a level with walls, assert the
  blocked direction stays illegal (hint changes, `movesUsed`/`scene.remaining` don't
  change, entity doesn't move) and that the documented way round still succeeds. For
  the wraparound case (Level 2, `LEVEL_DESIGN.md` §1.2/§2.1), also assert the seam
  where *no* wall was placed still works — that's the level's whole solution.
- **Destructible crates and what they drop (`LEVEL_DESIGN.md` §3/§5.4):** assert a
  crushed crate is removed from `s.crates`, that *nothing else* in that jam moves
  that action (`s.char` unchanged), and — for a crate with `contains` — that a new
  collectible appears in `s.collectibles` on the tile the crate died on. Check the
  crush through both Move and Shift, since they're separate code paths
  (`resolveMoveChain` vs. `resolveCycleOutcome`) sharing the same rule.
- **Both input styles:** exercise arrow taps *and* swipes (cardinal swipes for
  Move, with nothing selected; horizontal = column flip / vertical = row flip for
  Flip), since they're separate code paths.
- **Test-mode selection:** from the title, `Test → Level N` runs that level with
  every pool unlimited (HUD shows `∞`, each card shows `∞ left`, a `TEST` badge
  appears) — which is how a level's wrong turns get exercised without restarting.
- **Transitions leave sprites as they found them:** an animation that squashes or
  grows a sprite (Flip, the goal pulse) must restore its *own* resting scale, not a
  hardcoded 1 — the crate is a 16px texture shown at 48px, so it rests at scale 3.
  Assert `displayWidth`/`displayHeight` are unchanged once the tween has settled.
- **No console/page errors** across the whole run. Note the harness's own server
  404s on `/favicon.ico` — that request comes from the browser, not the game, so
  filter it out rather than chasing it.
