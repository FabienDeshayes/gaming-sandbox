// Palette picker, the music and cheat switches, and the one destructive control
// in the game. Each palette row is drawn in its *own* palette rather than the
// active one, so the list shows you the four combinations instead of describing
// them.

import {
  FONT,
  GAME_WIDTH,
  PALETTES,
  getCheats,
  getFloorBorder,
  getMusic,
  getPalette,
  hex,
  setCheats,
  setFloorBorder,
  setMusic,
  setPalette,
} from '../config.js';
import { activeSlot, clearSave, loadSave } from '../core/save.js';
import { ensureTextures, preloadTiles } from '../ui/textures.js';
import { makeButton } from '../ui/button.js';
import { startMusic, stopMusic } from '../ui/music.js';

const ROW_H = 68;
const ROW_W = 380;
const FIRST_ROW_Y = 176;

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super('SettingsScene');
  }

  preload() {
    preloadTiles(this);
  }

  create() {
    ensureTextures(this);
    const pal = getPalette();
    this.cameras.main.setBackgroundColor(pal.bg);
    const cx = GAME_WIDTH / 2;

    // Turning the music on here plays it, so the switch can be auditioned; the
    // loop belongs to the expedition, so leaving this screen ends it again.
    this.events.once('shutdown', () => stopMusic());

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

    // The music switch (DESIGN.md §9). It takes effect where it is tapped rather
    // than at the next run, because a player who has just turned the loop off
    // wants it to stop, and one who has just turned it on wants to hear what
    // they are agreeing to — Settings is the one screen that is otherwise quiet.
    const music = makeButton(
      this,
      cx,
      540,
      musicLabel(getMusic()),
      () => {
        const on = setMusic(!getMusic());
        music.setLabel(musicLabel(on));
        if (on) startMusic();
        else stopMusic();
      },
      { width: 300, fontSize: 14 }
    );

    // The floor border switch (DESIGN.md §9): the dotted line that used to be
    // the only thing marking a lit tile now sits on top of ground texture, so
    // turning it off costs the game nothing it doesn't already draw. Takes
    // effect on the next repaint, same as the palette does for a running map.
    const border = makeButton(
      this,
      cx,
      600,
      borderLabel(getFloorBorder()),
      () => {
        const on = setFloorBorder(!getFloorBorder());
        border.setLabel(borderLabel(on));
      },
      { width: 300, fontSize: 14 }
    );

    // The cheat switch (DESIGN.md §6.2): a run started with it on opens with the
    // map revealed and one of everything, which is how the late game gets looked
    // at without a campaign's worth of walking behind it. It says what it costs
    // on the button itself, because a run under it banks nothing at all.
    const cheats = makeButton(
      this,
      cx,
      660,
      cheatLabel(getCheats()),
      () => {
        const on = setCheats(!getCheats());
        cheats.setLabel(cheatLabel(on));
        note.setText(cheatNote(on)).setAlpha(on ? 0.8 : 0.5);
      },
      { width: 300, fontSize: 14 }
    );
    const note = this.add
      .text(cx, 694, cheatNote(getCheats()), {
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
      748,
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

    makeButton(this, cx, 812, 'BACK', () => this.scene.start('TitleScene'), { width: 240 });
  }
}

function musicLabel(on) {
  return `MUSIC: ${on ? 'ON' : 'OFF'}`;
}

function cheatLabel(on) {
  return `CHEATS: ${on ? 'ON' : 'OFF'}`;
}

function borderLabel(on) {
  return `TILE BORDER: ${on ? 'ON' : 'OFF'}`;
}

function cheatNote(on) {
  return on
    ? 'WHOLE MAP REVEALED, ONE OF EVERYTHING. NOTHING SAVES.'
    : 'REVEALS THE MAP AND HANDS YOU EVERY ITEM.';
}
