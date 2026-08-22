// The four-direction pad in the bottom right of the HUD — thumb-reachable, and
// the tap half of the "swipe or tap" control scheme (DESIGN.md §7). Holding an
// arrow down keeps stepping in that direction at the rate set in Settings
// (DESIGN.md §7, `getMoveSpeed`), rather than only ever taking one step per tap.

import { getMoveSpeed, getPalette } from '../config.js';

export const SIZE = 70;
export const OFFSET = 74;

const BUTTONS = [
  { dir: 'up', dx: 0, dy: -OFFSET },
  { dir: 'down', dx: 0, dy: OFFSET },
  { dir: 'left', dx: -OFFSET, dy: 0 },
  { dir: 'right', dx: OFFSET, dy: 0 },
];

// Triangle points for an arrow of the given direction, inside a SIZE box —
// proportioned the same way regardless of how big SIZE actually is.
const SCALE = SIZE / 50;

function arrowPoints(dir) {
  const h = SIZE / 2;
  const tip = h - 12 * SCALE;
  const base = h - 24 * SCALE;
  const wing = 11 * SCALE;
  if (dir === 'up') return [0, -tip, -wing, base, wing, base];
  if (dir === 'down') return [0, tip, -wing, -base, wing, -base];
  if (dir === 'left') return [-tip, 0, base, -wing, base, wing];
  return [tip, 0, -base, -wing, -base, wing];
}

export function makeDpad(scene, cx, cy, onStep) {
  const pal = getPalette();
  const container = scene.add.container(cx, cy);

  for (const { dir, dx, dy } of BUTTONS) {
    const g = scene.add.graphics({ x: dx, y: dy });
    const draw = (pressed) => {
      g.clear();
      g.lineStyle(2, pal.fg, 1);
      g.strokeRect(-SIZE / 2, -SIZE / 2, SIZE, SIZE);
      if (pressed) {
        g.fillStyle(pal.fg, 0.2);
        g.fillRect(-SIZE / 2, -SIZE / 2, SIZE, SIZE);
      }
      g.fillStyle(pal.fg, 1);
      g.fillTriangle(...arrowPoints(dir));
    };
    draw(false);

    // Held down, the button keeps stepping on its own — cleared on release or
    // on the pointer sliding off, the same two events that already reset the
    // pressed-look of the button.
    let repeatTimer = null;
    const stopRepeat = () => {
      if (repeatTimer) {
        repeatTimer.remove();
        repeatTimer = null;
      }
    };

    const zone = scene.add
      .zone(dx, dy, SIZE, SIZE)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => {
      draw(true);
      onStep(dir);
      stopRepeat();
      repeatTimer = scene.time.addEvent({
        delay: 1000 / getMoveSpeed(),
        loop: true,
        callback: () => onStep(dir),
      });
    });
    zone.on('pointerup', () => {
      draw(false);
      stopRepeat();
    });
    zone.on('pointerout', () => {
      draw(false);
      stopRepeat();
    });

    container.add([g, zone]);
  }

  return container;
}
