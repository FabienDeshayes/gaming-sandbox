// Turning a heap of campaigns into something you can read.
//
// Two kinds of number come out of this, and they answer different questions.
// The **averages** say how hard the game is: how many steps a colour costs, how
// often a walk ends in the dark. The **spreads** — the standard deviation and
// the coefficient of variation next to each one — say how much that answer
// depends on which world you were handed, which is the question the two
// placement roses actually differ on.

export function stats(values) {
  const real = values.filter((v) => v !== null && v !== undefined && Number.isFinite(v));
  if (!real.length) return null;
  const sorted = [...real].sort((a, b) => a - b);
  const mean = real.reduce((a, b) => a + b, 0) / real.length;
  const sd = Math.sqrt(real.reduce((a, b) => a + (b - mean) ** 2, 0) / real.length);
  return {
    n: real.length,
    mean,
    sd,
    cv: mean ? sd / mean : 0,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    median: sorted[Math.floor(sorted.length / 2)],
  };
}

// Every campaign walked under one rose in one style, as one row.
export function aggregate(records) {
  const pick = (fn) => stats(records.map(fn));
  return {
    campaigns: records.length,
    steps: pick((r) => r.steps),
    expeditions: pick((r) => r.expeditions),
    deaths: pick((r) => r.deaths),
    stranded: pick((r) => r.stranded),
    gems: pick((r) => r.gemsSeen),
    explored: pick((r) => r.explored),
    furthest: pick((r) => r.furthest),
    cycles: pick((r) => r.cycles),
    // The three colours and the hall, in campaign steps — the numbers the two
    // roses are compared on. `n` says how many campaigns got that far at all,
    // which is half the answer whenever it is not all of them.
    toGem1: pick((r) => r.toGem[0]),
    toGem2: pick((r) => r.toGem[1]),
    toGem3: pick((r) => r.toGem[2]),
    toHall: pick((r) => r.toHall),
    reachedHall: records.filter((r) => r.toHall !== null).length,
    completed: records.filter((r) => r.completed).length,
    // How dangerous the walking was, rather than how much of it there was.
    deathsPerK: pick((r) => (r.steps ? (r.deaths * 1000) / r.steps : null)),
  };
}

// --- Printing -------------------------------------------------------------------

function pad(text, width, left = false) {
  const value = String(text);
  return left ? value.padEnd(width) : value.padStart(width);
}

export function table(columns, rows) {
  const widths = columns.map((c, i) =>
    Math.max(c.head.length, ...rows.map((r) => String(r[i] === null || r[i] === undefined ? '-' : r[i]).length))
  );
  const line = (cells) =>
    cells.map((cell, i) => pad(cell === null || cell === undefined ? '-' : cell, widths[i], columns[i].left)).join('  ');
  const out = [line(columns.map((c) => c.head)), widths.map((w) => '-'.repeat(w)).join('  ')];
  for (const row of rows) out.push(line(row));
  return out.join('\n');
}

export function num(value, places = 0) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return value.toFixed(places);
}

// A stat as "mean ±sd", which is the shape every comparison here is read in.
export function spread(s, places = 0) {
  if (!s) return '-';
  return `${num(s.mean, places)} ±${num(s.sd, places)}`;
}

// And as a percentage, for the coefficient of variation — the spread relative
// to the size of the thing, so a ring of 20 and a ring of 110 are comparable.
export function percent(value, places = 0) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return `${(value * 100).toFixed(places)}%`;
}

// How much one rose moved a number against another, as a signed percentage.
export function delta(before, after, places = 0) {
  if (!before || !after || !before.mean) return '-';
  const change = (after.mean - before.mean) / before.mean;
  return `${change >= 0 ? '+' : ''}${(change * 100).toFixed(places)}%`;
}
