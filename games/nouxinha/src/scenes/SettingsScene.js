// Settings: the palette grid, the music and cheat switches, and the
// move-speed slider. Each palette swatch is drawn in its *own* palette
// rather than the active one, so the grid shows you the four combinations
// instead of describing them.

import {
  FONT,
  GAME_WIDTH,
  MAX_MOVE_SPEED,
  MIN_MOVE_SPEED,
  PALETTES,
  getCheats,
  getMoveSpeed,
  getMusic,
  getPalette,
  hex,
  setCheats,
  setMoveSpeed,
  setMusic,
  setPalette,
} from '../config.js';
import { ensureTextures, preloadTiles } from '../ui/textures.js';
import { makeButton } from '../ui/button.js';
import { makeSlider } from '../ui/slider.js';
import { playTap } from '../ui/sfx.js';
import { startMusic, stopMusic } from '../ui/music.js';

// The four palettes sit two to a row rather than stacked, so picking one
// doesn't eat most of the screen's height on its own.
const COLS = 2;
const CELL_W = 182;
const CELL_H = 68;
const CELL_GAP_X = 16;
const CELL_GAP_Y = 14;
const GRID_W = COLS * CELL_W + (COLS - 1) * CELL_GAP_X;
const FIRST_ROW_Y = 168;

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

    // The menu loop, the same one the title screen and the slot picker play —
    // asking for the track already playing doesn't restart it (ui/music.js), so
    // walking between the menus is one continuous tune.
    startMusic('menu');

    this.add
      .text(cx, 100, 'SETTINGS', { fontFamily: FONT, fontSize: '28px', color: hex(pal.fg) })
      .setOrigin(0.5);

    const gridLeft = cx - GRID_W / 2;
    PALETTES.forEach((option, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = gridLeft + col * (CELL_W + CELL_GAP_X);
      const y = FIRST_ROW_Y + row * (CELL_H + CELL_GAP_Y);
      const active = option.id === pal.id;

      const swatch = this.add.graphics();
      swatch.fillStyle(option.bg, 1);
      swatch.fillRect(x, y, CELL_W, CELL_H);
      // Same 2px outline the other buttons draw (ui/button.js) — the palette
      // cells used a 1px line that only rounded to a whole pixel on some of
      // the four swatches, so it rendered crisp on some and all but vanished
      // on others depending on where the grid happened to land it.
      swatch.lineStyle(2, option.fg, 1);
      swatch.strokeRect(x, y, CELL_W, CELL_H);

      this.add.image(x + 30, y + CELL_H / 2, 'wizard-down').setScale(1.8).setTint(option.fg);

      this.add
        .text(x + 52, y + CELL_H / 2, option.name, {
          fontFamily: FONT,
          fontSize: '14px',
          color: hex(option.fg),
        })
        .setOrigin(0, 0.5);

      if (active)
        this.add
          .text(x + CELL_W - 10, y + 10, 'ON', {
            fontFamily: FONT,
            fontSize: '11px',
            color: hex(option.fg),
          })
          .setOrigin(1, 0.5);

      const zone = this.add.zone(x, y, CELL_W, CELL_H).setOrigin(0).setInteractive({ useHandCursor: true });
      // Fire on release, not on touch-down (see ui/button.js) — pointerdown
      // here is what made a cell sometimes eat a tap and need a second one.
      let pressed = false;
      zone.on('pointerdown', () => {
        pressed = true;
        playTap();
      });
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
      396,
      musicLabel(getMusic()),
      () => {
        const on = setMusic(!getMusic());
        music.setLabel(musicLabel(on));
        if (on) startMusic('menu');
        else stopMusic();
      },
      { width: 300, fontSize: 14 }
    );

    // How fast holding a D-pad arrow walks (DESIGN.md §7, dpad.js) — a slider
    // rather than a fixed rate, since "fast" is a matter of taste and thumb
    // speed both.
    makeSlider(this, cx, 476, {
      width: 300,
      min: MIN_MOVE_SPEED,
      max: MAX_MOVE_SPEED,
      value: getMoveSpeed(),
      label: (v) => `MOVE SPEED: ${v}/s`,
      onChange: (v) => setMoveSpeed(v),
    });

    // The cheat switch (DESIGN.md §6.2): a run started with it on opens with the
    // map revealed and one of everything, which is how the late game gets looked
    // at without a campaign's worth of walking behind it. It says what it costs
    // on the button itself, because a run under it banks nothing at all.
    const cheats = makeButton(
      this,
      cx,
      566,
      cheatLabel(getCheats()),
      () => {
        const on = setCheats(!getCheats());
        cheats.setLabel(cheatLabel(on));
        note.setText(cheatNote(on)).setAlpha(on ? 0.8 : 0.5);
      },
      { width: 300, fontSize: 14 }
    );
    const note = this.add
      .text(cx, 606, cheatNote(getCheats()), {
        fontFamily: FONT,
        fontSize: '11px',
        color: hex(pal.fg),
      })
      .setOrigin(0.5)
      .setAlpha(getCheats() ? 0.8 : 0.5);

    makeButton(this, cx, 696, 'BACK', () => this.scene.start('TitleScene'), { width: 240 });
  }
}

function musicLabel(on) {
  return `MUSIC: ${on ? 'ON' : 'OFF'}`;
}

function cheatLabel(on) {
  return `CHEATS: ${on ? 'ON' : 'OFF'}`;
}

function cheatNote(on) {
  return on
    ? 'WHOLE MAP REVEALED, ONE OF EVERYTHING. NOTHING SAVES.'
    : 'REVEALS THE MAP AND HANDS YOU EVERY ITEM.';
}
