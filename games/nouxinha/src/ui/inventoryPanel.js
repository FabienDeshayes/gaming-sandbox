// The full inventory panel: opened from the HUD's ITEMS slot. Lists every
// light stack the run is carrying — icon, name, and count — in a scrollable
// list, so a run isn't limited to what fits in the HUD strip's slots. Tapping
// a stack opens its item card (itemCard.js) for full per-copy detail.
//
// It also carries the colour pips that used to live in the main HUD as a
// standing "COLOURS" row: how much of the world's colour is back only matters
// while looking at what you're carrying, not on every screen.
//
// Opening it costs no step, the same as the item card and the hut dialog.

import { FONT, GAME_HEIGHT, GAME_WIDTH, gemColour, getPalette, hex } from '../config.js';
import { itemDef } from '../data/items.js';
import { INVENTORY } from '../text.js';
import { inventoryStacks } from '../core/rules.js';
import { MAX_GEMS } from '../core/save.js';
import { makeButton } from './button.js';
import { playTap } from './sfx.js';
import { makeScrollable } from './scroll.js';

const PANEL_W = 380;
const PANEL_H = 460;
const ROW_H = 64;
const LIST_PAD = 20;
const GEM_GAP = 30;

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

  // `run` is the live run — the panel derives its own stacks and gem count
  // from it rather than being handed them piecemeal, since it draws both.
  show(run) {
    const pal = getPalette();
    const scene = this.scene;
    const stacks = inventoryStacks(run);
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
    backdrop.on('pointerdown', () => {
      playTap();
      this.hide();
    });

    const panel = scene.add.graphics();
    panel.fillStyle(pal.bg, 1);
    panel.fillRect(left, top, PANEL_W, PANEL_H);
    panel.lineStyle(2, pal.fg, 1);
    panel.strokeRect(left, top, PANEL_W, PANEL_H);
    // Taps on the panel itself must not reach the backdrop and close it.
    const panelZone = scene.add.zone(cx, cy, PANEL_W, PANEL_H).setOrigin(0.5).setInteractive();
    panelZone.on('pointerdown', (p, x, y, event) => event.stopPropagation());

    const title = scene.add
      .text(cx, top + 26, INVENTORY.title, { fontFamily: FONT, fontSize: '20px', color: hex(pal.fg) })
      .setOrigin(0.5);

    // The gem pips: one per gem, each in the colour it gave back, the rest
    // dimmed — the same read the HUD's old "COLOURS" row gave, just here
    // instead of standing on screen throughout a run.
    const gemY = top + 58;
    const gems = [];
    for (let i = 1; i <= MAX_GEMS; i++) {
      const held = i <= run.gems;
      gems.push(
        scene.add
          .image(cx + (i - (MAX_GEMS + 1) / 2) * GEM_GAP, gemY, 'gem')
          .setScale(1.4)
          .setTint(held ? gemColour(i) : pal.fg)
          .setAlpha(held ? 1 : 0.25)
      );
    }

    const parts = [backdrop, panel, panelZone, title, ...gems];

    const listX = left + LIST_PAD;
    const listY = top + 90;
    const listW = PANEL_W - LIST_PAD * 2;
    const listH = PANEL_H - 90 - 74;

    if (stacks.length === 0) {
      parts.push(
        scene.add
          .text(cx, top + listH / 2 + 56, INVENTORY.empty, {
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

        const icon = scene.add.image(24, midY - 4, def.sprite).setScale(2.2).setTint(gemColour(def.hue || 0));
        const name = scene.add.text(56, top2 + 10, def.name, {
          fontFamily: FONT,
          fontSize: '14px',
          color: hex(pal.fg),
        });
        const count = INVENTORY.carrying(stack.instances.length);
        const sub = scene.add.text(56, top2 + 32, active ? INVENTORY.equippedSuffix(count) : count, {
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
      makeButton(scene, cx, top + PANEL_H - 38, INVENTORY.close, () => this.hide(), { width: 160, height: 44 })
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
