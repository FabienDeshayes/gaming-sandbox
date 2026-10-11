// Root & Rot: pure, deterministic garden simulation (no Phaser). Works in the browser
// (window.RootRot) and in Node (module.exports) so levels can be checked by a script.
(function (root) {
  const W = 8;
  const H = 8;
  // Cell codes
  const SOIL = 0, STONE = 1, MOSS = 2, FERN = 3, BRAMBLE = 4, ROT_NEW = 5, ROT_OLD = 6;
  const SPECIES = ['moss', 'fern', 'bramble'];
  const NAMES = ['Moss', 'Fern', 'Bramble'];
  // Each species spreads in a fixed shape every turn.
  const SHAPES = [
    [[1, 0], [-1, 0], [0, 1], [0, -1]], // moss: the 4 orthogonal neighbours
    [[1, 1], [1, -1], [-1, 1], [-1, -1]], // fern: the 4 diagonal neighbours
    [[2, 0], [-2, 0], [0, 2], [0, -2]], // bramble: jumps 2 cells straight
  ];
  // Rock-paper-scissors: species s beats species (s + 1) % 3.
  // Moss beats Fern, Fern beats Bramble, Bramble beats Moss.
  const beats = (a, b) => (a + 1) % 3 === b;

  const isPlant = (c) => c >= MOSS && c <= BRAMBLE;

  function step(g) {
    const n = Int8Array.from(g);
    const claims = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) {
      const c = g[i];
      if (!isPlant(c)) continue;
      const sp = c - MOSS;
      const x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of SHAPES[sp]) {
        const x2 = x + dx, y2 = y + dy;
        if (x2 < 0 || y2 < 0 || x2 >= W || y2 >= H) continue;
        const j = y2 * W + x2;
        const t = g[j];
        if (t === SOIL || (isPlant(t) && beats(sp, t - MOSS))) claims[j] |= 1 << sp;
      }
    }
    for (let j = 0; j < W * H; j++) {
      const m = claims[j];
      if (!m) continue;
      if (g[j] === SOIL) {
        const list = [0, 1, 2].filter((s) => m & (1 << s));
        if (list.length === 1) n[j] = MOSS + list[0];
        else if (list.length === 2) n[j] = MOSS + (beats(list[0], list[1]) ? list[0] : list[1]);
        // all three species at once: they cancel, soil stays empty
      } else {
        n[j] = ROT_NEW; // a plant beaten by a neighbour dies and becomes rot
      }
    }
    for (let i = 0; i < W * H; i++) {
      if (g[i] === ROT_OLD) n[i] = SOIL; // rot lasts 2 turns, then leaves clear soil
      else if (g[i] === ROT_NEW) {
        n[i] = ROT_OLD;
        const x = i % W, y = (i / W) | 0;
        for (const [dx, dy] of SHAPES[0]) {
          const x2 = x + dx, y2 = y + dy;
          if (x2 < 0 || y2 < 0 || x2 >= W || y2 >= H) continue;
          const j = y2 * W + x2;
          if (g[j] === STONE) n[j] = ROT_NEW; // fresh rot eats into adjacent stone
        }
      }
    }
    return n;
  }

  function parseLevel(lv) {
    const g = new Int8Array(W * H);
    const targets = [];
    const map = { '.': SOIL, '#': STONE, m: MOSS, f: FERN, b: BRAMBLE };
    const tmap = { M: MOSS, F: FERN, B: BRAMBLE, o: SOIL };
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        g[y * W + x] = map[lv.map[y][x]];
        const t = lv.targets[y][x];
        if (t in tmap) targets.push({ x, y, want: tmap[t] });
      }
    }
    return { grid: g, targets };
  }

  // seeds: [{x, y, sp}] (sp = 0..2). Returns states for turns 0..turns.
  function simulate(grid, seeds, turns) {
    let g = Int8Array.from(grid);
    for (const s of seeds) g[s.y * W + s.x] = MOSS + s.sp;
    const states = [g];
    for (let t = 0; t < turns; t++) {
      g = step(g);
      states.push(g);
    }
    return states;
  }

  function checkTargets(g, targets) {
    return targets.map((t) => g[t.y * W + t.x] === t.want);
  }

  // map: . soil, # stone, m/f/b wild plants. targets: M/F/B species wanted at season end,
  // o = must be bare soil, - = no requirement. seeds: species indexes the player may plant.
  const LEVELS = [
    {
      name: 'First Sprout',
      hint: 'Moss spreads to its 4 side neighbours every turn. Ringed cells show what must be there when the season ends.',
      turns: 3,
      seeds: [0],
      map: ['........', '........', '...#....', '........', '........', '.....#..', '........', '........'],
      targets: ['---o-M--', '--------', '--------', '--------', '---M----', '--------', '--------', '--------'],
    },
    {
      name: 'Two Shapes',
      hint: 'Fern spreads diagonally, so it only ever reaches half the squares. Moss beats Fern where they meet.',
      turns: 3,
      seeds: [0, 1],
      map: ['........', '..#.....', '........', '.....#..', '........', '.#......', '........', '....#...'],
      targets: ['------o-', '-----F--', '----F---', '------M-', 'F-------', '--M-----', '--------', '--------'],
    },
    {
      name: 'Thorns',
      hint: 'Wild Bramble jumps 2 squares and beats Moss. Fern beats Bramble. A beaten plant turns to rot.',
      turns: 4,
      seeds: [0, 1],
      map: ['........', '.....#..', '........', '...b....', '........', '..b.....', '........', '........'],
      targets: ['--------', '--------', '--------', '---F----', '----M---', '--------', '--------', '-------M'],
    },
    {
      name: 'The Wall',
      hint: 'Fresh rot eats into stone next to it, and rot clears to bare soil after 2 turns. Get Moss past the wall.',
      turns: 8,
      seeds: [0, 1],
      map: ['........', '........', '########', '...f....', '........', '........', '........', '........'],
      targets: ['--------', '---M----', '--------', '--------', '--------', '-----M--', '-------o', '-----M--'],
    },
    {
      name: 'Full Bloom',
      hint: 'All three seeds. Use the turn slider to check every step before you commit.',
      turns: 5,
      seeds: [0, 1, 2],
      map: ['m......#', '........', '..#..b..', '........', '...#....', '.f......', '........', '#......m'],
      targets: ['--------', 'B--F----', '--------', '---M----', '--Mo----', '-------M', '------F-', '--------'],
    },
  ];

  const api = {
    W, H, SOIL, STONE, MOSS, FERN, BRAMBLE, ROT_NEW, ROT_OLD,
    SPECIES, NAMES, SHAPES, beats, isPlant, step, parseLevel, simulate, checkTargets, LEVELS,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RootRot = api;
})(typeof window !== 'undefined' ? window : globalThis);
