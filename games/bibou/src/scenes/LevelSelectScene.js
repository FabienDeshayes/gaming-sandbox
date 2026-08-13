import { COLORS, GAME_HEIGHT } from '../config.js';
import { LEVELS } from '../data/levels.js';
import { createButton } from '../ui/button.js';

const LIST_START_Y = 290;
const LIST_BOTTOM_MARGIN = 80; // room below the last row (Back) before the screen edge
const ROW_SPACING = 80; // default row height; shrinks once the list no longer fits

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

    // Rows shrink below the default 80px once there are enough levels that
    // Level list + Back would otherwise run off the bottom of the screen.
    const available = GAME_HEIGHT - LIST_START_Y - LIST_BOTTOM_MARGIN;
    const rowSpacing = Math.min(ROW_SPACING, available / LEVELS.length);
    const buttonStyle =
      rowSpacing < ROW_SPACING ? { fontSize: 24, padX: 16, padY: 8 } : {};

    LEVELS.forEach((level, i) => {
      createButton(
        this,
        centerX,
        LIST_START_Y + i * rowSpacing,
        `Level ${level.id}`,
        () => this.scene.start('PuzzleScene', { level, unlimited }),
        buttonStyle
      );
    });

    createButton(
      this,
      centerX,
      LIST_START_Y + LEVELS.length * rowSpacing + rowSpacing / 2,
      'Back',
      () => this.scene.start('TitleScene'),
      buttonStyle
    );
  }
}
