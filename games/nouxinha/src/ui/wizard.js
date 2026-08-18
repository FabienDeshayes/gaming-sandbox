// The wizard sprite, as a stack of colour-zone layers rather than one image —
// see WIZARD_ZONES in src/data/sprites.js for why. Shared by MapView (the
// live character, repainted every step) and TitleScene (a static preview of
// the colours a save has already carried home).

import { WIZARD_ZONES } from '../data/sprites.js';
import { gemColour, getPalette } from '../config.js';

// Builds a container of WIZARD_ZONES stacked images, one per colour band.
export function makeWizard(scene, x, y, facing, scale) {
  const wizard = scene.add.container(x, y);
  wizard.layers = [];
  for (let zone = 0; zone < WIZARD_ZONES; zone++) {
    const layer = scene.add.image(0, 0, `wizard-${facing}-${zone}`).setScale(scale);
    wizard.layers.push(layer);
    wizard.add(layer);
  }
  return wizard;
}

// The colour each zone wears for a given gem count. Zone 0 is always the
// palette's own foreground; zone N (1-3) turns gem N's colour once that many
// gems are held, and stays the foreground until then — so no gems still reads
// as the plain single-colour wizard, and each gem after that adds a colour
// rather than replacing the last one. Pulled out from `paintWizard` so the
// mapping itself is testable without a Phaser scene.
export function zoneColours(gems) {
  const fg = getPalette().fg;
  return Array.from({ length: WIZARD_ZONES }, (_, zone) =>
    zone === 0 || zone > gems ? fg : gemColour(zone)
  );
}

// Repaints every zone for the given facing and gem count.
export function paintWizard(wizard, facing, gems) {
  wizard.facing = facing;
  const colours = zoneColours(gems);
  wizard.layers.forEach((layer, zone) => {
    layer.setTexture(`wizard-${facing}-${zone}`).setTint(colours[zone]);
  });
}
