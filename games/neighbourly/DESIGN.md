# Neighbourly

> **Doc convention:** this describes the game *as it is now*. When a mechanic changes, edit the
> section in place: no "previously"/"superseded" notes. Git history is the changelog.

## 1. One-liner

A small-board placement puzzle: each turn you put one of three pieces on a plain 6×6 board, and
the board has to reach a rising score target every ten turns.

## 2. Pitch

Every piece scores from what is around it: its neighbours, its diagonals, its row and column, the
edge, the empty tiles left. The board persists through five levels, but fifty placements onto
thirty-six tiles means the back half of a run is all replacing, so every good piece you put down
costs one you already had. Everything is visible: the whole board, every piece's score, every piece
the run can offer, and exactly what a placement would do before you commit to it.

Each run plays the **base set**, which is in every game, plus one **special set** drawn from the
run's seed, so two runs share their grammar but not their tricks.

The prototype answers one question: **is placing and replacing pieces on a small board fun?** Odds,
pools and meta progression wait until that answer is yes.

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

**Run:** five levels, fifty placements, one base set plus one special set.

## 4. Core mechanics

| Mechanic | Description | Input |
|---|---|---|
| Placement | Put the picked offer on any tile, replacing what is there (the old piece simply disappears). Every tile is the same. | Tap offer, tap tile, PLACE |
| Scoring | The board scores the sum of its pieces. A piece scores `base + its terms + every aura that reaches it`, never below 0. Adjacent means the four orthogonal neighbours; diagonal the four corners round it. | — |
| Preview | Tapping a tile with a piece picked shows the board before and after, the piece's own score as a sum, and the change on every tile it affects. Tapping a tile with nothing picked reads out what is there. | Tap |
| Sets | The base set is in every run; one special set is drawn from the seed. SETS lists every piece in play, one tab per set. | SETS |
| Fixed offers | One scripted sequence of offers per seed, decided before the first turn: three distinct pieces per turn, every piece in the run's sets equally likely. No odds, no pool, no lookahead. `?seed=n` plays script n, `?set=id` forces the special set. | — |

### 4.1 The board

6×6 and plain: no terrain, no obstacles. Where a piece stands matters only through what is around
it, and through three places the vocabulary can name: the edge (20 tiles), the centre (the 16 off
the edge) and the four corners.

### 4.2 The base set: twelve pieces, verb "neighbours"

| Piece | Rarity | Scores |
|---|---|---|
| Basic | Common | 2 |
| Cluster | Common | 1 per adjacent piece |
| Open | Common | 4, minus 1 per adjacent piece |
| Slant | Common | 1, plus 2 per diagonal neighbour |
| Core | Common | 1, plus 3 if not on the edge |
| Row | Uncommon | 1 per other piece in its row |
| Column | Uncommon | 1 per other piece in its column |
| Pair | Uncommon | 2, plus 4 with exactly one adjacent piece |
| Edge | Uncommon | 3, plus 3 on the board edge |
| Hub | Rare | 2 per adjacent piece; each neighbour scores 1 less |
| Booster | Rare | 0; each neighbour scores 2 more |
| Monument | Legendary | 2 per distinct kind of piece on the board (itself included) |

Open and Cluster pull in opposite directions (empty versus full board), Slant and Cluster count
different neighbours of the same tile, Edge and Core want opposite halves of the board, Hub is a
signed trade-off, and Monument rewards variety where most pieces reward repetition. Auras stack
(two Boosters give +4), and the floor at 0 applies to a piece's final score, so a Basic between
three Hubs scores 0, not −1. Row and Column don't count themselves.

### 4.3 The special sets: six pieces each

A special set is a theme the base set only touches. One is drawn per run.

**Lines**: rows and columns, filled or lit up.

| Piece | Rarity | Scores |
|---|---|---|
| Lane | Common | 2, plus 6 if its row is full |
| Pillar | Common | 2, plus 6 if its column is full |
| Beacon | Uncommon | 0; every other piece in its row scores 1 more |
| Spire | Uncommon | 0; every other piece in its column scores 1 more |
| Cross | Rare | 1 per other piece in its row and column |
| Crossroads | Legendary | 0; every other piece in its row and column scores 1 more |

**Kin**: pieces that care what kind their neighbours are.

| Piece | Rarity | Scores |
|---|---|---|
| Flock | Common | 1, plus 2 per adjacent piece of its kind |
| Loner | Common | 1, plus 5 if no other piece of its kind is on the board |
| Echo | Uncommon | 1, plus 2 per other piece of its kind on the board |
| Mosaic | Uncommon | 2 per distinct kind of piece next to it |
| Twins | Rare | 3, plus 6 with exactly one adjacent piece of its kind |
| Crowd | Legendary | 1 per piece of the board's commonest kind |

**Space**: pieces that want room, on a board that only ever fills up.

| Piece | Rarity | Scores |
|---|---|---|
| Hermit | Common | 1, plus 2 per adjacent empty tile |
| Corner | Common | 2, plus 6 in a corner |
| Island | Uncommon | 7 with no adjacent piece, else 0 |
| Frontier | Uncommon | 1, plus 1 per empty tile in its row and column |
| Void | Rare | 1 per 3 empty tiles on the board |
| Clearing | Legendary | 3 per empty tile around it, diagonals included |

Space is the one set that argues with the run's shape: nothing ever empties a tile, so its pieces
are strongest early and the question is how long to keep a gap open by replacing rather than
filling.

### 4.4 Pieces are data

A piece is a line in `src/data/pieces.js`: its set, its rarity, a base, a list of terms and an
optional aura. A term either counts something and pays `each` per thing counted (`per: n` counts
whole groups of n), or checks a condition and adds `add` when it holds. An aura is
`{ amount, reach }`: what the piece adds to every piece it reaches, never itself. The vocabulary is
three tables in `src/core/rules.js`:

- **Counts:** adjacentPieces, diagonalPieces, adjacentEmpty, surroundingEmpty (all eight round it),
  adjacentSame, adjacentKinds, rowPieces, columnPieces, linePieces, lineEmpty, copies (others of its
  kind anywhere), distinctTypes, largestKind, emptyTiles.
- **Conditions:** onEdge, inCentre, inCorner, adjacentPiecesEquals, adjacentSameEquals,
  copiesEquals, rowFull, columnFull.
- **Reaches:** adjacent, diagonal, row, column, lines (row and column).

A piece that recombines these is a line in `pieces.js` plus its name and rule in `src/text.js`
(`PIECE_TEXT`) plus a sprite. A new word is a line in the right table plus its read-out in `SUM`.
Rarity is carried by every piece for odds and pools later; nothing reads it yet except the frame
colour.

## 5. Constraints

- Portrait phone first: 480×854 design space, scaled to fit, one screen, no scrolling.
- No build step, no image files: sprites are text, baked to textures at boot.
- Every gameplay number in one object (`DEFAULT_TUNING` in `src/data/tuning.js`); layout and type
  in `src/config.js`; every colour in `src/data/palette.js`; every word in `src/text.js`.
- One pure scoring function (`scoreBoard` in `src/core/rules.js`) for the preview, the level
  judgement, the simulator and the dev pages' try-it board.

## 6. Win / lose conditions

- **Win:** the board meets the target at the end of all five levels.
- **Lose:** the board is under the target at the end of any level.
- **Session end:** a run is about fifty taps-and-places; PLAY AGAIN replays the same script with
  the same sets.

## 7. Controls

| Action | Input (mouse) | Input (touch) |
|---|---|---|
| Pick an offer (tap again to drop it) | Click a card | Tap a card |
| Preview / inspect a tile | Click a tile | Tap a tile |
| Commit | PLACE | PLACE |
| Read every piece in play | SETS, then a set's tab | SETS, then a set's tab |

## 8. Tuning

Targets per level: **50 / 130 / 210 / 280 / 330**, set with `npm run sim -- --suggest 0.9`: the
score the greedy persona reaches nine runs in ten at each level, over every special set, rounded.
The simulator plays every persona with the targets switched off and reports the board's score at
each level's end, then how many runs clear each level with the real targets. Over 200 offer
scripts per set (planner over 30):

| Persona | What it stands for | Clears all five: lines / kin / space |
|---|---|---|
| random | a random offer on a random tile | 0% / 0% / 0% |
| naive | the first offer, filling the board in reading order | 0% / 0% / 0% |
| filler | the best immediate gain, onto an empty tile while there is one | 88% / 84% / 71% |
| greedy | the best immediate gain over every offer and tile | 87% / 84% / 75% |
| planner | greedy, weighing its best moves by what any piece could add next turn | 97% / 97% / 73% |

So reading the previews and taking the best one wins most runs, placing without reading them loses
in the first level or two, and thinking one turn ahead pays in two sets of three. Space is the
hardest set for every persona that reads the board, because its pieces lose value as the board
fills and none of the personas plans to keep gaps open.

`npm run sim:pieces` says which pieces the personas take and what a copy ends up worth. Two
things stand out and are the next balance pass, not settled numbers:

- **Monument is the strongest piece in the game by far.** With eighteen kinds in play instead of
  twelve, a copy is worth about 36 at the end of a run and greedy ends with seven of them.
- **The aura pieces score little on their own** (Booster, Beacon, Spire, Crossroads all end under
  2 a copy) because the personas only count the aura's gain at the moment of placing. Whether a
  person values them better is a playtest question.

The other values: 5 levels × 10 turns, 3 offers per turn, 1 special set per run, offer script seed
1. `rarityWeights` per level is in the tuning object already but nothing reads it until odds exist.

## 9. Art & audio style

- **Visual style:** pixel art on a fixed palette of 32 colours in ramps (greys, reds, oranges,
  yellows, greens, teals, blues, purples, each dark to light), `src/data/palette.js`. Every piece is
  a 16×16 sprite (`src/data/sprites.js`) shaded in three tones of its ramp inside an ink outline, and
  drawn at whole multiples only (×3 on the board, ×3 on a card, ×2 in the set list), so an art pixel
  is always a square. Panels, tiles, cards and buttons are pixel boxes in the same palette: a flat
  fill, a light bevel top and left, a dark one bottom and right, an ink edge. A piece's frame is its
  rarity colour (mist, leaf, sky, gold). Colour is used freely and loudly: the palette is the
  limit, not a small number of colours.
- **Type:** the system sans-serif for now; a pixel font is on the TODO.
- **Audio:** none for the prototype.

## 10. Story

Not written yet: see `STORY.md` and `TODO.md`.

## 11. Open questions and later layers

- **Score calculation:** base × multiplier is the likely direction; for now a board is a plain
  sum.
- **Targets:** the numbers in §8 are a first pass from the simulator; one target curve serves
  every special set, and Space is harder than the other two under it.
- **Snowballing:** a strong early engine on a persistent board could trivialise later levels;
  rising targets are the counterweight. Monument is the current example.
- **Dead late turns:** with a full board of good pieces, mediocre offers feel like downgrades and
  there is no skip. A skip, or a replacement bonus, may be needed. Space makes this sharper.
- **Replacement:** replace-only; nothing ever empties a tile.
- **Odds and pools (next):** TFT-style rarity weights by level, with the odds and the copies left
  in the pool shown to the player.
- **More than one special set a run:** `specialSets` in the tuning already takes a number.
- **Out of scope for now:** upgrades, potions, obstacles and pre-placed objects, saving, meta
  progression, side objectives.

## 12. Source layout

| Path | Holds |
|---|---|
| `src/data/pieces.js` | The sets and what every piece does (data only; `sets.html` writes it) |
| `src/data/catalogue.js` | Lookups over the pieces: `pieceDef`, `piecesIn`, the core and special set ids |
| `src/data/palette.js` | The 32 colours (data only; `palette.html` writes it) |
| `src/data/sprites.js` | Every sprite as 16 rows of palette keys (data only; `draw.html` writes it) |
| `src/data/tuning.js` | Every gameplay number |
| `src/text.js` | Every word the player reads (`text.html` edits it) |
| `src/core/rules.js` | Scoring and its vocabulary, preview, sets and the offer script, a run's levels. Pure; no Phaser |
| `src/config.js` | Layout, type, and which palette colour plays which part |
| `src/ui/textures.js` | Bakes the sprites into textures at boot |
| `src/ui/pixel.js` | The pixel box every panel, tile, card and button is drawn as |
| `src/ui/describe.js` | A tile's score read out as a sum, for the info panel |
| `src/ui/button.js` | The text button |
| `src/scenes/TitleScene.js` | Title, how to play, which sets this run plays |
| `src/scenes/PlayScene.js` | The run: board, offers, info panel, level-end and set-list overlays |
| `sim/` | The personas and the runner that plays them (`sim/README.md`) |
| `dev/` | What the dev pages share: the menu, drawing helpers, the file writers |
| `entities.html`, `sets.html`, `palette.html`, `draw.html`, `text.html` | The dev pages (§13) |

## 13. Dev pages

Five pages at the game's root, opened through a server like the game, sharing one menu across the
top (`dev/nav.js`). Each one that edits something keeps unsaved work in the browser and exports the
whole file it edits; with no edits the export is the file on disk byte for byte (the data files
through `dev/serialize.js`, which `tests/data.test.mjs` holds to that).

| Page | For |
|---|---|
| `entities.html` (BROWSE) | Every piece in every set: sprite at every size the game uses, rarity, rule, the colours it is drawn in, its data. Read-only. |
| `sets.html` (SETS) | Each set and each piece's numbers, terms and aura, with problems flagged, and a try-it board that scores with the real rules. Writes `src/data/pieces.js`. |
| `palette.html` (PALETTE) | The 32 colours, every sprite recoloured live, and which colour plays which part. Writes `src/data/palette.js`. |
| `draw.html` (DRAW) | A 16×16 pixel editor over every sprite (pen, fill, mirror, flip, shift, auto-outline, undo). Writes `src/data/sprites.js`. |
| `text.html` (WORDS) | Every string in `src/text.js`, read as source, grouped by where the player sees it. Writes `src/text.js` back with only the strings changed, or just the changes. |
