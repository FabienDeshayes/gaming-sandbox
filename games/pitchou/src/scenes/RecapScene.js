import { COLORS, FONT, GAME_WIDTH, METER_LABELS, RESOURCE_LABELS, SPRITE_PX } from '../config.js';
import { METERS, RESOURCES } from '../core/rules.js';
import { createButton } from '../ui/button.js';
import { ensureTextures } from '../ui/textures.js';
import { randomSeed, seedFromUrl } from './TitleScene.js';

// The end of a season. There is no score: the run either kept the light on for
// twelve nights or it didn't, and the only thing worth reporting about a loss
// is which meter ran out and when (DESIGN.md §6, §9).
export class RecapScene extends Phaser.Scene {
  constructor() {
    super('RecapScene');
  }

  create(data) {
    ensureTextures(this);
    const cx = GAME_WIDTH / 2;
    const won = data.status === 'won';

    this.add
      .image(cx, 150, won ? 'tower' : 'lamp')
      .setScale(80 / SPRITE_PX)
      .setTint(won ? COLORS.lampHex : COLORS.dimHex);

    this.add
      .text(cx, 250, won ? 'THE LIGHT HELD' : 'THE LIGHT WENT OUT', {
        fontFamily: FONT,
        fontSize: '29px',
        color: won ? COLORS.lamp : COLORS.text,
      })
      .setOrigin(0.5);

    const line = won
      ? `Twelve nights of storm, and every meter still burning.`
      : `Night ${data.night}: the ${METER_LABELS[data.lost.meter].toLowerCase()} ran dry at dusk.`;
    this.add
      .text(cx, 288, line, { fontFamily: FONT, fontSize: '16px', color: COLORS.muted })
      .setOrigin(0.5);

    const rows = [
      ['Nights survived', `${won ? data.seasonNights : data.night - 1} of ${data.seasonNights}`],
      [
        'Pulled from the shore',
        RESOURCES.map((r) => `${data.gathered[r]} ${RESOURCE_LABELS[r].toLowerCase()}`).join(', '),
      ],
      ['Swept off your feet', `${data.busts} ${data.busts === 1 ? 'time' : 'times'}`],
      ['Built', data.toolsBuilt.length ? data.toolsBuilt.join(', ') : 'nothing'],
      [
        'Meters at the end',
        METERS.map((m) => `${METER_LABELS[m].toLowerCase()} ${data.meters[m]}`).join(', '),
      ],
    ];

    this.add.rectangle(cx, 440, 424, 200, COLORS.panelHex).setStrokeStyle(2, COLORS.panelEdgeHex);
    rows.forEach(([label, value], i) => {
      const y = 364 + i * 36;
      this.add
        .text(cx - 190, y, label, { fontFamily: FONT, fontSize: '13px', color: COLORS.dim })
        .setOrigin(0, 0.5);
      this.add
        .text(cx + 190, y, value, { fontFamily: FONT, fontSize: '14px', color: COLORS.text })
        .setOrigin(1, 0.5);
    });

    // The seed is here so a season that felt unfair can be played again exactly
    // — the shore is shuffled, not rigged, and this is how you prove it.
    this.add
      .text(cx, 568, `seed ${data.seed}${data.hard ? '  ·  hard bust' : ''}`, {
        fontFamily: FONT,
        fontSize: '13px',
        color: COLORS.dim,
      })
      .setOrigin(0.5);

    createButton(
      this,
      cx,
      648,
      'PLAY AGAIN',
      () => {
        const pinned = seedFromUrl();
        this.scene.start('NightScene', { seed: pinned === null ? randomSeed() : pinned });
      },
      { width: 240 }
    );
    createButton(this, cx, 724, 'TITLE', () => this.scene.start('TitleScene'), {
      width: 240,
      fontSize: 23,
    });
  }
}
