// The wizard sprite: a painted tile (src/ui/painted.js) that happens to have a
// facing. The colour bands are not special-cased here any more — the character
// is painted out of `src/data/paint.js` like anything else, hood, robe and
// staff turning the colours of gems one, two and three as they come home.
//
// Shared by MapView (the live character, repainted every step) and TitleScene
// (a static preview of the colours a save has already carried home).

import { makePainted, paintTile } from './painted.js';

export function makeWizard(scene, x, y, facing, scale) {
  return paintWizard(makePainted(scene, x, y, scale), facing, 0);
}

// Repaints the character for the given facing and gem count. `base` overrides
// the silhouette's own colour (default the palette foreground) — the title
// screen's decorative flair is the only caller that passes one.
export function paintWizard(wizard, facing, gems, base) {
  wizard.facing = facing;
  return paintTile(wizard, `wizard-${facing}`, { gems, base });
}
