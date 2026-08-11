import { COLORS } from '../config.js';

// A single interactive text button, reused by every scene. `onClick` is the
// action to run on tap/click — the template left this empty, we always wire it.
export function createButton(scene, x, y, label, onClick) {
  const text = scene.add
    .text(x, y, label, {
      fontFamily: 'sans-serif',
      fontSize: '32px',
      color: COLORS.text,
      backgroundColor: COLORS.button,
      padding: { x: 24, y: 12 },
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });

  text.on('pointerover', () => text.setStyle({ backgroundColor: COLORS.buttonHover }));
  text.on('pointerout', () => text.setStyle({ backgroundColor: COLORS.button }));
  text.on('pointerdown', () => onClick && onClick());
  return text;
}
