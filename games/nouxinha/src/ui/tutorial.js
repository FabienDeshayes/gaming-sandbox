// The tutorial, on screen: the lessons read out on the text panel, the arrow
// that points at what they are about, and the step that is refused for
// wandering off the route (DESIGN.md §4.13).
//
// What counts as having done a lesson, where the route runs and what the arrow
// points at in the world are all core/tutorial.js's, read off the run; what is
// said is `TUTORIAL` in src/text.js. This is only the part with a screen in it
// — and the part that remembers which lesson is next (`setTutorialStep` in
// src/config.js), since that belongs to the player rather than to a campaign.
//
// It is driven off the scene's own frame loop rather than hooked into every
// overlay: a lesson waits for whatever is on screen — the chest's own panel,
// the hut's question, an item card — to be closed, and then says its piece.
// Polling one small state machine a frame costs nothing, and it means nothing
// else in the scene has to know the tutorial exists beyond the three calls it
// makes (`update`, `allows`, `noteEquip`).

import {
  GAME_WIDTH,
  TILE,
  VIEW_CX,
  VIEW_CY,
  VIEW_H,
  getPalette,
  getTutorialStep,
  setTutorial,
  setTutorialStep,
} from '../config.js';
import { BASE_X, BASE_Y } from '../core/world.js';
import { DIRECTIONS, canStepOnto } from '../core/rules.js';
import {
  TUTORIAL_STEPS,
  tutorialAllows,
  tutorialBearing,
  tutorialDone,
  tutorialPlan,
  tutorialTarget,
} from '../core/tutorial.js';
import { landmarkDef } from '../data/landmarks.js';
import { SIGNPOST, TUTORIAL } from '../text.js';

// The parts of the HUD a lesson can be about, as the box drawn round each —
// read off the layout in ui/hud.js, ui/dpad.js and the cogwheel in
// scenes/ExploreScene.js.
const HUD_BOXES = {
  explored: { x: 8, y: 630, w: 134, h: 26 },
  coins: { x: 146, y: 630, w: 112, h: 26 },
  slots: { x: 8, y: 658, w: 222, h: 60 },
  light: { x: 8, y: 720, w: 232, h: 40 },
  water: { x: 8, y: 764, w: 232, h: 40 },
  dpad: { x: 250, y: 626, w: 222, h: 222 },
  menu: { x: GAME_WIDTH - 68, y: 8, w: 60, h: 46 },
};

// What each block of each lesson points at and where the panel reads it from,
// block for block with `TUTORIAL` in src/text.js. A point is a HUD box, the
// character, the hut, or `target` — whatever the lesson is sending the player
// to (core/tutorial.js `tutorialTarget`). A block about the HUD reads from the
// top of the screen, so the panel is not covering the thing it is about.
const POINTS = {
  intro: [
    { point: 'wizard' },
    { point: 'hut' },
    { point: 'water', at: 'top' },
    { point: 'water', at: 'top' },
    { point: 'light', at: 'top' },
    { point: 'dpad', at: 'top' },
  ],
  post: [{ point: 'target' }],
  postRead: [{ point: null }],
  chest: [{ point: 'target' }],
  chestOpened: [
    { point: 'coins', at: 'top' },
    { point: 'explored', at: 'top' },
    { point: 'menu' },
  ],
  landmark: [{ point: 'target' }],
  landmarkTouched: [{ point: null }],
  torch: [{ point: 'target' }],
  equip: [
    { point: 'slots', at: 'top' },
    { point: 'slots', at: 'top' },
  ],
  gem: [{ point: 'target' }],
  end: [{ point: 'wizard' }, { point: null }, { point: 'hut' }, { point: null }],
};

// What a lesson points at while the player is walking it rather than reading
// it: the thing it sends them to, or — for the one lesson about the HUD — the
// part of the HUD it is about.
const GUIDES = { equip: 'slots' };

// What each lesson says after it has been done: the explanation the game's own
// panel for the thing leaves out.
const DEBRIEFS = { post: 'postRead', chest: 'chestOpened', landmark: 'landmarkTouched', gem: 'end' };

const ARROW_W = 22;
const ARROW_H = 18;
const ARROW_GAP = 6;
const BOB = 5;
const BOB_MS = 180;
// How far in from the edge of the viewport an arrow pointing at something off
// screen stands, and how far above a tile one pointing at something on screen.
const EDGE_INSET = 30;
const DEPTH = 260;

export class Tutorial {
  // `fresh` is a walk that has just come out of the hut door or off a slot,
  // which is read the lesson it is on again as a reminder; a walk handed back
  // from Settings has only just been told, and isn't.
  constructor(scene, { fresh }) {
    this.scene = scene;
    this.plan = tutorialPlan(scene.run.seed);
    // A page closed halfway through the last lesson comes back to the lesson
    // before it, which the gem already in hand then finishes at once.
    this.index = Math.min(getTutorialStep(), TUTORIAL_STEPS.length - 1);
    this.briefed = !fresh;
    this.finished = false;
    this.speaking = false;
    this.pointing = null;
    this.noted = { equipped: false };

    const pal = getPalette();
    // The arrow is drawn pointing down with its tip on its origin, and turned
    // to point anywhere else.
    this.arrow = scene.add.graphics().setDepth(DEPTH).setVisible(false);
    this.arrow.fillStyle(pal.fg, 1);
    this.arrow.lineStyle(3, pal.bg, 1);
    const points = [
      { x: 0, y: 0 },
      { x: -ARROW_W / 2, y: -ARROW_H },
      { x: ARROW_W / 2, y: -ARROW_H },
    ];
    this.arrow.strokePoints(points, true);
    this.arrow.fillPoints(points, true);
    this.box = scene.add.graphics().setDepth(DEPTH).setVisible(false);
    this.boxColour = pal.fg;
  }

  // Whether the lesson about to be read is the very first one — which the
  // scene reads instead of the usual setting-out blocks, rather than after them.
  speaksFirst() {
    return !this.briefed && this.index === 0;
  }

  // Whether a step in `direction` is one the tutorial lets through. A step into
  // something solid is always let through to `step`, which turns it into the
  // bump it is — that is how a post is read and a chest is opened.
  allows(direction) {
    if (this.finished) return true;
    const run = this.scene.run;
    const dir = DIRECTIONS[direction];
    if (!dir) return true;
    const x = run.x + dir.dx;
    const y = run.y + dir.dy;
    if (!canStepOnto(run, x, y)) return true;
    return tutorialAllows(this.plan, run, x, y);
  }

  // What the status line says when a step is refused: where the arrow is
  // pointing, and which way that lies from here.
  offPathLine() {
    const id = TUTORIAL_STEPS[this.index];
    const run = this.scene.run;
    const target = tutorialTarget(id, this.plan, run);
    if (!target) return TUTORIAL.offPathEquip;
    const thing = id === 'landmark' ? landmarkDef(this.plan.landmark.id).name : TUTORIAL.things[id];
    return TUTORIAL.offPath(thing, SIGNPOST.bearings[tutorialBearing(run, target)]);
  }

  // The one thing the run can't say for itself: that a light was chosen off
  // its card.
  noteEquip() {
    this.noted.equipped = true;
  }

  // Once a frame, from the scene.
  update() {
    if (this.finished) return;
    const scene = this.scene;
    if (scene.modalOpen()) {
      // Our own panel keeps its pointer; anything else on screen has the
      // screen to itself.
      if (this.speaking) this.draw();
      else this.hide();
      return;
    }
    this.speaking = false;
    this.pointing = null;

    const id = TUTORIAL_STEPS[this.index];
    const done = tutorialDone(id, this.plan, scene.run, this.noted);
    // A lesson already done by the time it comes up — the gem picked up before
    // the torch was equipped — is never asked for: it goes straight to what it
    // has left to say. The opening lesson is the exception, being done the
    // moment it has been read.
    if (!this.briefed) {
      this.briefed = true;
      if ((!done || id === 'intro') && this.say(this.blocks(id), () => this.update())) return;
    }

    if (done) {
      this.advance(id);
      return;
    }

    this.pointing = GUIDES[id] || 'target';
    this.draw();
  }

  // A lesson done: what it leaves to say, and the next lesson's opening, read
  // as one panel so the one never flickers off screen before the other.
  advance(id) {
    const blocks = DEBRIEFS[id] ? this.blocks(DEBRIEFS[id]) : [];
    const next = this.index + 1;
    if (next >= TUTORIAL_STEPS.length) {
      setTutorialStep(next);
      if (!this.say(blocks, () => this.finish())) this.finish();
      return;
    }
    this.index = next;
    this.briefed = true;
    setTutorialStep(next);
    const nextId = TUTORIAL_STEPS[next];
    const brief = tutorialDone(nextId, this.plan, this.scene.run, this.noted) ? [] : this.blocks(nextId);
    if (!this.say([...blocks, ...brief], () => this.update())) this.update();
  }

  // The last lesson read: the tutorial is over, and off until Settings says
  // otherwise.
  finish() {
    this.finished = true;
    setTutorial(false);
    this.hide();
    this.arrow.destroy();
    this.box.destroy();
  }

  // One lesson's words, each with what it points at. The headings and names
  // are worked out from where the player is standing when the lesson opens.
  blocks(key) {
    const run = this.scene.run;
    const plan = this.plan;
    const heading = (to) => SIGNPOST.bearings[tutorialBearing(run, to)];
    const name = landmarkDef(plan.landmark.id).name;
    const words = {
      intro: () => TUTORIAL.intro,
      post: () => TUTORIAL.post(heading(plan.post)),
      postRead: () => TUTORIAL.postRead,
      chest: () => TUTORIAL.chest(heading(plan.chest), name),
      chestOpened: () => TUTORIAL.chestOpened,
      landmark: () => TUTORIAL.landmark(name),
      landmarkTouched: () => TUTORIAL.landmarkTouched,
      torch: () => TUTORIAL.torch(heading(plan.gem)),
      equip: () => TUTORIAL.equip,
      gem: () => TUTORIAL.gem,
      end: () => TUTORIAL.end,
    }[key]();
    return words.map((text, i) => ({ text, ...(POINTS[key][i] || {}) }));
  }

  // Reads blocks on the panel, moving the pointer as each one starts. Returns
  // whether there was anything to read. The callbacks above hand straight back
  // to `update` on the way out, so a lesson that is already done — a chest
  // opened before the post was read — is said in the same frame the last panel
  // closed in, rather than one frame of bare screen later.
  say(blocks, onClose = null) {
    if (!blocks.length) return false;
    this.speaking = true;
    this.scene.textPanel.show(blocks, onClose, {
      onBlock: (i, block) => {
        this.pointing = block.point || null;
        this.draw();
      },
    });
    return true;
  }

  hide() {
    this.arrow.setVisible(false);
    this.box.setVisible(false);
  }

  // Puts the pointer where `this.pointing` says, this frame: a box round a
  // part of the HUD, or an arrow at a tile — standing over it when it is on
  // screen, and on the edge of the viewport pointing its way when it is not.
  draw() {
    this.hide();
    const point = this.pointing;
    if (!point) return;
    const now = this.scene.time.now;

    const hud = HUD_BOXES[point];
    if (hud) {
      this.box.clear();
      this.box.lineStyle(3, this.boxColour, 0.6 + 0.4 * Math.sin(now / BOB_MS));
      this.box.strokeRect(hud.x, hud.y, hud.w, hud.h);
      this.box.setVisible(true);
      return;
    }

    const tile = this.tileFor(point);
    if (!tile) return;
    const run = this.scene.run;
    const layer = this.scene.map.layer;
    const sx = VIEW_CX + (tile.x - run.x) * TILE + layer.x;
    const sy = VIEW_CY + (tile.y - run.y) * TILE + layer.y;
    const bob = BOB * Math.sin(now / BOB_MS);

    const onScreen =
      sx > TILE / 2 && sx < GAME_WIDTH - TILE / 2 && sy > TILE * 1.5 && sy < VIEW_H - TILE / 2;
    if (onScreen) {
      this.arrow.setPosition(sx, sy - TILE / 2 - ARROW_GAP - bob).setRotation(0);
    } else {
      // Along the line from the character to the thing, to where it leaves an
      // inset rectangle just inside the viewport.
      const dx = sx - VIEW_CX;
      const dy = sy - VIEW_CY;
      const reach = Math.min(
        dx ? (GAME_WIDTH / 2 - EDGE_INSET) / Math.abs(dx) : Infinity,
        dy ? (VIEW_H / 2 - EDGE_INSET) / Math.abs(dy) : Infinity
      );
      const angle = Math.atan2(dy, dx);
      this.arrow
        .setPosition(
          VIEW_CX + dx * reach + Math.cos(angle) * bob,
          VIEW_CY + dy * reach + Math.sin(angle) * bob
        )
        .setRotation(angle - Math.PI / 2);
    }
    this.arrow.setVisible(true);
  }

  tileFor(point) {
    const run = this.scene.run;
    if (point === 'wizard') return { x: run.x, y: run.y };
    if (point === 'hut') return { x: BASE_X, y: BASE_Y };
    if (point === 'target') return tutorialTarget(TUTORIAL_STEPS[this.index], this.plan, run);
    return null;
  }

  // Where the pointer is, for the suite: a HUD box by name, or a world tile.
  viewState() {
    return {
      step: TUTORIAL_STEPS[this.index],
      finished: this.finished,
      pointing: this.pointing,
      target: this.finished ? null : tutorialTarget(TUTORIAL_STEPS[this.index], this.plan, this.scene.run),
    };
  }
}
