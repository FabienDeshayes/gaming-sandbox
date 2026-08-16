import { COLORS, SWIPE_THRESHOLD } from '../config.js';

// A single interactive text button, reused by every scene. `onClick` is the
// action to run on tap/click — the template left this empty, we always wire it.
// `style` overrides the default sizing, so a crowded action card row can shrink
// its cards (see CARD_LAYOUTS in config.js).
//
// The click fires on release, not on press, and only if the pointer hasn't
// travelled more than a tap's worth (SWIPE_THRESHOLD, the same tolerance
// PuzzleScene's own tap/swipe split uses) since it went down — `pointer.
// getDistance()` is Phaser's own tracking of that, no local state needed.
// This is what lets a button sit inside a scrollable list (LevelSelectScene):
// a drag that starts on top of one scrolls the list instead of also firing
// the button underneath it.
export function createButton(scene, x, y, label, onClick, style = {}) {
  const { fontSize = 32, padX = 24, padY = 12 } = style;

  const text = scene.add
    .text(x, y, label, {
      fontFamily: 'sans-serif',
      fontSize: `${fontSize}px`,
      color: COLORS.text,
      backgroundColor: COLORS.button,
      padding: { x: padX, y: padY },
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });

  // Buttons have a resting colour that callers can change (an action card is
  // idle, selected, or out of budget). Hover has to fall back to *that* colour
  // rather than the default, or leaving a selected card would clear its
  // highlight.
  text.baseColor = COLORS.button;
  text.setBaseColor = (color) => {
    text.baseColor = color;
    text.setStyle({ backgroundColor: color });
    return text;
  };

  text.on('pointerover', () => text.setStyle({ backgroundColor: COLORS.buttonHover }));
  text.on('pointerout', () => text.setStyle({ backgroundColor: text.baseColor }));
  text.on('pointerup', (pointer) => {
    if (pointer.getDistance() < SWIPE_THRESHOLD) onClick && onClick();
  });
  return text;
}
