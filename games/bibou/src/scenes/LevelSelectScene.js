import { COLORS } from '../config.js';
import { LEVELS } from '../data/levels.js';
import { createButton } from '../ui/button.js';

export class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super('LevelSelectScene');
  }

  create(data) {
    const unlimited = data.unlimited === true;
    const centerX = this.cameras.main.width / 2;

    this.add
      .text(centerX, 200, unlimited ? 'Test — Select Level' : 'Select Level', {
        fontFamily: 'sans-serif',
        fontSize: unlimited ? '38px' : '44px',
        color: unlimited ? COLORS.highlight : COLORS.text,
      })
      .setOrigin(0.5);

    LEVELS.forEach((level, i) => {
      createButton(this, centerX, 320 + i * 90, `Level ${level.id}`, () =>
        this.scene.start('PuzzleScene', { level, unlimited })
      );
    });

    createButton(this, centerX, 320 + LEVELS.length * 90 + 40, 'Back', () =>
      this.scene.start('TitleScene')
    );
  }
}
