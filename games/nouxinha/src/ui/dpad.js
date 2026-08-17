// The four-direction pad in the bottom right of the HUD — thumb-reachable, and
// the tap half of the "swipe or tap" control scheme (DESIGN.md §7).

import { getPalette } from '../config.js';

const SIZE = 50;
const OFFSET = 54;

const BUTTONS = [
  { dir: 'up', dx: 0, dy: -OFFSET },
  { dir: 'down', dx: 0, dy: OFFSET },
  { dir: 'left', dx: -OFFSET, dy: 0 },
  { dir: 'right', dx: OFFSET, dy: 0 },
];

// Triangle points for an arrow of the given direction, inside a SIZE box.
function arrowPoints(dir) {
  const h = SIZE / 2;
  const tip = h - 12;
  const base = h - 24;
  const wing = 11;
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

    const zone = scene.add
      .zone(dx, dy, SIZE, SIZE)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => {
      draw(true);
      onStep(dir);
    });
    zone.on('pointerup', () => draw(false));
    zone.on('pointerout', () => draw(false));

    container.add([g, zone]);
  }

  return container;
}
