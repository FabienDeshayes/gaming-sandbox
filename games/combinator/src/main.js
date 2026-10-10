import { COLORS, GAME_HEIGHT, GAME_WIDTH, MOBILE, ZOOM, isPortrait } from './config.js';
import { PlaygroundScene } from './scenes/PlaygroundScene.js';
import { WorkbenchScene } from './scenes/WorkbenchScene.js';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: COLORS.bg,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: Math.round(GAME_WIDTH * ZOOM),
    height: Math.round(GAME_HEIGHT * ZOOM),
  },
  scene: [WorkbenchScene, PlaygroundScene],
});

// The layout is picked at load. Turning the phone (or resizing a window across
// portrait and landscape) reloads into the other one; every edit is already in
// storage, so nothing is lost.
const forced = new URLSearchParams(location.search).has('layout');
if (!forced) {
  window.addEventListener('resize', () => {
    if (isPortrait() !== MOBILE) location.reload();
  });
}
