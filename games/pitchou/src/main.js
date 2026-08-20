import { COLORS, GAME_HEIGHT, GAME_WIDTH } from './config.js';
import { NightScene } from './scenes/NightScene.js';
import { RecapScene } from './scenes/RecapScene.js';
import { SettingsScene } from './scenes/SettingsScene.js';
import { TitleScene } from './scenes/TitleScene.js';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: COLORS.bg,
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  scene: [TitleScene, SettingsScene, NightScene, RecapScene],
});
