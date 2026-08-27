// The four landmarks: what each one is, as opposed to where it stands.
//
// Where they stand — the rings, the courts, the chests beside them and what a
// touch hands over — is `src/balance.js`, the same way an item's numbers are.
// What is here is the half a retune must never touch: the name, the sprite, the
// ground its court is paved with, and the colour it keeps.
//
// **The colour is absolute.** Every other colour in this game is relative to
// the palette being played in (`gemColour` in src/config.js hands back the
// foreground of a palette you are *not* in), because a gem's colour is one this
// world does not contain. A landmark is the other way round: it is the same
// object in every world the hall moulds, so its colour has to be the same one
// in every world too, or it is not an identity — it is just another tile that
// happens to be lit. One consequence, and it is kept on purpose: in each biome
// exactly one landmark is drawn in the world's own foreground and reads plain.
// That is the one that is at home here.
//
// A landmark is **not** in `BIOME_KEYS` (src/data/tiles.js) for the same
// reason. A biome may repoint its rock and its huts; it may not repoint the
// Gnomon, because the Gnomon is not this world's.

import { LANDMARK_PLAN } from '../balance.js';
import { LANDMARK_TEXT } from '../text.js';

// The palette each one keeps, by id (`PALETTES` in src/config.js). Named rather
// than given as a hex, so the four landmarks and the four worlds are drawn out
// of the same four colours and there is never a fifth.
export const LANDMARKS = {
  mint: {
    id: 'mint',
    ...LANDMARK_TEXT.mint,
    sprite: 'mint',
    court: 'court-mint',
    palette: 'magenta',
    // What the campaign keeps once this one has been walked home. Read by
    // `hasStanding` in src/core/rules.js; the effect itself is wherever the
    // thing it changes lives — the map for the mint, the HUD for the gnomon.
    standing: 'stall-known',
  },
  bell: {
    id: 'bell',
    ...LANDMARK_TEXT.bell,
    sprite: 'bell',
    court: 'court-bell',
    palette: 'cathode',
    standing: 'bell-heard',
  },
  'lantern-tree': {
    id: 'lantern-tree',
    ...LANDMARK_TEXT['lantern-tree'],
    sprite: 'lantern-tree',
    court: 'court-tree',
    palette: 'amber',
    standing: 'second-light',
  },
  gnomon: {
    id: 'gnomon',
    ...LANDMARK_TEXT.gnomon,
    sprite: 'gnomon',
    court: 'court-gnomon',
    palette: 'phosphor',
    standing: 'distance-known',
  },
};

// The ids, in ring order — which is the order `LANDMARK_PLAN` places them in,
// so the two tables can never disagree about how many landmarks there are.
export const LANDMARK_IDS = LANDMARK_PLAN.map((plan) => plan.id);

export function landmarkDef(id) {
  return LANDMARKS[id] || null;
}

// Every standing a campaign can hold, for the save to check a file against
// rather than trusting whatever is in it.
export const STANDINGS = LANDMARK_IDS.map((id) => LANDMARKS[id].standing);

// The landmark a standing belongs to, for anything that has one in hand and
// wants to know whose it is.
export function landmarkOfStanding(standing) {
  return LANDMARK_IDS.map((id) => LANDMARKS[id]).find((mark) => mark.standing === standing) || null;
}
