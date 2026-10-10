// The mobile layout's bottom panel: a row of tabs over one shared area, each
// tab showing its own group of things (the readout, the inspector, the test
// run, the saved machines). A group holds game objects, buttons (whose panel
// goes with them) and views with a `setShown(on)` of their own; hidden things
// take no input, since Phaser only hit-tests what it would draw.

import { COLORS } from '../config.js';
import { createButton } from './button.js';

export class PanelTabs {
  // opts: { y (the tab row), panel: { x, y, w, h }, tabs: [{ key, label }], active, onChange(key) }
  constructor(scene, opts) {
    this.scene = scene;
    this.opts = opts;
    this.active = opts.active ?? opts.tabs[0].key;
    this.groups = Object.fromEntries(opts.tabs.map((t) => [t.key, []]));
    const { x, y, w, h } = opts.panel;
    const g = scene.add.graphics().setDepth(0);
    g.fillStyle(COLORS.panelHex, 1);
    g.lineStyle(2, COLORS.panelEdgeHex, 1);
    g.fillRoundedRect(x, y, w, h, 10);
    g.strokeRoundedRect(x, y, w, h, 10);

    const gap = 6;
    const tw = (w - gap * (opts.tabs.length - 1)) / opts.tabs.length;
    this.buttons = opts.tabs.map((tab, i) => {
      const b = createButton(scene, x + i * (tw + gap) + tw / 2, opts.y, tab.label, () => this.set(tab.key), {
        fontSize: 14,
        padX: 4,
        padY: 6,
        width: tw,
      });
      return { key: tab.key, button: b };
    });
    this.paint();
  }

  add(key, ...items) {
    this.groups[key].push(...items);
    this.apply();
  }

  shown(key) {
    return this.active === key;
  }

  set(key) {
    if (key === this.active) return;
    this.active = key;
    this.apply();
    this.opts.onChange?.(key);
  }

  paint() {
    for (const { key, button } of this.buttons) button.setBaseFill(key === this.active ? COLORS.selectedHex : COLORS.buttonHex);
  }

  apply() {
    this.paint();
    for (const [key, items] of Object.entries(this.groups)) {
      const on = key === this.active;
      for (const item of items) setShown(item, on);
    }
  }
}

export function setShown(item, on) {
  if (item.setShown) item.setShown(on);
  else {
    item.setVisible(on);
    item.panel?.setVisible(on);
  }
}
