// What outlives a run: the three slots, the ground written down whichever way
// an expedition ends, and the walk the cogwheel can suspend into a slot and
// pick back up. Pure — no browser.

import { assert, assertEqual, runIfMain, unit } from './harness.js';
import { BASE_X, BASE_Y, DEFAULT_SEED, pickSeed } from '../src/core/world.js';
import {
  abandonRun,
  bankRun,
  createRun,
  depositRun,
  hasSuspendedRun,
  itemOnTile,
  maxWater,
  openChest,
  rememberGround,
  respawn,
  resumeRun,
  runSummary,
  step,
  suspendRun,
  turnCycle,
} from '../src/core/rules.js';
import { clampSlot, emptySave, MAX_GEMS, normaliseSave, SLOT_COUNT } from '../src/core/save.js';
import { decodeExplored, encodeExplored } from '../src/core/cartography.js';
import { ITEMS } from '../src/data/items.js';
import { BIOME_IDS } from '../src/data/biomes.js';
import { ALL_KEYS_LIST, BIOME, GEM_ROUTE, KEY_CHEST, NONCE, SEED, TORCH_ROUTE } from './world.js';

// --- Slots -------------------------------------------------------------------

unit('a slot number is always one of the three', () => {
  assertEqual(SLOT_COUNT, 3, 'three campaigns can be walked at once');
  assertEqual(clampSlot(0), 1, 'below the first is the first');
  assertEqual(clampSlot(9), SLOT_COUNT, 'past the last is the last');
  assertEqual(clampSlot('x'), 1, 'and nonsense is the first');
});

unit('a slot counts as in use the moment there is anything in it', () => {
  assertEqual(normaliseSave(emptySave()).started, false, 'an empty save is an empty slot');
  assertEqual(normaliseSave({ ...emptySave(), started: true }).started, true, 'a claimed one is not');
  // The flag is belt and braces: a save with progress in it is somebody's
  // campaign whether or not the flag survived being hand-edited.
  for (const field of [{ runs: 2 }, { coins: 5 }, { gems: 1 }, { map: true }, { mapped: '0,0,1' }])
    assertEqual(normaliseSave({ ...emptySave(), ...field }).started, true, `${Object.keys(field)[0]} means used`);
});

unit('a campaign keeps the world its slot was given', () => {
  // A campaign's world is drawn once, when NEW GAME claims the slot, and lives
  // in the save from then on (core/save.js `startSlot`). Everything else about
  // the world falls out of it, so a run that ignored it would be a run in
  // somebody else's cave system.
  const mine = pickSeed(4242);
  assertEqual(createRun(undefined, { ...emptySave(), seed: mine }).seed, mine, 'the slot decides');

  // A slot with no world of its own is a campaign started before slots had
  // them. It keeps the one world it has been mapping rather than being moved to
  // a fresh one, which would strand its cartography.
  assertEqual(createRun(undefined, emptySave()).seed, pickSeed(DEFAULT_SEED), 'a legacy slot keeps the old one');

  // A seed named outright still wins — that is what `?seed=` on the URL is for.
  assertEqual(createRun(SEED, { ...emptySave(), seed: mine }).seed, pickSeed(SEED), 'and the URL overrides both');

  // `bankRun` rebuilds the save rather than merging onto it, so the world is
  // the one field a walk home could silently drop — and dropping it would take
  // the campaign's mapped ground with it.
  const banked = bankRun(createRun(undefined, { ...emptySave(), seed: mine }, NONCE));
  assertEqual(banked.seed, mine, 'walking home leaves the world alone');
  assertEqual(banked.mappedSeed, mine, 'and the ground it drew belongs to it');
});

unit('a corrupt or hand-edited save cannot break a run', () => {
  for (const bad of [null, 'nonsense', { gems: 99 }, { gems: -4 }, { gems: 'two', coins: NaN }]) {
    const state = createRun(SEED, bad, NONCE);
    assert(state.gems >= 0 && state.gems <= MAX_GEMS, `gems clamped for ${JSON.stringify(bad)}`);
    assertEqual(state.water, maxWater(state.gems), 'water matches whatever gem count survived');
  }

  // Keys and chests are lists of ids, which is the one shape a hand-edited file
  // can put nonsense into without tripping a number check: an id that names no
  // key would leave a run holding something no gate has ever heard of.
  const forged = normaliseSave({
    keys: ['key-1', 'key-1', 'skeleton-key', 7, null],
    chests: ['chest-key-1', 'chest-of-drawers'],
  });
  assertEqual(forged.keys, ['key-1'], 'only real keys survive, once each');
  assertEqual(forged.chests, ['chest-key-1'], 'and only chests the world actually holds');
  assertEqual(normaliseSave({ keys: 'key-1' }).keys, [], 'a key list that is not a list is none');
});

// --- The ground a run keeps --------------------------------------------------

unit('run-length encoded ground survives the round trip, and a corrupt one costs only the drawing', () => {
  const walked = new Set(['0,0', '1,0', '2,0', '3,0', '-4,7', '-3,7']);
  const back = decodeExplored(encodeExplored(walked));
  assertEqual(back.size, walked.size, 'round trip keeps every tile');
  for (const key of walked) assert(back.has(key), `kept ${key}`);
  assertEqual(decodeExplored('not a map;4,x,2').size, 0, 'and a corrupt one draws nothing');
});

unit('the ground a run lit carries into the next one, map or no map', () => {
  // Cartography is not progress (DESIGN.md §6.1): owning the map changes what
  // you can look at, never what the slot remembers.
  const plain = createRun(SEED, emptySave(), NONCE);
  for (const dir of ['right', 'right', 'right', 'up', 'up']) step(plain, dir);
  const saved = bankRun(plain);
  assert(saved.mapped.length > 0, 'a run without the map still writes its ground');
  assertEqual(saved.mappedSeed, SEED, 'against the world it belongs to');

  const next = createRun(SEED, saved, NONCE);
  assertEqual(next.explored.size, plain.explored.size, 'the next run opens with it drawn');

  // Ground drawn in another world is discarded rather than drawn wrong.
  const elsewhere = createRun(SEED, { ...saved, mappedSeed: (SEED + 1) | 0 }, NONCE);
  assert(elsewhere.explored.size < next.explored.size, 'a stale drawing is dropped');
});

unit('a run that never gets home keeps its ground and nothing else', () => {
  // `rememberGround` writes to the active slot, which is localStorage — absent
  // in Node, so what it hands back is the normalised save it would have stored.
  const state = createRun(SEED, { ...emptySave(), coins: 40, runs: 3 }, NONCE);
  for (const dir of ['right', 'right', 'up']) step(state, dir);
  state.coins = 25;
  state.tools.add('compass');

  const kept = rememberGround(state);
  assert(kept.mapped.length > 0, 'the walk is written down');
  assertEqual(kept.mappedSeed, SEED, 'against the world it belongs to');
  assertEqual(kept.coins, 0, 'but nothing the run was carrying is banked');
  assertEqual(kept.compass, false, 'not even a tool it found on the way');
  assertEqual(kept.runs, 0, 'and a run that never got home is not a run completed');
});

unit('the map only marks unique objects the run has actually seen', () => {
  const state = createRun(SEED, { ...emptySave(), map: true }, NONCE);
  assertEqual(state.seenUnique.size, 0, 'nothing seen from the doorway');

  for (const dir of GEM_ROUTE.path) step(state, dir);
  assert(state.seenUnique.has('gem-1'), 'the gem it walked onto is on the map');
  assert(!state.seenUnique.has('map'), 'and the map lying 90 tiles out is not');
});

// --- Arriving at the hut ------------------------------------------------------

unit('reaching the hut writes the walk down without ending it', () => {
  const state = createRun(SEED, { ...emptySave(), coins: 40, runs: 3 }, NONCE);
  for (const dir of ['right', 'right', 'up']) step(state, dir);
  state.coins = 25;
  state.gems = 1;
  state.tools.add('compass');
  assertEqual(runSummary(state).gemsCarried, 1, 'a colour is riding on the walk home');

  const written = depositRun(state);
  assertEqual(written.gems, 1, 'the colour is in the slot');
  assertEqual(written.coins, 65, 'the pocket went into the bank on top of what was there');
  assertEqual(written.compass, true, 'and so did the tool');
  assertEqual(written.runs, 3, 'but the expedition is not over, so it is not a run completed');
  assert(written.mapped.length > 0, 'the ground goes in as it always did');

  // The run's own books have to move with the slot, or it would still think it
  // was carrying what it has just put down.
  assertEqual(state.coins, 0, 'nothing left in the pocket');
  assertEqual(state.banked.coins, 65, 'because it is all in the bank');
  const after = runSummary(state);
  assertEqual(after.gemsCarried, 0, 'nothing a death could still cost');
  assertEqual(after.toolsCarried, [], 'not the tool either');
  assertEqual(after.coins, 0, 'the walk found no coins of its own — 40 and 25 were both handed to it');
});

unit('a walk that crosses the hut twice banks twice and still counts as one run', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  state.coins = 10;
  depositRun(state);
  state.coins = 7;
  const twice = depositRun(state);
  assertEqual(twice.coins, 17, 'both halves are in the bank');
  assertEqual(twice.runs, 0, 'and neither visit finished an expedition');

  const ended = bankRun(state);
  assertEqual(ended.coins, 17, 'ending it banks nothing twice over');
  assertEqual(ended.runs, 1, 'and counts the one walk it was');
});

unit('what the recap reports is what the walk found, not what is in the pocket', () => {
  // The pocket empties every time the hut is crossed, so the two numbers came
  // apart the moment arriving started banking.
  const state = createRun(SEED, emptySave(), NONCE);
  state.coins = 30;
  state.coinsFound = 30;
  depositRun(state);
  assertEqual(runSummary(state).coins, 30, 'the walk still found thirty');
  assertEqual(runSummary(state).coinsCarried, 0, 'with none of it still at risk');
});

unit('a cheat run is not written down by arriving either', () => {
  const state = createRun(SEED, emptySave(), NONCE, { cheats: true });
  const coins = state.coins;
  const written = depositRun(state);
  assertEqual(written.gems, 0, 'the slot is untouched by a sandbox');
  assertEqual(written.coins, 0, 'including its bottomless purse');
  assertEqual(state.coins, coins, 'and the run keeps everything it was handed');
});

// --- A suspended expedition --------------------------------------------------

unit('saving mid-walk writes the expedition down without banking any of it', () => {
  // `suspendRun` merges onto the active slot, which is localStorage — absent in
  // Node, so what it hands back is the save it would have stored.
  const state = createRun(SEED, { ...emptySave(), coins: 40, runs: 3 }, NONCE);
  for (const dir of TORCH_ROUTE.path) step(state, dir);
  state.tools.add('compass');
  // A key out of a chest is carried on exactly the same terms as that compass,
  // so the round trip has to keep both — and bank neither.
  openChest(state, KEY_CHEST);

  const saved = suspendRun(state);
  assert(hasSuspendedRun(saved), 'the slot is holding an expedition');
  // Saving is not banking (DESIGN.md §6.1): nothing the run is carrying moves
  // into the campaign's own numbers, the way stopping at the hut would.
  assertEqual(saved.coins, 0, 'the coins picked up are still only carried');
  assertEqual(saved.compass, false, 'and a tool found on the way is still at risk');
  assertEqual(saved.keys, [], 'a key found on the way is still at risk too');
  assertEqual(saved.chests, [], 'and so is the chest it came out of');
  assertEqual(saved.runs, 0, 'a suspended walk is not a run completed');
  assert(saved.mapped.length > 0, 'but the ground it lit is written, as always');

  const back = resumeRun(saved);
  assertEqual(back.x, state.x, 'it resumes on the tile it stopped on');
  assertEqual(back.y, state.y, 'both ways');
  assertEqual(back.facing, state.facing, 'facing the way it was');
  assertEqual(back.steps, state.steps, 'with the steps it had taken');
  assertEqual(back.water, state.water, 'the water it had left');
  assertEqual(back.coins, state.coins, 'the coins in its pocket');
  assertEqual(back.inventory, state.inventory, 'and every light at the durability it was at');
  assertEqual(back.activeIndex, state.activeIndex, 'still burning the same one');
  assertEqual([...back.tools].sort(), [...state.tools].sort(), 'holding the same tools');
  assertEqual([...back.keys].sort(), [...state.keys].sort(), 'and the same keys');
  assertEqual([...back.chests].sort(), [...state.chests].sort(), 'with the same chests left open');
  assertEqual(back.explored.size, state.explored.size, 'on the ground it had drawn');
  // The campaign underneath is what the run would bank into if it ever got
  // home, so it has to survive the round trip too.
  assertEqual(back.banked.coins, 40, 'the campaign it walked out of is still there');
  assertEqual(back.banked.runs, 3, 'runs and all');
});

unit('a resumed expedition walks out onto the world it left', () => {
  // The world is never stored (DESIGN.md §4.3), so this is the whole test of the
  // save format: seed, nonce and epoch have to put the same scatter back, and
  // `collected` has to keep what the run had already taken off it.
  const state = createRun(SEED, emptySave(), NONCE);
  for (const dir of TORCH_ROUTE.path) step(state, dir);
  assert(state.collected.size > 0, 'the walk picked something up');
  // A respawn moves the salt on, which is the half of it a stored nonce alone
  // would get wrong.
  respawn(state);
  step(state, TORCH_ROUTE.path[0] === 'left' ? 'right' : 'left');

  const back = resumeRun(suspendRun(state));
  assertEqual(back.salt, state.salt, 'the same salt, so the same scatter');
  assertEqual(back.biome, state.biome, 'the same kind of world, which the seed alone decides');
  assertEqual(back.epoch, state.epoch, 'however many times the world has been relaid');
  assertEqual([...back.collected].sort(), [...state.collected].sort(), 'and the tiles it emptied');

  let differed = 0;
  let items = 0;
  for (let y = -20; y <= 20; y++)
    for (let x = -20; x <= 20; x++) {
      const was = itemOnTile(state, x, y);
      if (was) items += 1;
      if (was !== itemOnTile(back, x, y)) differed += 1;
    }
  assert(items > 0, 'there is something out there to get wrong');
  assertEqual(differed, 0, 'every item is exactly where the run left it');
});

unit('ending an expedition takes the saved one with it, whichever way it ends', () => {
  const state = createRun(SEED, emptySave(), NONCE);
  for (const dir of ['right', 'right']) step(state, dir);

  // The hut: the walk is over because it came home (DESIGN.md §6.1).
  assertEqual(bankRun(state).run, null, 'banking at the hut clears the saved walk');
  // Thirst: the walk is over because it died. A save you could reload out of
  // would make the game's one hard failure a rewind.
  assertEqual(abandonRun(state).run, null, 'and so does running dry');
  // Leaving is the one that clears nothing — not saving is not unsaving — but
  // that needs a real slot to leave a save in, so it is asserted in the browser.
  // What is checkable here is the other end of the same rule: a slot with
  // nothing suspended simply has nothing to carry on with.
  assertEqual(hasSuspendedRun(emptySave()), false, 'an untouched slot has nothing to resume');
  assertEqual(resumeRun(emptySave()), null, 'and nothing to resume it from');
});

// --- The hall, and what a cycle is -------------------------------------------

// A campaign that has done everything the world it is in has to offer: three
// colours banked, every key in hand, both tools carried home, a purse, and a
// drawing of everywhere it walked.
const finishedCampaign = () => ({
  ...emptySave(),
  seed: SEED,
  gems: MAX_GEMS,
  keys: ALL_KEYS_LIST,
  chests: [KEY_CHEST.id],
  coins: 120,
  runs: 7,
  compass: true,
  map: true,
  mapped: encodeExplored(new Set(['40,40', '41,40'])),
  mappedSeed: SEED,
  seen: [KEY_CHEST.id],
});

unit('the hall takes everything you carried and leaves only the tally', () => {
  const state = createRun(SEED, finishedCampaign(), NONCE);
  state.coins = 30; // still in the pocket when he took everything else
  const walked = state.explored.size;

  const next = turnCycle(state);

  // A new world in the same slot, which is the whole of what a cycle is
  // (DESIGN.md §4.9): everything about the ground falls out of the seed, so
  // re-drawing it is the whole re-mould.
  assert(next.seed !== SEED, 'he moulds a world that is not the one you walked');
  assertEqual(next.banked.cycles, 1, 'and the slot counts it');
  assertEqual(next.cycles, 1, 'so the run can say so');

  // What he takes: the colours, the keys, the lids you left up, the ground,
  // and now the purse and both tools with them.
  assertEqual(next.gems, 0, 'the colours are his');
  assertEqual([...next.keys], [], 'and the keys with them');
  assertEqual([...next.chests], [], 'and every chest is shut again');
  assertEqual(next.banked.mapped, '', 'the drawing goes with the ground it was of');
  assertEqual([...next.seenUnique].filter((id) => id === KEY_CHEST.id), [],
    'and nothing in the old world is still marked');
  assert(next.explored.size < walked, 'the new world opens black but for the light in hand');
  assertEqual(next.banked.coins, 0, 'the purse, banked and pocketed alike, is gone');
  assertEqual([...next.tools], [], 'and so are both tools');

  // What he leaves: only the tally of the campaign itself.
  assertEqual(next.banked.runs, 8, 'the walk into the hall counted as an expedition');

  // And it is a fresh walk out of the hut door, not a death: full tank, a
  // candle, and the character standing where every run starts.
  assertEqual({ x: next.x, y: next.y }, { x: BASE_X, y: BASE_Y + 1 }, 'back at your own door');
  assertEqual(next.water, maxWater(0), 'with the tank full');
  assertEqual(next.inventory.length, 1, 'and one light');
  assertEqual(next.banked.run, null, 'a walk suspended in the old world is not a walk any more');

  // And the count survives the next walk home, which rebuilds the slot from
  // scratch the same way this did — the two places a save is written out by
  // hand are the two places a number like this goes missing.
  step(next, 'up');
  assertEqual(bankRun(next).cycles, 1, 'and the hut writes the count back down');
});

unit('finishing a world is what he counts, and it survives the world going', () => {
  // A walk into the hall carrying every colour is what finishes a *kind* of
  // world (DESIGN.md §4.9). It goes into the slot like a standing does — the
  // ground it happened on is gone, the fact of it is not.
  const state = createRun(SEED, finishedCampaign(), NONCE);
  const next = turnCycle(state);

  assertEqual(next.banked.finished, [BIOME], 'the kind of world walked out is written down');
  assertEqual([...next.finished], [BIOME], 'and the run he hands back is holding it');
  assert(next.biome !== BIOME || BIOME_IDS.length === 1,
    'and what he moulds next is a kind you have not finished');

  // And it survives the next walk home, which rebuilds the slot from scratch the
  // same way the cycle did — the two places a save is written out by hand.
  step(next, 'up');
  assertEqual(bankRun(next).finished, [BIOME], 'the hut writes it back down');
});

unit('arriving one colour short is still a meeting and still finishes nothing', () => {
  // The walk is what counts, not the arrival: he takes what you have, moulds
  // the world anyway, and the kind of world you were in is still unfinished
  // (DESIGN.md §4.9) — which is what stops the ending being a formality.
  const state = createRun(SEED, { ...finishedCampaign(), gems: MAX_GEMS - 1 }, NONCE);
  const next = turnCycle(state);
  assertEqual(next.banked.finished, [], 'nothing was finished');
  assertEqual(next.banked.cycles, 1, 'but the world went all the same');
});

unit('a cheat run gets its new world and still writes nothing', () => {
  // The switch exists to look at the late game without walking to it
  // (DESIGN.md §6.2), so the hall has to work under it — and, like everything
  // else a cheat run does, count for nothing.
  const state = createRun(SEED, emptySave(), NONCE, { cheats: true });
  const next = turnCycle(state);
  assert(next.seed !== SEED, 'the world is moulded anyway');
  assertEqual(next.cheats, true, 'and is still a sandbox');
  assertEqual(next.cycles, 0, 'but no cycle was ever written down');
  assertEqual(next.gems, MAX_GEMS, 'and it opens holding everything, like any cheat run');
});

unit('a corrupt suspended run costs the walk, not the campaign', () => {
  const campaign = { ...emptySave(), coins: 30, gems: 1, runs: 2 };
  for (const bad of [undefined, null, 'nonsense', 42, {}, { x: 4, y: 2 }]) {
    const save = normaliseSave({ ...campaign, run: bad });
    assertEqual(save.run, null, `a run block of ${JSON.stringify(bad)} is simply not a run`);
    assertEqual(save.coins, 30, 'and the campaign around it is untouched');
  }

  // A run block that is *nearly* right is clamped rather than dropped, the same
  // way the campaign's own numbers are.
  const messy = normaliseSave({
    ...campaign,
    run: {
      seed: SEED,
      x: 3.7,
      y: -2,
      facing: 'sideways',
      water: -50,
      gems: 99,
      activeIndex: 9,
      tools: ['compass', 'jetpack'],
      inventory: [{ id: 'coin', durability: 3 }, { id: 'torch-small', durability: 9999 }],
      banked: { coins: 30, run: { seed: SEED } },
    },
  }).run;
  assertEqual(messy.x, 3, 'a fractional coordinate is a whole one');
  assertEqual(messy.facing, 'up', 'and a facing that is not one of the four is the default');
  assertEqual(messy.water, 1, 'water never resumes at zero — that run could not move');
  assertEqual(messy.gems, MAX_GEMS, 'gems clamp to the ones the game has');
  assertEqual(messy.tools, ['compass'], 'only tools that exist');
  assertEqual(
    messy.inventory,
    [{ id: 'torch-small', durability: ITEMS['torch-small'].maxDurability }],
    'only lights, and only as much burn as a light can hold'
  );
  assertEqual(messy.activeIndex, 0, 'lighting one it is actually carrying');
  assertEqual(messy.banked.run, null, 'and a save nested inside a save stops there');
});

runIfMain(import.meta.url);
