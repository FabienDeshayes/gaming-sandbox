import { FONT, GAME_WIDTH, gemColour, getCheats, getPalette, hex } from '../config.js';
import { anySlotUsed, loadSave, MAX_GEMS } from '../core/save.js';
import { progressLine, TITLE } from '../text.js';
import { ensureTextures, preloadTiles } from '../ui/textures.js';
import { makeButton } from '../ui/button.js';
import { makeWizard, paintWizard } from '../ui/wizard.js';
import { startMusic } from '../ui/music.js';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  preload() {
    preloadTiles(this);
  }

  create() {
    ensureTextures(this);
    const pal = getPalette();
    this.cameras.main.setBackgroundColor(pal.bg);
    const cx = GAME_WIDTH / 2;

    // The menu loop. Every scene asks for the track it wants on create and none
    // of them stop the music on the way out, so the handover from the menus to
    // an expedition is a crossfade rather than a silence (ui/music.js).
    startMusic('menu');
    // The slot last played, which is what the title screen reports and what
    // EXPLORE would pick up again (core/save.js).
    const save = loadSave();
    const canLoad = anySlotUsed();

    // Two independent picks off the three gem hues, so the title text is never
    // the same colour as the wizard below it — the screen reads as freshly
    // rolled rather than as one colour bleeding into the next.
    const hues = [1, 2, 3];
    const wizardHue = hues[Math.floor(Math.random() * hues.length)];
    const textHue = hues.filter((h) => h !== wizardHue)[Math.floor(Math.random() * 2)];

    this.add
      .text(cx, 200, TITLE.name, {
        fontFamily: FONT,
        fontSize: '46px',
        color: hex(gemColour(textHue)),
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 252, TITLE.tagline, {
        fontFamily: FONT,
        fontSize: '13px',
        color: hex(pal.fg),
      })
      .setOrigin(0.5)
      .setAlpha(0.6);

    // The wizard, lit by the torch they're about to spend. The title screen
    // always dresses them in a colour — picked fresh from the palette on every
    // visit — rather than the plain foreground a fresh campaign would draw
    // them in.
    paintWizard(makeWizard(this, cx, 380, 'down', 7), 'down', 0, gemColour(wizardHue));

    const buttonColor = gemColour(textHue);

    // Cheats are loud on purpose: a run started under them banks nothing, and a
    // player who forgot the toggle was on should find that out here rather than
    // at the hut (DESIGN.md §6.2).
    if (getCheats())
      this.add
        .text(cx, 520, TITLE.cheatsWarning, {
          fontFamily: FONT,
          fontSize: '11px',
          color: hex(pal.fg),
        })
        .setOrigin(0.5)
        .setAlpha(0.6);

    // Both ways in go through the slot picker: which of the three campaigns
    // this is has to be answered before a run can start (DESIGN.md §6.1).
    makeButton(this, cx, 566, TITLE.newGame, () => this.scene.start('SlotScene', { mode: 'new' }), {
      width: 240,
      color: buttonColor,
    });
    makeButton(
      this,
      cx,
      632,
      TITLE.loadGame,
      () => canLoad && this.scene.start('SlotScene', { mode: 'load' }),
      { width: 240, enabled: canLoad, color: buttonColor }
    );
    makeButton(this, cx, 698, TITLE.settings, () => this.scene.start('SettingsScene'), {
      width: 240,
      color: buttonColor,
    });
  }
}
