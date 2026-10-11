const GAME_WIDTH = 480;
const GAME_HEIGHT = 854;
const C = window.Caravan;

const FONT = 'sans-serif';
const COL = { panel: 0x2a2620, edge: 0x6a5f4a, road: 0x8a7a5a, town: 0x4a3f2e, here: 0xf0c050, sel: 0x70c0ff, dim: 0x3a3833 };

function button(scene, x, y, w, h, label, onClick, opts = {}) {
  const enabled = opts.enabled !== false;
  const r = scene.add.rectangle(x, y, w, h, enabled ? (opts.color || 0x5a6e3a) : COL.dim)
    .setStrokeStyle(2, 0xffffff, enabled ? 0.5 : 0.15);
  const t = scene.add.text(x, y, label, { fontFamily: FONT, fontSize: (opts.size || 18) + 'px', color: enabled ? '#fff' : '#777' }).setOrigin(0.5);
  if (enabled) {
    r.setInteractive({ useHandCursor: true });
    r.on('pointerdown', onClick);
  }
  return [r, t];
}

class TitleScene extends Phaser.Scene {
  constructor() { super('TitleScene'); }

  create() {
    const cx = GAME_WIDTH / 2;
    this.add.text(cx, 140, 'Caravan Ledger', { fontFamily: FONT, fontSize: '48px', color: '#f0d8a0' }).setOrigin(0.5);
    this.add.text(cx, 190, 'a trading season with nothing hidden', { fontFamily: FONT, fontSize: '18px', color: '#aa9' }).setOrigin(0.5);
    const help = [
      'How to play',
      '',
      '• Buy low, carry, sell high. The cart holds 6 goods.',
      '• Price = cap − supply. You sell for price − ' + C.SPREAD + '.',
      '• Each unit you buy lowers supply (price +1); each',
      '  unit you sell raises it (price −1).',
      '• Supply drifts back to normal by 1 per day.',
      '• Every day eats 1 food (' + C.FOOD_PRICE + ' gold each, any town).',
      '• Festivals on the calendar pay ×2 for one good.',
      '• Tap a town to preview its prices on arrival.',
      '• Start: ' + C.START_GOLD + ' gold. Have ' + C.TARGET + ' gold by day ' + C.SEASON_DAYS + '.',
    ];
    this.add.text(36, 250, help.join('\n'), { fontFamily: FONT, fontSize: '17px', color: '#e8e0d0', lineSpacing: 6 });
    button(this, cx, 680, 220, 64, 'Play', () => this.scene.start('GameScene'), { size: 28 });
  }
}

class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  create() {
    this.s = C.newGame();
    this.dest = null; // town being previewed
    this.confirmEnd = false; // End season needs two taps
    this.objs = [];
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
  act(fn) {
    return () => { const was = this.confirmEnd; fn(); if (was) this.confirmEnd = false; this.redraw(); };
  }

  redraw() {
    this.objs.forEach((o) => o.destroy());
    this.objs = [];
    const s = this.s;
    if (s.over) return this.drawEnd();
    this.drawHeader();
    this.drawMap();
    this.drawTravelBar();
    this.drawMarket();
    this.drawCart();
    this.drawCalendar();
  }

  drawHeader() {
    const s = this.s;
    this.rect(0, 0, GAME_WIDTH, 34, 0x1c1a16);
    this.txt(12, 8, 'Day ' + s.day + '/' + C.SEASON_DAYS, 17, '#fff', { fontStyle: 'bold' });
    this.txt(120, 8, 'Gold ' + s.gold + ' / ' + C.TARGET, 17, s.gold >= C.TARGET ? '#8f8' : '#f0d060');
    this.txt(290, 8, 'Food ' + s.food, 17, s.food === 0 ? '#f88' : '#cfa');
    this.txt(372, 10, '(' + C.FOOD_PRICE + 'g/day)', 13, '#998');
  }

  drawMap() {
    const s = this.s;
    const g = this.track(this.add.graphics());
    g.lineStyle(3, COL.road, 1);
    Object.entries(C.ROADS).forEach(([k, d]) => {
      const a = C.town(k[0]), b = C.town(k[1]);
      const hl = (a.id === s.at && b.id === this.dest) || (b.id === s.at && a.id === this.dest);
      g.lineStyle(hl ? 5 : 3, hl ? COL.sel : COL.road, 1);
      g.lineBetween(a.x, a.y - 20, b.x, b.y - 20);
      // label offset a bit so the crossing diagonals don't overlap
      const t = a.id + b.id === 'AD' ? 0.35 : a.id + b.id === 'BC' ? 0.65 : 0.5;
      const mx = a.x + (b.x - a.x) * t, my = a.y - 20 + (b.y - a.y) * t;
      this.track(this.add.circle(mx, my, 13, 0x1c1a16).setStrokeStyle(2, hl ? COL.sel : COL.road));
      this.txt(mx, my, d + 'd', 13, '#fff').setOrigin(0.5);
    });
    C.TOWNS.forEach((t) => {
      const here = t.id === s.at, sel = t.id === this.dest;
      const r = this.track(this.add.rectangle(t.x, t.y - 20, 120, 44, here ? 0x6a5420 : COL.town)
        .setStrokeStyle(3, here ? COL.here : sel ? COL.sel : COL.edge));
      this.txt(t.x, t.y - 28, t.name, 16, '#fff', { fontStyle: 'bold' }).setOrigin(0.5);
      const sub = here ? '● you are here' : C.days(s.at, t.id) + ' days away';
      this.txt(t.x, t.y - 9, sub, 12, here ? '#fd8' : '#cbb').setOrigin(0.5);
      r.setInteractive({ useHandCursor: true });
      r.on('pointerdown', this.act(() => { this.dest = here || sel ? null : t.id; }));
    });
    this.txt(GAME_WIDTH / 2, 274, 'Tap a town to preview its prices on arrival', 12, '#998').setOrigin(0.5);
  }

  drawTravelBar() {
    const s = this.s;
    this.rect(8, 284, GAME_WIDTH - 16, 46, COL.panel, COL.edge);
    if (!this.dest) {
      const label = s.day >= C.SEASON_DAYS ? 'Last day: sell up, then end the season.' : 'In ' + C.town(s.at).name + '. Trade, or pick a destination.';
      this.txt(18, 307, label, 15, '#e8e0d0').setOrigin(0, 0.5);
      return;
    }
    const d = C.days(s.at, this.dest), arrive = s.day + d;
    let why = '';
    if (arrive > C.SEASON_DAYS) why = ' (past season end)';
    else if (s.food < d) why = ' (need ' + (d - s.food) + ' more food)';
    this.txt(18, 297, 'To ' + C.town(this.dest).name + ': ' + d + ' days, arrive day ' + arrive, 15, '#bfe0ff');
    this.txt(18, 314, 'eats ' + d + ' food' + why, 13, why ? '#f99' : '#ccb');
    this.btn(410, 307, 120, 36, 'Travel', this.act(() => { if (C.travel(s, this.dest)) this.dest = null; }), { enabled: C.canTravel(s, this.dest), color: 0x2f6a8a });
  }

  drawMarket() {
    const s = this.s, at = s.at, top = 340;
    const dest = this.dest, d = dest ? C.days(at, dest) : 0;
    const proj = dest ? C.projectSupply(s, dest, d) : null;
    this.txt(12, top, 'Market: ' + C.town(at).name, 16, '#fff', { fontStyle: 'bold' });
    this.txt(12, top + 22, 'buy = cap − supply · sell = buy − ' + C.SPREAD + ' (×2 on festival) · normal = drift target', 11, '#aa9');
    const hy = top + 42;
    this.txt(12, hy, 'Good', 12, '#998');
    this.txt(150, hy, 'Buy', 12, '#998');
    this.txt(196, hy, 'Sell', 12, '#998');
    if (dest) this.txt(374, hy, C.town(dest).name.slice(0, 5) + '. day ' + (s.day + d), 12, '#8cf');
    C.GOODS.forEach((g, i) => {
      const y = hy + 18 + i * 50;
      const sup = s.supply[at][g.id];
      const bp = C.buyPrice(sup, g.id), sp = C.sellPrice(sup, g.id, at, s.day);
      const ev = C.eventAt(at, g.id, s.day);
      this.rect(8, y, GAME_WIDTH - 16, 46, COL.panel, ev ? 0xf0a040 : COL.edge);
      this.rect(8, y, 6, 46, g.color);
      this.txt(20, y + 5, g.name + (s.cart[g.id] ? '  ×' + s.cart[g.id] : ''), 16, '#fff', { fontStyle: 'bold' });
      const norm = C.town(at).normal[g.id];
      this.txt(20, y + 27, g.cap + '−' + sup + ' (normal ' + norm + ')', 12, '#bba');
      this.txt(150, y + 12, String(bp), 18, sup > 0 ? '#f0d060' : '#777');
      this.txt(196, y + 12, String(sp) + (ev ? '!' : ''), 18, ev ? '#ffb050' : '#9f9');
      this.btn(268, y + 23, 56, 36, 'Buy', this.act(() => C.buy(s, g.id)), { enabled: C.canBuy(s, g.id), size: 15 });
      this.btn(330, y + 23, 56, 36, 'Sell', this.act(() => C.sell(s, g.id)), { enabled: C.canSell(s, g.id), color: 0x8a5a2a, size: 15 });
      if (dest) {
        const ps = proj[g.id];
        const dsp = C.sellPrice(ps, g.id, dest, s.day + d);
        const dev = C.eventAt(dest, g.id, s.day + d);
        this.txt(374, y + 5, 'buy ' + C.buyPrice(ps, g.id), 13, '#8cf');
        this.txt(374, y + 24, 'sell ' + dsp + (dev ? ' ×2' : ''), 13, dev ? '#ffb050' : '#8cf');
      }
    });
  }

  drawCart() {
    const s = this.s, y = 604;
    this.txt(12, y, 'Cart ' + C.cartCount(s) + '/' + C.CART_SLOTS, 14, '#fff');
    const items = [];
    C.GOODS.forEach((g) => { for (let i = 0; i < s.cart[g.id]; i++) items.push(g); });
    for (let i = 0; i < C.CART_SLOTS; i++) {
      const x = 84 + i * 30;
      const g = items[i];
      this.rect(x, y - 2, 26, 22, g ? g.color : 0x1c1a16, COL.edge);
      if (g) this.txt(x + 13, y + 9, g.name[0], 13, '#000').setOrigin(0.5);
    }
    this.btn(360, y + 9, 140, 28, 'Food +1 (' + C.FOOD_PRICE + 'g)', this.act(() => C.buyFood(s)), { enabled: C.canBuyFood(s), size: 14, color: 0x4a6a3a });
    const y2 = 642;
    this.btn(120, y2, 200, 34, 'Wait 1 day', this.act(() => { C.wait(s); }), { enabled: C.canWait(s), size: 16, color: 0x5a5040 });
    this.btn(350, y2, 200, 34, this.confirmEnd ? 'Tap again to end' : 'End season', this.act(() => {
      if (this.confirmEnd) C.endSeason(s); else this.confirmEnd = true;
    }), { size: 16, color: 0x7a3b3b });
  }

  drawCalendar() {
    const s = this.s, top = 664;
    this.txt(12, top, 'Calendar (published): festival town pays ×2 sell price', 13, '#f0c070');
    C.EVENTS.forEach((e, i) => {
      const y = top + 20 + i * 27;
      const active = s.day >= e.from && s.day <= e.to, past = s.day > e.to;
      this.rect(8, y, GAME_WIDTH - 16, 25, active ? 0x5a4020 : 0x221f1a, active ? 0xf0a040 : 0x3a352c);
      const when = active ? 'NOW' : past ? 'over' : 'in ' + (e.from - s.day) + 'd';
      const col = past ? '#666' : '#eee';
      this.txt(16, y + 5, 'Day ' + e.from + '–' + e.to, 13, col);
      this.txt(100, y + 5, C.town(e.town).name + ' · ' + e.name, 13, col);
      this.txt(320, y + 5, C.good(e.good).name + ' ×2', 13, past ? '#666' : '#ffb050');
      this.txt(468, y + 5, when, 13, active ? '#ffb050' : col).setOrigin(1, 0);
    });
  }

  drawEnd() {
    const s = this.s;
    const cargo = C.cartCount(s);
    this.txt(GAME_WIDTH / 2, 220, s.won ? 'A fine season!' : 'Season over', 44, s.won ? '#8f8' : '#f99', { fontStyle: 'bold' }).setOrigin(0.5);
    this.txt(GAME_WIDTH / 2, 290, 'Gold: ' + s.gold + ' (goal ' + C.TARGET + ')', 22, '#f0d060').setOrigin(0.5);
    this.txt(GAME_WIDTH / 2, 330, s.won ? 'You met the goal by day ' + s.day + '.' : 'You fell ' + (C.TARGET - s.gold) + ' gold short.', 17, '#ddd').setOrigin(0.5);
    if (cargo) this.txt(GAME_WIDTH / 2, 360, '(' + cargo + ' unsold goods left in the cart count for nothing)', 14, '#aa9').setOrigin(0.5);
    this.btn(GAME_WIDTH / 2, 480, 220, 60, 'New season', () => this.scene.restart(), { size: 24 });
    this.btn(GAME_WIDTH / 2, 560, 220, 48, 'Title', () => this.scene.start('TitleScene'), { color: 0x5a5040 });
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game',
  backgroundColor: '#14120f',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [TitleScene, GameScene],
});
