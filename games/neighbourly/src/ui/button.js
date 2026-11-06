// A plain rectangular text button. `setEnabled(false)` greys it and makes taps
// do nothing, so a scene can leave it on screen while it can't be used.

import { COLORS, FONT, FONT_MD } from '../config.js';

export function button(scene, x, y, label, onTap, { w = 200, h = 52, size = FONT_MD, color = COLORS.button } = {}) {
  const bg = scene.add.rectangle(x, y, w, h, color).setStrokeStyle(2, 0xffffff, 0.25);
  const text = scene.add
    .text(x, y, label, { fontFamily: FONT, fontSize: `${size}px`, color: COLORS.text, fontStyle: 'bold' })
    .setOrigin(0.5);
  let enabled = true;
  bg.setInteractive({ useHandCursor: true });
  bg.on('pointerup', () => enabled && onTap());
  const api = {
    bg,
    text,
    setEnabled(on) {
      enabled = on;
      bg.setFillStyle(on ? color : COLORS.buttonOff);
      text.setAlpha(on ? 1 : 0.45);
      return api;
    },
    setVisible(on) {
      bg.setVisible(on);
      text.setVisible(on);
      return api;
    },
    setDepth(d) {
      bg.setDepth(d);
      text.setDepth(d);
      return api;
    },
    destroy() {
      bg.destroy();
      text.destroy();
    },
  };
  return api;
}
