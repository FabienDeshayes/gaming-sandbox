import { COLORS } from '../config.js';
import { createButton } from '../ui/button.js';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create() {
    const centerX = this.cameras.main.width / 2;

    this.add
      .text(centerX, 220, 'Bibou', {
        fontFamily: 'sans-serif',
        fontSize: '64px',
        color: COLORS.text,
      })
      .setOrigin(0.5);

    // Start and Test both lead to a level picker; Test carries the unlimited
    // flag through so any chosen level runs with an unlimited action budget.
    createButton(this, centerX, 440, 'Start', () =>
      this.scene.start('LevelSelectScene', { unlimited: false })
    );
    createButton(this, centerX, 520, 'Settings', () => {});
    createButton(this, centerX, 600, 'Test', () =>
      this.scene.start('LevelSelectScene', { unlimited: true })
    );
  }
}
