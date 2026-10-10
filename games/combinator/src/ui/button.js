import { COLORS, FONT, FONT_RG, TEXT_RESOLUTION } from '../config.js';

// A text button with a rounded panel behind it. Fires on release, and only if
// the press didn't turn into a drag. Returns the Text object (the harness finds
// buttons by scanning for interactive Text), with the panel parked behind it.
export function createButton(scene, x, y, label, onClick, style = {}) {
  const { fontSize = FONT_RG, padX = 14, padY = 8, width = 0 } = style;
  const text = scene.add
    .text(x, y, label, {
      fontFamily: FONT,
      fontSize: `${fontSize}px`,
      color: COLORS.text,
      padding: { x: padX, y: padY },
      align: 'center',
      resolution: TEXT_RESOLUTION,
    })
    .setOrigin(0.5)
    .setDepth(11);
  const panel = scene.add.graphics().setPosition(x, y).setDepth(10);
  let w = Math.max(width, text.width);
  let h = text.height;
  text.baseFill = COLORS.buttonHex;

  const paint = (fill) => {
    panel.clear();
    panel.fillStyle(fill, 1);
    panel.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    panel.lineStyle(2, COLORS.buttonEdgeHex, 1);
    panel.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
  };
  const setHit = () =>
    text.setInteractive(new Phaser.Geom.Rectangle((text.width - w) / 2, 0, w, h), Phaser.Geom.Rectangle.Contains);

  text.setBaseFill = (fill) => {
    text.baseFill = fill;
    paint(fill);
    return text;
  };
  text.setLabel = (next) => {
    text.setText(next);
    w = Math.max(width, text.width);
    h = text.height;
    setHit();
    paint(text.baseFill);
    return text;
  };

  text.panel = panel;
  text.moveX = (nx) => {
    text.setX(nx);
    panel.setX(nx);
    return text;
  };

  paint(text.baseFill);
  setHit();
  text.input.cursor = 'pointer';
  text.isButton = true;
  text.on('pointerover', () => paint(COLORS.buttonHoverHex));
  text.on('pointerout', () => paint(text.baseFill));
  text.on('pointerup', (pointer) => {
    if (pointer.getDistance() > 8) return;
    onClick?.();
  });
  return text;
}
