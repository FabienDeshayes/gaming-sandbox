// Palette picker, the cheat switch, and the one destructive control in the
// game. Each palette row is drawn in its *own* palette rather than the active
// one, so the list shows you the four combinations instead of describing them.

import {
  FONT,
  GAME_WIDTH,
  PALETTES,
  getCheats,
  getPalette,
  hex,
  setCheats,
  setPalette,
} from '../config.js';
import { activeSlot, clearSave, loadSave } from '../core/save.js';
import { ensureTextures } from '../ui/textures.js';
import { makeButton } from '../ui/button.js';

const ROW_H = 68;
const ROW_W = 380;
const FIRST_ROW_Y = 176;

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super('SettingsScene');
  }

  create() {
    ensureTextures(this);
    const pal = getPalette();
    this.cameras.main.setBackgroundColor(pal.bg);
    const cx = GAME_WIDTH / 2;

    this.add
      .text(cx, 110, 'PALETTE', { fontFamily: FONT, fontSize: '28px', color: hex(pal.fg) })
      .setOrigin(0.5);

    PALETTES.forEach((option, i) => {
      const y = FIRST_ROW_Y + i * (ROW_H + 14);
      const active = option.id === pal.id;

      const swatch = this.add.graphics();
      swatch.fillStyle(option.bg, 1);
      swatch.fillRect(cx - ROW_W / 2, y, ROW_W, ROW_H);
      swatch.lineStyle(active ? 3 : 1, option.fg, 1);
      swatch.strokeRect(cx - ROW_W / 2, y, ROW_W, ROW_H);

      this.add
        .text(cx - ROW_W / 2 + 76, y + ROW_H / 2, option.name, {
          fontFamily: FONT,
          fontSize: '18px',
          color: hex(option.fg),
        })
        .setOrigin(0, 0.5);

      // A wizard and a rock in the row's own colours — the two things you spend
      // the most time looking at.
      this.add.image(cx - ROW_W / 2 + 38, y + ROW_H / 2, 'wizard-down').setScale(2.5).setTint(option.fg);
      this.add.image(cx + ROW_W / 2 - 44, y + ROW_H / 2, 'rock').setScale(2.5).setTint(option.fg);

      if (active)
        this.add
          .text(cx + ROW_W / 2 - 96, y + ROW_H / 2, 'ON', {
            fontFamily: FONT,
            fontSize: '14px',
            color: hex(option.fg),
          })
          .setOrigin(0.5);

      const zone = this.add
        .zone(cx - ROW_W / 2, y, ROW_W, ROW_H)
        .setOrigin(0)
        .setInteractive({ useHandCursor: true });
      // Fire on release, not on touch-down (see ui/button.js) — pointerdown
      // here is what made a row sometimes eat a tap and need a second one.
      let pressed = false;
      zone.on('pointerdown', () => (pressed = true));
      zone.on('pointerout', () => (pressed = false));
      zone.on('pointerup', () => {
        if (!pressed) return;
        pressed = false;
        setPalette(option.id);
        // Everything on screen was tinted at create time, so re-enter the scene
        // to repaint it in the palette just chosen.
        this.scene.restart();
      });
    });

    // The cheat switch (DESIGN.md §6.2): a run started with it on opens with the
    // map revealed and one of everything, which is how the late game gets looked
    // at without a campaign's worth of walking behind it. It says what it costs
    // on the button itself, because a run under it banks nothing at all.
    const cheats = makeButton(
      this,
      cx,
      588,
      cheatLabel(getCheats()),
      () => {
        const on = setCheats(!getCheats());
        cheats.setLabel(cheatLabel(on));
        note.setText(cheatNote(on)).setAlpha(on ? 0.8 : 0.5);
      },
      { width: 300, fontSize: 14 }
    );
    const note = this.add
      .text(cx, 622, cheatNote(getCheats()), {
        fontFamily: FONT,
        fontSize: '11px',
        color: hex(pal.fg),
      })
      .setOrigin(0.5)
      .setAlpha(getCheats() ? 0.8 : 0.5);

    // Erasing is the one destructive control here and it always means the slot
    // you last played, so it says which. Like the slot picker's overwrite, it
    // asks with itself: the first tap arms it, the second does it.
    const slot = activeSlot();
    const save = loadSave(slot);
    let armed = false;
    const erase = makeButton(
      this,
      cx,
      676,
      save.started ? `ERASE SLOT ${slot}` : `SLOT ${slot} IS EMPTY`,
      () => {
        if (!save.started) return;
        if (!armed) {
          armed = true;
          erase.setLabel('TAP AGAIN TO ERASE');
          return;
        }
        clearSave(slot);
        this.scene.restart();
      },
      { width: 300, fontSize: 14, enabled: !!save.started }
    );

    makeButton(this, cx, 744, 'BACK', () => this.scene.start('TitleScene'), { width: 240 });
  }
}

function cheatLabel(on) {
  return `CHEATS: ${on ? 'ON' : 'OFF'}`;
}

function cheatNote(on) {
  return on
    ? 'WHOLE MAP REVEALED, ONE OF EVERYTHING. NOTHING SAVES.'
    : 'REVEALS THE MAP AND HANDS YOU EVERY ITEM.';
}
