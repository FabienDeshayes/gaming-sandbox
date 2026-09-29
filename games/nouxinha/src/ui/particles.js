// Particles: weather, embers, and the little bursts that mark a moment.
//
// Nothing here is game state. A particle is a single *art pixel* — one pixel of
// a 16x16 tile, so SPRITE_SCALE screen pixels square — snapped to the same grid
// the tiles are drawn on, and tinted like everything else (DESIGN.md §9): the
// palette's foreground, or a colour the campaign has already brought back. It is
// never stored, never read by a rule, and a page with PARTICLES off in Settings
// draws none of it at all.
//
// They live in world space, inside the map's own layer, so a step slides them
// with the ground: embers you walk away from stay behind, and weather is
// something you walk through rather than a film over the glass.
//
// **How bright a particle is, is the tile it is over.** Weather fills the whole
// viewport — that is what makes it weather — but it is drawn at full strength
// in the light, at the remembered strength over ground the run has seen, faintly
// over the dark it hasn't, and not at all past the edge of the world. None of it
// ever reacts to what is under it, so the faint snow over the unknown says
// nothing about what the unknown holds: the light is still the only thing that
// shows the world (DESIGN.md §4).

import {
  GAME_WIDTH,
  PARTICLE_ALPHA,
  SPRITE_SCALE,
  TILE,
  VIEW_CX,
  VIEW_CY,
  VIEW_H,
  gemColour,
  getPalette,
  getParticles,
} from '../config.js';
import { beyondEdge, chokeAt, wisps } from '../core/world.js';
import { activeLight, chokeGrace, isBlackout, tileKey } from '../core/rules.js';
import { biomeDef } from '../data/biomes.js';
import { itemDef } from '../data/items.js';

const PX = SPRITE_SCALE;
// How far past the viewport a particle may be before weather wraps it round:
// a step slides the layer a whole tile, and a flake should not pop in at the
// edge while it does.
const MARGIN = TILE * 1.5;
const HALF_W = GAME_WIDTH / 2 + MARGIN;
const HALF_H = VIEW_H / 2 + MARGIN;
// A cap on the one-off effects, so a pile of them in one moment can't run away.
const MAX_FX = 500;

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const snap = (v) => Math.floor(v / PX) * PX;

// --- Weather -----------------------------------------------------------------
//
// One kind per biome (`weather` in src/data/biomes.js), and each is three
// things: how many are on screen at once, how one starts, and how it moves.
// Every one of them wraps round the viewport rather than dying, so the screen
// holds the same density however far the character walks.
//
// `cells` is the shape one is drawn as, in art pixels trailing back from its
// head — a streak for anything fast, a single pixel for anything that drifts.
export const WEATHER = {
  // Rain over the temperate world, falling a little slantwise, in streaks.
  rain: {
    count: 72,
    spawn: (p) => {
      p.vy = rand(520, 640);
      p.cells = [[0, 0], [0, -1], [-1, -2], [-1, -3]];
    },
    move: (p, dt) => {
      p.x += p.vy * 0.22 * dt;
      p.y += p.vy * dt;
    },
  },
  // Snow drifting down in the frozen world, each flake swaying on its own.
  snow: {
    count: 140,
    spawn: (p) => {
      p.vy = rand(28, 62);
      p.sway = rand(0.8, 1.8);
      p.phase = rand(0, Math.PI * 2);
    },
    move: (p, dt, t) => {
      p.x += (10 + Math.sin(t * p.sway + p.phase) * 16) * dt;
      p.y += p.vy * dt;
    },
  },
  // Sand in the desert: blown sideways in gusts. When the wind drops most of
  // it settles out of the air, and when it picks up again it comes back as
  // streaks — the gust is one number for the whole screen, so it reads as wind
  // rather than as grains each going their own way.
  sand: {
    count: 90,
    spawn: (p) => {
      p.threshold = Math.random();
      p.speed = rand(0.7, 1.3);
      p.phase = rand(0, Math.PI * 2);
    },
    move: (p, dt, t) => {
      const gust = sandGust(t);
      const vx = (40 + 336 * gust) * p.speed;
      p.x += vx * dt;
      p.y += Math.sin(t * 2 + p.phase) * 12 * dt;
      p.glow = gust + 0.3 > p.threshold ? 1 : 0;
      p.cells = vx > 264 ? [[0, 0], [-1, 0], [-2, 0]] : vx > 144 ? [[0, 0], [-1, 0]] : null;
    },
  },
  // Motes rising through the mystical realm, twinkling as they go.
  motes: {
    count: 66,
    spawn: (p) => {
      p.vy = -rand(12, 30);
      p.phase = rand(0, Math.PI * 2);
      p.twinkle = rand(1.5, 3.5);
    },
    move: (p, dt, t) => {
      p.x += Math.sin(t * 0.9 + p.phase) * 10 * dt;
      p.y += p.vy * dt;
      p.glow = 0.35 + 0.65 * Math.max(0, Math.sin(t * p.twinkle + p.phase));
    },
  },
};

// The desert's wind, 0 (still) to 1 (a full gust): never quite still, with a
// long swell and a shorter one riding on it, so the gusts come unevenly.
function sandGust(t) {
  const swell = Math.max(0, Math.sin(t * 0.55)) ** 2;
  const flutter = 0.5 + 0.5 * Math.sin(t * 1.7 + 1.3);
  return Math.min(1, 0.12 + swell * (0.6 + 0.4 * flutter));
}

// `?weather=snow` (or rain, sand, motes, none) on the URL puts any
// weather in any world — the quickest way to look at all of them.
const ASKED_WEATHER = (() => {
  try {
    return new URLSearchParams(location.search).get('weather');
  } catch (e) {
    return null;
  }
})();

// The weathers that lie on the ground as well as falling through the air, so a
// step kicks some of it up (`footfall`).
const LOOSE_GROUND = new Set(['snow', 'sand']);

// --- Embers ------------------------------------------------------------------

// How many embers a second the light in hand sheds: the bigger the light, the
// more of them. None in blackout, which is its own kind of signal.
const LIGHT_EMBERS = { 'torch-small': 0.8, 'torch-medium': 1.6, 'torch-lamp': 2.4, 'torch-beacon': 4.5 };
// And a wisp, from the tip of its flame (the tip's pixel on its rest pose).
const WISP_EMBERS = 1.3;
const WISP_TIP = { x: 7.5 * PX - TILE / 2, y: 2 * PX - TILE / 2 };

export class Particles {
  constructor(scene, map) {
    this.scene = scene;
    this.map = map;
    // Over the tiles, under the character — who is not in the layer at all.
    this.g = scene.add.graphics();
    map.layer.add(this.g);
    this.weather = [];
    this.fx = [];
    this.run = null;
    this.last = null;
    this.debt = new Map();
    // What the last frame drew, by what it was drawn over, and the brightest
    // pixel drawn over the unknown — read by the tests, which is how one can
    // check the dark stays dark without reading pixels off the canvas.
    this.frame = { lit: 0, remembered: 0, dark: 0, darkMax: 0 };
  }

  // The world these particles are in. Called once the run is known, and again
  // whenever the scene is handed a different one.
  setRun(run) {
    this.run = run;
    const kind = ASKED_WEATHER || biomeDef(run.biome).weather;
    this.kind = WEATHER[kind] || null;
    this.loose = LOOSE_GROUND.has(kind);
    this.weather = [];
    if (!this.kind) return;
    const cx = run.x * TILE;
    const cy = run.y * TILE;
    for (let i = 0; i < this.kind.count; i++) {
      const p = { x: cx + rand(-HALF_W, HALF_W), y: cy + rand(-HALF_H, HALF_H), glow: 1, cells: null };
      this.kind.spawn(p);
      this.weather.push(p);
    }
  }

  // Once a frame, off the scene's loop.
  update() {
    const now = this.scene.time.now;
    const dt = this.last === null ? 0 : Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.g.clear();
    this.frame = { lit: 0, remembered: 0, dark: 0, darkMax: 0 };
    if (!getParticles() || !this.run) return;
    const t = now / 1000;
    const run = this.run;
    const cx = run.x * TILE;
    const cy = run.y * TILE;

    // Weather: moved, wrapped round the viewport, drawn.
    if (this.kind)
      for (const p of this.weather) {
        this.kind.move(p, dt, t);
        if (p.x < cx - HALF_W) p.x += HALF_W * 2;
        else if (p.x > cx + HALF_W) p.x -= HALF_W * 2;
        if (p.y < cy - HALF_H) p.y += HALF_H * 2;
        else if (p.y > cy + HALF_H) p.y -= HALF_H * 2;
        if (p.glow > 0) this.draw(p, getPalette().fg, p.glow);
      }

    this.shed(dt);

    // The one-off effects: moved, aged, and dropped once they are spent.
    this.fx = this.fx.filter((p) => (p.age += dt) < p.life);
    for (const p of this.fx) {
      const fade = p.fadeIn ? Math.min(1, p.age / p.fadeIn) : 1;
      const left = 1 - p.age / p.life;
      if (p.ring) {
        this.drawRing(p, p.colour, left * fade);
        continue;
      }
      p.vx += (p.ax || 0) * dt;
      p.vy += (p.ay || 0) * dt;
      if (p.drag) {
        p.vx *= Math.max(0, 1 - p.drag * dt);
        p.vy *= Math.max(0, 1 - p.drag * dt);
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      this.draw(p, p.colour, (p.fade === false ? 1 : left) * fade);
    }
  }

  // --- Drawing ----------------------------------------------------------------

  // How bright anything is over a given world pixel: whatever its tile is drawn
  // at, faint over the unknown, and nothing past the edge (above).
  alphaAt(wx, wy) {
    const tx = Math.round(wx / TILE);
    const ty = Math.round(wy / TILE);
    const shown = this.map.shownAlpha.get(tileKey(tx, ty));
    if (shown !== undefined) return shown === 1 ? PARTICLE_ALPHA.lit : PARTICLE_ALPHA.remembered;
    return beyondEdge(tx, ty) ? 0 : PARTICLE_ALPHA.dark;
  }

  // One art pixel, at a world pixel, as bright as the tile under it allows.
  pixel(wx, wy, colour, strength) {
    const over = this.alphaAt(wx, wy);
    const alpha = strength * over;
    if (alpha <= 0.01) return;
    if (over === PARTICLE_ALPHA.lit) this.frame.lit++;
    else if (over === PARTICLE_ALPHA.remembered) this.frame.remembered++;
    else {
      this.frame.dark++;
      this.frame.darkMax = Math.max(this.frame.darkMax, alpha);
    }
    this.g.fillStyle(colour, alpha);
    this.g.fillRect(wx + VIEW_CX - this.run.x * TILE, wy + VIEW_CY - this.run.y * TILE, PX, PX);
  }

  // One particle, head first then its trail, each art pixel lit by its own tile.
  draw(p, colour, strength) {
    if (strength <= 0) return;
    for (const [cx, cy] of p.cells || [[0, 0]])
      this.pixel(snap(p.x) + cx * PX, snap(p.y) + cy * PX, colour, strength);
  }

  // A ring spreading out from a point, drawn one art pixel at a time round its
  // circumference — only the arc that is actually on screen, so a ring twenty
  // tiles across costs what the part of it you can see costs.
  drawRing(p, colour, strength) {
    const r = p.r0 + (p.r1 - p.r0) * (p.age / p.life);
    if (r <= 0) return;
    const step = PX / r;
    const left = this.run.x * TILE - HALF_W;
    const right = this.run.x * TILE + HALF_W;
    const top = this.run.y * TILE - HALF_H;
    const bottom = this.run.y * TILE + HALF_H;
    for (let a = 0; a < Math.PI * 2; a += step) {
      const wx = snap(p.x + Math.cos(a) * r);
      const wy = snap(p.y + Math.sin(a) * r);
      if (wx < left || wx > right || wy < top || wy > bottom) continue;
      this.pixel(wx, wy, colour, strength);
    }
  }

  // --- What sheds particles on its own ------------------------------------------

  // Embers off every light on screen, and motes blowing out towards the edge of
  // the world. Rates are per second; `debt` carries the fraction of a particle
  // owed from one frame to the next, so a slow rate still sheds on time.
  shed(dt) {
    const run = this.run;
    const owe = (key, rate) => {
      const due = (this.debt.get(key) || 0) + rate * dt;
      const whole = Math.floor(due);
      this.debt.set(key, due - whole);
      return whole;
    };

    // The light in hand: embers off the top of the character, in the colour
    // the light itself is drawn in.
    const light = activeLight(run);
    if (light && !isBlackout(run)) {
      const colour = gemColour(itemDef(light.id).hue || 0);
      for (let n = owe('light', LIGHT_EMBERS[light.id] || 1); n > 0; n--)
        this.ember(run.x * TILE + rand(-12, 12), run.y * TILE - rand(12, 20), colour);
    }

    // Every wisp in view: an ember off the tip of its flame, in the colour the
    // tip is painted (gem three's, once it is held — src/data/paint.js).
    const tip = run.gems >= 3 ? gemColour(3) : getPalette().fg;
    for (const wisp of wisps(run.seed)) {
      if (Math.abs(wisp.x - run.x) > 6 || Math.abs(wisp.y - run.y) > 8) continue;
      for (let n = owe(wisp.id, WISP_EMBERS); n > 0; n--)
        this.ember(wisp.x * TILE + WISP_TIP.x + rand(-3, 3), wisp.y * TILE + WISP_TIP.y, tip);
    }

    // The edge of the world: once the dark has started eating the light
    // (`chokeAt`), motes drift outward across the screen and are gone past the
    // rim — the more of the light it has taken, the more of them.
    const choke = chokeAt(run.x, run.y, chokeGrace(run));
    const pull = Math.max(0, Math.min(1, (6 - choke) / 5));
    if (pull > 0) {
      const d = Math.hypot(run.x, run.y) || 1;
      const ux = run.x / d;
      const uy = run.y / d;
      for (let n = owe('edge', 14 * pull); n > 0; n--) {
        const speed = rand(30, 60) * (0.6 + pull);
        this.add({
          x: run.x * TILE + rand(-HALF_W, HALF_W),
          y: run.y * TILE + rand(-HALF_H, HALF_H),
          vx: ux * speed + rand(-6, 6),
          vy: uy * speed + rand(-6, 6),
          life: rand(1.6, 3),
          fadeIn: 0.5,
          colour: getPalette().fg,
        });
      }
    }
  }

  ember(x, y, colour) {
    this.add({
      x,
      y,
      vx: rand(-8, 8),
      vy: -rand(22, 40),
      ax: rand(-10, 10),
      life: rand(0.8, 1.6),
      colour,
    });
  }

  add(p) {
    if (!getParticles() || this.fx.length >= MAX_FX) return;
    this.fx.push({ age: 0, vx: 0, vy: 0, ...p });
  }

  // --- Moments ------------------------------------------------------------------
  //
  // Called by the scene. Every position is a world tile; each effect works out
  // its own world pixels from there.

  // A handful of pixels thrown out from a tile's centre in every direction.
  burst(tx, ty, colour, { count = 10, speed = [50, 110], life = [0.35, 0.6], drag = 3 } = {}) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(...speed);
      this.add({
        x: tx * TILE,
        y: ty * TILE,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        drag,
        life: rand(...life),
        colour,
      });
    }
  }

  // A ring spreading from a tile, out to `tiles` tiles, over `seconds`.
  ring(tx, ty, colour, tiles, seconds) {
    this.add({ ring: true, x: tx * TILE, y: ty * TILE, r0: TILE / 2, r1: tiles * TILE, life: seconds, colour });
  }

  // Something picked up off the ground: a small burst in the colour it lay
  // there in.
  pickup(tx, ty, colour) {
    this.burst(tx, ty, colour, { count: 10 });
  }

  // A gem: the first time its colour is anywhere on screen, so it arrives as a
  // real burst and a ring of it opening out across the ground.
  gem(tx, ty, colour) {
    this.burst(tx, ty, colour, { count: 40, speed: [70, 220], life: [0.6, 1.2], drag: 2.5 });
    this.ring(tx, ty, colour, 5, 1.2);
  }

  // A lid thrown up: a fan of pixels up out of the chest and falling back, in
  // the foreground and whichever colours its fittings already wear.
  chest(tx, ty, colours) {
    for (let i = 0; i < 18; i++)
      this.add({
        x: tx * TILE + rand(-12, 12),
        y: ty * TILE - 6,
        vx: rand(-70, 70),
        vy: -rand(140, 230),
        ay: 480,
        life: rand(0.55, 0.85),
        colour: pick(colours),
      });
  }

  // A gate giving: dust shaken down off its arch onto whoever walked through.
  gate(tx, ty) {
    for (let i = 0; i < 14; i++)
      this.add({
        x: tx * TILE + rand(-20, 20),
        y: ty * TILE - rand(18, 24),
        vx: rand(-6, 6),
        vy: rand(10, 35),
        ay: 70,
        life: rand(0.7, 1.2),
        colour: getPalette().fg,
      });
  }

  // A landmark's standing, earned: a ring in the colour it has just started
  // wearing, and a scatter of the same.
  standing(tx, ty, colour) {
    this.burst(tx, ty, colour, { count: 20, speed: [60, 140], life: [0.5, 0.9] });
    this.ring(tx, ty, colour, 3.5, 0.9);
  }

  // The Drowned Bell tolling: a ring off the bell, out to as far as it can be
  // heard — sweeping across the screen from wherever it stands, off it or on.
  toll(tx, ty, colour, tiles) {
    this.ring(tx, ty, colour, tiles, tiles / 7);
  }

  // Walking into something solid, from `fromX, fromY` a step `dir`: grit off
  // the face of rock or masonry, or a leaf or two off a tree, on the side the
  // character is on.
  bump(fromX, fromY, dir, tree) {
    const x = (fromX + dir.dx / 2) * TILE;
    const y = (fromY + dir.dy / 2) * TILE;
    for (let i = 0; i < (tree ? 2 : 5); i++)
      this.add({
        x: x + (dir.dx ? 0 : rand(-12, 12)),
        y: y + (dir.dy ? 0 : rand(-12, 12)),
        vx: -dir.dx * rand(20, 60) + rand(-15, 15),
        vy: tree ? rand(8, 20) : -dir.dy * rand(20, 60) - rand(10, 30),
        ay: tree ? 10 : 260,
        life: tree ? rand(0.9, 1.4) : rand(0.3, 0.5),
        colour: getPalette().fg,
      });
  }

  // A foot coming down on loose ground (sand, snow): a puff where the step
  // pushed off from, settling almost at once. Nothing on firm ground.
  footfall(tx, ty) {
    if (!this.loose) return;
    for (let i = 0; i < 4; i++)
      this.add({
        x: tx * TILE + rand(-10, 10),
        y: ty * TILE + rand(12, 20),
        vx: rand(-30, 30),
        vy: -rand(10, 30),
        drag: 5,
        life: rand(0.3, 0.5),
        colour: getPalette().fg,
      });
  }
}
