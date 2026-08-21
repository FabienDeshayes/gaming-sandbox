// The slot picker: which of the three campaigns this is (DESIGN.md §6.1).
//
// Both ways in come through here. NEW GAME lists every slot and starts a fresh
// campaign in the one tapped; LOAD GAME lists them too but only the used ones
// answer, so the screen always says what is in all three either way — a picker
// that hid the empty slots would make "how many have I got left" unanswerable.
//
// Overwriting asks twice with the row itself, the way Settings' erase does: the
// first tap on an occupied slot arms it, the second starts over it. That is the
// only destructive thing on this screen, and it is the only place a campaign
// can be lost by accident.

import { FONT, GAME_WIDTH, gemColour, getPalette, hex } from '../config.js';
import { loadSlot, MAX_GEMS, slots, startSlot } from '../core/save.js';
import { ensureTextures, preloadTiles } from '../ui/textures.js';
import { makeButton } from '../ui/button.js';

const ROW_W = 400;
const ROW_H = 104;
const FIRST_ROW_Y = 210;
const ROW_GAP = 18;

export class SlotScene extends Phaser.Scene {
  constructor() {
    super('SlotScene');
  }

  preload() {
    preloadTiles(this);
  }

  create(data) {
    ensureTextures(this);
    const pal = getPalette();
    this.cameras.main.setBackgroundColor(pal.bg);
    const cx = GAME_WIDTH / 2;
    this.mode = (data && data.mode) === 'load' ? 'load' : 'new';
    // Which occupied row is one tap away from being written over. Only ever set
    // in `new` mode, and cleared by tapping anything else.
    this.armed = 0;

    this.add
      .text(cx, 110, this.mode === 'load' ? 'LOAD GAME' : 'NEW GAME', {
        fontFamily: FONT,
        fontSize: '28px',
        color: hex(pal.fg),
      })
      .setOrigin(0.5);

    this.hint = this.add
      .text(
        cx,
        150,
        this.mode === 'load' ? 'PICK A CAMPAIGN TO CARRY ON' : 'PICK A SLOT TO WALK OUT FROM',
        { fontFamily: FONT, fontSize: '12px', color: hex(pal.fg) }
      )
      .setOrigin(0.5)
      .setAlpha(0.6);

    this.rows = slots().map((entry, i) => this.buildRow(entry, FIRST_ROW_Y + i * (ROW_H + ROW_GAP), pal));

    makeButton(this, cx, 700, 'BACK', () => this.scene.start('TitleScene'), { width: 240 });
  }

  buildRow(entry, y, pal) {
    const cx = GAME_WIDTH / 2;
    const left = cx - ROW_W / 2;
    // In `load` mode an empty slot has nothing to open; in `new` mode every slot
    // is fair game, an occupied one at the price of a second tap.
    const usable = this.mode === 'new' || entry.used;
    const alpha = usable ? 1 : 0.3;

    const border = this.add.graphics();
    border.lineStyle(2, pal.fg, alpha);
    border.strokeRect(left, y, ROW_W, ROW_H);

    this.add
      .text(left + 20, y + 26, `SLOT ${entry.slot}`, {
        fontFamily: FONT,
        fontSize: '18px',
        color: hex(pal.fg),
      })
      .setOrigin(0, 0.5)
      .setAlpha(alpha);

    const status = this.add
      .text(left + 20, y + 58, summaryOf(entry), {
        fontFamily: FONT,
        fontSize: '12px',
        color: hex(pal.fg),
      })
      .setOrigin(0, 0.5)
      .setAlpha(usable ? 0.7 : 0.3);

    this.add
      .text(left + 20, y + 82, groundOf(entry), {
        fontFamily: FONT,
        fontSize: '11px',
        color: hex(pal.fg),
      })
      .setOrigin(0, 0.5)
      .setAlpha(usable ? 0.5 : 0.25);

    // The same gem pips the title screen shows, so a slot is recognisable by
    // how much colour it has brought home rather than by its number.
    for (let i = 1; i <= MAX_GEMS; i++) {
      const held = i <= entry.save.gems;
      this.add
        .image(left + ROW_W - 34 - (MAX_GEMS - i) * 34, y + ROW_H / 2, 'gem')
        .setScale(1.6)
        .setTint(held ? gemColour(i) : pal.fg)
        .setAlpha(held ? alpha : 0.2 * alpha);
    }

    const zone = this.add.zone(left, y, ROW_W, ROW_H).setOrigin(0);
    if (usable) zone.setInteractive({ useHandCursor: true });
    // Fire on release, not on touch-down (see ui/button.js) — a scene start on
    // pointerdown is what made a row sometimes need a second tap.
    let pressed = false;
    zone.on('pointerdown', () => (pressed = true));
    zone.on('pointerout', () => (pressed = false));
    zone.on('pointerup', () => {
      if (!pressed) return;
      pressed = false;
      this.pick(entry, status);
    });

    return { entry, status };
  }

  pick(entry, status) {
    if (this.mode === 'load') {
      if (!entry.used) return;
      loadSlot(entry.slot);
      this.start();
      return;
    }

    // Starting over a campaign is the one thing on this screen that destroys
    // something, so the row asks with itself before it does.
    if (entry.used && this.armed !== entry.slot) {
      this.armed = entry.slot;
      for (const row of this.rows)
        row.status.setText(row.entry.slot === entry.slot ? 'TAP AGAIN TO OVERWRITE' : summaryOf(row.entry));
      return;
    }

    startSlot(entry.slot);
    this.start();
  }

  start() {
    this.scene.start('ExploreScene', runOptions());
  }
}

function summaryOf(entry) {
  if (!entry.used) return 'EMPTY';
  const { save } = entry;
  return `${save.gems}/${MAX_GEMS} COLOURS  ${save.coins} COINS  ${save.runs} RUNS`;
}

// The ground a slot has drawn is the half of it that survives a bad walk home
// (DESIGN.md §6.1), so the picker reports it next to the progress that doesn't.
function groundOf(entry) {
  if (!entry.used) return 'NOTHING WALKED YET';
  return `FURTHEST OUT ${entry.save.furthest}`;
}

// The world is a pure function of a seed, and its consumables of a nonce
// (core/world.js), so naming both in the URL reproduces an expedition exactly:
// `?seed=1234&nonce=9` walks the same ground past the same coins. There is no UI
// for it because it is for sharing a world and for the suite, not for playing —
// leave them off and a run picks its own.
export function runOptions() {
  const params = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
  const asInt = (name) => {
    const raw = params.get(name);
    if (raw === null) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value | 0 : undefined;
  };
  return { seed: asInt('seed'), nonce: asInt('nonce') };
}
