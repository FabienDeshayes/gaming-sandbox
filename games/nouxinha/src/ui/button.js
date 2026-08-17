// The shared bordered button: a 1px foreground outline around a monospace
// label, which is as much chrome as a two-colour game gets.

import { FONT, getPalette, hex } from '../config.js';

export function makeButton(scene, x, y, label, onClick, opts = {}) {
  const pal = getPalette();
  const width = opts.width || 200;
  const height = opts.height || 48;
  const fontSize = opts.fontSize || 18;

  const container = scene.add.container(x, y);
  const border = scene.add.graphics();
  const text = scene.add
    .text(0, 0, label, { fontFamily: FONT, fontSize: `${fontSize}px`, color: hex(pal.fg) })
    .setOrigin(0.5);

  container.add([border, text]);
  container.setSize(width, height);

  let enabled = opts.enabled !== false;

  const draw = (filled) => {
    border.clear();
    border.lineStyle(2, pal.fg, enabled ? 1 : 0.35);
    border.strokeRect(-width / 2, -height / 2, width, height);
    if (filled) {
      border.fillStyle(pal.fg, 0.2);
      border.fillRect(-width / 2, -height / 2, width, height);
    }
    text.setAlpha(enabled ? 1 : 0.35);
  };
  draw(false);

  container.setInteractive(
    new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
    Phaser.Geom.Rectangle.Contains
  );
  container.on('pointerover', () => enabled && draw(true));
  container.on('pointerout', () => draw(false));
  container.on('pointerdown', () => enabled && onClick && onClick());

  container.setLabel = (next) => text.setText(next);
  container.setEnabled = (next) => {
    enabled = next;
    draw(false);
  };
  container.label = text;

  return container;
}
