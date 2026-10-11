const GAME_WIDTH = 480;
const GAME_HEIGHT = 854;
const FONT = { fontFamily: 'Georgia, serif', color: '#eee6d6' };

const ROOM_RECTS = {
  Library: [20, 96, 215, 84],
  Study: [245, 96, 215, 84],
  Hall: [20, 188, 440, 64],
  'Dining Room': [20, 260, 215, 84],
  Conservatory: [245, 260, 215, 84],
};
const ROOM_SHORT = { Library: 'Lib', Study: 'Study', Hall: 'Hall', 'Dining Room': 'Dining', Conservatory: 'Cons' };

function button(scene, x, y, label, onClick, opts = {}) {
  const bg = opts.bg || '#3a2f28';
  const t = scene.add.text(x, y, label, {
    ...FONT, fontSize: (opts.size || 20) + 'px', backgroundColor: bg,
    padding: { x: opts.padX || 14, y: 8 }, align: 'center', fixedWidth: opts.width || 0,
  }).setOrigin(0.5).setInteractive({ useHandCursor: true });
  t.baseBg = bg;
  t.on('pointerover', () => t.setStyle({ backgroundColor: '#5c4a3c' }));
  t.on('pointerout', () => t.setStyle({ backgroundColor: t.baseBg }));
  t.on('pointerdown', () => onClick());
  return t;
}

class TitleScene extends Phaser.Scene {
  constructor() { super('TitleScene'); }
  create() {
    const cx = GAME_WIDTH / 2;
    this.add.text(cx, 150, 'The Ninth Guest', { ...FONT, fontSize: '44px', color: '#e8c27a' }).setOrigin(0.5);
    this.add.text(cx, 200, 'a dinner party that ends in murder, every night', { ...FONT, fontSize: '16px', color: '#a89a86' }).setOrigin(0.5);
    const how = [
      'At midnight the Host is poisoned. Then the',
      'evening starts again at 6 pm. You keep',
      'only your notebook.',
      '',
      'Each night you have 6 actions, one per hour:',
      'watch a room, ask a guest a question, or',
      'move an object. Everyone follows a fixed',
      'schedule. Moved objects change it, exactly',
      'as the preview says.',
      '',
      'Accuse a guest any time by showing a notebook',
      'entry that proves they did it. A wrong',
      'accusation ends the night. You have 6 nights.',
    ];
    this.add.text(cx, 420, how.join('\n'), { ...FONT, fontSize: '17px', align: 'center', lineSpacing: 5 }).setOrigin(0.5);
    button(this, cx, 680, 'Play', () => this.scene.start('GameScene'), { size: 30, padX: 40 });
  }
}

class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  create() {
    this.state = NG.newGame();
    this.hourLabels = [];
    this.sel = null;
    this.overlay = null;
    this.g = this.add.graphics();

    this.header = this.add.text(20, 14, '', { ...FONT, fontSize: '18px', lineSpacing: 6 });
    this.roomTexts = {};
    for (const [room, [x, y, w, h]] of Object.entries(ROOM_RECTS)) {
      const zone = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.select({ kind: 'watch', room }));
      this.add.text(x + 8, y + 6, room, { ...FONT, fontSize: '17px', color: '#e8c27a' });
      this.roomTexts[room] = this.add.text(x + 8, y + 30, '', { ...FONT, fontSize: '13px', color: '#c9bba5', wordWrap: { width: w - 16 } });
    }

    this.add.text(20, 366, 'Ask', { ...FONT, fontSize: '16px', color: '#a89a86' });
    this.askBtns = NG.GUESTS.map((gst, i) => button(this, 120 + i * 98, 376, gst, () => this.select({ kind: 'ask', guest: gst }), { size: 15, width: 84, padX: 4 }));
    this.add.text(20, 414, 'Move', { ...FONT, fontSize: '16px', color: '#a89a86' });
    this.moveBtns = {
      letter: button(this, 180, 424, '', () => this.select({ kind: 'move', obj: 'letter' }), { size: 14, width: 196, padX: 4 }),
      decanter: button(this, 376, 424, '', () => this.select({ kind: 'move', obj: 'decanter' }), { size: 14, width: 180, padX: 4 }),
    };

    this.previewText = this.add.text(20, 456, '', { ...FONT, fontSize: '15px', wordWrap: { width: 440 }, lineSpacing: 3 });
    this.doBtn = button(this, GAME_WIDTH / 2, 585, 'Do it (uses this hour)', () => this.commit(), { size: 18, bg: '#5a3b22' });
    this.resultText = this.add.text(20, 616, '', { ...FONT, fontSize: '14px', color: '#d8ccb6', wordWrap: { width: 440 }, lineSpacing: 3 });

    button(this, 125, 815, 'Notebook', () => this.showNotebook(0), { size: 19, width: 170 });
    button(this, 355, 815, 'Accuse', () => this.showAccuse(), { size: 19, width: 170, bg: '#5a2222' });

    this.render();
  }

  select(a) {
    if (this.overlay) return;
    if (this.state.status !== 'play' || this.state.nightOver) return;
    this.sel = a;
    this.render();
  }

  commit() {
    if (this.overlay || !this.sel) return;
    const next = NG.act(this.state, this.sel);
    if (!next) return;
    this.state = next;
    this.sel = null;
    this.render();
    if (this.state.nightOver) this.showMidnight();
  }

  render() {
    const s = this.state;
    const g = this.g;
    g.clear();
    const hourIdx = Math.min(s.hour, NG.ACTIONS - 1);

    this.header.setText('Night ' + s.night + ' of ' + NG.NIGHTS + '      ' + (s.nightOver ? 'midnight' : NG.HOURS[s.hour]) + '      actions left: ' + (NG.ACTIONS - s.hour));
    // Hour track
    for (let h = 0; h < NG.ACTIONS; h++) {
      const x = 20 + h * 74, y = 48;
      const done = h < s.hour;
      g.fillStyle(h === s.hour && !s.nightOver ? 0xe8c27a : done ? 0x4a3d33 : 0x241e1a, 1);
      g.fillRoundedRect(x, y, 66, 30, 6);
      if (!this.hourLabels) this.hourLabels = [];
      if (!this.hourLabels[h]) this.hourLabels[h] = this.add.text(x + 33, y + 15, NG.HOURS[h], { ...FONT, fontSize: '14px' }).setOrigin(0.5).setDepth(1);
      this.hourLabels[h].setColor(h === s.hour && !s.nightOver ? '#1a1410' : '#eee6d6');
    }

    // Rooms
    for (const [room, [x, y, w, h]] of Object.entries(ROOM_RECTS)) {
      const selected = this.sel && ((this.sel.kind === 'watch' && this.sel.room === room) || (this.sel.kind === 'move' && NG.OBJECTS[this.sel.obj].from === room));
      g.fillStyle(selected ? 0x4a3a2a : 0x2a221d, 1);
      g.fillRect(x, y, w, h);
      g.lineStyle(selected ? 3 : 1, selected ? 0xe8c27a : 0x6b5a4a, 1);
      g.strokeRect(x, y, w, h);
      const objs = Object.keys(NG.OBJECTS).filter((o) => NG.objectRoom(s, o, hourIdx) === room).map((o) => NG.OBJECTS[o].name);
      const seen = s.notes.filter((n) => n.night === s.night && n.room === room).map((n) => NG.HOURS[n.hour]);
      this.roomTexts[room].setText((objs.length ? 'Here: ' + objs.join(', ') : '') + (seen.length ? (objs.length ? '\n' : '') + 'You were here: ' + seen.join(', ') : ''));
    }

    // Move buttons
    for (const [o, b] of Object.entries(this.moveBtns)) {
      const ob = NG.OBJECTS[o];
      const done = s.moved[o] !== undefined;
      b.setText(done ? ob.short.replace('the ', '') + ' moved' : ob.short.replace('the ', '') + ': ' + ob.from + ' > ' + ob.to.replace(' Room', ''));
      b.setAlpha(done ? 0.4 : 1);
      b.baseBg = this.sel && this.sel.kind === 'move' && this.sel.obj === o ? '#7a5a2a' : '#3a2f28';
      b.setStyle({ backgroundColor: b.baseBg });
    }
    this.askBtns.forEach((b, i) => {
      b.baseBg = this.sel && this.sel.kind === 'ask' && this.sel.guest === NG.GUESTS[i] ? '#7a5a2a' : '#3a2f28';
      b.setStyle({ backgroundColor: b.baseBg });
    });

    // Preview
    if (s.nightOver || s.status !== 'play') this.previewText.setText('');
    else if (this.sel) this.previewText.setText(NG.preview(s, this.sel));
    else this.previewText.setText('Tap a room to watch it, a guest to ask, or an object to move. You will see exactly what the action does before using the hour.');
    const can = this.sel && NG.canDo(s, this.sel);
    this.doBtn.setAlpha(can ? 1 : 0.35);

    const r = s.lastResult;
    this.resultText.setText(r ? NG.HOURS[r.hour] + ', ' + r.room + ':\n' + r.text : 'Your notebook is ' + (s.notes.length ? 'waiting (' + s.notes.length + ' entries).' : 'empty.'));
  }

  // ---- overlays ----
  openOverlay() {
    this.closeOverlay();
    const c = this.add.container(0, 0).setDepth(10);
    const bg = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0e0b09, 1).setOrigin(0).setInteractive();
    c.add(bg);
    this.overlay = c;
    return c;
  }
  closeOverlay() { if (this.overlay) { this.overlay.destroy(true); this.overlay = null; } }

  showMidnight() {
    const s = this.state;
    const c = this.openOverlay();
    c.add(this.add.text(GAME_WIDTH / 2, 260, s.midnight || '', { ...FONT, fontSize: '22px', align: 'center', wordWrap: { width: 420 }, lineSpacing: 6 }).setOrigin(0.5));
    if (s.status === 'lost') {
      c.add(this.add.text(GAME_WIDTH / 2, 420, 'Game over', { ...FONT, fontSize: '36px', color: '#ff8a80' }).setOrigin(0.5));
      c.add(button(this, GAME_WIDTH / 2, 520, 'Start over', () => this.scene.restart(), { size: 22 }));
    } else {
      c.add(this.add.text(GAME_WIDTH / 2, 420, (NG.NIGHTS - s.night) + ' night(s) left. Your notebook keeps ' + s.notes.length + ' entries.', { ...FONT, fontSize: '16px', color: '#a89a86' }).setOrigin(0.5));
      c.add(button(this, GAME_WIDTH / 2, 500, 'Relive the evening', () => { this.state = NG.nextNight(this.state); this.closeOverlay(); this.render(); }, { size: 22 }));
      c.add(button(this, GAME_WIDTH / 2, 570, 'Read notebook first', () => this.showNotebook(0, true), { size: 18 }));
    }
  }

  // Notebook: a who-was-where grid plus all entries, newest first.
  showNotebook(page, fromMidnight) {
    const s = this.state;
    const c = this.openOverlay();
    c.add(this.add.text(20, 14, 'Notebook', { ...FONT, fontSize: '26px', color: '#e8c27a' }));
    c.add(this.add.text(20, 50, 'Where everyone was (latest sighting, * = a moved object changed that night)', { ...FONT, fontSize: '12px', color: '#a89a86', wordWrap: { width: 440 } }));
    const grid = NG.knownGrid(s);
    const x0 = 100, y0 = 84, cw = 62, rh = 24;
    NG.HOURS.forEach((h, i) => c.add(this.add.text(x0 + i * cw + cw / 2, y0, h, { ...FONT, fontSize: '12px', color: '#a89a86' }).setOrigin(0.5, 0)));
    ['Host'].concat(NG.GUESTS).forEach((w, r) => {
      const y = y0 + 22 + r * rh;
      c.add(this.add.text(20, y, w, { ...FONT, fontSize: '14px' }));
      grid[w].forEach((cell, i) => {
        const t = cell ? ROOM_SHORT[cell.room] + (cell.altered ? '*' : '') : '?';
        c.add(this.add.text(x0 + i * cw + cw / 2, y, t, { ...FONT, fontSize: '13px', color: cell ? '#eee6d6' : '#5c4f44' }).setOrigin(0.5, 0));
      });
    });
    const notes = s.notes.map((n, i) => ({ n, i })).reverse();
    this.drawNoteList(c, notes, page, 240, (p) => this.showNotebook(p, fromMidnight), null);
    c.add(button(this, GAME_WIDTH / 2, 815, 'Close', () => { this.closeOverlay(); if (fromMidnight || this.state.nightOver) this.showMidnight(); }, { size: 18, width: 140 }));
  }

  drawNoteList(c, items, page, top, goPage, onPick) {
    const per = 5;
    const pages = Math.max(1, Math.ceil(items.length / per));
    page = Math.min(page, pages - 1);
    let y = top;
    if (!items.length) c.add(this.add.text(20, y, 'No entries yet.', { ...FONT, fontSize: '15px', color: '#a89a86' }));
    for (const { n, i } of items.slice(page * per, page * per + per)) {
      const head = 'Night ' + n.night + ', ' + NG.HOURS[n.hour] + ', ' + n.room + (n.altered ? ' *' : '') + ':  ';
      const t = this.add.text(20, y, head + n.text, { ...FONT, fontSize: '13px', wordWrap: { width: 440 }, lineSpacing: 2, color: onPick ? '#f0dcb4' : '#d8ccb6', backgroundColor: onPick ? '#2a221d' : undefined, padding: onPick ? { x: 4, y: 4 } : undefined });
      if (onPick) t.setInteractive({ useHandCursor: true }).on('pointerdown', () => onPick(i));
      c.add(t);
      y += t.height + 8;
      if (y > 760) break;
    }
    if (pages > 1) {
      c.add(this.add.text(GAME_WIDTH / 2, 772, 'page ' + (page + 1) + ' / ' + pages, { ...FONT, fontSize: '13px', color: '#a89a86' }).setOrigin(0.5));
      if (page > 0) c.add(button(this, 70, 772, '< newer', () => goPage(page - 1), { size: 14 }));
      if (page < pages - 1) c.add(button(this, 410, 772, 'older >', () => goPage(page + 1), { size: 14 }));
    }
  }

  showAccuse() {
    if (this.state.status !== 'play') return;
    const c = this.openOverlay();
    c.add(this.add.text(20, 14, 'Accuse', { ...FONT, fontSize: '26px', color: '#ff9a8a' }));
    c.add(this.add.text(20, 56, 'Who poisoned the Host? Then pick the notebook entry that proves it. A wrong accusation ends the night.', { ...FONT, fontSize: '15px', wordWrap: { width: 440 } }));
    NG.GUESTS.forEach((gst, i) => c.add(button(this, GAME_WIDTH / 2, 150 + i * 62, NG.FULL[gst], () => this.showProofPick(gst, 0), { size: 20, width: 260 })));
    c.add(button(this, GAME_WIDTH / 2, 815, 'Cancel', () => this.closeOverlay(), { size: 18, width: 140 }));
  }

  showProofPick(guest, page) {
    const s = this.state;
    const c = this.openOverlay();
    c.add(this.add.text(20, 14, 'Proof against ' + NG.FULL[guest], { ...FONT, fontSize: '22px', color: '#ff9a8a' }));
    c.add(this.add.text(20, 50, 'Tap the entry that shows it. (Entries where they appear.)', { ...FONT, fontSize: '14px', color: '#a89a86' }));
    const items = s.notes.map((n, i) => ({ n, i })).filter(({ n }) => n.here.includes(guest)).reverse();
    this.drawNoteList(c, items, page, 82, (p) => this.showProofPick(guest, p), (idx) => this.doAccuse(guest, idx));
    c.add(button(this, GAME_WIDTH / 2, 815, 'Back', () => this.showAccuse(), { size: 18, width: 140 }));
  }

  doAccuse(guest, idx) {
    this.state = NG.accuse(this.state, guest, idx);
    this.sel = null;
    this.render();
    if (this.state.status === 'won') {
      const c = this.openOverlay();
      c.add(this.add.text(GAME_WIDTH / 2, 260, 'Solved', { ...FONT, fontSize: '44px', color: '#9ff0b5' }).setOrigin(0.5));
      c.add(this.add.text(GAME_WIDTH / 2, 360, this.state.verdict + '\n\nSolved on night ' + this.state.night + '.', { ...FONT, fontSize: '19px', align: 'center', wordWrap: { width: 420 }, lineSpacing: 5 }).setOrigin(0.5));
      c.add(button(this, GAME_WIDTH / 2, 520, 'Play again', () => this.scene.restart(), { size: 22 }));
      c.add(button(this, GAME_WIDTH / 2, 590, 'Title', () => this.scene.start('TitleScene'), { size: 18 }));
    } else {
      this.showMidnight();
    }
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game',
  backgroundColor: '#17120f',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [TitleScene, GameScene],
});
