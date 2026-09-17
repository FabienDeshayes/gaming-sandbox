# Nouxinha — three proposals, measured

> **This is not a living design doc.** `DESIGN.md` describes the game as it is; this describes three
> things it isn't, and whether they are worth building. It was written against the code and the
> numbers at the commit it landed on. Once something here is built or rejected for good, fold the
> outcome into `DESIGN.md` and delete the section — don't leave it here as history.

Three questions were asked: **firecamps** as save points, **teleporters** as a way out of re-walking,
and a **wayfinding layer** between the compass and the signposts. The short answers are no, no, and
the layer already exists but the player can't see it. The long answers are below, and the numbers
they rest on are in §1.

---

## 1. What the walk actually costs

Everything in this section was measured by walking the real world — BFS over `canEnter`, three worlds
per biome, twelve worlds for the spoke table — rather than reasoned from `balance.js`. A *ring* is
the Chebyshev distance a plan places something at; a *step* is what the player pays.

### 1.1 The chain, on a route the player already knows

| Expedition | temperate | frozen | desert | mystic | tank |
|---|---|---|---|---|---|
| hut → gem 1 → hut | 65 | 53 | 48 | 51 | 200 |
| hut → chest 1 → gem 2 → hut | 151 | 113 | 127 | 126 | 250 |
| hut → chest 2 → gem 3 → hut | 247 | 199 | 228 | 200 | 300 |
| hut → chest 3 → hall (one way) | 190 | 142 | 142 | 155 | 350 |
| **whole cycle, perfect knowledge** | **654** | **507** | **545** | **532** | — |

The worst case is the third expedition in a temperate world at 82% of a tank — and that is *before*
the ground pays anything back. Simulating a greedy walker that detours to water it can see, the same
trip comes home with 242 of 300 still in the tank. **Water is not what makes the chain hard.** Search
is. A player who does not know where the gem is walks two to four times these numbers, and that is
the whole of the difficulty.

### 1.2 Half of every expedition is the walk home

| Biome | outbound | return | return share |
|---|---|---|---|
| temperate | 106 | 104 | 49% |
| frozen | 81 | 80 | 50% |
| desert | 86 | 85 | 50% |
| mystic | 87 | 82 | 48% |

This is structural, not incidental: every sanctum is a ring around the hut, so every expedition is a
radius out and the same radius back. The drag is real and it is exactly half the game.

What makes it worse than half: **the world only respawns at the hut** (`respawn` is called in one
place, `rules.js:1033`, when `atBase`). The return leg is therefore walked over ground this same
expedition already stripped. Simulating a small-torch run that retraces its own corridor exactly, the
return leg yields **5-28%** of the water the outbound leg did. A run that takes a different line home
finds fresh ground and recovers most of it — but the runs that most need water are precisely the runs
that dare not stray from the known line.

**So the game's tension and its tedium are the same axis pointing opposite ways.** The tenser the
walk home, the more exactly you must retrace it, and the more exactly you retrace it the less there
is on it. That is the actual defect behind "it's a drag to go back to the hut", and it is worth
fixing — but it is a *texture* problem, not a *distance* problem, and the two want different fixes.

### 1.3 The hut is already optional

Two things I expected to be true and aren't:

- **The water ceiling rises when you pick a gem up, not when you bank it** (`rules.js:861`,
  `tankCeiling`). You do not have to go home to get the bigger tank.
- **A mid-run gem upgrades the ground in place** (`upgraded(settled, state.gems)` in `itemOnTile`) —
  gem 2 turns the medium torches already lying about into beacons without a respawn.

So a route-perfect player can already chain all 654 steps in a single expedition. What the hut still
buys is the tank refill, the banking, and the respawn that puts items back on ground already picked
clean. **The trips home are the player's own risk management, not a wall the game built.** Any
proposal here is therefore removing a decision the player is making — which is a much higher bar than
removing a chore.

---

## 2. Firecamps

> *Could adding fire camps as save points be a good idea? Going to the fire camp would give back some
> water and refresh resources in the world.*

**Verdict: yes to the camp, no to the save point.** The proposal bundles three things — bank, refill,
respawn — and they have opposite consequences. Two are good and one takes the game apart.

### 2.1 Banking at a camp deletes the only risk the game has

`DESIGN.md` §6.1 is built on one sentence: *the hut is the only place a run is banked, and reaching
it is what banks it.* Everything downstream is an expression of that. Water is a leash because
running dry loses the walk. The death bag exists because there is something to drop. The
banked-versus-carried split in the purse exists. The hut's question has two answers only because
arriving already settled the risk.

A camp that banks makes all of it decorative. Water stops being a leash and becomes a speed bump
between camps; the bag becomes a minor inconvenience; the gem you are carrying stops being the thing
you might lose. The game would still work — checkpoint exploration is a fine genre — but it would be
a different game, and every number in `balance.js` was tuned against the other one.

Worth being concrete about what is lost, because "tension" is easy to wave at: the single best moment
this design produces is walking the third gem home at 40 water with a spent beacon, over a corridor
you stripped on the way out. A camp two-thirds of the way back deletes that moment specifically.

### 2.2 The respawn is the part that actually breaks

This is the concrete flaw, and it's worth stating in code terms. `respawn(state)` bumps the epoch,
moves the salt, and **clears `state.collected`**. Every item tile in the world is full again.

The hut gets away with this because arriving at the hut also fills your tank — there is nothing to
farm, because you are already full and standing on the safest tile in the game. A respawn point at
ring 80 has no such protection. Stand next to it, trigger a respawn, harvest the radius your light
reaches, trigger another. **A respawn point out in the world is an unlimited water pump**, and water
is the only failure condition the game has. This is not a tuning risk; it is a hole straight through
the bottom of the design.

### 2.3 The refill part already exists, twice

The `LANDMARK_GIFTS` table already ships the firecamp's good half:

- **The Drowned Bell** gives `water: Infinity` — a full tank, at ring 28-36, on sanctum 2's bearing.
- **The Lantern Tree** gives `relight: true` — your equipped light back to full, at ring 48-57, on
  sanctum 3's bearing.
- **The Weighhouse** gives `stock: ['water-drop', 'torch-small']`.

And gifts land **on every fresh touch**, so a return visit pays again. The Drowned Bell *is* a
firecamp. It just isn't called one, there is one of it, and it sits at a fixed ring on a fixed spoke.

So the mechanic the proposal wants is built, tested, and shipping. What is missing is **density** —
seven landmarks, three of which give anything resembling supply, spread over a 200-tile world.

### 2.4 What to build instead: give the wisps something to give

There are already ten objects per world that are placed exactly where firecamps would want to be:

- `WISP_PLAN` puts them on rings 6, 15, 24, 34, 44, 55, 66, 78, 92, 106 — a ladder all the way out.
- They are **on the map from the first reveal of a fresh run**, before you have been anywhere near
  them. A player already knows where all ten are.
- Each lights its own clearing unconditionally, so a blacked-out run can already aim for one.
- `touchWisp` hands back **nothing**. It is the one placed thing in the world with no payload.
- The fiction is already exactly right: *"the small ones are still lying about, burning, too small to
  pick up."* A wisp is sun-dust. Sun-dust is what you would build a fire on.

Give a wisp a gift and you have firecamps for almost nothing: no new terrain kind, no new placement
pass, no new save field, no new sprite, no `pickSeed` work (wisps are placed rather than forced, so
they can't fail a seed). `wisps` is already banked and dropped with the world on the signposts'
terms, so a "camps used this expedition" set is a natural sibling.

**The shape I'd build:**

| | |
|---|---|
| **Gives** | A full tank and a relit torch — the Bell's gift and the Lantern Tree's, together |
| **Respawns** | The world, **once per camp per expedition**, then that camp is spent until the hut |
| **Banks** | Nothing. Ever. |

The once-per-expedition rule is what closes §2.2: a camp is a resupply, not a pump. Ten camps is ten
respawns a run, which is generous — tune it down, or restrict the respawn to the camps past some ring
so the near ones stay ordinary.

**The good part is counterintuitive: this makes the walk home *longer*, not shorter.** A camp at ring
92 does not shorten anything — it lets you go past 92 and still get back. Reach goes up, risk stays
exactly where it was, and the walk home gets more dangerous rather than less because you are further
out when you turn round. The drag it removes is the *pointless* half — going home to refresh the
ground — while leaving the half that carries the whole design.

It also gives the far half of the world a reason to exist. The furthest thing any plan places is a
coin chest at ring 104-118, and `EDGE_RADIUS` is 200 — so the outer **eighty tiles** of every world
hold nothing at all, and nothing currently makes the walk out to them survivable anyway.

### 2.5 If you do want banking out there, price it

A defensible version exists, but it is a bigger change than it looks: a camp that banks **and costs
the expedition**. Walk into it, it writes the walk down, and the run ends there — you wake at the hut
next expedition. That keeps "banking ends the risk" true, because the risk genuinely is over: you
stopped. It is `SAVE GAME` plus a deposit, out in the world, at the price of the rest of the walk.

I'd still not build it first. It competes with the hut's question (§4/§6.1), which is one of the
sharper pieces of this design, and it needs its own answer to "why would I ever walk home".

---

## 3. Teleporters

> *It would be hard to fit in the lore but would help in the exploration.*

**Verdict: no.** The lore objection is worse than "hard to fit" — it is a direct collision — and the
mechanical case is weaker than it looks.

### 3.1 The sorcerer's teleport is the game's most expensive act

`STORY.md` prices it explicitly:

> *"He takes them, and he moves you. The four worlds are four places in one realm, and the crossing is
> the whole of what he can spare: he can carry a person and nothing else, so your coins, your lights,
> your tools and the map of every tile you ever lit stay behind."*

and, in his own voice:

> *"It costs me everything I have spare. I can carry a person; I cannot carry their pockets. [...] I am
> sorriest about the ground."*

`turnCycle` is that sentence in code: the purse, both tools, the keys, the chests and the drawn ground
all go, and six things are carried across by hand. The cycle is the game's hardest rule and its best
emotional beat, and the *entire* weight of it rests on teleportation being the most expensive thing in
this world — so expensive that a centuries-old sorcerer holding the sun together can manage it four
times and can't bring your coins.

A network of hops you use to save a walk makes that a lie. Not a small inconsistency: it makes the
sorcerer's one great sacrifice look like something the country does for free, and it takes the sting
out of the ending. This is the rare case where the fiction is load-bearing on a mechanic rather than
decorating it.

### 3.2 It also solves the wrong leg

Teleporters would necessarily link places you have already been. But §1.1 showed that the campaign is
not distance-limited, it is **search**-limited: the expensive leg is the outbound one into ground you
have never lit, and a teleporter cannot help with that by definition. It shortens the leg that is
already safe, already mapped, and already the one the player has water for.

And the tools that cover this are already in: the compass points home when nothing is in range
(explicitly "the thing you want at three in the morning with no light left"), the map persists across
runs, and explored ground is never re-blacked. The return leg's *navigation* is solved. Its
*texture* is what isn't, and a teleporter doesn't improve texture, it skips it — which is a
confession that half the game isn't worth playing rather than a fix for it.

### 3.3 The lore-true version of the idea is a firecamp

Note what kind of magic the sorcerer actually has:

> *"There is a kind of magic that is very old and little used, because all it does is hold. It makes
> nothing and undoes nothing: it catches a thing in the moment it is, and keeps it there."*

Holding magic. Not travel magic. A thing that keeps you where you are, that catches a moment and
keeps it — that is a save point and a campfire, and it is not a teleporter. The fiction is pointing
at §2.4 and away from this section.

### 3.4 The one version I'd consider

If you want the effect anyway, take **one-way and once**: walk into a camp and the sorcerer pulls you
home — the same crossing he does at the cycle, at the same price, in miniature. It banks normally
(you arrived at the hut, after all) and it costs you your pockets: you arrive with your lights spent
and your purse where it was. That is consistent — it is the *same* act, priced the *same* way — and it
is a bail-out rather than a network, so it never shortens an outbound walk or competes with the map.

It is still third on my list behind §2.4 and §4, because it is the only one of the three that needs
new fiction to be written rather than existing fiction to be honoured.

---

## 4. Wayfinding — the layer is built, the player just can't see it

> *Something not as strong as the compass but more helpful towards the gems and Nouxinha than the
> signposts.*

**This is the most valuable finding in the document: that layer already exists, end to end, and
nothing in the game tells the player it's there.**

### 4.1 The spokes

`LANDMARK_PLAN` gives four of the seven a `heading` that is a *sanctum index*. Measured over twelve
worlds:

| Landmark | its ring | leads to | that ring | off bearing | rest of the walk | you are |
|---|---|---|---|---|---|---|
| The Mint | 14 | sanctum 1 | 20 | 3° (max 12°) | 9 of 26 steps | **66% there** |
| The Drowned Bell | 32 | sanctum 2 | 45 | 2° (max 4°) | 18 of 63 steps | **72% there** |
| The Lantern Tree | 53 | sanctum 3 | 80 | 4° (max 5°) | 37 of 105 steps | **65% there** |
| The Gnomon | 69 | **the hall** | 110 | 3° (max 6°) | 60 of 151 steps | **61% there** |

Within three degrees, every world, every biome. And each of those four has **two signposts** naming
it — one nearer than it, one further out (`SIGNPOST_PLAN`).

So the complete chain **hut → signpost → landmark → sanctum** is shipping today for all four
sanctums, the hall included. A post reading `THE GNOMON — SOUTH-WEST — A LONG WALK` is telling you
where Nouxinha is. It is a working wayfinding layer, strictly weaker than the compass (a bearing and
a band, not a needle), strictly stronger than what the posts appear to say — which is exactly the
thing that was asked for.

The player has no way to know any of it. The posts name monuments; the monuments pay a gift and a
standing; nothing anywhere connects either to a gate. It is a designer's secret.

### 4.2 The fiction has already written the fix

> *"Seven things I carry with me wherever I put you down: the press, the arches, the bell, the
> balance, the tree, the tower, the dial. **I cannot hold a country in my head without something to
> measure from. They are pins.** [...] I cut names into posts so you would find them."*

and

> *"I built you a road and I have let you call it a world. The walls are mine, and the gates, and the
> order they open in, which is the order that keeps you alive."*

He built the road, he built the gates, he set the pins to measure from, and he cut the posts himself.
Of course his pins line up with his gates. He would say so — the only reason he hasn't is that nobody
wrote the line.

### 4.3 Suggestions, ranked

**1. Say it on the post.** (Cheapest; no new entity; no new sprite.)

A post naming a spoke landmark gets one more line for the gate behind it:

```
THE GNOMON — SOUTH-WEST — A LONG WALK
AND HIS OWN DOOR BEYOND IT
```

Gate it on progress so it doesn't hand over the chain's order at ring 5: show the line only once the
campaign holds the key that gate wants, or has laid eyes on the gate. It stays a pure function of
where the post stands, computed at read time in `signpostReadings` like everything else there, and it
stores nothing. The three gap landmarks and the world's own eighth say nothing extra, which is itself
information — and it should stay *positive* framing ("this one has a door behind it") rather than
negative, or players will start skipping the gap landmarks and lose the standings.

**2. Let the spoke landmarks draw the road.** (Reuses machinery that exists.)

`LANDMARK_GIFTS` already has a `corridor` gift — the Aqueduct's, "the ground under the arches, a long
way further out than you are standing and a short way back the way you came". Give the four spoke
landmarks a corridor along **their own bearing, outward**. Standing at the Lantern Tree then literally
draws the road to sanctum 3 on your map.

This is the strongest of the four in play, because it pays the player for having walked somewhere
rather than for having read something, and it turns the landmark from a waystation into an
instrument. It also stacks with the Watchtower's `reveal: 16` without duplicating it: a reveal is a
clearing, a corridor is a direction.

**3. A weaker second needle, banded rather than pointed.**

If you want a new tool: something that names **gates only**, in the signposts' own vocabulary —
`A GATE — SOUTH-WEST — FAR` — with no range limit and no icon. It is deliberately worse than the
compass (a band, not a needle; one category, not five) and better than a post (it tracks the thing
you actually want). It slots between them exactly as asked.

I'd hold this behind 1 and 2: it is a new entity where those are new *lines*, and `COMPASS_RANGE`'s
own comment already explains what happens when the game hands the player a needle to follow — the
posts have nothing left to do. Another needle, even a blunt one, risks the same.

**4. Let a sanctum be visible from outside a torch.** (The "new entity" version, done as geography.)

A sanctum is a 9-to-15-tile ring of masonry with a piece of the sun inside it, and you cannot see it
until you are three tiles away. `litTiles` already unions in every wisp's own light unconditionally,
from anywhere in the world — so the machinery for "a thing in the world that lights itself at range"
is built and tested. A sanctum still holding its gem could carry a faint glow above its wall,
readable as *something is over there* long before a beacon would show it.

This is my favourite of the four as a *feel* change — it makes the far dark legible without telling
anyone anything — but it is the one most likely to disturb tuning, since it changes what a walk can
see. Worth a `distances.html` pass before committing to it.

---

## 5. What I would do

1. **Wisps become camps** (§2.4) — water, relight, one respawn each per expedition, no banking. Most
   reach gained per line of code, uses a structure that is already placed and already mapped, and the
   fiction is already written.
2. **Posts name the gate behind a spoke landmark** (§4.3.1) — a handful of lines in
   `signpostReadings`, and it turns a shipped-but-invisible system into the wayfinding layer that was
   asked for.
3. **Spoke landmarks draw their corridor** (§4.3.2) — reuses the Aqueduct's gift on four more places.

Not: banking at camps (§2.1), respawning without a limit (§2.2), or teleporters (§3).

And the thing to keep in view while building any of it — §1.2 — is that the walk home is boring in
exact proportion to how tense it is. Anything that makes the return leg *shorter* is aimed at the
wrong target. The thing worth changing is what is on it.
