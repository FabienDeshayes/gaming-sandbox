// The full inventory panel: opened from the HUD's ITEMS button. Lists every
// light stack the run is carrying — icon, name, and count — in a scrollable
// list, so a run isn't limited to what fits in the HUD strip's slots. Tapping
// a stack opens its item card (itemCard.js) for full per-copy detail.
//
// Opening it costs no step, the same as the item card and the hut dialog.

import { FONT, GAME_HEIGHT, GAME_WIDTH, getPalette, hex } from '../config.js';
import { itemDef } from '../data/items.js';
import { makeButton } from './button.js';
import { makeScrollable } from './scroll.js';

const PANEL_W = 380;
const PANEL_H = 460;
const ROW_H = 64;
const LIST_PAD = 20;

export class InventoryPanel {
  constructor(scene, { onOpenStack }) {
    this.scene = scene;
    this.onOpenStack = onOpenStack;
    this.open = false;
    this.container = scene.add.container(0, 0).setVisible(false).setDepth(100);
    this.scrollHandle = null;
  }

  isOpen() {
    return this.open;
  }

  // `stacks` is `inventoryStacks(run)` — see core/rules.js.
  show(stacks) {
    const pal = getPalette();
    const scene = this.scene;
    this.container.removeAll(true);
    if (this.scrollHandle) {
      this.scrollHandle.destroy();
      this.scrollHandle = null;
    }

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2 - 40;
    const left = cx - PANEL_W / 2;
    const top = cy - PANEL_H / 2;

    // A full-screen backdrop that also swallows taps: anywhere outside the panel closes.
    const backdrop = scene.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, pal.bg, 0.88)
      .setOrigin(0)
      .setInteractive();
    backdrop.on('pointerdown', () => this.hide());

    const panel = scene.add.graphics();
    panel.fillStyle(pal.bg, 1);
    panel.fillRect(left, top, PANEL_W, PANEL_H);
    panel.lineStyle(2, pal.fg, 1);
    panel.strokeRect(left, top, PANEL_W, PANEL_H);
    // Taps on the panel itself must not reach the backdrop and close it.
    const panelZone = scene.add.zone(cx, cy, PANEL_W, PANEL_H).setOrigin(0.5).setInteractive();
    panelZone.on('pointerdown', (p, x, y, event) => event.stopPropagation());

    const title = scene.add
      .text(cx, top + 26, 'INVENTORY', { fontFamily: FONT, fontSize: '20px', color: hex(pal.fg) })
      .setOrigin(0.5);

    const parts = [backdrop, panel, panelZone, title];

    const listX = left + LIST_PAD;
    const listY = top + 56;
    const listW = PANEL_W - LIST_PAD * 2;
    const listH = PANEL_H - 56 - 74;

    if (stacks.length === 0) {
      parts.push(
        scene.add
          .text(cx, top + listH / 2 + 56, 'NOTHING CARRIED.', {
            fontFamily: FONT,
            fontSize: '14px',
            color: hex(pal.fg),
          })
          .setOrigin(0.5)
      );
    } else {
      const content = scene.add.container(0, 0);
      stacks.forEach((stack, i) => {
        const def = itemDef(stack.id);
        const top2 = i * ROW_H;
        const midY = top2 + ROW_H / 2;
        const active = stack.instances.some((inst) => inst.isActive);

        const icon = scene.add.image(24, midY - 4, def.sprite).setScale(2.2).setTint(pal.fg);
        const name = scene.add.text(56, top2 + 10, def.name, {
          fontFamily: FONT,
          fontSize: '14px',
          color: hex(pal.fg),
        });
        const count = stack.instances.length > 1 ? `CARRYING ${stack.instances.length}` : 'CARRYING 1';
        const sub = scene.add.text(56, top2 + 32, active ? `${count} · EQUIPPED` : count, {
          fontFamily: FONT,
          fontSize: '11px',
          color: hex(pal.fg),
        });
        const divider = scene.add.graphics();
        divider.lineStyle(1, pal.fg, 0.25);
        divider.lineBetween(0, top2 + ROW_H, listW, top2 + ROW_H);

        content.add([icon, name, sub, divider]);
      });

      this.scrollHandle = makeScrollable(scene, content, {
        x: listX,
        y: listY,
        width: listW,
        height: listH,
        contentHeight: stacks.length * ROW_H,
        onTap: (localY) => {
          const stack = stacks[Math.floor(localY / ROW_H)];
          if (!stack) return;
          this.hide();
          this.onOpenStack(stack);
        },
      });
      // The scroll zone must land in `parts` (and so in the container) after
      // `panelZone` — Phaser's default `topOnly` input hands a pointer event
      // to a single game object, and without this the wider, earlier-added
      // panelZone underneath it would win every tap and drag in the list.
      parts.push(content, this.scrollHandle.zone);
    }

    parts.push(
      makeButton(scene, cx, top + PANEL_H - 38, 'CLOSE', () => this.hide(), { width: 160, height: 44 })
    );

    this.container.add(parts);
    this.container.setVisible(true);
    this.open = true;
  }

  hide() {
    if (this.scrollHandle) {
      this.scrollHandle.destroy();
      this.scrollHandle = null;
    }
    this.container.setVisible(false);
    this.container.removeAll(true);
    this.open = false;
  }
}
