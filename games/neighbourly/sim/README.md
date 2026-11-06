# `sim/`: playing runs to measure them

A headless runner that plays whole Neighbourly runs against the real `src/core/rules.js`, with
personas standing in for players. It exists to set the targets and to see which pieces carry a run,
so balance can be argued from numbers. Nothing here is loaded by the game, and `npm test` does not
run it.

```
npm run sim              every persona over every special set: level-end scores and clear rates
npm run sim:pieces       per piece: how often it is taken when offered, copies a run ends with, points a copy
```

Flags go after `--`, e.g. `npm run sim -- --seeds 300 --persona greedy,planner --set kin`.

| flag | what it does |
|---|---|
| `--seeds N` | offer scripts per row (default 100) |
| `--base N` | the first seed, so a run can be repeated or a fresh sample taken (default 1) |
| `--persona a,b` | which personas (default all) |
| `--set a,b` | which special sets to play alongside the base set (default all) |
| `--suggest R` | after the table, the targets the reference persona meets a share R of the time at each level, and what clearing them in a row costs |
| `--reference p` | the persona `--suggest` reads (default `greedy`) |

Every run plays all five levels with the targets switched off, so a row says what that persona's
board is worth at each level's end; the clear rates then apply the real targets, chained (level n
and every level before it).

## The personas

`sim/personas.mjs`. A persona sees what a player sees: the board, the three offers, the pieces the
run can offer and where it is in the run. None may read the offer script.

| persona | stands for |
|---|---|
| `random` | a random offer on a random tile: the floor |
| `naive` | the first offer, filling the board in reading order, then replacing from the top: not reading the rules |
| `filler` | the best immediate gain, onto an empty tile while there is one: reads the previews, never throws a piece away early |
| `greedy` | the best immediate gain over every offer and tile: a careful player with no plan |
| `planner` | greedy's best four moves, each weighed by what any piece in the run could add the turn after (half weight); takes the best immediate move on a level's last turn |

`planner` is slow (about a second a run) because it scores the whole pool over every tile for
each candidate; `--seeds 30` is enough to see its shape. When a persona loses, check it isn't just
playing badly before concluding a piece or a target is wrong.

Adding a persona is an entry in `PERSONAS` with an `about` line and a `pick(state, rng)` that
returns `[offerIndex, tileIndex]`.
