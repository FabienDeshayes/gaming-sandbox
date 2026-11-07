// A rectangular text button drawn as a pixel box. `setEnabled(false)` greys it
// and makes taps do nothing, so a scene can leave it on screen while it can't
// be used.

import { COLORS, FONT, TEXT_RESOLUTION, FONT_MD, TEXT } from '../config.js';
import { pixelBox } from './pixel.js';

export function button(
  scene,
  x,
  y,
  label,
  onTap,
  { w = 200, h = 52, size = FONT_MD, fill = COLORS.button, light = COLORS.buttonLight, dark = COLORS.shadow } = {}
) {
  const g = scene.add.graphics();
  const draw = (on) => {
    g.clear();
    pixelBox(g, x - w / 2, y - h / 2, w, h, on ? { fill, light, dark } : { fill: COLORS.buttonOff, light: COLORS.tileLight, dark: COLORS.tileDark });
  };
  draw(true);
  const hit = scene.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
  const text = scene.add
    .text(x, y, label, { fontFamily: FONT, resolution: TEXT_RESOLUTION, fontSize: `${size}px`, color: TEXT.text, fontStyle: 'bold' })
    .setOrigin(0.5);
  let enabled = true;
  hit.on('pointerup', () => enabled && onTap());
  const api = {
    bg: hit,
    text,
    setEnabled(on) {
      enabled = on;
      draw(on);
      text.setAlpha(on ? 1 : 0.45);
      return api;
    },
    setVisible(on) {
      g.setVisible(on);
      text.setVisible(on);
      hit.setVisible(on);
      return api;
    },
    setDepth(d) {
      g.setDepth(d);
      hit.setDepth(d);
      text.setDepth(d);
      return api;
    },
    destroy() {
      g.destroy();
      hit.destroy();
      text.destroy();
    },
  };
  return api;
}
