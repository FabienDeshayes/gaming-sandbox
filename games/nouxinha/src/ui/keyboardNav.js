// Keyboard navigation shared by every screen with buttons on it (DESIGN.md §7):
// Tab or the arrow keys move a focus ring between them, Enter or Space
// activates whichever one has it. A slider captures Left/Right for its own
// value instead of letting them move the focus on — `adjust` below — since a
// slider is the one control here that isn't really a button.
//
// One of these is bound per scene, in `create()`. A screen with a fixed set
// of buttons (the title screen, the slot picker, Settings) hands them over
// once; a scene that opens overlays over itself (ExploreScene, over a dialog,
// the shop, the map) hands over each overlay's own buttons while it's open and
// clears them on the way out, so Tab only ever visits what a player can
// actually see. Escape stays each screen's own business — a plain dialog has
// no close control of its own (DESIGN.md §7), so it isn't wired in here.
export function bindKeyboardNav(scene) {
  let items = [];
  let index = -1;

  const enabledOrder = () => items.map((_, i) => i).filter((i) => items[i].isEnabled());

  const focus = (i) => {
    if (index >= 0 && items[index]) items[index].setFocused(false);
    index = i;
    if (index >= 0 && items[index]) items[index].setFocused(true);
  };

  const move = (delta) => {
    const order = enabledOrder();
    if (!order.length) return;
    const at = order.indexOf(index);
    focus(order[(at + delta + order.length) % order.length]);
  };

  // Left/Right adjusts a focused slider rather than moving off it — the same
  // split a native slider makes between arrowing through a value and tabbing
  // past the control entirely.
  const horizontal = (delta) => {
    const item = index >= 0 ? items[index] : null;
    if (item && item.adjust) item.adjust(delta);
    else move(delta);
  };

  scene.input.keyboard.on('keydown-TAB', (e) => {
    if (!items.length) return;
    e.preventDefault();
    move(e.shiftKey ? -1 : 1);
  });
  scene.input.keyboard.on('keydown-DOWN', () => items.length && move(1));
  scene.input.keyboard.on('keydown-UP', () => items.length && move(-1));
  scene.input.keyboard.on('keydown-RIGHT', () => items.length && horizontal(1));
  scene.input.keyboard.on('keydown-LEFT', () => items.length && horizontal(-1));

  const activate = () => {
    const item = index >= 0 ? items[index] : null;
    if (item && item.isEnabled() && item.activate) item.activate();
  };
  scene.input.keyboard.on('keydown-ENTER', activate);
  scene.input.keyboard.on('keydown-SPACE', activate);

  return {
    // Hands over the controls on screen, in tab order, and focuses the first
    // enabled one. Each one is `{ setFocused, isEnabled, activate }` — every
    // `makeButton` already is one — plus an optional `adjust(delta)` for a
    // slider.
    set(list) {
      if (index >= 0 && items[index]) items[index].setFocused(false);
      items = list;
      index = -1;
      const order = enabledOrder();
      if (order.length) focus(order[0]);
    },
    clear() {
      this.set([]);
    },
  };
}

// A focus ring for a control that isn't a `makeButton` — a slot-picker row, a
// shop's stock row — anything whose own hit area is a raw zone rather than
// the bordered box a button already draws one around.
export function makeFocusRing(scene, x, y, w, h, color) {
  const ring = scene.add.graphics().setVisible(false);
  ring.lineStyle(1, color, 0.9);
  ring.strokeRect(x + 3, y + 3, w - 6, h - 6);
  return ring;
}
