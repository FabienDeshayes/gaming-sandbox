// A horizontal slider: a label above a track, dragged or tapped to set an
// integer value in [min, max]. Used once, for the move-speed setting
// (Settings), so it stays deliberately plain — bordered chrome and a filled
// handle, the same visual language as every other control in the game.

import { FONT, getPalette, hex } from '../config.js';
import { playTap } from './sfx.js';

const TRACK_H = 4;
const HANDLE_R = 11;

export function makeSlider(scene, x, y, { width = 300, min, max, value, label, onChange }) {
  const pal = getPalette();
  const container = scene.add.container(x, y);

  const text = scene.add
    .text(0, -22, label(value), { fontFamily: FONT, fontSize: '14px', color: hex(pal.fg) })
    .setOrigin(0.5);

  const track = scene.add.graphics();
  let current = value;
  // The keyboard's own outline: a slider isn't a bordered box like a button,
  // so focus gets a ring drawn around the whole control instead of over it.
  let focused = false;
  const focusRing = scene.add.graphics();

  const draw = () => {
    track.clear();
    track.lineStyle(TRACK_H, pal.fg, 0.5);
    track.lineBetween(-width / 2, 0, width / 2, 0);
    const t = (current - min) / (max - min);
    const hx = -width / 2 + t * width;
    track.fillStyle(pal.fg, 1);
    track.fillCircle(hx, 0, HANDLE_R);
    text.setText(label(current));

    focusRing.clear();
    if (focused) {
      focusRing.lineStyle(1, pal.fg, 0.9);
      focusRing.strokeRect(-width / 2 - 10, -34, width + 20, 60);
    }
  };
  draw();

  // A wide, short zone spanning the whole track — tapping anywhere jumps the
  // handle there, and dragging tracks the pointer, the same pattern
  // ui/scroll.js uses for its list rather than Phaser's own drag plugin.
  const zone = scene.add
    .zone(0, 0, width + HANDLE_R * 2, 40)
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });

  const setFromLocalX = (localX) => {
    const t = Phaser.Math.Clamp((localX + width / 2) / width, 0, 1);
    const next = Math.round(min + t * (max - min));
    if (next !== current) {
      current = next;
      draw();
      onChange(current);
    }
  };

  let tracking = false;
  zone.on('pointerdown', (p) => {
    tracking = true;
    playTap();
    setFromLocalX(p.x - x);
  });
  scene.input.on('pointermove', (p) => {
    if (tracking) setFromLocalX(p.x - x);
  });
  const stop = () => (tracking = false);
  scene.input.on('pointerup', stop);
  scene.input.on('pointerupoutside', stop);

  container.add([text, track, focusRing, zone]);
  container.setSize(width, 48);

  // The same contract every `ui/keyboardNav.js` focusable shares, plus
  // `adjust` — which is what tells the nav that Left/Right belong to this
  // control's value instead of moving off it.
  container.setFocused = (v) => {
    focused = v;
    draw();
  };
  container.isEnabled = () => true;
  container.adjust = (delta) => {
    const next = Phaser.Math.Clamp(current + delta, min, max);
    if (next === current) return;
    current = next;
    draw();
    playTap();
    onChange(current);
  };
  return container;
}
