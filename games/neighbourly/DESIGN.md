# Neighbourly

## 1. One-liner

A small-board placement puzzle: each turn you put one of three pieces on a 6×6 terrain map,
and the board has to reach a rising score target every ten turns.

## 2. Pitch

Every piece scores from what is around it: neighbours, water, rock, its row, the edge. The
board persists through six levels, but sixty placements onto thirty-six tiles means the back
half of a run is all replacing, so every good piece you put down costs one you already had.
Everything is visible: the whole board, every piece's score, the whole set, and exactly what a
placement would do before you commit to it.

The first prototype answers one question: **is placing and replacing pieces on a small board
fun?** Odds, pools and more sets wait until that answer is yes.

## 3. Core loops

**Turn (a few seconds to a minute):**
1. Three pieces are offered.
2. Pick one, tap a tile: the info panel says what the board would score, and every tile whose
   score would move shows its +n/−n.
3. Try other tiles and other pieces until you like one, then PLACE. Whatever stood on that tile
   is gone.

**Level (ten turns):** after the tenth placement the board's score is compared with the level's
target. Meet it and the next level starts on the same board, with a higher target. Miss it and
the run is over.

**Run:** six levels, sixty placements.

## 4. Core mechanics

| Mechanic | Description | Input |
|---|---|---|
| Placement | Put the picked offer on any tile, replacing what is there (the old piece simply disappears). Every tile takes a piece; terrain stays under it. | Tap offer, tap tile, PLACE |
| Scoring | The board scores the sum of its pieces. A piece scores `base + its terms + the auras of its neighbours`, never below 0. Adjacent means the four orthogonal neighbours. | — |
| Preview | Tapping a tile with a piece picked shows the board before and after, the piece's own score as a sum, and the change on every tile it affects. Tapping a tile with nothing picked reads out what is there. | Tap |
| Fixed offers | One scripted sequence of offers, the same every run: three distinct pieces per turn, every piece equally likely. No odds, no pool, no lookahead. `?seed=n` plays script n. | — |

### The board

6×6, three terrains, no obstacles. The map is authored (`TERRAIN_ROWS` in
`src/data/tuning.js`): a pond top left and a smaller one bottom right, and a ridge of rock down
the right side and a patch at the bottom left, so Shore and Ridge each have places they want to
be and the places are not the same.

### The set: twelve pieces, verb "neighbours"

| Piece | Rarity | Scores |
|---|---|---|
| Basic | Common | 2 |
| Cluster | Common | 1 per adjacent piece |
| Open | Common | 4, minus 1 per adjacent piece |
| Shore | Common | 1, plus 2 per adjacent water tile |
| Ridge | Common | 1, plus 3 if placed on rock |
| Row | Uncommon | 1 per other piece in its row |
| Column | Uncommon | 1 per other piece in its column |
| Pair | Uncommon | 2, plus 4 with exactly one adjacent piece |
| Edge | Uncommon | 3, plus 3 on the board edge |
| Hub | Rare | 2 per adjacent piece; each neighbour scores 1 less |
| Booster | Rare | 0; each neighbour scores 2 more |
| Monument | Legendary | 2 per distinct piece type on the board (itself included) |

Open and Cluster pull in opposite directions (empty versus full board), Hub is a signed
trade-off, and Monument rewards variety where most pieces reward repetition. Auras stack (two
Boosters give +4), and the floor at 0 applies to a piece's final score, so a Basic between three
Hubs scores 0, not −1. Row and Column don't count themselves. A Shore standing in water still
counts the water around it.

Pieces are data (`src/data/pieces.js`): a base, a list of terms in a small vocabulary (count
neighbours / a terrain / row / column / distinct types, or a condition: on a terrain, on the
edge, exactly n neighbours), and an optional aura. Each carries a rarity now so odds and pools
can use it later. Names are placeholders.

## 5. Constraints

- Portrait phone first: 480×854 design space, scaled to fit, one screen, no scrolling.
- No build step, no assets: pieces are a glyph on a tile with a rarity-coloured rim.
- Every gameplay number in one object (`DEFAULT_TUNING` in `src/data/tuning.js`); layout and
  palette in `src/config.js`.
- One pure scoring function (`scoreBoard` in `src/core/rules.js`) for both the preview and the
  level judgement.

## 6. Win / lose conditions

- **Win:** the board meets the target at the end of all six levels.
- **Lose:** the board is under the target at the end of any level.
- **Session end:** a run is about sixty taps-and-places; PLAY AGAIN replays the same script.

## 7. Controls

| Action | Input (mouse) | Input (touch) |
|---|---|---|
| Pick an offer (tap again to drop it) | Click a card | Tap a card |
| Preview / inspect a tile | Click a tile | Tap a tile |
| Commit | PLACE | PLACE |
| Read the whole set | SET | SET |

## 8. Tuning

Targets per level: **45 / 125 / 215 / 290 / 350 / 400**, set with `npm run sim`, which plays
every policy through all six levels with the targets switched off and reports the board's score
at each level's end, then the pass rate with the real targets. Over 500 offer scripts:

| Policy | What it stands for | Clears level 1 / 2 / 3 / 4 / 5 / 6 |
|---|---|---|
| random | random offer on a random tile | 7% / 0% / 0% / 0% / 0% / 0% |
| naive | first offer, fill the board in reading order, then replace from the top | 20% / 4% / 1% / 0% / 0% / 0% |
| greedy | the best immediate gain over every offer and tile | 100% / 97% / 93% / 87% / 84% / 80% |

So reading the previews and taking the best one wins most runs, and placing without reading
them loses in the first two levels. Greedy has no plan; a player who builds for later turns
(holding a row open for a Row, a spot by water for a Shore) should do better than it. On the
default script (seed 1) the greedy line wins with 474 against 400. These are hand-tuned
starting values to react to in play, not settled numbers.

The other values: 6 levels × 10 turns, 3 offers per turn, offer script seed 1. `rarityWeights`
per level is in the tuning object already but nothing reads it until odds exist.

## 9. Art & audio style

- **Visual style:** flat colour. Terrain is a coloured tile (grass green, water blue with two
  ripples, rock grey with a peak); a piece is a cream rounded square with its glyph and its
  current score, rimmed in its rarity colour (grey, green, blue, gold).
- **Audio:** none for the prototype.

## 10. Open questions and later layers

- **Score calculation:** base × multiplier is the likely direction; for now a board is a plain
  sum.
- **Target curve:** the numbers in §8 are a first guess from the simulator.
- **Snowballing:** a strong early engine on a persistent board could trivialise later levels;
  rising targets are the counterweight.
- **Dead late turns:** with a full board of good pieces, mediocre offers feel like downgrades and
  there is no skip. A skip, or a replacement bonus, may be needed.
- **Replacement:** replace-only; leaving something behind (a bonus, a changed tile) is a
  possible later layer.
- **Odds and pools (next):** TFT-style rarity weights by level, with the odds and the copies left
  in the pool shown to the player. Then more sets (clusters, lines, terrain change, strong effects
  that cost the neighbours), about three per run.
- **Out of scope for v0:** multiple sets, upgrades, potions, obstacles and pre-placed objects,
  saving, meta progression, side objectives.

## Source layout

| Path | Holds |
|---|---|
| `src/data/pieces.js` | The twelve piece definitions |
| `src/data/tuning.js` | Every gameplay number and the terrain map |
| `src/core/rules.js` | Scoring, preview, the offer script, a run's levels. Pure; no Phaser |
| `src/config.js` | Layout, palette, type |
| `src/ui/describe.js` | A tile's score read out as a sum, for the info panel |
| `src/ui/button.js` | The text button |
| `src/scenes/TitleScene.js` | Title and how to play |
| `src/scenes/PlayScene.js` | The run: board, offers, info panel, level-end and set overlays |
| `sim/simulate.mjs` | Plays policies through runs to set the targets |
