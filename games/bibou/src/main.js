import { GAME_HEIGHT, GAME_WIDTH } from './config.js';
import { LevelSelectScene } from './scenes/LevelSelectScene.js';
import { PuzzleScene } from './scenes/PuzzleScene.js';
import { TitleScene } from './scenes/TitleScene.js';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#101214',
  // Keep the fixed 480x854 design space, but scale the canvas to fit the
  // screen (preserving aspect ratio) and center it, so it never crops on
  // narrower phone viewports.
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  scene: [TitleScene, LevelSelectScene, PuzzleScene],
});
