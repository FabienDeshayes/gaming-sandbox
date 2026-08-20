import {
  COLORS,
  DRAIN_MS,
  FONT,
  METER_COLORS,
  METER_H,
  METER_LABELS,
  METER_TOP,
  METER_W,
  SPRITE_PX,
} from '../config.js';

// One meter: an icon, a vertical bar, the level as a big numeral, and a ghost
// of what tomorrow's dusk will take.
//
// The bar holds no state — it is handed a level and repaints. The ghost matters
// more than it looks: the drain is what sets the player's risk appetite, and a
// keeper should be able to see "the lamp does not survive another night"
// without doing the subtraction.
export function createMeterBar(scene, x, meterId) {
  const colour = METER_COLORS[meterId];
  const barTop = METER_TOP + 30;
  const barH = METER_H - 30;

  const icon = scene.add
    .image(x, METER_TOP + 14, meterId)
    .setScale(32 / SPRITE_PX)
    .setTint(colour);

  const frame = scene.add.graphics();
  const fill = scene.add.graphics();

  const level = scene.add
    .text(x, barTop + barH + 16, '10', {
      fontFamily: FONT,
      fontSize: '32px',
      color: COLORS.text,
    })
    .setOrigin(0.5, 0);

  const label = scene.add
    .text(x, barTop + barH + 58, METER_LABELS[meterId], {
      fontFamily: FONT,
      fontSize: '14px',
      color: COLORS.muted,
    })
    .setOrigin(0.5, 0);

  // Painted height is animated so a dusk drain is something you watch happen
  // rather than something that already happened while you weren't looking.
  const shown = { value: 0 };
  let doomed = false;

  function paintFrame(cap) {
    frame.clear();
    frame.fillStyle(COLORS.panelHex, 1);
    frame.fillRoundedRect(x - METER_W / 2, barTop, METER_W, barH, 6);
    frame.lineStyle(2, COLORS.panelEdgeHex, 1);
    frame.strokeRoundedRect(x - METER_W / 2, barTop, METER_W, barH, 6);
    // A tick per unit, so the bar is countable rather than merely comparable —
    // nothing on screen is allowed to need a percentage (DESIGN.md §5).
    frame.lineStyle(1, COLORS.dimHex, 0.7);
    for (let i = 1; i < cap; i++) {
      const y = barTop + barH - (barH * i) / cap;
      frame.lineBetween(x - METER_W / 2 + 4, y, x + METER_W / 2 - 4, y);
    }
  }

  function paintFill(cap, drain) {
    const unit = barH / cap;
    fill.clear();
    const h = unit * shown.value;
    if (h > 0) {
      fill.fillStyle(colour, 1);
      fill.fillRect(x - METER_W / 2 + 3, barTop + barH - h, METER_W - 6, h);
    }
    // What the next dusk takes, hatched off the top of the fill.
    const ghost = Math.min(shown.value, drain);
    if (ghost > 0) {
      fill.fillStyle(doomed ? COLORS.bustHex : COLORS.bgHex, doomed ? 0.75 : 0.55);
      fill.fillRect(x - METER_W / 2 + 3, barTop + barH - h, METER_W - 6, unit * ghost);
    }
  }

  const view = {
    // `animate` is false for the first paint of a night and whenever reduced
    // motion is on; the number shown is the same either way.
    set(value, cap, drain, animate = false) {
      doomed = value - drain <= 0;
      level.setText(String(value));
      level.setColor(doomed ? COLORS.danger : COLORS.text);
      paintFrame(cap);
      if (!animate) {
        shown.value = value;
        paintFill(cap, drain);
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        scene.tweens.add({
          targets: shown,
          value,
          duration: DRAIN_MS,
          ease: 'Quad.easeOut',
          onUpdate: () => paintFill(cap, drain),
          onComplete: () => {
            paintFill(cap, drain);
            resolve();
          },
        });
      });
    },

    objects: [icon, frame, fill, level, label],
  };

  return view;
}
