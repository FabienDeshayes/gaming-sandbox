// The landmarks: what each one is, as opposed to where it stands.
//
// Where they stand — the rings, the headings, the courts, the chests beside
// them and what a touch hands over — is `src/balance.js`, the same way an
// item's numbers are. What is here is the half a retune must never touch: the
// name, the sprite, the ground its court is paved with, and the colour it
// keeps.
//
// There are two tiers of them and they are easy to confuse (DESIGN.md §4.10):
//
//   the **seven** — his pins. The same seven places in every world the hall
//   moulds, each with a gift on every touch and a standing the first time ever.
//   the **four** — the world's own. One per biome, so a campaign meets exactly
//   one of them per world and all four only by finishing the game. No gift and
//   no standing: what it hands over is a piece of what this place was.
//
// **The colour is absolute.** Every other colour in this game is relative to
// the palette being played in (`gemColour` in src/config.js hands back the
// foreground of a palette you are *not* in), because a gem's colour is one this
// world does not contain. A landmark is the other way round: it is the same
// object in every world the hall moulds, so its colour has to be the same one
// in every world too, or it is not an identity — it is just another tile that
// happens to be lit.
//
// Seven of them and four palettes, so a colour is a **family** rather than a
// name: the Bell and the Aqueduct are both cathode because both are about
// water, the Tree and the Watchtower are both amber because both are about
// seeing, the Mint and the Weighhouse are both magenta because both are about
// money. Which is the reason the rings interleave the way they do — you never
// meet two of a colour in a row.
//
// The four that belong to a single world take **that world's own palette**,
// which is the same as saying they are never drawn in a colour at all: a
// landmark reads plain until the campaign holds its standing, and these hold no
// standing to hold. That is not an oversight. The seven are his, carried from
// world to world, and they are coloured as things from elsewhere; the fourth
// kind is this ground's own, and it is the colour of the ground.
//
// The seven are **not** in `BIOME_KEYS` (src/data/tiles.js) for the same
// reason. A biome may repoint its rock and its huts; it may not repoint the
// Gnomon, because the Gnomon is not this world's. The other four never come up:
// each one only ever stands in the one world it belongs to.

import { LANDMARK_PLAN } from '../balance.js';
import { BIOMES } from './biomes.js';
import { LANDMARK_TEXT } from '../text.js';

// The palette each one keeps, by id (`PALETTES` in src/config.js). Named rather
// than given as a hex, so the landmarks and the four worlds are drawn out of the
// same four colours and there is never a fifth.
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
  aqueduct: {
    id: 'aqueduct',
    ...LANDMARK_TEXT.aqueduct,
    sprite: 'aqueduct',
    court: 'court-aqueduct',
    palette: 'cathode',
    standing: 'deeper-tank',
  },
  bell: {
    id: 'bell',
    ...LANDMARK_TEXT.bell,
    sprite: 'bell',
    court: 'court-bell',
    palette: 'cathode',
    standing: 'bell-heard',
  },
  weighhouse: {
    id: 'weighhouse',
    ...LANDMARK_TEXT.weighhouse,
    sprite: 'weighhouse',
    court: 'court-weighhouse',
    palette: 'magenta',
    standing: 'fair-price',
  },
  'lantern-tree': {
    id: 'lantern-tree',
    ...LANDMARK_TEXT['lantern-tree'],
    sprite: 'lantern-tree',
    court: 'court-tree',
    palette: 'amber',
    standing: 'second-light',
  },
  watchtower: {
    id: 'watchtower',
    ...LANDMARK_TEXT.watchtower,
    sprite: 'watchtower',
    court: 'court-watchtower',
    palette: 'amber',
    standing: 'far-sight',
  },
  gnomon: {
    id: 'gnomon',
    ...LANDMARK_TEXT.gnomon,
    sprite: 'gnomon',
    court: 'court-gnomon',
    palette: 'phosphor',
    standing: 'distance-known',
  },

  // --- The one a world keeps to itself ---------------------------------------
  //
  // `standing: null` is the whole of what makes these a different kind of
  // thing: `standingOf` in core/rules.js hands back nothing, so `hasStanding`
  // is false forever, `touchLandmark` never reports a `firstEver`, and the
  // save has nothing of them to carry across a cycle. They are worth walking to
  // once per world, and then they are a place you have been.
  plough: {
    id: 'plough',
    ...LANDMARK_TEXT.plough,
    sprite: 'plough',
    court: 'court-plough',
    palette: 'phosphor',
    standing: null,
  },
  washing: {
    id: 'washing',
    ...LANDMARK_TEXT.washing,
    sprite: 'washing',
    court: 'court-washing',
    palette: 'cathode',
    standing: null,
  },
  caravan: {
    id: 'caravan',
    ...LANDMARK_TEXT.caravan,
    sprite: 'caravan',
    court: 'court-caravan',
    palette: 'amber',
    standing: null,
  },
  'second-hut': {
    id: 'second-hut',
    ...LANDMARK_TEXT['second-hut'],
    sprite: 'second-hut',
    court: 'court-second-hut',
    palette: 'magenta',
    standing: null,
  },
};

// Which of the four belongs to which kind of world. The one table that says a
// landmark can be a property of the biome; `buildLandmarks` in core/world.js is
// what reads it, off `biomeOf(seed)`, so this stays derived from the seed like
// everything else about a world.
export const BIOME_LANDMARKS = {
  temperate: 'plough',
  frozen: 'washing',
  desert: 'caravan',
  mystic: 'second-hut',
};

export function biomeLandmark(biome) {
  return BIOME_LANDMARKS[biome] || BIOME_LANDMARKS.temperate;
}

export const BIOME_LANDMARK_IDS = BIOMES.map((biome) => BIOME_LANDMARKS[biome.id]);

// The ids of the seven that are in every world, in ring order — which is the
// order `LANDMARK_PLAN` places them in, so the two tables can never disagree
// about how many there are. The biome slot in the plan carries no id of its
// own (it is filled in per world), which is what drops out of the list here.
export const LANDMARK_IDS = LANDMARK_PLAN.filter((plan) => !plan.biome).map((plan) => plan.id);

export function landmarkDef(id) {
  return LANDMARKS[id] || null;
}

// Every standing a campaign can hold, for the save to check a file against
// rather than trusting whatever is in it.
export const STANDINGS = LANDMARK_IDS.map((id) => LANDMARKS[id].standing).filter(Boolean);
