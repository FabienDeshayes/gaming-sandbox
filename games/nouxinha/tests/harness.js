// Test harness for Nouxinha: a tiny runner + assertions, a local server that
// serves the real game files (with the blocked CDN Phaser swapped for the npm
// copy), and a driver that drives the real canvas and reads live scene state.
//
// Nothing here reaches into the game to *change* state — every test sends the
// pointer and key events a player would, and only reads state back to assert on.

import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { chromium } from 'playwright-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

// Mirrored from src/config.js, so a layout change that breaks the tests shows
// up as a failing test rather than silently-missed taps.
const VIEW_H = 624;
const VIEW_CX = 240;
const VIEW_CY = 312;
const DPAD = { cx: 361, cy: 737, offset: 74 };

// Mirrored from src/ui/inventoryPanel.js, which centres itself on the same
// point the item card does (src/ui/itemCard.js).
const CARD_CX = 240;
const CARD_CY = 854 / 2 - 40;

// Mirrored from src/ui/shop.js and src/scenes/ExploreScene.js's navigation rail.
const SHOP = { left: 240 - 420 / 2, rowH: 52, pad: 22, titleH: 40, purseH: 30 };
const RAIL = { x: 480 - 62, top: 58, w: 48, badgeH: 78, gap: 10, mapH: 34 };
// The cogwheel above the rail, which is the only way out of a run and the way
// into Settings and SAVE GAME (src/scenes/ExploreScene.js `buildMenuButton`).
const COG = { x: 480 - 62, y: 14, w: 48, h: 34 };
const SHOP_STOCK = 6; // src/data/shop.js STOCK.length

// The shop panel is centred vertically and sized by its row count, same as the
// widget works it out.
function shopTop() {
  const panelH = SHOP.pad + SHOP.titleH + SHOP.purseH + SHOP_STOCK * SHOP.rowH + 20 + 44 + SHOP.pad;
  return (854 - panelH) / 2;
}
// Mirrored from src/ui/textPanel.js: the panel is the HUD's own band, and any
// point on the screen advances it — the centre of the band is only the most
// honest place for a thumb to land.
const TEXT_PANEL = { x: 240, y: VIEW_H + (854 - VIEW_H) / 2 };

const INV_PANEL = { left: CARD_CX - 380 / 2, top: CARD_CY - 460 / 2 };
// The list starts below the title and the gem-pip row (DESIGN.md §7).
const INV_LIST = { x: INV_PANEL.left + 20, y: INV_PANEL.top + 90, rowH: 64 };

// --- Tiny test runner -------------------------------------------------------
//
// The suite is module state, so every `*.test.js` file that imports this
// registers into the same list: `tests/all.test.js` imports them all and runs
// one pass, while running a single file runs only what that file registered
// (`runIfMain` at the bottom of each). One server and, if anything asks for it,
// one browser serve the whole run.

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
  const startedAt = Date.now();
  const { server, port } = await startServer();
  // Only paid for if something asks: a pure suite run on its own never starts
  // a browser, which is what makes `npm run test:rules` instant.
  let browser = null;
  const browserFor = async (opts) => {
    if (!browser) browser = await launchBrowser();
    return openGame(browser, port, opts);
  };
  let failed = 0;

  for (const { name, fn, browser: needsBrowser, opts } of suite) {
    // Timed, and the time printed: a browser test is two orders of magnitude
    // dearer than a pure one, and a suite nobody can see the cost of is a suite
    // that quietly grows into a coffee break.
    const started = Date.now();
    const game = needsBrowser ? await browserFor(opts) : null;
    const took = () => `${String(Date.now() - started).padStart(6)}ms`;
    try {
      await fn(game);
      const stray = game ? game.pageErrors() : [];
      if (stray.length) throw new Error('page errors: ' + stray.join(' | '));
      console.log(`  PASS ${took()}  ${name}`);
    } catch (err) {
      failed += 1;
      console.log(`  FAIL ${took()}  ${name}`);
      console.log(`        ${err.message}`);
    } finally {
      if (game) await game.close();
    }
  }

  if (browser) await browser.close();
  server.close();

  const total = suite.length;
  const secs = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    failed === 0
      ? `\n${total}/${total} passed in ${secs}s`
      : `\n${total - failed}/${total} passed, ${failed} failed, in ${secs}s`
  );
  process.exit(failed === 0 ? 0 : 1);
}

// Runs the suite only when this file is the one `node` was pointed at, so every
// `*.test.js` file is both a suite `tests/all.test.js` can import and a suite
// that can be run on its own.
export function runIfMain(url) {
  if (process.argv[1] && url === pathToFileURL(process.argv[1]).href) return run();
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
  {
    viewport = { width: 480, height: 854 },
    query = '',
    save = null,
    cheats = false,
  } = {}
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

  // Navigation waits for nothing more than the document; what a test actually
  // needs is a scene it can tap, and that is waited for directly. `isBooted`
  // alone is not it — Phaser is booted before the first scene has run its
  // `create`, and a tap into a screen with nothing on it yet is the kind of
  // once-in-twenty flake that makes a suite untrustworthy.
  await page.goto(`http://localhost:${port}/${query ? `?${query}` : ''}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction(() => {
    const g = window.__game;
    if (!g || !g.isBooted) return false;
    const scene = g.scene.getScenes(true).slice(-1)[0];
    return !!scene && scene.children.list.length > 0;
  });

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

  // The same tap, but waited on rather than slept off. Phaser queues DOM input
  // and dispatches it inside its own game step, so a click is only *seen* a
  // frame or two later — waiting for the frame counter to move is the shortest
  // wait that is still certain the press landed, where a fixed sleep is both
  // slower and, on a loaded machine, not certain at all. Walking is the one
  // input a suite sends hundreds of, so it is the one worth waiting on
  // properly: everything else is a button, and a button is tapped once.
  const tapAt = async (px, py) => {
    const R = await rect();
    const before = await page.evaluate(() => window.__game.loop.frame);
    await page.mouse.click(R.left + px * R.sx, R.top + py * R.sy);
    await page.waitForFunction((f) => window.__game.loop.frame > f + 1, before);
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

    // Every sound played so far, in order ('tap', 'text', 'coin', 'pickup',
    // 'gem', 'chest', 'unlock', 'torch', 'death'). Read out of the module the
    // game itself imported — a dynamic import of the same URL is the same
    // module instance — because there is nothing about a square wave that a
    // headless browser can be asked to listen to.
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

    // What the text panel is showing: which block of how many, the characters of
    // it on screen so far, and whether that block has finished typing itself out.
    // Null while the panel is closed (src/ui/textPanel.js).
    textPanel: () =>
      page.evaluate(() => {
        const s = window.__game.scene.getScene('ExploreScene');
        return s && s.textPanel ? s.textPanel.viewState() : null;
      }),

    // Taps the panel, which is the only thing a player can do to it: finish the
    // block, or move on to the next one. Waited on rather than slept off, like
    // the D-pad — every run that sets out is read a panel on the way past, so
    // this one is tapped as often as a step.
    tapPanel: () => tapAt(TEXT_PANEL.x, TEXT_PANEL.y),

    // Reads the panel to the end, the way a player who has seen it before does:
    // two taps a block, one to fill it and one to move on. `startRun` calls it,
    // so no test has to know that setting out says anything.
    readPanel: async () => {
      for (let taps = 0; taps < 40; taps++) {
        if (!(await game.textPanel())) return;
        await game.tapPanel();
      }
      throw new Error('the text panel would not close');
    },

    // Title screen to a walking run, the way a player gets there: NEW GAME or
    // LOAD GAME, then a slot. A test that planted a save wants that campaign
    // back, so it loads slot 1; one that planted nothing starts a fresh one in
    // the same slot.
    //
    // A fresh expedition opens with the text panel over the HUD, and it owns the
    // input while it is up — so getting to "a walking run" means reading it,
    // exactly as a player has to.
    startRun: async (slot = 1) => {
      const used = await page.evaluate((n) => !!localStorage.getItem(`nouxinha.save.${n}`), slot);
      await game.clickText(used ? 'LOAD GAME' : 'NEW GAME');
      await game.waitForScene('SlotScene');
      await game.clickText(`SLOT ${slot}`);
      await game.waitForScene('ExploreScene');
      await game.readPanel();
    },

    // Taps a D-pad arrow, the way a thumb would. Pair it with `settle()` to
    // wait out the step's slide; on its own it waits only long enough for the
    // press to have been seen, which is what a test asserting a tap did
    // *nothing* wants.
    tapDpad: (dir) => {
      const o = DPAD.offset;
      const at = { up: [0, -o], down: [0, o], left: [-o, 0], right: [o, 0] }[dir];
      return tapAt(DPAD.cx + at[0], DPAD.cy + at[1]);
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

    // The cogwheel in the top right corner: opens the in-run menu (SETTINGS,
    // SAVE GAME, EXIT GAME, KEEP PLAYING).
    tapMenuButton: () => clickAt(COG.x + COG.w / 2, COG.y + COG.h / 2),

    // The navigation rail down the right edge of the map viewport: the map
    // button sits under the compass badge when the run owns both.
    tapMapButton: async () => {
      const hasCompass = (await game.state()).tools.includes('compass');
      const y = RAIL.top + (hasCompass ? RAIL.badgeH + RAIL.gap : 0);
      await clickAt(RAIL.x + RAIL.w / 2, y + RAIL.mapH / 2);
    },

    // Taps the i-th row (0-based) of the open inventory panel's stack list.
    tapInventoryRow: (i) => clickAt(INV_LIST.x + 20, INV_LIST.y + i * INV_LIST.rowH + INV_LIST.rowH / 2),

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
          // The keys in hand and the chests this campaign has already opened —
          // the two halves of what a chest changes (DESIGN.md §4.8).
          keys: [...r.keys],
          chests: [...r.chests],
          seenUnique: [...r.seenUnique],
          banked: { ...r.banked },
          animating: s.animating,
          cardOpen: s.card.isOpen(),
          inventoryOpen: s.inventory.isOpen(),
          dialogOpen: s.dialog.isOpen(),
          // Whether the dialog on screen is the cogwheel menu rather than the
          // hut's question or the death screen.
          menuOpen: s.menuOpen,
          shopOpen: s.shop.isOpen(),
          textPanelOpen: s.textPanel.isOpen(),
          mapOpen: s.worldMap.isOpen(),
          // Where the map overlay's drawing currently sits and how far it can
          // be zoomed — null while the overlay is closed (src/ui/worldMap.js).
          mapView: s.worldMap.viewState(),
          compassShown: s.compass.container.visible,
          compassTarget: s.compass.container.visible
            ? { sprite: s.compass.icon.texture.key, arrow: s.compass.arrow.texture.key }
            : null,
        };
      }),

    // What the player can actually see: for each drawn tile, its world
    // coordinate, sprite, alpha, and tints. This is the render, not the model —
    // and since a gem's whole effect is a colour change, the tints are the only
    // way to assert that restoring one actually reached the screen.
    //
    // Every tile on screen is a stack of colour zones (src/ui/painted.js), so
    // `tint` is the colour the bulk of the tile is drawn in and `paint` the
    // colours of the zones over it — which is where a sanctum wearing its own
    // gem's colour shows up.
    visibleTiles: () =>
      page.evaluate(() => {
        const s = window.__game.scene.getScene('ExploreScene');
        const painted = (tile) => tile.layers.slice(1).filter((l) => l.visible);
        return s.map.cells
          .filter((c) => c.ground.visible)
          .map((c) => ({
            x: s.run.x + c.dx,
            y: s.run.y + c.dy,
            ground: c.ground.key,
            alpha: Math.round(c.ground.alpha * 100) / 100,
            tint: c.ground.layers[0].tintTopLeft,
            paint: painted(c.ground).map((l) => l.tintTopLeft),
            overlay: c.overlay.visible ? c.overlay.key : null,
            item: c.item.visible ? c.item.key : null,
            itemTint: c.item.visible ? c.item.layers[0].tintTopLeft : null,
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

    wizardTexture: () =>
      page.evaluate(
        () => `wizard-${window.__game.scene.getScene('ExploreScene').map.wizard.facing}`
      ),

    // The wizard is a stack of colour-zone layers (src/ui/painted.js): the
    // silhouette they set out in, plus the hood, robe and staff that turn the
    // colour of gems one, two and three — this is how a test sees that a gem's
    // colour actually reached one of them.
    wizardZoneTints: () =>
      page.evaluate(() =>
        window.__game.scene.getScene('ExploreScene').map.wizard.layers.map((l) => l.tintTopLeft)
      ),

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
