// Pure, deterministic game logic for Slingshot Orrery (no Phaser).
// Loaded as a plain script in the browser (globals) and via require() in node.
(function (root) {
  const N = 17; // grid is N x N squares
  const SUN = { x: 8, y: 8 };
  const PREVIEW_TURNS = 8;

  // Burns: coast plus the four orthogonal nudges.
  const ACTIONS = {
    coast: { x: 0, y: 0 },
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  // Cell i (any integer) on the square ring of radius r around (0,0), clockwise from top-left.
  function ringOffset(r, i) {
    if (r === 0) return { x: 0, y: 0 };
    const len = 8 * r;
    let k = ((i % len) + len) % len;
    const side = 2 * r;
    if (k < side) return { x: -r + k, y: -r };
    k -= side;
    if (k < side) return { x: r, y: -r + k };
    k -= side;
    if (k < side) return { x: r - k, y: r };
    k -= side;
    return { x: -r, y: r - k };
  }

  // Positions of all bodies at turn t. Bodies orbit the sun or another body (listed earlier).
  function bodiesAt(mission, t) {
    const out = [{ id: 'sun', kind: 'sun', name: 'Sun', x: SUN.x, y: SUN.y }];
    const byId = { sun: out[0] };
    for (const b of mission.bodies) {
      const c = byId[b.around || 'sun'];
      const o = ringOffset(b.r, b.phase + b.dir * t);
      const pos = { id: b.id, kind: b.kind, name: b.name, x: c.x + o.x, y: c.y + o.y };
      byId[b.id] = pos;
      out.push(pos);
    }
    return out;
  }

  function initialState(mission) {
    return {
      x: mission.start.x, y: mission.start.y,
      vx: mission.start.vx, vy: mission.start.vy,
      fuel: mission.fuel, t: 0, status: 'flying', note: '',
    };
  }

  const sign = (n) => (n > 0 ? 1 : n < 0 ? -1 : 0);

  // One turn: burn (optional), move by velocity, bodies step, then check crash / arrival /
  // gravity from bodies now adjacent (8-neighbourhood). Planets and the sun pull 1, moons push 1.
  function step(mission, s, action) {
    const burn = ACTIONS[action] || ACTIONS.coast;
    const n = { ...s, pulls: [] };
    if (s.status !== 'flying') return n;
    const burning = burn.x !== 0 || burn.y !== 0;
    if (burning) {
      if (s.fuel <= 0) return n; // illegal; caller should prevent
      n.fuel = s.fuel - 1;
    }
    n.vx = s.vx + burn.x;
    n.vy = s.vy + burn.y;
    n.x = s.x + n.vx;
    n.y = s.y + n.vy;
    n.t = s.t + 1;
    const bodies = bodiesAt(mission, n.t);
    if (n.x < 0 || n.y < 0 || n.x >= N || n.y >= N) {
      n.status = 'lost'; n.note = 'Drifted off the chart.'; return n;
    }
    const hit = bodies.find((b) => b.x === n.x && b.y === n.y);
    if (hit) { n.status = 'crashed'; n.note = 'Crashed into ' + hit.name + '.'; return n; }
    if (n.x === mission.target.x && n.y === mission.target.y) {
      n.status = 'won'; n.note = 'Probe docked at the beacon.'; return n;
    }
    for (const b of bodies) {
      const dx = b.x - n.x, dy = b.y - n.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) === 1) {
        const k = b.kind === 'moon' ? -1 : 1;
        const p = { x: k * sign(dx), y: k * sign(dy), by: b.name };
        n.vx += p.x; n.vy += p.y;
        n.pulls.push(p);
      }
    }
    if (n.t >= mission.turns) { n.status = 'timeout'; n.note = 'Out of time: the window closed.'; }
    return n;
  }

  // Path if the player does `action` now and then coasts.
  function predict(mission, s, action, turns) {
    const path = [];
    let cur = step(mission, s, action);
    path.push(cur);
    for (let i = 1; i < (turns || PREVIEW_TURNS) && cur.status === 'flying'; i++) {
      cur = step(mission, cur, 'coast');
      path.push(cur);
    }
    return path;
  }

  // Minimum fuel needed to win within the turn limit, spending at most maxFuel.
  // Returns {fuel, actions} or null. Used by tests and for designing missions.
  function solve(mission, maxFuel) {
    const cap = maxFuel == null ? mission.fuel : maxFuel;
    let frontier = [{ s: { ...initialState(mission), fuel: cap }, acts: [] }];
    const seen = new Map();
    let best = null;
    while (frontier.length) {
      const next = [];
      for (const { s, acts } of frontier) {
        for (const a of Object.keys(ACTIONS)) {
          if (a !== 'coast' && s.fuel <= 0) continue;
          const n = step(mission, s, a);
          if (n.status === 'won') {
            if (!best || n.fuel > best.s.fuel) best = { s: n, acts: acts.concat(a) };
            continue;
          }
          if (n.status !== 'flying') continue;
          const k = n.t + ',' + n.x + ',' + n.y + ',' + n.vx + ',' + n.vy;
          if (seen.has(k) && seen.get(k) >= n.fuel) continue;
          seen.set(k, n.fuel);
          next.push({ s: n, acts: acts.concat(a) });
        }
      }
      frontier = next;
    }
    return best && { fuel: cap - best.s.fuel, actions: best.acts };
  }

  const api = { N, SUN, ACTIONS, PREVIEW_TURNS, ringOffset, bodiesAt, initialState, step, predict, solve };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Orrery = api;
})(this);
