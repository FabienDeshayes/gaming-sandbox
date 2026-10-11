// Lantern Hours: pure game rules (no Phaser). Loaded as a plain script in the
// browser (defines window.LH) and require()-able from node for tests.
(function (root) {
  // Legend: # wall, . floor, D creaky door, S start, X exit, L loot
  const MAP = [
    '##########',
    '#L..#...L#',
    '#...D....#',
    '#...#....#',
    '##D###.###',
    '#........#',
    '#........#',
    '###.##D###',
    '#....#...#',
    '#..L.D...#',
    '#S...#..X#',
    '##########',
  ];

  // Patrol loops as corner waypoints; expanded to one tile per step.
  const GUARDS = [
    { name: 'Hall', waypoints: [[1, 5], [8, 5], [8, 6], [1, 6]] },
    { name: 'Study', waypoints: [[5, 1], [7, 1], [7, 3], [5, 3]] },
    { name: 'Cellar', waypoints: [[6, 8], [8, 8], [8, 9], [6, 9]] },
  ];

  const VISION = 4; // tiles ahead
  const DIST_TURNS = 2; // turns a guard stays turned toward a noise
  const NOISE = { door: 3, loot: 2, pebble: 3 };
  const PEBBLE_RANGE = 4;
  const TOOLS = { pebble: 2, oil: 1 };
  const DIRS = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };

  function expand(wps) {
    const path = [];
    for (let i = 0; i < wps.length; i++) {
      const [ax, ay] = wps[i];
      const [bx, by] = wps[(i + 1) % wps.length];
      const dx = Math.sign(bx - ax), dy = Math.sign(by - ay);
      let x = ax, y = ay;
      while (x !== bx || y !== by) { path.push([x, y]); x += dx; y += dy; }
    }
    return path;
  }

  function tileAt(s, x, y) {
    if (y < 0 || y >= MAP.length || x < 0 || x >= MAP[0].length) return '#';
    return MAP[y][x];
  }
  const isWall = (s, x, y) => tileAt(s, x, y) === '#';
  const isDoor = (s, x, y) => tileAt(s, x, y) === 'D';
  const key = (x, y) => x + ',' + y;
  const manhattan = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);

  function dirToward(fx, fy, tx, ty) {
    const dx = tx - fx, dy = ty - fy;
    if (dx === 0 && dy === 0) return null;
    if (Math.abs(dx) >= Math.abs(dy)) return [Math.sign(dx), 0];
    return [0, Math.sign(dy)];
  }

  function newGame() {
    const s = {
      w: MAP[0].length, h: MAP.length,
      player: null, exit: null, loot: [], carried: 0,
      tools: Object.assign({}, TOOLS), oiled: {},
      turn: 0, heavyCount: 0, status: 'play', log: [],
      guards: GUARDS.map((g) => ({ name: g.name, path: expand(g.waypoints), i: 0, distracted: 0, face: null })),
    };
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
      const c = MAP[y][x];
      if (c === 'S') s.player = [x, y];
      if (c === 'X') s.exit = [x, y];
      if (c === 'L') s.loot.push([x, y]);
    }
    s.guards.forEach((g) => { g.face = patrolFacing(g); });
    return s;
  }

  function clone(s) { return JSON.parse(JSON.stringify(s)); }

  function guardPos(g) { return g.path[g.i]; }
  function patrolFacing(g) {
    const [x, y] = g.path[g.i];
    const [nx, ny] = g.path[(g.i + 1) % g.path.length];
    return [nx - x, ny - y];
  }

  // Tiles a guard can currently see: a short cone along its facing that
  // stops at walls and doors (the door tile itself is visible).
  function visionTiles(s, g) {
    const [gx, gy] = guardPos(g);
    const [fx, fy] = g.face;
    const px = -fy, py = fx; // perpendicular
    const out = [];
    const lanesOpen = { '-1': true, '0': true, '1': true };
    for (let d = 1; d <= VISION; d++) {
      for (const o of [0, -1, 1]) {
        if (o !== 0 && d < 2) continue;
        if (!lanesOpen[o]) continue;
        const x = gx + fx * d + px * o, y = gy + fy * d + py * o;
        if (isWall(s, x, y)) { lanesOpen[o] = false; continue; }
        out.push([x, y]);
        if (isDoor(s, x, y)) lanesOpen[o] = false;
      }
      if (!lanesOpen[0]) { lanesOpen[-1] = false; lanesOpen[1] = false; }
    }
    return out;
  }

  function seenBy(s) {
    const [px, py] = s.player;
    for (const g of s.guards) {
      const [gx, gy] = guardPos(g);
      if (gx === px && gy === py) return g;
      if (visionTiles(s, g).some(([x, y]) => x === px && y === py)) return g;
    }
    return null;
  }

  // Which guards a noise at (x,y) with radius r would turn.
  function noiseHits(s, x, y, r) {
    return s.guards.filter((g) => { const [gx, gy] = guardPos(g); return manhattan(gx, gy, x, y) <= r; });
  }

  function makeNoise(s, x, y, r, what) {
    const hit = noiseHits(s, x, y, r);
    for (const g of hit) {
      const [gx, gy] = guardPos(g);
      const d = dirToward(gx, gy, x, y);
      if (d) g.face = d;
      g.distracted = DIST_TURNS;
    }
    s.log.push(what + ' (noise ' + r + ')' + (hit.length ? ': ' + hit.map((g) => g.name).join(', ') + ' turn' + (hit.length > 1 ? '' : 's') : ''));
    return hit;
  }

  function stepGuards(s) {
    for (const g of s.guards) {
      if (g.distracted > 0) {
        g.distracted--;
        if (g.distracted === 0) g.face = patrolFacing(g);
        continue;
      }
      g.i = (g.i + 1) % g.path.length;
      g.face = patrolFacing(g);
    }
  }

  // How many guard steps the next move costs (loot is heavy).
  function heavyEvery(s) { return s.carried > 0 ? Math.max(2, 5 - s.carried) : 0; }
  function nextMoveIsHeavy(s) {
    const every = heavyEvery(s);
    return every > 0 && (s.heavyCount + 1) % every === 0;
  }

  function checkCaught(s) {
    if (s.status !== 'play') return;
    const g = seenBy(s);
    if (g) { s.status = 'lost'; s.log.push('Spotted by ' + g.name + '!'); }
  }

  // Run the world after the player's action: noise already applied.
  function endTurn(s, guardSteps) {
    checkCaught(s);
    for (let k = 0; k < guardSteps && s.status === 'play'; k++) {
      stepGuards(s);
      checkCaught(s);
    }
    s.turn++;
  }

  function canMoveTo(s, x, y) {
    const [px, py] = s.player;
    return s.status === 'play' && manhattan(px, py, x, y) === 1 && !isWall(s, x, y);
  }

  function isExit(s, x, y) { return s.exit[0] === x && s.exit[1] === y; }

  // Actions return a new state (input untouched) or null if illegal.
  function move(s0, x, y) {
    if (!canMoveTo(s0, x, y)) return null;
    const s = clone(s0);
    const heavy = nextMoveIsHeavy(s);
    if (s.carried > 0) s.heavyCount++;
    s.player = [x, y];
    if (isDoor(s, x, y) && !s.oiled[key(x, y)]) makeNoise(s, x, y, NOISE.door, 'Door creaks');
    const li = s.loot.findIndex(([lx, ly]) => lx === x && ly === y);
    if (li >= 0) { s.loot.splice(li, 1); s.carried++; makeNoise(s, x, y, NOISE.loot, 'Grabbed loot'); }
    if (isExit(s, x, y)) {
      checkCaught(s);
      if (s.status === 'play') {
        if (s.carried > 0) { s.status = 'won'; s.log.push('Escaped with ' + s.carried + ' loot.'); }
        else s.log.push('Nothing stolen yet. The exit can wait.');
      }
      if (s.status !== 'play') { s.turn++; return s; }
    }
    endTurn(s, heavy ? 2 : 1);
    return s;
  }

  function wait(s0) {
    if (s0.status !== 'play') return null;
    const s = clone(s0);
    s.log.push('Wait');
    endTurn(s, 1);
    return s;
  }

  function canThrow(s, x, y) {
    const [px, py] = s.player;
    return s.status === 'play' && s.tools.pebble > 0 && !isWall(s, x, y) && manhattan(px, py, x, y) <= PEBBLE_RANGE && manhattan(px, py, x, y) > 0;
  }
  function throwPebble(s0, x, y) {
    if (!canThrow(s0, x, y)) return null;
    const s = clone(s0);
    s.tools.pebble--;
    makeNoise(s, x, y, NOISE.pebble, 'Pebble');
    endTurn(s, 1);
    return s;
  }

  function canOil(s, x, y) {
    const [px, py] = s.player;
    return s.status === 'play' && s.tools.oil > 0 && isDoor(s, x, y) && !s.oiled[key(x, y)] && manhattan(px, py, x, y) <= 1;
  }
  function oilDoor(s0, x, y) {
    if (!canOil(s0, x, y)) return null;
    const s = clone(s0);
    s.tools.oil--;
    s.oiled[key(x, y)] = true;
    s.log.push('Oiled a door: it is silent now');
    endTurn(s, 1);
    return s;
  }

  // Guard's next n positions if left alone (for drawing intentions).
  function guardPlan(g, n) {
    const out = [];
    let i = g.i, wait = g.distracted;
    for (let k = 0; k < n; k++) {
      if (wait > 0) { wait--; out.push(g.path[i]); continue; }
      i = (i + 1) % g.path.length;
      out.push(g.path[i]);
    }
    return out;
  }

  const api = {
    MAP, VISION, NOISE, PEBBLE_RANGE, DIRS, newGame, clone, tileAt, isWall, isDoor, isExit, key,
    guardPos, visionTiles, seenBy, noiseHits, heavyEvery, nextMoveIsHeavy, guardPlan,
    canMoveTo, move, wait, canThrow, throwPebble, canOil, oilDoor, manhattan,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LH = api;
})(typeof window !== 'undefined' ? window : this);
