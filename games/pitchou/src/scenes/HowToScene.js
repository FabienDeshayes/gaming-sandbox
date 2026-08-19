import { COLORS, FONT, GAME_WIDTH, SPRITE_PX } from '../config.js';
import { DEFAULT_TUNING, drainForNight } from '../core/rules.js';
import { createButton } from '../ui/button.js';
import { ensureTextures } from '../ui/textures.js';

// Three cards, in the order the night happens: what is draining, what the shore
// costs you, and what you do with what you carried home.
//
// Every number here is read out of the tuning rather than typed, so the rules
// screen cannot drift from the rules. If a sweep moves the cap, this moves too.
function cards(tuning) {
  const drains = [1, 5, 9].map((night) => `${drainForNight(night, tuning)}`);
  const shore = tuning.startShore;
  return [
    {
      icon: 'lamp',
      title: 'Three meters, always falling',
      lines: [
        `Lamp, Hearth and Tower start at ${tuning.startMeter} and drain every night.`,
        `${drains[0]} a night to begin with, then ${drains[1]}, then ${drains[2]}.`,
        `They hold ${tuning.meterCap} at most — anything over the brim is lost.`,
        'If one reaches zero at dusk, the season is over.',
      ],
    },
    {
      icon: 'wave',
      title: 'The shore, one handful at a time',
      lines: [
        `Tonight's shore: ${shore.oil} oil, ${shore.wood} driftwood, ${shore.plank} plank,`,
        `and ${tuning.startWaves.length} waves. You can count what is left, always.`,
        'Every wave knocks a unit out of your basket.',
        `The ${tuning.waveBudget}rd sends you home with half of what survived.`,
        'Go home whenever you like. The choice is the game.',
      ],
    },
    {
      icon: 'gaff',
      title: 'Pour it, or build with it',
      lines: [
        'At dawn each stack goes into its meter or into the',
        'workshop — never both. Tools are built from the',
        'workshop, and each one changes the shore itself:',
        'a stronger token on it, or a wave off it.',
        'The storm adds a wave after nights 3, 6 and 9.',
      ],
    },
  ];
}

export class HowToScene extends Phaser.Scene {
  constructor() {
    super('HowToScene');
  }

  create() {
    ensureTextures(this);
    const cx = GAME_WIDTH / 2;

    this.add
      .text(cx, 56, 'HOW TO PLAY', { fontFamily: FONT, fontSize: '26px', color: COLORS.text })
      .setOrigin(0.5);

    let y = 110;
    for (const card of cards(DEFAULT_TUNING)) {
      const h = 46 + card.lines.length * 22;
      this.add
        .rectangle(cx, y + h / 2, 424, h, COLORS.panelHex)
        .setStrokeStyle(2, COLORS.panelEdgeHex);
      this.add
        .image(56, y + 26, card.icon)
        .setScale(26 / SPRITE_PX)
        .setTint(COLORS.lampHex);
      this.add
        .text(80, y + 26, card.title, { fontFamily: FONT, fontSize: '17px', color: COLORS.text })
        .setOrigin(0, 0.5);
      card.lines.forEach((line, i) => {
        this.add
          .text(56, y + 50 + i * 22, line, {
            fontFamily: FONT,
            fontSize: '13px',
            color: COLORS.muted,
          })
          .setOrigin(0, 0);
      });
      y += h + 16;
    }

    createButton(this, cx, 790, 'BACK', () => this.scene.start('TitleScene'), { width: 200 });
  }
}
