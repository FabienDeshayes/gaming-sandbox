// The slot picker: which of the three campaigns this is (DESIGN.md §6.1).
//
// Both ways in come through here. NEW GAME lists every slot and starts a fresh
// campaign in the one tapped; LOAD GAME lists them too but only the used ones
// answer, so the screen always says what is in all three either way — a picker
// that hid the empty slots would make "how many have I got left" unanswerable.
//
// A slot can also be in the middle of an expedition, saved there by the
// cogwheel menu (DESIGN.md §6.1). LOAD GAME picks that walk back up where it
// was left, which is why the row says so: what a slot answers with is the
// difference between setting out from the hut and carrying on from wherever
// you stopped.
//
// Overwriting asks twice with the row itself, the way Settings' erase does: the
// first tap on an occupied slot arms it, the second starts over it. That is the
// only destructive thing on this screen, and it is the only place a campaign
// can be lost by accident.

import { FONT, GAME_WIDTH, gemColour, getPalette, hex } from '../config.js';
import { loadSlot, MAX_GEMS, slots, startSlot } from '../core/save.js';
import { DEFAULT_SEED, biomeOf } from '../core/world.js';
import { biomeDef } from '../data/biomes.js';
import { progressLine, SLOTS } from '../text.js';
import { ensureTextures, preloadTiles } from '../ui/textures.js';
import { makeButton } from '../ui/button.js';
import { playTap } from '../ui/sfx.js';
import { startMusic } from '../ui/music.js';

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
    // The menu loop, carried on from the title screen (ui/music.js).
    startMusic('menu');
    this.mode = (data && data.mode) === 'load' ? 'load' : 'new';
    // Which occupied row is one tap away from being written over. Only ever set
    // in `new` mode, and cleared by tapping anything else.
    this.armed = 0;

    this.add
      .text(cx, 110, this.mode === 'load' ? SLOTS.headingLoad : SLOTS.headingNew, {
        fontFamily: FONT,
        fontSize: '28px',
        color: hex(pal.fg),
      })
      .setOrigin(0.5);

    this.hint = this.add
      .text(
        cx,
        150,
        this.mode === 'load' ? SLOTS.hintLoad : SLOTS.hintNew,
        { fontFamily: FONT, fontSize: '12px', color: hex(pal.fg) }
      )
      .setOrigin(0.5)
      .setAlpha(0.6);

    this.rows = slots().map((entry, i) => this.buildRow(entry, FIRST_ROW_Y + i * (ROW_H + ROW_GAP), pal));

    makeButton(this, cx, 700, SLOTS.back, () => this.scene.start('TitleScene'), { width: 240 });
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
      .text(left + 20, y + 26, SLOTS.slotName(entry.slot), {
        fontFamily: FONT,
        fontSize: '18px',
        color: hex(pal.fg),
      })
      .setOrigin(0, 0.5)
      .setAlpha(alpha);

    // Which world this campaign walks, by name. A slot's seed says which kind of
    // world it is (`biomeOf`), so this is the one thing on the row that is about
    // the ground rather than about the walking — and it is what makes three
    // slots read as three places instead of three numbers.
    if (entry.used)
      this.add
        .text(left + ROW_W - 20, y + 26, worldOf(entry), {
          fontFamily: FONT,
          fontSize: '12px',
          color: hex(pal.fg),
        })
        .setOrigin(1, 0.5)
        .setAlpha(usable ? 0.7 : 0.3);

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

    // How many worlds this campaign has already had taken off it in the hall
    // (DESIGN.md §4.9) — the one line on the row that is about the campaign
    // rather than about the world it is standing in, which is exactly why it
    // sits under the name of that world. Nothing is drawn until there is one.
    if (entry.save.cycles)
      this.add
        .text(left + ROW_W - 20, y + 82, SLOTS.cycles(entry.save.cycles), {
          fontFamily: FONT,
          fontSize: '11px',
          color: hex(pal.fg),
        })
        .setOrigin(1, 0.5)
        .setAlpha(usable ? 0.5 : 0.25);

    // The same gem pips the title screen shows, so a slot is recognisable by
    // how much colour it has brought home rather than by its number. A
    // suspended expedition hasn't banked what it's carrying yet, but it isn't
    // lost either — LOAD GAME hands it straight back — so the row counts
    // whichever is higher rather than only what the hut has written down.
    const gems = gemsOf(entry);
    for (let i = 1; i <= MAX_GEMS; i++) {
      const held = i <= gems;
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
    zone.on('pointerdown', () => {
      pressed = true;
      playTap();
    });
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
        row.status.setText(row.entry.slot === entry.slot ? SLOTS.confirmOverwrite : summaryOf(row.entry));
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
  if (!entry.used) return SLOTS.empty;
  const { save } = entry;
  return progressLine(gemsOf(entry), MAX_GEMS, save.coins, save.runs);
}

// What a slot has to show for gems: the banked count, or the run's own if a
// suspended expedition is carrying more — it hasn't been written down at the
// hut, but resuming hands it straight back, so it isn't missing either.
function gemsOf(entry) {
  const { save } = entry;
  return save.run ? Math.max(save.gems, save.run.gems) : save.gems;
}

// The kind of world a slot was given. A campaign started before slots had worlds
// of their own has no seed of its own either, and walks the world every campaign
// used to (`createRun` in core/rules.js), so it is named the same way.
function worldOf(entry) {
  return biomeDef(biomeOf(entry.save.seed || DEFAULT_SEED)).name;
}

// The ground a slot has drawn is the half of it that survives a bad walk home
// (DESIGN.md §6.1), so the picker reports it next to the progress that doesn't
// — unless the slot is holding a saved expedition, which is the more urgent
// thing to say about it: this row is a walk to carry on, not a walk to start.
function groundOf(entry) {
  if (!entry.used) return SLOTS.neverWalked;
  const { run } = entry.save;
  if (run) return SLOTS.suspended(run.furthest, run.steps);
  return SLOTS.furthest(entry.save.furthest);
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
