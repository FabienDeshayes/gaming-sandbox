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
const DPAD = { cx: 361, cy: 737, offset: 74 };

// Mirrored from src/ui/itemCard.js and src/ui/inventoryPanel.js.
const CARD_CX = 240;
const CARD_CY = 854 / 2 - 40;
const CARD_MULTI_LIST = { x: CARD_CX - (380 - 64) / 2, y: CARD_CY + 88, h: 120, rowH: 40 };

// Mirrored from src/ui/shop.js and src/scenes/ExploreScene.js's navigation rail.
const SHOP = { left: 240 - 420 / 2, rowH: 52, pad: 22, titleH: 40, purseH: 30 };
const RAIL = { x: 480 - 62, top: 58, w: 48, badgeH: 78, gap: 10, mapH: 34 };
const SHOP_STOCK = 6; // src/data/shop.js STOCK.length

// The shop panel is centred vertically and sized by its row count, same as the
// widget works it out.
function shopTop() {
  const panelH = SHOP.pad + SHOP.titleH + SHOP.purseH + SHOP_STOCK * SHOP.rowH + 20 + 44 + SHOP.pad;
  return (854 - panelH) / 2;
}
const INV_PANEL = { left: CARD_CX - 380 / 2, top: CARD_CY - 460 / 2 };
// The list starts below the title and the gem-pip row (DESIGN.md §7).
const INV_LIST = { x: INV_PANEL.left + 20, y: INV_PANEL.top + 90, rowH: 64 };

// --- Tiny test runner -------------------------------------------------------

const suite = [];

// A browser test: gets a fresh page driving the real game. `opts` reach
// `openGame` — pass `{ query }` to pin the world a test walks through.
export function test(name, fn, opts = {}) {
  suite.push({ name, fn, browser: true, opts });
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
    // Strip the query before resolving: the game takes `?seed=&nonce=` on the
    // URL, and a bare `/?seed=1` still means index.html.
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

// `viewport` defaults to the design size, where the canvas is 1:1 and every
// design coordinate is a screen coordinate. Pass a real device size to test what
// Phaser's FIT scaling actually does with it.
// `query` names a seed and a nonce in the URL, the way the game itself lets a
// world be reproduced (see TitleScene) — which is how a test knows where the
// consumables are before the page has drawn them.
//
// `save` plants save slot 1 before the page loads, so a test can start from a
// player who has already banked coins or carried a tool home. That is prior
// state, not live state: it is the browser's version of handing `createRun` a
// save, and nothing here ever reaches into a running scene. `game.startRun()`
// then takes that slot up through LOAD GAME instead of NEW GAME.
//
// `cheats` turns the Settings switch on before the page loads, the same way.
export async function openGame(
  browser,
  port,
  { viewport = { width: 480, height: 854 }, query = '', save = null, cheats = false } = {}
) {
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

  if (save)
    await page.addInitScript((planted) => {
      try {
        localStorage.setItem('nouxinha.save.1', JSON.stringify(planted));
        localStorage.setItem('nouxinha.slot', '1');
      } catch (e) {
        /* a page that can't store one just runs without it */
      }
    }, save);

  if (cheats)
    await page.addInitScript(() => {
      try {
        localStorage.setItem('nouxinha.cheats', '1');
      } catch (e) {
        /* a page that can't store one just runs without it */
      }
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

  await page.goto(`http://localhost:${port}/${query ? `?${query}` : ''}`, {
    waitUntil: 'networkidle',
  });
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

    shot: (file) => page.screenshot({ path: file }),

    // Whether the music loop's scheduler is running, and which of the two loops
    // it is playing. Read out of the module the game itself imported — a dynamic
    // import of the same URL is the same module instance — because there is
    // nothing about a loop of square waves that a headless browser can be asked
    // to listen to.
    music: () =>
      page.evaluate(() => import('/src/ui/music.js').then((m) => m.isMusicPlaying())),

    musicTrack: () =>
      page.evaluate(() => import('/src/ui/music.js').then((m) => m.musicTrack())),

    // Every sound played so far, in order ('tap', 'coin', 'pickup', 'gem',
    // 'torch', 'death'). Same trick as `music()`, and the only way to assert
    // that a button makes a noise and the D-pad doesn't.
    sounds: () => page.evaluate(() => import('/src/ui/sfx.js').then((m) => m.soundLog())),

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

    // Title screen to a walking run, the way a player gets there: NEW GAME or
    // LOAD GAME, then a slot. A test that planted a save wants that campaign
    // back, so it loads slot 1; one that planted nothing starts a fresh one in
    // the same slot.
    startRun: async (slot = 1) => {
      const used = await page.evaluate((n) => !!localStorage.getItem(`nouxinha.save.${n}`), slot);
      await game.clickText(used ? 'LOAD GAME' : 'NEW GAME');
      await game.waitForScene('SlotScene');
      await game.clickText(`SLOT ${slot}`);
      await game.waitForScene('ExploreScene');
    },

    // Taps a D-pad arrow, the way a thumb would.
    tapDpad: (dir) => {
      const o = DPAD.offset;
      const at = { up: [0, -o], down: [0, o], left: [-o, 0], right: [o, 0] }[dir];
      return clickAt(DPAD.cx + at[0], DPAD.cy + at[1]);
    },

    // Holds a D-pad arrow down for `ms`, the way a resting thumb would, so a
    // test can check the step repeats instead of firing once (DESIGN.md §7).
    holdDpad: async (dir, ms) => {
      const R = await rect();
      const o = DPAD.offset;
      const at = { up: [0, -o], down: [0, o], left: [-o, 0], right: [o, 0] }[dir];
      const x = R.left + (DPAD.cx + at[0]) * R.sx;
      const y = R.top + (DPAD.cy + at[1]) * R.sy;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.waitForTimeout(ms);
      await page.mouse.up();
    },

    // Taps an inventory slot (0-based, left to right). Mirrored from
    // src/ui/hud.js's SLOT/SLOT_GAP/SLOT_Y.
    tapSlot: (i) => clickAt(14 + i * 54 + 24, 664 + 24),

    tapCoins: () => clickAt(14 + 158 + 5, 624 + 14 + 7),

    // Water now sits under the active light's bar, same size, rather than in
    // the top counters row — mirrored from src/ui/hud.js's SLOT_Y math.
    tapWater: () => clickAt(14 + 5, 624 + 40 + 48 + 12 + 44 + 7),

    // Opens the full scrollable inventory panel via the HUD's ITEMS slot — the
    // fourth box in the strip, same size as the item slots (src/ui/hud.js).
    tapInventory: () => clickAt(14 + 3 * 54 + 24, 664 + 24),

    // A row of the merchant's counter, by its index in src/data/shop.js STOCK.
    tapShopRow: (i) =>
      clickAt(240, shopTop() + SHOP.pad + SHOP.titleH + SHOP.purseH + i * SHOP.rowH + SHOP.rowH / 2),

    // The navigation rail down the right edge of the map viewport: the map
    // button sits under the compass badge when the run owns both.
    tapMapButton: async () => {
      const hasCompass = (await game.state()).tools.includes('compass');
      const y = RAIL.top + (hasCompass ? RAIL.badgeH + RAIL.gap : 0);
      await clickAt(RAIL.x + RAIL.w / 2, y + RAIL.mapH / 2);
    },

    // Taps the i-th row (0-based) of a multi-copy item card's instance list.
    tapCardInstance: (i) =>
      clickAt(CARD_MULTI_LIST.x + 20, CARD_MULTI_LIST.y + i * CARD_MULTI_LIST.rowH + CARD_MULTI_LIST.rowH / 2),

    // Taps the i-th row (0-based) of the open inventory panel's stack list.
    tapInventoryRow: (i) => clickAt(INV_LIST.x + 20, INV_LIST.y + i * INV_LIST.rowH + INV_LIST.rowH / 2),

    // A press-move-release drag from one point to another, for exercising
    // scrollable lists (the item card's instance list, the inventory panel) —
    // unlike `swipe`, this holds at the destination instead of releasing with
    // momentum, and takes design-space coordinates directly since these
    // overlays aren't inside the tile viewport `swipe` converts for.
    dragAt: async (x0, y0, x1, y1) => {
      const R = await rect();
      await page.mouse.move(R.left + x0 * R.sx, R.top + y0 * R.sy);
      await page.mouse.down();
      await page.mouse.move(R.left + x1 * R.sx, R.top + y1 * R.sy, { steps: 6 });
      await page.mouse.up();
      await page.waitForTimeout(140);
    },

    // Drags inside an open multi-copy item card's instance list by `dy`
    // pixels (negative scrolls down through the list).
    dragCardList: (dy) => {
      const x = CARD_MULTI_LIST.x + 20;
      const y = CARD_MULTI_LIST.y + CARD_MULTI_LIST.h / 2;
      return game.dragAt(x, y, x, y + dy);
    },

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
          water: r.water,
          gems: r.gems,
          seed: r.seed,
          explored: r.explored.size,
          inventory: r.inventory.map((i) => ({ id: i.id, durability: i.durability })),
          activeIndex: r.activeIndex,
          furthest: r.furthest,
          // The consumable layer's salt: a run's own nonce plus how many times
          // the world has respawned under it (DESIGN.md §4.3).
          nonce: r.nonce,
          epoch: r.epoch,
          tools: [...r.tools],
          seenUnique: [...r.seenUnique],
          banked: { ...r.banked },
          animating: s.animating,
          cardOpen: s.card.isOpen(),
          inventoryOpen: s.inventory.isOpen(),
          dialogOpen: s.dialog.isOpen(),
          shopOpen: s.shop.isOpen(),
          mapOpen: s.worldMap.isOpen(),
          compassShown: s.compass.container.visible,
          compassTarget: s.compass.container.visible
            ? { sprite: s.compass.icon.texture.key, arrow: s.compass.arrow.texture.key }
            : null,
        };
      }),

    // What the player can actually see: for each drawn tile, its world
    // coordinate, texture, alpha, and tint. This is the render, not the model —
    // and since a gem's whole effect is a colour change, the tints are the only
    // way to assert that restoring one actually reached the screen.
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
            tint: c.ground.tintTopLeft,
            overlay: c.overlay.visible ? c.overlay.texture.key : null,
            item: c.item.visible ? c.item.texture.key : null,
            itemTint: c.item.visible ? c.item.tintTopLeft : null,
          }));
      }),

    // A save slot, straight out of localStorage — the only state that outlives a
    // run, so a test asserting a gem was kept has to read it here rather than
    // from the run it came from. Slot 1 unless asked otherwise: that is the one
    // `save` plants into and `startRun` picks.
    save: (slot = 1) =>
      page.evaluate((n) => {
        try {
          return JSON.parse(localStorage.getItem(`nouxinha.save.${n}`));
        } catch (e) {
          return null;
        }
      }, slot),

    // The y position of whichever scrollable list is currently open (the item
    // card's instance list or the inventory panel's stack list) — moves as the
    // player drags, which is how a scroll is told apart from a tap that just
    // didn't move anything.
    scrollContentY: () =>
      page.evaluate(() => {
        const s = window.__game.scene.getScene('ExploreScene');
        const handle = s.card.isOpen() ? s.card.scrollHandle : s.inventory.scrollHandle;
        return handle && handle.content ? handle.content.y : null;
      }),

    wizardTexture: () =>
      page.evaluate(
        () => `wizard-${window.__game.scene.getScene('ExploreScene').map.wizard.facing}`
      ),

    // The wizard is a stack of colour-zone layers (src/ui/wizard.js), one per
    // gem plus the base band — this is how a test sees that a gem's colour
    // actually reached one of them.
    wizardZoneTints: () =>
      page.evaluate(() =>
        window.__game.scene.getScene('ExploreScene').map.wizard.layers.map((l) => l.tintTopLeft)
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
