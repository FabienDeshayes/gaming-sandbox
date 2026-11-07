import { COLORS, GAME_HEIGHT, GAME_WIDTH, ZOOM } from './config.js';
import { PlayScene } from './scenes/PlayScene.js';
import { TitleScene } from './scenes/TitleScene.js';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: COLORS.bg,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    // The canvas is ZOOM times the design size: one canvas pixel per screen
    // pixel. Scenes zoom their camera to match (see ZOOM in config.js).
    width: Math.round(GAME_WIDTH * ZOOM),
    height: Math.round(GAME_HEIGHT * ZOOM),
  },
  scene: [TitleScene, PlayScene],
});
