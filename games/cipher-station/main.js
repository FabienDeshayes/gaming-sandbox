const GAME_WIDTH = 480;
const GAME_HEIGHT = 854;
const C = window.Cipher;
const FONT = 'monospace';

const COL = {
  bg: 0x07110c,
  panel: 0x0d1d15,
  border: 0x2a5a40,
  rx: 0x7dffb0,
  tx: 0xffc46b,
  dim: 0x4c7a60,
  prompt: 0xffc46b,
};
const hex = (c) => '#' + c.toString(16).padStart(6, '0');

// Glyph strokes in a unit box centred on 0,0 (y down). Shapes are deliberately not our own symbols.
const SHAPES = {
  one: { dots: [[0, 0, 0.17]] },
  zero: { rings: [[0, 0, 0.28]] },
  plus: { lines: [[[0, 0.4], [0, -0.4]], [[0, 0.05], [-0.3, -0.3]], [[0, 0.05], [0.3, -0.3]]] },
  eq: { lines: [[[-0.28, 0.38], [-0.06, -0.38]], [[0.06, 0.38], [0.28, -0.38]]] },
  not: { lines: [[[-0.3, -0.3], [0.3, -0.3], [0.3, 0.38]], [[-0.3, 0.05], [0.02, 0.05]]] },
  yes: { lines: [[[0, -0.38], [0.36, 0.3], [-0.36, 0.3], [0, -0.38]]] },
  unk: { lines: [[[-0.3, -0.3], [0.3, -0.3], [0.3, 0.3], [-0.3, 0.3], [-0.3, -0.3]]], dots: [[0, 0, 0.07]] },
  send: { lines: [[[0.26, -0.4], [-0.2, -0.06], [0.2, 0.06], [-0.26, 0.4]]] },
  chan: { lines: [Array.from({ length: 13 }, (_, i) => [-0.4 + i * (0.8 / 12), 0.2 * Math.sin((i / 12) * Math.PI * 2)])], dots: [[0, -0.32, 0.06], [0, 0.32, 0.06]] },
};

function drawGlyph(g, id, x, y, size, color, alpha = 1) {
  const sh = SHAPES[id];
  const w = Math.max(2, size * 0.09);
  g.lineStyle(w, color, alpha);
  for (const line of sh.lines || []) {
    g.beginPath();
    g.moveTo(x + line[0][0] * size, y + line[0][1] * size);
    for (let i = 1; i < line.length; i++) g.lineTo(x + line[i][0] * size, y + line[i][1] * size);
    g.strokePath();
  }
  for (const [dx, dy, r] of sh.rings || []) g.strokeCircle(x + dx * size, y + dy * size, r * size);
  g.fillStyle(color, alpha);
  for (const [dx, dy, r] of sh.dots || []) g.fillCircle(x + dx * size, y + dy * size, r * size);
}

function makeButton(scene, x, y, w, h, label, onClick, opts = {}) {
  const base = opts.color || 0x123524;
  const bg = scene.add.rectangle(x, y, w, h, base).setStrokeStyle(2, COL.border).setInteractive({ useHandCursor: true });
  const txt = scene.add.text(x, y, label, { fontFamily: FONT, fontSize: opts.size || '18px', color: opts.text || '#cfffe0' }).setOrigin(0.5);
  bg.on('pointerover', () => bg.setFillStyle(0x1e5236));
  bg.on('pointerout', () => bg.setFillStyle(base));
  bg.on('pointerdown', onClick);
  return { bg, txt, destroy() { bg.destroy(); txt.destroy(); }, setEnabled(on) { bg.setAlpha(on ? 1 : 0.4); txt.setAlpha(on ? 1 : 0.4); } };
}

class TitleScene extends Phaser.Scene {
  constructor() { super('TitleScene'); }

  create() {
    const c = GAME_WIDTH / 2;
    this.add.text(c, 110, 'CIPHER\nSTATION', { fontFamily: FONT, fontSize: '52px', color: hex(COL.rx), align: 'center' }).setOrigin(0.5);
    const g = this.add.graphics();
    ['send', 'one', 'plus', 'chan', 'eq', 'unk', 'yes'].forEach((id, i) => drawGlyph(g, id, c + (i - 3) * 44, 210, 30, COL.dim));
    const how = [
      'You are the night operator at a',
      'listening station. Something is',
      'transmitting in a tiny language. It is',
      'perfectly consistent: a sign always',
      'means the same thing.',
      '',
      '• Read the log (RX = them, TX = you).',
      '• Tap symbols to build a reply, then',
      '  TRANSMIT. Replies per night are few.',
      '• The station answers every reply, so',
      '  a reply is also an experiment.',
      '• Answer the highlighted transmission',
      '  to finish the night. Out of replies:',
      '  the signal fades and you retry it.',
    ];
    this.add.text(36, 260, how.join('\n'), { fontFamily: FONT, fontSize: '16px', color: '#cfe8d8', lineSpacing: 5 });
    makeButton(this, c, 700, 200, 60, 'PLAY', () => this.scene.start('StationScene', { night: 0 }), { size: '28px', color: 0x1d6a3e });
  }
}

const LOG_TOP = 66;
const LOG_BOTTOM = 540;
const LINE_H = 34;
const GLYPH = 24;

class StationScene extends Phaser.Scene {
  constructor() { super('StationScene'); }

  init(data) {
    this.nightIndex = data.night || 0;
    this.archive = data.archive || []; // lines from finished nights, plus separators
    this.known = new Set(data.known || []);
  }

  create() {
    this.cs = C.startNight(this.nightIndex);
    this.shown = this.cs.log.length;
    this.compose = [];
    this.busy = false;
    this.scrollY = 0;
    this.overlay = null;
    this.archive.push({ sep: `NIGHT ${this.nightIndex + 1} · CHANNEL ${this.cs.chan}` });
    this.nightStart = this.archive.length;

    this.header = this.add.text(12, 12, '', { fontFamily: FONT, fontSize: '18px', color: hex(COL.rx) });
    this.repliesText = this.add.text(468, 12, '', { fontFamily: FONT, fontSize: '18px', color: hex(COL.tx) }).setOrigin(1, 0);
    this.add.text(12, 38, 'drag the log to scroll', { fontFamily: FONT, fontSize: '11px', color: hex(COL.dim) });

    // Log panel
    this.add.rectangle(240, (LOG_TOP + LOG_BOTTOM) / 2, 464, LOG_BOTTOM - LOG_TOP, COL.panel).setStrokeStyle(2, COL.border);
    this.logLayer = this.add.container(0, 0);
    const maskShape = this.make.graphics({ add: false });
    maskShape.fillStyle(0xffffff).fillRect(8, LOG_TOP + 2, 464, LOG_BOTTOM - LOG_TOP - 4);
    this.logLayer.setMask(maskShape.createGeometryMask());
    const hit = this.add.zone(240, (LOG_TOP + LOG_BOTTOM) / 2, 464, LOG_BOTTOM - LOG_TOP).setInteractive();
    hit.on('pointerdown', (p) => { this.dragFrom = p.y; this.dragScroll = this.scrollY; });
    this.input.on('pointerup', () => { this.dragFrom = null; });
    this.input.on('pointermove', (p) => {
      if (this.dragFrom != null && p.isDown) { this.scrollY = this.dragScroll + (p.y - this.dragFrom); this.renderLog(); }
    });
    this.input.on('wheel', (p, objs, dx, dy) => { this.scrollY -= dy * 0.5; this.renderLog(); });

    // Compose line
    this.add.rectangle(240, 578, 464, 56, 0x0a1610).setStrokeStyle(2, COL.tx, 0.6);
    this.add.text(14, 552, 'TX', { fontFamily: FONT, fontSize: '12px', color: hex(COL.tx) });
    this.composeG = this.add.graphics();

    this.keys = this.add.container(0, 0);
    makeButton(this, 70, 800, 110, 54, '⌫ DEL', () => this.del(), { size: '18px' });
    makeButton(this, 190, 800, 110, 54, 'CLEAR', () => { if (!this.busy) { this.compose = []; this.refresh(); } }, { size: '18px' });
    this.txBtn = makeButton(this, 360, 800, 200, 54, 'TRANSMIT', () => this.transmit(), { size: '22px', color: 0x5a3a10, text: '#ffd9a0' });

    const kb = this.input.keyboard;
    if (kb) {
      kb.on('keydown-BACKSPACE', () => this.del());
      kb.on('keydown-ENTER', () => this.transmit());
    }
    this.refresh();
  }

  allLines() {
    return this.archive.concat(this.cs.log.slice(0, this.shown));
  }

  del() {
    if (this.busy) return;
    this.compose.pop();
    this.refresh();
  }

  addGlyph(id) {
    if (this.busy || this.overlay || this.compose.length >= 10) return;
    this.compose.push(id);
    this.refresh();
  }

  transmit() {
    if (this.busy || this.overlay || !this.compose.length || this.cs.status !== 'open') return;
    const { state } = C.transmit(this.cs, this.compose);
    this.cs = state;
    this.compose = [];
    this.shown += 1; // our TX line
    this.busy = true;
    this.scrollY = 0;
    this.refresh();
    const reveal = () => {
      if (this.shown < this.cs.log.length) {
        this.shown += 1;
        this.scrollY = 0;
        this.refresh();
        this.time.delayedCall(450, reveal);
      } else {
        this.busy = false;
        this.refresh();
        if (this.cs.status !== 'open') this.time.delayedCall(500, () => this.endNight());
      }
    };
    this.time.delayedCall(550, reveal);
  }

  endNight() {
    const won = this.cs.status === 'won';
    const last = this.nightIndex === C.NIGHTS.length - 1;
    const items = [];
    items.push(this.add.rectangle(240, 330, 420, 280, 0x050c08, 0.95).setStrokeStyle(3, won ? COL.rx : 0xff6060));
    let title, body;
    if (won && last) {
      title = 'NEW FREQUENCY';
      body = 'The dial jumps by itself.\nThe sign you read as "three" was\n"this channel" all along.\n\nChannel 4 is open, and silent.\nFor now.';
    } else if (won) {
      title = `NIGHT ${this.nightIndex + 1} DECODED`;
      body = `Replies left: ${this.cs.repliesLeft}\n\nEverything they sent stays in your log.`;
    } else {
      title = 'SIGNAL FADES';
      body = 'You ran out of replies tonight.\nThe log keeps what you learned:\nthe night will replay the same way.';
    }
    items.push(this.add.text(240, 230, title, { fontFamily: FONT, fontSize: '28px', color: won ? hex(COL.rx) : '#ff8080' }).setOrigin(0.5));
    items.push(this.add.text(240, 330, body, { fontFamily: FONT, fontSize: '16px', color: '#cfe8d8', align: 'center' }).setOrigin(0.5));
    const archive = this.allLines();
    const known = [...this.known];
    if (won && !last) {
      items.push(makeButton(this, 240, 430, 220, 52, 'NEXT NIGHT', () => this.scene.start('StationScene', { night: this.nightIndex + 1, archive, known }), { color: 0x1d6a3e }));
    } else if (won) {
      items.push(makeButton(this, 240, 430, 220, 52, 'TITLE', () => this.scene.start('TitleScene'), { color: 0x1d6a3e }));
    } else {
      // Retry keeps earlier nights' log but replays tonight from its start.
      const earlier = this.archive.slice(0, this.nightStart - 1);
      items.push(makeButton(this, 240, 430, 220, 52, 'RETRY NIGHT', () => this.scene.start('StationScene', { night: this.nightIndex, archive: earlier, known }), { color: 0x1d6a3e }));
    }
    this.overlay = items;
  }

  refresh() {
    const lines = this.allLines();
    for (const l of lines) if (l.tokens) l.tokens.forEach((t) => this.known.add(t));
    this.header.setText(`NIGHT ${this.nightIndex + 1}/${C.NIGHTS.length} · CH ${this.cs.chan}`);
    const n = C.NIGHTS[this.nightIndex].replies;
    this.repliesText.setText('replies ' + '▮'.repeat(this.cs.repliesLeft) + '▯'.repeat(n - this.cs.repliesLeft));
    this.renderLog();
    this.renderCompose();
    this.renderKeys();
    this.txBtn.setEnabled(!this.busy && this.compose.length > 0 && this.cs.status === 'open');
  }

  renderLog() {
    this.logLayer.removeAll(true);
    const lines = this.allLines();
    const g = this.add.graphics();
    this.logLayer.add(g);
    const contentH = lines.length * LINE_H + 12;
    const viewH = LOG_BOTTOM - LOG_TOP;
    const maxScroll = Math.max(0, contentH - viewH);
    this.scrollY = Phaser.Math.Clamp(this.scrollY, 0, maxScroll);
    // scrollY = 0 means pinned to the newest line
    const top = LOG_TOP + 8 - (maxScroll - this.scrollY);
    const openPrompt = this.cs.status === 'open' ? this.lastPromptIndex(lines) : -1;
    lines.forEach((l, i) => {
      const y = top + i * LINE_H + LINE_H / 2;
      if (y < LOG_TOP - LINE_H || y > LOG_BOTTOM + LINE_H) return;
      if (l.sep) {
        g.lineStyle(1, COL.dim, 1).lineBetween(20, y, 460, y);
        const t = this.add.text(240, y, ' ' + l.sep + ' ', { fontFamily: FONT, fontSize: '12px', color: hex(COL.dim), backgroundColor: hex(COL.panel) }).setOrigin(0.5);
        this.logLayer.add(t);
        return;
      }
      const isTx = l.who === 'tx';
      const col = isTx ? COL.tx : COL.rx;
      const faded = i < this.nightStart;
      if (i === openPrompt) {
        g.lineStyle(2, COL.prompt, 1).strokeRect(14, y - LINE_H / 2 + 2, 452, LINE_H - 4);
      }
      const tag = this.add.text(22, y, isTx ? 'TX' : 'RX', { fontFamily: FONT, fontSize: '12px', color: hex(col) }).setOrigin(0, 0.5).setAlpha(faded ? 0.5 : 1);
      this.logLayer.add(tag);
      const x0 = isTx ? 66 : 66;
      l.tokens.forEach((t, k) => drawGlyph(g, t, x0 + k * (GLYPH + 8), y, GLYPH, col, faded ? 0.5 : 1));
      if (i === openPrompt) {
        const a = this.add.text(458, y, 'answer', { fontFamily: FONT, fontSize: '11px', color: hex(COL.prompt) }).setOrigin(1, 0.5);
        this.logLayer.add(a);
      }
    });
  }

  lastPromptIndex(lines) {
    for (let i = lines.length - 1; i >= this.nightStart; i--) if (lines[i].prompt) return i;
    return -1;
  }

  renderCompose() {
    const g = this.composeG;
    g.clear();
    this.compose.forEach((t, k) => drawGlyph(g, t, 60 + k * 38, 580, 28, COL.tx));
    if (!this.compose.length) g.fillStyle(COL.dim, 0.6).fillRect(60, 592, 24, 3);
  }

  renderKeys() {
    this.keys.removeAll(true);
    const ids = Object.keys(C.GLYPHS).filter((id) => this.known.has(id));
    ids.forEach((id, i) => {
      const col = i % 5, row = Math.floor(i / 5);
      const x = 56 + col * 92, y = 660 + row * 70;
      const bg = this.add.rectangle(x, y, 80, 58, 0x0f241a).setStrokeStyle(2, COL.border).setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => bg.setFillStyle(0x1e5236));
      bg.on('pointerout', () => bg.setFillStyle(0x0f241a));
      bg.on('pointerdown', () => this.addGlyph(id));
      const g = this.add.graphics();
      drawGlyph(g, id, x, y, 34, COL.rx);
      this.keys.add([bg, g]);
    });
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game',
  backgroundColor: '#050c08',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [TitleScene, StationScene],
});
