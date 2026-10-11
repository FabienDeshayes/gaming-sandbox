// Open Hand: pure game rules (no Phaser). Loaded in the browser as a plain
// script (defines window.OpenHand) and in node via require().
(function () {
  const ENERGY = 3;
  const HAND = 3;
  const DECK_SIZE = 10;
  const HEAL_AFTER_FIGHT = 10;

  // The 15-card pool. Effects mutate the fight state `f`.
  const CARDS = {
    strike:   { name: 'Strike',   cost: 1, text: 'Deal 6.', play: (f) => hit(f, 6) },
    guard:    { name: 'Guard',    cost: 1, text: 'Block 5.', play: (f) => { f.block += 5; } },
    jab:      { name: 'Jab',      cost: 0, text: 'Deal 3.', play: (f) => hit(f, 3) },
    heavy:    { name: 'Heavy',    cost: 2, text: 'Deal 13.', play: (f) => hit(f, 13) },
    wall:     { name: 'Wall',     cost: 2, text: 'Block 12.', play: (f) => { f.block += 12; } },
    riposte:  { name: 'Riposte',  cost: 1, text: 'Block 4, deal 4.', play: (f) => { f.block += 4; hit(f, 4); } },
    pierce:   { name: 'Pierce',   cost: 1, text: 'Deal 7, ignores block.', play: (f) => hit(f, 7, true) },
    mend:     { name: 'Mend',     cost: 1, text: 'Heal 5.', play: (f, s) => { s.hp = Math.min(s.maxHp, s.hp + 5); } },
    momentum: { name: 'Momentum', cost: 1, text: 'Deal 4 per card played before it this turn.', play: (f) => hit(f, 4 * f.playedThisTurn) },
    swap:     { name: 'Swap',     cost: 0, text: 'Swap the top 2 cards of your queue.', play: (f) => { if (f.queue.length >= 2) [f.queue[0], f.queue[1]] = [f.queue[1], f.queue[0]]; } },
    skip:     { name: 'Skip',     cost: 0, text: 'Move the top card of your queue to the bottom.', play: (f) => { if (f.queue.length) f.queue.push(f.queue.shift()); } },
    dig:      { name: 'Dig',      cost: 0, text: 'Take the top card of your queue into your hand.', play: (f) => { if (f.queue.length) f.hand.push(f.queue.shift()); } },
    echo:     { name: 'Echo',     cost: 1, text: 'Copy: play the top queue card\'s effect for free (it stays put).', play: (f, s) => { const t = f.queue[0]; if (t && t !== 'echo') CARDS[t].play(f, s); } },
    feint:    { name: 'Feint',    cost: 1, text: 'Enemy\'s next intent goes to the bottom of its queue.', play: (f) => { const q = f.enemy.queue; if (q.length > 1) q.push(q.shift()); } },
    disarm:   { name: 'Disarm',   cost: 1, text: 'Enemy\'s next attack deals 6 less.', play: (f) => { f.enemy.disarm += 6; } },
  };

  const START_DECK = ['strike', 'guard', 'strike', 'guard', 'jab', 'strike', 'guard', 'skip', 'strike', 'guard'];

  // Fixed, public run: each fight's enemy and the rewards offered after it.
  const ENEMIES = [
    { name: 'Rat Swarm', hp: 20, queue: [['atk', 5], ['atk', 5], ['atk', 7]] },
    { name: 'Bandit', hp: 32, queue: [['atk', 9], ['blk', 6], ['atk', 4], ['atk', 4]] },
    { name: 'Golem', hp: 44, queue: [['blk', 12], ['atk', 15], ['buff', 2], ['atk', 7]] },
    { name: 'Warden', hp: 60, queue: [['atk', 7], ['blk', 8], ['atk', 18], ['buff', 3], ['atk', 7]] },
  ];
  const REWARDS = [
    ['heavy', 'riposte', 'swap', 'mend'],
    ['echo', 'pierce', 'wall', 'dig'],
    ['momentum', 'feint', 'disarm', 'heavy'],
  ];

  function hit(f, n, ignoreBlock) {
    const e = f.enemy;
    let dmg = n;
    if (!ignoreBlock) {
      const absorbed = Math.min(e.block, dmg);
      e.block -= absorbed;
      dmg -= absorbed;
    }
    e.hp = Math.max(0, e.hp - dmg);
  }

  function newRun() {
    return { hp: 40, maxHp: 40, deck: START_DECK.slice(), retired: [], fightIdx: 0, fight: null, phase: 'arrange' };
  }

  function startFight(s) {
    const def = ENEMIES[s.fightIdx];
    s.fight = {
      enemy: { name: def.name, hp: def.hp, maxHp: def.hp, block: 0, str: 0, disarm: 0, queue: def.queue.map((i) => ({ type: i[0], n: i[1] })) },
      queue: s.deck.slice(), hand: [], energy: 0, block: 0, playedThisTurn: 0, turn: 0,
    };
    s.phase = 'fight';
    startTurn(s);
  }

  function startTurn(s) {
    const f = s.fight;
    f.turn += 1;
    f.block = 0;
    f.energy = ENERGY;
    f.playedThisTurn = 0;
    f.hand = f.queue.splice(0, HAND);
  }

  function canPlay(s, i) {
    const f = s.fight;
    return s.phase === 'fight' && i >= 0 && i < f.hand.length && CARDS[f.hand[i]].cost <= f.energy;
  }

  function playCard(s, i) {
    if (!canPlay(s, i)) return false;
    const f = s.fight;
    const id = f.hand.splice(i, 1)[0];
    f.energy -= CARDS[id].cost;
    CARDS[id].play(f, s);
    f.queue.push(id); // played cards go to the bottom
    f.playedThisTurn += 1;
    if (f.enemy.hp <= 0) winFight(s);
    return true;
  }

  // What the enemy's next intent will do to you right now (with your current block).
  function previewEnemy(s) {
    const f = s.fight;
    const it = f.enemy.queue[0];
    if (it.type !== 'atk') return { intent: it, raw: 0, taken: 0 };
    const raw = Math.max(0, it.n + f.enemy.str - f.enemy.disarm);
    return { intent: it, raw, taken: Math.max(0, raw - f.block) };
  }

  function endTurn(s) {
    if (s.phase !== 'fight') return;
    const f = s.fight;
    f.queue.unshift(...f.hand); // unplayed cards stay on top, in order
    f.hand = [];
    const e = f.enemy;
    const p = previewEnemy(s);
    const it = e.queue.shift();
    e.queue.push(it);
    e.block = 0;
    if (it.type === 'atk') { s.hp = Math.max(0, s.hp - p.taken); e.disarm = 0; }
    else if (it.type === 'blk') e.block = it.n;
    else if (it.type === 'buff') e.str += it.n;
    if (s.hp <= 0) { s.phase = 'lost'; return; }
    startTurn(s);
  }

  function winFight(s) {
    s.hp = Math.min(s.maxHp, s.hp + HEAL_AFTER_FIGHT);
    s.fightIdx += 1;
    s.phase = s.fightIdx >= ENEMIES.length ? 'won' : 'reward';
  }

  // Add one, remove one: deck stays at DECK_SIZE. Pass null to skip.
  function takeReward(s, addId, removeIdx) {
    if (s.phase !== 'reward') return;
    if (addId != null && removeIdx != null) {
      const old = s.deck[removeIdx];
      s.retired.push(old);
      s.deck[removeIdx] = addId; // new card takes the removed card's slot
    }
    s.phase = 'arrange';
  }

  function swapDeck(s, a, b) {
    [s.deck[a], s.deck[b]] = [s.deck[b], s.deck[a]];
  }

  function intentText(it, str) {
    if (it.type === 'atk') return 'Attack ' + (it.n + (str || 0));
    if (it.type === 'blk') return 'Block ' + it.n;
    return 'Str +' + it.n;
  }

  const api = { CARDS, ENEMIES, REWARDS, START_DECK, ENERGY, HAND, DECK_SIZE, HEAL_AFTER_FIGHT,
    newRun, startFight, canPlay, playCard, endTurn, previewEnemy, takeReward, swapDeck, intentText };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.OpenHand = api;
})();
