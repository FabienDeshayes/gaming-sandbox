// A run, played out in Node: what a step costs, what burns out, what gets
// picked up, and what the recap makes of it. Pure — no browser.

import { assert, assertEqual, runIfMain, unit } from './harness.js';
import { tileKey } from '../src/core/light.js';
import { isWalkable, sanctums } from '../src/core/world.js';
import {
  activeLight,
  activeShape,
  bankRun,
  createRun,
  equip,
  inventoryStacks,
  isBlackout,
  itemOnTile,
  litTiles,
  maxWater,
  refillWater,
  rememberGround,
  runSummary,
  step,
} from '../src/core/rules.js';
import { emptySave, MAX_GEMS } from '../src/core/save.js';
import { CHEAT_COINS, CHEAT_REVEAL_RADIUS, STARTING_WATER } from '../src/balance.js';
import { ITEMS } from '../src/data/items.js';
import { NONCE, ROCK_ROUTE, SEED, SHADOW_ROUTE, TORCH_ROUTE, WATER_ROUTE, scatter } from './world.js';

// Rock is impassable, so tests that need to burn a lot of steps pace back and
// forth on two tiles proved walkable first — and on two tiles *off* the hut,
// since standing on it fills the tank (DESIGN.md §4), which a test counting
// water down to zero would wait for forever.
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
const OUT = (() => {
  const found = [['up', 0, -1], ['right', 1, 0], ['down', 0, 1], ['left', -1, 0]].find(
    ([, dx, dy]) => isWalkable(dx, dy, SEED) && isWalkable(dx * 2, dy * 2, SEED)
  );
  if (!found) throw new Error('nowhere two steps clear of the hut to pace on');
  return found[0];
})();
const BACK = OPPOSITE[OUT];
// Out to the second tile, then back and forth between the first and the second.
const pace = (state, steps) => {
  const results = [];
  for (let i = 0; i < steps; i++) results.push(step(state, i < 2 || i % 2 === 1 ? OUT : BACK));
  return results;
};

unit('a step costs one durability, one water and one step, and sets facing', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  const durability = activeLight(state).durability;
  const water = state.water;

  const result = step(state, OUT);
  assert(result.moved, 'the first step off the base should be legal');
  assertEqual(activeLight(state).durability, durability - 1, 'durability');
  assertEqual(state.water, water - 1, 'water, the same rate as durability');
  assertEqual(state.steps, 1, 'steps');
  assertEqual(state.facing, OUT, 'and the character turns the way they walked');
});

unit('a light shows the rock and not the ground behind it', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  for (const dir of SHADOW_ROUTE.path) step(state, dir);
  const { dx, dy } = SHADOW_ROUTE.hit;
  const blocker = tileKey(state.x + dx, state.y + dy);
  const behind = tileKey(state.x + dx * 2, state.y + dy * 2);

  // A beacon, because with a radius-1 torch there is never a tile between you
  // and anything you can see — tests/light.test.js pins that separately.
  const knewBefore = state.explored.has(behind);
  state.inventory.push({ id: 'torch-beacon', durability: ITEMS['torch-beacon'].maxDurability });
  equip(state, state.inventory.length - 1);

  const lit = new Set(litTiles(state).map((t) => tileKey(t.x, t.y)));
  assert(lit.has(blocker), 'the blocker itself is lit — a wall you cannot see is one you walk into');
  assert(!lit.has(behind), 'the floor directly behind it is not');
  assertEqual(state.explored.has(behind), knewBefore, 'and lighting up never wrote it into the map');

  // A beacon reaches 49 tiles and is showing fewer, which is the whole point:
  // what a light reaches and what it shows are two different numbers now.
  assert(lit.size < 49, `the beacon is showing ${lit.size} of the 49 it reaches`);
  // But never so few that the walk stops working — the shape's own tile and
  // everything a step away survive any amount of rock (tests/light.test.js).
  assert(lit.size >= 9, `and still showing ${lit.size}, which is enough to walk by`);
});

unit('refillWater tops the tank back up to the ceiling, once', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  state.water = 5;
  assert(refillWater(state), 'reports a refill happened');
  assertEqual(state.water, maxWater(state.gems), 'topped back up to the ceiling');
  assertEqual(refillWater(state), false, 'nothing to refill once already full');
});

unit('walking onto a water drop refills water, capped at the ceiling', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  for (const dir of WATER_ROUTE.path) step(state, dir);
  assert(state.water > STARTING_WATER - WATER_ROUTE.path.length, 'the drop topped water back up');
  assert(state.water <= STARTING_WATER, 'refill never exceeds the ceiling');
  assertEqual(itemOnTile(state, state.x, state.y), null, 'the drop is gone now');
});

unit('running out of water ends the run, and nothing else can move it again', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  pace(state, STARTING_WATER);
  assertEqual(state.water, 0, 'water ran all the way out');

  const result = step(state, OUT);
  assertEqual(result.moved, false, 'a dead run cannot move');
  assertEqual(result.reason, 'dead', 'reason');
});

unit('reaching the hut fills the tank, and getting home on the last drop is getting home', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  const out = step(state, OUT);
  assert(out.moved && !out.atBase, 'one step off the doorstep');
  assert(state.water < maxWater(state.gems), 'and a step out here costs water like any other');

  // The walk home on fumes: water set to exactly the one step it takes.
  state.water = 1;
  const home = step(state, BACK);
  assert(home.atBase, 'back on the hut');
  assertEqual(home.died, false, 'reaching your own doorstep is not dying in it');
  assertEqual(state.water, maxWater(state.gems), 'because the hut fills the tank on arrival');
});

unit('walking into rock is rejected and costs nothing', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  for (const dir of ROCK_ROUTE.path) assert(step(state, dir).moved, 'route step');
  const durability = activeLight(state).durability;
  const { facing, steps, water } = state;

  const result = step(state, ROCK_ROUTE.hit);
  assert(!result.moved, 'the step into rock should be rejected');
  assertEqual(result.reason, 'blocked', 'reason');
  assertEqual(activeLight(state).durability, durability, 'durability unchanged');
  assertEqual(state.water, water, 'water unchanged');
  assertEqual(state.facing, facing, 'facing unchanged');
  assertEqual(state.steps, steps, 'step count unchanged');
});

unit('a spent light is removed and the next one auto-equips', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  state.inventory.push({ id: 'torch-medium', durability: 50 });

  const burnout = pace(state, ITEMS['torch-small'].maxDurability).find((r) => r.burnedOut);
  assert(burnout, 'the small torch should burn out within its own durability');
  assertEqual(burnout.burnedId, 'torch-small', 'which light burned out');
  assertEqual(burnout.blackout, false, 'a spare light means no blackout');
  assertEqual(state.inventory.length, 1, 'the spent light is gone');
  assertEqual(activeLight(state).id, 'torch-medium', 'the spare is now equipped');
});

unit('with no lights left you see only your own tile, and can still walk', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  pace(state, ITEMS['torch-small'].maxDurability);

  assert(isBlackout(state), 'should be in blackout');
  assertEqual(activeShape(state), null, 'no active shape');
  assertEqual(litTiles(state).length, 1, 'only the tile underfoot');
  // Blackout is a setback, not a death.
  const before = state.steps;
  step(state, BACK);
  assertEqual(state.steps, before + 1, 'still able to move');
});

unit('equipping a carried light changes what you can see', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  assertEqual(litTiles(state).length, 9, 'small torch');
  state.inventory.push({ id: 'torch-medium', durability: 50 });
  assert(equip(state, 1), 'equip should succeed');
  assertEqual(litTiles(state).length, 25, 'medium torch');
});

unit('inventoryStacks groups same-id copies while keeping their flat index', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  state.inventory.push({ id: 'torch-medium', durability: 50 });
  state.inventory.push({ id: 'torch-medium', durability: 12 });
  state.inventory.push({ id: 'torch-lamp', durability: 60 });

  const stacks = inventoryStacks(state);
  assertEqual(stacks.map((s) => s.id), ['torch-small', 'torch-medium', 'torch-lamp'], 'one stack per id, in pickup order');

  const medium = stacks.find((s) => s.id === 'torch-medium');
  assertEqual(medium.instances.length, 2, 'both copies land in the same stack');
  assertEqual(medium.instances.map((i) => i.durability), [50, 12], 'each copy keeps its own durability');
  assertEqual(medium.instances.map((i) => i.index), [1, 2], 'each copy keeps its flat inventory index for equip()');

  const small = stacks.find((s) => s.id === 'torch-small');
  assertEqual(small.instances[0].isActive, true, 'the equipped copy is flagged active');
  assertEqual(medium.instances[0].isActive, false, 'an unequipped copy is not');
});

unit('a picked-up item does not come back', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  for (const dir of TORCH_ROUTE.path) step(state, dir);
  assertEqual(state.inventory.length, 2, 'the torch is in the inventory');
  assertEqual(itemOnTile(state, state.x, state.y), null, 'the tile is empty now');
  assertEqual(scatter(state.x, state.y), 'torch-medium', 'the pristine world still has it');
});

unit('a step reports arriving back at the hut', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  // The base clearing is forced floor, so stepping out and back is always legal.
  assertEqual(step(state, 'right').atBase, false, 'stepping off the hut');
  assertEqual(step(state, 'left').atBase, true, 'stepping back onto it');
  assertEqual({ x: state.x, y: state.y }, { x: 0, y: 0 }, 'home again');
});

unit('the run summary counts how far out you got and what you found', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  assertEqual(runSummary(state).furthest, 0, 'a fresh run has been nowhere');

  for (const dir of TORCH_ROUTE.path) step(state, dir);
  const summary = runSummary(state);

  assertEqual(summary.steps, TORCH_ROUTE.path.length, 'steps taken');
  assertEqual(summary.lightsFound, 1, 'the torch on the route');
  assertEqual(summary.coins, state.coins, 'coins match the run');
  assertEqual(summary.explored, state.explored.size, 'tiles explored match the run');
  // Furthest is the high-water mark, not where you happen to be standing.
  const furthest = summary.furthest;
  assert(furthest > 0, 'the walk got somewhere');
  for (let i = 0; i < TORCH_ROUTE.path.length; i++) step(state, 'left');
  assert(runSummary(state).furthest >= furthest, 'walking back does not shrink it');
});

unit('cheats hand a run the whole late game, and bank none of it', () => {
  const state = createRun(SEED, emptySave(), NONCE, { cheats: true });

  assertEqual(state.gems, MAX_GEMS, 'every colour is back');
  assertEqual(state.water, maxWater(MAX_GEMS), 'on the widest tank');
  assertEqual(state.coins, CHEAT_COINS, 'with a purse the merchant cannot exhaust');
  assertEqual([...state.tools].sort(), ['compass', 'map'], 'and both tools');

  const lights = Object.values(ITEMS).filter((def) => def.isLight).map((def) => def.id);
  assertEqual(state.inventory.length, lights.length, 'one of every light');
  for (const id of lights)
    assert(state.inventory.some((slot) => slot.id === id), `carrying the ${id}`);
  assertEqual(activeLight(state).id, 'torch-beacon', 'lit by the longest-burning one');

  // Far enough out to cover the fourth sanctum's ring and every landmark, which
  // is the whole point: the late game can be looked at without walking to it.
  const furthest = sanctums(SEED)[3];
  assert(
    state.explored.has(tileKey(furthest.centre.x, furthest.centre.y)),
    'the furthest sanctum is already drawn'
  );
  assert(state.explored.has(tileKey(CHEAT_REVEAL_RADIUS, CHEAT_REVEAL_RADIUS)), 'out to the corner');
  assert(state.seenUnique.has('gem-3'), 'and every unique object is markable on the map');

  // A run handed its gems is a sandbox, not a campaign, so nothing it does
  // reaches a slot (DESIGN.md §6.2).
  step(state, 'right');
  assertEqual(bankRun(state).gems, 0, 'stopping at the hut banks nothing');
  assertEqual(rememberGround(state).mapped, '', 'and not even the ground it was handed');
});

runIfMain(import.meta.url);
