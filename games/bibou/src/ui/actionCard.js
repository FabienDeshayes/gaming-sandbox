import { COLORS } from '../config.js';

// A "playable card" control for the four action buttons: a bordered panel
// drawn behind a plain interactive Text, rather than the flat text-with-
// background look `button.js` uses for nav buttons. The returned value is
// the Text itself (not a container) — TESTING.md's browser harness finds
// buttons by scanning the scene's direct children for `.text` + `.input`,
// so the interactive object has to stay a real child of the scene, with the
// panel as a separate, non-interactive Graphics object sent behind it.
export function createActionCard(scene, x, y, label, onClick, style = {}) {
  const { fontSize = 32, padX = 24, padY = 16 } = style;

  const text = scene.add
    .text(x, y, label, {
      fontFamily: 'sans-serif',
      fontSize: `${fontSize}px`,
      color: COLORS.text,
      padding: { x: padX, y: padY },
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });

  const w = text.width;
  const h = text.height;
  const panel = scene.add.graphics().setPosition(x, y).setDepth(-1);

  function paintPanel(borderColor) {
    panel.clear();
    panel.fillStyle(COLORS.cardFillHex, 1);
    panel.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    panel.lineStyle(3, borderColor, 1);
    panel.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    // Faint top bevel so the panel reads as a raised card, not a flat swatch.
    panel.lineStyle(1, 0xffffff, 0.08);
    panel.strokeRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h * 0.4, 9);
  }

  text.baseColor = COLORS.cardBorderHex;
  paintPanel(text.baseColor);

  text.on('pointerover', () => paintPanel(COLORS.cardBorderHoverHex));
  text.on('pointerout', () => paintPanel(text.baseColor));
  text.on('pointerdown', () => onClick && onClick());

  // Same shape as button.js's setBaseColor: recolor the resting border (idle
  // / selected / disabled) without touching the label's own colour.
  text.setBaseColor = (color) => {
    text.baseColor = color;
    paintPanel(color);
    return text;
  };

  return text;
}
