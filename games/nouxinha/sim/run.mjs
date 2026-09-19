// The comparison tool. Three things it will do:
//
//   node sim/run.mjs play       one placement rose, the three styles, side by side
//   node sim/run.mjs compare    two or more roses, the same campaigns walked in each
//   node sim/run.mjs geometry   what the roses place, with nobody playing
//
// Flags (all optional):
//
//   --seeds=N         how many campaigns per cell (default 8)
//   --expeditions=N   the cap on walks per campaign (default 60)
//   --steps=N         the cap on steps per campaign (default 60000)
//   --style=id        one of conservative | normal | eager, or all (default all)
//   --roses=a,b,...   `metric` or `metric:scale` — e.g. manhattan,chebyshev,chebyshev:0.8
//   --base=N          the number every campaign seed is derived from, for a re-run
//
// A rose written `manhattan:1.25` is the diamond with every plan distance in
// balance.js multiplied by 1.25. That is how the two are compared at a walk of
// the same length rather than at a plan of the same number: the diamond puts a
// thing at ring 110 exactly 110 steps away, where the square puts it anywhere
// from 110 to 160, so the same numbers are not the same world.


import { resetStorage, restoreRandom, seedRandom } from './env.mjs';
import { setRingMetric } from '../src/core/world.js';
import { EDGE_RADIUS, RING_METRIC } from '../src/balance.js';
import { playCampaign } from './autoplay.mjs';
import { STYLES, STYLE_IDS } from './styles.mjs';
import { aggregate, delta, num, percent, spread, table } from './report.mjs';
import { summarise, survey } from './geometry.mjs';

function flags(argv) {
  const out = {};
  for (const arg of argv) {
    const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
    out[key] = value;
  }
  return out;
}

// A campaign's seed. Spread out with a cheap hash so consecutive runs are not
// consecutive worlds, and derived from `base` so a surprising result can be
// walked again.
function seedFor(base, index) {
  let h = (base + index * 0x9e3779b9) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) | 0;
}

// `metric`, or `metric:scale`.
function parseRose(text) {
  const [metric, scale] = text.split(':');
  const stretched = scale && Number(scale) !== 1;
  return {
    metric,
    scale: scale ? Number(scale) : 1,
    label: stretched ? `${metric} ×${scale}` : metric,
  };
}

// Every campaign of one rose in one style. The bot's own rolls are seeded off
// the campaign index alone, so the same campaign starts from the same decisions
// under every rose it is walked in.
// Progress goes to stderr, so the tables on stdout stay pipeable. A sweep is
// tens of thousands of steps a campaign and can run for the better part of an
// hour; a tool that prints nothing until it is finished is a tool nobody can
// tell has hung.
function note(text) {
  process.stderr.write(`${text}\n`);
}

function walk(rose, style, opts) {
  setRingMetric(rose.metric, rose.scale);
  const records = [];
  const started = Date.now();
  for (let i = 0; i < opts.seeds; i++) {
    resetStorage();
    const roll = seedRandom(opts.base + i);
    const record = playCampaign({
      seed: seedFor(opts.base, i),
      style,
      roll,
      maxExpeditions: opts.expeditions,
      stepBudget: opts.steps,
    });
    records.push(record);
    note(
      `  ${rose.label} / ${style.id} ${i + 1}/${opts.seeds}: ` +
        `${record.steps} steps, ${record.gemsSeen} gems, ${record.deaths} deaths` +
        `${record.completed ? ', finished' : ''} — ${((Date.now() - started) / 1000).toFixed(0)}s`
    );
  }
  restoreRandom();
  return records;
}

const COLUMNS = [
  { head: 'style', left: true },
  { head: 'steps' },
  { head: 'walks' },
  { head: 'deaths' },
  { head: 'stuck' },
  { head: 'gems' },
  { head: 'to gem 1' },
  { head: 'to gem 2' },
  { head: 'to gem 3' },
  { head: 'to hall' },
  { head: 'hall' },
  { head: 'end' },
  { head: 'lit' },
];

function summaryRow(label, s) {
  return [
    label,
    num(s.steps.mean),
    num(s.expeditions.mean, 1),
    num(s.deaths.mean, 1),
    num(s.stranded.mean, 1),
    num(s.gems.mean, 2),
    s.toGem1 ? `${num(s.toGem1.mean)}/${s.toGem1.n}` : '-',
    s.toGem2 ? `${num(s.toGem2.mean)}/${s.toGem2.n}` : '-',
    s.toGem3 ? `${num(s.toGem3.mean)}/${s.toGem3.n}` : '-',
    s.toHall ? num(s.toHall.mean) : '-',
    `${s.reachedHall}/${s.campaigns}`,
    `${s.completed}/${s.campaigns}`,
    num(s.explored.mean),
  ];
}

function play(opts, roses) {
  for (const rose of roses) {
    console.log(`\n=== ${rose.label} — ${opts.seeds} campaigns, up to ${opts.expeditions} walks each ===\n`);
    const rows = [];
    for (const id of opts.styles) rows.push(summaryRow(id, aggregate(walk(rose, STYLES[id], opts))));
    console.log(table(COLUMNS, rows));
  }
  console.log(
    '\n"to gem N" is campaign steps when that colour was first banked, over how many campaigns got there.\n' +
      '"hall" and "end" are campaigns that reached a hall at all, and that finished the game.'
  );
}

function compare(opts, roses) {
  const results = new Map();
  for (const rose of roses)
    for (const id of opts.styles) results.set(`${rose.label}|${id}`, aggregate(walk(rose, STYLES[id], opts)));

  console.log(`\n=== ${opts.seeds} campaigns per cell, up to ${opts.expeditions} walks each ===\n`);
  const rows = [];
  for (const id of opts.styles) {
    for (const rose of roses) rows.push(summaryRow(`${id} / ${rose.label}`, results.get(`${rose.label}|${id}`)));
    rows.push(COLUMNS.map(() => ''));
  }
  console.log(table(COLUMNS, rows.slice(0, -1)));

  // And the part the whole exercise is about: how much the answer moved, and
  // how much of the spread went with it.
  const base = roses[0];
  console.log(`\n=== against ${base.label} ===\n`);
  const deltas = [];
  for (const id of opts.styles)
    for (const rose of roses.slice(1)) {
      const a = results.get(`${base.label}|${id}`);
      const b = results.get(`${rose.label}|${id}`);
      deltas.push([
        `${id} / ${rose.label}`,
        delta(a.steps, b.steps),
        delta(a.deaths, b.deaths),
        delta(a.toGem1, b.toGem1),
        delta(a.toGem2, b.toGem2),
        delta(a.toGem3, b.toGem3),
        `${percent(a.toGem3 ? a.toGem3.cv : null)} → ${percent(b.toGem3 ? b.toGem3.cv : null)}`,
        `${a.reachedHall} → ${b.reachedHall}`,
        `${a.completed} → ${b.completed}`,
      ]);
    }
  console.log(
    table(
      [
        { head: 'style / rose', left: true },
        { head: 'steps' },
        { head: 'deaths' },
        { head: 'gem 1' },
        { head: 'gem 2' },
        { head: 'gem 3' },
        { head: 'spread of gem 3' },
        { head: 'reached hall' },
        { head: 'finished' },
      ],
      deltas
    )
  );
}

function geometry(opts, roses) {
  for (const rose of roses) {
    setRingMetric(rose.metric, rose.scale);
    const surveys = [];
    for (let i = 0; i < opts.seeds; i++) surveys.push(survey(seedFor(opts.base, i)));
    const sum = summarise(surveys);
    console.log(`\n=== ${rose.label} — ${opts.seeds} worlds ===\n`);
    console.log(
      table(
        [
          { head: 'thing', left: true },
          { head: 'ring' },
          { head: 'straight line' },
          { head: 'placed' },
          { head: 'walk' },
          { head: 'walked' },
          { head: 'typical' },
          { head: 'worst' },
          { head: 'walk / ring' },
          { head: 'ground tax' },
        ],
        sum.entries.map((e) => [
          `${e.kind} ${e.id}`,
          e.ring === null ? '-' : num(e.ring),
          spread(e.flight),
          percent(e.flight ? e.flight.cv : null, 1),
          spread(e.walk),
          percent(e.walk ? e.walk.cv : null, 1),
          e.walk ? `${num(e.walk.p10)}-${num(e.walk.p90)}` : '-',
          e.walk ? num(e.walk.max) : '-',
          e.stretch ? num(e.stretch.mean, 2) : '-',
          e.detour ? num(e.detour.mean, 2) : '-',
        ])
      )
    );
    console.log(
      `\nfurthest anything stands from the hut, as a true radius: ${spread(sum.rim, 1)} ` +
        `(max ${num(sum.rim.max, 1)}, against an EDGE_RADIUS of ${EDGE_RADIUS}); ` +
        `placed outside the world: ${sum.outside}/${sum.total}; unreachable: ${sum.unreachable}/${sum.total}`
    );
    if (sum.outside)
      console.log(
        `  ${rose.label} puts content past the rim. EDGE_RADIUS is set against the rose the game is\n` +
          '  actually on (balance.js), so another rose is being measured in a world that was not built\n' +
          '  for it — scale it down to compare fairly, e.g. chebyshev:0.8.'
      );
  }
  console.log(
    '\n"straight line" is |x| + |y|: the walk if the ground were empty, and so the rose\'s own doing.\n' +
      '"walk" is steps over the real ground out of the hut door holding every key — the rose plus the ground.\n' +
      '"placed" and "walked" are those two as a standard deviation over their mean. The first is the number\n' +
      'the roses differ on; the second is the first with the rock\'s own unevenness added, and the rock is\n' +
      'the same either way. "typical" is the tenth to ninetieth percentile of the walk, "worst" the longest\n' +
      'one measured, and "ground tax" is walk ÷ straight line — the control.'
  );
}

function main() {
  const [command = 'play', ...rest] = process.argv.slice(2);
  const f = flags(rest);
  const opts = {
    seeds: Number(f.seeds || 8),
    expeditions: Number(f.expeditions || 60),
    steps: Number(f.steps || 60000),
    base: Number(f.base || 20260919),
    styles: f.style && f.style !== 'all' ? f.style.split(',') : STYLE_IDS,
  };
  for (const id of opts.styles) if (!STYLES[id]) throw new Error(`no such style: ${id}`);

  const roses = (f.roses || (command === 'play' ? RING_METRIC : 'manhattan,chebyshev')).split(',').map(parseRose);
  const t0 = Date.now();
  if (command === 'play') play(opts, roses);
  else if (command === 'compare') compare(opts, roses);
  else if (command === 'geometry') geometry(opts, roses);
  else throw new Error(`no such command: ${command} (play | compare | geometry)`);
  console.log(`\n${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main();
