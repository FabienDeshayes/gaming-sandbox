// Simple, dumb policies for the simulator. These are not AI — they are the
// stand-ins for how a real player might think, so the tuning sweep can ask
// "is there a way to play this that wins, and does playing it badly lose?"
//
// A policy answers two questions: keep searching or go home, and at dawn,
// where does the basket go.

import { RESOURCES, METER_OF, budgetLeft, bustOdds, drainForNight } from '../src/core/rules.js';

// --- stop rules -------------------------------------------------------------

// Go home once the wave budget is down to `keep`. With the default budget of 3
// and size-1 waves, keep=1 is risk-free: one more wave cannot end the night.
export function stopWithBudget(keep) {
  return (state) => budgetLeft(state) > keep;
}

// Risk-free until the last point of budget, then push while the chance the
// next draw ends the night is at or under `threshold`.
export function pushUntilOdds(threshold) {
  return (state) => {
    if (budgetLeft(state) > 1) return true;
    return bustOdds(state) <= threshold;
  };
}

export const reckless = () => true;

// --- dawn plans -------------------------------------------------------------

// Pour everything into the meters; never build anything.
export function pourEverything() {
  return () => ({ routes: {}, builds: [] });
}

// Route each stack by three rules, in order:
//   1. never overflow a meter — a wasted surplus is worse than a stockpiled one
//   2. top up any meter with less than `buffer` nights of drain left
//   3. otherwise stockpile toward the next tool on the priority list
export function investPlan(priority, { buffer = 2 } = {}) {
  return (state) => {
    const nextDrain = drainForNight(state.night + 1, state.tuning);
    const target = state.tuning.tools.find(
      (tool) => !state.toolsBuilt.includes(tool.id) && priority.includes(tool.id),
    );
    const wanted = target ? target.cost : {};
    const routes = {};
    for (const resource of RESOURCES) {
      const level = state.meters[METER_OF[resource]];
      const amount = state.basket[resource];
      const overflows = level + amount > state.tuning.meterCap;
      const short = level - nextDrain * buffer <= 0;
      const neededForTool = (wanted[resource] || 0) > state.stock[resource];
      if (overflows) routes[resource] = 'stock';
      else if (short) routes[resource] = 'meter';
      else if (neededForTool) routes[resource] = 'stock';
      else routes[resource] = 'meter';
    }
    return { routes, builds: priority };
  };
}

// Priority orders worth contrasting: throughput first (bigger tokens) versus
// safety first (fewer waves).
export const THROUGHPUT_FIRST = ['gaff', 'net', 'funnel', 'pole', 'wall', 'breakwater'];
export const SAFETY_FIRST = ['wall', 'breakwater', 'gaff', 'net', 'funnel', 'pole'];

// --- the policies the report covers ----------------------------------------

export const POLICIES = [
  { name: 'reckless (never stop)', shouldSearch: reckless, plan: pourEverything() },
  { name: 'timid (home at 1 wave)', shouldSearch: stopWithBudget(2), plan: pourEverything() },
  { name: 'safe, no tools', shouldSearch: stopWithBudget(1), plan: pourEverything() },
  { name: 'safe + tools (buf 1)', shouldSearch: stopWithBudget(1), plan: investPlan(THROUGHPUT_FIRST, { buffer: 1 }) },
  { name: 'safe + tools (buf 2)', shouldSearch: stopWithBudget(1), plan: investPlan(THROUGHPUT_FIRST, { buffer: 2 }) },
  { name: 'safe + tools (buf 3)', shouldSearch: stopWithBudget(1), plan: investPlan(THROUGHPUT_FIRST, { buffer: 3 }) },
  { name: 'safe + tools (safety 1st)', shouldSearch: stopWithBudget(1), plan: investPlan(SAFETY_FIRST, { buffer: 2 }) },
  { name: 'push 25% + tools', shouldSearch: pushUntilOdds(0.25), plan: investPlan(THROUGHPUT_FIRST, { buffer: 2 }) },
  { name: 'push 40% + tools', shouldSearch: pushUntilOdds(0.4), plan: investPlan(THROUGHPUT_FIRST, { buffer: 2 }) },
  { name: 'push 60% + tools', shouldSearch: pushUntilOdds(0.6), plan: investPlan(THROUGHPUT_FIRST, { buffer: 2 }) },
];
