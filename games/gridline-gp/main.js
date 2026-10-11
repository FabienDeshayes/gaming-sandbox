const GAME_WIDTH = 480;
const GAME_HEIGHT = 854;
const GL = window.Gridline;

const CELL = 22;
const BOARD_X = 20;
const BOARD_Y = 128;
const FONT = 'sans-serif';

const C = {
  grass: 0x1d3322,
  grassLine: 0x22392a,
  track: 0x3a3b42,
  trackLine: 0x474852,
  pit: 0x5b5122,
  white: 0xffffff,
  ok0: 0xffffff,
  ok1: 0xffd23f,
  ok2: 0xff8a3d,
  bad: 0xff4d4d,
};

const HELP = [
  'Two laps, clockwise. Finish first to win.',
  '',
  'Each turn your car moves by its velocity.',
  'You may change velocity by -1, 0 or +1 on',
  'each axis: the 9 dots ahead of you are the',
  'squares you can reach. Tap one to preview,',
  'tap it again (or Go) to drive there.',
  '',
  'Tyres: each axis you change costs 1 tyre.',
  'At 0 tyres you can change only one axis per',
  'turn. Brake early: corners eat rubber.',
  '',
  'Pit: end a move on a yellow PIT square.',
  'Fresh tyres, but the stop costs 3 turns.',
  '',
  'Rivals follow the same rules (some have a',
  'speed cap) and show their next 2 moves.',
  'No two cars share a square, so you can',
  'block a rival\'s next square. Leave the',
  'track and the move is not allowed. No legal',
  'move at all? You spin and stop.',
];

function makeButton(scene, x, y, label, onClick, opts = {}) {
  const bg = opts.bg || '#333333';
  const hover = opts.hover || '#555555';
  const t = scene.add
    .text(x, y, label, {
      fontFamily: FONT,
      fontSize: opts.size || '22px',
      color: '#ffffff',
      backgroundColor: bg,
      padding: { x: opts.padX ?? 16, y: opts.padY ?? 8 },
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });
  t.on('pointerover', () => t.setStyle({ backgroundColor: hover }));
  t.on('pointerout', () => t.setStyle({ backgroundColor: bg }));
  t.on('pointerdown', onClick);
  if (opts.depth) t.setDepth(opts.depth);
  return t;
}

const cx = (x) => BOARD_X + x * CELL + CELL / 2;
const cy = (y) => BOARD_Y + y * CELL + CELL / 2;

class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create() {
    const mid = GAME_WIDTH / 2;
    this.add.text(mid, 170, 'Gridline GP', { fontFamily: FONT, fontSize: '58px', color: '#ffd23f', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(mid, 228, 'turn-based racing on graph paper', { fontFamily: FONT, fontSize: '19px', color: '#9aa0b0' }).setOrigin(0.5);

    // checkered strip
    const g = this.add.graphics();
    for (let i = 0; i < 24; i++) {
      for (let j = 0; j < 2; j++) {
        g.fillStyle((i + j) % 2 ? 0xffffff : 0x222222, 1);
        g.fillRect(mid - 192 + i * 16, 270 + j * 16, 16, 16);
      }
    }

    this.add
      .text(
        mid,
        430,
        [
          'Your car keeps its momentum. Each turn,',
          'nudge its velocity by at most 1 per axis.',
          'Every nudge wears the tyres; the pit',
          'refits them but costs 3 turns.',
          'Rivals show their next 2 moves, and you',
          'can block them. Win the 2-lap race.',
        ].join('\n'),
        { fontFamily: FONT, fontSize: '18px', color: '#dddddd', align: 'center', lineSpacing: 6 }
      )
      .setOrigin(0.5);

    makeButton(this, mid, 600, 'Play', () => this.scene.start('RaceScene'), {
      size: '32px',
      padX: 40,
      padY: 12,
      bg: '#b8441f',
      hover: '#d6582e',
    });
  }
}

class RaceScene extends Phaser.Scene {
  constructor() {
    super('RaceScene');
  }

  create() {
    this.race = GL.newRace();
    this.you = this.race.cars[0];
    this.selected = null;
    this.overlay = null;
    this.log = ['Lights out! Tap a dot ahead of your yellow car.'];

    this.drawTrack();
    this.dyn = this.add.graphics();
    this.carLabels = this.race.cars.map(() => null);

    // HUD
    this.hud = this.add.text(14, 10, '', { fontFamily: FONT, fontSize: '17px', color: '#ffffff', lineSpacing: 3 });
    this.tyreGfx = this.add.graphics();
    this.rivalText = this.add.text(250, 10, '', { fontFamily: FONT, fontSize: '14px', color: '#dddddd', lineSpacing: 5 });
    this.rivalDots = this.add.graphics();

    // Bottom panel
    const by = BOARD_Y + GL.H * CELL + 8;
    this.info = this.add.text(14, by, '', {
      fontFamily: FONT,
      fontSize: '15px',
      color: '#e6e6e6',
      wordWrap: { width: 330 },
      lineSpacing: 2,
    });
    this.goBtn = makeButton(this, 410, by + 22, 'Go', () => this.confirm(), { size: '24px', padX: 22, bg: '#b8441f', hover: '#d6582e' });
    this.helpBtn = makeButton(this, 410, by + 76, 'Help', () => this.showHelp(), { size: '18px', padX: 14, padY: 6 });

    const zone = this.add
      .zone(BOARD_X, BOARD_Y, GL.W * CELL, GL.H * CELL)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerdown', (p) => this.onBoardTap(p));

    this.refresh();
  }

  drawTrack() {
    const g = this.add.graphics();
    for (let y = 0; y < GL.H; y++) {
      for (let x = 0; x < GL.W; x++) {
        const c = GL.cellAt(x, y);
        g.fillStyle(c === '.' ? C.grass : c === 'P' ? C.pit : C.track, 1);
        g.fillRect(BOARD_X + x * CELL, BOARD_Y + y * CELL, CELL, CELL);
        g.lineStyle(1, c === '.' ? C.grassLine : C.trackLine, 1);
        g.strokeRect(BOARD_X + x * CELL, BOARD_Y + y * CELL, CELL, CELL);
      }
    }
    // start / finish line (between rows LINE_Y-1 and LINE_Y), checkered
    const ly = BOARD_Y + GL.LINE_Y * CELL;
    for (let x = 1; x <= GL.LEFT_X; x++) {
      for (let k = 0; k < 4; k++) {
        g.fillStyle(k % 2 ? 0xffffff : 0x111111, 1);
        g.fillRect(BOARD_X + x * CELL + k * (CELL / 4), ly - 3, CELL / 4, 3);
        g.fillStyle(k % 2 ? 0x111111 : 0xffffff, 1);
        g.fillRect(BOARD_X + x * CELL + k * (CELL / 4), ly, CELL / 4, 3);
      }
    }
    this.add.text(BOARD_X + 5.2 * CELL, ly - 9, 'FINISH', { fontFamily: FONT, fontSize: '12px', color: '#ffffff' });
    this.add.text(cx(12.5), cy(8) - 2, 'PIT', { fontFamily: FONT, fontSize: '13px', color: '#ffd23f' }).setOrigin(0.5);
    // direction arrows (clockwise)
    const arrows = [
      [2.5, 9, '▲'],
      [9.5, 3.5, '▶'],
      [16.5, 19, '▼'],
      [9.5, 24, '◀'],
    ];
    for (const [ax, ay, s] of arrows) {
      this.add.text(cx(ax), cy(ay), s, { fontFamily: FONT, fontSize: '16px', color: '#6c6f7d' }).setOrigin(0.5);
    }
  }

  playerOptions() {
    if (this.race.over || this.you.pit > 0) return [];
    return GL.options(this.you, GL.occupiedBy(this.race, this.you));
  }

  onBoardTap(p) {
    if (this.overlay || this.race.over) return;
    const x = Math.floor((p.x - BOARD_X) / CELL);
    const y = Math.floor((p.y - BOARD_Y) / CELL);
    const opt = this.playerOptions().find((o) => o.x === x && o.y === y);
    if (!opt) {
      const car = this.race.cars.find((c) => c.x === x && c.y === y);
      if (car) this.setInfo(this.describeCar(car));
      return;
    }
    if (!opt.ok) {
      this.selected = null;
      this.setInfo(`Can't go there: ${opt.why}.`);
      this.refresh(false);
      return;
    }
    if (this.selected && this.selected.x === opt.x && this.selected.y === opt.y) {
      this.confirm();
      return;
    }
    this.selected = opt;
    this.refresh(false);
  }

  describeCar(car) {
    const spd = Math.max(Math.abs(car.vx), Math.abs(car.vy));
    let s = `${car.name}: velocity (${car.vx}, ${car.vy}), speed ${spd}, tyres ${car.tyres}/${GL.TYRES_MAX}, lap ${Math.min(car.lap + 1, GL.LAPS)}/${GL.LAPS}.`;
    if (!car.player) s += car.maxSpeed ? ` Speed capped at ${car.maxSpeed}.` : ' No speed cap.';
    return s;
  }

  confirm() {
    if (this.overlay || this.race.over) return;
    const opts = this.playerOptions();
    let opt = null;
    if (this.you.pit > 0) opt = null; // sitting in the pit box
    else if (this.selected) opt = this.selected;
    else if (opts.some((o) => o.ok)) {
      this.setInfo('Pick a dot first: tap it to preview, tap again to drive.');
      return;
    } // otherwise no legal move: spin
    this.selected = null;
    this.log = GL.playTurn(this.race, opt);
    this.refresh();
    if (this.race.over) this.time.delayedCall(500, () => this.showResult());
  }

  setInfo(s) {
    this.info.setText(s);
  }

  refresh(updateInfo = true) {
    const g = this.dyn;
    g.clear();
    const race = this.race;
    const you = this.you;

    // trails
    for (const car of race.cars) {
      const pts = car.trail.slice(-6).concat([[car.x, car.y]]);
      g.lineStyle(2, car.color, 0.35);
      for (let i = 1; i < pts.length; i++) g.lineBetween(cx(pts[i - 1][0]), cy(pts[i - 1][1]), cx(pts[i][0]), cy(pts[i][1]));
    }

    // rival telegraphs: next 2 moves
    for (const car of race.cars) {
      if (car.player || car.finished || !car.plan) continue;
      let px = car.x, py = car.y;
      car.plan.slice(0, 2).forEach((m, i) => {
        g.lineStyle(2, car.color, i === 0 ? 0.9 : 0.5);
        dashed(g, cx(px), cy(py), cx(m.x), cy(m.y));
        g.lineStyle(2, car.color, i === 0 ? 1 : 0.55);
        g.strokeCircle(cx(m.x), cy(m.y), i === 0 ? 7 : 5);
        px = m.x;
        py = m.y;
      });
    }

    // player options
    const opts = this.playerOptions();
    if (opts.length) {
      // momentum point (no change)
      const mx = you.x + you.vx, my = you.y + you.vy;
      g.lineStyle(1, 0xffffff, 0.35);
      g.strokeRect(BOARD_X + (mx - 1) * CELL, BOARD_Y + (my - 1) * CELL, CELL * 3, CELL * 3);
      for (const o of opts) {
        if (o.x < 0 || o.y < 0 || o.x >= GL.W || o.y >= GL.H) continue;
        if (o.ok) {
          g.fillStyle([C.ok0, C.ok1, C.ok2][o.wear], 0.95);
          g.fillCircle(cx(o.x), cy(o.y), 5);
        } else {
          g.lineStyle(2, C.bad, 0.8);
          g.lineBetween(cx(o.x) - 4, cy(o.y) - 4, cx(o.x) + 4, cy(o.y) + 4);
          g.lineBetween(cx(o.x) - 4, cy(o.y) + 4, cx(o.x) + 4, cy(o.y) - 4);
        }
      }
    }

    // selected move preview: path, ghost car, and where its momentum carries it next
    const sel = this.selected;
    if (sel) {
      g.lineStyle(3, 0xffd23f, 1);
      g.lineBetween(cx(you.x), cy(you.y), cx(sel.x), cy(sel.y));
      g.lineStyle(2, 0xffffff, 1);
      g.strokeCircle(cx(sel.x), cy(sel.y), 9);
      const nx = sel.x + sel.vx, ny = sel.y + sel.vy;
      g.lineStyle(1, 0xffd23f, 0.6);
      dashed(g, cx(sel.x), cy(sel.y), cx(nx), cy(ny));
      g.strokeRect(BOARD_X + (nx - 1) * CELL, BOARD_Y + (ny - 1) * CELL, CELL * 3, CELL * 3);
    }

    // cars
    for (const car of race.cars) {
      const a = car.finished && !car.player ? 0.3 : 1; // finished rivals are off the track
      g.fillStyle(car.color, a);
      g.fillCircle(cx(car.x), cy(car.y), 8);
      g.lineStyle(2, car.player ? 0xffffff : 0x111111, a);
      g.strokeCircle(cx(car.x), cy(car.y), 8);
    }

    // HUD
    const st = GL.standings(race);
    const pos = st.indexOf(you) + 1;
    const spd = Math.max(Math.abs(you.vx), Math.abs(you.vy));
    this.hud.setText(
      [
        `Lap ${Math.min(you.lap + 1, GL.LAPS)}/${GL.LAPS}   P${pos}/4   Turn ${race.turn}`,
        `Velocity (${you.vx}, ${you.vy})  speed ${spd}`,
        `Tyres ${you.tyres}/${GL.TYRES_MAX}${you.tyres === 0 ? '  WORN' : ''}`,
        you.pit ? `In the pit: ${you.pit} turn${you.pit > 1 ? 's' : ''} left` : '',
      ].join('\n')
    );
    this.tyreGfx.clear();
    for (let i = 0; i < GL.TYRES_MAX; i++) {
      this.tyreGfx.fillStyle(i < you.tyres ? (you.tyres <= 4 ? 0xff8a3d : 0x6fdc6f) : 0x444444, 1);
      this.tyreGfx.fillRect(14 + i * 13, 92, 10, 10);
    }
    const rivals = race.cars.filter((c) => !c.player);
    this.rivalText.setText(
      rivals
        .map((c) => {
          const p = st.indexOf(c) + 1;
          const fin = race.order.indexOf(c.id);
          return `${c.name}  P${p}  ${fin >= 0 ? 'finished' : 'lap ' + (c.lap + 1)}  tyres ${c.tyres}  ${c.maxSpeed ? 'cap ' + c.maxSpeed : 'no cap'}`;
        })
        .join('\n')
    );
    this.rivalDots.clear();
    rivals.forEach((c, i) => {
      this.rivalDots.fillStyle(c.color, 1);
      this.rivalDots.fillCircle(242, 20 + i * 21.5, 5);
    });

    // bottom info and button
    if (you.pit > 0) {
      this.goBtn.setText('Wait');
    } else if (opts.length && !opts.some((o) => o.ok)) {
      this.goBtn.setText('Spin');
    } else {
      this.goBtn.setText('Go');
    }
    if (updateInfo || sel) {
      let s;
      if (sel) {
        s = `Change (${fmt(sel.ax)}, ${fmt(sel.ay)}) → velocity (${sel.vx}, ${sel.vy}). Tyre wear ${sel.wear} → ${Math.max(0, you.tyres - sel.wear)} left.` +
          (GL.isPit(sel.x, sel.y) ? ' PIT STOP.' : '') +
          ' Tap again or Go.';
      } else if (you.pit > 0) {
        s = 'The crew is fitting fresh tyres. Press Wait.';
      } else if (opts.length && !opts.some((o) => o.ok)) {
        s = 'No legal move! Press Spin: you stop dead and lose 2 tyres.';
      } else {
        s = this.log.join(' ') || 'Your move. Dots: white = no wear, yellow = 1, orange = 2.';
      }
      this.setInfo(s);
    }
  }

  showResult() {
    const place = this.race.order.indexOf('you') + 1;
    const win = place === 1;
    this.openOverlay(
      win ? 'Victory!' : `You finished P${place}`,
      win ? `First across the line in ${this.race.turn} turns.` : `${this.race.cars.find((c) => c.id === this.race.order[0]).name} won.\nStudy their lines and try again.`,
      [
        ['Race again', () => this.scene.restart()],
        ['Title', () => this.scene.start('TitleScene')],
      ],
      win ? '#ffd23f' : '#ff9a8a'
    );
  }

  showHelp() {
    if (this.race.over) return;
    this.openOverlay('How to play', HELP.join('\n'), [['Back to the race', () => this.closeOverlay()]], '#ffd23f', true);
  }

  openOverlay(title, body, buttons, color, tall) {
    this.closeOverlay();
    const h = tall ? 640 : 210;
    const top = (GAME_HEIGHT - h) / 2;
    const items = [];
    const shade = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.65).setOrigin(0).setDepth(10).setInteractive();
    items.push(shade);
    items.push(this.add.rectangle(28, top, GAME_WIDTH - 56, h, 0x1c1d24).setOrigin(0).setStrokeStyle(2, 0x5a5d6e).setDepth(10));
    items.push(this.add.text(GAME_WIDTH / 2, top + 32, title, { fontFamily: FONT, fontSize: '30px', color }).setOrigin(0.5).setDepth(11));
    items.push(
      this.add
        .text(GAME_WIDTH / 2, top + 66, body, {
          fontFamily: FONT,
          fontSize: tall ? '16px' : '18px',
          color: '#dddddd',
          align: tall ? 'left' : 'center',
          lineSpacing: 4,
        })
        .setOrigin(0.5, 0)
        .setDepth(11)
    );
    buttons.forEach(([label, fn], i) => {
      const x = buttons.length === 1 ? GAME_WIDTH / 2 : GAME_WIDTH / 2 + (i === 0 ? -90 : 90);
      items.push(makeButton(this, x, top + h - 38, label, fn, { size: '22px', depth: 11, bg: '#b8441f', hover: '#d6582e' }));
    });
    this.overlay = items;
  }

  closeOverlay() {
    if (this.overlay) this.overlay.forEach((o) => o.destroy());
    this.overlay = null;
  }
}

function fmt(n) {
  return n > 0 ? '+' + n : String(n);
}

function dashed(g, x0, y0, x1, y1) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(1, Math.floor(len / 6));
  for (let i = 0; i < n; i += 2) {
    const a = i / n, b = Math.min(1, (i + 1) / n);
    g.lineBetween(x0 + (x1 - x0) * a, y0 + (y1 - y0) * a, x0 + (x1 - x0) * b, y0 + (y1 - y0) * b);
  }
}

window.game = new Phaser.Game({
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game',
  backgroundColor: '#14151a',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [TitleScene, RaceScene],
});
