import {
  COLORS,
  FONT,
  GAME_WIDTH,
  getAudio,
  getHardMode,
  getMotion,
  setAudio,
  setHardMode,
  setMotion,
} from '../config.js';
import { createButton } from '../ui/button.js';
import { ensureTextures } from '../ui/textures.js';
import { stopWind } from '../ui/sfx.js';

const OPTIONS = [
  {
    label: 'SOUND',
    note: 'Wind, waves and the workshop.',
    get: getAudio,
    set: setAudio,
  },
  {
    label: 'MOTION',
    note: 'Flips, knocks and the screen shake.',
    get: getMotion,
    set: setMotion,
  },
  {
    label: 'HARD BUST',
    note: 'The third wave takes the whole basket, not half.',
    get: getHardMode,
    set: setHardMode,
  },
];

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super('SettingsScene');
  }

  create() {
    ensureTextures(this);
    const cx = GAME_WIDTH / 2;

    this.add
      .text(cx, 96, 'SETTINGS', { fontFamily: FONT, fontSize: '27px', color: COLORS.text })
      .setOrigin(0.5);

    OPTIONS.forEach((option, i) => {
      const y = 200 + i * 130;
      this.add
        .text(cx, y - 42, option.label, { fontFamily: FONT, fontSize: '18px', color: COLORS.text })
        .setOrigin(0.5);
      this.add
        .text(cx, y - 20, option.note, { fontFamily: FONT, fontSize: '13px', color: COLORS.muted })
        .setOrigin(0.5);

      const button = createButton(
        this,
        cx,
        y + 22,
        option.get() ? 'ON' : 'OFF',
        () => {
          option.set(!option.get());
          const on = option.get();
          button.setLabel(on ? 'ON' : 'OFF');
          button.setBaseFill(on ? COLORS.buttonHex : COLORS.disabledHex);
          // Turning sound off has to stop the drone that is already playing,
          // not just decline to start the next one.
          if (option.label === 'SOUND' && !on) stopWind();
        },
        { width: 200, fontSize: 22 }
      );
      if (!option.get()) button.setBaseFill(COLORS.disabledHex);
    });

    createButton(this, cx, 720, 'BACK', () => this.scene.start('TitleScene'), { width: 200 });
  }
}
