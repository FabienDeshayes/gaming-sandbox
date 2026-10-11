// Caravan Ledger: pure game rules (no Phaser). Loaded in the browser as a plain
// script (defines window.Caravan) and in node via require().
(function () {
  const SEASON_DAYS = 60;
  const CART_SLOTS = 6;
  const FOOD_PRICE = 2; // gold per day of food, any town
  const SPREAD = 2; // sell price = buy price - SPREAD
  const START_GOLD = 60;
  const START_FOOD = 6;
  const TARGET = 500;

  const GOODS = [
    { id: 'grain', name: 'Grain', cap: 16, color: 0xe0c060 },
    { id: 'salt', name: 'Salt', cap: 20, color: 0xd8e4ee },
    { id: 'wine', name: 'Wine', cap: 30, color: 0xb04a6a },
    { id: 'cloth', name: 'Cloth', cap: 26, color: 0x5a8fd0 },
  ];

  // normal: the supply each good drifts back to (1 per day).
  const TOWNS = [
    { id: 'A', name: 'Ashford', x: 100, y: 100, normal: { grain: 12, salt: 6, wine: 10, cloth: 7 } },
    { id: 'B', name: 'Brinemouth', x: 380, y: 100, normal: { grain: 5, salt: 15, wine: 9, cloth: 11 } },
    { id: 'C', name: 'Corvale', x: 100, y: 260, normal: { grain: 9, salt: 9, wine: 22, cloth: 6 } },
    { id: 'D', name: 'Dunmere', x: 380, y: 260, normal: { grain: 4, salt: 11, wine: 13, cloth: 19 } },
  ];

  // Travel days between towns (symmetric).
  const ROADS = { AB: 3, AC: 2, AD: 5, BC: 4, BD: 2, CD: 3 };

  // Published calendar: during [from, to] the town pays double for the good.
  const EVENTS = [
    { from: 8, to: 12, town: 'B', good: 'grain', name: 'Harvest Fair' },
    { from: 15, to: 19, town: 'A', good: 'wine', name: 'Wedding Season' },
    { from: 24, to: 28, town: 'D', good: 'salt', name: 'Salt Curing' },
    { from: 33, to: 37, town: 'C', good: 'cloth', name: 'Winter Market' },
    { from: 42, to: 46, town: 'B', good: 'wine', name: 'Sea Festival' },
    { from: 52, to: 56, town: 'A', good: 'cloth', name: 'Lord\'s Fair' },
  ];

  function days(a, b) {
    if (a === b) return 0;
    return ROADS[[a, b].sort().join('')];
  }
  function good(id) { return GOODS.find((g) => g.id === id); }
  function town(id) { return TOWNS.find((t) => t.id === id); }

  function newGame() {
    const supply = {};
    TOWNS.forEach((t) => { supply[t.id] = Object.assign({}, t.normal); });
    const cart = {};
    GOODS.forEach((g) => { cart[g.id] = 0; });
    return { day: 1, gold: START_GOLD, food: START_FOOD, at: 'A', supply, cart, over: false, log: [] };
  }

  function eventAt(townId, goodId, day) {
    return EVENTS.find((e) => e.town === townId && e.good === goodId && day >= e.from && day <= e.to) || null;
  }

  // Price formulas (also shown to the player verbatim).
  function buyPrice(supply, goodId) { return Math.max(1, good(goodId).cap - supply); }
  function sellPrice(supply, goodId, townId, day) {
    const base = Math.max(0, buyPrice(supply, goodId) - SPREAD);
    return eventAt(townId, goodId, day) ? base * 2 : base;
  }

  function cartCount(s) { return GOODS.reduce((n, g) => n + s.cart[g.id], 0); }

  function canBuy(s, g) {
    const sup = s.supply[s.at][g];
    return !s.over && cartCount(s) < CART_SLOTS && sup > 0 && s.gold >= buyPrice(sup, g);
  }
  function buy(s, g) {
    if (!canBuy(s, g)) return false;
    s.gold -= buyPrice(s.supply[s.at][g], g);
    s.supply[s.at][g] -= 1;
    s.cart[g] += 1;
    return true;
  }
  function canSell(s, g) { return !s.over && s.cart[g] > 0; }
  function sell(s, g) {
    if (!canSell(s, g)) return false;
    s.gold += sellPrice(s.supply[s.at][g], g, s.at, s.day);
    s.supply[s.at][g] += 1;
    s.cart[g] -= 1;
    return true;
  }
  function canBuyFood(s) { return !s.over && s.gold >= FOOD_PRICE; }
  function buyFood(s) { if (!canBuyFood(s)) return false; s.gold -= FOOD_PRICE; s.food += 1; return true; }

  // Supply drifts back toward normal by 1 per day.
  function drift(supply) {
    TOWNS.forEach((t) => GOODS.forEach((g) => {
      const v = supply[t.id][g.id], n = t.normal[g.id];
      supply[t.id][g.id] = v < n ? v + 1 : v > n ? v - 1 : v;
    }));
  }

  function passDay(s) { s.day += 1; s.food -= 1; drift(s.supply); }

  function canTravel(s, to) {
    const d = days(s.at, to);
    return !s.over && to !== s.at && s.food >= d && s.day + d <= SEASON_DAYS;
  }
  function travel(s, to) {
    if (!canTravel(s, to)) return false;
    const d = days(s.at, to);
    for (let i = 0; i < d; i++) passDay(s);
    s.at = to;
    return true;
  }
  function canWait(s) { return !s.over && s.food >= 1 && s.day < SEASON_DAYS; }
  function wait(s) { if (!canWait(s)) return false; passDay(s); return true; }

  function endSeason(s) { s.over = true; s.won = s.gold >= TARGET; }

  // Projected supply in a town after `d` more days of drift (no other trades).
  function projectSupply(s, townId, d) {
    const out = {};
    const t = town(townId);
    GOODS.forEach((g) => {
      const v = s.supply[townId][g.id], n = t.normal[g.id];
      out[g.id] = v < n ? Math.min(n, v + d) : Math.max(n, v - d);
    });
    return out;
  }

  const api = { SEASON_DAYS, CART_SLOTS, FOOD_PRICE, SPREAD, START_GOLD, START_FOOD, TARGET, GOODS, TOWNS, ROADS, EVENTS,
    days, good, town, newGame, eventAt, buyPrice, sellPrice, cartCount, canBuy, buy, canSell, sell, canBuyFood, buyFood,
    canTravel, travel, canWait, wait, endSeason, projectSupply };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.Caravan = api;
})();
