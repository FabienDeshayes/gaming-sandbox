// Test harness for Bibou: a tiny runner + assertions, a local server that
// serves the real game files (with the blocked CDN Phaser swapped for the npm
// copy), and a driver that clicks the real canvas and reads live scene state.
//
// See TESTING.md for the reasoning behind each piece. Nothing here reaches into
// the game's internals to *change* state — every test drives the same pointer
// events a player would, and only reads state back to assert on it.

import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

// Board geometry, mirrored from src/config.js so a layout change that breaks
// the tests shows up as a failing test rather than silently-missed clicks.
const BOARD_X = 40;
const BOARD_Y = 230;
const CELL = 80;

// --- Tiny test runner -------------------------------------------------------

const suite = [];

// A browser test: gets a fresh page driving the real game.
export function test(name, fn) {
  suite.push({ name, fn, browser: true });
}

// A pure test: no browser, for the coordinate math in src/core/rules.js.
export function unit(name, fn) {
  suite.push({ name, fn, browser: false });
}

export function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

export function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg || 'assertEqual'}: got ${a}, want ${e}`);
}

export function assertClose(actual, expected, tolerance, msg) {
  if (Math.abs(actual - expected) > tolerance)
    throw new Error(
      `${msg || 'assertClose'}: got ${actual}, want ${expected} ±${tolerance}`
    );
}

// Runs every registered test in order, each with a fresh page (so a test can't
// inherit another's scene state) against one shared browser and server.
export async function run() {
  const { server, port } = await startServer();
  const browser = await launchBrowser();
  let failed = 0;

  for (const { name, fn, browser: needsBrowser } of suite) {
    const game = needsBrowser ? await openGame(browser, port) : null;
    try {
      await fn(game);
      const stray = game ? game.pageErrors() : [];
      if (stray.length) throw new Error('page errors: ' + stray.join(' | '));
      console.log(`  PASS  ${name}`);
    } catch (err) {
      failed += 1;
      console.log(`  FAIL  ${name}`);
      console.log(`        ${err.message}`);
    } finally {
      if (game) await game.close();
    }
  }

  await browser.close();
  server.close();

  const total = suite.length;
  console.log(
    failed === 0
      ? `\n${total}/${total} passed`
      : `\n${total - failed}/${total} passed, ${failed} failed`
  );
  process.exit(failed === 0 ? 0 : 1);
}

// --- Local server -----------------------------------------------------------

// Serves the real game directory. index.html pulls Phaser from a CDN that the
// sandbox blocks, so the <script src> is rewritten on the fly to the npm copy —
// index.html itself is never modified.
export function startServer() {
  const mime = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.png': 'image/png',
  };
  const server = http.createServer((req, res) => {
    const rel = req.url === '/' ? '/index.html' : req.url.split('?')[0];
    if (rel === '/phaser.min.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      res.end(fs.readFileSync(path.join(ROOT, 'node_modules/phaser/dist/phaser.min.js')));
      return;
    }
    const file = path.join(ROOT, path.normalize(rel));
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      let body = data;
      if (path.extname(file) === '.html')
        body = data
          .toString()
          .replace(/https:\/\/cdn\.jsdelivr\.net\/[^"']*phaser[^"']*/, '/phaser.min.js');
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'text/plain' });
      res.end(body);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, () => resolve({ server, port: server.address().port }));
  });
}

// Chromium ships preinstalled in the sandbox under /opt/pw-browsers; the build
// number moves, so find it rather than hardcoding one.
function findChromium() {
  const fromEnv = process.env.CHROMIUM_PATH;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  const base = '/opt/pw-browsers';
  const candidates = fs.existsSync(base)
    ? fs
        .readdirSync(base)
        .filter((d) => d.startsWith('chromium'))
        .map((d) => path.join(base, d, 'chrome-linux', 'chrome'))
    : [];
  const found = candidates.find((c) => fs.existsSync(c));
  if (!found)
    throw new Error(
      'chromium not found under /opt/pw-browsers — set CHROMIUM_PATH to a chrome binary'
    );
  return found;
}

export function launchBrowser() {
  return chromium.launch({ executablePath: findChromium(), args: ['--no-sandbox'] });
}

// --- Driver -----------------------------------------------------------------

// Opens the game in a fresh page and returns the helpers a test drives it with.
export async function openGame(browser, port) {
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 480, height: 854 } });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  // The browser asks for /favicon.ico on its own and this server has none —
  // that 404 comes from the browser, not the game, so it isn't a failure.
  page.on('console', (m) => {
    const from = m.location()?.url || '';
    if (m.type() === 'error' && !from.includes('favicon'))
      errors.push('console: ' + m.text());
  });

  // src/main.js never stores the Phaser.Game it constructs, so trap the
  // constructor and stash the instance as window.__game for the driver to read.
  await page.addInitScript(() => {
    let stored;
    Object.defineProperty(window, 'Phaser', {
      configurable: true,
      get() {
        return stored;
      },
      set(v) {
        if (v && v.Game)
          v.Game = new Proxy(v.Game, {
            construct(target, args) {
              const g = Reflect.construct(target, args);
              window.__game = g;
              return g;
            },
          });
        stored = v;
      },
    });
  });

  await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__game && window.__game.isBooted);

  // Design space is 480x854 but the canvas is scaled with Phaser.Scale.FIT, so
  // every click has to convert design coords -> screen coords.
  const rect = () =>
    page.evaluate(() => {
      const r = document.querySelector('canvas').getBoundingClientRect();
      const g = window.__game;
      return {
        left: r.left,
        top: r.top,
        sx: r.width / g.scale.width,
        sy: r.height / g.scale.height,
      };
    });

  const clickAt = async (px, py) => {
    const R = await rect();
    await page.mouse.click(R.left + px * R.sx, R.top + py * R.sy);
    await page.waitForTimeout(120);
  };

  const game = {
    page,
    pageErrors: () => errors.slice(),
    close: () => page.close(),

    // Which scene is on screen right now.
    activeScene: () =>
      page.evaluate(() => {
        const s = window.__game.scene.getScenes(true).slice(-1)[0];
        return s ? s.scene.key : null;
      }),

    waitForScene: (key) =>
      page.waitForFunction((k) => {
        const s = window.__game.scene.getScenes(true).slice(-1)[0];
        return !!s && s.scene.key === k && s.children.list.length > 0;
      }, key),

    // Every label on screen: buttons, arrows, HUD, hints, overlays.
    texts: () =>
      page.evaluate(() =>
        window.__game.scene
          .getScenes(true)
          .slice(-1)[0]
          .children.list.filter((c) => c.text !== undefined)
          .map((c) => c.text)
      ),

    hasText: async (label) => (await game.texts()).includes(label),

    // Clicks an interactive text object by its exact label. Nth (0-based) picks
    // between duplicates — the shift arrows share glyphs, created row 0..4 then
    // column 0..4 (see TESTING.md).
    clickText: async (label, nth = 0) => {
      const pos = await page.evaluate(
        ({ label, nth }) => {
          const s = window.__game.scene.getScenes(true).slice(-1)[0];
          const hits = s.children.list.filter((c) => c.text === label && c.input);
          const o = hits[nth];
          if (!o) return null;
          const b = o.getBounds();
          return { x: b.centerX, y: b.centerY };
        },
        { label, nth }
      );
      if (!pos) throw new Error(`no interactive text "${label}" (#${nth}) on screen`);
      await clickAt(pos.x, pos.y);
    },

    clickCell: (x, y) => clickAt(BOARD_X + x * CELL + CELL / 2, BOARD_Y + y * CELL + CELL / 2),

    swipeFrom: async (x, y, dx, dy) => {
      const R = await rect();
      const x0 = R.left + (BOARD_X + x * CELL + CELL / 2) * R.sx;
      const y0 = R.top + (BOARD_Y + y * CELL + CELL / 2) * R.sy;
      await page.mouse.move(x0, y0);
      await page.mouse.down();
      await page.mouse.move(x0 + dx, y0 + dy, { steps: 5 });
      await page.mouse.up();
      await page.waitForTimeout(120);
    },

    // Live PuzzleScene state, read-only.
    state: () =>
      page.evaluate(() => {
        const s = window.__game.scene.getScene('PuzzleScene');
        return {
          char: { ...s.characterPos },
          crates: s.entities.filter((e) => e.kind === 'crate').map((e) => ({ ...e.pos })),
          movesUsed: s.movesUsed,
          budget: s.unlimited ? 'inf' : s.budget,
          remaining: Object.fromEntries(
            Object.entries(s.remaining).map(([k, v]) => [k, v === Infinity ? 'inf' : v])
          ),
          selectedAction: s.selectedAction,
          gameOver: s.gameOver,
          animating: s.animating,
          exitConfirmOpen: s.exitConfirmOpen === true,
        };
      }),

    // On-screen size of each entity sprite, in design px. This is what a player
    // actually sees, so it catches a transition that leaves a sprite rescaled.
    entitySizes: () =>
      page.evaluate(() => {
        const s = window.__game.scene.getScene('PuzzleScene');
        return s.board.entitySprites.map((sprite, i) => ({
          kind: s.entities[i].kind,
          width: Math.round(sprite.displayWidth * 100) / 100,
          height: Math.round(sprite.displayHeight * 100) / 100,
        }));
      }),

    // Waits out any in-flight transition tween so a read isn't taken mid-slide.
    settle: () =>
      page.waitForFunction(() => {
        const s = window.__game.scene.getScene('PuzzleScene');
        return !s || s.animating === false;
      }),
  };

  return game;
}
