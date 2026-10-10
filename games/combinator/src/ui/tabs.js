// The header both screens share: the title and the two tabs that flip between
// the Workbench and the Playground. Tab key does the same from the keyboard.

import { COLORS, FONT, FONT_LG, TEXT_RESOLUTION } from '../config.js';
import { createButton } from './button.js';

export const SCREENS = [
  { key: 'WorkbenchScene', label: 'Workbench' },
  { key: 'PlaygroundScene', label: 'Playground' },
];

export function drawHeader(scene, activeKey, beforeLeave = () => {}) {
  scene.add
    .text(16, 28, 'COMBINATOR', {
      fontFamily: FONT,
      fontSize: `${FONT_LG}px`,
      fontStyle: 'bold',
      color: COLORS.text,
      resolution: TEXT_RESOLUTION,
    })
    .setOrigin(0, 0.5);
  let x = 200;
  for (const screen of SCREENS) {
    const active = screen.key === activeKey;
    const b = createButton(scene, 0, 28, screen.label, () => {
      if (active) return;
      beforeLeave();
      scene.scene.start(screen.key);
    }, { width: 120 });
    b.moveX(x + Math.max(120, b.width) / 2);
    if (active) b.setBaseFill(COLORS.selectedHex);
    x += Math.max(120, b.width) + 8;
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
