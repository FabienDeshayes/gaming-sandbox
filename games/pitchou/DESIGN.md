# Pitchou

## 1. One-liner

You keep a lighthouse alive through a twelve-night storm by groping around the dark
shore for whatever the sea washed up, deciding each time you find something whether
to keep searching or run for the door.

## 2. Pitch

Three meters — Lamp, Hearth, Tower — drain every night and never refill on their own.
The only way to top them up is to go down among the rocks and pick tiles from the surf
one at a time, knowing that every time you lose your footing on the wet rock you drop
something, and the third fall sends you home with half of what is left. The shore's
contents are fully visible, so every "one more" is an arithmetic decision a child can
actually do out loud, and the tools you build between nights change what's out there —
the risk is something you author, not something rolled at you.

The hazard has exactly one name — a **FALL** — in the rules, in the simulator and on
the screen. Nothing anywhere calls it a squall, a wave or a storm.

## 3. Core loops

Three nested loops.

**A. Inside a night — the search (2-6 decisions, ~20s)**

1. Player taps a face-down tile on the shore; it flips to reveal one token.
2. Resources go into the basket; a fall knocks one unit back out of it.
3. Feedback text names what was found ("You found 1 WOOD + 1 PLANK") or dropped ("You
   fell! Dropped 1 OIL"). The line beside the pips says how many more falls the night
   can take.
4. Player reads what's left on the shore (always inspectable) and chooses: tap another
   tile, or GO HOME with the basket.
5. Third fall ends the night; you get home with half of what is left, rounded down.

**B. At dawn — the recap and the workshop (1-3 decisions, ~10s)**

Dawn is a two-phase overlay:

1. **Recap:** shows what was found, what was dropped in a fall, what was carried home
   (with a meter preview and overflow warning), and a line of flavour text. The player
   taps CONTINUE; resources are poured into their meters automatically.
2. **Workshop:** shows the current meter levels and all twelve tool cards. Tools are
   paid directly from the meters — spending resources lowers the meter they belong to
   — and **one dawn builds one tool**. The player picks one, or none, then taps SLEEP.

**C. Across the season — the squeeze (12 nights)**

1. Nightly drain rises at nights 6 and 10, and the workshop opens a tier of four more
   tools on the same two nights.
2. The shore picks up another fall after nights 3, 6 and 9.
3. So the shore gets more dangerous on a fixed schedule and the meters get hungrier,
   while what you can build to answer it opens on the same schedule; a player who only
   ever banks safely treads water and then drowns.

## 4. Core mechanics

| Mechanic | Description | Input |
|---|---|---|
| **Search the shore** | Push-your-luck draw from a known, finite, shuffled bag. Tiles are face-down on a grid; the player taps one to flip it. Resource tokens fill the basket; every fall knocks one unit back out of it, and the third ends the night — you scramble home with half of what survived. Because each fall costs something immediately, there is no stretch of the night where searching is free. Remaining contents are always visible. | Tap a tile / tap GO HOME |
| **Three separate meters** | Lamp, Hearth and Tower drain independently and are each refilled by exactly one resource. A great haul of driftwood is worthless on the night the lamp is dying — the meter closest to zero sets your risk appetite, not the odds. | — (read-only display) |
| **Tools from the meters** | Tools are paid directly from the meters. Spending 3 driftwood on a gaff hook lowers the hearth by 3 — survive tonight, or survive later. | Tap a tool card in the workshop |
| **Tools rewrite the shore** | Each tool permanently adds a token to the shore or removes a fall from it. This is the only lever the player has over probability. | Tap a tool in the workshop |
| **Three kinds of token to add** | A tool adds a plain doubler (*2 WOOD*), a **mixed** token that pays two or three resources in one draw, or a **rolled** token worth 1-3, settled at the moment it is flipped. A doubler is the safe answer to one dying meter; a mixed token feeds two at once and stops you having to pick a lane; a rolled token has the best ceiling on the shore and a floor worse than a doubler. | Tap a tool in the workshop |
| **One build a night** | Twelve tools, twelve nights, and one build per dawn — so the workshop is "which one, tonight", never a shopping list worked through. | — (the workshop closes after a build) |
| **Tools unlock in tiers** | The twelve tools open four at a time — tier 2 on night 6, tier 3 on night 10, the same nights the drain steps up. A locked card shows the night it opens instead of its cost, and still shows what it would do. | — (read-only until unlocked) |

## 5. Constraints

- Portrait 480×854, one screen, thumb-reachable — every interaction is a single tap.
- No timing, no reflexes, no hidden information. The shore's exact contents are
  inspectable at all times; the only unknown is draw order.
- Small numbers only. Nothing in the UI should exceed two digits, so the odds stay
  countable in your head.
- No external assets and no build step. Sound is synthesised at runtime rather
  than loaded, so there is still nothing to fetch, and the game is complete with
  it switched off.

## 6. Win / lose conditions

- **Win:** survive all 12 nights — night 12 resolves with all three meters above zero.
- **Lose:** any meter hits 0 at dusk. There is no partial loss and no score.
- **Session end:** a run is 12 nights, roughly 5-8 minutes.
- **A bad fall is not a loss.** The third fall ends the night and halves what is left of
  the basket (rounded down per resource); the run continues. Losing everything instead
  makes the cost of a push scale with the basket you are already holding, which kills
  the push decision outright — see §8.

Survival, not accumulation, is deliberately the win condition: it puts a real stake on
every push, and it means a surplus is only ever worth something if you spend it.

## 7. Controls

| Action | Input (keyboard/mouse) | Input (touch) |
|---|---|---|
| Search the shore | Click a face-down tile | Tap a face-down tile |
| Go home / bank the basket | Click GO HOME | Tap GO HOME |
| Advance from recap to workshop | Click CONTINUE | Tap CONTINUE |
| Build tonight's tool | Click the tool card | Tap the tool card |
| End the night | Click SLEEP | Tap SLEEP |

## 8. Numbers

Derived from simulation (see *Why these numbers* below), still to be confirmed by
playtest.

**Meters** — start at 10, cap at 14. Tools are paid directly from the meters, so the
headroom of four above starting level is what makes a tool affordable at all without
dying for it. Overflow is still lost.

| Nights | Drain per meter, per night |
|---|---|
| 1-5 | 1 |
| 6-9 | 2 |
| 10-12 | 3 |

Total drain per meter across a season is 22 against a starting stock of 10, so a run
needs roughly 36 resources gathered in 12 nights — more than a cautious player pulls
out of the starting shore.

**The shore** — starts at 15 tokens, reshuffled whole every night.

| Token | Count | Effect |
|---|---|---|
| Oil flask | 4 | Lamp +1 |
| Driftwood | 4 | Hearth +1 |
| Plank | 4 | Tower +1 |
| Fall | 3 | knocks 1 unit off the biggest stack in the basket; the third also ends the night and halves what is left |

The shore picks up one more fall after nights 3, 6 and 9.

**Tools** — a fixed shop of twelve, each buildable once per run, and **one build a
night**. Costs are paid directly from the meters (each resource's cost lowers the meter
it belongs to). Tools unlock four at a time on the tuning's `toolTierNights`: tier 2
opens night 6, tier 3 night 10 — the same nights the drain (above) steps up, so the
workshop gets more dangerous on the same schedule the shore does. A locked card shows
"Opens night N" instead of a cost, but still shows what it would do.

A tool either takes a fall off the shore or adds one token to it, and the token is one
of three kinds: a plain doubler, a **mixed** token paying two or three resources in one
draw, or a **rolled** token worth 1-3, settled at the moment it is flipped.

| Tool | Tier | Opens | Cost | What it puts on the shore |
|---|---|---|---|---|
| Gaff hook | 1 | night 1 | 3 wood (hearth −3) | *2 WOOD* |
| Tide net | 1 | night 1 | 3 planks (tower −3) | *2 PLANK* |
| Oil funnel | 1 | night 1 | 3 oil (lamp −3) | *2 OIL* |
| Rope line | 1 | night 1 | 2 wood + 2 planks | *1 WOOD + 1 PLANK* |
| Lantern pole | 2 | night 6 | 2 oil + 2 wood | *1-3 OIL* |
| Beach rake | 2 | night 6 | 2 wood + 2 planks | *1-3 WOOD* |
| Winch | 2 | night 6 | 2 oil + 2 planks | *1-3 PLANK* |
| Salvage crate | 2 | night 6 | 2 of each | *1 OIL + 1 WOOD + 1 PLANK* |
| Storm wall | 3 | night 10 | 6 planks (tower −6) | removes a fall |
| Breakwater | 3 | night 10 | 4 oil + 4 wood | removes a fall |
| Oil barrel | 3 | night 10 | 3 oil + 3 wood | *1-3 OIL + 1 WOOD* |
| Salvage raft | 3 | night 10 | 3 wood + 3 planks | *1-3 PLANK + 1 WOOD* |

Tier 1 gives every meter its own cheap answer, so no run is ever stuck holding firewood
while the lamp dies. Tier 2 is where the shore stops being predictable. Tier 3 is the
only place a fall can be taken off the shore, and it costs a season's savings.

### Why these numbers

`sim/simulate.mjs` plays 20,000 seasons per policy. The tuning is chosen so that the
three things the player decides all change the outcome, and in the right order:

| How it is played | Wins |
|---|---|
| reckless — never stop searching | 0.0% |
| timid — home at the first fall | 0.1% |
| safe — home at two falls, never build | 8.9% |
| safe, and build tools (buffered against next dusk) | 33.6% |
| build tools, and push past two falls at good odds | 46.8% |

Each step up in thinking is worth double-digit points of win rate, and careless play
loses outright. Five numbers hold that shape up, and `npm run sweep` keeps the
ablations alongside the current tuning:

- **One build a night is what makes twelve tools a decision.** Lift the cap and the
  simulator buys 8.8 tools a season instead of 7.0, the best line stops being the one
  that pushes (35.9% for safe-and-build against 34.1% for pushing), and the workshop
  degenerates into a list you work down. The cap is also the whole reason the shop can
  be this big: with it, twelve cards is a menu you choose from twelve times.
- **The shore had to get thinner when the workshop got bigger.** On the old 5/5/5 shore
  the expanded shop makes the season generous enough that cautious play reaches 45.4%
  and pushing only beats it by 1.5 points — the push decision stops mattering. At 4/4/4
  the gap is 13 points. Thinner still (3/3/3) and the best line is 21.5%, which is not
  a game so much as a series of unlucky seasons.
- **Fall damage is what makes the early falls matter.** With falls free until the third,
  only 25.9% of a night's taps are decisions — `bustOdds` is zero until two falls are
  out, so the rest of the night is a button with no reason not to press it. Costing a
  unit per fall takes that to 100%, and the free-falls rule also makes the season
  generous enough (69-70% across every thoughtful policy) that it stops discriminating
  between them at all.
- **The halved fall is what makes pushing worth it.** With an all-or-nothing ending the
  push policy drops from 46.8% to 22.0% and never beats simply playing safe — in all
  180 tunings searched, not one made risk pay while a bad fall cost the whole basket.
- **The drain steps every five nights, not every four.** The steeper schedule the game
  used before the expanded workshop takes the best line to 34.5% and the cautious line
  to 2.5%, which is tense but leaves a first-time player with almost no path. The
  gentler step keeps careless play losing (0.0%) while giving the naive line something
  to be beaten from.

The expanded workshop is itself measured: `ablation: the old six-tool workshop` keeps
the previous shop — six tools, all plain doublers or fall removals — on this tuning. It
lands at 43.5% against 47.2%, and more to the point builds 3.9 tools a season against
7.0. The extra cards are not power; they are more nights on which the workshop has
something worth deciding.

Two things that sound like fixes and are not. Raising the cap to 18 so a surplus can be
hoarded barely moves anything (51.7% against 47.2%) — with one build a night the meters
cannot be drained fast enough for the extra headroom to be the binding constraint, so
the cap is doing less work here than the rest of the tuning and is not worth defending
hard. And the "safety first" shopping order — buying the fall removals before anything
that adds a token — is indistinguishable from throughput-first (27.5% each at buffer 2),
because tier 3 opens on night 10 and by then the season is already decided.

Two fall structures were measured against the current one and rejected. A single fall
that ends the night immediately makes every tap live but cannot absorb the falls the
shore picks up later, which drops it to 21.9% at matched difficulty. A budget of two
takes the bust rate to 86% with four falls out there. `npm run falls -- --fair` compares
whole structures at the shore richness that puts each nearest a 50% win rate, which is
the only fair way to ask which one has the most decisions in it.

## 9. Scope — MVP vs. cut

**MVP (must have to test if the core loop is fun):**
- Three meters, dusk drain, lose-on-zero, win at night 12.
- The shore: tappable face-down tiles, basket, fall damage, three-strike ending,
  always-visible contents.
- Dawn recap showing what was found, dropped, and carried home, with flavour text.
- Workshop where tools are built from the meters, one a night.
- The twelve tools above — plain, mixed and rolled tokens plus fall removal — and the
  scheduled fall additions.
- A recap screen naming the night you died and the meter that killed you.
- An all-or-nothing ending as a hard mode, off a Settings toggle. It costs one
  field in the tuning object, so leaving it out would have been the more
  elaborate choice.

**Nice to have (only after MVP works):**
- **Choose your stretch of shore** — pick east rocks / deep pool / the wreck each
  night to weight the shore toward one resource at the cost of an extra fall. Less
  urgent than it was: the mixed and rolled tokens already give the workshop an answer
  to "I'm dying of thirst holding firewood". Left out of MVP because it roughly doubles
  the decision surface and the game is complete without it.
- Flavour text that says how bad the shore has got, per night.
- Choosing your own seed from inside the game rather than off the URL.

**Explicitly out of scope:**
- Any action, timing or dexterity input.
- Persistent meta-progression between runs. Each run starts from the same shore. This
  is on `TODO.md` to be reconsidered — the whole of §8 rests on every run starting from
  the same numbers, so it is a tuning question before it is a feature.
- Narrative branching, characters, dialogue.

## 10. Art & audio style

- **Visual style:** flat shapes and big legible numerals, drawn with Phaser's
  `Graphics`. Every icon is a 16×16 one-bit mask in `src/data/sprites.js`, baked to a
  white texture and tinted at draw time. The palette is a dark storm in which the lamp
  is the only warm colour — Hearth and Tower are two cool tones and a fall is cold
  foam-blue, so the one thing on screen that looks like fire is the thing the whole run
  is about. The fall icon is a person going down with their salvage scattering, not
  weather in the sky: the rule is "you fall and drop things", and a cloud was a picture
  of something else. The meters are vertical bars with a tick per unit and a ghosted
  band showing what the next dusk will take; the shore is a grid of face-down tiles that
  flip in place when tapped and stay face-up until the night ends. A mixed token flips
  to two or three small icons side by side, each in its own resource colour, so what it
  paid is readable off the tile rather than only off the feedback line.
- **Type:** one scale, `FONT_XL` down to `FONT_SM` in `src/config.js`, and `FONT_SM`
  (16px) is a hard floor — the vertical bands are laid out around the type rather than
  the type squeezed into the bands. A playtest read the old 12-13px labels as unreadable
  on a phone. The shore grid sizes its own tiles to match: it takes the fewest columns
  that fit the band, so a 15-token night is drawn at 66px a tile and a 28-token one at
  53px, instead of every night being drawn for the worst case.
- **The screen:** one screen, no scrolling. Reading down — the night and the
  twelve-night track with the nights that add a fall ringed; the three meters; the
  strike pips and the line that reads them ("2 more FALLS end the night"); the shore
  grid; the basket; and the GO HOME button. Dawn is a two-phase panel over the same
  screen rather than a second scene: a recap (found/dropped/carried home with flavour
  text) followed by the workshop.
- **Motion:** a token flip, a screen shake when you go down, a crimson vignette on the
  fall that ends the night, and the unit a fall takes visibly leaving the stack it came
  off — the biggest-stack rule is not obvious from the numbers alone. All of it
  collapses to an instant set under the Settings motion toggle, which never changes
  what is shown.
- **Reference games:** Quacks of Quedlinburg (bag-building push-your-luck — the direct
  ancestor); Incan Gold and Deep Sea Adventure for the press-or-retreat beat; Reigns
  for the "few meters, one tap" mobile shape.
- **Audio:** synthesised through WebAudio at runtime, so there is still nothing to
  load. A wet scuff on each draw, a note pitched per resource, a slap and a low thud
  for a fall, a longer crash for the one that ends the night, hammer blows for a tool.
  Under all of it a wind drone that opens up each time the shore picks up another fall,
  so loop C is audible before it is arithmetic. It can be turned off, and the game is
  complete without it.

## 11. Theme

A keeper alone on a rock through storm season. The meters are not abstractions: the
lamp has to burn so ships find the channel, the hearth has to burn so the keeper stays
dry, the tower has to hold. Nobody is in visible peril and nobody dies on screen — the
stakes are the light going out, which is loss enough.

The theme is doing mechanical work rather than decorating: you can't choose what your
hands find in the dark surf, which is exactly why the shore is a bag; going down on wet
rock and dropping what you were carrying is why the hazard costs loot rather than
health; and building a gaff or a storm wall changing your odds is what a keeper would
actually do with a season's salvage.

## 12. Tech notes

- **Platform:** Web (2D), portrait, mobile-first.
- **Engine/library:** Phaser 3 via CDN `<script>`, no build step, ES modules.
- **Screen size:** 480×854.
- **Structure:** the rules — shore composition, draw resolution, the fall that ends the
  night, drain schedule, tool costs and effects — live in a pure `src/core/` module with
  no Phaser imports, so a test and the simulator can play whole seasons headlessly. The
  view layer holds no game numbers at all; the one exception is hard mode, which is a
  single tuning field.
- **Tokens are a list of gains.** Every non-fall token is `{ kind: 'resource', gains }`,
  where a gain is `{ resource, amount }` or `{ resource, min, max }`. One entry is a
  plain find, two or three make a mixed token, and a `min`/`max` entry is rolled by
  `search()` at the moment of the draw and stashed back on the token as `rolled` — so
  the view draws the find it actually was rather than the promise it was. `countTokens`
  counts a rolled gain at its ceiling and reports how many of the totals are that kind
  of promise, because the shore tally is what a player counts before pushing.

| Path | Holds |
|---|---|
| `src/main.js` | `Phaser.Game` config and scene registration — boot only |
| `src/config.js` | Layout bands, the type scale, the palette, tween durations, the player-facing labels, and the three persisted settings |
| `src/core/rules.js` | The whole game as pure functions, and `DEFAULT_TUNING`. No Phaser, no DOM |
| `src/data/sprites.js` | 16×16 `#`/`.` masks: token faces, meter icons, tool icons |
| `src/ui/textures.js` | Bakes those masks into white textures, tinted at draw time |
| `src/ui/button.js` | The one interactive control, used by every scene |
| `src/ui/sfx.js` | Every sound, synthesised through WebAudio |
| `src/ui/MeterBar.js` | One meter: bar, ticks, numeral, next-drain ghost |
| `src/ui/ShoreView.js` | The tile grid: face-down plates that flip on tap, and `layoutFor`, which sizes the grid to the shore |
| `src/ui/BasketView.js` | The three stacks, and the unit a fall knocks off one |
| `src/ui/DawnPanel.js` | The dawn overlay: recap phase (found/dropped/carried home) then workshop phase (twelve tools, one build). Exports `toolCostLabel`/`toolEffectLabel`, which the tests measure against the card width |
| `src/scenes/` | `TitleScene`, `SettingsScene`, `NightScene`, `RecapScene` |
| `sim/` | The tuning tools: season simulator, policies, ablation sweep, grid search, fall-structure comparison |
- **Screens:** title, settings (sound, motion, hard falls), the night itself, and the
  recap. A run can be pinned to a seed with `?seed=7` on the URL, and the recap always
  reports the seed it played — a season that felt unfair can be played again exactly.
- **Not persisted:** nothing but the three settings. A season is five to eight minutes
  and there is no meta-progression (§9), so there is no save; a run's state holds a live
  RNG closure and does not round-trip through JSON anyway.
- **Built so far:** all of it. `src/core/rules.js` (the game as pure functions),
  `sim/simulate.mjs` (season simulator, policy table, ablation sweep, tuning grid
  search), the screen (`src/scenes/`, `src/ui/`, `src/data/sprites.js`), and two test
  suites — `tests/rules.test.mjs` for the rules and `tests/game.test.js` driving the
  real canvas through Playwright. See `TESTING.md`.
- **Key technical risks:** none technically; the risk is in tuning, and the numbers
  in §8 come from simulation rather than guesswork. What simulation cannot settle is
  whether a 52% rate of nights ending in a fall *feels* fair to an eight-year-old,
  whether counting the bag is fun or homework, or whether a 1-3 token reads as a
  thrilling gamble or as the game declining to tell you something. Those need a
  playtest.
