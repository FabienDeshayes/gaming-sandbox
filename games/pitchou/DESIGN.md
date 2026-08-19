# Pitchou

## 1. One-liner

You keep a lighthouse alive through a twelve-night storm by groping around the dark
shore for whatever the sea washed up, deciding each time you find something whether
to keep searching or run for the door.

## 2. Pitch

Three meters — Lamp, Hearth, Tower — drain every night and never refill on their own.
The only way to top them up is to go down among the rocks and pull things out of the
surf one at a time, knowing that the third wave to reach you costs you everything
you're carrying. The shore's contents are fully visible, so every "one more" is an
arithmetic decision a child can actually do out loud, and the tools you build between
nights change what's out there — the risk is something you author, not something
rolled at you.

## 3. Core loops

Three nested loops.

**A. Inside a night — the search (2-6 decisions, ~20s)**

1. Player taps SEARCH; one token is pulled from the shore and revealed.
2. A resource goes into the basket; a Wave marks one of three strikes.
3. Player reads what's left on the shore (always inspectable) and chooses: search
   again, or GO HOME with the basket.
4. Third Wave ends the night with an empty basket.

**B. At dawn — the allocation (1-3 decisions, ~10s)**

1. The basket is shown, sorted by resource.
2. Each resource either pours into its meter or is kept for the workshop — never both.
3. Player builds a tool if they can afford one, permanently changing the shore.

**C. Across the season — the squeeze (12 nights)**

1. Nightly drain rises at nights 5 and 9.
2. The storm adds a Wave to the shore after nights 3, 6 and 9.
3. So the shore gets more dangerous on a fixed schedule and the meters get hungrier;
   a player who only ever banks safely treads water and then drowns.

## 4. Core mechanics

| Mechanic | Description | Input |
|---|---|---|
| **Search the shore** | Push-your-luck draw from a known, finite, shuffled bag. Resource tokens fill the basket; the third Wave empties it and ends the night. Remaining contents are always visible. | Tap SEARCH / tap GO HOME |
| **Three separate meters** | Lamp, Hearth and Tower drain independently and are each refilled by exactly one resource. A great haul of driftwood is worthless on the night the lamp is dying — the meter closest to zero sets your risk appetite, not the odds. | — (read-only display) |
| **Pour or build** | Banked resources go into meters *or* into a tool, never both. Survive tonight, or survive later. | Tap a resource stack to route it |
| **Tools rewrite the shore** | Each tool permanently adds a stronger token to the shore or removes a Wave from it. This is the only lever the player has over probability. | Tap a tool in the workshop |

## 5. Constraints

- Portrait 480×854, one screen, thumb-reachable — every interaction is a single tap.
- No timing, no reflexes, no hidden information. The shore's exact contents are
  inspectable at all times; the only unknown is draw order.
- Small numbers only. Nothing in the UI should exceed two digits, so the odds stay
  countable in your head.
- No external assets, no build step, no audio required for the prototype.

## 6. Win / lose conditions

- **Win:** survive all 12 nights — night 12 resolves with all three meters above zero.
- **Lose:** any meter hits 0 at dusk. There is no partial loss and no score.
- **Session end:** a run is 12 nights, roughly 5-8 minutes.

Survival, not accumulation, is deliberately the win condition: it puts a real stake on
every push, and it means a surplus is only ever worth something if you spend it.

## 7. Controls

| Action | Input (keyboard/mouse) | Input (touch) |
|---|---|---|
| Search the shore | Click SEARCH | Tap SEARCH |
| Go home / bank the basket | Click GO HOME | Tap GO HOME |
| Inspect what's left on the shore | Click the shore panel | Tap the shore panel |
| Route a resource (meter vs. workshop) | Click the resource stack | Tap the resource stack |
| Build a tool | Click the tool card | Tap the tool card |

## 8. Numbers

Starting values, to be tuned against playtests.

**Meters** — start at 8, cap at 12. Overflow is lost, which is itself pressure to build.

| Nights | Drain per meter, per night |
|---|---|
| 1-4 | 1 |
| 5-8 | 2 |
| 9-12 | 3 |

Total drain per meter across a season is 24 against a starting stock of 8, so a run
needs roughly 48 resources gathered in 12 nights — more than a cautious player pulls
out of the starting shore.

**The shore** — starts at 9 tokens, reshuffled whole every night.

| Token | Count | Effect |
|---|---|---|
| Oil flask | 2 | Lamp +1 |
| Driftwood | 2 | Hearth +1 |
| Plank | 2 | Tower +1 |
| Wave | 3 | strike; the third empties the basket and ends the night |

The storm adds one Wave after nights 3, 6 and 9.

**Tools** — a fixed shop, each buildable once per run.

| Tool | Cost | Effect on the shore |
|---|---|---|
| Gaff hook | 3 driftwood | add a *Driftwood ×2* token |
| Tide net | 3 planks | add a *Plank ×2* token |
| Copper funnel | 3 oil | add an *Oil ×2* token |
| Lantern pole | 2 oil + 2 driftwood | add an *Oil* token |
| Storm wall | 6 planks | remove a Wave |
| Breakwater | 4 oil + 4 driftwood | remove a Wave |

## 9. Scope — MVP vs. cut

**MVP (must have to test if the core loop is fun):**
- Three meters, dusk drain, lose-on-zero, win at night 12.
- The shore: draw, bank, three-strike bust, always-visible remaining contents.
- Dawn allocation: pour into meters or keep for the workshop.
- The six tools above and the scheduled Wave additions.
- A recap screen naming the night you died and the meter that killed you.

**Nice to have (only after MVP works):**
- **Choose your stretch of shore** — pick east rocks / deep pool / the wreck each
  night to weight the shore toward one resource at the cost of an extra Wave. This is
  the first expansion if the game feels too fatalistic, and it directly answers
  "I'm dying of thirst holding firewood." Left out of MVP because it roughly doubles
  the decision surface and the game is complete without it.
- Storm-intensity flavour text per night.
- A softer bust (keep half, rounded down) as a difficulty option for younger players.

**Explicitly out of scope:**
- Any action, timing or dexterity input.
- Persistent meta-progression between runs. Each run starts from the same shore.
- Narrative branching, characters, dialogue.

## 10. Art & audio style

- **Visual style:** flat shapes and big legible numerals; a dark storm palette with
  the lamp as the only warm colour on screen. The three meters are vertical bars, the
  shore is a row of face-down tokens that flip as they're drawn and stay face-up until
  the night ends.
- **Reference games:** Quacks of Quedlinburg (bag-building push-your-luck — the direct
  ancestor); Incan Gold and Deep Sea Adventure for the press-or-retreat beat; Reigns
  for the "few meters, one tap" mobile shape.
- **Audio:** none for the prototype.

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
  tool costs and effects — belong in a pure `src/core/` module with no Phaser imports,
  so a test can play whole seasons headlessly. Follow `games/bibou/` for the layout and
  test harness.
- **Key technical risks:** none technically; the risk is entirely in tuning. The
  starting numbers above are a first guess, and whether the run is winnable-but-tense
  can only be settled by simulating a few thousand seasons under simple policies
  ("always bank at 2 waves", "always push to 3") and then by playing it.
