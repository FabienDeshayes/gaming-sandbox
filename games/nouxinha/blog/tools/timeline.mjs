// Screenshots of past versions of Nouxinha. Each commit is extracted with
// `git archive`, served with the CDN Phaser swapped for the npm copy, and
// driven through the same generic script: title, set out, walk, and — for the
// versions that have them — a cheat run and its map.
import fs from 'fs';
import http from 'http';
import path from 'path';
import { execSync } from 'child_process';
import { chromium } from 'playwright-core';

const NOUX = new URL('../..', import.meta.url).pathname;
const REPO = execSync(`git -C ${NOUX} rev-parse --show-toplevel`).toString().trim();
const PHASER = `${NOUX}node_modules/phaser/dist/phaser.min.js`;
const WORK = path.resolve(process.env.WORK || '/tmp/nouxinha-timeline');
const OUT = path.resolve(process.argv[2] || 'out/timeline');
const ONLY = process.argv[3] ? process.argv[3].split(',') : null;
fs.mkdirSync(WORK, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

export const MILESTONES = JSON.parse(fs.readFileSync(new URL('milestones.json', import.meta.url), 'utf8'));

// Just the canvas, whatever the page around it was doing in that version.
const snap = (page, { path }) => page.locator('canvas').screenshot({ path });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function extract(commit) {
  const dir = path.join(WORK, commit);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    execSync(`git -C ${REPO} archive ${commit} games/nouxinha | tar -x -C ${dir}`);
  }
  return path.join(dir, 'games/nouxinha');
}

function serve(root) {
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json' };
  const server = http.createServer((req, res) => {
    const rel = req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0];
    if (rel === '/phaser.min.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      return res.end(fs.readFileSync(PHASER));
    }
    fs.readFile(path.join(root, path.normalize(rel)), (err, data) => {
      if (err) { res.writeHead(404); return res.end(); }
      let body = data;
      if (rel.endsWith('.html'))
        body = data.toString().replace(/https:\/\/cdn\.jsdelivr\.net\/[^"']*phaser[^"']*/, '/phaser.min.js');
      res.writeHead(200, { 'Content-Type': mime[path.extname(rel)] || 'text/plain' });
      res.end(body);
    });
  });
  return new Promise((ok) => server.listen(0, () => ok({ server, port: server.address().port })));
}

const exe = fs
  .readdirSync('/opt/pw-browsers')
  .filter((d) => d.startsWith('chromium-'))
  .map((d) => `/opt/pw-browsers/${d}/chrome-linux/chrome`)[0];
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });

async function open(port, { cheats = false, query = '' } = {}) {
  const page = await browser.newPage({ viewport: { width: 960, height: 1708 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((cheats) => {
    try {
      localStorage.setItem('nouxinha.tutorial', '0');
      if (cheats) localStorage.setItem('nouxinha.cheats', '1');
    } catch (e) {}
    let stored;
    Object.defineProperty(window, 'Phaser', {
      configurable: true,
      get: () => stored,
      set(v) {
        if (v && v.Game)
          v.Game = new Proxy(v.Game, {
            construct(t, a) { const g = Reflect.construct(t, a); window.__game = g; return g; },
          });
        stored = v;
      },
    });
  }, cheats);
  await page.goto(`http://localhost:${port}/${query}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const g = window.__game;
    const s = g && g.isBooted && g.scene.getScenes(true).slice(-1)[0];
    return !!s && s.children.list.length > 0;
  }, null, { timeout: 15000 });
  await sleep(900);
  const top = () => page.evaluate(() => window.__game.scene.getScenes(true).slice(-1)[0]?.scene.key);
  const clickXY = async (x, y) => {
    const R = await page.evaluate(() => {
      const r = document.querySelector('canvas').getBoundingClientRect();
      const g = window.__game;
      return { l: r.left, t: r.top, sx: r.width / g.scale.width, sy: r.height / g.scale.height };
    });
    await page.mouse.click(R.l + x * R.sx, R.t + y * R.sy);
    await sleep(250);
  };
  const clickText = async (labels) => {
    const pos = await page.evaluate((labels) => {
      const hits = [];
      const walk = (list) => {
        for (const c of list) {
          if (!c.visible) continue;
          if (typeof c.text === 'string' && labels.includes(c.text.trim())) hits.push(c);
          if (c.list) walk(c.list);
        }
      };
      walk(window.__game.scene.getScenes(true).slice(-1)[0].children.list);
      hits.sort((a, b) => labels.indexOf(a.text.trim()) - labels.indexOf(b.text.trim()));
      const o = hits[0];
      if (!o) return null;
      const b = o.getBounds();
      return { x: b.centerX, y: b.centerY };
    }, labels);
    if (!pos) return false;
    await clickXY(pos.x, pos.y);
    return true;
  };
  const run = () =>
    page.evaluate(() => {
      const s = window.__game.scene.getScene('ExploreScene');
      return s && s.run ? { x: s.run.x, y: s.run.y } : null;
    });
  const panelOpen = () =>
    page.evaluate(() => {
      const s = window.__game.scene.getScene('ExploreScene');
      return !!(s && s.textPanel && s.textPanel.isOpen && s.textPanel.isOpen());
    });
  const dialogOpen = () =>
    page.evaluate(() => {
      const s = window.__game.scene.getScene('ExploreScene');
      return !!(s && s.dialog && s.dialog.isOpen && s.dialog.isOpen());
    });
  return { page, errors, top, clickText, clickXY, run, panelOpen, dialogOpen };
}

// Title → a walking run, whatever the version calls the buttons.
async function setOut(g, shots, tag) {
  await g.clickText(['NEW GAME', 'EXPLORE', 'PLAY', 'START']);
  await sleep(500);
  if ((await g.top()) === 'SlotScene') {
    await g.clickText(['SLOT 1']);
    await sleep(600);
  }
  for (let i = 0; i < 20 && (await g.top()) !== 'ExploreScene'; i++) await sleep(200);
  await sleep(1200);
  if (shots) await snap(g.page, {path: `${OUT}/${tag}-b-setout.png` });
  for (let i = 0; i < 40 && (await g.panelOpen()); i++) {
    await g.clickXY(240, 427);
    await sleep(150);
  }
  await sleep(400);
}

const KEY = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
const DELTA = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const SIDE = { up: ['left', 'right'], down: ['right', 'left'], left: ['up', 'down'], right: ['down', 'up'] };

// A walk out into the dark: legs of a heading each, sidestepping what blocks.
async function walk(g, plan) {
  for (const [dir, n] of plan) {
    for (let i = 0; i < n; i++) {
      if (await g.dialogOpen()) return;
      for (const d of [dir, ...SIDE[dir]]) {
        const before = await g.run();
        if (!before) return;
        await g.page.keyboard.press(KEY[d]);
        await sleep(170);
        for (let k = 0; k < 6 && (await g.panelOpen()); k++) { await g.clickXY(240, 427); await sleep(120); }
        const after = await g.run();
        if (after && (after.x !== before.x || after.y !== before.y)) break;
      }
    }
  }
}

const WALK = [['down', 3], ['left', 5], ['down', 7], ['right', 10], ['down', 7], ['left', 9], ['down', 5], ['right', 4]];

for (const m of MILESTONES) {
  if (ONLY && !ONLY.includes(m.tag)) continue;
  const root = extract(m.commit);
  const { server, port } = await serve(root);
  const query = m.query === undefined ? '' : m.query;
  try {
    // Plain: what a first walk looked like.
    let g = await open(port, { query });
    await snap(g.page, {path: `${OUT}/${m.tag}-a-title.png` });
    await setOut(g, true, m.tag);
    await snap(g.page, {path: `${OUT}/${m.tag}-c-start.png` });
    await walk(g, WALK);
    await sleep(500);
    await snap(g.page, {path: `${OUT}/${m.tag}-d-walk.png` });
    const errs = [...g.errors];
    await g.page.close();
    // Cheats, where the version has them: the late game, and its map.
    if (m.cheats) {
      g = await open(port, { cheats: true, query });
      await setOut(g, false, m.tag);
      await walk(g, WALK.slice(0, 3));
      await sleep(500);
      await snap(g.page, {path: `${OUT}/${m.tag}-e-cheats.png` });
      if (await g.clickText(['MAP'])) {
        await sleep(900);
        await snap(g.page, {path: `${OUT}/${m.tag}-f-map.png` });
      }
      errs.push(...g.errors);
      await g.page.close();
    }
    console.log('ok  ', m.tag, m.commit, errs.length ? errs.slice(0, 2) : '');
  } catch (e) {
    console.log('FAIL', m.tag, m.commit, e.message.split('\n')[0]);
  } finally {
    server.close();
  }
}
await browser.close();
