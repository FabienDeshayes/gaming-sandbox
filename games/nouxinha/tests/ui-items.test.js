// The HUD's counters, the item card and the inventory panel: what a run is
// carrying and how it is browsed. Each test drives a fresh page against the
// real canvas.

import { assert, assertEqual, runIfMain } from './harness.js';
import { visibleTiles } from '../src/core/light.js';
import { blocksSight } from '../src/core/world.js';
import { ITEMS } from '../src/data/items.js';
import { CARD, HUD, INVENTORY, ITEM_TEXT } from '../src/text.js';
import { MEDIUM_TORCH_COPIES, SEED, TORCH_ROUTE, mediumTorchChain, test, walkPath } from './world.js';

// What a light shows where the route ends, worked out against the real world
// rather than written down: a shape is only its own tile count where nothing
// stands in the way of it (DESIGN.md §4.1).
const showsAt = (id, { x, y }, facing) =>
  visibleTiles(ITEMS[id].shape, x, y, facing, (px, py) => blocksSight(px, py, SEED, 0)).length;
// The way the walk left the character looking — only a cone cares, but the
// shape is asked the same question the run asks it.
const lastStep = TORCH_ROUTE.path[TORCH_ROUTE.path.length - 1];

test('every counter and slot opens the card that explains it', async (game) => {
  await game.startRun();

  await game.tapSlot(0);
  assert(await game.hasText(ITEM_TEXT['torch-small'].name), 'the item name');
  assert(await game.hasText(CARD.durability(100, 100)), 'durability readout');
  assert(await game.hasText(ITEMS['torch-small'].effect), 'effect text');
  assert(await game.hasText(CARD.equipped), 'the active light reads as equipped');
  assertEqual((await game.state()).cardOpen, true, 'card is open');
  await game.clickText(CARD.close);
  assertEqual((await game.state()).cardOpen, false, 'card is closed');

  await game.tapCoins();
  assert(await game.hasText(ITEMS.coin.effect), 'the coin counter opens the coin card');
  await game.clickText(CARD.close);

  await game.tapWater();
  assert(await game.hasText(ITEM_TEXT['water-drop'].name), 'and the water counter opens the water card');
  assert(await game.hasText(ITEMS['water-drop'].effect), 'effect text');
  await game.clickText(CARD.close);
  assertEqual((await game.state()).cardOpen, false, 'card is closed');
});

test('the HUD tracks water down as you walk', async (game) => {
  await game.startRun();
  assert(await game.hasText(HUD.water(200, 200)), 'starts full');

  await game.tapDpad('right');
  await game.settle();
  assert(await game.hasText(HUD.water(199, 200)), 'a step burns one water, same as durability');
  assertEqual((await game.state()).water, 199, 'the model agrees');
});

test('finding a torch and equipping it widens the light', async (game) => {
  await game.startRun();
  await walkPath(game, TORCH_ROUTE.path);

  let state = await game.state();
  assertEqual(state.inventory.length, 2, 'the torch was picked up');
  assertEqual(state.inventory[1].id, 'torch-medium', 'which torch');
  assertEqual(state.activeIndex, 0, 'a found light arrives unequipped');
  assertEqual(
    (await game.visibleTiles()).filter((t) => t.alpha === 1).length,
    showsAt('torch-small', TORCH_ROUTE, lastStep),
    'still radius 1'
  );
  assert((await game.sounds()).includes('pickup'), 'picking the torch up blipped');

  await game.tapSlot(1);
  await game.clickText(CARD.equip);

  state = await game.state();
  assertEqual(state.activeIndex, 1, 'the medium torch is equipped');
  assertEqual((await game.sounds()).slice(-1)[0], 'torch', 'and it is heard catching');
  assertEqual(
    (await game.visibleTiles()).filter((t) => t.alpha === 1).length,
    showsAt('torch-medium', TORCH_ROUTE, lastStep),
    'the lit shape grew to radius 2'
  );
});

test('two of the same torch stack into one slot, and the panel lists every stack', async (game) => {
  await game.startRun();
  for (const leg of mediumTorchChain().slice(0, 2)) await walkPath(game, leg);

  assertEqual((await game.state()).inventory.length, 3, 'small torch plus two mediums');
  assert(await game.hasText(HUD.stackCount(2)), 'the medium torch slot is badged with its count');

  // The strip still only shows one slot for the stack, and it opens one card.
  await game.tapSlot(1);
  assertEqual((await game.state()).cardOpen, true, 'the stack opens one card');
  assert(await game.hasText(ITEM_TEXT['torch-medium'].name), "the stacked item's name");
  await game.clickText(CARD.close);

  // ITEMS opens the full list, which is the only way to browse past the strip.
  await game.tapInventory();
  assertEqual((await game.state()).inventoryOpen, true, 'the panel is open');
  assert(await game.hasText(INVENTORY.title), 'panel title');
  assert(await game.hasText(ITEM_TEXT['torch-small'].name), 'lists the small torch stack');
  assert(await game.hasText(INVENTORY.carrying(2)), 'and the medium stack shows its count');

  await game.tapInventoryRow(1);
  const state = await game.state();
  assertEqual(state.inventoryOpen, false, 'tapping a row closes the panel');
  assertEqual(state.cardOpen, true, "and opens that stack's item card");
  assert(await game.hasText(ITEM_TEXT['torch-medium'].name), "the right stack's card");
});

test('a multi-copy item card lists every instance and equips exactly the one tapped', async (game) => {
  await game.startRun();
  for (const leg of mediumTorchChain()) await walkPath(game, leg);

  let state = await game.state();
  assertEqual(state.inventory.length, MEDIUM_TORCH_COPIES + 1, 'small torch plus every medium');

  await game.tapSlot(1);
  assertEqual(
    (await game.texts()).filter((t) => t === '50 / 50').length,
    MEDIUM_TORCH_COPIES,
    'every copy is listed, even though only a few show at once'
  );

  const before = await game.scrollContentY();
  // Drag well past what the list can scroll, to also prove it clamps rather
  // than running the content off past its last row.
  await game.dragCardList(-200);
  const after = await game.scrollContentY();
  assert(after < before, 'the list scrolled');
  assertEqual(
    before - after,
    MEDIUM_TORCH_COPIES * 40 - 120,
    'scroll clamps to the content height, not the drag distance'
  );

  // With the list scrolled all the way down, the bottom of the three visible
  // rows (visual slot 2) is now the last copy picked up — tapping it should
  // equip that exact copy, not whichever one happened to occupy that screen
  // position before scrolling.
  await game.tapCardInstance(2);
  state = await game.state();
  const last = MEDIUM_TORCH_COPIES; // the small torch holds flat index 0
  assertEqual(state.cardOpen, false, 'tapping an instance closes the card');
  assertEqual(state.activeIndex, last, 'the last copy picked up is now equipped');
  assertEqual(state.inventory[last].id, 'torch-medium', 'sanity: that slot really is a medium torch');
});

runIfMain(import.meta.url);
