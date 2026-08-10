# Bibou — Testing a level

> How an agent (or a human) verifies that a level plays exactly as
> [`LEVEL_DESIGN.md`](./LEVEL_DESIGN.md) specifies: the character starts where it
> should, the action budget is right, the intended solution wins, and no wrong
> path sneaks in under budget.

Bibou is plain Phaser-via-CDN with no build step, so there's no test runner wired
up. Testing is done by **driving the real game in a headless browser** and reading
Phaser scene state back out. This doc gives you a ready-to-adapt harness.

## Two levels of checking

1. **Ring math only (fast, no browser).** The Rotate mechanic is pure coordinate
   math (see `LEVEL_DESIGN.md` §5.2). You can verify a solution's arithmetic in a
   few lines of Node without launching anything — good for sanity-checking a new
   level's intended solution before wiring the UI. See [Ring-math check](#ring-math-check).
2. **Full browser smoke test (authoritative).** Actually loads `index.html`, clicks
   the cards/arrows, swipes, and asserts the win overlay appears. This is what
   proves a level is playable end to end. See [Browser smoke test](#browser-smoke-test).

Prefer the browser test when claiming a level "works" — the math check can't catch
input wiring, budget, or scene-flow bugs.

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

## Ring-math check

Rotate shifts the 8 tiles around a center one step along the clockwise ring
`TL→T→TR→R→BR→B→BL→L` (indices 0..7). Reproduce just that to check a solution's
coordinates:

```js
const RING = [
  { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 }, { x: 1, y: 0 },
  { x: 1, y: 1 },  { x: 0, y: 1 },  { x: -1, y: 1 }, { x: -1, y: 0 },
];
const N = 5;
const wrap = (v) => ((v % N) + N) % N;
function rotate(pos, center, clockwise) {
  let i = -1;
  for (let k = 0; k < 8; k++)
    if (wrap(center.x + RING[k].x) === pos.x && wrap(center.y + RING[k].y) === pos.y) { i = k; break; }
  if (i === -1) return { ...pos }; // char not on the ring — unaffected
  const n = clockwise ? (i + 1) % 8 : (i + 7) % 8;
  return { x: wrap(center.x + RING[n].x), y: wrap(center.y + RING[n].y) };
}

// Level 2: (1,2) --CW around (2,3)--> (2,2) --CW around (1,3)--> (2,3) = goal
let c = { x: 1, y: 2 };
c = rotate(c, { x: 2, y: 3 }, true);
c = rotate(c, { x: 1, y: 3 }, true);
console.log(c, c.x === 2 && c.y === 3 ? 'OK' : 'WRONG');
```

## Browser smoke test

The harness below loads the game, exposes the `Phaser.Game` instance, and gives you
helpers to click a button by its label, tap a board cell by `(x, y)`, swipe from a
cell, and read `characterPos` / the HUD out of the live `PuzzleScene`. Adapt the
"drive the level" section for whatever level you're checking.

### How it hangs together

- **Capture the game instance.** `main.js` calls `new Phaser.Game(...)` but never
  stores it globally. An `addInitScript` installs a setter trap on `window.Phaser`
  that wraps `Phaser.Game` in a `Proxy` so the constructed game lands on
  `window.__game`. From there, `window.__game.scene.getScene('PuzzleScene')` reaches
  live state.
- **Coordinate mapping.** The design space is fixed at 480×854 but the canvas is
  scaled with `Phaser.Scale.FIT`. Convert design coords → screen with the canvas's
  `getBoundingClientRect()` and the ratio `rect.width / game.scale.width`.
- **Board cells.** `BOARD_X = 40`, `BOARD_Y = 230`, `CELL = 80`; a cell center in
  design space is `(40 + x*80 + 40, 230 + y*80 + 40)`.
- **Reading text.** Buttons, arrows (`▲◀▶▼`, `↺`, `↻`), the HUD, and the win/lose
  overlay are all Phaser text objects — enumerate `scene.children.list` and read
  `.text`. `"You win!"` present ⇒ the level was solved; `"Out of actions"` ⇒ budget
  ran out.

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
  const charPos = () => page.evaluate(() => {
    const s = window.__game.scene.getScene('PuzzleScene');
    return { x: s.characterPos.x, y: s.characterPos.y, used: s.movesUsed, budget: s.unlimited ? 'inf' : s.budget };
  });
  const texts = () => page.evaluate(() =>
    window.__game.scene.getScenes(true).slice(-1)[0].children.list.filter((c) => c.text !== undefined).map((c) => c.text));

  // --- drive the level (example: Level 2, normal budget, solve with two CW rotations) ---
  await clickText('Start');          // use 'Test' instead for an unlimited budget
  await clickText('Level 2');
  console.log('start:', await charPos());

  await clickText('Rotate');
  await clickCell(2, 3);             // rotation center
  await clickText('↻');             // clockwise (or: await swipe(2, 3, 60, 0))
  console.log('after r1:', await charPos());

  await clickText('Rotate');
  await clickCell(1, 3);
  await clickText('↻');
  console.log('after r2:', await charPos());

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

- **Setup:** character starts on the level's `entities.character`, goal renders on
  `background.goal`, HUD shows `Actions: 0 / <budget>` (or `∞` in Test mode).
- **Intended solution wins:** running the documented steps ends with `"You win!"`
  and `movesUsed` equal to the intended solution length.
- **Budget is tight where intended:** if the level is meant to have no slack (Levels
  1 and 2 both do), an extra/wrong action should trigger `"Out of actions"` rather
  than leaving a second valid path — drive a deliberately wrong first action and
  assert the loss.
- **Both input styles:** exercise arrow taps *and* swipes (cardinal swipes for Move;
  right = clockwise / left = anticlockwise for Rotate), since they're separate code
  paths.
- **Test-mode selection:** from the title, `Test → Level N` runs that level with an
  unlimited budget (HUD shows `∞`, a `TEST` badge appears, and the lose condition
  never fires).
- **No console/page errors** across the whole run.
