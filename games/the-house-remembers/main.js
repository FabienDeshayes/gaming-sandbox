import {
  ROOMS, DOORS, CLOCK_ROOM, EXIT_ROOM, KEYS_NEEDED, NIGHTS,
  neighbours, newNight, step, legalActions, isLit, ghostVisible, previewGhost, soundMap,
} from './logic.js';

const GAME_WIDTH = 480;
const GAME_HEIGHT = 854;
const CELL = 140;
const X0 = 30;
const Y0 = 96;
const FONT = 'Georgia, serif';

const COLORS = {
  bg: 0x0d0c12,
  dark: 0x1b1a24,
  lit: 0x5c4826,
  wall: 0x3a3646,
  door: 0x8a7a5a,
  player: 0x6fb3ff,
  ghost: 0xe8f0ff,
  key: 0xffd84a,
  doll: 0xf29bb5,
  move: 0x7fd1c0,
};

function button(scene, x, y, label, onClick, opts = {}) {
  const enabled = opts.enabled !== false;
  const t = scene.add
    .text(x, y, label, {
      fontFamily: FONT,
      fontSize: opts.size || '20px',
      color: enabled ? '#ffffff' : '#666666',
      backgroundColor: enabled ? '#3a3248' : '#1e1c24',
      padding: { x: 12, y: 8 },
      align: 'center',
      fixedWidth: opts.width || 0,
    })
    .setOrigin(0.5);
  if (enabled) {
    t.setInteractive({ useHandCursor: true });
    t.on('pointerover', () => t.setStyle({ backgroundColor: '#55486a' }));
    t.on('pointerout', () => t.setStyle({ backgroundColor: '#3a3248' }));
    t.on('pointerdown', onClick);
  }
  return t;
}

class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create() {
    const cx = GAME_WIDTH / 2;
    this.add.text(cx, 150, 'The House\nRemembers', {
      fontFamily: FONT, fontSize: '52px', color: '#e8f0ff', align: 'center',
    }).setOrigin(0.5);
    this.add.text(cx, 330, [
      'A ghost haunts eight dark rooms.',
      'It follows strict rules. Learn them.',
      '',
      'Find 3 keys, then escape by the Foyer.',
      'Survive 3 nights.',
      '',
      'Tap a neighbouring room to move.',
      'Every action makes a sound (shown in',
      'brackets). The ghost walks one room',
      'per turn toward the loudest sound.',
      'Candles light a room for 5 turns:',
      'only lit rooms show keys and the ghost.',
      'It will not enter a room where its',
      'doll rests.',
    ].join('\n'), {
      fontFamily: FONT, fontSize: '18px', color: '#bbb3c9', align: 'center', lineSpacing: 4,
    }).setOrigin(0.5, 0);
    button(this, cx, 720, 'Play', () => this.scene.start('HouseScene', { night: 0 }), { size: '32px', width: 200 });
  }
}

class HouseScene extends Phaser.Scene {
  constructor() {
    super('HouseScene');
  }

  init(data) {
    this.state = newNight(data.night || 0);
    this.helpOpen = false;
  }

  create() {
    this.gfx = this.add.graphics();
    this.layer = this.add.container();
    this.input.on('pointerdown', (p) => this.onTap(p));
    this.render();
  }

  roomRect(r) {
    const { col, row } = ROOMS[r];
    return { x: X0 + col * CELL + 5, y: Y0 + row * CELL + 5, w: CELL - 10, h: CELL - 10 };
  }

  roomCentre(r) {
    const b = this.roomRect(r);
    return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  }

  onTap(p) {
    const s = this.state;
    if (s.status !== 'playing' || this.helpOpen) return;
    for (const r of neighbours(s.player)) {
      const b = this.roomRect(r);
      if (p.worldX >= b.x && p.worldX <= b.x + b.w && p.worldY >= b.y && p.worldY <= b.y + b.h) {
        this.act({ type: 'move', to: r, noise: 1 });
        return;
      }
    }
  }

  act(action) {
    this.state = step(this.state, action);
    this.render();
  }

  txt(x, y, s, size = 14, color = '#ddd', origin = [0, 0]) {
    const t = this.add.text(x, y, s, { fontFamily: FONT, fontSize: size + 'px', color }).setOrigin(...origin);
    this.layer.add(t);
    return t;
  }

  render() {
    const s = this.state;
    const g = this.gfx;
    g.clear();
    this.layer.removeAll(true);

    // Header
    this.txt(16, 14, `Night ${s.night + 1}/${NIGHTS.length}   Turn ${s.turn}`, 22, '#e8f0ff');
    this.txt(16, 46, NIGHTS[s.night].rule, 14, '#d9b86a').setWordWrapWidth(450);
    const helpBtn = button(this, 448, 26, '?', () => this.showHelp(), { size: '18px' });
    this.layer.add(helpBtn);

    // House outline
    g.fillStyle(COLORS.wall, 1);
    g.fillRect(X0 - 4, Y0 - 4, CELL * 3 + 8, CELL * 2 + 8);
    g.fillRect(X0 - 4, Y0 + CELL * 2 - 4, CELL * 2 + 8, CELL + 8);

    const vol = soundMap(s, s.player, 0);
    const near = neighbours(s.player);
    for (let r = 0; r < ROOMS.length; r++) {
      const b = this.roomRect(r);
      const lit = isLit(s, r);
      g.fillStyle(lit ? COLORS.lit : COLORS.dark, 1);
      g.fillRect(b.x, b.y, b.w, b.h);
      if (r === s.player) { g.lineStyle(3, COLORS.player, 1); g.strokeRect(b.x, b.y, b.w, b.h); }
      else if (near.includes(r) && s.status === 'playing') { g.lineStyle(2, COLORS.move, 0.9); g.strokeRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4); }
      this.txt(b.x + 6, b.y + 4, ROOMS[r].name, 15, lit ? '#fff3d0' : '#9a94a8');
      if (lit) this.txt(b.x + b.w - 6, b.y + 4, `candle ${s.lit[r]}`, 12, '#ffd98a', [1, 0]);
      if (near.includes(r) && s.status === 'playing') this.txt(b.x + b.w / 2, b.y + b.h - 6, 'move (1)', 12, '#7fd1c0', [0.5, 1]);
      if (r === EXIT_ROOM) this.txt(b.x + b.w - 6, b.y + b.h - 6, 'EXIT', 12, '#d9b86a', [1, 1]);

      // Contents: keys only show in lit rooms; searched rooms are known empty.
      if (lit && s.keys.includes(r)) this.drawKey(b.x + 22, b.y + 42);
      else if (!lit && !s.searched[r]) this.txt(b.x + 10, b.y + 32, '?', 18, '#57516a');
      else if (s.searched[r] && !s.keys.includes(r)) this.txt(b.x + 8, b.y + 32, 'searched', 11, '#6c6680');
      else if (lit) this.txt(b.x + 8, b.y + 32, 'no key', 11, '#c8b48a');

      if (s.doll === r) this.drawDoll(b.x + b.w - 24, b.y + 48);
      if (r === CLOCK_ROOM) this.drawClock(b.x + b.w - 26, b.y + b.h - 34);
      if (vol[r] > 0) this.txt(b.x + b.w - 6, b.y + 22, `sound ${vol[r]}`, 12, '#c9a0ff', [1, 0]);
    }

    // Doors
    g.fillStyle(COLORS.door, 1);
    for (const [a, c] of DOORS) {
      const A = ROOMS[a], C = ROOMS[c];
      if (A.row === C.row) {
        const x = X0 + Math.max(A.col, C.col) * CELL;
        g.fillRect(x - 5, Y0 + A.row * CELL + CELL / 2 - 14, 10, 28);
      } else {
        const y = Y0 + Math.max(A.row, C.row) * CELL;
        g.fillRect(X0 + A.col * CELL + CELL / 2 - 14, y - 5, 28, 10);
      }
    }

    // Front door / outside
    const ox = X0 + 2 * CELL + 10, oy = Y0 + 2 * CELL + 10;
    this.txt(ox + 4, oy + 10, 'Outside', 15, '#6c6680');
    this.txt(ox + 4, oy + 34, `Need ${KEYS_NEEDED} keys,\nthen Escape\nfrom the Foyer.`, 12, '#6c6680');
    g.fillStyle(0x6a5030, 1);
    g.fillRect(X0 + 2 * CELL - 5, Y0 + 2 * CELL + CELL / 2 - 14, 10, 28);

    // Player
    const pc = this.roomCentre(s.player);
    g.fillStyle(COLORS.player, 1);
    g.fillCircle(pc.x, pc.y + 14, 13);
    if (s.doll === -1) this.drawDoll(pc.x + 22, pc.y + 14);

    // Ghost: visible only in a lit room; otherwise a faint memory of where it was last seen.
    let ghostLine;
    if (ghostVisible(s)) {
      const gc = this.roomCentre(s.ghost);
      this.drawGhost(gc.x - 28, gc.y + 6, 1);
      if (s.status === 'playing') {
        const { next } = previewGhost(s, { type: 'wait', noise: 0 });
        if (next !== s.ghost) {
          const nc = this.roomCentre(next);
          g.lineStyle(3, COLORS.ghost, 0.6);
          g.lineBetween(gc.x - 28, gc.y + 6, nc.x - 28, nc.y + 6);
          g.fillStyle(COLORS.ghost, 0.6);
          g.fillCircle(nc.x - 28, nc.y + 6, 5);
        }
        ghostLine = `Ghost seen in the ${ROOMS[s.ghost].name}. If you stay quiet it goes to the ${ROOMS[next].name}.`;
      }
    } else {
      const lc = this.roomCentre(s.lastSeen.room);
      this.drawGhost(lc.x - 28, lc.y + 6, 0.25);
      ghostLine = `Ghost last seen: ${ROOMS[s.lastSeen.room].name}, turn ${s.lastSeen.turn} (${s.turn - s.lastSeen.turn} turns ago).`;
    }

    // Status panel
    const py = Y0 + CELL * 3 + 16;
    const dollWhere = s.doll === -1 ? 'carried' : ROOMS[s.doll].name;
    this.txt(16, py, `Keys ${s.keysHeld}/${KEYS_NEEDED}    Candles ${s.candles}    Doll: ${dollWhere}`, 17, '#ffffff');
    if (ghostLine) this.txt(16, py + 26, ghostLine, 14, '#e8f0ff').setWordWrapWidth(450);
    this.txt(16, py + 66, s.log.slice(-2).join('\n'), 14, '#a8a0b8').setWordWrapWidth(450);

    // Actions
    if (s.status === 'playing') {
      const acts = legalActions(s);
      const has = (t) => acts.find((a) => a.type === t);
      const by = py + 130;
      const defs = [
        ['wait', 'Wait'],
        ['search', 'Search'],
        ['light', 'Light candle'],
        has('drop') ? ['drop', 'Drop doll'] : ['take', 'Take doll'],
        ['escape', 'Escape'],
      ];
      defs.forEach(([type, label], i) => {
        const a = has(type);
        const noise = a ? a.noise : type === 'search' ? (isLit(s, s.player) ? 1 : 2) : type === 'take' ? 1 : 0;
        const x = 84 + (i % 3) * 156;
        const y = by + Math.floor(i / 3) * 52;
        this.layer.add(button(this, x, y, `${label} (${noise})`, () => this.act(a), { enabled: !!a, size: '16px', width: 132 }));
      });
      this.txt(GAME_WIDTH / 2, GAME_HEIGHT - 10, '(n) = sound the action makes. Ties go to the nearest sound.', 12, '#7a7390', [0.5, 1]);
    } else {
      this.showEnd();
    }
  }

  drawKey(x, y) {
    const g = this.gfx;
    g.fillStyle(COLORS.key, 1);
    g.fillCircle(x, y, 7);
    g.fillRect(x + 5, y - 2, 20, 4);
    g.fillRect(x + 19, y + 2, 3, 5);
    g.fillRect(x + 13, y + 2, 3, 4);
    g.fillStyle(COLORS.dark, 1);
    g.fillCircle(x, y, 3);
  }

  drawDoll(x, y) {
    const g = this.gfx;
    g.fillStyle(COLORS.doll, 1);
    g.fillCircle(x, y - 10, 6);
    g.fillTriangle(x - 9, y + 10, x + 9, y + 10, x, y - 6);
  }

  drawClock(x, y) {
    const g = this.gfx;
    g.lineStyle(2, 0xcfc6a0, 1);
    g.strokeCircle(x, y, 11);
    g.lineBetween(x, y, x, y - 8);
    g.lineBetween(x, y, x + 6, y);
  }

  drawGhost(x, y, alpha) {
    const g = this.gfx;
    g.fillStyle(COLORS.ghost, alpha);
    g.fillCircle(x, y - 6, 12);
    g.fillRect(x - 12, y - 6, 24, 18);
    g.fillTriangle(x - 12, y + 12, x - 4, y + 12, x - 8, y + 18);
    g.fillTriangle(x + 4, y + 12, x + 12, y + 12, x + 8, y + 18);
    g.fillStyle(0x000000, alpha);
    g.fillCircle(x - 4, y - 8, 2);
    g.fillCircle(x + 4, y - 8, 2);
  }

  overlay(lines, buttons) {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.75);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.setInteractive(new Phaser.Geom.Rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT), Phaser.Geom.Rectangle.Contains);
    this.layer.add(g);
    this.txt(GAME_WIDTH / 2, 300, lines, 22, '#e8f0ff', [0.5, 0.5]).setAlign('center').setWordWrapWidth(420);
    buttons.forEach(([label, fn], i) => this.layer.add(button(this, GAME_WIDTH / 2, 450 + i * 70, label, fn, { size: '24px', width: 260 })));
    return g;
  }

  showEnd() {
    const s = this.state;
    if (s.status === 'caught') {
      this.overlay(`The ghost found you\nin the ${ROOMS[s.player].name}.\n\nNight ${s.night + 1}, turn ${s.turn}.`, [
        ['Retry night', () => this.scene.restart({ night: s.night })],
        ['Title', () => this.scene.start('TitleScene')],
      ]);
    } else if (s.night + 1 < NIGHTS.length) {
      this.overlay(`You escaped night ${s.night + 1}\nin ${s.turn} turns.\n\nNext night:\n${NIGHTS[s.night + 1].rule}`, [
        ['Next night', () => this.scene.restart({ night: s.night + 1 })],
      ]);
    } else {
      this.overlay(`Dawn breaks.\nYou survived all ${NIGHTS.length} nights.\n\nThe house remembers you.`, [
        ['Play again', () => this.scene.start('HouseScene', { night: 0 })],
        ['Title', () => this.scene.start('TitleScene')],
      ]);
    }
  }

  showHelp() {
    const parts = [];
    this.helpOpen = true;
    const close = () => { parts.forEach((p) => p.destroy()); this.time.delayedCall(0, () => { this.helpOpen = false; }); };
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.88);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.setInteractive(new Phaser.Geom.Rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT), Phaser.Geom.Rectangle.Contains);
    parts.push(g);
    parts.push(this.add.text(24, 80, [
      'RULES',
      '',
      '- Each turn you act, then the ghost moves',
      '  one room toward the loudest sound.',
      '  Ties: the sound nearest to the ghost.',
      '- Sounds: move 1, search a dark room 2,',
      '  search a lit room 1, take/drop doll 1,',
      '  wait / light / escape 0.',
      '  The Study clock always ticks at 1.',
      '- A candle lights your room for 5 turns.',
      '  Lit rooms show keys and the ghost.',
      '- The ghost will not enter a room where',
      '  its doll rests (a carried doll does not',
      '  count).',
      '- Meet the ghost in a room and you lose.',
      '- Find 3 keys, reach the Foyer, Escape.',
    ].join('\n'), { fontFamily: FONT, fontSize: '17px', color: '#e8f0ff', lineSpacing: 6 }));
    parts.push(button(this, GAME_WIDTH / 2, 640, 'Close', close, { size: '24px', width: 200 }));
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game',
  backgroundColor: '#0d0c12',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [TitleScene, HouseScene],
});
