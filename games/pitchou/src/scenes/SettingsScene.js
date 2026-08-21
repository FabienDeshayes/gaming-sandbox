import {
  COLORS,
  FALL_LABEL,
  FONT,
  FONT_LG,
  FONT_MD,
  FONT_RG,
  FONT_SM,
  GAME_WIDTH,
  getAudio,
  getHardMode,
  getMotion,
  setAudio,
  setHardMode,
  setMotion,
  TEXT_RESOLUTION,
} from '../config.js';
import { createButton } from '../ui/button.js';
import { ensureTextures } from '../ui/textures.js';
import { stopWind } from '../ui/sfx.js';

const OPTIONS = [
  {
    label: 'SOUND',
    note: 'Wind, falls and the workshop.',
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
    label: 'HARD FALLS',
    note: `The third ${FALL_LABEL} takes everything, not half.`,
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
      .text(cx, 96, 'SETTINGS', {
        fontFamily: FONT,
        fontSize: `${FONT_LG}px`,
        color: COLORS.text,
        resolution: TEXT_RESOLUTION,
      })
      .setOrigin(0.5);

    OPTIONS.forEach((option, i) => {
      const y = 210 + i * 140;
      this.add
        .text(cx, y - 48, option.label, {
          fontFamily: FONT,
          fontSize: `${FONT_MD}px`,
          color: COLORS.text,
          resolution: TEXT_RESOLUTION,
        })
        .setOrigin(0.5);
      this.add
        .text(cx, y - 20, option.note, {
          fontFamily: FONT,
          fontSize: `${FONT_SM}px`,
          color: COLORS.muted,
          resolution: TEXT_RESOLUTION,
        })
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
        { width: 200, fontSize: FONT_MD }
      );
      if (!option.get()) button.setBaseFill(COLORS.disabledHex);
    });

    createButton(this, cx, 730, 'BACK', () => this.scene.start('TitleScene'), {
      width: 220,
      fontSize: FONT_MD,
    });
  }
}
