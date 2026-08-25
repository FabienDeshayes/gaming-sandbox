// The game's own voice: a bordered panel across the bottom of the screen that
// reads a few sentences out a character at a time, a block per tap.
//
// It is the one overlay that leaves the world on screen — the dialog, the item
// card and the map all take the whole screen, because each of them is a
// decision or an inspection, and the player has stopped walking to make it.
// This is neither: it is the game saying something *about* where you are
// standing, so it covers the HUD and leaves the viewport above it alone. Like
// every other overlay it still owns the input while it is up (`modalOpen` in
// scenes/ExploreScene.js), so nothing behind it steps.
//
// Nothing about it is specific to the sentence it happens to be showing: hand
// `show` a list of blocks — one string per tap — and a callback for when the
// last of them has been read. The opening of an expedition is the first use;
// anything else the game wants to say out loud is the same call.

import { FONT, GAME_HEIGHT, GAME_WIDTH, HUD_Y, getPalette, hex } from '../config.js';
import { playTap, playTextBlip } from './sfx.js';

// The panel is the HUD's own band, inset from the sides and the bottom so the
// border reads as a panel laid over the screen rather than as another rule
// across it — but flush with the top of the band, whose divider its own top
// edge then becomes. That last part is not tidiness: the D-pad's top row
// reaches a few pixels above the divider, and a panel that started below it
// would leave a stub of arrow poking out over the game's own voice.
const MARGIN = 8;
const LEFT = MARGIN;
const TOP = HUD_Y;
const PANEL_W = GAME_WIDTH - MARGIN * 2;
const PANEL_H = GAME_HEIGHT - HUD_Y - MARGIN;
// Two strokes rather than one: a heavy outer edge and a hairline inside it, which
// is the border a CRT-era text box has and costs nothing but a second rectangle.
const INNER_INSET = 5;
const PAD = 22;

const FONT_SIZE = 16;
const LINE_SPACING = 8;

// One character per tick. Fast enough that a full block is read in a couple of
// seconds — anything slower and the tap-to-finish stops being a shortcut and
// becomes the only way anyone plays.
const CHAR_MS = 26;
// A blip every other character: one per character at this rate is a buzz rather
// than a voice.
const BLIP_EVERY = 2;

// The "there is more" caret in the bottom corner, blinking so a finished block
// doesn't read as a panel that has got stuck.
const CARET = 9;
const BLINK_MS = 480;

export class TextPanel {
  constructor(scene) {
    this.scene = scene;
    this.open = false;
    this.blocks = [];
    this.index = 0;
    // The block as it will read once it is all there, already wrapped, and how
    // much of it is on screen.
    this.full = '';
    this.shown = 0;
    this.timer = null;
    this.blink = null;
    this.onClose = null;
    // Above the dialog: only one of them is ever up, and if that were ever to
    // change it is the panel that is talking.
    this.container = scene.add.container(0, 0).setVisible(false).setDepth(250);
  }

  isOpen() {
    return this.open;
  }

  // `blocks` is one string per tap. `onClose` is called once the last of them
  // has been read and the panel has taken itself off screen — the scene uses it
  // to pick up whatever it was doing.
  show(blocks, onClose = null) {
    const pal = getPalette();
    const scene = this.scene;
    this.stopTimers();
    this.container.removeAll(true);

    this.blocks = blocks.filter((block) => block && block.length);
    this.index = 0;
    this.onClose = onClose;
    if (!this.blocks.length) return this.hide();

    // Swallows every tap on the whole screen, both because nothing behind the
    // panel may be walked while it is talking and because *anywhere* is the tap
    // target: this is a text box, and hunting for a button to advance it is the
    // one thing a text box must never ask for.
    const catcher = scene.add
      .zone(0, 0, GAME_WIDTH, GAME_HEIGHT)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    catcher.on('pointerdown', () => this.advance());

    const frame = scene.add.graphics();
    frame.fillStyle(pal.bg, 1);
    frame.fillRect(LEFT, TOP, PANEL_W, PANEL_H);
    frame.lineStyle(2, pal.fg, 1);
    frame.strokeRect(LEFT, TOP, PANEL_W, PANEL_H);
    frame.lineStyle(1, pal.fg, 1);
    frame.strokeRect(
      LEFT + INNER_INSET,
      TOP + INNER_INSET,
      PANEL_W - INNER_INSET * 2,
      PANEL_H - INNER_INSET * 2
    );

    this.label = scene.add
      .text(LEFT + PAD, TOP + PAD, '', {
        fontFamily: FONT,
        fontSize: `${FONT_SIZE}px`,
        color: hex(pal.fg),
        wordWrap: { width: PANEL_W - PAD * 2 },
      })
      .setOrigin(0, 0);
    this.label.setLineSpacing(LINE_SPACING);

    this.caret = scene.add.graphics().setVisible(false);
    this.caret.fillStyle(pal.fg, 1);
    const cx = LEFT + PANEL_W - PAD;
    const cy = TOP + PANEL_H - PAD;
    this.caret.fillTriangle(cx - CARET, cy - CARET, cx, cy - CARET, cx - CARET / 2, cy);

    this.container.add([catcher, frame, this.label, this.caret]);
    this.container.setVisible(true);
    this.open = true;
    this.startBlock();
  }

  // Starts typing the block at `this.index`.
  //
  // The wrapping is worked out once, up front, and baked into the string as real
  // newlines — a partial string re-wrapped every tick makes the last word on a
  // line hop down to the next one as it grows, which is the difference between a
  // typewriter and a jitter.
  startBlock() {
    this.label.setWordWrapWidth(PANEL_W - PAD * 2);
    // Trimmed: Phaser hands the wrap back with the space it broke on still on
    // the end of the line, which would type out as a stray character.
    this.full = this.label
      .getWrappedText(this.blocks[this.index])
      .map((line) => line.trim())
      .join('\n');
    this.label.setWordWrapWidth(null);
    this.shown = 0;
    this.label.setText('');
    this.caret.setVisible(false);
    this.stopTimers();
    this.timer = this.scene.time.addEvent({
      delay: CHAR_MS,
      loop: true,
      callback: () => this.revealOne(),
    });
  }

  revealOne() {
    this.shown += 1;
    this.label.setText(this.full.slice(0, this.shown));
    // Whitespace makes no sound: a blip on a space reads as a stutter.
    if (this.shown % BLIP_EVERY === 0 && !/\s/.test(this.full[this.shown - 1])) playTextBlip();
    if (this.shown >= this.full.length) this.finishBlock();
  }

  // Everything the block says is on screen — either because it typed itself out
  // or because the player asked for it all at once.
  finishBlock() {
    this.stopTimers();
    this.shown = this.full.length;
    this.label.setText(this.full);
    this.caret.setVisible(true);
    this.blink = this.scene.time.addEvent({
      delay: BLINK_MS,
      loop: true,
      callback: () => this.caret.setVisible(!this.caret.visible),
    });
  }

  // Whether the block on screen has finished typing — which is what decides
  // what the next tap does.
  isBlockDone() {
    return this.shown >= this.full.length;
  }

  // The one control the panel has. A tap mid-sentence puts the rest of it up at
  // once, a tap on a finished block moves to the next one, and a tap on the last
  // block closes the panel and hands the game back.
  advance() {
    if (!this.open) return;
    playTap();
    if (!this.isBlockDone()) return this.finishBlock();
    if (this.index + 1 < this.blocks.length) {
      this.index += 1;
      return this.startBlock();
    }
    this.hide();
  }

  stopTimers() {
    if (this.timer) this.timer.remove(false);
    if (this.blink) this.blink.remove(false);
    this.timer = null;
    this.blink = null;
  }

  hide() {
    this.stopTimers();
    this.container.setVisible(false);
    this.container.removeAll(true);
    this.label = null;
    this.caret = null;
    this.open = false;
    const done = this.onClose;
    this.onClose = null;
    if (done) done();
  }

  // What is actually on screen, for the suite: which block of how many, the
  // characters of it revealed so far, and whether it has finished typing. Null
  // while the panel is closed (TESTING.md).
  viewState() {
    if (!this.open) return null;
    return {
      index: this.index,
      blocks: this.blocks.length,
      shown: this.label.text,
      full: this.full,
      done: this.isBlockDone(),
    };
  }
}
