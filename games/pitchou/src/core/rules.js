// Pure rules for Pitchou — no Phaser, no scene state, no DOM. Every function
// takes and returns plain data, so this module is equally usable from the game
// and from a Node simulation (see sim/simulate.mjs).
//
// A night runs through three phases: 'dusk' (meters drain) -> 'search' (the
// push-your-luck draw) -> 'dawn' (allocate the basket, build a tool). See
// DESIGN.md §3 for the loops and §8 for the numbers these defaults come from.
//
// Everything tunable lives in a tuning object rather than in the code, because
// whether a season is winnable-but-tense is a numbers question that gets
// settled by simulation and playtesting, not by design argument.
//
// The hazard token is a FALL: the keeper loses their footing on the wet rocks
// and drops what they were carrying. It has exactly one name — in the rules, in
// the simulator and on the screen — because a playtest found "squall", "wave"
// and "storm" all naming the same thing was the single most confusing part of
// the game.

export const RESOURCES = ['oil', 'wood', 'plank'];
export const METERS = ['lamp', 'hearth', 'tower'];

// Each resource fills exactly one meter. That one-to-one mapping is the reason
// a great haul of driftwood is worthless on the night the lamp is dying.
export const METER_OF = { oil: 'lamp', wood: 'hearth', plank: 'tower' };

// A fixed shop; each tool is buildable once per run. Costs are paid from the
// meters, so building always trades tonight's safety for the rest of the
// season's throughput.
//
// Three kinds of thing a tool can put on the shore, and the mix is the point —
// a workshop of six doublers was one obvious best buy repeated:
//
//   - a plain token   `add: { gains: [{ resource, amount }] }`
//   - a mixed token   two or three resources at once, so one find can feed
//                     two dying meters and you don't have to pick a lane
//   - a rolled token  `{ resource, min, max }` — worth 1 to 3, rolled when it
//                     is drawn. Its ceiling is the best thing on the shore and
//                     its floor is worse than a doubler, so it is a gamble you
//                     buy rather than one you are dealt.
//
// Each tool carries a `tier`, gated open by `tuning.toolTierNights` (see
// below) rather than available from night one: the shore gets meaner on the
// same schedule the drain does, and the workshop should too.
export const DEFAULT_TOOLS = [
  // Tier 1 — one plain doubler per resource, so no meter is ever without an
  // early answer, plus the first mixed token.
  { id: 'gaff', name: 'Gaff hook', tier: 1, cost: { wood: 3 }, add: { gains: [{ resource: 'wood', amount: 2 }] } },
  { id: 'net', name: 'Tide net', tier: 1, cost: { plank: 3 }, add: { gains: [{ resource: 'plank', amount: 2 }] } },
  { id: 'funnel', name: 'Oil funnel', tier: 1, cost: { oil: 3 }, add: { gains: [{ resource: 'oil', amount: 2 }] } },
  {
    id: 'line',
    name: 'Rope line',
    tier: 1,
    cost: { wood: 2, plank: 2 },
    add: { gains: [{ resource: 'wood', amount: 1 }, { resource: 'plank', amount: 1 }] },
  },

  // Tier 2 — the rolled tokens, and the three-way crate.
  { id: 'pole', name: 'Lantern pole', tier: 2, cost: { oil: 2, wood: 2 }, add: { gains: [{ resource: 'oil', min: 1, max: 3 }] } },
  { id: 'rake', name: 'Beach rake', tier: 2, cost: { wood: 2, plank: 2 }, add: { gains: [{ resource: 'wood', min: 1, max: 3 }] } },
  { id: 'winch', name: 'Winch', tier: 2, cost: { oil: 2, plank: 2 }, add: { gains: [{ resource: 'plank', min: 1, max: 3 }] } },
  {
    id: 'crate',
    name: 'Salvage crate',
    tier: 2,
    cost: { oil: 2, wood: 2, plank: 2 },
    add: {
      gains: [
        { resource: 'oil', amount: 1 },
        { resource: 'wood', amount: 1 },
        { resource: 'plank', amount: 1 },
      ],
    },
  },

  // Tier 3 — taking falls off the shore, and the two big mixed tokens.
  { id: 'wall', name: 'Storm wall', tier: 3, cost: { plank: 6 }, removeFall: true },
  { id: 'breakwater', name: 'Breakwater', tier: 3, cost: { oil: 4, wood: 4 }, removeFall: true },
  {
    id: 'barrel',
    name: 'Oil barrel',
    tier: 3,
    cost: { oil: 3, wood: 3 },
    add: { gains: [{ resource: 'oil', min: 1, max: 3 }, { resource: 'wood', amount: 1 }] },
  },
  {
    id: 'raft',
    name: 'Salvage raft',
    tier: 3,
    cost: { wood: 3, plank: 3 },
    add: { gains: [{ resource: 'plank', min: 1, max: 3 }, { resource: 'wood', amount: 1 }] },
  },
];

export const DEFAULT_TUNING = {
  seasonNights: 12,
  startMeter: 10,
  meterCap: 14,
  // The night ends with a half-empty basket once the sizes of the falls drawn
  // add up to this. With every fall sized 1 and a budget of 3, this is exactly
  // the "third fall and you're out" rule in DESIGN.md; sized falls make the
  // same machinery grade the risk instead of counting it.
  fallBudget: 3,
  // Drain per meter per night, applied at dusk. Read as "nights up to `through`".
  drainSteps: [
    { through: 5, drain: 1 },
    { through: 9, drain: 2 },
    { through: 12, drain: 3 },
  ],
  // The night a tool of tier N (1-indexed) unlocks in the workshop. Lines up
  // with drainSteps: tier 2 opens the night the drain first rises to 2 (night
  // 6), tier 3 the night it first rises to 3 (night 10) — the workshop gets
  // more dangerous on the same schedule the shore does.
  toolTierNights: [1, 6, 10],
  // How many tools one dawn can build. One: with twelve tools in the shop and
  // a season only twelve nights long, a workshop that let you buy everything
  // you could afford was a checklist, not a decision — the policy table had the
  // simulator building nine or ten tools a season and cautious play winning
  // outright. Capped at one a night, "which one, tonight" is the choice.
  buildsPerNight: 1,
  // What the tide holds on night 1.
  startShore: { oil: 4, wood: 4, plank: 4 },
  startFalls: [1, 1, 1],
  // Extra tokens seeded onto the shore beyond startShore — a couple of high
  // value finds give a push a bigger upside than "one more of the same".
  extraTokens: [],
  // What survives a fall that ends the night, as a fraction of the basket,
  // rounded down per resource. Half rather than nothing: with an all-or-nothing
  // ending the cost of a push scales with the basket you are already holding,
  // so pushing is never worth it and the search collapses to "always stop at
  // two falls". See sim/simulate.mjs — the ablation is in the sweep.
  bustKeeps: 0.5,
  // Resource tokens are worth this much each before tools are built.
  startTokenAmount: 1,
  // The shore picks up one more fall at the end of each of these nights.
  extraFallNights: [3, 6, 9],
  extraFallSize: 1,
  // What a fall costs you when it does NOT end the night: units dropped from
  // the basket, taken off the biggest stack first. Zero makes every fall before
  // the last one free, which leaves most of a night with no decision in it. An
  // array escalates per fall — [1, 2] means the first costs one and the second
  // costs two.
  fallDamage: 1,
  tools: DEFAULT_TOOLS,
};

export function toolById(id, tools = DEFAULT_TOOLS) {
  const tool = tools.find((t) => t.id === id);
  if (!tool) throw new Error(`unknown tool: ${id}`);
  return tool;
}

// Whether a tool's tier has opened yet. Tier 1 is always open (index 0 of
// toolTierNights is night 1); a tool with no tier (none currently) is treated
// as always available.
export function toolUnlocked(tool, night, tuning = DEFAULT_TUNING) {
  if (!tool.tier) return true;
  const unlockNight = tuning.toolTierNights[tool.tier - 1] ?? 1;
  return night >= unlockNight;
}

export function toolUnlockNight(tool, tuning = DEFAULT_TUNING) {
  return tool.tier ? tuning.toolTierNights[tool.tier - 1] ?? 1 : 1;
}

// --- randomness -------------------------------------------------------------

// mulberry32: small, fast, and seedable, so a season can be replayed exactly.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(items, rng) {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// --- tokens -----------------------------------------------------------------

// Every find is a list of gains. One entry is the plain case; two or three make
// a mixed token; an entry with `min`/`max` instead of `amount` is rolled when
// it is drawn.
export function gainsToken(gains) {
  return { kind: 'resource', gains: gains.map((gain) => ({ ...gain })) };
}

export function resourceToken(resource, amount) {
  return gainsToken([{ resource, amount }]);
}

export function rolledToken(resource, min, max) {
  return gainsToken([{ resource, min, max }]);
}

export function fallToken(size = 1) {
  return { kind: 'fall', size };
}

export function isRolled(token) {
  return token.kind === 'resource' && token.gains.some((gain) => gain.max !== undefined);
}

// The most a token can be worth. What the shore tally counts, and what a rolled
// token's face advertises before it is drawn.
export function tokenMax(token) {
  if (token.kind !== 'resource') return 0;
  return token.gains.reduce((n, gain) => n + (gain.max ?? gain.amount), 0);
}

// Turn a token's gains into concrete amounts, rolling any range. Called once,
// at the moment of the draw, so a rolled token is a different find every time
// it comes out of the bag.
export function rollGains(token, rng) {
  return token.gains.map((gain) => {
    if (gain.max === undefined) return { resource: gain.resource, amount: gain.amount };
    const min = gain.min ?? 1;
    const amount = min + Math.floor(rng() * (gain.max - min + 1));
    return { resource: gain.resource, amount };
  });
}

function buildStartShore(tuning) {
  const shore = [];
  for (const resource of RESOURCES) {
    for (let i = 0; i < tuning.startShore[resource]; i++) {
      shore.push(resourceToken(resource, tuning.startTokenAmount));
    }
  }
  for (const extra of tuning.extraTokens) {
    shore.push(resourceToken(extra.resource, extra.amount));
  }
  for (const size of tuning.startFalls) shore.push(fallToken(size));
  return shore;
}

export function drainForNight(night, tuning = DEFAULT_TUNING) {
  for (const step of tuning.drainSteps) {
    if (night <= step.through) return step.drain;
  }
  return tuning.drainSteps[tuning.drainSteps.length - 1].drain;
}

// Counts by kind for any token list — the shore's full composition, or what is
// still in the bag. The UI shows this at all times; policies read it to decide.
//
// A rolled token counts at its ceiling, and `uncertain` says how many of the
// totals are that kind of promise: "at most this much is out there" is the
// honest reading of a shore holding a 1-3.
export function countTokens(tokens) {
  const counts = {
    oil: 0,
    wood: 0,
    plank: 0,
    falls: 0,
    fallSize: 0,
    uncertain: 0,
    total: tokens.length,
  };
  for (const token of tokens) {
    if (token.kind === 'fall') {
      counts.falls += 1;
      counts.fallSize += token.size;
      continue;
    }
    if (isRolled(token)) counts.uncertain += 1;
    for (const gain of token.gains) counts[gain.resource] += gain.max ?? gain.amount;
  }
  return counts;
}

// Chance the next draw is a fall. Zero when the bag is empty.
export function fallOdds(state) {
  if (state.bag.length === 0) return 0;
  return state.bag.filter((t) => t.kind === 'fall').length / state.bag.length;
}

// Chance the next draw ends the night — a fall only ends it if it is big enough
// to exhaust what is left of the budget.
export function bustOdds(state) {
  if (state.bag.length === 0) return 0;
  const left = budgetLeft(state);
  return state.bag.filter((t) => t.kind === 'fall' && t.size >= left).length / state.bag.length;
}

export function budgetLeft(state) {
  return state.tuning.fallBudget - state.strikes;
}

// --- run lifecycle ----------------------------------------------------------

export function createRun({ seed = 1, tuning = DEFAULT_TUNING } = {}) {
  const meters = {};
  for (const meter of METERS) meters[meter] = tuning.startMeter;
  return {
    seed,
    tuning,
    rng: makeRng(seed),
    night: 1,
    phase: 'dusk',
    status: 'playing',
    lost: null,
    meters,
    shore: buildStartShore(tuning),
    bag: [],
    drawn: [],
    basket: { oil: 0, wood: 0, plank: 0 },
    stock: { oil: 0, wood: 0, plank: 0 },
    strikes: 0,
    busted: false,
    toolsBuilt: [],
    builtTonight: 0,
  };
}

function expectPhase(state, phase) {
  if (state.status !== 'playing') throw new Error(`run is over (${state.status})`);
  if (state.phase !== phase) throw new Error(`expected phase ${phase}, got ${state.phase}`);
}

// Dusk: every meter drains. Hitting zero ends the run — this is the only lose
// condition, and it always fires here rather than mid-search.
export function beginNight(state) {
  expectPhase(state, 'dusk');
  const drain = drainForNight(state.night, state.tuning);
  for (const meter of METERS) {
    state.meters[meter] = Math.max(0, state.meters[meter] - drain);
  }
  const dead = METERS.find((meter) => state.meters[meter] === 0);
  if (dead) {
    state.status = 'lost';
    state.lost = { night: state.night, meter: dead };
    return state;
  }
  state.bag = shuffle(state.shore, state.rng);
  state.drawn = [];
  state.basket = { oil: 0, wood: 0, plank: 0 };
  state.strikes = 0;
  state.busted = false;
  state.builtTonight = 0;
  state.phase = 'search';
  return state;
}

// Pull one token off the shore. A resource lands in the basket; the fall that
// exhausts the budget halves it. Drawing the bag dry also ends the night —
// though with a full shore you can never reach the bottom without falling out.
//
// A rolled token is settled here and the result stashed on the token as
// `rolled`, so the view can draw the find it actually was rather than the
// promise it was before the flip.
export function search(state) {
  expectPhase(state, 'search');
  if (state.bag.length === 0) throw new Error('the shore is empty');
  const token = state.bag.pop();
  state.drawn.push(token);
  if (token.kind === 'fall') {
    state.strikes += token.size;
    if (state.strikes >= state.tuning.fallBudget) {
      state.busted = true;
      const keeps = state.tuning.bustKeeps;
      for (const resource of RESOURCES) {
        state.basket[resource] = Math.floor(state.basket[resource] * keeps);
      }
      state.phase = 'dawn';
    } else {
      const damage = fallDamageFor(state.tuning, state.strikes - token.size);
      if (damage > 0) dropFromBasket(state.basket, damage * token.size);
    }
  } else {
    token.rolled = rollGains(token, state.rng);
    for (const gain of token.rolled) state.basket[gain.resource] += gain.amount;
  }
  if (state.phase === 'search' && state.bag.length === 0) state.phase = 'dawn';
  return token;
}

export function goHome(state) {
  expectPhase(state, 'search');
  state.phase = 'dawn';
  return state;
}

// What the next fall costs, given how much budget the player has already spent.
// A number is flat; an array escalates and holds at its last entry.
export function fallDamageFor(tuning, strikesBefore) {
  const damage = tuning.fallDamage;
  if (!Array.isArray(damage)) return damage;
  if (damage.length === 0) return 0;
  return damage[Math.min(strikesBefore, damage.length - 1)];
}

// A fall spills the basket: you drop units off whatever stack is biggest.
export function dropFromBasket(basket, units) {
  for (let i = 0; i < units; i++) {
    let biggest = null;
    for (const resource of RESOURCES) {
      if (basket[resource] > 0 && (biggest === null || basket[resource] > basket[biggest])) {
        biggest = resource;
      }
    }
    if (biggest === null) return basket;
    basket[biggest] -= 1;
  }
  return basket;
}

export function basketIsEmpty(basket) {
  return RESOURCES.every((resource) => basket[resource] === 0);
}

// Dawn: every resource in the basket pours into its meter. Anything the meter
// can't hold is lost — the cap is pressure to spend a surplus on tools.
export function allocate(state) {
  expectPhase(state, 'dawn');
  for (const resource of RESOURCES) {
    const amount = state.basket[resource];
    if (amount === 0) continue;
    const meter = METER_OF[resource];
    state.meters[meter] = Math.min(state.tuning.meterCap, state.meters[meter] + amount);
    state.basket[resource] = 0;
  }
  return state;
}

export function canAfford(stock, cost) {
  return Object.entries(cost).every(([resource, amount]) => stock[resource] >= amount);
}

export function canAffordFromMeters(meters, cost) {
  return Object.entries(cost).every(([resource, amount]) => meters[METER_OF[resource]] >= amount);
}

// How many more tools this dawn will let you build.
export function buildsLeft(state) {
  return Math.max(0, state.tuning.buildsPerNight - state.builtTonight);
}

export function affordableTools(state) {
  if (buildsLeft(state) === 0) return [];
  return state.tuning.tools.filter(
    (tool) =>
      !state.toolsBuilt.includes(tool.id) &&
      toolUnlocked(tool, state.night, state.tuning) &&
      canAffordFromMeters(state.meters, tool.cost),
  );
}

// Tools are the only lever the player has over probability: they either put a
// better token on the shore or take a fall off it, permanently. A fall removal
// always takes the biggest one out there.
export function buildTool(state, toolId) {
  expectPhase(state, 'dawn');
  const tool = toolById(toolId, state.tuning.tools);
  // Three questions about the tool, then one about the night — so a caller
  // that asks for something it could never build hears why, rather than being
  // told it is out of builds.
  if (state.toolsBuilt.includes(toolId)) throw new Error(`already built: ${toolId}`);
  if (!toolUnlocked(tool, state.night, state.tuning)) throw new Error(`not yet unlocked: ${toolId}`);
  if (!canAffordFromMeters(state.meters, tool.cost)) throw new Error(`cannot afford: ${toolId}`);
  if (buildsLeft(state) === 0) throw new Error('no builds left tonight');
  for (const [resource, amount] of Object.entries(tool.cost)) state.meters[METER_OF[resource]] -= amount;
  if (tool.removeFall) {
    let index = -1;
    for (let i = 0; i < state.shore.length; i++) {
      const token = state.shore[i];
      if (token.kind !== 'fall') continue;
      if (index === -1 || token.size > state.shore[index].size) index = i;
    }
    if (index !== -1) state.shore.splice(index, 1);
  }
  if (tool.add) state.shore.push(gainsToken(tool.add.gains));
  state.toolsBuilt.push(toolId);
  state.builtTonight += 1;
  return state;
}

export function endNight(state) {
  expectPhase(state, 'dawn');
  if (!basketIsEmpty(state.basket)) throw new Error('basket must be allocated before ending night');
  if (state.tuning.extraFallNights.includes(state.night)) {
    state.shore.push(fallToken(state.tuning.extraFallSize));
  }
  if (state.night >= state.tuning.seasonNights) {
    state.status = 'won';
    return state;
  }
  state.night += 1;
  state.phase = 'dusk';
  return state;
}
