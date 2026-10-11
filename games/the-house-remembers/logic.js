// Pure game rules for The House Remembers. No Phaser here, so it can be tested in Node.

export const ROOMS = [
  { name: 'Nursery', col: 0, row: 0 },
  { name: 'Study', col: 1, row: 0 },
  { name: 'Library', col: 2, row: 0 },
  { name: 'Bedroom', col: 0, row: 1 },
  { name: 'Hall', col: 1, row: 1 },
  { name: 'Parlor', col: 2, row: 1 },
  { name: 'Kitchen', col: 0, row: 2 },
  { name: 'Foyer', col: 1, row: 2 },
];

export const DOORS = [[1, 2], [0, 3], [1, 4], [2, 5], [3, 4], [4, 5], [3, 6], [4, 7], [6, 7]];
export const CLOCK_ROOM = 1; // the grandfather clock always ticks (sound 1)
export const EXIT_ROOM = 7;
export const CANDLE_TURNS = 5;
export const KEYS_NEEDED = 3;

export const NOISE = { wait: 0, light: 0, escape: 0, move: 1, doll: 1, searchLit: 1, searchDark: 2 };

export const NIGHTS = [
  {
    player: 7, ghost: 2, keys: [0, 5, 6], doll: 3, candles: 3, litSound: false,
    rule: 'The ghost walks toward the loudest sound. The Study clock always ticks (1).',
  },
  {
    player: 7, ghost: 0, keys: [2, 1, 6], doll: 5, candles: 3, litSound: true,
    rule: 'New tonight: a burning candle crackles. Every lit room makes sound 1.',
  },
  {
    player: 7, ghost: 4, keys: [0, 2, 5], doll: 6, candles: 2, litSound: true,
    rule: 'The ghost waits in the Hall, next to you. Only 2 candles. Stay quiet.',
  },
];

export function neighbours(room) {
  const out = [];
  for (const [a, b] of DOORS) {
    if (a === room) out.push(b);
    else if (b === room) out.push(a);
  }
  return out.sort((x, y) => x - y);
}

export function newNight(index) {
  const n = NIGHTS[index];
  return {
    night: index,
    turn: 0,
    player: n.player,
    ghost: n.ghost,
    keys: n.keys.slice(), // rooms still holding a key
    keysHeld: 0,
    doll: n.doll, // room index, or -1 when carried
    candles: n.candles,
    lit: new Array(ROOMS.length).fill(0), // turns of light left per room
    searched: new Array(ROOMS.length).fill(false),
    litSound: n.litSound,
    lastSeen: { room: n.ghost, turn: 0 },
    status: 'playing', // playing | caught | escaped
    log: [],
  };
}

export function clone(s) {
  return {
    ...s,
    keys: s.keys.slice(),
    lit: s.lit.slice(),
    searched: s.searched.slice(),
    lastSeen: { ...s.lastSeen },
    log: s.log.slice(),
  };
}

export function isLit(s, room) {
  return s.lit[room] > 0;
}

export function ghostVisible(s) {
  return isLit(s, s.ghost) || s.ghost === s.player;
}

// Every legal action for the current state, each with its noise level.
export function legalActions(s) {
  if (s.status !== 'playing') return [];
  const acts = [{ type: 'wait', noise: NOISE.wait }];
  for (const r of neighbours(s.player)) acts.push({ type: 'move', to: r, noise: NOISE.move });
  acts.push({ type: 'search', noise: isLit(s, s.player) ? NOISE.searchLit : NOISE.searchDark });
  if (s.candles > 0 && !isLit(s, s.player)) acts.push({ type: 'light', noise: NOISE.light });
  if (s.doll === s.player) acts.push({ type: 'take', noise: NOISE.doll });
  if (s.doll === -1) acts.push({ type: 'drop', noise: NOISE.doll });
  if (s.player === EXIT_ROOM && s.keysHeld >= KEYS_NEEDED) acts.push({ type: 'escape', noise: NOISE.escape });
  return acts;
}

// Sound sources this turn: { room: volume }. Player noise is added on top of fixed sources.
export function soundMap(s, playerRoom, playerNoise) {
  const vol = new Array(ROOMS.length).fill(0);
  vol[CLOCK_ROOM] = Math.max(vol[CLOCK_ROOM], 1);
  if (s.litSound) for (let r = 0; r < ROOMS.length; r++) if (s.lit[r] > 0) vol[r] = Math.max(vol[r], 1);
  if (playerNoise > 0) vol[playerRoom] = Math.max(vol[playerRoom], playerNoise);
  return vol;
}

function blocked(s, room) {
  return s.doll === room; // a resting doll keeps the ghost out
}

// BFS distances from `from` through rooms the ghost may enter.
function distances(s, from) {
  const dist = new Array(ROOMS.length).fill(Infinity);
  dist[from] = 0;
  const q = [from];
  while (q.length) {
    const r = q.shift();
    for (const n of neighbours(r)) {
      if (dist[n] !== Infinity || blocked(s, n)) continue;
      dist[n] = dist[r] + 1;
      q.push(n);
    }
  }
  return dist;
}

// Where the ghost heads and where it ends up after one step, given a sound map.
export function ghostStep(s, vol) {
  const max = Math.max(...vol);
  const fromGhost = distances(s, s.ghost);
  let target = -1;
  for (let r = 0; r < ROOMS.length; r++) {
    if (vol[r] !== max || fromGhost[r] === Infinity) continue;
    if (target === -1 || fromGhost[r] < fromGhost[target]) target = r;
  }
  if (target === -1 || target === s.ghost) return { target, next: s.ghost };
  const toTarget = distances(s, target);
  let next = s.ghost;
  for (const n of neighbours(s.ghost)) {
    if (blocked(s, n)) continue;
    if (toTarget[n] === fromGhost[target] - 1) { next = n; break; }
  }
  return { target, next };
}

// Apply one player action and the ghost's response. Returns a new state.
export function step(prev, action) {
  const s = clone(prev);
  s.turn += 1;
  let noise = 0;
  const here = () => ROOMS[s.player].name;
  switch (action.type) {
    case 'wait':
      s.log.push('You hold your breath.');
      break;
    case 'move':
      s.player = action.to;
      noise = NOISE.move;
      s.log.push(`You creep into the ${here()}.`);
      break;
    case 'search': {
      noise = isLit(s, s.player) ? NOISE.searchLit : NOISE.searchDark;
      const k = s.keys.indexOf(s.player);
      if (k >= 0) {
        s.keys.splice(k, 1);
        s.keysHeld += 1;
        s.log.push(`You find a key in the ${here()}! (${s.keysHeld}/${KEYS_NEEDED})`);
      } else s.log.push(`Nothing in the ${here()}.`);
      s.searched[s.player] = true;
      break;
    }
    case 'light':
      s.candles -= 1;
      s.lit[s.player] = CANDLE_TURNS;
      s.log.push(`You light a candle in the ${here()}.`);
      break;
    case 'take':
      s.doll = -1;
      noise = NOISE.doll;
      s.log.push('You pick up the porcelain doll.');
      break;
    case 'drop':
      s.doll = s.player;
      noise = NOISE.doll;
      s.log.push(`You set the doll down in the ${here()}.`);
      break;
    case 'escape':
      s.status = 'escaped';
      s.log.push('The front door unlocks. You slip out into the dawn.');
      return s;
    default:
      throw new Error('unknown action ' + action.type);
  }
  if (s.player === s.ghost) {
    s.status = 'caught';
    s.log.push('Something cold is waiting in the dark...');
    return s;
  }
  const { next } = ghostStep(s, soundMap(s, s.player, noise));
  s.ghost = next;
  if (s.ghost === s.player) {
    s.status = 'caught';
    s.log.push('The ghost finds you.');
    return s;
  }
  for (let r = 0; r < s.lit.length; r++) if (s.lit[r] > 0) s.lit[r] -= 1;
  if (ghostVisible(s)) s.lastSeen = { room: s.ghost, turn: s.turn };
  return s;
}

// What the ghost would do for a given action, used by the UI for previews.
export function previewGhost(s, action) {
  if (action.type === 'escape') return null;
  const room = action.type === 'move' ? action.to : s.player;
  const fake = clone(s);
  if (action.type === 'take') fake.doll = -1;
  if (action.type === 'drop') fake.doll = s.player;
  return ghostStep(fake, soundMap(fake, room, action.noise));
}
