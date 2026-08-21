// The shared bordered button: a 1px foreground outline around a monospace
// label, which is as much chrome as a two-colour game gets.

import { FONT, getPalette, hex } from '../config.js';
import { playTap } from './sfx.js';

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

  // Phaser.GameObjects.Container.displayOriginX/Y is hardcoded to width/2,
  // height/2 and gets added to the pointer's local coordinate before it's
  // checked against the hit area (Phaser.Input.InputManager#pointWithinHitArea)
  // — so a container's custom hit area has to be given top-left-relative
  // (0, 0, width, height), not centred like the border/text drawn below. A
  // centred rectangle here silently shifted the whole clickable region half a
  // button-width to the left of what was actually drawn.
  container.setInteractive(
    new Phaser.Geom.Rectangle(0, 0, width, height),
    Phaser.Geom.Rectangle.Contains
  );

  // Fire on release rather than on touch-down: a scene transition kicked off
  // mid-press (before the finger has even lifted) is the one thing that made
  // these buttons feel unresponsive on touch, since the previous scene can
  // still be mid-teardown when a pointerdown lands right after one. Down still
  // draws the press so the button gives instant feedback either way; up (only
  // if still over the button — pointerout cancels it) is what actually acts.
  let pressed = false;
  container.on('pointerover', () => enabled && draw(true));
  container.on('pointerout', () => {
    pressed = false;
    draw(false);
  });
  container.on('pointerdown', () => {
    if (!enabled) return;
    pressed = true;
    draw(true);
    // On the press rather than the release, so the sound is the feedback for
    // the finger going down and the click is the feedback for what it did.
    playTap();
  });
  container.on('pointerup', () => {
    if (!enabled) return;
    draw(false);
    if (pressed && onClick) onClick();
    pressed = false;
  });

  container.setLabel = (next) => text.setText(next);
  container.setEnabled = (next) => {
    enabled = next;
    draw(false);
  };
  container.label = text;

  return container;
}
