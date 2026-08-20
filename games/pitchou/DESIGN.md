# Pitchou

## 1. One-liner

You keep a lighthouse alive through a twelve-night storm by groping around the dark
shore for whatever the sea washed up, deciding each time you find something whether
to keep searching or run for the door.

## 2. Pitch

Three meters — Lamp, Hearth, Tower — drain every night and never refill on their own.
The only way to top them up is to go down among the rocks and pick tiles from the
surf one at a time, knowing that every squall that reaches you knocks something out
of your arms and the third one sends you home with half of what is left. The shore's contents are fully visible, so every "one more" is an
arithmetic decision a child can actually do out loud, and the tools you build between
nights change what's out there — the risk is something you author, not something
rolled at you.

## 3. Core loops

Three nested loops.

**A. Inside a night — the search (2-6 decisions, ~20s)**

1. Player taps a face-down tile on the shore; it flips to reveal one token.
2. A resource goes into the basket; a squall knocks one unit back out of it.
3. Feedback text names what was found ("You found Driftwood") or lost ("A squall!
   Lost 1 Oil"). The endurance line shows how many more squalls the player can take.
4. Player reads what's left on the shore (always inspectable) and chooses: tap another
   tile, or GO HOME with the basket.
5. Third squall ends the night; you get home with half of what is left, rounded down.

**B. At dawn — the recap and the workshop (1-3 decisions, ~10s)**

Dawn is a two-phase overlay:

1. **Recap:** shows what was found, what was lost to the squalls, what was carried home
   (with a meter preview and overflow warning), and a line of flavour text. The player
   taps CONTINUE; resources are poured into their meters automatically.
2. **Workshop:** shows the current meter levels and the six tool cards. Tools are paid
   directly from the meters — spending resources lowers the meter they belong to. The
   player builds what they can afford, then taps SLEEP.

**C. Across the season — the squeeze (12 nights)**

1. Nightly drain rises at nights 5 and 9.
2. The storm adds a squall to the shore after nights 3, 6 and 9.
3. So the shore gets more dangerous on a fixed schedule and the meters get hungrier;
   a player who only ever banks safely treads water and then drowns.

## 4. Core mechanics

| Mechanic | Description | Input |
|---|---|---|
| **Search the shore** | Push-your-luck draw from a known, finite, shuffled bag. Tiles are face-down on a grid; the player taps one to flip it. Resource tokens fill the basket; every squall knocks one unit back out of it, and the third ends the night — you scramble home with half of what survived. Because each squall costs something immediately, there is no stretch of the night where searching is free. Remaining contents are always visible. | Tap a tile / tap GO HOME |
| **Three separate meters** | Lamp, Hearth and Tower drain independently and are each refilled by exactly one resource. A great haul of driftwood is worthless on the night the lamp is dying — the meter closest to zero sets your risk appetite, not the odds. | — (read-only display) |
| **Tools from the meters** | Tools are paid directly from the meters. Spending 3 driftwood on a gaff hook lowers the hearth by 3 — survive tonight, or survive later. | Tap a tool card in the workshop |
| **Tools rewrite the shore** | Each tool permanently adds a stronger token to the shore or removes a squall from it. This is the only lever the player has over probability. | Tap a tool in the workshop |

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
- **A bust is not a loss.** The third squall ends the night and halves what is left of
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
| Build a tool | Click the tool card | Tap the tool card |
| End the night | Click SLEEP | Tap SLEEP |

## 8. Numbers

Derived from simulation (see *Why these numbers* below), still to be confirmed by
playtest.

**Meters** — start at 10, cap at 14. Tools are paid directly from the meters, so the
extra headroom (four above starting level) compensates for tool costs that now compete
with survival. Overflow is still lost.

| Nights | Drain per meter, per night |
|---|---|
| 1-4 | 1 |
| 5-8 | 2 |
| 9-12 | 3 |

Total drain per meter across a season is 24 against a starting stock of 10, so a run
needs roughly 42 resources gathered in 12 nights — more than a cautious player pulls
out of the starting shore.

**The shore** — starts at 18 tokens, reshuffled whole every night.

| Token | Count | Effect |
|---|---|---|
| Oil flask | 5 | Lamp +1 |
| Driftwood | 5 | Hearth +1 |
| Plank | 5 | Tower +1 |
| Wave (squall) | 3 | knocks 1 unit off the biggest stack in the basket; the third also ends the night and halves what is left |

The storm adds one squall after nights 3, 6 and 9.

**Tools** — a fixed shop, each buildable once per run. Costs are paid directly from
the meters (each resource's cost lowers the meter it belongs to).

| Tool | Cost | Effect on the shore |
|---|---|---|
| Gaff hook | 3 driftwood (hearth −3) | add a *Driftwood ×2* token |
| Tide net | 3 planks (tower −3) | add a *Plank ×2* token |
| Copper funnel | 3 oil (lamp −3) | add an *Oil ×2* token |
| Lantern pole | 2 oil + 2 driftwood (lamp −2, hearth −2) | add an *Oil* token |
| Storm wall | 6 planks (tower −6) | remove a squall |
| Breakwater | 4 oil + 4 driftwood (lamp −4, hearth −4) | remove a squall |

### Why these numbers

`sim/simulate.mjs` plays 50,000 seasons per policy. The tuning is chosen so that
the three things the player decides all change the outcome, and in the right order:

| How it is played | Wins |
|---|---|
| reckless — never stop searching | 0.0% |
| timid — home at the first wave | 0.1% |
| safe — home at two waves, never build | 11.1% |
| safe, and build tools | 33.8% |
| build tools, and push past two waves at good odds | 43.3% |

Each step up in thinking is worth roughly ten points of win rate, and careless play
loses outright. Three numbers hold that shape up, and `npm run sweep` keeps the
ablations alongside the current tuning:

- **Squall damage is what makes the early squalls matter.** With squalls free until the
  third, only 11.8% of a night's taps are decisions — `bustOdds` is zero until two
  squalls are out, so the rest of the night is a button with no reason not to press it.
  Costing a unit per squall takes that to 96%, and at matched difficulty (the thinner
  shore the free-squalls rule needs to stay honest) the win rate is unchanged. Left on
  this shore, free squalls simply make the game generous enough that cautious play
  dominates again.
- **Tools from meters is what makes building a real trade-off.** Because tool costs
  lower the meters directly, every tool purchase trades short-term safety for long-term
  throughput. The cap at 14 gives just enough headroom to afford tools without dying
  immediately, but not enough to hoard safety — overflow is still lost.
- **The halved bust is what makes pushing worth it.** With an all-or-nothing bust
  the push policy drops from 43% to 11% and never beats simply playing safe — in
  all 180 tunings searched, not one made risk pay while a bust cost the whole basket.

Three things that sound like fixes and are not. High-value tokens on the shore make
pushing *worse* (a bigger token inflates the basket you are risking, and is no
likelier to appear late than early). Cheaper tools change almost nothing until the
cap is tight enough that anyone can afford them. And a richer shore of 6/6/6, which
looks like simple generosity, inverts the whole design: cautious play reaches 34% and
becomes the best line again, so the push decision stops mattering.

Two structures were measured against the current one and rejected. A single wave that
ends the night immediately makes every tap live, but busts three times as often, takes
17 taps a night, and — fatally — cannot absorb the storm's extra waves, which drops it
to 7.9% and takes loop C with it. Graded wave sizes (1/1/2) only reach 30% live taps
for a much higher bust rate.

## 9. Scope — MVP vs. cut

**MVP (must have to test if the core loop is fun):**
- Three meters, dusk drain, lose-on-zero, win at night 12.
- The shore: tappable face-down tiles, basket, squall damage, three-strike bust,
  always-visible contents.
- Dawn recap showing what was found, lost, and carried home, with flavour text.
- Workshop where tools are built from the meters.
- The six tools above and the scheduled squall additions.
- A recap screen naming the night you died and the meter that killed you.
- An all-or-nothing bust as a hard mode, off a Settings toggle. It costs one
  field in the tuning object, so leaving it out would have been the more
  elaborate choice.

**Nice to have (only after MVP works):**
- **Choose your stretch of shore** — pick east rocks / deep pool / the wreck each
  night to weight the shore toward one resource at the cost of an extra squall. This is
  the first expansion if the game feels too fatalistic, and it directly answers
  "I'm dying of thirst holding firewood." Left out of MVP because it roughly doubles
  the decision surface and the game is complete without it.
- Storm-intensity flavour text per night.
- Choosing your own seed from inside the game rather than off the URL.

**Explicitly out of scope:**
- Any action, timing or dexterity input.
- Persistent meta-progression between runs. Each run starts from the same shore.
- Narrative branching, characters, dialogue.

## 10. Art & audio style

- **Visual style:** flat shapes and big legible numerals, drawn with Phaser's
  `Graphics`. Every icon is a 16×16 one-bit mask in `src/data/sprites.js`, baked to a
  white texture and tinted at draw time. The palette is a dark storm in which the lamp
  is the only warm colour — Hearth and Tower are two cool tones and a wave is cold
  foam, so the one thing on screen that looks like fire is the thing the whole run is
  about. The meters are vertical bars with a tick per unit and a ghosted band showing
  what the next dusk will take; the shore is a grid of face-down tiles that flip in
  place when tapped and stay face-up until the night ends.
- **The screen:** one screen, no scrolling. Reading down — the night and the
  twelve-night track with the storm nights ringed; the three meters; the strike pips
  and the endurance text ("You can endure X more squalls"); the shore grid; the basket;
  and the GO HOME button. Dawn is a two-phase panel over the same screen rather than a
  second scene: a recap (found/lost/carried home with flavour text) followed by the
  workshop.
- **Motion:** a token flip, a screen shake and a foam flash when a squall reaches you, a
  crimson vignette on the bust, and the unit a squall takes visibly leaving the stack it
  came off — the biggest-stack rule is not obvious from the numbers alone. All of it
  collapses to an instant set under the Settings motion toggle, which never changes
  what is shown.
- **Reference games:** Quacks of Quedlinburg (bag-building push-your-luck — the direct
  ancestor); Incan Gold and Deep Sea Adventure for the press-or-retreat beat; Reigns
  for the "few meters, one tap" mobile shape.
- **Audio:** synthesised through WebAudio at runtime, so there is still nothing to
  load. A wet scuff on each draw, a note pitched per resource, a slap and a low thud
  for a squall, a longer crash for the bust, hammer blows for a tool. Under all of it a
  wind drone that opens up each time the storm adds a squall, so loop C is audible before
  it is arithmetic. It can be turned off, and the game is complete without it.

## 11. Theme

A keeper alone on a rock through storm season. The meters are not abstractions: the
lamp has to burn so ships find the channel, the hearth has to burn so the keeper stays
dry, the tower has to hold. Nobody is in visible peril and nobody dies on screen — the
stakes are the light going out, which is loss enough.

The theme is doing mechanical work rather than decorating: you can't choose what your
hands find in the dark surf, which is exactly why the shore is a bag; and building a
gaff or a storm wall changing your odds is what a keeper would actually do with a
season's salvage.

## 12. Tech notes

- **Platform:** Web (2D), portrait, mobile-first.
- **Engine/library:** Phaser 3 via CDN `<script>`, no build step, ES modules.
- **Screen size:** 480×854.
- **Structure:** the rules — shore composition, draw resolution, bust, drain schedule,
  tool costs and effects — live in a pure `src/core/` module with no Phaser imports, so
  a test and the simulator can play whole seasons headlessly. The view layer holds no
  game numbers at all; the one exception is hard mode, which is a single tuning field.

| Path | Holds |
|---|---|
| `src/main.js` | `Phaser.Game` config and scene registration — boot only |
| `src/config.js` | Layout bands, the palette, tween durations, and the three persisted settings |
| `src/core/rules.js` | The whole game as pure functions, and `DEFAULT_TUNING`. No Phaser, no DOM |
| `src/data/sprites.js` | 16×16 `#`/`.` masks: token faces, meter icons, tool icons |
| `src/ui/textures.js` | Bakes those masks into white textures, tinted at draw time |
| `src/ui/button.js` | The one interactive control, used by every scene |
| `src/ui/sfx.js` | Every sound, synthesised through WebAudio |
| `src/ui/MeterBar.js` | One meter: bar, ticks, numeral, next-drain ghost |
| `src/ui/ShoreView.js` | The tile grid: face-down plates that flip on tap |
| `src/ui/BasketView.js` | The three stacks, and the unit a squall knocks off one |
| `src/ui/DawnPanel.js` | The dawn overlay: recap phase (found/lost/carried home) then workshop phase (tools from meters) |
| `src/scenes/` | `TitleScene`, `SettingsScene`, `NightScene`, `RecapScene` |
| `sim/` | The tuning tools: season simulator, policies, ablation sweep, grid search |
- **Screens:** title, settings (sound, motion, hard bust), the night itself, and the
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
  whether a 47% bust rate *feels* fair to an eight-year-old, or whether counting the
  bag is fun or homework. Those need a playtest.
