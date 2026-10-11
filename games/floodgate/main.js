import {
  SIZE, WAVES, HOUSES_TO_KEEP, FIELD_DROWN,
  newGame, idx, canEdit, edit, runWave, previewWave, housesDry,
} from './logic.js';

const GAME_WIDTH = 480;
const GAME_HEIGHT = 854;
const CELL = 44;
const GX = 20;
const GY = 128;
const FONT = 'sans-serif';

// Terrain colour by height, low (dark green) to high (pale brown).
const HEIGHT_COLORS = [0x1f4d2b, 0x2d6136, 0x3d7340, 0x56834a, 0x708f52, 0x8a9558, 0x9e9361, 0xae9a72, 0xbfac8a, 0xd3c4a8];
const WATER = 0x3a8ee6;

function button(scene, x, y, label, onClick, opts = {}) {
  const enabled = opts.enabled !== false;
  const base = opts.color || '#2d4a66';
  const t = scene.add
    .text(x, y, label, {
      fontFamily: FONT,
      fontSize: opts.size || '18px',
      color: enabled ? '#ffffff' : '#667',
      backgroundColor: enabled ? base : '#1c232b',
      padding: { x: 10, y: 8 },
      align: 'center',
      fixedWidth: opts.width || 0,
    })
    .setOrigin(0.5);
  if (enabled) {
    t.setInteractive({ useHandCursor: true });
    t.on('pointerover', () => t.setStyle({ backgroundColor: '#41698f' }));
    t.on('pointerout', () => t.setStyle({ backgroundColor: base }));
    t.on('pointerdown', (p, lx, ly, e) => { e.stopPropagation(); onClick(); });
  }
  return t;
}

class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create() {
    const cx = GAME_WIDTH / 2;
    this.add.text(cx, 150, 'Floodgate', { fontFamily: FONT, fontSize: '60px', color: '#9fd0ff' }).setOrigin(0.5);
    this.add.text(cx, 220, 'Water, not monsters.', { fontFamily: FONT, fontSize: '20px', color: '#cbd6e0' }).setOrigin(0.5);
    this.add.text(cx, 290, [
      'Three waves pour from the spring (S).',
      'Every tile shows its height. Water runs',
      'downhill, settles in the lowest place it',
      'can reach, and leaves at the sea (D).',
      '',
      'Before each wave you get a few actions:',
      'tap a tile, then raise or lower it by 1.',
      'The blue overlay shows exactly where the',
      'next wave will end up.',
      '',
      `Keep at least ${HOUSES_TO_KEEP} of the 4 houses dry.`,
      `Fields with 1-${FIELD_DROWN - 1} water turn fertile: +1 action`,
      `each next turn. ${FIELD_DROWN}+ water drowns them for good.`,
    ].join('\n'), { fontFamily: FONT, fontSize: '17px', color: '#cbd6e0', align: 'center', lineSpacing: 5 }).setOrigin(0.5, 0);
    button(this, cx, 720, 'Play', () => this.scene.start('FloodScene'), { size: '32px', width: 200 });
  }
}

class FloodScene extends Phaser.Scene {
  constructor() {
    super('FloodScene');
  }

  create() {
    this.state = newGame();
    this.selected = -1;
    this.view = 'next'; // 'next' = preview of the coming wave, 'last' = what the last wave did
    this.gfx = this.add.graphics();
    this.layer = this.add.container();
    this.input.on('pointerdown', (p) => this.onTap(p));
    this.render();
  }

  onTap(p) {
    if (this.state.status !== 'playing') return;
    const x = Math.floor((p.worldX - GX) / CELL);
    const y = Math.floor((p.worldY - GY) / CELL);
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
    this.selected = idx(x, y);
    this.view = 'next';
    this.render();
  }

  doEdit(delta) {
    this.state = edit(this.state, this.selected, delta);
    this.view = 'next';
    this.render();
  }

  release() {
    this.state = runWave(this.state);
    this.view = 'last';
    this.render();
  }

  txt(x, y, s, size = 14, color = '#dde', origin = [0, 0]) {
    const t = this.add.text(x, y, s, { fontFamily: FONT, fontSize: size + 'px', color }).setOrigin(...origin);
    this.layer.add(t);
    return t;
  }

  render() {
    const s = this.state;
    const g = this.gfx;
    g.clear();
    this.layer.removeAll(true);

    const playing = s.status === 'playing';
    const preview = playing ? previewWave(s) : null;
    const showLast = (this.view === 'last' || !playing) && s.lastReport;
    const water = showLast ? s.lastReport.water : preview ? preview.water : null;

    // Header: wave schedule
    this.txt(16, 10, 'Floodgate', 24, '#9fd0ff');
    this.txt(464, 14, `Houses dry ${housesDry(s)}/4 (keep ${HOUSES_TO_KEEP})`, 15, '#ffffff', [1, 0]);
    WAVES.forEach((w, i) => {
      const x = 16 + i * 152;
      const done = i < s.wave;
      const next = i === s.wave && playing;
      g.fillStyle(done ? 0x2a2f36 : next ? 0x2d4a66 : 0x1e2933, 1);
      g.fillRect(x, 46, 144, 34);
      const label = done ? `Wave ${i + 1}: done` : next ? `Wave ${i + 1}: in ${s.actionsLeft}` : `Wave ${i + 1}`;
      this.txt(x + 8, 50, label, 14, next ? '#ffffff' : '#8a97a5');
      this.txt(x + 8, 65, `volume ${w.volume}, ${i === 0 ? w.actions : w.actions + '+bonus'} acts`, 11, '#8a97a5');
    });
    const viewLabel = showLast
      ? `Showing: what wave ${s.lastReport.wave + 1} did`
      : preview ? `Showing: where wave ${s.wave + 1} will go` : '';
    this.txt(16, 92, viewLabel, 15, showLast ? '#ffd27a' : '#9fd0ff');
    if (playing && s.lastReport) {
      this.layer.add(button(this, 410, 102, showLast ? 'Show next' : 'Show last', () => {
        this.view = this.view === 'last' ? 'next' : 'last';
        this.render();
      }, { size: '13px' }));
    }

    // Grid
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const i = idx(x, y);
        const t = s.tiles[i];
        const px = GX + x * CELL, py = GY + y * CELL;
        let col = HEIGHT_COLORS[t.height];
        if (t.type === 'drain') col = 0x123a6b;
        g.fillStyle(col, 1);
        g.fillRect(px, py, CELL - 1, CELL - 1);
        const w = water ? water[i] : 0;
        if (w > 0) {
          g.fillStyle(WATER, Math.min(0.85, 0.45 + 0.12 * w));
          g.fillRect(px, py, CELL - 1, CELL - 1);
        }
        this.drawTileMark(t, px, py, w);
        if (t.type !== 'drain') this.txt(px + 3, py + 2, String(t.height), 13, t.height >= 7 ? '#2a2418' : '#f2f2e6');
        if (w > 0) this.txt(px + CELL - 4, py + CELL - 3, `~${w}`, 12, '#ffffff', [1, 1]);
      }
    }
    if (this.selected >= 0) {
      const sx = GX + (this.selected % SIZE) * CELL, sy = GY + Math.floor(this.selected / SIZE) * CELL;
      g.lineStyle(3, 0xffffff, 1);
      g.strokeRect(sx + 1, sy + 1, CELL - 3, CELL - 3);
    }

    // Panel under the grid
    const py = GY + SIZE * CELL + 12;
    if (preview && !showLast) {
      const bits = [`${preview.drained} to the sea`];
      bits.push(preview.housesLost ? `${preview.housesLost} house(s) FLOOD` : 'houses safe');
      if (preview.fertile) bits.push(`${preview.fertile} field(s) fertile (+${preview.fertile} act)`);
      if (preview.drowned) bits.push(`${preview.drowned} field(s) drown`);
      this.txt(16, py, `Wave ${s.wave + 1} forecast: ` + bits.join(', '), 14, preview.outcome === 'lost' ? '#ff8a7a' : '#cfe6ff').setWordWrapWidth(450);
    } else if (s.log.length) {
      this.txt(16, py, s.log[s.log.length - 1], 14, '#ffd27a').setWordWrapWidth(450);
    }

    if (playing) {
      const sel = this.selected >= 0 ? s.tiles[this.selected] : null;
      let info = 'Tap a tile to inspect and reshape it.';
      if (sel) {
        const name = { land: 'Land', source: 'Spring', drain: 'Sea', house: 'House', field: 'Field' }[sel.type];
        const status = sel.flooded ? ' (flooded)' : sel.drowned ? ' (drowned)' : '';
        const fw = preview ? preview.water[this.selected] : 0;
        info = `${name}${status}  height ${sel.height}  next wave water ${fw}` +
          (sel.type === 'land' ? '' : '  (only land can be reshaped)');
      }
      this.txt(16, py + 42, info, 14, '#ffffff').setWordWrapWidth(450);
      const can = (d) => this.selected >= 0 && canEdit(s, this.selected, d);
      const by = py + 92;
      this.layer.add(button(this, 90, by, 'Raise +1', () => this.doEdit(1), { enabled: can(1), width: 130 }));
      this.layer.add(button(this, 240, by, 'Lower -1', () => this.doEdit(-1), { enabled: can(-1), width: 130 }));
      this.layer.add(button(this, 390, by, s.actionsLeft > 0 ? 'Release now' : 'Release wave', () => this.release(), {
        width: 130, color: s.actionsLeft > 0 ? '#4a3a2d' : '#8a4b1f',
      }));
      this.txt(16, by + 32, `Actions left before wave ${s.wave + 1}: ${s.actionsLeft}` +
        (s.bonusNext ? `  (incl. +${s.bonusNext} from fertile fields)` : ''), 14, '#cbd6e0');
      this.txt(GAME_WIDTH / 2, GAME_HEIGHT - 8,
        'Water settles on the lowest tile it can reach without going uphill.\nStanding water soaks away after each wave.', 12, '#7f8c99', [0.5, 1]).setAlign('center');
    } else {
      this.showEnd();
    }
  }

  drawTileMark(t, px, py, w) {
    const g = this.gfx;
    const cx = px + CELL / 2, cy = py + CELL / 2 + 3;
    if (t.type === 'house') {
      const c = t.flooded ? 0x666666 : 0xd9534f;
      g.fillStyle(0xf3e6c8, t.flooded ? 0.4 : 1);
      g.fillRect(cx - 9, cy - 3, 18, 13);
      g.fillStyle(c, 1);
      g.fillTriangle(cx - 12, cy - 3, cx + 12, cy - 3, cx, cy - 14);
      if (!t.flooded && w > 0) { g.lineStyle(3, 0xff3b30, 1); g.strokeRect(px + 2, py + 2, CELL - 5, CELL - 5); }
    } else if (t.type === 'field') {
      g.lineStyle(2, t.drowned ? 0x5a4630 : 0xe8d25a, 1);
      for (let k = -1; k <= 1; k++) g.lineBetween(cx - 12, cy + k * 7, cx + 12, cy + k * 7);
      if (!t.drowned && w >= FIELD_DROWN) { g.lineStyle(3, 0xff3b30, 1); g.strokeRect(px + 2, py + 2, CELL - 5, CELL - 5); }
      else if (!t.drowned && w > 0) { g.lineStyle(3, 0x7dff8a, 1); g.strokeRect(px + 2, py + 2, CELL - 5, CELL - 5); }
    } else if (t.type === 'source') {
      g.lineStyle(3, 0x9fd0ff, 1);
      g.strokeCircle(cx, cy, 11);
      this.txt(cx, cy, 'S', 14, '#9fd0ff', [0.5, 0.5]);
    } else if (t.type === 'drain') {
      this.txt(cx, cy - 2, 'D', 16, '#9fd0ff', [0.5, 0.5]);
    }
  }

  showEnd() {
    const s = this.state;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.7);
    g.fillRect(0, 250, GAME_WIDTH, 300);
    g.setInteractive(new Phaser.Geom.Rectangle(0, 250, GAME_WIDTH, 300), Phaser.Geom.Rectangle.Contains);
    this.layer.add(g);
    const won = s.status === 'won';
    this.txt(GAME_WIDTH / 2, 320, won ? 'The town is safe!' : 'The town is flooded', 32, won ? '#9fffb0' : '#ff8a7a', [0.5, 0.5]);
    this.txt(GAME_WIDTH / 2, 370, `Houses dry: ${housesDry(s)}/4 after wave ${s.wave}`, 18, '#ffffff', [0.5, 0.5]);
    this.layer.add(button(this, GAME_WIDTH / 2 - 90, 460, 'Play again', () => this.scene.restart(), { size: '22px', width: 160 }));
    this.layer.add(button(this, GAME_WIDTH / 2 + 90, 460, 'Title', () => this.scene.start('TitleScene'), { size: '22px', width: 160 }));
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game',
  backgroundColor: '#0f1720',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [TitleScene, FloodScene],
});
