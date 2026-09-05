// The end of the game: the light, and the game signing what it just did
// (DESIGN.md §4.9).
//
// It is reached from exactly one place — the sorcerer opening his hands at the
// end of the fourth kind of world (`ExploreScene.theEnd`) — and it opens with
// the colours already inverted, because the explosion that brought the player
// here is what inverted them. So this scene never turns the light on; it turns
// it *off* on the way out, handing the screen back to whatever the player's own
// setting says (`overrideInvert` in src/config.js). A page closed on these
// credits therefore comes back to an ordinary dark world.
//
// Nothing is decided here and nothing is written: the walk into the hall was
// banked, the world was moulded and the slot was written before the first line
// of this appeared. All that is left is to read it and go.

import {
  FONT,
  GAME_HEIGHT,
  GAME_WIDTH,
  getPalette,
  hex,
  invertUnlocked,
  overrideInvert,
} from '../config.js';
import { CREDITS } from '../text.js';
import { ensureTextures, preloadTiles } from '../ui/textures.js';
import { makeWizard, paintWizard } from '../ui/wizard.js';

// One line at a time, slowly enough to be read and quickly enough that nobody
// has to sit through a minute of it. A tap brings the rest in at once.
const FIRST_LINE_Y = 330;
const LINE_GAP = 44;
const FADE_MS = 900;
const LINE_DELAY = 700;

export class CreditsScene extends Phaser.Scene {
  constructor() {
    super('CreditsScene');
  }

  preload() {
    preloadTiles(this);
  }

  create() {
    ensureTextures(this);
    // Already inverted by the explosion that got here: this is the same world's
    // two colours, the other way round.
    const pal = getPalette();
    this.cameras.main.setBackgroundColor(pal.bg);
    const cx = GAME_WIDTH / 2;

    this.add
      .text(cx, 170, CREDITS.title, { fontFamily: FONT, fontSize: '46px', color: hex(pal.fg) })
      .setOrigin(0.5);

    // The wizard, standing in it. No torch worth drawing any more — the light is
    // the whole screen — so they are drawn plainly, in the one colour the world
    // has left.
    paintWizard(makeWizard(this, cx, 258, 'down', 5), 'down', 0, pal.fg);

    // The lines, and then the one piece of chrome on the screen: what the ending
    // just unlocked, which a player who never opens Settings would otherwise
    // never find (src/config.js).
    const lines = [
      ...CREDITS.lines,
      ...(invertUnlocked() ? [CREDITS.unlocked] : []),
    ];
    this.lines = lines.map((line, i) =>
      this.add
        .text(cx, FIRST_LINE_Y + i * LINE_GAP, line, {
          fontFamily: FONT,
          fontSize: '13px',
          color: hex(pal.fg),
          align: 'center',
          wordWrap: { width: GAME_WIDTH - 60 },
        })
        .setOrigin(0.5)
        .setAlpha(0)
    );
    this.lines.forEach((text, i) =>
      this.tweens.add({ targets: text, alpha: 1, duration: FADE_MS, delay: i * LINE_DELAY })
    );

    this.prompt = this.add
      .text(cx, GAME_HEIGHT - 90, CREDITS.back, {
        fontFamily: FONT,
        fontSize: '13px',
        color: hex(pal.fg),
      })
      .setOrigin(0.5)
      .setAlpha(0);
    this.tweens.add({
      targets: this.prompt,
      alpha: 0.7,
      duration: FADE_MS,
      delay: this.lines.length * LINE_DELAY,
    });

    // Anywhere on the screen, like the text panel: the first tap brings the rest
    // of the lines in, the second leaves. Never a button — there is nothing to
    // choose between.
    this.input.on('pointerdown', () => this.advance());
    this.input.keyboard.on('keydown-ESC', () => this.advance());
    this.input.keyboard.on('keydown-SPACE', () => this.advance());
  }

  everythingShown() {
    return this.lines.every((text) => text.alpha >= 1);
  }

  advance() {
    if (!this.everythingShown()) {
      this.tweens.killAll();
      this.lines.forEach((text) => text.setAlpha(1));
      this.prompt.setAlpha(0.7);
      return;
    }
    this.leave();
  }

  // Out, and the light goes with it: the inversion the ending turned on was
  // never the player's setting, so the title screen is drawn in whatever the
  // setting actually says (src/config.js).
  leave() {
    overrideInvert(null);
    this.scene.start('TitleScene');
  }
}
