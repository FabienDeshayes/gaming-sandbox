// Blog screenshots of Nouxinha as it is today. Every shot is a real run:
// played through core/rules.js `step` in Node, suspended into a slot exactly
// the way SAVE GAME does it, then picked back up through LOAD GAME in the
// browser and finished with real D-pad taps.
import fs from 'fs';
import {
  world, rules, items, harness, route, routeBeside, lateSave, play, suspended, openAt, sleep, DIRS,
} from './rig.mjs';

const OUT = process.argv[2] || 'out/current';
const ONLY = process.argv[3] ? new RegExp(process.argv[3]) : null;
fs.mkdirSync(OUT, { recursive: true });

const SEEDS = { temperate: -1640531535, frozen: -609154949, desert: -1587889288, mystic: -626627309 };
const KEYS = new Set(items.KEYS);
const HOME = [0, 1];

const { server, port } = await harness.startServer();
const browser = await harness.launchBrowser();

// Where a run is standing after walking `legs`, for chaining routes.
const at = (st) => [st.x, st.y];
const besideLeg = (seed, tx, ty, keys = KEYS) => (st) => routeBeside(seed, at(st), tx, ty, keys).path;
const toLeg = (seed, tx, ty, keys = KEYS) => (st) =>
  route(seed, at(st), (x, y) => x === tx && y === ty, keys).path;
const nearLeg = (seed, tx, ty, r, keys = KEYS) => (st) =>
  route(seed, at(st), (x, y) => Math.abs(x - tx) <= r && Math.abs(y - ty) <= r, keys).path;
const face = (dir) => () => []; // facing is set by the last step anyway

async function shot(name, fn) {
  if (ONLY && !ONLY.test(name)) return;
  const t = Date.now();
  try {
    await fn();
    console.log('ok  ', name, Date.now() - t, 'ms');
  } catch (e) {
    console.log('FAIL', name, e.message);
  }
}

// Opens the game on a planted mid-walk save and walks `live` taps on screen.
async function planted(seed, banked, legs, { live = [], light, opts = {}, wait = 900 } = {}) {
  const st = play(seed, banked, legs, light ? { light } : {});
  const sv = suspended(st);
  const game = await openAt(browser, port, { save: sv, ...opts });
  await game.startRun();
  for (const dir of live) {
    await game.tapDpad(dir);
    await sleep(160);
  }
  await sleep(wait);
  return { game, st };
}

const out = (n) => `${OUT}/${n}.png`;

// Taps the panel until a block has finished typing, and shoots it.
async function panelShot(game, name, block = 0) {
  for (let i = 0; i < block * 2; i++) await game.tapPanel();
  for (let i = 0; i < 60; i++) {
    const v = await game.textPanel();
    if (!v || v.done || v.complete || v.finished) break;
    await sleep(100);
  }
  await sleep(600);
  await game.shot(out(name));
}

// --- Title and slots ---------------------------------------------------------

await shot('01-title', async () => {
  const game = await openAt(browser, port, {});
  await sleep(1200);
  await game.shot(out('01-title'));
  await game.close();
});

// --- One spot, before and after: the colour comes back -----------------------

for (const [biome, seed] of Object.entries(SEEDS)) {
  const lms = world.landmarks(seed);
  // The landmark nearest the hut that isn't drawn in the world's own colour.
  const near = lms.slice().sort((a, b) => Math.abs(a.x) + Math.abs(a.y) - (Math.abs(b.x) + Math.abs(b.y)));
  const target = near[0];
  for (const [tag, banked] of [
    ['grey', { ...lateSave(seed), gems: 0, standings: [], keys: [], compass: false, map: false, coins: 12 }],
    ['colour', lateSave(seed)],
  ]) {
    await shot(`10-${biome}-${tag}`, async () => {
      const { game } = await planted(seed, banked, [besideLeg(seed, target.x, target.y)], {
        light: tag === 'grey' ? 'torch-medium' : 'torch-beacon',
      });
      await game.shot(out(`10-${biome}-${tag}`));
      await game.close();
    });
  }
}

// --- Wisps in the dark --------------------------------------------------------

for (const [biome, seed] of Object.entries(SEEDS)) {
  await shot(`20-wisp-${biome}`, async () => {
    const ws = world.wisps(seed).slice().sort((a, b) => Math.abs(a.x) + Math.abs(a.y) - (Math.abs(b.x) + Math.abs(b.y)));
    const w = ws[0];
    const { game } = await planted(seed, lateSave(seed), [nearLeg(seed, w.x, w.y + 3, 1)], { light: 'torch-small' });
    await game.shot(out(`20-wisp-${biome}`));
    await game.close();
  });
}

// --- Reading the world: a post, a stone, a landmark ---------------------------

{
  const seed = SEEDS.frozen;
  await shot('30-signpost', async () => {
    const post = world.signposts(seed).find((p) => p.id === 'post-1');
    const r = routeBeside(seed, HOME, post.x, post.y, KEYS);
    const { game } = await planted(seed, lateSave(seed, { gems: 1 }), [r.path], { light: 'torch-medium' });
    await game.tapDpad(r.bump);
    await panelShot(game, '30-signpost');
    await game.close();
  });
  await shot('31-stone', async () => {
    const stone = world.stones(seed)[0];
    const r = routeBeside(seed, HOME, stone.x, stone.y, KEYS);
    const { game } = await planted(seed, lateSave(seed, { finished: ['temperate', 'desert'] }), [r.path], {});
    await game.tapDpad(r.bump);
    await panelShot(game, '31-stone');
    await game.close();
  });
}
{
  const seed = SEEDS.desert;
  await shot('32-landmark', async () => {
    const l = world.landmarks(seed).find((x) => x.id === 'bell');
    const r = routeBeside(seed, HOME, l.x, l.y, KEYS);
    const { game } = await planted(seed, lateSave(seed), [r.path], {});
    await game.tapDpad(r.bump);
    await panelShot(game, '32-landmark');
    await game.close();
  });
}

// --- A sanctum with its gem still inside --------------------------------------

for (const [biome, seed] of Object.entries(SEEDS)) {
  await shot(`40-sanctum-${biome}`, async () => {
    const sanct = world.sanctums(seed).filter((s) => s.gem);
    const s = sanct[2];
    const { game } = await planted(seed, lateSave(seed, { gems: 2 }), [nearLeg(seed, s.centre.x, s.centre.y, 2)], {});
    await game.shot(out(`40-sanctum-${biome}`));
    await game.close();
  });
}

// --- A shut gate, wanting its key ----------------------------------------------

await shot('41-gate', async () => {
  const seed = SEEDS.mystic;
  const s = world.sanctums(seed).find((x) => x.key === 'key-2') || world.sanctums(seed)[1];
  const { game } = await planted(
    seed,
    lateSave(seed, { gems: 1, keys: ['key-1'] }),
    [nearLeg(seed, s.centre.x, s.centre.y + 7, 0, new Set(['key-1']))],
    {}
  );
  await game.shot(out('41-gate'));
  await game.close();
});

// --- The merchant -------------------------------------------------------------

await shot('50-merchant', async () => {
  const seed = SEEDS.temperate;
  const m = world.merchants(seed)[0];
  const r = routeBeside(seed, HOME, m.x, m.y, KEYS);
  const { game } = await planted(seed, lateSave(seed), [r.path], {});
  await game.shot(out('50-merchant-outside'));
  await game.tapDpad(r.bump);
  await sleep(900);
  await game.shot(out('50-merchant'));
  await game.close();
});

// --- The inventory --------------------------------------------------------------

await shot('51-inventory', async () => {
  const seed = SEEDS.desert;
  const { game } = await planted(seed, lateSave(seed), [nearLeg(seed, 6, -14, 1)], {});
  await game.tapInventory();
  await sleep(700);
  await game.shot(out('51-inventory'));
  await game.close();
});

// --- The map, after a long tour of one world ------------------------------------

for (const [biome, seed] of Object.entries(SEEDS)) {
  await shot(`60-map-${biome}`, async () => {
    const legs = [];
    const lms = world.landmarks(seed);
    const sanct = world.sanctums(seed);
    const stops = [
      ...lms.map((l) => ({ x: l.x, y: l.y })),
      ...sanct.map((s) => ({ x: s.centre.x, y: s.centre.y })),
    ];
    // Visit in angular order so the trail loops round the world.
    stops.sort((a, b) => Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x));
    for (const s of stops) legs.push(nearLeg(seed, s.x, s.y, 2));
    legs.push(nearLeg(seed, 0, 3, 1));
    const { game } = await planted(seed, lateSave(seed), legs, {});
    await game.shot(out(`60-walk-home-${biome}`));
    await game.tapMapButton();
    await sleep(900);
    await game.shot(out(`60-map-${biome}`));
    await game.close();
  });
}

// --- The hall, and the sorcerer ---------------------------------------------------

await shot('70-hall', async () => {
  const seed = SEEDS.temperate;
  const h = world.hall(seed);
  const r = routeBeside(seed, HOME, h.centre.x, h.centre.y, KEYS);
  const { game } = await planted(seed, lateSave(seed, { finished: ['frozen'] }), [r.path], {});
  await game.shot(out('70-hall'));
  await game.tapDpad(r.bump);
  await panelShot(game, '71-sorcerer-1');
  await panelShot(game, '72-sorcerer-2', 1);
  await game.close();
});

// --- The end of the game ----------------------------------------------------------

await shot('80-ending', async () => {
  const seed = SEEDS.mystic;
  const h = world.hall(seed);
  const r = routeBeside(seed, HOME, h.centre.x, h.centre.y, KEYS);
  const { game } = await planted(
    seed,
    lateSave(seed, { finished: ['temperate', 'frozen', 'desert'], cycles: 4 }),
    [r.path],
    {}
  );
  await game.tapDpad(r.bump);
  await panelShot(game, '80-ending-words');
  // Read to the end, and catch the light going off.
  for (let i = 0; i < 60 && (await game.textPanel()); i++) await game.tapPanel();
  await sleep(350);
  await game.shot(out('81-ending-burst'));
  await game.waitForScene('CreditsScene');
  await sleep(6000);
  await game.shot(out('82-credits'));
  await game.close();
});

// --- The tutorial -----------------------------------------------------------------

await shot('90-tutorial', async () => {
  const game = await openAt(browser, port, { tutorial: true });
  await game.clickText('NEW GAME');
  await game.waitForScene('SlotScene');
  await game.clickText('SLOT 1');
  await game.waitForScene('ExploreScene');
  // Every block read on the way out of the door, opening panel and the
  // tutorial's first lesson both, one picture each once it has typed out.
  let n = 0;
  for (let taps = 0; taps < 40 && n < 8; taps++) {
    let v = null;
    for (let i = 0; i < 40; i++) {
      v = await game.textPanel();
      if (v && v.done) break;
      await sleep(120);
    }
    if (!v) break;
    await sleep(500);
    await game.shot(out(`9${n}-tutorial`));
    n++;
    await game.tapPanel();
    await sleep(250);
  }
  await game.close();
});

// --- Slots after a few campaigns --------------------------------------------------

await shot('02-slots', async () => {
  const sv = lateSave(SEEDS.desert, { cycles: 2, finished: ['temperate', 'frozen'] });
  const game = await openAt(browser, port, { save: sv });
  await game.clickText('LOAD GAME');
  await game.waitForScene('SlotScene');
  await sleep(600);
  await game.shot(out('02-slots'));
  await game.close();
});

await browser.close();
server.close();
