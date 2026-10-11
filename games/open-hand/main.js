const GAME_WIDTH = 480;
const GAME_HEIGHT = 854;
const G = window.OpenHand;

const FONT = 'sans-serif';
const COL = {
  bg: 0x15171c, panel: 0x232733, panel2: 0x2d3242, edge: 0x4a5168,
  atk: 0xd9534f, blk: 0x4a8fd9, buff: 0xd9a441, good: 0x5cb85c, dim: 0x3a3d45, sel: 0xf0d060,
};

function cardKind(id) {
  const t = G.CARDS[id].text;
  if (['swap', 'skip', 'dig', 'echo', 'feint'].includes(id)) return 0x8e6fd1; // queue cards
  if (t.startsWith('Block')) return COL.blk;
  if (id === 'mend' || id === 'disarm') return COL.good;
  return COL.atk;
}

class TitleScene extends Phaser.Scene {
  constructor() { super('TitleScene'); }

  create() {
    const cx = GAME_WIDTH / 2;
    this.add.text(cx, 150, 'Open Hand', { fontFamily: FONT, fontSize: '56px', color: '#ffffff' }).setOrigin(0.5);
    this.add.text(cx, 205, 'a deckbuilder that never shuffles', { fontFamily: FONT, fontSize: '18px', color: '#aab' }).setOrigin(0.5);
    const help = [
      'How to play',
      '',
      '• Your 10-card deck is a queue, in the order YOU set.',
      '• Each turn you draw the top 3. You have 3 energy.',
      '• Played cards go to the bottom of the queue.',
      '  Unplayed cards go back on top for next turn.',
      '• The enemy\'s whole queue is face up. It does',
      '  its next intent when you end your turn.',
      '• Purple cards bend the queue: swap, skip, copy...',
      '• After a win: add one card, retire one. Heal 10.',
      '• Beat all 4 enemies to win the run.',
    ];
    this.add.text(40, 270, help.join('\n'), { fontFamily: FONT, fontSize: '17px', color: '#dde', lineSpacing: 6 });
    button(this, cx, 680, 220, 64, 'Play', () => this.scene.start('GameScene'));
  }
}

function button(scene, x, y, w, h, label, onClick, opts = {}) {
  const enabled = opts.enabled !== false;
  const r = scene.add.rectangle(x, y, w, h, enabled ? (opts.color || 0x3b6e4a) : COL.dim)
    .setStrokeStyle(2, 0xffffff, enabled ? 0.6 : 0.2);
  const t = scene.add.text(x, y, label, { fontFamily: FONT, fontSize: (opts.size || 26) + 'px', color: enabled ? '#fff' : '#888' }).setOrigin(0.5);
  if (enabled) {
    r.setInteractive({ useHandCursor: true });
    r.on('pointerdown', onClick);
  }
  return [r, t];
}

class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  create() {
    this.s = G.newRun();
    this.objs = [];
    this.pick = null; // arrange: first card picked for a swap
    this.rewardAdd = null; // reward: chosen card id
    this.rewardRemove = null; // reward: chosen deck index
    this.redraw();
  }

  track(...o) { o.flat().forEach((x) => this.objs.push(x)); return o[0]; }
  txt(x, y, str, size, color, extra = {}) {
    return this.track(this.add.text(x, y, str, Object.assign({ fontFamily: FONT, fontSize: size + 'px', color: color || '#fff' }, extra)));
  }
  rect(x, y, w, h, fill, stroke) {
    const r = this.add.rectangle(x, y, w, h, fill).setOrigin(0);
    if (stroke !== undefined) r.setStrokeStyle(2, stroke);
    return this.track(r);
  }
  btn(...a) { return this.track(button(this, ...a)); }

  redraw() {
    this.objs.forEach((o) => o.destroy());
    this.objs = [];
    const p = this.s.phase;
    if (p === 'arrange') this.drawArrange();
    else if (p === 'fight') this.drawFight();
    else if (p === 'reward') this.drawReward();
    else this.drawEnd();
  }

  // ---- shared pieces ----
  drawEnemyQueue(y, enemy, def) {
    const q = enemy ? enemy.queue : def.queue.map((i) => ({ type: i[0], n: i[1] }));
    const str = enemy ? enemy.str : 0;
    this.txt(16, y, enemy ? 'Enemy queue (left acts next, then goes to the back):' : 'Enemy queue (repeats in this order):', 14, '#aab');
    const n = q.length;
    const w = Math.min(86, (GAME_WIDTH - 32 - (n - 1) * 6) / n);
    q.forEach((it, i) => {
      const x = 16 + i * (w + 6);
      const c = it.type === 'atk' ? COL.atk : it.type === 'blk' ? COL.blk : COL.buff;
      this.rect(x, y + 22, w, 44, c, i === 0 && enemy ? 0xffffff : COL.edge).setFillStyle(c, i === 0 ? 1 : 0.55);
      this.txt(x + w / 2, y + 44, G.intentText(it, str), 15, '#fff').setOrigin(0.5);
    });
  }

  drawCard(x, y, w, h, id, opts = {}) {
    const c = G.CARDS[id];
    const r = this.rect(x, y, w, h, opts.dim ? COL.dim : COL.panel2, opts.sel ? COL.sel : cardKind(id));
    r.setStrokeStyle(opts.sel ? 4 : 3, opts.sel ? COL.sel : cardKind(id));
    this.rect(x, y, w, 30, cardKind(id)).setAlpha(opts.dim ? 0.4 : 0.9);
    this.txt(x + 8, y + 6, c.name, 16, '#fff', { fontStyle: 'bold' });
    this.track(this.add.circle(x + w - 14, y + 15, 11, 0xffd24a));
    this.txt(x + w - 14, y + 15, String(c.cost), 15, '#000').setOrigin(0.5);
    this.txt(x + 8, y + 38, c.text, 14, opts.dim ? '#999' : '#dde', { wordWrap: { width: w - 16 } });
    if (opts.onClick) {
      r.setInteractive({ useHandCursor: true });
      r.on('pointerdown', opts.onClick);
    }
    return r;
  }

  deckRow(x, y, w, h, i, id, opts = {}) {
    const c = G.CARDS[id];
    const r = this.rect(x, y, w, h, opts.sel ? 0x4a4630 : COL.panel, opts.sel ? COL.sel : COL.edge);
    this.rect(x, y, 6, h, cardKind(id));
    this.txt(x + 14, y + h / 2, (i + 1) + '.', 15, '#889').setOrigin(0, 0.5);
    this.txt(x + 44, y + h / 2, c.name + '  (' + c.cost + ')', 16, '#fff', { fontStyle: 'bold' }).setOrigin(0, 0.5);
    this.txt(x + 160, y + h / 2, c.text, 13, '#bbc', { wordWrap: { width: w - 168 } }).setOrigin(0, 0.5);
    if (opts.onClick) {
      r.setInteractive({ useHandCursor: true });
      r.on('pointerdown', opts.onClick);
    }
  }

  // ---- arrange: set your queue order before a fight ----
  drawArrange() {
    const s = this.s;
    const def = G.ENEMIES[s.fightIdx];
    this.txt(16, 14, 'Fight ' + (s.fightIdx + 1) + '/' + G.ENEMIES.length + ': ' + def.name + '  (HP ' + def.hp + ')', 22, '#fff', { fontStyle: 'bold' });
    this.txt(16, 44, 'Your HP ' + s.hp + '/' + s.maxHp, 16, '#8f8');
    this.drawEnemyQueue(70, null, def);
    this.txt(16, 148, 'Arrange your queue: tap two cards to swap them.\nTop = drawn first (cards 1-3 are your first hand).', 15, '#dde');
    const top = 196, h = 50;
    s.deck.forEach((id, i) => {
      if (i % 3 === 0 && i > 0) this.rect(16, top + i * (h + 4) - 3, GAME_WIDTH - 32, 1, 0x666a80);
      this.deckRow(16, top + i * (h + 4), GAME_WIDTH - 32, h, i, id, {
        sel: this.pick === i,
        onClick: () => {
          if (this.pick === null) this.pick = i;
          else { G.swapDeck(s, this.pick, i); this.pick = null; }
          this.redraw();
        },
      });
    });
    if (s.retired.length) this.txt(16, 740, 'Retired: ' + s.retired.map((r) => G.CARDS[r].name).join(', '), 13, '#888', { wordWrap: { width: GAME_WIDTH - 32 } });
    this.btn(GAME_WIDTH / 2, 800, 220, 56, 'Fight!', () => { this.pick = null; G.startFight(s); this.redraw(); });
  }

  // ---- fight ----
  drawFight() {
    const s = this.s, f = s.fight, e = f.enemy;
    this.txt(16, 12, 'Fight ' + (s.fightIdx + 1) + '/' + G.ENEMIES.length + '  ·  Turn ' + f.turn, 15, '#aab');
    // enemy
    this.txt(16, 34, e.name, 26, '#fff', { fontStyle: 'bold' });
    this.bar(16, 70, 300, 20, e.hp, e.maxHp, COL.atk);
    let tags = [];
    if (e.block) tags.push('Block ' + e.block);
    if (e.str) tags.push('Str +' + e.str);
    if (e.disarm) tags.push('Disarmed −' + e.disarm);
    this.txt(330, 72, tags.join('  ') || 'no block', 14, '#9cf');
    this.drawEnemyQueue(100, e);
    // preview
    const pv = G.previewEnemy(s);
    let line;
    if (pv.intent.type === 'atk') line = 'End turn now → enemy hits ' + pv.raw + ', your block ' + f.block + ' → you take ' + pv.taken;
    else if (pv.intent.type === 'blk') line = 'End turn now → enemy gains Block ' + pv.intent.n + ' (lasts your next turn)';
    else line = 'End turn now → enemy gains Strength +' + pv.intent.n + ' (all attacks)';
    this.rect(16, 176, GAME_WIDTH - 32, 34, 0x332a2a, pv.taken >= s.hp ? COL.atk : COL.edge);
    this.txt(24, 193, line, 14, pv.taken >= s.hp ? '#f88' : '#fdd').setOrigin(0, 0.5);
    // player
    this.txt(16, 222, 'You', 20, '#fff', { fontStyle: 'bold' });
    this.bar(60, 224, 200, 20, s.hp, s.maxHp, COL.good);
    this.txt(272, 225, 'Block ' + f.block, 16, '#9cf');
    this.txt(368, 225, 'Energy ' + f.energy + '/' + G.ENERGY, 16, '#ffd24a');
    // queue
    this.txt(16, 260, 'Your queue (next draws first; played cards join the back):', 14, '#aab');
    const cw = 86, ch = 40;
    f.queue.forEach((id, i) => {
      const x = 16 + (i % 5) * (cw + 6), y = 282 + Math.floor(i / 5) * (ch + 6);
      const nextHand = i < G.HAND - f.hand.length;
      this.rect(x, y, cw, ch, nextHand ? 0x30344a : COL.panel, nextHand ? 0xaab0ff : COL.edge);
      this.rect(x, y, 5, ch, cardKind(id));
      this.txt(x + 10, y + 4, (i + 1) + '', 11, '#889');
      this.txt(x + cw / 2 + 4, y + ch / 2 + 3, G.CARDS[id].name, 14, '#fff').setOrigin(0.5);
    });
    const nh = f.hand.concat(f.queue).slice(0, G.HAND).map((c) => G.CARDS[c].name).join(', ');
    this.txt(16, 376, 'If you end turn now, next hand: ' + nh, 13, '#aab0ff');
    // hand
    this.txt(16, 404, 'Hand: tap a card to play it', 16, '#fff');
    const n = f.hand.length;
    const hw = n > 3 ? 108 : 144, gap = 8;
    const startX = (GAME_WIDTH - (n * hw + (n - 1) * gap)) / 2;
    f.hand.forEach((id, i) => {
      const ok = G.canPlay(s, i);
      this.drawCard(startX + i * (hw + gap), 432, hw, 150, id, {
        dim: !ok,
        onClick: ok ? () => { G.playCard(s, i); this.redraw(); } : null,
      });
    });
    if (!n) this.txt(GAME_WIDTH / 2, 520, '(hand empty)', 16, '#778').setOrigin(0.5);
    this.txt(16, 600, 'Unplayed cards return to the TOP of your queue.', 13, '#aab');
    this.txt(16, 622, 'Deck order this fight is fixed: plan ahead!', 13, '#aab');
    this.btn(GAME_WIDTH / 2, 720, 240, 64, 'End turn', () => { G.endTurn(s); this.redraw(); }, { color: 0x7a3b3b });
  }

  bar(x, y, w, h, v, max, color) {
    this.rect(x, y, w, h, 0x111111, COL.edge);
    this.rect(x, y, Math.max(0, (w * v) / max), h, color);
    this.txt(x + w / 2, y + h / 2, v + ' / ' + max, 14, '#fff').setOrigin(0.5);
  }

  // ---- reward: add one, retire one ----
  drawReward() {
    const s = this.s;
    const offers = G.REWARDS[s.fightIdx - 1];
    this.txt(16, 14, 'Victory! (+' + G.HEAL_AFTER_FIGHT + ' HP → ' + s.hp + '/' + s.maxHp + ')', 22, '#8f8', { fontStyle: 'bold' });
    this.txt(16, 46, '1) Pick a card to add:', 16, '#fff');
    const w = 108, gap = 8;
    offers.forEach((id, i) => {
      this.drawCard(16 + i * (w + gap), 70, w, 160, id, {
        sel: this.rewardAdd === id,
        onClick: () => { this.rewardAdd = id; this.redraw(); },
      });
    });
    this.txt(16, 244, '2) Pick a card to retire (deck stays 10). The new card\ntakes its place in the queue:', 16, '#fff');
    const top = 290, h = 40;
    s.deck.forEach((id, i) => {
      this.deckRow(16, top + i * (h + 4), GAME_WIDTH - 32, h, i, id, {
        sel: this.rewardRemove === i,
        onClick: () => { this.rewardRemove = i; this.redraw(); },
      });
    });
    const ready = this.rewardAdd !== null && this.rewardRemove !== null;
    const label = ready ? 'Swap ' + G.CARDS[s.deck[this.rewardRemove]].name + ' → ' + G.CARDS[this.rewardAdd].name : 'Pick both';
    this.btn(GAME_WIDTH / 2, 750, 340, 50, label, () => this.finishReward(this.rewardAdd, this.rewardRemove), { enabled: ready, size: 20 });
    this.btn(GAME_WIDTH / 2, 812, 220, 40, 'Skip reward', () => this.finishReward(null, null), { color: 0x444a5a, size: 18 });
  }

  finishReward(add, rem) {
    G.takeReward(this.s, add, rem);
    this.rewardAdd = null;
    this.rewardRemove = null;
    this.redraw();
  }

  drawEnd() {
    const s = this.s, won = s.phase === 'won';
    this.txt(GAME_WIDTH / 2, 220, won ? 'Run complete!' : 'Defeated', 48, won ? '#8f8' : '#f88', { fontStyle: 'bold' }).setOrigin(0.5);
    const sub = won ? 'All ' + G.ENEMIES.length + ' enemies beaten with ' + s.hp + ' HP left.'
      : 'Fell to ' + G.ENEMIES[s.fightIdx].name + ' (fight ' + (s.fightIdx + 1) + '/' + G.ENEMIES.length + ').';
    this.txt(GAME_WIDTH / 2, 290, sub, 18, '#dde').setOrigin(0.5);
    this.txt(GAME_WIDTH / 2, 340, 'Final deck: ' + s.deck.map((d) => G.CARDS[d].name).join(', '), 15, '#aab',
      { wordWrap: { width: 420 }, align: 'center' }).setOrigin(0.5, 0);
    this.btn(GAME_WIDTH / 2, 520, 220, 60, 'Play again', () => this.scene.restart());
    this.btn(GAME_WIDTH / 2, 600, 220, 50, 'Title', () => this.scene.start('TitleScene'), { color: 0x444a5a, size: 20 });
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game',
  backgroundColor: '#15171c',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [TitleScene, GameScene],
});
