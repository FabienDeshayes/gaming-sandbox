// Boot only: game config and scene registration.

import { GAME_HEIGHT, GAME_WIDTH, getPalette } from './config.js';
import { TitleScene } from './scenes/TitleScene.js';
import { SlotScene } from './scenes/SlotScene.js';
import { SettingsScene } from './scenes/SettingsScene.js';
import { ExploreScene } from './scenes/ExploreScene.js';

new Phaser.Game({
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game',
  backgroundColor: getPalette().bg,
  // Nearest-neighbour filtering: the sprites are 16x16 masks drawn at 3x and
  // have to stay crisp.
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [TitleScene, SlotScene, SettingsScene, ExploreScene],
});
