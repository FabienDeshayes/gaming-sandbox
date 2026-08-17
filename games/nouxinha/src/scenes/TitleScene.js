import { FONT, GAME_WIDTH, getPalette, hex } from '../config.js';
import { ensureTextures } from '../ui/textures.js';
import { makeButton } from '../ui/button.js';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create() {
    ensureTextures(this);
    const pal = getPalette();
    this.cameras.main.setBackgroundColor(pal.bg);
    const cx = GAME_WIDTH / 2;

    this.add
      .text(cx, 200, 'NOUXINHA', {
        fontFamily: FONT,
        fontSize: '46px',
        color: hex(pal.fg),
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 252, 'THE DARK IS THE ONLY MAP', {
        fontFamily: FONT,
        fontSize: '13px',
        color: hex(pal.fg),
      })
      .setOrigin(0.5)
      .setAlpha(0.6);

    // The wizard, lit by the torch they're about to spend.
    this.add.image(cx, 380, 'wizard-down').setScale(7).setTint(pal.fg);

    makeButton(this, cx, 540, 'EXPLORE', () => this.scene.start('ExploreScene'), { width: 240 });
    makeButton(this, cx, 610, 'SETTINGS', () => this.scene.start('SettingsScene'), { width: 240 });
  }
}
