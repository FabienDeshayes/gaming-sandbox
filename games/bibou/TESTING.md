# Bibou — Testing a level

> How an agent (or a human) verifies that a level plays exactly as
> [`LEVEL_DESIGN.md`](./LEVEL_DESIGN.md) specifies: the character starts where it
> should, the action budget is right, the intended solution wins, and no wrong
> path sneaks in under budget.

Bibou is plain Phaser-via-CDN with no build step, so there's no test runner wired
up. Testing is done by **driving the real game in a headless browser** and reading
Phaser scene state back out. This doc gives you a ready-to-adapt harness.

## Two levels of checking

1. **Rule math only (fast, no browser).** Move, Rotate, Shift, and Flip are pure
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
npm i playwright-core phaser@3     # both resolve from the allowed npm registry
```

Chromium is preinstalled in the sandbox; find it under `/opt/pw-browsers/` (e.g.
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`) and pass it as
`executablePath` — do not run `playwright install`.

> **Clean up before committing.** `node_modules/`, `package.json`, and
> `package-lock.json` are test-only scaffolding. Remove them once you're done so
> the commit stays to source + docs:
> `rm -rf node_modules package.json package-lock.json`

## Rule-math check

Import the game's own rules — don't re-implement them, or you'll be testing your
copy instead of the game. Rotate shifts the 8 tiles around a center one step along
the clockwise ring `TL→T→TR→R→BR→B→BL→L` (indices 0..7). Every function takes and
returns a plain `{x, y}`, and an entity an action doesn't touch (off the rotation
ring, on another row) comes back unchanged.

Write the check as an `.mjs` file so Node treats it as ESM:

```js
// check.mjs — run from games/bibou with: node check.mjs
import {
  moveEntity,
  rotateEntity,
  shiftEntity,
  flipEntity,
  resolveMoveChain,
  applyMoveChain,
  buildWallSet,
  isRotateBlocked,
  isShiftBlocked,
} from './src/core/rules.js';

const N = 5;
const eq = (a, b, label) =>
  console.log(label, a, a.x === b.x && a.y === b.y ? 'OK' : `WRONG (want ${JSON.stringify(b)})`);

// Level 2: (1,2) --CW around (2,3)--> (2,2) --CW around (1,3)--> (2,3) = goal
let c = { x: 1, y: 2 };
c = rotateEntity(c, { x: 2, y: 3 }, true, N);
c = rotateEntity(c, { x: 1, y: 3 }, true, N);
eq(c, { x: 2, y: 3 }, 'L2:');

// Level 3: (2,3) --row-3 Right--> (3,3) --column-3 Up--> (3,2) = goal
let s = { x: 2, y: 3 };
s = shiftEntity(s, 'row', 3, 'Right', N);
s = shiftEntity(s, 'column', 3, 'Up', N);
eq(s, { x: 3, y: 2 }, 'L3:');

// Level 4: (1,1) --column flip--> (3,1) --row flip--> (3,3) = goal.
// `axis` is the mirror line, so 'column' flips x and 'row' flips y.
let f = { x: 1, y: 1 };
f = flipEntity(f, 'column', N);
f = flipEntity(f, 'row', N);
eq(f, { x: 3, y: 3 }, 'L4:');

// Flip is its own inverse, and the middle line is a fixed point (§5.4) — the
// two ways a Flip level gets lost.
eq(flipEntity(flipEntity({ x: 1, y: 1 }, 'row', N), 'row', N), { x: 1, y: 1 }, 'flip x2:');
eq(flipEntity({ x: 0, y: 2 }, 'row', N), { x: 0, y: 2 }, 'mid row fixed:');

// Level 5: one Flip + one Move, either order
let m = { x: 1, y: 2 };
m = flipEntity(m, 'column', N);
m = moveEntity(m, 'Down', N);
eq(m, { x: 3, y: 3 }, 'L5:');

// Wraparound (LEVEL_DESIGN.md §2.1)
eq(moveEntity({ x: 4, y: 0 }, 'Right', N), { x: 0, y: 0 }, 'wrap:');

// Level 6: full-loop push (LEVEL_DESIGN.md §5.1.1/§7) — row y=2 completely
// full, character (1,2) moves Right and the whole row rotates by one.
// resolveMoveChain takes a wall lookup (buildWallSet), not the raw level —
// no walls here, so an empty set.
const noWalls = buildWallSet([]);
const l6entities = [
  { kind: 'character', pos: { x: 1, y: 2 } },
  { kind: 'crate', pos: { x: 0, y: 2 } },
  { kind: 'crate', pos: { x: 2, y: 2 } },
  { kind: 'crate', pos: { x: 3, y: 2 } },
  { kind: 'crate', pos: { x: 4, y: 2 } },
];
const chain = resolveMoveChain(noWalls, l6entities, { x: 1, y: 2 }, 'Right', N);
console.log(
  'L6 chain:',
  chain,
  chain && chain.length === 6 ? 'OK' : 'WRONG (expected 6-tile loop back to start)'
);
applyMoveChain(l6entities, chain);
eq(l6entities[0].pos, { x: 2, y: 2 }, 'L6 char (goal):');
eq(l6entities[1].pos, { x: 1, y: 2 }, 'L6 crate 0,2 ->:');
eq(l6entities[2].pos, { x: 3, y: 2 }, 'L6 crate 2,2 ->:');
eq(l6entities[3].pos, { x: 4, y: 2 }, 'L6 crate 3,2 ->:');
eq(l6entities[4].pos, { x: 0, y: 2 }, 'L6 crate 4,2 ->:');

// Level 7: a wall directly between the character and the goal blocks the
// 1-move direct path; the 3-move detour around it is unaffected.
const l7walls = buildWallSet([[{ x: 1, y: 2 }, { x: 2, y: 2 }]]);
const l7entities = [{ kind: 'character', pos: { x: 1, y: 2 } }];
console.log(
  'L7 direct move blocked:',
  resolveMoveChain(l7walls, l7entities, { x: 1, y: 2 }, 'Right', N) === null ? 'OK' : 'WRONG'
);
let w = { x: 1, y: 2 };
w = moveEntity(w, 'Up', N);
w = moveEntity(w, 'Right', N);
w = moveEntity(w, 'Down', N);
eq(w, { x: 2, y: 2 }, 'L7 detour:');

// Level 8: a wraparound wall on the x=0/x=4 seam of row y=2 blocks the wrap
// shortcut; the long way around the row is unaffected.
const l8walls = buildWallSet([[{ x: 0, y: 2 }, { x: 4, y: 2 }]]);
const l8entities = [{ kind: 'character', pos: { x: 0, y: 2 } }];
console.log(
  'L8 wraparound move blocked:',
  resolveMoveChain(l8walls, l8entities, { x: 0, y: 2 }, 'Left', N) === null ? 'OK' : 'WRONG'
);

// Rotate/Shift reject the whole action when any entity's one-step move would
// cross a wall (LEVEL_DESIGN.md §5.2/§5.3) — checked before anything moves.
const ringWall = buildWallSet([[{ x: 2, y: 1 }, { x: 3, y: 1 }]]); // T -> TR step
console.log(
  'Rotate blocked by ring-step wall:',
  isRotateBlocked(ringWall, [{ pos: { x: 2, y: 1 } }], { x: 2, y: 2 }, true, N) === true
    ? 'OK'
    : 'WRONG'
);
const shiftWall = buildWallSet([[{ x: 2, y: 2 }, { x: 3, y: 2 }]]);
console.log(
  'Shift blocked by wall:',
  isShiftBlocked(shiftWall, [{ pos: { x: 2, y: 2 } }], 'row', 2, 'Right', N) === true
    ? 'OK'
    : 'WRONG'
);
```

> Node ≥ 22 detects module syntax, so importing `src/core/rules.js` works even
> though the throwaway `package.json` from `npm i` has no `"type"` field — it just
> prints a `MODULE_TYPELESS_PACKAGE_JSON` warning. Add `"type": "module"` to that
> `package.json` to silence it (and to make the import work at all on older Node).

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
- **Shift arrows share glyphs.** Each row's inward arrows are `▶` (left edge) and
  `◀` (right edge), and each column's are `▼` (top) and `▲` (bottom) — so a glyph
  lookup by text alone is ambiguous. Filter `children.list` for the glyph and index
  into the result; the arrows are created row 0..4 then column 0..4, so the Nth `▶`
  shifts row N right and the Nth `▲` shifts column N up. Flip's two arrows (`↔`
  above the middle column, `↕` left of the middle row) are unique, so a plain
  lookup by glyph works for those.
- **Reading text.** Buttons, arrows (`▲◀▶▼`, `↺`, `↻`, `↔`, `↕`), the HUD, the
  per-card `"N left"` counters, and the win/lose overlay are all Phaser text
  objects — enumerate `scene.children.list` and read `.text`. `"You win!"` present
  ⇒ the level was solved; `"Out of actions"` ⇒ every action's budget ran out.
- **Entity state.** `PuzzleScene.entities` is the entity layer: an array of
  `{ kind: 'character' | 'crate', pos: {x, y} }`. `scene.characterPos` is a getter
  onto the character's `pos`, so existing checks keep working, and crates read as
  `s.entities.filter(e => e.kind === 'crate')`.
- **Per-action budgets.** `scene.remaining` maps each offered action to its own
  remaining uses (`Infinity` in Test mode, which serializes to `null` through
  `page.evaluate` — compare inside the browser context if you need the value).
  `scene.budget` is the sum of all pools, which is what the HUD counts against.

### Runnable harness

```js
// node smoke.js  — run from games/bibou after `npm i playwright-core phaser@3`
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

  // --- drive the level (example: Level 4, normal budget, solve with one flip per axis) ---
  await clickText('Start');          // use 'Test' instead for unlimited budgets
  await clickText('Level 4');
  console.log('start:', await state());

  await clickText('Flip');
  await clickText('↔');              // mirror across the middle column
  console.log('after f1:', await state());   // char (1,1) -> (3,1), crates moved too

  await clickText('Flip');
  await swipe(2, 2, 0, 60);          // vertical swipe = mirror across the middle row
  console.log('after f2:', await state());

  // Level 2 for comparison (tap-a-target action):
  //   await clickText('Rotate'); await clickCell(2, 3); await clickText('↻');

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
  `entities.crates`, goal renders on `background.goal`, HUD shows
  `Actions: 0 / <sum of budgets>`, and each card shows its own `"N left"` (or `∞`
  in Test mode).
- **Intended solution wins:** running the documented steps ends with `"You win!"`
  and `movesUsed` equal to the intended solution length.
- **Budget is tight where intended:** if the level is meant to have no slack (every
  level so far does), an extra/wrong action should trigger `"Out of actions"` rather
  than leaving a second valid path — drive a deliberately wrong first action and
  assert the loss. For Flip levels the natural wrong path is flipping the same axis
  twice, which returns the board to its starting state.
- **Budgets are spent per action type:** after using one action, assert that only
  *its* entry in `scene.remaining` dropped. A spent action's card must grey out and
  stop responding (selecting it sets the hint `"No <Action> actions left"` and does
  not increment `movesUsed`), while the other cards still work. The level must not
  end until every pool is empty.
- **Crates move with the board:** on a level with crates, assert their positions
  after Rotate/Shift/Flip, and that Move can target a crate (tap the crate's cell,
  not the character's) without moving the character.
- **Pushing resolves correctly:** on a level where a Move's destination is occupied,
  assert every entity in the chain shifted by one, not just the one tapped — including
  the full-loop case (Level 6, `LEVEL_DESIGN.md` §5.1.1/§7), where a fully-occupied
  row/column rotates by one instead of the move being rejected.
- **Walls block correctly, and only where drawn:** on a level with walls (Levels 7–8,
  `LEVEL_DESIGN.md` §1.2/§7), assert the blocked direction stays illegal (hint changes,
  `movesUsed`/`scene.remaining` don't change, entity doesn't move) and that the
  documented detour still succeeds. For the wraparound case (Level 8), also assert
  the *other* direction across the same seam (where no wall was placed) still works.
- **Both input styles:** exercise arrow taps *and* swipes (cardinal swipes for Move;
  right = clockwise / left = anticlockwise for Rotate; horizontal = column flip /
  vertical = row flip for Flip), since they're separate code paths.
- **Test-mode selection:** from the title, `Test → Level N` runs that level with
  every pool unlimited (HUD shows `∞`, each card shows `∞ left`, a `TEST` badge
  appears, and the lose condition never fires).
- **No console/page errors** across the whole run. Note the harness's own server
  404s on `/favicon.ico` — that request comes from the browser, not the game, so
  filter it out rather than chasing it.
