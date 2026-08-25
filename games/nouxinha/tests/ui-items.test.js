// What a run is carrying and how it is read: the HUD's counters, the item card
// that explains each one, the panel that lists the lot, and the loop the whole
// game is made of — find a light, choose to burn it, watch the dark give way.
//
// A stacking badge and a scrolling list are widgets, not rules, and proving they
// work means collecting four copies of the same torch: sixty-odd taps of a real
// browser for a claim about a scrollbar. Those belong nowhere.

import { assert, assertEqual, runIfMain } from './harness.js';
import { visibleTiles } from '../src/core/light.js';
import { blocksSight } from '../src/core/world.js';
import { ITEMS } from '../src/data/items.js';
import { CARD, HUD, INVENTORY, ITEM_TEXT } from '../src/text.js';
import { SEED, TORCH_ROUTE, standingAt, test, walkPath } from './world.js';

// What a light shows where the route ends, worked out against the real world
// rather than written down: a shape is only its own tile count where nothing
// stands in the way of it (DESIGN.md §4.1).
const showsAt = (id, { x, y }, facing) =>
  visibleTiles(ITEMS[id].shape, x, y, facing, (px, py) => blocksSight(px, py, SEED, null)).length;
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

// Standing one step short of the nearest medium torch. The walk out to it is
// twenty taps and proves nothing this test is about — that the route exists at
// all is `scatter.test.js`, purely.
const FIND_TORCH = standingAt(TORCH_ROUTE, { back: 1 });

test('finding a torch, equipping it, and the light growing is the whole loop', async (game) => {
  await game.startRun();
  await walkPath(game, FIND_TORCH.path);

  let state = await game.state();
  assertEqual(state.inventory.length, 2, 'the torch was picked up');
  assertEqual(state.inventory[1].id, 'torch-medium', 'which torch');
  // A found light arrives unequipped: choosing when to burn the better one is
  // the decision the game is made of (DESIGN.md §4.1), so it is never made for
  // you.
  assertEqual(state.activeIndex, 0, 'a found light arrives unequipped');
  assertEqual(
    (await game.visibleTiles()).filter((t) => t.alpha === 1).length,
    showsAt('torch-small', TORCH_ROUTE, lastStep),
    'and the lit area is still the small torch it walked in on'
  );
  assert((await game.sounds()).includes('pickup'), 'picking the torch up blipped');

  // The panel is the only way to browse past the four-slot strip, and tapping
  // a row is the way into that item's card.
  await game.tapInventory();
  assertEqual((await game.state()).inventoryOpen, true, 'the panel is open');
  assert(await game.hasText(INVENTORY.title), 'panel title');
  assert(await game.hasText(ITEM_TEXT['torch-small'].name), 'listing the torch it set out with');
  assert(await game.hasText(ITEM_TEXT['torch-medium'].name), 'and the one it just found');
  await game.tapInventoryRow(1);
  state = await game.state();
  assertEqual(state.inventoryOpen, false, 'tapping a row closes the panel');
  assertEqual(state.cardOpen, true, "and opens that item's card");

  await game.clickText(CARD.equip);
  state = await game.state();
  assertEqual(state.activeIndex, 1, 'the medium torch is equipped');
  assertEqual((await game.sounds()).slice(-1)[0], 'torch', 'and it is heard catching');
  assertEqual(
    (await game.visibleTiles()).filter((t) => t.alpha === 1).length,
    showsAt('torch-medium', TORCH_ROUTE, lastStep),
    'the lit shape grew to radius 2'
  );
}, { save: FIND_TORCH.save });

runIfMain(import.meta.url);
