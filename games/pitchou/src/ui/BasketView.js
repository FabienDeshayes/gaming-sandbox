import {
  BASKET_XS,
  BASKET_Y,
  COLORS,
  FONT,
  KNOCK_MS,
  RESOURCE_COLORS,
  FONT_SM,
  FONT_XL,
  RESOURCE_LABELS,
  SPRITE_PX,
  GAME_WIDTH,
  TEXT_RESOLUTION,
} from '../config.js';
import { RESOURCES } from '../core/rules.js';

// What you are currently holding: three stacks, each an icon and a numeral.
//
// `knock` is the one piece of animation that carries a rule. A fall spills its
// unit off whichever stack is biggest (`dropFromBasket`), and that choice is
// not obvious from the numbers alone — so the stack that lost something flashes
// and the unit visibly leaves it.
export function createBasketView(scene) {
  const stacks = {};
  const objects = [];

  const heading = scene.add
    .text(GAME_WIDTH / 2, BASKET_Y - 40, 'IN YOUR BASKET', {
      fontFamily: FONT,
      fontSize: `${FONT_SM}px`,
      color: COLORS.dim,
      resolution: TEXT_RESOLUTION,
    })
    .setOrigin(0.5);
  objects.push(heading);

  for (const resource of RESOURCES) {
    const x = BASKET_XS[resource];
    const icon = scene.add
      .image(x - 32, BASKET_Y, resource)
      .setScale(36 / SPRITE_PX)
      .setTint(RESOURCE_COLORS[resource]);
    const count = scene.add
      .text(x - 6, BASKET_Y, '0', {
        fontFamily: FONT,
        fontSize: `${FONT_XL}px`,
        color: COLORS.text,
        resolution: TEXT_RESOLUTION,
      })
      .setOrigin(0, 0.5);
    const label = scene.add
      .text(x, BASKET_Y + 28, RESOURCE_LABELS[resource], {
        fontFamily: FONT,
        fontSize: `${FONT_SM}px`,
        color: COLORS.muted,
        resolution: TEXT_RESOLUTION,
      })
      .setOrigin(0.5, 0);
    stacks[resource] = { icon, count, label };
    objects.push(icon, count, label);
  }

  const view = {
    set(basket) {
      for (const resource of RESOURCES) {
        const empty = basket[resource] === 0;
        stacks[resource].count.setText(String(basket[resource]));
        stacks[resource].count.setColor(empty ? COLORS.dim : COLORS.text);
        stacks[resource].icon.setAlpha(empty ? 0.3 : 1);
      }
    },

    // Flash whichever stacks lost units to a fall. `before` and `after` are
    // basket snapshots either side of the draw.
    knock(before, after, animate = true) {
      const hit = RESOURCES.filter((r) => after[r] < before[r]);
      view.set(after);
      if (!hit.length || !animate) return Promise.resolve();
      return new Promise((resolve) => {
        let pending = hit.length;
        for (const resource of hit) {
          const { count } = stacks[resource];
          count.setColor(COLORS.fall);
          scene.tweens.add({
            targets: count,
            y: BASKET_Y - 14,
            alpha: 0.2,
            duration: KNOCK_MS / 2,
            yoyo: true,
            ease: 'Quad.easeOut',
            onComplete: () => {
              count.setY(BASKET_Y).setAlpha(1);
              count.setColor(after[resource] === 0 ? COLORS.dim : COLORS.text);
              if (--pending === 0) resolve();
            },
          });
        }
      });
    },

    destroy() {
      objects.forEach((o) => o.destroy());
    },
  };

  return view;
}
