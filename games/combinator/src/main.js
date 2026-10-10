import { COLORS, GAME_HEIGHT, GAME_WIDTH } from './config.js';
import { PlaygroundScene } from './scenes/PlaygroundScene.js';
import { WorkbenchScene } from './scenes/WorkbenchScene.js';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: COLORS.bg,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  scene: [WorkbenchScene, PlaygroundScene],
});
