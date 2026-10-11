// Gridline GP: pure race rules (no Phaser). Browser: window.Gridline. Node: module.exports.
(function (root) {
  const W = 20;
  const H = 28;
  const LAPS = 2;
  const TYRES_MAX = 16;
  const PIT_TURNS = 3; // the stop itself plus 2 turns sat in the box
  // Start/finish line: between row LINE_Y - 1 (above) and LINE_Y (below), across the
  // left straight (x <= LEFT_X). Cars race clockwise: up the left side, across the top,
  // down the right side and back along the bottom.
  const LINE_Y = 16;
  const LEFT_X = 4;

  // Track layout. '#' track, 'P' pit box (track too), '.' grass.
  const MAP = [
    '....................',
    '.########..#######..',
    '.########..########.',
    '.##################.',
    '.##################.',
    '.####..........####.',
    '.####..........####.',
    '.####..........####.',
    '.####..........####.',
    '.####.......PP.####.',
    '.####.......PP#####.',
    '.####.......PP#####.',
    '.####..........####.',
    '.####.........#####.',
    '.####.........###...',
    '.####.........###...',
    '.####.........#####.',
    '.####..........####.',
    '.####..........####.',
    '.####..........####.',
    '.####..........####.',
    '.####..........####.',
    '.####..........####.',
    '.##################.',
    '.##################.',
    '.#######....#######.',
    '.#######....#######.',
    '....................',
  ];

  const cellAt = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? '.' : MAP[y][x]);
  const onTrack = (x, y) => cellAt(x, y) !== '.';
  const isPit = (x, y) => cellAt(x, y) === 'P';

  // Distance-to-line field (8-connected BFS), with the start/finish line cut so the
  // only way to reach it is the long way round. Cells just below the line have 0.
  const DIST = (() => {
    const d = new Array(W * H).fill(Infinity);
    const q = [];
    for (let x = 0; x <= LEFT_X; x++) if (onTrack(x, LINE_Y)) { d[LINE_Y * W + x] = 0; q.push([x, LINE_Y]); }
    while (q.length) {
      const [x, y] = q.shift();
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (!onTrack(nx, ny)) continue;
        // no stepping across the line
        if (x <= LEFT_X && nx <= LEFT_X && ((y >= LINE_Y) !== (ny >= LINE_Y))) continue;
        const i = ny * W + nx;
        if (d[i] > d[y * W + x] + 1) { d[i] = d[y * W + x] + 1; q.push([nx, ny]); }
      }
    }
    return d;
  })();
  const LAP_LEN = Math.max(...DIST.filter((v) => v !== Infinity)) + 1;
  const dist = (x, y) => DIST[y * W + x];
  // Race progress: higher is further ahead.
  const progress = (car) => car.lap * LAP_LEN + (LAP_LEN - dist(car.x, car.y));

  // Check the straight path of a move. Returns { ok, cross } where cross is +1 when the
  // move crosses the line going up (a lap), and ok is false if it leaves the track or
  // crosses the line backwards.
  function pathCheck(x0, y0, x1, y1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2;
    for (let k = 1; k <= n; k++) {
      const x = Math.round(x0 + ((x1 - x0) * k) / n);
      const y = Math.round(y0 + ((y1 - y0) * k) / n);
      if (!onTrack(x, y)) return { ok: false, cross: 0 };
    }
    let cross = 0;
    if (x0 <= LEFT_X + 1 && x1 <= LEFT_X + 1) {
      if (y0 >= LINE_Y && y1 < LINE_Y) cross = 1;
      else if (y0 < LINE_Y && y1 >= LINE_Y) return { ok: false, cross: 0 };
    }
    return { ok: true, cross };
  }

  // Tyre wear of one acceleration choice: one point per axis changed.
  const wearOf = (ax, ay) => Math.abs(ax) + Math.abs(ay);

  // All 9 options for a car. occupied: Set of "x,y" keys a car can't end on.
  function options(car, occupied) {
    const out = [];
    for (let ay = -1; ay <= 1; ay++) for (let ax = -1; ax <= 1; ax++) {
      const vx = car.vx + ax, vy = car.vy + ay;
      const x = car.x + vx, y = car.y + vy;
      const opt = { ax, ay, vx, vy, x, y, wear: wearOf(ax, ay), ok: true, why: '' };
      if (car.maxSpeed && Math.max(Math.abs(vx), Math.abs(vy)) > car.maxSpeed) { opt.ok = false; opt.why = 'speed cap'; }
      else if (car.tyres !== undefined && car.tyres <= 0 && ax !== 0 && ay !== 0) { opt.ok = false; opt.why = 'worn tyres: one axis only'; }
      else {
        const pc = pathCheck(car.x, car.y, x, y);
        if (!pc.ok) { opt.ok = false; opt.why = 'off track'; }
        else if (occupied && occupied.has(x + ',' + y) && (vx || vy)) { opt.ok = false; opt.why = 'car there'; }
        opt.cross = pc.cross;
      }
      out.push(opt);
    }
    return out;
  }

  // Apply a chosen option to a car (mutates and returns it).
  function applyMove(car, opt) {
    car.trail.push([car.x, car.y]);
    car.x = opt.x; car.y = opt.y; car.vx = opt.vx; car.vy = opt.vy;
    car.lap += opt.cross || 0;
    if (car.tyres !== undefined) car.tyres = Math.max(0, car.tyres - opt.wear);
    if (car.lap >= LAPS && !car.finished) car.finished = true;
    return car;
  }

  // No legal move: the car spins and stops where it is.
  function spin(car) {
    car.vx = 0; car.vy = 0;
    if (car.tyres !== undefined) car.tyres = Math.max(0, car.tyres - 2);
  }

  // AI: depth-limited search for the plan that gains the most progress, ignoring other
  // cars after the first move. Fully deterministic (fixed option order).
  function planAI(car, occupied, depth = 3, tyreWeight = 0) {
    let best = null;
    function rec(c, d, path, firstOcc) {
      const opts = options(c, d === 0 ? firstOcc : null).filter((o) => o.ok);
      if (!opts.length || d === depth) {
        const stuck = !opts.length && d < depth;
        const score = progress(c) - (stuck ? 30 : 0) - 0.01 * (Math.abs(c.vx) + Math.abs(c.vy)) + (c.tyres !== undefined ? tyreWeight * c.tyres : 0);
        if (path.length && (!best || score > best.score)) best = { score, path: path.slice() };
        return;
      }
      for (const o of opts) {
        const n = { ...c, x: o.x, y: o.y, vx: o.vx, vy: o.vy, lap: c.lap + (o.cross || 0) };
        if (n.tyres !== undefined) n.tyres = Math.max(0, n.tyres - o.wear);
        if (n.lap >= LAPS) {
          // finishing sooner is always better
          const score = 1e6 - d * 1000 - path.length;
          if (!best || score > best.score) best = { score, path: [...path, o] };
          continue;
        }
        path.push(o);
        rec(n, d + 1, path, firstOcc);
        path.pop();
      }
    }
    rec({ x: car.x, y: car.y, vx: car.vx, vy: car.vy, lap: car.lap, maxSpeed: car.maxSpeed, tyres: car.tyres }, 0, [], occupied);
    return best ? best.path : [];
  }

  function newRace() {
    const mk = (id, name, x, y, color, extra) =>
      Object.assign({ id, name, x, y, vx: 0, vy: 0, lap: 0, tyres: TYRES_MAX, finished: false, trail: [], color, pit: 0 }, extra);
    const cars = [
      mk('you', 'You', 3, 14, 0xffd23f, { player: true }),
      mk('red', 'Rosso', 1, 12, 0xe8483b, { depth: 3, maxSpeed: 0 }),
      mk('blue', 'Azure', 3, 12, 0x3b8fe8, { depth: 3, maxSpeed: 3 }),
      mk('green', 'Verde', 1, 14, 0x42c95a, { depth: 2, maxSpeed: 3 }),
    ];
    const race = { cars, turn: 0, order: [], over: false };
    replanAll(race);
    return race;
  }

  const key = (c) => c.x + ',' + c.y;
  function occupiedBy(race, except) {
    return new Set(race.cars.filter((c) => c !== except && !c.finished).map(key)); // finished cars leave the track
  }

  // Rivals plan in move order, each treating the rivals before it as already standing on
  // their next square, so a telegraphed move only changes if the player gets in the way.
  function replanAll(race) {
    const occ = new Set(race.cars.filter((c) => !c.finished).map(key));
    for (const c of race.cars) {
      if (c.player || c.finished) { c.plan = []; continue; }
      occ.delete(key(c));
      c.plan = c.finished ? [] : planAI(c, occ, c.depth);
      const next = c.plan[0];
      occ.add(next ? next.x + ',' + next.y : key(c));
    }
  }

  // Player chooses an option (or null to spin / sit in the pit). Then every rival moves.
  // Returns a list of event strings.
  function playTurn(race, opt) {
    const ev = [];
    const you = race.cars.find((c) => c.player);
    race.turn++;
    if (you.pit > 0) {
      you.pit--;
      ev.push(you.pit ? `Pit crew working: ${you.pit} more turn${you.pit > 1 ? 's' : ''}.` : 'Out of the pits next turn.');
    } else if (!you.finished) {
      if (opt) applyMove(you, opt);
      else { spin(you); ev.push('You spin out and stop.'); }
      if (you.finished) finish(race, you, ev);
      else if (isPit(you.x, you.y)) {
        you.pit = PIT_TURNS - 1;
        you.vx = 0; you.vy = 0;
        you.tyres = TYRES_MAX;
        ev.push('Pit stop! Fresh tyres. You sit out 2 turns.');
      }
    }
    for (const c of race.cars) {
      if (c.player || c.finished) continue;
      const occ = occupiedBy(race, c);
      let step = c.plan && c.plan[0];
      if (step) {
        // re-validate the telegraphed move: it may now be blocked
        const fresh = options(c, occ).find((o) => o.ax === step.ax && o.ay === step.ay);
        if (!fresh || !fresh.ok) {
          const alt = planAI(c, occ, c.depth);
          step = alt[0];
          ev.push(`${c.name} is blocked and changes line.`);
        } else step = fresh;
      }
      if (step) applyMove(c, step);
      else { spin(c); ev.push(`${c.name} spins out.`); }
      if (c.finished) finish(race, c, ev);
    }
    replanAll(race);
    if (you.finished) race.over = true;
    return ev;
  }

  function finish(race, car, ev) {
    race.order.push(car.id);
    ev.push(`${car.player ? 'You take' : car.name + ' takes'} the flag in P${race.order.length}!`);
  }

  // Current standings, best first.
  function standings(race) {
    return race.cars.slice().sort((a, b) => {
      const fa = race.order.indexOf(a.id), fb = race.order.indexOf(b.id);
      if (fa >= 0 || fb >= 0) return (fa < 0 ? 99 : fa) - (fb < 0 ? 99 : fb);
      return progress(b) - progress(a);
    });
  }

  const api = {
    W, H, LAPS, TYRES_MAX, PIT_TURNS, LINE_Y, LEFT_X, MAP, LAP_LEN,
    cellAt, onTrack, isPit, dist, progress, pathCheck, wearOf, options, applyMove, spin, planAI,
    newRace, occupiedBy, playTurn, standings,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Gridline = api;
})(typeof window !== 'undefined' ? window : globalThis);
