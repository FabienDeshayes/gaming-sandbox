import { COLORS, FONT, FONT_MD, FONT_SM, GAME_WIDTH } from '../config.js';
import { DEFAULT_TUNING } from '../data/tuning.js';
import { button } from '../ui/button.js';

// `?seed=n` on the URL plays offer script n instead of the default one, so a
// run can be replayed or a different one tried.
function seedFromUrl() {
  const raw = new URLSearchParams(window.location.search).get('seed');
  const n = raw == null ? NaN : Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create() {
    const cx = GAME_WIDTH / 2;
    const t = DEFAULT_TUNING;
    this.add.text(cx, 150, 'Neighbourly', { fontFamily: FONT, fontSize: '52px', color: COLORS.text, fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(cx, 204, 'a placement puzzle on one small board', { fontFamily: FONT, fontSize: `${FONT_SM}px`, color: COLORS.dim }).setOrigin(0.5);
    const how = [
      `Each turn, pick one of ${t.offerSize} pieces and put it`,
      'on any tile. Whatever was there is gone.',
      '',
      'Pieces score from what is around them:',
      'neighbours, water, rock, their row, the edge.',
      'Tap a tile to see what a piece would score.',
      '',
      `After ${t.turnsPerLevel} turns the board must reach the`,
      `level's target. Clear all ${t.levels} levels on the`,
      'same board to win.',
    ];
    this.add
      .text(cx, 400, how.join('\n'), { fontFamily: FONT, fontSize: `${FONT_MD - 2}px`, color: COLORS.text, align: 'center', lineSpacing: 6 })
      .setOrigin(0.5);
    button(this, cx, 640, 'PLAY', () => this.scene.start('PlayScene', { seed: seedFromUrl() }), { w: 220, h: 60, size: 26 });
  }
}
