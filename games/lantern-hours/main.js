const GAME_WIDTH = 480;
const GAME_HEIGHT = 854;
const TILE = 44;
const GX = 20; // grid origin
const GY = 92;

const C = {
  bg: 0x111111, floor: 0x2a2620, wall: 0x0b0a09, door: 0x6b4a2b, doorOiled: 0x4f6b3a,
  exit: 0x2f7d4f, loot: 0xf2c94c, player: 0x7fd3ff, guard: 0xe05a47, vision: 0xffe08a,
  plan: 0xff9d8a, noise: 0x9fb4ff, ok: 0x6fd08c, bad: 0xff4d4d,
};
const FONT = { fontFamily: 'sans-serif', color: '#eeeeee' };

function button(scene, x, y, label, onClick, opts = {}) {
  const t = scene.add.text(x, y, label, {
    ...FONT, fontSize: (opts.size || 22) + 'px', backgroundColor: opts.bg || '#333333',
    padding: { x: opts.padX || 16, y: 10 }, align: 'center', fixedWidth: opts.width || 0,
  }).setOrigin(0.5).setInteractive({ useHandCursor: true });
  t.baseBg = opts.bg || '#333333';
  t.on('pointerover', () => t.setStyle({ backgroundColor: '#555555' }));
  t.on('pointerout', () => t.setStyle({ backgroundColor: t.baseBg }));
  t.on('pointerdown', (p, lx, ly, ev) => { if (ev) ev.stopPropagation(); onClick(); });
  return t;
}

class TitleScene extends Phaser.Scene {
  constructor() { super('TitleScene'); }
  create() {
    const cx = GAME_WIDTH / 2;
    this.add.text(cx, 150, 'Lantern Hours', { ...FONT, fontSize: '48px', color: '#ffe08a' }).setOrigin(0.5);
    this.add.text(cx, 205, 'a turn-based manor heist', { ...FONT, fontSize: '18px', color: '#aaaaaa' }).setOrigin(0.5);
    const how = [
      'Each tap = one turn. Then every guard steps.',
      'Guards walk fixed loops. Their sight (yellow)',
      'and next 3 steps (numbered dots) are drawn.',
      'Stand in sight and you are caught.',
      '',
      'Creaky doors (brown) and grabbing loot make',
      'noise. Guards in the blue radius turn toward',
      'it for 2 turns. Herd them with noise.',
      '',
      'Tools: 2 pebbles (throw noise up to 4 tiles)',
      'and 1 oil can (silence an adjacent door).',
      'Loot is heavy: every few moves, guards get',
      'a double step. Grab loot, reach the green exit.',
      '',
      'Risky or noisy actions need a second tap.',
    ];
    this.add.text(cx, 440, how.join('\n'), { ...FONT, fontSize: '17px', align: 'center', lineSpacing: 4 }).setOrigin(0.5);
    button(this, cx, 700, 'Play', () => this.scene.start('GameScene'), { size: 32, padX: 40 });
  }
}

class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  create() {
    this.state = LH.newGame();
    this.history = [];
    this.mode = 'move';
    this.pending = null; // {kind, x, y, result}
    this.hover = null;
    this.g = this.add.graphics();
    this.labels = this.add.container(0, 0);

    this.hud = this.add.text(GX, 14, '', { ...FONT, fontSize: '17px', lineSpacing: 4 });
    this.info = this.add.text(GX, GY + 12 * TILE + 8, '', { ...FONT, fontSize: '15px', color: '#cccccc', wordWrap: { width: 440 }, lineSpacing: 3 });

    const by = 760;
    this.btns = {
      move: button(this, 70, by, 'Move', () => this.setMode('move'), { size: 18, width: 96 }),
      pebble: button(this, 180, by, '', () => this.setMode('pebble'), { size: 18, width: 110 }),
      oil: button(this, 298, by, '', () => this.setMode('oil'), { size: 18, width: 96 }),
      wait: button(this, 408, by, 'Wait', () => this.doAction({ kind: 'wait' }), { size: 18, width: 96 }),
    };
    button(this, 120, 815, 'Undo', () => this.undo(), { size: 16, width: 120 });
    button(this, 360, 815, 'Restart', () => this.scene.restart(), { size: 16, width: 120 });

    this.input.on('pointermove', (p) => { this.hover = this.cellAt(p); this.render(); });
    this.input.on('pointerdown', (p) => { const c = this.cellAt(p); if (c) this.tapCell(c[0], c[1]); });
    const kb = this.input.keyboard;
    if (kb) {
      const mv = (dx, dy) => { if (this.state.status === 'play') this.tapCell(this.state.player[0] + dx, this.state.player[1] + dy, true); };
      kb.on('keydown-UP', () => mv(0, -1));
      kb.on('keydown-DOWN', () => mv(0, 1));
      kb.on('keydown-LEFT', () => mv(-1, 0));
      kb.on('keydown-RIGHT', () => mv(1, 0));
      kb.on('keydown-SPACE', () => this.doAction({ kind: 'wait' }));
    }
    this.overlay = null;
    this.render();
  }

  cellAt(p) {
    const x = Math.floor((p.x - GX) / TILE), y = Math.floor((p.y - GY) / TILE);
    if (x < 0 || y < 0 || x >= this.state.w || y >= this.state.h) return null;
    return [x, y];
  }

  setMode(m) {
    if (this.state.status !== 'play') return;
    if (m === 'pebble' && this.state.tools.pebble <= 0) return;
    if (m === 'oil' && this.state.tools.oil <= 0) return;
    this.mode = m;
    this.pending = null;
    this.render();
  }

  simulate(a) {
    const s = this.state;
    if (a.kind === 'move') return LH.move(s, a.x, a.y);
    if (a.kind === 'pebble') return LH.throwPebble(s, a.x, a.y);
    if (a.kind === 'oil') return LH.oilDoor(s, a.x, a.y);
    if (a.kind === 'wait') return LH.wait(s);
    return null;
  }

  // Noise an action would make, for previews.
  noiseOf(a) {
    const s = this.state;
    if (a.kind === 'pebble') return { x: a.x, y: a.y, r: LH.NOISE.pebble };
    if (a.kind === 'move') {
      if (LH.isDoor(s, a.x, a.y) && !s.oiled[LH.key(a.x, a.y)]) return { x: a.x, y: a.y, r: LH.NOISE.door };
      if (s.loot.some(([lx, ly]) => lx === a.x && ly === a.y)) return { x: a.x, y: a.y, r: LH.NOISE.loot };
    }
    return null;
  }

  tapCell(x, y, fromKey) {
    const s = this.state;
    if (s.status !== 'play') return;
    let a = null;
    if (this.mode === 'move' && LH.canMoveTo(s, x, y)) a = { kind: 'move', x, y };
    else if (this.mode === 'pebble' && LH.canThrow(s, x, y)) a = { kind: 'pebble', x, y };
    else if (this.mode === 'oil' && LH.canOil(s, x, y)) a = { kind: 'oil', x, y };
    if (!a) { this.pending = null; this.inspect = [x, y]; this.render(); return; }
    this.inspect = null;
    const result = this.simulate(a);
    const risky = result.status === 'lost' || !!this.noiseOf(a) || a.kind === 'pebble';
    const same = this.pending && this.pending.kind === a.kind && this.pending.x === x && this.pending.y === y;
    if (risky && !same) { this.pending = { ...a, result }; this.render(); return; }
    this.doAction(a, result);
  }

  doAction(a, result) {
    if (this.state.status !== 'play') return;
    result = result || this.simulate(a);
    if (!result) return;
    this.history.push(this.state);
    this.state = result;
    this.pending = null;
    if (a.kind !== 'move' && a.kind !== 'wait') this.mode = 'move';
    if (this.mode === 'pebble' && this.state.tools.pebble <= 0) this.mode = 'move';
    this.render();
  }

  undo() {
    if (!this.history.length) return;
    this.state = this.history.pop();
    this.pending = null;
    this.render();
  }

  px(x) { return GX + x * TILE; }
  py(y) { return GY + y * TILE; }

  label(x, y, str, size, color) {
    const t = this.add.text(x, y, str, { ...FONT, fontSize: size + 'px', color: color || '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
    this.labels.add(t);
    return t;
  }

  shadeTile(x, y, color, alpha) {
    this.g.fillStyle(color, alpha);
    this.g.fillRect(this.px(x) + 1, this.py(y) + 1, TILE - 2, TILE - 2);
  }

  render() {
    const s = this.state;
    const g = this.g;
    g.clear();
    this.labels.removeAll(true);

    // Tiles
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
      const c = LH.tileAt(s, x, y);
      let col = C.floor;
      if (c === '#') col = C.wall;
      else if (c === 'D') col = s.oiled[LH.key(x, y)] ? C.doorOiled : C.door;
      else if (c === 'X') col = C.exit;
      g.fillStyle(col, 1);
      g.fillRect(this.px(x), this.py(y), TILE, TILE);
      if (c !== '#') { g.lineStyle(1, 0x000000, 0.35); g.strokeRect(this.px(x), this.py(y), TILE, TILE); }
      if (c === 'D') this.label(this.px(x) + TILE / 2, this.py(y) + TILE / 2, s.oiled[LH.key(x, y)] ? 'oil' : 'D', 12, '#e8d2b0');
      if (c === 'X') this.label(this.px(x) + TILE / 2, this.py(y) + TILE / 2, 'EXIT', 11);
    }

    // Preview of pending action, or the hovered tile's options
    const preview = this.pending;
    const pState = preview ? preview.result : null;

    // Vision cones (current)
    for (const gd of s.guards) for (const [x, y] of LH.visionTiles(s, gd)) this.shadeTile(x, y, C.vision, 0.42);

    // Mode targets
    if (s.status === 'play') {
      if (this.mode === 'move') {
        for (const [dx, dy] of Object.values(LH.DIRS)) {
          const x = s.player[0] + dx, y = s.player[1] + dy;
          if (!LH.canMoveTo(s, x, y)) continue;
          const r = LH.move(s, x, y);
          const danger = r.status === 'lost';
          g.lineStyle(3, danger ? C.bad : C.ok, 0.9);
          g.strokeRect(this.px(x) + 3, this.py(y) + 3, TILE - 6, TILE - 6);
          if (danger) this.label(this.px(x) + TILE - 9, this.py(y) + 10, '!', 14, '#ff6b6b');
          else if (this.noiseOf({ kind: 'move', x, y })) this.label(this.px(x) + TILE - 9, this.py(y) + 10, '♪', 13, '#9fb4ff');
        }
      } else if (this.mode === 'pebble') {
        for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (LH.canThrow(s, x, y)) this.shadeTile(x, y, C.noise, 0.12);
      } else if (this.mode === 'oil') {
        for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (LH.canOil(s, x, y)) {
          g.lineStyle(3, C.ok, 0.9); g.strokeRect(this.px(x) + 3, this.py(y) + 3, TILE - 6, TILE - 6);
        }
      }
    }

    // Noise radius preview (pending action, else hovered target)
    let na = preview;
    if (!na && this.hover && s.status === 'play') {
      const [hx, hy] = this.hover;
      if (this.mode === 'pebble' && LH.canThrow(s, hx, hy)) na = { kind: 'pebble', x: hx, y: hy };
      if (this.mode === 'move' && LH.canMoveTo(s, hx, hy)) na = { kind: 'move', x: hx, y: hy };
    }
    const noise = na ? this.noiseOf(na) : null;
    let hitNames = [];
    if (noise) {
      for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
        if (!LH.isWall(s, x, y) && LH.manhattan(x, y, noise.x, noise.y) <= noise.r) this.shadeTile(x, y, C.noise, 0.3);
      }
      const hit = LH.noiseHits(s, noise.x, noise.y, noise.r);
      hitNames = hit.map((h) => h.name);
      for (const h of hit) {
        const [hx, hy] = LH.guardPos(h);
        g.lineStyle(3, C.noise, 1);
        g.strokeCircle(this.px(hx) + TILE / 2, this.py(hy) + TILE / 2, TILE / 2 - 1);
      }
    }

    // Guard plans: next 3 positions
    for (const gd of s.guards) {
      const plan = LH.guardPlan(gd, 3);
      plan.forEach(([x, y], i) => {
        const cx = this.px(x) + TILE / 2 + (i - 1) * 4, cy = this.py(y) + TILE / 2;
        g.fillStyle(C.plan, 0.75 - i * 0.18);
        g.fillCircle(cx, cy, 8);
        this.label(cx, cy, String(i + 1), 11, '#2a0d08');
      });
    }

    // Loot
    for (const [x, y] of s.loot) {
      g.fillStyle(C.loot, 1);
      g.fillRect(this.px(x) + 12, this.py(y) + 12, TILE - 24, TILE - 24);
      this.label(this.px(x) + TILE / 2, this.py(y) + TILE / 2, '$', 14, '#3a2a00');
    }

    // Guards
    for (const gd of s.guards) {
      const [x, y] = LH.guardPos(gd);
      const cx = this.px(x) + TILE / 2, cy = this.py(y) + TILE / 2;
      g.fillStyle(C.guard, 1);
      g.fillCircle(cx, cy, 15);
      const [fx, fy] = gd.face;
      g.fillStyle(0xffffff, 1);
      g.fillTriangle(cx + fx * 20, cy + fy * 20, cx + fx * 9 - fy * 7, cy + fy * 9 + fx * 7, cx + fx * 9 + fy * 7, cy + fy * 9 - fx * 7);
      this.label(cx, cy, gd.distracted > 0 ? '?' + gd.distracted : gd.name[0], 13);
    }

    // Player
    {
      const [x, y] = s.player;
      const cx = this.px(x) + TILE / 2, cy = this.py(y) + TILE / 2;
      g.fillStyle(C.player, 1);
      g.fillCircle(cx, cy, 13);
      g.lineStyle(2, 0x000000, 0.6);
      g.strokeCircle(cx, cy, 13);
      if (s.carried) this.label(cx, cy, String(s.carried), 13, '#06222e');
    }

    // Pending marker
    if (preview) {
      g.lineStyle(3, 0xffffff, 1);
      g.strokeRect(this.px(preview.x) + 1, this.py(preview.y) + 1, TILE - 2, TILE - 2);
    }

    // HUD
    const every = LH.heavyEvery(s);
    const heavyTxt = every ? (LH.nextMoveIsHeavy(s) ? 'NEXT MOVE HEAVY (guards step twice)' : 'heavy every ' + every + ' moves (' + (every - (s.heavyCount % every) - 1) + ' light left)') : 'light (no loot)';
    this.hud.setText([
      'Turn ' + s.turn + '   Loot carried ' + s.carried + '/' + (s.carried + s.loot.length) + '   Pebbles ' + s.tools.pebble + '  Oil ' + s.tools.oil,
      'Load: ' + heavyTxt,
      'Noise radius: door ' + LH.NOISE.door + ', loot ' + LH.NOISE.loot + ', pebble ' + LH.NOISE.pebble + '. Guards turn 2 turns.',
    ].join('\n'));
    this.hud.setFontSize(14);

    // Info line
    let info = '';
    if (preview) {
      const r = preview.result;
      const verb = preview.kind === 'move' ? 'Move here' : preview.kind === 'pebble' ? 'Throw pebble here' : 'Oil this door';
      info = verb + (noise ? ' - noise ' + noise.r + (hitNames.length ? ', turns ' + hitNames.join(', ') : ', nobody hears') : '') + '.\n';
      info += r.status === 'lost' ? 'You would be SEEN. Tap again to do it anyway.' : r.status === 'won' ? 'You would escape! Tap again.' : 'Safe. Tap again to confirm.';
    } else if (this.inspect) {
      const [ix, iy] = this.inspect;
      const gd = s.guards.find((q) => { const [gx, gy] = LH.guardPos(q); return gx === ix && gy === iy; });
      if (gd) info = gd.name + ' guard: ' + (gd.distracted ? 'turned toward a noise for ' + gd.distracted + ' more turn(s), then resumes its loop.' : 'patrolling a ' + gd.path.length + '-step loop. Sees ' + LH.VISION + ' tiles ahead.');
      else info = this.mode === 'move' ? 'Tap a green-outlined tile next to you to move.' : this.mode === 'pebble' ? 'Pebble: tap a tile within ' + LH.PEBBLE_RANGE + ' steps (blue).' : 'Oil: tap a creaky door next to you.';
    } else {
      const last = s.log.slice(-2).join('  |  ');
      const modeTxt = this.mode === 'move' ? 'MOVE: tap a green tile (red ! = you would be seen).' : this.mode === 'pebble' ? 'PEBBLE: tap a tile in range to preview its noise.' : 'OIL: tap an adjacent door to silence it.';
      info = modeTxt + (last ? '\n' + last : '');
    }
    this.info.setText(info);

    // Buttons
    this.btns.pebble.setText('Pebble x' + s.tools.pebble);
    this.btns.oil.setText('Oil x' + s.tools.oil);
    for (const [k, b] of Object.entries(this.btns)) {
      const active = k === this.mode;
      b.baseBg = active ? '#6b5a1f' : '#333333';
      b.setStyle({ backgroundColor: b.baseBg });
      b.setAlpha((k === 'pebble' && !s.tools.pebble) || (k === 'oil' && !s.tools.oil) ? 0.4 : 1);
    }

    if (s.status !== 'play' && !this.overlay) this.showEnd();
    if (s.status === 'play' && this.overlay) { this.overlay.destroy(true); this.overlay = null; }
  }

  showEnd() {
    const s = this.state;
    const won = s.status === 'won';
    const cont = this.add.container(0, 0);
    const bg = this.add.rectangle(GAME_WIDTH / 2, 380, 400, 250, 0x000000, 0.85).setStrokeStyle(2, won ? C.ok : C.bad);
    const total = s.carried + s.loot.length;
    const msg = won ? 'Escaped!\n' + s.carried + ' of ' + total + ' loot in ' + s.turn + ' turns' : 'Caught!\n' + s.log[s.log.length - 1];
    const t = this.add.text(GAME_WIDTH / 2, 330, msg, { ...FONT, fontSize: '26px', align: 'center', color: won ? '#9ff0b5' : '#ff8a80' }).setOrigin(0.5);
    const again = button(this, GAME_WIDTH / 2 - 90, 440, 'Play again', () => this.scene.restart(), { size: 20 });
    const undo = button(this, GAME_WIDTH / 2 + 100, 440, won ? 'Title' : 'Undo', () => (won ? this.scene.start('TitleScene') : this.undo()), { size: 20 });
    cont.add([bg, t, again, undo]);
    this.overlay = cont;
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game',
  backgroundColor: '#111111',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [TitleScene, GameScene],
});
