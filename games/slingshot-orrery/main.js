const GAME_WIDTH = 480;
const GAME_HEIGHT = 854;
const O = window.Orrery;
const MISSIONS = window.MISSIONS;

const CELL = 27;
const BX = Math.floor((GAME_WIDTH - O.N * CELL) / 2); // board left
const BY = 74; // board top
const FONT = 'monospace';

const COLORS = {
  bg: 0x0b0e1a,
  grid: 0x1b2238,
  sun: 0xffc94a,
  planet: 0x5aa9ff,
  ember: 0xff7a45,
  moon: 0xc8c8d8,
  target: 0x4dff9a,
  probe: 0xffffff,
  path: 0x9ae6ff,
  crash: 0xff4d4d,
  repel: 0xff5c8a,
};
const bodyColor = (b) => (b.kind === 'sun' ? COLORS.sun : b.kind === 'moon' ? COLORS.moon : b.id === 'ember' ? COLORS.ember : COLORS.planet);
const cx = (x) => BX + x * CELL + CELL / 2;
const cy = (y) => BY + y * CELL + CELL / 2;
const ARROWS = { coast: '•', up: '↑', down: '↓', left: '←', right: '→' };

function makeButton(scene, x, y, w, h, label, onClick, opts = {}) {
  const bg = scene.add.rectangle(x, y, w, h, opts.color || 0x26304d).setStrokeStyle(2, 0x4a5a85).setInteractive({ useHandCursor: true });
  const txt = scene.add.text(x, y, label, { fontFamily: FONT, fontSize: opts.size || '20px', color: '#ffffff' }).setOrigin(0.5);
  bg.on('pointerover', () => { bg.setFillStyle(opts.hover || 0x3a4870); if (opts.onOver) opts.onOver(); });
  bg.on('pointerout', () => { bg.setFillStyle(bg.getData('base') || opts.color || 0x26304d); if (opts.onOut) opts.onOut(); });
  bg.on('pointerdown', onClick);
  bg.setData('base', opts.color || 0x26304d);
  return { bg, txt, setBase(c) { bg.setData('base', c); bg.setFillStyle(c); }, destroy() { bg.destroy(); txt.destroy(); } };
}

class TitleScene extends Phaser.Scene {
  constructor() { super('TitleScene'); }

  create() {
    const c = GAME_WIDTH / 2;
    this.add.text(c, 120, 'Slingshot\nOrrery', { fontFamily: FONT, fontSize: '52px', color: '#ffc94a', align: 'center' }).setOrigin(0.5);
    this.add.text(c, 215, 'a clockwork gravity puzzle', { fontFamily: FONT, fontSize: '16px', color: '#8fa0c8' }).setOrigin(0.5);

    const how = [
      'HOW TO PLAY',
      '',
      '• Each turn your probe moves by its velocity.',
      '• Coast for free, or burn 1 fuel to nudge',
      '  velocity one square (↑ ↓ ← →).',
      '• Ending a turn next to the Sun or a planet',
      '  bends you 1 square toward it. Moons push',
      '  you 1 square away.',
      '• Planets step along their orbits each turn.',
      '• The dotted line shows your next 8 turns.',
      '  Pick a move to preview it, ENGAGE to commit.',
      '• Stop on the green beacon to win. Hitting a',
      '  body or leaving the chart loses. UNDO is free.',
    ];
    this.add.text(30, 260, how.join('\n'), { fontFamily: FONT, fontSize: '15px', color: '#d8e0f5', lineSpacing: 4 });

    makeButton(this, c, 600, 200, 60, 'PLAY', () => this.scene.start('PlayScene', { index: 0 }), { size: '28px', color: 0x2c6e4a, hover: 0x3a9463 });
    this.add.text(c, 670, 'or jump to a mission', { fontFamily: FONT, fontSize: '14px', color: '#8fa0c8' }).setOrigin(0.5);
    MISSIONS.forEach((m, i) => {
      makeButton(this, c + (i - 2) * 70, 715, 56, 46, String(i + 1), () => this.scene.start('PlayScene', { index: i }));
    });
  }
}

class PlayScene extends Phaser.Scene {
  constructor() { super('PlayScene'); }

  init(data) {
    this.index = data.index || 0;
    this.mission = MISSIONS[this.index];
  }

  create() {
    this.history = [O.initialState(this.mission)];
    this.selected = 'coast';
    this.hover = null;
    this.overlay = null;

    this.gfx = this.add.graphics();
    this.labels = this.add.container(0, 0);

    this.add.text(12, 10, `MISSION ${this.index + 1}/${MISSIONS.length}  ${this.mission.name.toUpperCase()}`, { fontFamily: FONT, fontSize: '17px', color: '#ffc94a' });
    this.hud = this.add.text(12, 38, '', { fontFamily: FONT, fontSize: '15px', color: '#d8e0f5' });
    makeButton(this, 440, 22, 64, 32, 'MENU', () => this.scene.start('TitleScene'), { size: '14px' });

    const infoY = BY + O.N * CELL + 10;
    this.brief = this.add.text(12, infoY, this.mission.brief, { fontFamily: FONT, fontSize: '13px', color: '#8fa0c8', wordWrap: { width: 456 } });
    this.info = this.add.text(12, infoY + 40, '', { fontFamily: FONT, fontSize: '14px', color: '#ffffff', wordWrap: { width: 456 }, lineSpacing: 3 });

    // D-pad of moves
    const px = 120, py = 735;
    this.moveButtons = {};
    const pos = { up: [0, -58], down: [0, 58], left: [-72, 0], right: [72, 0], coast: [0, 0] };
    for (const a of Object.keys(pos)) {
      const b = makeButton(this, px + pos[a][0], py + pos[a][1], a === 'coast' ? 64 : 64, 50, a === 'coast' ? 'COAST' : ARROWS[a], () => this.select(a), {
        size: a === 'coast' ? '14px' : '26px',
        onOver: () => { this.hover = a; this.redraw(); },
        onOut: () => { this.hover = null; this.redraw(); },
      });
      this.moveButtons[a] = b;
    }
    this.engageBtn = makeButton(this, 360, 700, 180, 64, 'ENGAGE', () => this.engage(), { size: '24px', color: 0x2c6e4a, hover: 0x3a9463 });
    makeButton(this, 315, 780, 88, 44, 'UNDO', () => this.undo(), { size: '16px' });
    makeButton(this, 408, 780, 88, 44, 'RESET', () => this.reset(), { size: '16px' });

    const k = this.input.keyboard;
    if (k) {
      k.on('keydown-UP', () => this.select('up'));
      k.on('keydown-DOWN', () => this.select('down'));
      k.on('keydown-LEFT', () => this.select('left'));
      k.on('keydown-RIGHT', () => this.select('right'));
      k.on('keydown-C', () => this.select('coast'));
      k.on('keydown-SPACE', () => this.engage());
      k.on('keydown-ENTER', () => this.engage());
      k.on('keydown-U', () => this.undo());
      k.on('keydown-BACKSPACE', () => this.undo());
    }
    this.redraw();
  }

  get state() { return this.history[this.history.length - 1]; }

  canDo(a) { return a === 'coast' || this.state.fuel > 0; }

  select(a) {
    if (this.overlay) return;
    if (!this.canDo(a)) { this.flash = 'No fuel left: you can only coast.'; this.redraw(); return; }
    // Tapping the already-selected move commits it (quick play on touch).
    if (this.selected === a && this.lastSelectAt && this.time.now - this.lastSelectAt < 600) { this.engage(); return; }
    this.selected = a;
    this.lastSelectAt = this.time.now;
    this.flash = null;
    this.redraw();
  }

  engage() {
    if (this.overlay || this.state.status !== 'flying') return;
    if (!this.canDo(this.selected)) this.selected = 'coast';
    const n = O.step(this.mission, this.state, this.selected);
    this.history.push(n);
    this.selected = 'coast';
    this.flash = null;
    this.redraw();
    if (n.status !== 'flying') this.time.delayedCall(350, () => this.showEnd());
  }

  undo() {
    if (this.history.length <= 1) return;
    this.closeOverlay();
    this.history.pop();
    this.selected = 'coast';
    this.redraw();
  }

  reset() {
    this.closeOverlay();
    this.history = [O.initialState(this.mission)];
    this.selected = 'coast';
    this.redraw();
  }

  closeOverlay() {
    if (this.overlay) { this.overlay.forEach((o) => o.destroy()); this.overlay = null; }
  }

  showEnd() {
    if (this.overlay) return;
    const s = this.state;
    const won = s.status === 'won';
    const items = [];
    items.push(this.add.rectangle(240, 330, 400, 230, 0x0b0e1a, 0.94).setStrokeStyle(3, won ? COLORS.target : COLORS.crash));
    items.push(this.add.text(240, 260, won ? 'DOCKED!' : 'MISSION FAILED', { fontFamily: FONT, fontSize: '30px', color: won ? '#4dff9a' : '#ff4d4d' }).setOrigin(0.5));
    const sub = won ? `Turn ${s.t}, fuel left ${s.fuel}/${this.mission.fuel}` : s.note + '\nUndo to see where the plan went wrong.';
    items.push(this.add.text(240, 315, sub, { fontFamily: FONT, fontSize: '15px', color: '#d8e0f5', align: 'center', wordWrap: { width: 370 } }).setOrigin(0.5));
    const last = this.index === MISSIONS.length - 1;
    if (won) {
      if (last) items.push(this.add.text(240, 355, 'All missions complete!', { fontFamily: FONT, fontSize: '16px', color: '#ffc94a' }).setOrigin(0.5));
      const next = makeButton(this, 160, 400, 140, 48, last ? 'TITLE' : 'NEXT', () => {
        if (last) this.scene.start('TitleScene'); else this.scene.start('PlayScene', { index: this.index + 1 });
      }, { color: 0x2c6e4a, hover: 0x3a9463 });
      const retry = makeButton(this, 320, 400, 140, 48, 'REPLAY', () => this.reset());
      items.push(next, retry);
    } else {
      items.push(makeButton(this, 160, 400, 140, 48, 'UNDO', () => this.undo()));
      items.push(makeButton(this, 320, 400, 140, 48, 'RETRY', () => this.reset(), { color: 0x2c6e4a, hover: 0x3a9463 }));
    }
    this.overlay = items;
  }

  redraw() {
    const g = this.gfx;
    const m = this.mission;
    const s = this.state;
    g.clear();
    this.labels.removeAll(true);

    // Board
    g.fillStyle(COLORS.bg, 1).fillRect(BX, BY, O.N * CELL, O.N * CELL);
    g.lineStyle(1, COLORS.grid, 1);
    for (let i = 0; i <= O.N; i++) {
      g.lineBetween(BX + i * CELL, BY, BX + i * CELL, BY + O.N * CELL);
      g.lineBetween(BX, BY + i * CELL, BX + O.N * CELL, BY + i * CELL);
    }

    const bodies = O.bodiesAt(m, s.t);
    const byId = {};
    bodies.forEach((b) => { byId[b.id] = b; });

    // Orbits (square rings)
    for (const def of m.bodies) {
      const c = byId[def.around || 'sun'];
      g.lineStyle(1, bodyColor(def), 0.28);
      g.strokeRect(cx(c.x - def.r), cy(c.y - def.r), def.r * 2 * CELL, def.r * 2 * CELL);
    }

    // Gravity zones (the 8 cells around each body)
    for (const b of bodies) {
      const repel = b.kind === 'moon';
      g.fillStyle(repel ? COLORS.repel : bodyColor(b), 0.12);
      g.fillRect(BX + (b.x - 1) * CELL, BY + (b.y - 1) * CELL, CELL * 3, CELL * 3);
    }

    // Choose the move to preview: hover wins over the selection.
    const action = this.hover && this.canDo(this.hover) ? this.hover : this.selected;
    const path = s.status === 'flying' ? O.predict(m, s, action) : [];

    // Future body positions for the preview window, numbered to match the path.
    for (let k = 1; k <= path.length; k++) {
      for (const b of O.bodiesAt(m, s.t + k)) {
        if (b.kind === 'sun') continue;
        g.fillStyle(bodyColor(b), 0.35).fillCircle(cx(b.x), cy(b.y), 3);
        if (k === path.length || k % 2 === 0) this.label(cx(b.x) + 5, cy(b.y) - 9, String(k), '#' + bodyColor(b).toString(16).padStart(6, '0'), 9, 0.7);
      }
    }

    // Beacon
    const tx = cx(m.target.x), ty = cy(m.target.y);
    g.lineStyle(2, COLORS.target, 1).strokeRect(tx - 10, ty - 10, 20, 20);
    g.fillStyle(COLORS.target, 1).fillTriangle(tx, ty - 7, tx + 7, ty, tx, ty + 7).fillTriangle(tx, ty - 7, tx - 7, ty, tx, ty + 7);

    // Bodies
    for (const b of bodies) {
      const r = b.kind === 'sun' ? 11 : b.kind === 'moon' ? 6 : 9;
      g.fillStyle(bodyColor(b), 1).fillCircle(cx(b.x), cy(b.y), r);
    }

    // Past trail
    g.lineStyle(2, 0x5a6a90, 0.8);
    for (let i = 1; i < this.history.length; i++) {
      const a = this.history[i - 1], b = this.history[i];
      g.lineBetween(cx(a.x), cy(a.y), cx(b.x), cy(b.y));
    }

    // Predicted path
    let prev = s;
    path.forEach((p, i) => {
      const col = p.status === 'crashed' || p.status === 'lost' ? COLORS.crash : COLORS.path;
      this.dashed(g, cx(prev.x), cy(prev.y), cx(p.x), cy(p.y), col);
      if (p.status === 'flying' || p.status === 'timeout') {
        g.fillStyle(COLORS.path, 1).fillCircle(cx(p.x), cy(p.y), 3.5);
        if (p.pulls.length) g.lineStyle(2, 0xffe08a, 1).strokeCircle(cx(p.x), cy(p.y), 7);
        this.label(cx(p.x) - 12, cy(p.y) - 12, String(i + 1), '#9ae6ff', 10);
      }
      if (p.status === 'won') g.lineStyle(3, COLORS.target, 1).strokeCircle(cx(p.x), cy(p.y), 13);
      if (p.status === 'crashed' || p.status === 'lost') {
        const X = Math.max(BX, Math.min(BX + O.N * CELL, cx(p.x))), Y = Math.max(BY, Math.min(BY + O.N * CELL, cy(p.y)));
        g.lineStyle(3, COLORS.crash, 1).lineBetween(X - 7, Y - 7, X + 7, Y + 7).lineBetween(X - 7, Y + 7, X + 7, Y - 7);
      }
      prev = p;
    });

    // Probe + velocity arrow (velocity after any burn being previewed)
    const px = cx(s.x), py = cy(s.y);
    g.fillStyle(COLORS.probe, 1).fillCircle(px, py, 6);
    g.lineStyle(2, 0x000000, 1).strokeCircle(px, py, 6);
    if (s.status === 'flying') {
      const burn = O.ACTIONS[action];
      const vx = s.vx + burn.x, vy = s.vy + burn.y;
      g.lineStyle(3, 0xffffff, 0.9).lineBetween(px, py, px + vx * CELL * 0.8, py + vy * CELL * 0.8);
    }

    // HUD
    const pips = '■'.repeat(s.fuel) + '□'.repeat(Math.max(0, m.fuel - s.fuel));
    this.hud.setText(`Fuel ${pips} ${s.fuel}/${m.fuel}   Turn ${s.t}/${m.turns}   Vel (${s.vx},${s.vy})`);

    // Info line: what the previewed move does
    let txt = '';
    if (this.flash) txt = this.flash;
    else if (s.status === 'flying') {
      const end = path[path.length - 1];
      const name = action === 'coast' ? 'Coast' : 'Burn ' + ARROWS[action] + ' (-1 fuel)';
      const firstPull = path.findIndex((p) => p.pulls.length);
      let outcome;
      if (end.status === 'won') outcome = `reaches the beacon on turn ${end.t}.`;
      else if (end.status === 'crashed' || end.status === 'lost') outcome = `${end.note.replace('.', '')} on turn ${end.t}.`;
      else if (end.status === 'timeout') outcome = 'runs out of time.';
      else outcome = 'no arrival within 8 turns.';
      txt = `${name}, then coast: ${outcome}`;
      if (firstPull >= 0) {
        const p = path[firstPull];
        txt += `\nTurn ${p.t}: ` + p.pulls.map((q) => `${q.by} ${q.x === 0 && q.y === 0 ? '' : 'bends you (' + q.x + ',' + q.y + ')'}`).join(', ') + '.';
      }
    } else txt = s.note;
    const last = this.history.length > 1 ? this.state : null;
    if (last && last.pulls && last.pulls.length && !this.flash) txt = `Last turn: ${last.pulls.map((q) => q.by + ' (' + q.x + ',' + q.y + ')').join(', ')}\n` + txt;
    this.info.setText(txt);

    // Button states
    for (const [a, b] of Object.entries(this.moveButtons)) {
      const can = this.canDo(a);
      b.setBase(a === this.selected ? 0x7a5a1a : can ? 0x26304d : 0x14182a);
      b.txt.setAlpha(can ? 1 : 0.3);
    }
    this.engageBtn.txt.setText(this.selected === 'coast' ? 'ENGAGE\ncoast' : 'ENGAGE\nburn ' + ARROWS[this.selected]);
    this.engageBtn.txt.setFontSize(this.selected === 'coast' ? 20 : 20);
    this.engageBtn.txt.setAlign('center');
  }

  label(x, y, text, color, size, alpha = 1) {
    this.labels.add(this.add.text(x, y, text, { fontFamily: FONT, fontSize: size + 'px', color }).setAlpha(alpha));
  }

  dashed(g, x1, y1, x2, y2, col) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const n = Math.max(1, Math.floor(len / 6));
    g.lineStyle(2, col, 0.9);
    for (let i = 0; i < n; i += 2) {
      const a = i / n, b = Math.min(1, (i + 1) / n);
      g.lineBetween(x1 + (x2 - x1) * a, y1 + (y2 - y1) * a, x1 + (x2 - x1) * b, y1 + (y2 - y1) * b);
    }
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game',
  backgroundColor: '#05070f',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [TitleScene, PlayScene],
});
