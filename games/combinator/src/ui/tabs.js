// The header both screens share: the title and the two tabs that flip between
// the Workbench and the Playground. Tab key does the same from the keyboard.

import { COLORS, FONT, FONT_LG, GAME_WIDTH, MOBILE, MOBILE_LAYOUT, TEXT_RESOLUTION, ZOOM } from '../config.js';
import { createButton } from './button.js';

export const SCREENS = [
  { key: 'WorkbenchScene', label: 'Workbench' },
  { key: 'PlaygroundScene', label: 'Playground' },
];

// The canvas is ZOOM times the design size (see config.js); the camera zooms
// in from the top-left corner so every scene draws in design coordinates.
// Pointer positions are read as pointer.worldX/worldY for the same reason.
export function fitCamera(scene) {
  scene.cameras.main.setOrigin(0, 0).setZoom(ZOOM);
}

export function drawHeader(scene, activeKey, beforeLeave = () => {}) {
  fitCamera(scene);
  const y = MOBILE ? MOBILE_LAYOUT.header.y : 28;
  scene.add
    .text(16, y, 'COMBINATOR', {
      fontFamily: FONT,
      fontSize: `${MOBILE ? 20 : FONT_LG}px`,
      fontStyle: 'bold',
      color: COLORS.text,
      resolution: TEXT_RESOLUTION,
    })
    .setOrigin(0, 0.5);
  // On a phone the tabs sit at the right edge, out of the title's way.
  const tabW = MOBILE ? 112 : 120;
  let x = MOBILE ? GAME_WIDTH - 16 - SCREENS.length * (tabW + 8) + 8 : 200;
  for (const screen of SCREENS) {
    const active = screen.key === activeKey;
    const b = createButton(scene, 0, y, screen.label, () => {
      if (active) return;
      beforeLeave();
      scene.scene.start(screen.key);
    }, { width: tabW });
    b.moveX(x + Math.max(tabW, b.width) / 2);
    if (active) b.setBaseFill(COLORS.selectedHex);
    x += Math.max(tabW, b.width) + 8;
  }
  scene.input.keyboard?.addCapture('TAB');
  scene.input.keyboard?.on('keydown-TAB', (event) => {
    event.preventDefault?.();
    if (scene.editing) return;
    beforeLeave();
    scene.scene.start(SCREENS.find((s) => s.key !== activeKey).key);
  });
  return x;
}
