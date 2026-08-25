// The chain the campaign is: four sanctums, three gems, the leash each one
// widens, and the landmarks — the merchant, the compass and the map — standing
// out in the dark between them. Pure — no browser.

import { assert, assertEqual, runIfMain, unit } from './harness.js';
import {
  canEnter,
  chebyshev,
  chests,
  isMerchant,
  itemAt,
  landmarkNamed,
  landmarks,
  sanctums,
  terrainAt,
} from '../src/core/world.js';
import {
  bankRun,
  buy,
  canBuy,
  chestOnTile,
  createRun,
  gateOnTile,
  itemOnTile,
  maxWater,
  runSummary,
  spendable,
  step,
} from '../src/core/rules.js';
import { emptySave, MAX_GEMS } from '../src/core/save.js';
import { compassTarget } from '../src/core/compass.js';
import { CHEST_COIN_VALUES, PRICES, STARTING_WATER, WATER_PER_GEM } from '../src/balance.js';
import { ITEMS } from '../src/data/items.js';
import { gemColour } from '../src/config.js';
import {
  ALL_KEYS,
  FIRST_GEM,
  GEM_ROUTE,
  KEY_CHEST,
  KEY_CHEST_BUMP,
  KEY_CHEST_ROUTE,
  NONCE,
  SANCTUMS,
  SEED,
  SHUT_GATE,
  bfs,
} from './world.js';

// --- The sanctums themselves -------------------------------------------------

unit('every sanctum is a sealed ring with one gate and its prize at the centre', () => {
  for (const s of SANCTUMS) {
    const holes = [];
    for (let dy = -s.radius; dy <= s.radius; dy++)
      for (let dx = -s.radius; dx <= s.radius; dx++) {
        const at = terrainAt(s.centre.x + dx, s.centre.y + dy, SEED);
        const ring = Math.max(Math.abs(dx), Math.abs(dy)) === s.radius;
        if (ring && at !== 'wall') holes.push(`(${dx},${dy})=${at}`);
        // The clearing is forced floor, so the gem is always reachable from the
        // gate — that's what lets the seed check only test the door.
        if (!ring) assertEqual(at, 'floor', `inside sanctum ${s.index} at (${dx},${dy})`);
      }
    assertEqual(holes, [`(${s.gate.x - s.centre.x},${s.gate.y - s.centre.y})=gate`],
      `sanctum ${s.index} ring is solid but for its gate`);
    assertEqual(itemAt(s.centre.x, s.centre.y, SEED), s.gem || 'spring-vial',
      `sanctum ${s.index} centre holds its prize`);

    // The gate is on a wall face, never a corner: there are no diagonal steps,
    // so a corner tile could never be walked through at all.
    const offX = Math.abs(s.gate.x - s.centre.x);
    const offY = Math.abs(s.gate.y - s.centre.y);
    assert(!(offX === s.radius && offY === s.radius), `sanctum ${s.index} gate is on a corner`);
    const walk = Math.abs(s.gate.x - s.approach.x) + Math.abs(s.gate.y - s.approach.y);
    assertEqual(walk, 1, `sanctum ${s.index} approach is one step from its gate`);
    assertEqual(terrainAt(s.approach.x, s.approach.y, SEED), 'floor',
      `sanctum ${s.index} approach is standable`);
  }
});

unit('the sanctums sit at different distances and in different directions', () => {
  assertEqual(SANCTUMS.map((s) => chebyshev(s.centre.x, s.centre.y)), [20, 45, 80, 110],
    'each sanctum lands exactly on its planned ring');

  // Three gems in three directions is what makes collecting them exploring
  // rather than one long walk out and back.
  const headings = SANCTUMS.map((s) => Math.atan2(s.centre.y, s.centre.x));
  for (let a = 0; a < headings.length; a++)
    for (let b = a + 1; b < headings.length; b++) {
      let apart = Math.abs(headings[a] - headings[b]) * (180 / Math.PI);
      if (apart > 180) apart = 360 - apart;
      assert(apart > 45, `sanctums ${a} and ${b} are only ${apart.toFixed(0)} degrees apart`);
    }
});

// --- The gems ----------------------------------------------------------------

unit('a gate stays shut until you hold the key it wants', () => {
  const { gate, approach, key } = SHUT_GATE;
  assertEqual(key, 'key-1', 'the second sanctum wants the first key');

  const empty = createRun(SEED, emptySave(), NONCE);
  assertEqual(canEnter(gate.x, gate.y, SEED, null), false, 'shut with nothing in hand');
  assertEqual(
    gateOnTile(empty, gate.x, gate.y),
    { needs: 'key-1', colour: 1, open: false },
    'and reads as shut'
  );
  // Gems are no longer what a gate asks for: a run holding all three colours and
  // no key is still standing outside it (DESIGN.md §4.8).
  const gemmed = createRun(SEED, { ...emptySave(), gems: 3 }, NONCE);
  assertEqual(gateOnTile(gemmed, gate.x, gate.y).open, false, 'and colours do not open it');

  // Walking into it is rejected the way rock is, but with a reason that says
  // there is something behind it.
  empty.x = approach.x;
  empty.y = approach.y;
  const dir = { '1,0': 'right', '-1,0': 'left', '0,1': 'down', '0,-1': 'up' }[
    `${gate.x - approach.x},${gate.y - approach.y}`
  ];
  const blocked = step(empty, dir);
  assertEqual(blocked.moved, false, 'the step is rejected');
  assertEqual(blocked.reason, 'locked', 'and named as a locked gate, not a wall');
  assertEqual(blocked.needs, 'key-1', 'saying which key it wants');

  // The same tile, for a run that has carried the key home, is just a doorway.
  const armed = createRun(SEED, { ...emptySave(), keys: ['key-1'] }, NONCE);
  assertEqual(canEnter(gate.x, gate.y, SEED, armed.keys), true, 'open with the key');
  armed.x = approach.x;
  armed.y = approach.y;
  const through = step(armed, dir);
  assertEqual(through.moved, true, 'and it can be walked through');
  assertEqual(through.unlocked, 'key-1', 'the step reports the key that turned');
});

unit('a chest is opened by walking into it, once, and banking is what keeps it', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  for (const dir of KEY_CHEST_ROUTE.path) assert(step(state, dir).moved, `route step ${dir}`);
  assertEqual(chestOnTile(state, KEY_CHEST.x, KEY_CHEST.y).opened, false, 'stood next to a shut chest');

  const opened = step(state, KEY_CHEST_BUMP);
  assertEqual(opened.moved, false, 'opening a chest is not a step');
  assertEqual(opened.reason, 'chest', 'the step says what it walked into');
  assertEqual(opened.key, 'key-1', 'and hands over what was inside');
  assertEqual(state.keys.has('key-1'), true, 'the key is in hand');
  assertEqual(chestOnTile(state, KEY_CHEST.x, KEY_CHEST.y).opened, true, 'and the lid is up');

  // A chest that has been opened does nothing at all — no second key, no
  // refill. That is the whole rule (DESIGN.md §4.8).
  const again = step(state, KEY_CHEST_BUMP);
  assertEqual(again.already, true, 'walking back into it says so');
  assertEqual(again.key, null, 'and hands over nothing');
  assertEqual(state.keys.size, 1, 'still one key');

  // Held on the same terms as a gem: only the campaign's once the hut has
  // written it down, and until then it is what a death out here costs.
  assertEqual(runSummary(state).keysCarried, ['key-1'], 'carrying it at risk');
  const saved = bankRun(state);
  assertEqual(saved.keys, ['key-1'], 'the key is in the save');
  assertEqual(saved.chests, ['chest-key-1'], 'and so is the chest it came out of');
  const next = createRun(SEED, saved, NONCE);
  assertEqual(next.keys.has('key-1'), true, 'the next run starts holding it');
  assertEqual(next.chests.has('chest-key-1'), true, 'and the chest stays open');
  assertEqual(runSummary(next).keysCarried, [], 'and is no longer carrying it at risk');
});

unit('a coin chest pays a hoard, and only the first time', () => {
  const chest = chests(SEED).find((c) => !c.key);
  const state = createRun(SEED, emptySave(), NONCE);
  state.x = chest.x + 1;
  state.y = chest.y;
  const before = state.coins;
  const opened = step(state, 'left');
  assertEqual(opened.reason, 'chest', 'walked into it');
  assert(CHEST_COIN_VALUES.includes(opened.coins), `paid one of ${CHEST_COIN_VALUES.join('/')}`);
  assertEqual(state.coins, before + opened.coins, 'straight into the pocket');
  assertEqual(runSummary(state).coins, opened.coins, 'and counted as found this walk');
  assertEqual(step(state, 'left').coins, 0, 'a second visit pays nothing');
});

unit('walking onto a gem repaints the world, and banking is what keeps it', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  assertEqual(state.gems, 0, 'a fresh save has no colour');
  let found = null;
  for (const dir of GEM_ROUTE.path) {
    const result = step(state, dir);
    assert(result.moved, `route step ${dir} should be legal`);
    if (result.gemFound) found = result;
  }

  assertEqual({ x: state.x, y: state.y }, FIRST_GEM.centre, 'arrived at the gem');
  assertEqual(state.gems, 1, 'and picked it up');
  assertEqual(found.picked, 'gem-1', 'the step reported which gem');
  assertEqual(found.respawned, true, 'and that taking it relaid the world');
  assertEqual(
    gateOnTile(state, SHUT_GATE.gate.x, SHUT_GATE.gate.y),
    { needs: 'key-1', colour: 1, open: false },
    'and the second sanctum is still waiting on its key, not on a colour'
  );
  assertEqual(runSummary(state).gemsCarried, 1, 'carrying one that was not already banked');

  // Banking is what writes it down; dying simply never calls this, which is the
  // whole reason the walk home is a decision (DESIGN.md §6).
  const saved = bankRun(state);
  assertEqual(saved.gems, 1, 'the gem is in the save');
  assertEqual(saved.runs, 1, 'and the run is counted');

  const next = createRun(SEED, saved, NONCE);
  assertEqual(next.gems, 1, 'the next run starts holding it');
  assertEqual(runSummary(next).gemsCarried, 0, 'and is no longer carrying it at risk');
});

unit('every sanctum can be walked to and back on the water its gate implies', () => {
  // The chain only works if the gem that opens a gate is also what makes the
  // walk to it survivable (DESIGN.md §4.4). This is the invariant that keeps
  // that true, and the one a retune of the distances or the water is most
  // likely to break silently — a sanctum nobody can return from is a gem the
  // player can never bank, and the game would just quietly dead-end there.
  assertEqual(maxWater(0), STARTING_WATER, 'no gems is the starting tank');
  assertEqual(maxWater(3), STARTING_WATER + 3 * WATER_PER_GEM, 'and each gem widens it');

  for (const s of SANCTUMS) {
    const route = bfs(SEED, (x, y) => x === s.centre.x && y === s.centre.y, 200, [0, 0], ALL_KEYS);
    const round = route.path.length * 2;
    // The gems the chain has handed out by the time this sanctum is the one
    // being walked to — its own index, since they come in order of distance.
    const cap = maxWater(s.index);
    assert(round <= cap, `sanctum ${s.index} is a ${round}-step round trip on ${cap} water — unreturnable`);
    // And it has to leave room to actually *find* the place, not just to walk a
    // route you already knew.
    assert(cap - round >= 50, `sanctum ${s.index} leaves only ${cap - round} steps of slack to search with`);
  }
});

unit('each gem gets a colour the world did not already have', () => {
  const base = gemColour(0);
  const colours = [1, 2, 3].map(gemColour);
  assert(!colours.includes(base), 'no gem hands back the colour already on screen');
  assertEqual(new Set(colours).size, 3, 'and the three differ from each other');
  // This is the rule the renderer paints an opened gate with: a gate wanting
  // gem N is drawn in gem N's colour once it opens (MapView.refresh).
  assertEqual(gemColour(SHUT_GATE.colour), colours[0], "the first shut gate wears gem 1's colour");
});

// --- The landmarks -----------------------------------------------------------

unit('the merchant stands one walk from the hut, and there is only one', () => {
  const found = landmarks(SEED).filter((l) => l.id === 'merchant');
  assertEqual(found.length, 1, 'exactly one merchant');
  const distance = chebyshev(found[0].x, found[0].y);
  assert(distance >= 20 && distance <= 25, `the merchant sits ${distance} tiles out`);
  assertEqual(isMerchant(found[0].x, found[0].y, SEED), true, 'and the tile says so');
  assertEqual(terrainAt(found[0].x, found[0].y, SEED), 'floor', 'you can stand on it');
});

unit('the compass and the map lie out in the dark, one of each', () => {
  for (const id of ['compass', 'map']) {
    const landmark = landmarkNamed(id, SEED);
    assert(landmark, `the world places a ${id}`);
    assertEqual(landmarks(SEED).filter((l) => l.item === id).length, 1, `exactly one ${id}`);
    assert(chebyshev(landmark.x, landmark.y) > 25, `the ${id} is a proper walk out`);
  }

  // Owning one takes it off the ground: it was the same object.
  const compass = landmarkNamed('compass', SEED);
  const without = createRun(SEED, emptySave(), NONCE);
  assertEqual(itemOnTile(without, compass.x, compass.y), 'compass', 'there for a run without one');
  const owned = createRun(SEED, { ...emptySave(), compass: true }, NONCE);
  assertEqual(itemOnTile(owned, compass.x, compass.y), null, 'gone for a run that owns one');
});

// --- The merchant's counter --------------------------------------------------

unit('the merchant spends banked coins before the ones you are carrying', () => {
  const state = createRun(SEED, { ...emptySave(), coins: 30 }, NONCE);
  state.coins = 10; // as if this run had found a pile
  assertEqual(spendable(state), 40, 'the purse is both');

  assertEqual(buy(state, 'torch-medium'), 'torch-medium', 'bought');
  assertEqual(state.banked.coins, 30 - PRICES['torch-medium'], 'the bank paid first');
  assertEqual(state.coins, 10, 'and the pocket is untouched');
  assertEqual(state.inventory.length, 2, 'the torch arrived');
  assertEqual(state.activeIndex, 0, 'unequipped, like any other light');

  // Once the bank is empty the pocket pays the rest.
  assertEqual(buy(state, 'torch-small'), 'torch-small', 'bought the cheap one');
  assertEqual(state.banked.coins, 0, 'bank drained');
  assertEqual(state.coins, 40 - PRICES['torch-medium'] - PRICES['torch-small'], 'the rest came out of the pocket');
});

unit('the merchant refuses what you cannot afford and sells one compass', () => {
  const state = createRun(SEED, { ...emptySave(), coins: PRICES.compass }, NONCE);
  assertEqual(canBuy(state, 'map'), false, 'the map is out of reach');
  assertEqual(buy(state, 'map'), null, 'and refuses to sell');

  assertEqual(buy(state, 'compass'), 'compass', 'the compass is affordable');
  assertEqual(state.tools.has('compass'), true, 'and owned');
  assertEqual(canBuy(state, 'compass'), false, 'there is only one');
  assertEqual(buy(state, 'compass'), null, 'so it will not sell a second');

  // Water and lights have no such limit.
  const rich = createRun(SEED, { ...emptySave(), coins: 1000 }, NONCE);
  rich.water = 10;
  for (let i = 0; i < 4; i++) assertEqual(buy(rich, 'water-drop'), 'water-drop', 'water again');
  assertEqual(rich.water, 10 + 4 * ITEMS['water-drop'].water, 'each one refilled');
  for (let i = 0; i < 3; i++) assertEqual(buy(rich, 'torch-lamp'), 'torch-lamp', 'lights again');
  assertEqual(rich.inventory.length, 4, 'three lamps on top of the starting torch');
});

unit('a tool is only kept if the run banks it at the hut', () => {
  const bought = createRun(SEED, { ...emptySave(), coins: 200 }, NONCE);
  buy(bought, 'compass');
  assertEqual(runSummary(bought).toolsCarried, ['compass'], 'carrying it home is the risk');

  const banked = bankRun(createRun(SEED, { ...emptySave(), coins: 200 }, NONCE));
  assertEqual(banked.compass, false, 'a run that never bought one banks none');

  const kept = bankRun(bought);
  assertEqual(kept.compass, true, 'stopping at the hut keeps it');
  assertEqual(kept.coins, 200 - PRICES.compass, 'and the coins really were spent');
  assertEqual(createRun(SEED, kept, NONCE).tools.has('compass'), true, 'yours from now on');
});

// --- The compass -------------------------------------------------------------

unit('the compass points at the nearest thing this run could actually reach', () => {
  const state = createRun(SEED, { ...emptySave(), compass: true }, NONCE);

  // From the hut, everything is available except the gems behind shut gates —
  // and every chest, since a shut one is exactly the thing worth walking to.
  const reachable = sanctums(SEED)
    .filter((s) => s.gem && !s.key)
    .map((s) => s.centre)
    .concat(landmarks(SEED).map((l) => ({ x: l.x, y: l.y })))
    .concat(chests(SEED).map((c) => ({ x: c.x, y: c.y })));
  const nearest = Math.min(...reachable.map((t) => chebyshev(t.x, t.y, state.x, state.y)));
  assertEqual(compassTarget(state).distance, nearest, 'it points at the nearest of them');

  // A gem behind a gate this run cannot open is never a target, whatever it is
  // carrying — that is what keeps the needle from sending anyone to a wall.
  for (const keys of [[], ['key-1'], ['key-1', 'key-2'], [...ALL_KEYS]]) {
    const run = createRun(SEED, { ...emptySave(), keys, compass: true, map: true }, NONCE);
    const target = compassTarget(run);
    const sanctum = sanctums(SEED).find((s) => s.gem === target.id);
    if (sanctum)
      assert(!sanctum.key || keys.includes(sanctum.key), `${target.id} is offered behind a shut gate`);
  }

  // A chest stops being a target the moment its lid is up, so a campaign that
  // has opened them all is not still being sent back to an empty box.
  const looted = createRun(
    SEED,
    { ...emptySave(), chests: chests(SEED).map((c) => c.id), compass: true },
    NONCE
  );
  assert(
    !chests(SEED).some((c) => compassTarget(looted).id === c.id),
    'an opened chest is off the needle'
  );

  // With everything taken and both tools owned, only the hut is left.
  const done = createRun(
    SEED,
    {
      ...emptySave(),
      gems: MAX_GEMS,
      chests: chests(SEED).map((c) => c.id),
      compass: true,
      map: true,
    },
    NONCE
  );
  done.x = 30;
  done.y = 30;
  assertEqual(compassTarget(done).id, 'hut', 'and then it points home');
  assertEqual(compassTarget(done).distance, 30, 'from wherever you are');
});

runIfMain(import.meta.url);
