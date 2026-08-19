import { COLORS, FONT, SWIPE_THRESHOLD } from '../config.js';
import { unlockAudio } from './sfx.js';

// The one interactive control in the game, reused by every scene.
//
// The click fires on release, not on press, and only if the pointer hasn't
// travelled more than a tap's worth since it went down — `pointer.getDistance()`
// is Phaser's own tracking of that. On touch, a press that turns into a drag
// should not also fire the button it started on.
//
// It returns the Text object with the panel Graphics parked behind it rather
// than wrapping the two in a Container, so the test harness can still find a
// button by scanning the scene's children for one with `.text` and `.input`.
export function createButton(scene, x, y, label, onClick, style = {}) {
  const { fontSize = 26, padX = 24, padY = 14, width = 0, enabled = true } = style;

  const text = scene.add
    .text(x, y, label, {
      fontFamily: FONT,
      fontSize: `${fontSize}px`,
      color: COLORS.text,
      padding: { x: padX, y: padY },
      align: 'center',
    })
    .setOrigin(0.5);

  const w = Math.max(width, text.width);
  const h = text.height;
  const panel = scene.add.graphics().setPosition(x, y).setDepth(-1);

  function paint(fill, edge) {
    panel.clear();
    panel.fillStyle(fill, 1);
    panel.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
    panel.lineStyle(2, edge, 1);
    panel.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
  }

  // A button has a resting look that callers change (a settings toggle that is
  // on, a tool card already built). Hovering out has to fall back to *that*,
  // not to the default, or leaving a selected control would clear it.
  text.baseFill = COLORS.buttonHex;
  text.baseEdge = COLORS.buttonEdgeHex;
  text.enabled = enabled;

  const repaint = () => {
    if (text.enabled) {
      paint(text.baseFill, text.baseEdge);
      text.setColor(COLORS.text);
    } else {
      paint(COLORS.disabledHex, COLORS.panelEdgeHex);
      text.setColor(COLORS.disabledText);
    }
  };

  text.setBaseFill = (fill, edge) => {
    text.baseFill = fill;
    if (edge !== undefined) text.baseEdge = edge;
    repaint();
    return text;
  };

  text.setEnabled = (on) => {
    text.enabled = !!on;
    repaint();
    return text;
  };

  text.setLabel = (next) => {
    text.setText(next);
    return text;
  };

  // Keep the panel under the text however the caller re-depths the pair, so a
  // button placed inside the dawn overlay doesn't leave its panel below it.
  text.setPanelDepth = (depth) => {
    text.setDepth(depth);
    panel.setDepth(depth - 1);
    return text;
  };

  text.panel = panel;
  text.destroyAll = () => {
    panel.destroy();
    text.destroy();
  };

  repaint();
  // The hit area is handed in rather than left to Phaser, because a button can
  // be wider than its label and the whole panel has to be tappable. It has to
  // go through setInteractive to be marked a custom area: Phaser's Text resizes
  // its own hit area on every restyle, so one assigned afterwards is silently
  // snapped back to the text's own width the next time the label is repainted.
  // Hit-area coordinates are local, with (0,0) at the object's top-left before
  // the origin shift, so a centred rect starts at half the difference.
  text.setInteractive(
    new Phaser.Geom.Rectangle((text.width - w) / 2, 0, w, h),
    Phaser.Geom.Rectangle.Contains
  );
  text.input.cursor = 'pointer';

  text.on('pointerover', () => {
    if (text.enabled) paint(COLORS.buttonHoverHex, text.baseEdge);
  });
  text.on('pointerout', repaint);
  text.on('pointerup', (pointer) => {
    if (!text.enabled) return;
    if (pointer.getDistance() >= SWIPE_THRESHOLD) return;
    // The autoplay policy keeps a context made before the first touch silent,
    // so every input is a chance to open it.
    unlockAudio();
    if (onClick) onClick();
  });

  return text;
}
