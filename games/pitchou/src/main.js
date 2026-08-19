import { COLORS, GAME_HEIGHT, GAME_WIDTH } from './config.js';
import { HowToScene } from './scenes/HowToScene.js';
import { NightScene } from './scenes/NightScene.js';
import { RecapScene } from './scenes/RecapScene.js';
import { SettingsScene } from './scenes/SettingsScene.js';
import { TitleScene } from './scenes/TitleScene.js';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: COLORS.bg,
  // The sprites are 16x16 masks blown up whole; smoothing them would blur the
  // one thing that makes a token face readable at 48px.
  pixelArt: true,
  // Keep the fixed 480x854 design space, but scale the canvas to fit the
  // screen (preserving aspect ratio) and center it, so it never crops on
  // narrower phone viewports.
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  scene: [TitleScene, HowToScene, SettingsScene, NightScene, RecapScene],
});
