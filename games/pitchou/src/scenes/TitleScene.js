import { COLORS, FONT, GAME_WIDTH, SPRITE_PX } from '../config.js';
import { createButton } from '../ui/button.js';
import { ensureTextures } from '../ui/textures.js';

// A run can be pinned to a seed from the URL (?seed=7), which is how a night
// that felt wrong gets looked at again — and how a test replays a whole season.
export function seedFromUrl() {
  try {
    const raw = new URLSearchParams(window.location.search).get('seed');
    const seed = Number(raw);
    if (raw !== null && Number.isFinite(seed)) return Math.floor(seed) >>> 0;
  } catch (e) {
    /* no URL to read; fall through to a random one */
  }
  return null;
}

export function randomSeed() {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create() {
    ensureTextures(this);
    const cx = GAME_WIDTH / 2;

    this.add
      .text(cx, 180, 'Pitchou', { fontFamily: FONT, fontSize: '64px', color: COLORS.text })
      .setOrigin(0.5);
    this.add
      .text(cx, 232, 'twelve nights, one light', {
        fontFamily: FONT,
        fontSize: '16px',
        color: COLORS.muted,
      })
      .setOrigin(0.5);

    this.add.image(cx, 360, 'tower').setScale(96 / SPRITE_PX).setTint(COLORS.lampHex);

    createButton(this, cx, 520, 'PLAY', () => this.startRun(), { width: 240 });
    createButton(this, cx, 596, 'SETTINGS', () => this.scene.start('SettingsScene'), {
      width: 240,
      fontSize: 23,
    });

    const pinned = seedFromUrl();
    if (pinned !== null)
      this.add
        .text(cx, 736, `seed ${pinned}`, { fontFamily: FONT, fontSize: '13px', color: COLORS.dim })
        .setOrigin(0.5);
  }

  startRun() {
    const pinned = seedFromUrl();
    this.scene.start('NightScene', { seed: pinned === null ? randomSeed() : pinned });
  }
}
