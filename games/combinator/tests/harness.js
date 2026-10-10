// Test harness for Combinator: a tiny runner + assertions, a local server that
// serves the real game files (with the blocked CDN Phaser swapped for the npm
// copy), and a driver that drives the real canvas and reads live scene state.
//
// Tests only send the pointer and key events a player would, and read state
// back to assert on. Copied from Pitchou's harness and trimmed to this game.

import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

// --- Tiny test runner -------------------------------------------------------

const suite = [];

// A browser test: gets a fresh page driving the real game. `opts` reach
// `openGame`.
export function test(name, fn, opts = {}) {
  suite.push({ name, fn, browser: true, opts });
}

// A pure test: no browser, for rules math the UI leans on.
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

  for (const { name, fn, browser: needsBrowser, opts } of suite) {
    const game = needsBrowser ? await openGame(browser, port, opts) : null;
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
        const requested = req.url.split('?')[0];
    const rel = requested === '/' ? '/index.html' : requested;
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

// `viewport` defaults to the design size, where every design coordinate is a
// screen coordinate. Pass a real device size to test Phaser's FIT scaling.
export async function openGame(browser, port, { viewport = { width: 1280, height: 800 } } = {}) {
  const errors = [];
  const page = await browser.newPage({ viewport });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
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
  await page.waitForFunction(() => {
    const s = window.__game?.scene.getScene('BenchScene');
    return !!s && !!s.sim;
  });

  // Design coords -> screen coords, through Phaser's FIT scaling.
  const rect = () =>
    page.evaluate(() => {
      const r = document.querySelector('canvas').getBoundingClientRect();
      const g = window.__game;
      return { left: r.left, top: r.top, sx: r.width / g.scale.width, sy: r.height / g.scale.height };
    });
  const toScreen = async (px, py) => {
    const R = await rect();
    return [R.left + px * R.sx, R.top + py * R.sy];
  };
  const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));

  const game = {
    page,
    pageErrors: () => errors.slice(),
    close: () => page.close(),
    shot: (file) => page.screenshot({ path: file }),

    clickAt: async (px, py, button = 'left') => {
      const [x, y] = await toScreen(px, py);
      await page.mouse.click(x, y, { button });
      await frame();
    },

    // Press, travel in steps (so the scene sees a drag), release.
    drag: async ([x1, y1], [x2, y2]) => {
      const [a, b] = await toScreen(x1, y1);
      const [c, d] = await toScreen(x2, y2);
      await page.mouse.move(a, b);
      await page.mouse.down();
      await page.mouse.move(c, d, { steps: 8 });
      await frame();
      await page.mouse.up();
      await frame();
    },

    hover: async (px, py) => {
      const [x, y] = await toScreen(px, py);
      await page.mouse.move(x, y);
      await frame();
    },

    key: async (k) => {
      await page.keyboard.press(k);
      await frame();
    },

    // Where things are, in design coords, read from the live scene.
    tile: (x, y) =>
      page.evaluate(([x, y]) => {
        const c = window.__game.scene.getScene('BenchScene').view.center(x, y);
        return [c.x, c.y];
      }, [x, y]),
    paletteItem: (type) =>
      page.evaluate((type) => {
        const it = window.__game.scene.getScene('BenchScene').paletteItems.find((i) => i.type === type);
        return [it.x + it.w / 2, it.y + it.h / 2];
      }, type),

    // Every visible label on the scene.
    texts: () =>
      page.evaluate(() =>
        window.__game.scene
          .getScene('BenchScene')
          .children.list.filter((c) => c.visible && c.text !== undefined)
          .map((c) => c.text)
      ),

    clickText: async (label) => {
      const pos = await page.evaluate((label) => {
        const o = window.__game.scene
          .getScene('BenchScene')
          .children.list.find((c) => c.visible && c.text === label);
        if (!o) return null;
        const b = o.getBounds();
        return [b.centerX, b.centerY];
      }, label);
      if (!pos) throw new Error(`no text "${label}" on screen`);
      await game.clickAt(...pos);
    },

    // Live BenchScene state, read-only.
    state: () =>
      page.evaluate(() => {
        const s = window.__game.scene.getScene('BenchScene');
        return {
          placements: s.placements.map((p) => ({ ...p })),
          turn: s.viewTurn,
          armed: s.armed,
          playing: !!s.playTimer,
          active: { ...s.sim.turns[s.viewTurn - 1].active },
          desc: JSON.parse(JSON.stringify(s.desc)),
        };
      }),
  };

  return game;
}
