// The compass, in the top right of the map viewport.
//
// An arrow and the icon of what it points at (DESIGN.md §4.6). The icon matters
// as much as the arrow: "north-east" is useless on its own, "north-east, and it
// is a gem" is a decision. Built only for a run that owns one, and rebuilt
// whenever ownership changes.

import { FONT, SPRITE_PX, gemColour, getPalette, hex } from '../config.js';
import { compassHeading, compassTarget } from '../core/compass.js';

export const BADGE_W = 48;
export const BADGE_H = 78;

// Eight headings from two masks: the cardinals are the straight arrow turned by
// exact quarter turns, the diagonals the barbed one. A pixel sprite survives a
// 90-degree rotation and nothing in between.
const HEADINGS = [
  ['arrow-up', 0],
  ['arrow-diagonal', 0],
  ['arrow-up', 90],
  ['arrow-diagonal', 90],
  ['arrow-up', 180],
  ['arrow-diagonal', 180],
  ['arrow-up', 270],
  ['arrow-diagonal', 270],
];

export class CompassBadge {
  constructor(scene, x, y) {
    this.scene = scene;
    const pal = getPalette();

    this.container = scene.add.container(x, y).setVisible(false).setDepth(50);

    const frame = scene.add.graphics();
    frame.lineStyle(2, pal.fg, 1);
    frame.strokeRect(0, 0, BADGE_W, BADGE_H);

    this.arrow = scene.add
      .image(BADGE_W / 2, 24, 'arrow-up')
      .setScale(1.5)
      .setTint(pal.fg);
    this.icon = scene.add
      .image(BADGE_W / 2, 56, 'base')
      .setScale(1.4)
      .setTint(pal.fg);
    // Standing on the thing it points at, the needle has nothing to say, so it
    // says so rather than pointing an arbitrary way.
    this.here = scene.add
      .text(BADGE_W / 2, 24, 'HERE', { fontFamily: FONT, fontSize: '11px', color: hex(pal.fg) })
      .setOrigin(0.5)
      .setVisible(false);

    this.container.add([frame, this.arrow, this.icon, this.here]);
  }

  setPosition(x, y) {
    this.container.setPosition(x, y);
  }

  // Repointed on every step, because both the nearest target and which targets
  // are available at all move as the run does.
  update(run) {
    if (!run.tools.has('compass')) {
      this.container.setVisible(false);
      return;
    }
    this.container.setVisible(true);

    const target = compassTarget(run);
    const sector = compassHeading(run, target);
    if (sector === null) {
      this.arrow.setVisible(false);
      this.here.setVisible(true);
    } else {
      const [texture, angle] = HEADINGS[sector];
      this.arrow.setVisible(true).setTexture(texture).setAngle(angle).setTint(getPalette().fg);
      this.here.setVisible(false);
    }
    this.icon.setTexture(target.sprite).setTint(gemColour(target.hue || 0));
  }

  // The needle points at the *nearest* thing worth walking to, which is what the
  // renderer draws and what a test reads back.
  currentTarget(run) {
    return run.tools.has('compass') ? compassTarget(run) : null;
  }
}
