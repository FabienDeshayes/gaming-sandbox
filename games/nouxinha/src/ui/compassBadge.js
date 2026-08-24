// The compass, in the top right of the map viewport.
//
// An arrow and the icon of what it points at (DESIGN.md §4.6). The icon matters
// as much as the arrow: "north-east" is useless on its own, "north-east, and it
// is a gem" is a decision. Built only for a run that owns one, and rebuilt
// whenever ownership changes.

import { FONT, gemColour, getPalette, hex } from '../config.js';
import { compassHeading, compassTarget } from '../core/compass.js';
import { COMPASS } from '../text.js';

export const BADGE_W = 48;
export const BADGE_H = 78;

// One tile per heading, in the order `compassHeading` counts them: north, then
// clockwise. Drawn pointing rather than rotated, so nothing depends on a pixel
// sprite surviving a turn.
const HEADINGS = ['arrow-up', 'arrow-right', 'arrow-down', 'arrow-left'];

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
      .text(BADGE_W / 2, 24, COMPASS.here, { fontFamily: FONT, fontSize: '11px', color: hex(pal.fg) })
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
      this.arrow.setVisible(true).setTexture(HEADINGS[sector]).setTint(getPalette().fg);
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
