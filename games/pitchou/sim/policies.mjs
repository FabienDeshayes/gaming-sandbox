import {
  RESOURCES,
  METER_OF,
  budgetLeft,
  bustOdds,
  drainForNight,
  canAffordFromMeters,
  toolUnlocked,
} from '../src/core/rules.js';

// --- stop rules -------------------------------------------------------------

export function stopWithBudget(keep) {
  return (state) => budgetLeft(state) > keep;
}

export function pushUntilOdds(threshold) {
  return (state) => {
    if (budgetLeft(state) > 1) return true;
    return bustOdds(state) <= threshold;
  };
}

export const reckless = () => true;

export const noRisk = (state) => bustOdds(state) === 0;

// --- dawn plans -------------------------------------------------------------

export function pourEverything() {
  return () => ({ builds: [] });
}

// After allocation, decide which tools to build from the priority list. Only
// build when every meter that pays for it can still survive the next drain.
export function investPlan(priority, { buffer = 2 } = {}) {
  return (state) => {
    const nextDrain = drainForNight(state.night + 1, state.tuning);
    const builds = [];
    for (const id of priority) {
      const tool = state.tuning.tools.find((t) => t.id === id);
      if (!tool || state.toolsBuilt.includes(id)) continue;
      if (!toolUnlocked(tool, state.night, state.tuning)) continue;
      if (!canAffordFromMeters(state.meters, tool.cost)) continue;
      let safe = true;
      for (const [resource, amount] of Object.entries(tool.cost)) {
        if (state.meters[METER_OF[resource]] - amount - nextDrain * buffer <= 0) {
          safe = false;
          break;
        }
      }
      if (safe) builds.push(id);
    }
    return { builds };
  };
}

// Twelve tools is more than a season can pay for, so a policy is as much a
// shopping order as a stop rule. Throughput buys the cheap doublers first and
// works up to the rolled and mixed tokens; safety spends tier 3 on taking falls
// off the shore before it buys anything that adds to it.
export const THROUGHPUT_FIRST = [
  'gaff', 'net', 'funnel', 'line',
  'pole', 'rake', 'winch', 'crate',
  'barrel', 'raft', 'wall', 'breakwater',
];
export const SAFETY_FIRST = [
  'gaff', 'net', 'funnel', 'line',
  'wall', 'breakwater',
  'pole', 'rake', 'winch', 'crate', 'barrel', 'raft',
];

// Only ever buys tokens that pay more than one resource at a time — the line
// the expanded workshop exists to make possible.
export const MIXED_FIRST = [
  'line', 'crate', 'barrel', 'raft',
  'pole', 'rake', 'winch',
  'gaff', 'net', 'funnel', 'wall', 'breakwater',
];

// --- the policies the report covers ----------------------------------------

export const FALL_POLICIES = [
  { name: 'no risk at all', shouldSearch: noRisk, plan: investPlan(THROUGHPUT_FIRST, { buffer: 3 }) },
  { name: 'push at <=15%', shouldSearch: pushUntilOdds(0.15), plan: investPlan(THROUGHPUT_FIRST, { buffer: 3 }) },
  { name: 'push at <=25%', shouldSearch: pushUntilOdds(0.25), plan: investPlan(THROUGHPUT_FIRST, { buffer: 3 }) },
  { name: 'push at <=40%', shouldSearch: pushUntilOdds(0.4), plan: investPlan(THROUGHPUT_FIRST, { buffer: 3 }) },
];

export const POLICIES = [
  { name: 'reckless (never stop)', shouldSearch: reckless, plan: pourEverything() },
  { name: 'timid (home at 1 fall)', shouldSearch: stopWithBudget(2), plan: pourEverything() },
  { name: 'safe, no tools', shouldSearch: stopWithBudget(1), plan: pourEverything() },
  { name: 'safe + tools (buf 1)', shouldSearch: stopWithBudget(1), plan: investPlan(THROUGHPUT_FIRST, { buffer: 1 }) },
  { name: 'safe + tools (buf 2)', shouldSearch: stopWithBudget(1), plan: investPlan(THROUGHPUT_FIRST, { buffer: 2 }) },
  { name: 'safe + tools (buf 3)', shouldSearch: stopWithBudget(1), plan: investPlan(THROUGHPUT_FIRST, { buffer: 3 }) },
  { name: 'safe + tools (safety 1st)', shouldSearch: stopWithBudget(1), plan: investPlan(SAFETY_FIRST, { buffer: 2 }) },
  { name: 'safe + mixed tools', shouldSearch: stopWithBudget(1), plan: investPlan(MIXED_FIRST, { buffer: 3 }) },
  { name: 'push 25% + mixed', shouldSearch: pushUntilOdds(0.25), plan: investPlan(MIXED_FIRST, { buffer: 2 }) },
  { name: 'push 25% + tools', shouldSearch: pushUntilOdds(0.25), plan: investPlan(THROUGHPUT_FIRST, { buffer: 2 }) },
  { name: 'push 40% + tools', shouldSearch: pushUntilOdds(0.4), plan: investPlan(THROUGHPUT_FIRST, { buffer: 2 }) },
  { name: 'push 60% + tools', shouldSearch: pushUntilOdds(0.6), plan: investPlan(THROUGHPUT_FIRST, { buffer: 2 }) },
];
