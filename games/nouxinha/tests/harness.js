// Test harness for Nouxinha: a tiny runner + assertions, a local server that
// serves the real game files (with the blocked CDN Phaser swapped for the npm
// copy), and a driver that drives the real canvas and reads live scene state.
//
// Nothing here reaches into the game to *change* state — every test sends the
// pointer and key events a player would, and only reads state back to assert on.

import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

// Mirrored from src/config.js, so a layout change that breaks the tests shows
// up as a failing test rather than silently-missed taps.
const VIEW_H = 624;
const VIEW_CX = 240;
const VIEW_CY = 312;
const DPAD = { cx: 388, cy: 748, offset: 54 };

// --- Tiny test runner -------------------------------------------------------

const suite = [];

// A browser test: gets a fresh page driving the real game.
export function test(name, fn) {
  suite.push({ name, fn, browser: true });
}

// A pure test: no browser, for the world/light/rules math.
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

// Serves the real game directory. index.html pulls Phaser from a CDN the
// sandbox blocks, so the <script src> is rewritten on the fly to the npm copy —
// index.html itself is never modified.
export function startServer() {
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png' };
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

// `viewport` defaults to the design size, where the canvas is 1:1 and every
// design coordinate is a screen coordinate. Pass a real device size to test what
// Phaser's FIT scaling actually does with it.
export async function openGame(browser, port, { viewport = { width: 480, height: 854 } } = {}) {
  const errors = [];
  const spawned = [];
  const page = await browser.newPage({ viewport });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  // The browser asks for /favicon.ico on its own and this server has none —
  // that 404 comes from the browser, not the game.
  page.on('console', (m) => {
    const from = m.location()?.url || '';
    if (m.type() === 'error' && !from.includes('favicon')) errors.push('console: ' + m.text());
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
      return { left: r.left, top: r.top, sx: r.width / g.scale.width, sy: r.height / g.scale.height };
    });

  const clickAt = async (px, py) => {
    const R = await rect();
    await page.mouse.click(R.left + px * R.sx, R.top + py * R.sy);
    await page.waitForTimeout(140);
  };

  const game = {
    page,
    pageErrors: () => spawned.reduce((all, g) => all.concat(g.pageErrors()), errors.slice()),
    close: async () => {
      for (const other of spawned) await other.close();
      await page.close();
    },

    // A second page on the same server, for the handful of things that are only
    // testable at a different screen size. Closed with its parent.
    openAnother: async (opts) => {
      const other = await openGame(browser, port, opts);
      spawned.push(other);
      return other;
    },

    // How the canvas actually sits on the screen — the check that the whole
    // game is reachable rather than half of it hanging off the side.
    canvasFit: () =>
      page.evaluate(() => {
        const r = window.__game.canvas.getBoundingClientRect();
        return {
          left: r.left,
          top: r.top,
          right: r.right,
          bottom: r.bottom,
          viewport: { width: window.innerWidth, height: window.innerHeight },
          pageScrollsX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          pageScrollsY: document.documentElement.scrollHeight > document.documentElement.clientHeight,
        };
      }),

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

    // Every visible label on screen, including inside containers (buttons and
    // the item card build their text into one).
    texts: () =>
      page.evaluate(() => {
        const out = [];
        const walk = (list) => {
          for (const c of list) {
            if (!c.visible) continue;
            if (c.text !== undefined) out.push(c.text);
            if (c.list) walk(c.list);
          }
        };
        walk(window.__game.scene.getScenes(true).slice(-1)[0].children.list);
        return out;
      }),

    hasText: async (label) => (await game.texts()).includes(label),

    clickText: async (label, nth = 0) => {
      const pos = await page.evaluate(
        ({ label, nth }) => {
          const hits = [];
          const walk = (list) => {
            for (const c of list) {
              if (!c.visible) continue;
              if (c.text === label) hits.push(c);
              if (c.list) walk(c.list);
            }
          };
          walk(window.__game.scene.getScenes(true).slice(-1)[0].children.list);
          const o = hits[nth];
          if (!o) return null;
          const b = o.getBounds();
          return { x: b.centerX, y: b.centerY };
        },
        { label, nth }
      );
      if (!pos) throw new Error(`no text "${label}" (#${nth}) on screen`);
      await clickAt(pos.x, pos.y);
    },

    clickAt,

    // Taps a D-pad arrow, the way a thumb would.
    tapDpad: (dir) => {
      const o = DPAD.offset;
      const at = { up: [0, -o], down: [0, o], left: [-o, 0], right: [o, 0] }[dir];
      return clickAt(DPAD.cx + at[0], DPAD.cy + at[1]);
    },

    // Taps an inventory slot (0-based, left to right).
    tapSlot: (i) => clickAt(14 + i * 64 + 28, 660 + 28),

    tapCoins: () => clickAt(14 + 170 + 40, 636 + 8),

    // Swipes across the map area from its centre.
    swipe: async (dir) => {
      const R = await rect();
      const dist = 90;
      const d = { up: [0, -dist], down: [0, dist], left: [-dist, 0], right: [dist, 0] }[dir];
      const x0 = R.left + VIEW_CX * R.sx;
      const y0 = R.top + VIEW_CY * R.sy;
      await page.mouse.move(x0, y0);
      await page.mouse.down();
      await page.mouse.move(x0 + d[0] * R.sx, y0 + d[1] * R.sy, { steps: 6 });
      await page.mouse.up();
      await page.waitForTimeout(140);
    },

    press: async (key) => {
      await page.keyboard.press(key);
      await page.waitForTimeout(140);
    },

    // Live ExploreScene run state, read-only.
    state: () =>
      page.evaluate(() => {
        const s = window.__game.scene.getScene('ExploreScene');
        if (!s || !s.run) return null;
        const r = s.run;
        return {
          x: r.x,
          y: r.y,
          facing: r.facing,
          steps: r.steps,
          coins: r.coins,
          seed: r.seed,
          explored: r.explored.size,
          inventory: r.inventory.map((i) => ({ id: i.id, durability: i.durability })),
          activeIndex: r.activeIndex,
          furthest: r.furthest,
          animating: s.animating,
          cardOpen: s.card.isOpen(),
          dialogOpen: s.dialog.isOpen(),
        };
      }),

    // What the player can actually see: for each drawn tile, its world
    // coordinate, texture, and alpha. This is the render, not the model.
    visibleTiles: () =>
      page.evaluate(() => {
        const s = window.__game.scene.getScene('ExploreScene');
        return s.map.cells
          .filter((c) => c.ground.visible)
          .map((c) => ({
            x: s.run.x + c.dx,
            y: s.run.y + c.dy,
            ground: c.ground.texture.key,
            alpha: Math.round(c.ground.alpha * 100) / 100,
            overlay: c.overlay.visible ? c.overlay.texture.key : null,
            item: c.item.visible ? c.item.texture.key : null,
          }));
      }),

    wizardTexture: () =>
      page.evaluate(
        () => window.__game.scene.getScene('ExploreScene').map.wizard.texture.key
      ),

    // Drives the run forward without the test having to care about terrain:
    // tries directions until one actually moves, up to `steps` times.
    walk: async (steps) => {
      for (let i = 0; i < steps; i++) {
        for (const dir of ['up', 'right', 'down', 'left']) {
          const before = await game.state();
          await game.tapDpad(dir);
          const after = await game.state();
          if (after.steps > before.steps) break;
        }
      }
    },

    settle: async () => {
      await page.waitForFunction(() => {
        const s = window.__game.scene.getScene('ExploreScene');
        return !s || s.animating === false;
      });
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
    },
  };

  return game;
}
