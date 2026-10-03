// Shared rig for the blog screenshots of the *current* game: a localStorage
// shim so core/ can run in Node, a route-walker that plays a real run through
// core/rules.js `step`, and a browser opener at 2x for crisp captures.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

export const GAME = new URL('../..', import.meta.url).pathname.replace(/\/$/, '');
const g = (p) => import(`${GAME}/${p}`);

export const world = await g('src/core/world.js');
export const rules = await g('src/core/rules.js');
export const save = await g('src/core/save.js');
export const balance = await g('src/balance.js');
export const items = await g('src/data/items.js');
export const lm = await g('src/data/landmarks.js');
export const harness = await g('tests/harness.js');
export const { tileKey } = await g('src/core/light.js');

const { BASE_X, BASE_Y, canEnter, isBase } = world;

export const DIRS = [[0, -1, 'up'], [1, 0, 'right'], [0, 1, 'down'], [-1, 0, 'left']];

// BFS from (sx,sy) to a tile adjacent-or-equal per isGoal; returns path of dirs.
export function route(seed, start, isGoal, keys, max = 4000) {
  const [sx, sy] = start;
  const prev = new Map([[tileKey(sx, sy), null]]);
  let frontier = [[sx, sy]];
  for (let d = 0; d < max && frontier.length; d++) {
    const next = [];
    for (const [x, y] of frontier) {
      for (const [dx, dy, name] of DIRS) {
        const nx = x + dx, ny = y + dy, key = tileKey(nx, ny);
        if (prev.has(key) || !canEnter(nx, ny, seed, keys)) continue;
        prev.set(key, [tileKey(x, y), name]);
        if (isGoal(nx, ny)) {
          const path = [];
          let cur = key;
          while (prev.get(cur)) { const [p, dir] = prev.get(cur); path.unshift(dir); cur = p; }
          return { x: nx, y: ny, path };
        }
        if (!isBase(nx, ny)) next.push([nx, ny]);
      }
    }
    frontier = next;
  }
  return null;
}

// Route to stand next to (tx,ty) — returns path plus the bump direction.
export function routeBeside(seed, start, tx, ty, keys) {
  const r = route(seed, start, (x, y) => Math.abs(x - tx) + Math.abs(y - ty) === 1, keys);
  if (!r) return null;
  const bump = DIRS.find(([dx, dy]) => r.x + dx === tx && r.y + dy === ty)[2];
  return { ...r, bump };
}

// A late-campaign save: everything a player who has finished this world's
// chain would hold, so the world is drawn in all its colours.
export function lateSave(seed, extra = {}) {
  return {
    ...save.emptySave(),
    started: true,
    seed,
    gems: 3,
    coins: 240,
    runs: 9,
    furthest: 96,
    compass: true,
    map: true,
    keys: [...items.KEYS],
    standings: [...lm.STANDINGS],
    ...extra,
  };
}

// Plays a real run: createRun on `banked`, then `step` along each path in
// turn. Water and light are topped up as it goes (a beacon in hand) so long
// tours don't die — this is about what the ground looks like after walking it.
export function play(seed, banked, legs, { light = 'torch-beacon', nonce = 4242 } = {}) {
  localStorage.clear();
  save.setActiveSlot(1);
  save.writeSave(banked, 1);
  const state = rules.createRun(seed, save.loadSave(1), nonce);
  state.inventory = [{ id: light, durability: balance.LIGHTS[light].maxDurability }];
  state.activeIndex = 0;
  rules.reveal(state);
  for (const leg of legs) {
    const path = typeof leg === 'function' ? leg(state) : leg;
    if (!path) throw new Error('no path for leg');
    for (const dir of path) {
      state.water = 999;
      state.inventory[state.activeIndex] && (state.inventory[state.activeIndex].durability = 999);
      rules.step(state, dir);
    }
  }
  state.water = rules.tankCeiling(state) - 12;
  state.inventory = [
    { id: light, durability: balance.LIGHTS[light].maxDurability - 23 },
    { id: 'torch-lamp', durability: 41 },
    { id: 'torch-medium', durability: 50 },
  ];
  state.activeIndex = 0;
  rules.reveal(state);
  return state;
}

export function suspended(state) {
  return rules.suspendRun(state);
}

export async function openAt(browser, port, opts = {}) {
  // 2x the design size, so the pixel art comes out crisp and blog-sized.
  const orig = browser.newPage.bind(browser);
  browser.newPage = (o) => orig({ ...o, viewport: { width: 960, height: 1708 } });
  try {
    return await harness.openGame(browser, port, opts);
  } finally {
    browser.newPage = orig;
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
