import { FONT, GAME_WIDTH, gemColour, getPalette, hex } from '../config.js';
import { loadSave, MAX_GEMS } from '../core/save.js';
import { ensureTextures } from '../ui/textures.js';
import { makeButton } from '../ui/button.js';
import { makeWizard, paintWizard } from '../ui/wizard.js';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create() {
    ensureTextures(this);
    const pal = getPalette();
    this.cameras.main.setBackgroundColor(pal.bg);
    const cx = GAME_WIDTH / 2;
    const save = loadSave();

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

    // The wizard, lit by the torch they're about to spend — and wearing
    // however much colour has already been carried home, so the title screen
    // itself is the progress bar.
    paintWizard(makeWizard(this, cx, 380, 'down', 7), 'down', save.gems);

    // One pip per gem, the found ones in the colour they gave back.
    const gap = 44;
    for (let i = 1; i <= MAX_GEMS; i++) {
      const held = i <= save.gems;
      this.add
        .image(cx + (i - (MAX_GEMS + 1) / 2) * gap, 462, 'gem')
        .setScale(2)
        .setTint(held ? gemColour(i) : pal.fg)
        .setAlpha(held ? 1 : 0.25);
    }

    if (save.runs)
      this.add
        .text(cx, 496, `${save.gems}/${MAX_GEMS} COLOURS  ${save.coins} COINS  ${save.runs} RUNS`, {
          fontFamily: FONT,
          fontSize: '12px',
          color: hex(pal.fg),
        })
        .setOrigin(0.5)
        .setAlpha(0.6);

    makeButton(this, cx, 570, 'EXPLORE', () => this.scene.start('ExploreScene'), { width: 240 });
    makeButton(this, cx, 640, 'SETTINGS', () => this.scene.start('SettingsScene'), { width: 240 });
  }
}
