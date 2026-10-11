const GAME_WIDTH = 480;
const GAME_HEIGHT = 854;
const RR = window.RootRot;

const CELL = 54;
const GRID_X = 24;
const GRID_Y = 112;

const COLORS = {
  bg: 0x16120e,
  soil: 0x3b2a1e,
  soilLine: 0x2a1d14,
  stone: 0x6f6f72,
  stoneDark: 0x505055,
  rotNew: 0x8a6a2e,
  rotOld: 0x5f4b2a,
  species: [0x63c74d, 0x31b6a8, 0xc04f8a],
  ok: 0x7dff7a,
  bad: 0xff5a5a,
  white: 0xffffff,
};
const HEX = (c) => '#' + c.toString(16).padStart(6, '0');
const FONT = 'sans-serif';

const SPECIES_INFO = [
  'Moss: spreads to its 4 side neighbours. Beats Fern, loses to Bramble.',
  'Fern: spreads to its 4 diagonal neighbours. Beats Bramble, loses to Moss.',
  'Bramble: jumps 2 squares straight in 4 directions. Beats Moss, loses to Fern.',
];

const HELP_TEXT = [
  'Plant your seeds on bare soil, check the',
  'preview, then press Grow to play the season.',
  '',
  'Every turn each plant spreads in its shape',
  'onto bare soil:',
  '  Moss: 4 sides.  Fern: 4 diagonals.',
  '  Bramble: jumps 2 squares straight.',
  '',
  'Moss beats Fern, Fern beats Bramble,',
  'Bramble beats Moss. A plant reached by a',
  'species that beats it dies and becomes rot.',
  'If two species reach the same soil, the',
  'winner takes it. All three at once cancel.',
  '',
  'Rot blocks growth. Fresh rot eats into stone',
  'beside it. Rot turns to bare soil after 2 turns.',
  '',
  'At the last turn, every ringed cell must hold',
  'its species (a dashed ring: bare soil).',
  'Nothing is random: the preview is the future.',
];

function makeButton(scene, x, y, label, onClick, opts = {}) {
  const bg = opts.bg || '#333333';
  const hover = opts.hover || '#555555';
  const t = scene.add
    .text(x, y, label, {
      fontFamily: FONT,
      fontSize: opts.size || '22px',
      color: opts.color || '#ffffff',
      backgroundColor: bg,
      padding: { x: opts.padX ?? 16, y: opts.padY ?? 8 },
      fixedWidth: opts.width || 0,
      align: 'center',
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });
  t.baseBg = bg;
  t.on('pointerover', () => t.setStyle({ backgroundColor: hover }));
  t.on('pointerout', () => t.setStyle({ backgroundColor: t.baseBg }));
  t.on('pointerdown', onClick);
  if (opts.depth) t.setDepth(opts.depth);
  return t;
}

class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create() {
    const cx = GAME_WIDTH / 2;
    // ?level=N jumps straight to a level (handy for testing)
    const jump = parseInt(new URLSearchParams(window.location.search).get('level'), 10);
    if (jump >= 1 && jump <= RR.LEVELS.length && !this.registry.get('jumped')) {
      this.registry.set('jumped', true);
      this.scene.start('GameScene', { level: jump - 1 });
      return;
    }
    this.add.text(cx, 170, 'Root & Rot', { fontFamily: FONT, fontSize: '56px', color: '#cfe8b0' }).setOrigin(0.5);
    this.add
      .text(cx, 230, 'a garden automaton puzzle', { fontFamily: FONT, fontSize: '20px', color: '#a89880' })
      .setOrigin(0.5);

    // little decorative plants
    const g = this.add.graphics();
    drawGlyph(g, 0, cx - 80, 300, 22);
    drawGlyph(g, 1, cx, 300, 22);
    drawGlyph(g, 2, cx + 80, 300, 22);

    this.add
      .text(
        cx,
        420,
        [
          'Plant up to 3 seeds. Each season plays out',
          'turn by turn with simple, fixed rules.',
          'Moss beats Fern, Fern beats Bramble,',
          'Bramble beats Moss. Beaten plants rot.',
          '',
          'Scrub the full preview before you commit:',
          'nothing is random. Fill every ringed cell.',
        ].join('\n'),
        { fontFamily: FONT, fontSize: '18px', color: '#dddddd', align: 'center', lineSpacing: 6 }
      )
      .setOrigin(0.5);

    makeButton(this, cx, 600, 'Play', () => this.scene.start('GameScene', { level: 0 }), {
      size: '32px',
      padX: 40,
      padY: 12,
      bg: '#3b6b2e',
      hover: '#4f8a3e',
    });
  }
}

// Draw a species glyph centred at (x, y) with radius r.
function drawGlyph(g, sp, x, y, r) {
  g.fillStyle(COLORS.species[sp], 1);
  if (sp === 0) {
    g.fillCircle(x, y, r);
  } else if (sp === 1) {
    g.fillPoints(
      [
        { x, y: y - r },
        { x: x + r, y },
        { x, y: y + r },
        { x: x - r, y },
      ],
      true
    );
  } else {
    g.fillTriangle(x, y - r, x + r, y + r * 0.8, x - r, y + r * 0.8);
  }
}

class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  init(data) {
    this.levelIndex = data.level || 0;
    this.keepSeeds = data.keepSeeds || null;
  }

  create() {
    const lv = RR.LEVELS[this.levelIndex];
    this.lv = lv;
    const parsed = RR.parseLevel(lv);
    this.base = parsed.grid;
    this.targets = parsed.targets;
    this.slots = lv.seeds.map((sp, i) => ({ sp, pos: this.keepSeeds ? this.keepSeeds[i] : null }));
    this.selected = 0;
    this.viewTurn = 0;
    this.busy = false;

    this.add
      .text(16, 14, `Level ${this.levelIndex + 1}/${RR.LEVELS.length} · ${lv.name}`, {
        fontFamily: FONT,
        fontSize: '22px',
        color: '#cfe8b0',
        fontStyle: 'bold',
      });
    this.add.text(16, 46, lv.hint, {
      fontFamily: FONT,
      fontSize: '15px',
      color: '#c8bba8',
      wordWrap: { width: 448 },
      lineSpacing: 2,
    });

    this.gfx = this.add.graphics();
    this.cellLabels = [];
    for (let i = 0; i < RR.W * RR.H; i++) {
      const x = GRID_X + (i % RR.W) * CELL;
      const y = GRID_Y + Math.floor(i / RR.W) * CELL;
      this.cellLabels.push(
        this.add.text(x + CELL - 5, y + 3, '', { fontFamily: FONT, fontSize: '13px', color: '#ffffff' }).setOrigin(1, 0)
      );
    }
    const zone = this.add
      .zone(GRID_X, GRID_Y, RR.W * CELL, RR.H * CELL)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerdown', (p) => this.onGridTap(p));

    // Turn scrubber
    const sy = GRID_Y + RR.H * CELL + 26;
    this.scrubBtns = [
      makeButton(this, 50, sy, '|◀', () => this.setView(0), { size: '20px', padX: 10 }),
      makeButton(this, 110, sy, '◀', () => this.setView(this.viewTurn - 1), { size: '20px', padX: 14 }),
      makeButton(this, 370, sy, '▶', () => this.setView(this.viewTurn + 1), { size: '20px', padX: 14 }),
      makeButton(this, 430, sy, '▶|', () => this.setView(lv.turns), { size: '20px', padX: 10 }),
    ];
    this.turnText = this.add.text(240, sy, '', { fontFamily: FONT, fontSize: '20px', color: '#ffffff' }).setOrigin(0.5);
    this.statusText = this.add
      .text(240, sy + 40, '', { fontFamily: FONT, fontSize: '17px', color: '#ffffff' })
      .setOrigin(0.5);

    // Seed slots
    const slotY = sy + 92;
    this.add.text(16, slotY - 12, 'Seeds', { fontFamily: FONT, fontSize: '16px', color: '#a89880' });
    this.slotBtns = this.slots.map((s, i) => {
      const x = 140 + i * 122;
      return makeButton(this, x, slotY, RR.NAMES[s.sp], () => this.selectSlot(i), {
        size: '15px',
        width: 112,
        padX: 4,
        bg: HEX(COLORS.species[s.sp]),
        hover: HEX(COLORS.species[s.sp]),
        color: '#111111',
      });
    });
    this.slotMarker = this.add.graphics();
    this.infoText = this.add.text(16, slotY + 34, '', {
      fontFamily: FONT,
      fontSize: '15px',
      color: '#c8bba8',
      wordWrap: { width: 448 },
    });

    const by = GAME_HEIGHT - 44;
    this.bottomBtns = [
      makeButton(this, 80, by, 'Help', () => this.showHelp(), { size: '22px' }),
      makeButton(this, 220, by, 'Clear', () => this.clearSeeds(), { size: '22px' }),
      makeButton(this, 380, by, 'Grow!', () => this.commit(), {
        size: '26px',
        padX: 26,
        bg: '#3b6b2e',
        hover: '#4f8a3e',
      }),
    ];

    this.input.keyboard.on('keydown-LEFT', () => this.setView(this.viewTurn - 1));
    this.input.keyboard.on('keydown-RIGHT', () => this.setView(this.viewTurn + 1));

    this.overlay = null;
    this.recompute();
    if (this.levelIndex === 0 && !this.keepSeeds) this.showHelp();
  }

  seeds() {
    return this.slots.filter((s) => s.pos).map((s) => ({ x: s.pos.x, y: s.pos.y, sp: s.sp }));
  }

  recompute() {
    this.states = RR.simulate(this.base, this.seeds(), this.lv.turns);
    this.redraw();
  }

  setView(t) {
    if (this.busy || this.overlay) return;
    this.viewTurn = Phaser.Math.Clamp(t, 0, this.lv.turns);
    this.redraw();
  }

  selectSlot(i) {
    if (this.busy || this.overlay) return;
    this.selected = i;
    this.redraw();
  }

  clearSeeds() {
    if (this.busy || this.overlay) return;
    this.slots.forEach((s) => (s.pos = null));
    this.selected = 0;
    this.recompute();
  }

  onGridTap(p) {
    if (this.busy || this.overlay) return;
    const x = Math.floor((p.x - GRID_X) / CELL);
    const y = Math.floor((p.y - GRID_Y) / CELL);
    if (x < 0 || y < 0 || x >= RR.W || y >= RR.H) return;
    const existing = this.slots.findIndex((s) => s.pos && s.pos.x === x && s.pos.y === y);
    if (existing >= 0) {
      // tap a seed again to pull it up
      this.slots[existing].pos = null;
      this.selected = existing;
    } else if (this.base[y * RR.W + x] === RR.SOIL) {
      this.slots[this.selected].pos = { x, y };
      const next = this.slots.findIndex((s) => !s.pos);
      if (next >= 0) this.selected = next;
    } else {
      this.infoText.setText(this.describeCell(x, y));
      return;
    }
    this.recompute();
  }

  describeCell(x, y) {
    const c = this.base[y * RR.W + x];
    if (c === RR.STONE) return 'Stone: nothing grows here until fresh rot next to it eats it away.';
    if (RR.isPlant(c)) return 'Wild ' + SPECIES_INFO[c - RR.MOSS];
    return '';
  }

  redraw() {
    const g = this.gfx;
    g.clear();
    const state = this.states[this.viewTurn];
    const T = this.lv.turns;
    for (let i = 0; i < RR.W * RR.H; i++) {
      const cx = GRID_X + (i % RR.W) * CELL;
      const cy = GRID_Y + Math.floor(i / RR.W) * CELL;
      const c = state[i];
      const label = this.cellLabels[i];
      label.setText('');
      g.fillStyle(COLORS.soil, 1);
      g.fillRect(cx, cy, CELL, CELL);
      g.lineStyle(1, COLORS.soilLine, 1);
      g.strokeRect(cx, cy, CELL, CELL);
      if (c === RR.STONE) {
        g.fillStyle(COLORS.stone, 1);
        g.fillRoundedRect(cx + 3, cy + 3, CELL - 6, CELL - 6, 6);
        g.fillStyle(COLORS.stoneDark, 1);
        g.fillCircle(cx + 18, cy + 20, 5);
        g.fillCircle(cx + 34, cy + 34, 4);
      } else if (RR.isPlant(c)) {
        const sp = c - RR.MOSS;
        g.fillStyle(COLORS.species[sp], 0.25);
        g.fillRect(cx + 2, cy + 2, CELL - 4, CELL - 4);
        drawGlyph(g, sp, cx + CELL / 2, cy + CELL / 2, 15);
      } else if (c === RR.ROT_NEW || c === RR.ROT_OLD) {
        g.fillStyle(c === RR.ROT_NEW ? COLORS.rotNew : COLORS.rotOld, 1);
        g.fillRoundedRect(cx + 4, cy + 4, CELL - 8, CELL - 8, 10);
        g.fillStyle(0x2a1d10, 1);
        g.fillCircle(cx + 17, cy + 19, 4);
        g.fillCircle(cx + 35, cy + 24, 3);
        g.fillCircle(cx + 25, cy + 36, 4);
        label.setText(c === RR.ROT_NEW ? '2' : '1'); // turns of rot left
      }
    }
    // Seeds the player planted (visible on every turn as a small white corner dot)
    for (const s of this.slots) {
      if (!s.pos) continue;
      const cx = GRID_X + s.pos.x * CELL;
      const cy = GRID_Y + s.pos.y * CELL;
      g.lineStyle(3, COLORS.white, this.viewTurn === 0 ? 1 : 0.35);
      g.strokeCircle(cx + CELL / 2, cy + CELL / 2, 21);
    }
    // Targets
    const finalOk = RR.checkTargets(this.states[T], this.targets);
    const nowOk = RR.checkTargets(state, this.targets);
    this.targets.forEach((t, k) => {
      const cx = GRID_X + t.x * CELL;
      const cy = GRID_Y + t.y * CELL;
      const color = t.want === RR.SOIL ? COLORS.white : COLORS.species[t.want - RR.MOSS];
      g.lineStyle(4, color, 1);
      if (t.want === RR.SOIL) {
        // dashed ring: must be bare soil
        for (let d = 0; d < 4; d++) {
          g.lineBetween(cx + 6 + d * 12, cy + 4, cx + 12 + d * 12, cy + 4);
          g.lineBetween(cx + 6 + d * 12, cy + CELL - 4, cx + 12 + d * 12, cy + CELL - 4);
          g.lineBetween(cx + 4, cy + 6 + d * 12, cx + 4, cy + 12 + d * 12);
          g.lineBetween(cx + CELL - 4, cy + 6 + d * 12, cx + CELL - 4, cy + 12 + d * 12);
        }
      } else {
        g.strokeRect(cx + 4, cy + 4, CELL - 8, CELL - 8);
      }
      // small badge: is this target satisfied in the viewed turn?
      g.fillStyle(nowOk[k] ? COLORS.ok : COLORS.bad, 1);
      g.fillCircle(cx + 10, cy + CELL - 10, 5);
    });

    const met = finalOk.filter(Boolean).length;
    this.turnText.setText(`Turn ${this.viewTurn} / ${T}`);
    this.statusText.setText(`Preview, end of season: ${met}/${this.targets.length} targets met`);
    this.statusText.setColor(met === this.targets.length ? '#7dff7a' : '#ffffff');

    // Seed slot highlight
    this.slotMarker.clear();
    this.slotBtns.forEach((b, i) => {
      const s = this.slots[i];
      b.setText(RR.NAMES[s.sp] + (s.pos ? ` (${s.pos.x + 1},${s.pos.y + 1})` : ''));
      b.setAlpha(s.pos ? 0.6 : 1);
      if (i === this.selected) {
        this.slotMarker.lineStyle(3, COLORS.white, 1);
        this.slotMarker.strokeRect(b.x - b.width / 2 - 2, b.y - b.height / 2 - 2, b.width + 4, b.height + 4);
      }
    });
    const sel = this.slots[this.selected];
    this.infoText.setText(
      `Tap soil to plant ${RR.NAMES[sel.sp]}. Tap a seed again to remove it.\n` + SPECIES_INFO[sel.sp]
    );
  }

  commit() {
    if (this.busy || this.overlay) return;
    this.busy = true;
    this.viewTurn = 0;
    this.redraw();
    const T = this.lv.turns;
    this.time.addEvent({
      delay: 450,
      repeat: T - 1,
      callback: () => {
        this.viewTurn++;
        this.redraw();
        if (this.viewTurn >= T) {
          this.time.delayedCall(500, () => {
            this.busy = false;
            this.showResult();
          });
        }
      },
    });
  }

  showResult() {
    const ok = RR.checkTargets(this.states[this.lv.turns], this.targets);
    const met = ok.filter(Boolean).length;
    const win = met === ok.length;
    const last = this.levelIndex === RR.LEVELS.length - 1;
    let title, body, label, action;
    if (win && last) {
      title = 'Garden complete!';
      body = 'You solved every season.';
      label = 'Play again';
      action = () => this.scene.start('TitleScene');
    } else if (win) {
      title = 'In full bloom!';
      body = `All ${ok.length} targets met.`;
      label = 'Next level';
      action = () => this.scene.start('GameScene', { level: this.levelIndex + 1 });
    } else {
      title = 'The season failed';
      body = `${met} of ${ok.length} targets met.\nYour seeds stay put so you can adjust.`;
      label = 'Try again';
      const keep = this.slots.map((s) => s.pos);
      action = () => this.scene.start('GameScene', { level: this.levelIndex, keepSeeds: keep });
    }
    this.openOverlay(title, body, label, action, win ? '#cfe8b0' : '#ffb0a0');
  }

  showHelp() {
    this.openOverlay('How to play', HELP_TEXT.join('\n'), 'Got it', () => this.closeOverlay(), '#cfe8b0', true);
  }

  openOverlay(title, body, label, action, titleColor, tall) {
    this.closeOverlay();
    const h = tall ? 640 : 230;
    const top = (GAME_HEIGHT - h) / 2;
    const items = [];
    const shade = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setOrigin(0).setDepth(10);
    shade.setInteractive(); // swallow taps
    items.push(shade);
    items.push(this.add.rectangle(30, top, GAME_WIDTH - 60, h, 0x231c15).setOrigin(0).setStrokeStyle(2, 0x6b5a44).setDepth(10));
    items.push(
      this.add
        .text(GAME_WIDTH / 2, top + 34, title, { fontFamily: FONT, fontSize: '28px', color: titleColor })
        .setOrigin(0.5)
        .setDepth(11)
    );
    items.push(
      this.add
        .text(GAME_WIDTH / 2, top + 68, body, {
          fontFamily: FONT,
          fontSize: tall ? '16px' : '18px',
          color: '#dddddd',
          align: tall ? 'left' : 'center',
          lineSpacing: 4,
        })
        .setOrigin(0.5, 0)
        .setDepth(11)
    );
    items.push(makeButton(this, GAME_WIDTH / 2, top + h - 40, label, action, { size: '24px', depth: 11, bg: '#3b6b2e', hover: '#4f8a3e' }));
    this.overlay = items;
  }

  closeOverlay() {
    if (this.overlay) this.overlay.forEach((o) => o.destroy());
    this.overlay = null;
  }
}

window.game = new Phaser.Game({
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game',
  backgroundColor: '#16120e',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [TitleScene, GameScene],
});
