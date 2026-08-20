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

export const RESOURCES = ['oil', 'wood', 'plank'];
export const METERS = ['lamp', 'hearth', 'tower'];

// Each resource fills exactly one meter. That one-to-one mapping is the reason
// a great haul of driftwood is worthless on the night the lamp is dying.
export const METER_OF = { oil: 'lamp', wood: 'hearth', plank: 'tower' };

// A fixed shop; each tool is buildable once per run. Costs are paid from the
// stockpile, which is fed by resources routed away from their meter at dawn.
//
// Each tool carries a `tier`, gated open by `tuning.toolTierNights` (see
// below) rather than available from night one: the shore gets meaner on the
// same schedule the drain does, and the workshop should too.
export const DEFAULT_TOOLS = [
  { id: 'gaff', name: 'Gaff hook', tier: 1, cost: { wood: 3 }, add: { resource: 'wood', amount: 2 } },
  { id: 'net', name: 'Tide net', tier: 1, cost: { plank: 3 }, add: { resource: 'plank', amount: 2 } },
  { id: 'funnel', name: 'Copper funnel', tier: 2, cost: { oil: 3 }, add: { resource: 'oil', amount: 2 } },
  { id: 'pole', name: 'Lantern pole', tier: 2, cost: { oil: 2, wood: 2 }, add: { resource: 'oil', amount: 2 } },
  { id: 'wall', name: 'Storm wall', tier: 3, cost: { plank: 6 }, removeWave: true },
  { id: 'breakwater', name: 'Breakwater', tier: 3, cost: { oil: 4, wood: 4 }, removeWave: true },
];

export const DEFAULT_TUNING = {
  seasonNights: 12,
  startMeter: 10,
  meterCap: 14,
  // The night ends with an empty basket once the sizes of the waves drawn add
  // up to this. With every wave sized 1 and a budget of 3, this is exactly the
  // "third wave and you're out" rule in DESIGN.md; sized waves make the same
  // machinery grade the risk instead of counting it.
  waveBudget: 3,
  // Drain per meter per night, applied at dusk. Read as "nights up to `through`".
  drainSteps: [
    { through: 4, drain: 1 },
    { through: 8, drain: 2 },
    { through: 12, drain: 3 },
  ],
  // The night a tool of tier N (1-indexed) unlocks in the workshop. Lines up
  // with drainSteps: tier 2 opens the night the drain first rises to 2, tier 3
  // the night it first rises to 3 — the workshop gets more dangerous on the
  // same schedule the shore does.
  toolTierNights: [1, 5, 9],
  // What the tide holds on night 1.
  startShore: { oil: 5, wood: 5, plank: 5 },
  startWaves: [1, 1, 1],
  // Extra tokens seeded onto the shore beyond startShore — a couple of high
  // value finds give a push a bigger upside than "one more of the same".
  extraTokens: [],
  // What survives a bust, as a fraction of the basket, rounded down per
  // resource. Half rather than nothing: with an all-or-nothing bust the cost of
  // a push scales with the basket you are already holding, so pushing is never
  // worth it and the search collapses to "always stop at two waves". See
  // sim/simulate.mjs — the ablation is in the sweep.
  bustKeeps: 0.5,
  // Resource tokens are worth this much each before tools are built.
  startTokenAmount: 1,
  // The storm adds one wave to the shore at the end of each of these nights.
  stormWaveNights: [3, 6, 9],
  stormWaveSize: 1,
  // What a wave costs you when it does NOT end the night: units dropped from
  // the basket, taken off the biggest stack first. Zero makes every wave before
  // the last one free, which leaves most of a night with no decision in it. An
  // array escalates per wave — [1, 2] means the first wave costs one and the
  // second costs two.
  waveDamage: 1,
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

export function resourceToken(resource, amount) {
  return { kind: 'resource', resource, amount };
}

export function waveToken(size = 1) {
  return { kind: 'wave', size };
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
  for (const size of tuning.startWaves) shore.push(waveToken(size));
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
export function countTokens(tokens) {
  const counts = { oil: 0, wood: 0, plank: 0, waves: 0, waveSize: 0, total: tokens.length };
  for (const token of tokens) {
    if (token.kind === 'wave') {
      counts.waves += 1;
      counts.waveSize += token.size;
    } else {
      counts[token.resource] += token.amount;
    }
  }
  return counts;
}

// Chance the next draw is a wave. Zero when the bag is empty.
export function waveOdds(state) {
  if (state.bag.length === 0) return 0;
  return state.bag.filter((t) => t.kind === 'wave').length / state.bag.length;
}

// Chance the next draw ends the night — a wave only busts you if it is big
// enough to exhaust what is left of the budget.
export function bustOdds(state) {
  if (state.bag.length === 0) return 0;
  const left = budgetLeft(state);
  return state.bag.filter((t) => t.kind === 'wave' && t.size >= left).length / state.bag.length;
}

export function budgetLeft(state) {
  return state.tuning.waveBudget - state.strikes;
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
  state.phase = 'search';
  return state;
}

// Pull one token off the shore. A resource lands in the basket; the wave that
// exhausts the budget empties it. Drawing the bag dry also ends the night —
// though with a full shore you can never reach the bottom without busting.
export function search(state) {
  expectPhase(state, 'search');
  if (state.bag.length === 0) throw new Error('the shore is empty');
  const token = state.bag.pop();
  state.drawn.push(token);
  if (token.kind === 'wave') {
    state.strikes += token.size;
    if (state.strikes >= state.tuning.waveBudget) {
      state.busted = true;
      const keeps = state.tuning.bustKeeps;
      for (const resource of RESOURCES) {
        state.basket[resource] = Math.floor(state.basket[resource] * keeps);
      }
      state.phase = 'dawn';
    } else {
      const damage = waveDamageFor(state.tuning, state.strikes - token.size);
      if (damage > 0) dropFromBasket(state.basket, damage * token.size);
    }
  } else {
    state.basket[token.resource] += token.amount;
  }
  if (state.phase === 'search' && state.bag.length === 0) state.phase = 'dawn';
  return token;
}

export function goHome(state) {
  expectPhase(state, 'search');
  state.phase = 'dawn';
  return state;
}

// What the next wave costs, given how much budget the player has already spent.
// A number is flat; an array escalates and holds at its last entry.
export function waveDamageFor(tuning, strikesBefore) {
  const damage = tuning.waveDamage;
  if (!Array.isArray(damage)) return damage;
  if (damage.length === 0) return 0;
  return damage[Math.min(strikesBefore, damage.length - 1)];
}

// A wave knocks you about: you drop units off whatever stack is biggest.
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

export function affordableTools(state) {
  return state.tuning.tools.filter(
    (tool) =>
      !state.toolsBuilt.includes(tool.id) &&
      toolUnlocked(tool, state.night, state.tuning) &&
      canAffordFromMeters(state.meters, tool.cost),
  );
}

// Tools are the only lever the player has over probability: they either put a
// stronger token on the shore or take a wave off it, permanently. A wave
// removal always takes the biggest wave out there.
export function buildTool(state, toolId) {
  expectPhase(state, 'dawn');
  const tool = toolById(toolId, state.tuning.tools);
  if (state.toolsBuilt.includes(toolId)) throw new Error(`already built: ${toolId}`);
  if (!toolUnlocked(tool, state.night, state.tuning)) throw new Error(`not yet unlocked: ${toolId}`);
  if (!canAffordFromMeters(state.meters, tool.cost)) throw new Error(`cannot afford: ${toolId}`);
  for (const [resource, amount] of Object.entries(tool.cost)) state.meters[METER_OF[resource]] -= amount;
  if (tool.removeWave) {
    let index = -1;
    for (let i = 0; i < state.shore.length; i++) {
      const token = state.shore[i];
      if (token.kind !== 'wave') continue;
      if (index === -1 || token.size > state.shore[index].size) index = i;
    }
    if (index !== -1) state.shore.splice(index, 1);
  }
  if (tool.add) state.shore.push(resourceToken(tool.add.resource, tool.add.amount));
  state.toolsBuilt.push(toolId);
  return state;
}

export function endNight(state) {
  expectPhase(state, 'dawn');
  if (!basketIsEmpty(state.basket)) throw new Error('basket must be allocated before ending night');
  if (state.tuning.stormWaveNights.includes(state.night)) {
    state.shore.push(waveToken(state.tuning.stormWaveSize));
  }
  if (state.night >= state.tuning.seasonNights) {
    state.status = 'won';
    return state;
  }
  state.night += 1;
  state.phase = 'dusk';
  return state;
}
