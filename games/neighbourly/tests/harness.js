// Test harness for Neighbourly (adapted from Pitchou's): a tiny runner +
// assertions, a local server that serves the real game files (with the blocked
// CDN Phaser swapped for the npm copy), and a driver that drives the real
// canvas and reads live scene state.
//
// Nothing here reaches into the game to *change* state — every test sends the
// pointer events a player would, and only reads state back to assert on.

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
// `openGame` — pass `{ seed }` to pin the offer script it plays.
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
    // Strip the query before resolving: the game takes `?seed=` on the URL, and
    // a bare `/?seed=1` still means index.html.
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
        .flatMap((d) => [
          path.join(base, d), // a plain `chromium` symlink to the binary
          path.join(base, d, 'chrome-linux', 'chrome'),
          path.join(base, d, 'chrome-linux64', 'chrome'),
        ])
        .filter((c) => fs.existsSync(c) && fs.statSync(c).isFile())
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
//
// `seed` pins the offer script and `set` the special set, the way the game
// itself lets a run be replayed (see TitleScene).
export async function openGame(
  browser,
  port,
  { viewport = { width: 480, height: 854 }, seed = null, set = null } = {}
) {
  const errors = [];
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

  const params = new URLSearchParams();
  if (seed !== null) params.set('seed', seed);
  if (set !== null) params.set('set', set);
  const query = params.toString() ? `?${params}` : '';
  await page.goto(`http://localhost:${port}/${query}`, { waitUntil: 'networkidle' });
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
    await page.waitForTimeout(90);
  };

  const game = {
    page,
    pageErrors: () => errors.slice(),
    close: () => page.close(),

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
          pageScrollsY:
            document.documentElement.scrollHeight > document.documentElement.clientHeight,
        };
      }),

    shot: (file) => page.screenshot({ path: file }),

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

    // Every visible label on the top active scene.
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

    // Title screen to the board, the way a player gets there.
    startRun: async () => {
      await game.waitForScene('TitleScene');
      await game.clickText('PLAY');
      await game.waitForScene('PlayScene');
    },

    // Taps the centre of a board tile / an offer card, from the scene's own
    // geometry so a layout change can't make the test miss.
    tapTile: async (i) => {
      const p = await page.evaluate((i) => window.__game.scene.getScene('PlayScene').tileCentre(i), i);
      await clickAt(p.x, p.y);
    },
    tapOffer: async (k) => {
      const p = await page.evaluate((k) => {
        const z = window.__game.scene.getScene('PlayScene').cards[k].zone;
        return { x: z.x, y: z.y };
      }, k);
      await clickAt(p.x, p.y);
    },

    // Live PlayScene state, read-only.
    state: () =>
      page.evaluate(() => {
        const s = window.__game.scene.getScene('PlayScene');
        if (!s || !s.run || !s.scene.isActive()) return null;
        const r = s.run;
        return {
          seed: r.seed,
          sets: r.sets.slice(),
          level: r.level,
          turn: r.turn,
          status: r.status,
          board: r.board.slice(),
          results: r.results.map((x) => ({ ...x })),
          selOffer: s.selOffer,
          selTile: s.selTile,
          overlay: !!s.overlay,
          deltas: s.tiles.map((t) => t.delta.text),
          // The texture each tile and card is drawn with, or null when hidden.
          sprites: s.tiles.map((t) => (t.sprite.visible ? t.sprite.texture.key : null)),
          cardSprites: s.cards.map((c) => (c.sprite.visible ? c.sprite.texture.key : null)),
          info: [s.infoTitle.text, s.infoBody.text],
          score: s.scoreText.text,
        };
      }),
  };

  return game;
}
