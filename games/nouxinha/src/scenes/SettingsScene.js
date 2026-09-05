// Settings: the music and cheat switches, the move-speed slider, and — for a
// player who has finished all four worlds — the switch that draws the game
// inside out (DESIGN.md §4.9). There is no palette picker here: a world's colour
// comes from its biome (§4.3, src/data/biomes.js), not from a choice a player
// makes.
//
// Reached from the title screen, and from the cogwheel menu mid-expedition
// (scenes/ExploreScene.js). In the second case the live run rides along in the
// scene data and goes straight back where it came from.

import {
  FONT,
  GAME_WIDTH,
  MAX_MOVE_SPEED,
  MIN_MOVE_SPEED,
  getCheats,
  getInvert,
  getMoveSpeed,
  getMusic,
  getPalette,
  hex,
  invertUnlocked,
  setCheats,
  setInvert,
  setMoveSpeed,
  setMusic,
} from '../config.js';
import { ensureTextures, preloadTiles } from '../ui/textures.js';
import { makeButton } from '../ui/button.js';
import { makeSlider } from '../ui/slider.js';
import { SETTINGS } from '../text.js';
import { startMusic, stopMusic } from '../ui/music.js';

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super('SettingsScene');
  }

  preload() {
    preloadTiles(this);
  }

  create(data) {
    ensureTextures(this);
    const pal = getPalette();
    this.cameras.main.setBackgroundColor(pal.bg);
    const cx = GAME_WIDTH / 2;
    // The expedition that opened Settings, if one did. Carried through so a
    // player lands back on the tile they were standing on.
    this.opened = data || {};

    // The menu loop, the same one the title screen and the slot picker play —
    // asking for the track already playing doesn't restart it (ui/music.js), so
    // walking between the menus is one continuous tune.
    startMusic('menu');

    this.add
      .text(cx, 140, SETTINGS.heading, { fontFamily: FONT, fontSize: '28px', color: hex(pal.fg) })
      .setOrigin(0.5);

    // The music switch (DESIGN.md §9). It takes effect where it is tapped rather
    // than at the next run, because a player who has just turned the loop off
    // wants it to stop, and one who has just turned it on wants to hear what
    // they are agreeing to — Settings is the one screen that is otherwise quiet.
    const music = makeButton(
      this,
      cx,
      320,
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
    makeSlider(this, cx, 420, {
      width: 300,
      min: MIN_MOVE_SPEED,
      max: MAX_MOVE_SPEED,
      value: getMoveSpeed(),
      label: (v) => SETTINGS.moveSpeed(v),
      onChange: (v) => setMoveSpeed(v),
    });

    // The cheat switch (DESIGN.md §6.2): a run started with it on opens with the
    // map revealed and one of everything, which is how the late game gets looked
    // at without a campaign's worth of walking behind it. It says what it costs
    // on the button itself, because a run under it banks nothing at all.
    const cheats = makeButton(
      this,
      cx,
      520,
      cheatLabel(getCheats()),
      () => {
        const on = setCheats(!getCheats());
        cheats.setLabel(cheatLabel(on));
        note.setText(cheatNote(on)).setAlpha(on ? 0.8 : 0.5);
        // Turning the cheats off takes the inversion with it, switch and all:
        // the switch lives under the cheats, and a screen drawn inside out with
        // nothing on it to undo that would be a trap rather than a setting.
        if (!on && getInvert()) setInvert(false);
        if (invertUnlocked()) this.scene.restart(this.opened);
      },
      { width: 300, fontSize: 14 }
    );
    const note = this.add
      .text(cx, 560, cheatNote(getCheats()), {
        fontFamily: FONT,
        fontSize: '11px',
        color: hex(pal.fg),
      })
      .setOrigin(0.5)
      .setAlpha(getCheats() ? 0.8 : 0.5);

    // What the ending left behind (DESIGN.md §4.9), and the one control on this
    // screen that isn't always here: the game drawn inside out, for a player who
    // has watched the sorcerer open his hands. It sits under the cheats and is
    // only on screen while they are on, because it is a way of looking at the
    // game rather than a way of playing it — and it takes effect where it is
    // tapped, which means drawing this screen again in the colours it just
    // chose.
    if (invertUnlocked() && getCheats()) {
      makeButton(
        this,
        cx,
        610,
        invertLabel(getInvert()),
        () => {
          setInvert(!getInvert());
          this.scene.restart(this.opened);
        },
        { width: 300, fontSize: 14 }
      );
      this.add
        .text(cx, 648, SETTINGS.invertNote, {
          fontFamily: FONT,
          fontSize: '11px',
          color: hex(pal.fg),
        })
        .setOrigin(0.5)
        .setAlpha(getInvert() ? 0.8 : 0.5);
    }

    // Back where it came from: the expedition it was opened from, or the title
    // screen.
    makeButton(
      this,
      cx,
      700,
      SETTINGS.back,
      () =>
        this.opened.run
          ? this.scene.start('ExploreScene', { run: this.opened.run })
          : this.scene.start('TitleScene'),
      { width: 240 }
    );
  }
}

const musicLabel = SETTINGS.music;
const cheatLabel = SETTINGS.cheats;
const cheatNote = SETTINGS.cheatNote;
const invertLabel = SETTINGS.invert;
