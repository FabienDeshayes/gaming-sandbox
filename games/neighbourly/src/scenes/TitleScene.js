import { FONT, FONT_MD, FONT_SM, GAME_WIDTH, TEXT } from '../config.js';
import { SPECIAL_SETS } from '../data/catalogue.js';
import { DEFAULT_TUNING } from '../data/tuning.js';
import { setsFor } from '../core/rules.js';
import { SET_TEXT, TITLE, HUD } from '../text.js';
import { button } from '../ui/button.js';
import { bakeSprites, spriteKey } from '../ui/textures.js';

// `?seed=n` on the URL plays offer script n instead of the default one, so a
// run can be replayed or a different one tried. `?set=id` picks the special
// set instead of letting the seed draw it.
function fromUrl() {
  const q = new URLSearchParams(window.location.search);
  const raw = q.get('seed');
  const n = raw == null ? NaN : Number(raw);
  const set = q.get('set');
  return {
    seed: Number.isInteger(n) && n >= 0 ? n : null,
    special: set && SPECIAL_SETS.includes(set) ? [set] : null,
  };
}

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create() {
    bakeSprites(this);
    const cx = GAME_WIDTH / 2;
    const t = DEFAULT_TUNING;
    const { seed, special } = fromUrl();
    const sets = setsFor(seed ?? t.offerSeed, t, special);

    this.add.text(cx, 130, TITLE.name, { fontFamily: FONT, fontSize: '52px', color: TEXT.text, fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(cx, 182, TITLE.tagline, { fontFamily: FONT, fontSize: `${FONT_SM}px`, color: TEXT.dim }).setOrigin(0.5);
    // A row of pieces: the emblem of every set, the art the game is drawn in.
    const row = ['basic', 'hub', 'monument', 'crossroads', 'twins', 'clearing'];
    row.forEach((id, k) => this.add.image(cx + (k - (row.length - 1) / 2) * 64, 250, spriteKey(id)).setScale(3));

    this.add
      .text(cx, 440, TITLE.how(t).join('\n'), { fontFamily: FONT, fontSize: `${FONT_MD - 2}px`, color: TEXT.text, align: 'center', lineSpacing: 6 })
      .setOrigin(0.5);
    this.add
      .text(cx, 600, HUD.setsInPlay(sets.map((id) => SET_TEXT[id].name)), { fontFamily: FONT, fontSize: `${FONT_SM}px`, color: TEXT.select, fontStyle: 'bold' })
      .setOrigin(0.5);
    button(this, cx, 680, TITLE.play, () => this.scene.start('PlayScene', { seed, special }), { w: 220, h: 60, size: 26 });
  }
}
