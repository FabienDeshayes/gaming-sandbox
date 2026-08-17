// The item card: an overlay opened from an inventory slot showing what an item
// is, how much of it is left, and what it does (DESIGN.md §7).
//
// Opening one costs no step — the game is turn-based on movement only.

import { FONT, GAME_HEIGHT, GAME_WIDTH, getPalette, hex } from '../config.js';
import { makeButton } from './button.js';
import { makeScrollable } from './scroll.js';

const PANEL_W = 380;
const PANEL_H = 340;
// A stack of more than one copy trades the single durability bar + EQUIP
// button for a scrollable list, one row per copy — durability rarely matches
// across copies, so the choice of *which* one to equip has to be visible.
const MULTI_PANEL_H = 460;
const ROW_H = 40;
// Three rows' worth — the list has to end well short of the panel's own
// bottom edge, since (like the single-copy EQUIP/CLOSE row) the buttons below
// it are drawn outside the border, not inside it.
const LIST_H = 120;

export class ItemCard {
  constructor(scene, { onEquip }) {
    this.scene = scene;
    this.onEquip = onEquip;
    this.open = false;
    this.container = scene.add.container(0, 0).setVisible(false).setDepth(100);
    this.scrollHandle = null;
  }

  isOpen() {
    return this.open;
  }

  // `stack` is { def, instances }. `instances` is a list of
  // { index, durability, isActive } — one per copy carried, in pickup order —
  // and is absent for the coin card, which is opened from the HUD counter.
  // `index` is the copy's position in the flat run.inventory array, which is
  // what `equip` addresses by.
  show(stack) {
    const { def, instances } = stack;
    const pal = getPalette();
    const scene = this.scene;
    this.container.removeAll(true);
    if (this.scrollHandle) {
      this.scrollHandle.destroy();
      this.scrollHandle = null;
    }
    const multi = def.isLight && instances && instances.length > 1;
    const panelH = multi ? MULTI_PANEL_H : PANEL_H;

    // A full-screen backdrop that also swallows taps: anywhere outside the panel closes.
    const backdrop = scene.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, pal.bg, 0.88)
      .setOrigin(0)
      .setInteractive();
    backdrop.on('pointerdown', () => this.hide());

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2 - 40;

    const panel = scene.add.graphics();
    panel.fillStyle(pal.bg, 1);
    panel.fillRect(cx - PANEL_W / 2, cy - panelH / 2, PANEL_W, panelH);
    panel.lineStyle(2, pal.fg, 1);
    panel.strokeRect(cx - PANEL_W / 2, cy - panelH / 2, PANEL_W, panelH);
    // Taps on the panel itself must not reach the backdrop and close the card.
    const panelZone = scene.add
      .zone(cx, cy, PANEL_W, panelH)
      .setOrigin(0.5)
      .setInteractive();
    panelZone.on('pointerdown', (p, x, y, event) => event.stopPropagation());

    const title = scene.add
      .text(cx, cy - panelH / 2 + 26, def.name, {
        fontFamily: FONT,
        fontSize: '20px',
        color: hex(pal.fg),
      })
      .setOrigin(0.5);

    const sprite = scene.add.image(cx, cy - 64, def.sprite).setScale(6).setTint(pal.fg);

    const parts = [backdrop, panel, panelZone, title, sprite];

    // A single copy — including the coin card, which never has instances at
    // all — shows one durability bar and one EQUIP button, same as always.
    const single = def.isLight && instances && instances.length === 1 ? instances[0] : null;

    let y = cy + 16;
    if (single) {
      const value = `${single.durability} / ${def.maxDurability}`;
      parts.push(
        scene.add
          .text(cx, y, `DURABILITY  ${value}`, {
            fontFamily: FONT,
            fontSize: '16px',
            color: hex(pal.fg),
          })
          .setOrigin(0.5)
      );

      const barW = 260;
      const filled = Math.max(0, single.durability / def.maxDurability);
      const bar = scene.add.graphics();
      bar.lineStyle(2, pal.fg, 1);
      bar.strokeRect(cx - barW / 2, y + 18, barW, 12);
      bar.fillStyle(pal.fg, 1);
      bar.fillRect(cx - barW / 2 + 2, y + 20, (barW - 4) * filled, 8);
      parts.push(bar);
      y += 48;
    }

    parts.push(
      scene.add
        .text(cx, y + 6, def.effect, {
          fontFamily: FONT,
          fontSize: '14px',
          color: hex(pal.fg),
          align: 'center',
          wordWrap: { width: PANEL_W - 48 },
        })
        .setOrigin(0.5, 0)
    );

    // Several copies: durability rarely matches between them, so instead of
    // one bar there's a scrollable list — one row per copy — and tapping a
    // row equips that specific copy directly, since that's the whole point of
    // opening the list rather than just tapping EQUIP on the stack.
    if (multi) {
      const listW = PANEL_W - 64;
      const listX = cx - listW / 2;
      const listY = cy + 88;

      const content = scene.add.container(0, 0);
      instances.forEach((inst, i) => {
        const top = i * ROW_H;
        const filled = Math.max(0, inst.durability / def.maxDurability);
        const barW = listW - 96;

        const label = scene.add.text(
          0,
          top + 4,
          `${inst.durability} / ${def.maxDurability}${inst.isActive ? '  EQUIPPED' : ''}`,
          { fontFamily: FONT, fontSize: '13px', color: hex(pal.fg) }
        );
        const bar = scene.add.graphics();
        bar.lineStyle(2, pal.fg, 1);
        bar.strokeRect(0, top + 22, barW, 10);
        bar.fillStyle(pal.fg, 1);
        bar.fillRect(2, top + 24, (barW - 4) * filled, 6);
        const divider = scene.add.graphics();
        divider.lineStyle(1, pal.fg, 0.25);
        divider.lineBetween(0, top + ROW_H, listW, top + ROW_H);

        content.add([label, bar, divider]);
      });

      this.scrollHandle = makeScrollable(scene, content, {
        x: listX,
        y: listY,
        width: listW,
        height: LIST_H,
        contentHeight: instances.length * ROW_H,
        onTap: (localY) => {
          const inst = instances[Math.floor(localY / ROW_H)];
          if (!inst) return;
          this.onEquip(inst.index);
          this.hide();
        },
      });
      // The scroll zone must land in `parts` (and so in the container) after
      // `panelZone` — Phaser's default `topOnly` input hands a pointer event
      // to a single game object, and without this the wider, earlier-added
      // panelZone underneath it would win every tap and drag in the list.
      parts.push(content, this.scrollHandle.zone);
    }

    const buttonY = cy + panelH / 2 + 44;
    if (single) {
      const equip = makeButton(
        scene,
        cx - 96,
        buttonY,
        single.isActive ? 'EQUIPPED' : 'EQUIP',
        () => {
          this.onEquip(single.index);
          this.hide();
        },
        { width: 160, height: 44, enabled: !single.isActive }
      );
      parts.push(equip);
    }

    parts.push(
      makeButton(scene, single ? cx + 96 : cx, buttonY, 'CLOSE', () => this.hide(), {
        width: 160,
        height: 44,
      })
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
