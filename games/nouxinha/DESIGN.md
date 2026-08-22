# Nouxinha

> Grid exploration game about walking into the dark on a limited supply of light.

> See [`TESTING.md`](./TESTING.md) for how to run the suite and how to write a test against an
> infinite procedural world.

> **Doc convention:** this doc describes the game *as it is now*. When something changes, edit the
> relevant sections in place — don't leave "superseded"/"previously"/"was X, now Y" notes. Git history
> is the changelog; this doc is the current source of truth.

## 1. One-liner

A tile-by-tile exploration game where the only thing you can really spend is light: every step burns your torch, and the dark you haven't lit is the only place worth going.

## 2. Pitch

You step out of your base onto an endless dark grid with a small torch that shows one tile in every direction and lasts 100 steps. Everything you find — brighter torches, stranger torches, coins — is out there in the dark, and the further you push the better it gets. The tension is that light is fuel: a torch that shows you more burns out faster, so every upgrade is also a shorter leash.

Somewhere out there are three gems, and each one gives the world back a colour it lost. Finding one is not the hard part — carrying it home is, because the hut is the only place a run is ever written down. Twenty tiles out there is also a merchant, who will sell you a compass for fifty coins and a map for a hundred, on the same terms as everything else: only yours once you've walked it back.

## 3. Core loops

**Moment to moment (10-30s):**

1. Player reads the lit ring around the character and the dimmed memory of everywhere they've already been
2. Player picks a direction and steps — swipe, or tap the D-pad
3. The step costs 1 durability off the active light, and reveals whatever the light's shape covers from the new tile
4. Something appears at the edge of the light (an item, a rock wall, an opening) → player adjusts course and repeats

**Expedition (a few minutes):**

1. Leave the base with the light you have
2. Spend durability pushing outward; pick up torches and coins
3. Swap to a better light when it's worth the faster burn — or hoard it as a spare
4. Torches run out one after another; walk home across remembered ground before you're walking blind

**Campaign (several runs):**

1. Find the first sanctum and take the gem at its centre — the world gains a colour, and everything lying around it is put back as something better
2. That better water carries you further, which is what makes the next sanctum survivable at all
3. Its gate wants the gem you're carrying, so the ground beyond it opens for the first time
4. Walk home and stop at the hut to write it down. Die on the way and the gem goes back where it came from
5. Coins from all of it buy a compass and eventually a map, which is what turns a walk into an expedition you can plan

## 4. Core mechanics

The world has three things in it: **terrain** (floor, two formations of rock, groves of trees, and the built walls and gates of the sanctums — all static and procedurally generated), **items** (lights, water, coins and gems, lying on floor tiles until picked up), and **the character** (one tile, one facing).

| Mechanic | Description | Input |
|---|---|---|
| Tile stepping | The character moves exactly one tile per input, in a cardinal direction. Rock, trees and sanctum wall are impassable, and so is a gate you don't hold the gem for: a rejected step costs no durability and doesn't change facing. The character's **facing** is the direction of their last successful step (it starts pointing north from the base). | Swipe in a cardinal direction anywhere on the map, or tap the D-pad |
| Gems and gates | Three gems sit at the centres of walled **sanctums** scattered around the hut. Picking one up gives a colour back to the world and opens the gate that wants it (§4.4). | Walk onto the gem |
| Saving | A run is only banked by stopping at the hut (§6). Dying of thirst or leaving by the map's **X** banks nothing, so a gem picked up but not carried home is still out there next run — though the ground the run lit is kept whichever way it ends (§6.1). | **STOP HERE** on the hut's dialog |
| Light & visibility | The active light source defines a **shape** of tiles visible from the character's tile (see §4.1). Every tile has one of three states: **unknown** (never lit — drawn as flat background, indistinguishable from any other unknown tile), **remembered** (lit at some point — drawn dimmed), **lit** (inside the current light shape — drawn full brightness). Items and terrain are only readable in the lit state; a remembered tile keeps showing whatever was there when you last saw it. | — |
| Durability | Each successful step costs **1 durability** off the *active* light only. Rejected steps (into rock) cost nothing. Carried-but-inactive lights never burn. At 0 the light is spent and removed from the inventory, and the next light in inventory order auto-equips. With no lights left the character is in **blackout**: the light shape shrinks to the character's own tile, and memory shrinks with it — a remembered tile more than one step away stops being drawn until it's lit again, so the screen is the character's own tile plus a small ring of fog of war. Blackout is not death — the character can still feel their way home a step at a time — but it is the moment the walk actually gets dangerous. | — |
| Water | Every successful step also costs **1 water**, independent of the light and never affected by blackout. Water starts at **200** and each gem held raises that ceiling by **50**, to 350 with all three. A water pickup refills by its own amount (§4.2), capped at the ceiling. Unlike light, water has no auto-swap or backup: hitting **0** is the run's one hard failure state — the run ends and everything carried is lost (§6). The balance numbers are named constants at the top of `src/core/rules.js` (`STARTING_WATER`, `WATER_PER_STEP`, `WATER_PER_GEM`) so they can be retuned without touching the mechanic itself. | — |
| Pickup | Stepping onto a tile holding an item picks it up automatically, with a short rising blip — or, for a gem, a fanfare (§9). Lights go into the inventory unequipped; coins, water and gems apply immediately (coin counter, water level, colour restored) rather than sitting in the inventory. An item needing more gems than you hold isn't there to pick up at all (§4.3). | — |
| Coming home | Stepping onto the base asks whether to stop: **KEEP GOING** tops water back up to the ceiling and the expedition continues, **STOP HERE** ends the run on a recap (§6) and returns to the title screen. It asks rather than assumes because the hut is also just a landmark to cross on the way somewhere else — but the hut is a base, not just a save point, so pushing out again always starts from a full tank. Arriving still costs a step and burns durability like any other. | Tap a button on the dialog |
| The merchant | One stall, 20-25 tiles from the hut and always in the same place for a seed. Selling lights, water, a **compass** and a **map** for coins — the only thing coins are for (§4.5). | Walk onto the stall |
| Compass & map | Two tools, each bought once or found lying in the dark. The compass points at whatever unique object is worth walking to next; the map draws everywhere you have walked (§4.6). | Owned, not carried — neither takes an inventory slot |
| Respawning | Everything lying on the ground goes back, in **new places**, whenever the world respawns: on picking up a gem, and on walking back onto the hut. Unique objects — gems, the merchant, the compass and map lying out there — never move (§4.3). | — |
| Fixed camera | **The character never moves on screen — the world moves around them.** The character sprite is pinned to the exact centre of the map viewport and every step scrolls the world one tile in the opposite direction. This is the first thing to reconsider if the game feels static: the alternative is a camera that only scrolls when the character nears the viewport edge, which reads as more grounded but hides how much dark is on each side. | — |

### 4.1 Light sources

A light shape is defined relative to the character's tile, and — for the lamp — relative to their facing. Rock does **not** occlude light in the MVP: the shape is applied literally, so you can light the far side of a wall. Line-of-sight occlusion is a nice-to-have (§8).

| Light | Shape | Durability | Notes |
|---|---|---|---|
| Small torch | Radius 1 — the 3×3 block centred on the character | 100 | The starting light, and the only item in the inventory at the start of a run |
| Medium torch | Radius 2 — the 5×5 block centred on the character | 50 | Twice the reach, half the leash |
| Lamp torch | A cone in the facing direction: 1 tile ahead → 3 wide, 2 ahead → 5 wide, 3 ahead → 7 wide, 4 ahead → 9 wide, plus the character's own tile. Nothing behind or beside. | 60 | Reaches furthest of the three but only forward — turning re-aims it, so it rewards committing to a direction |
| Beacon | Radius 3 — the 7×7 block centred on the character | 140 | Needs **2 gems** to be visible. The one light that breaks the "more reach, shorter leash" trade, because it exists to make the walk to the third sanctum possible at all |

Only one light is active at a time. Equipping is manual (via the item card, §7) except for the auto-swap on burnout.

### 4.2 Items that aren't light

Water items differ only in how much they give back — the point of the better ones is range, since the sanctums sit further out than a starting run can reach (§4.4). The `Gems needed` column is the gem that brings an item into the world; each one also retires the item it replaces (§4.3).

The compass and the map are **tools** rather than items: one of each exists, neither is consumed, and neither takes an inventory slot. They live in the top-right corner of the map instead (§7).

| Item | Gems needed | Effect |
|---|---|---|
| Coins | — | What the merchant takes (§4.5). A pickup is a small pile worth 1-5, because the separation rule (§4.3) caps how many piles the world can hold. The HUD's counter shows the whole **purse** — banked plus carried — because that is the number the merchant spends; what this expedition found on its own is a separate line in the recap. |
| Water drop | — | Refills water by 20 (§4). Running dry is the run's one death condition — this is the thing worth detouring for. |
| Water flask | 1 | Refills water by 60. Three drops in one. |
| Spring vial | 3 | Refills water to the ceiling, wherever you are. |
| Gem | — | One per sanctum, three in all. Gives a colour back to the world and opens the gate that wants it (§4.4). |
| Compass | — | Points at the next unique object worth walking to (§4.6). Bought for 50 or found. |
| Map | — | Draws everywhere the campaign has walked, all at once (§4.6). Bought for 100 or found. |

### 4.3 The world

Effectively infinite and **procedurally generated from a seed**, in three layers that differ in what
they depend on. Nothing about the world is ever stored — a run remembers only which tiles it has
*seen*. There is no world edge.

| Layer | Depends on | Holds |
|---|---|---|
| **Terrain** | `(x, y, seed)` | Floor, rock in two formations, groves of trees, and the built walls, gates and clearings. The same every run, forever. |
| **Unique objects** | `(x, y, seed)` | The three gems, the merchant, and one compass and one map lying out in the dark. Also the same every run — walk back next time and they are where you left them. |
| **Consumables** | `(x, y, seed, salt)` | Coins, water and lights. The salt changes every run and every respawn, so these are never twice in the same places. |

- The **base** sits at `(0, 0)` and is where every run starts. Its 3×3 neighbourhood is forced to
  floor so you can never be walled in at spawn. It renders as a hut with a flag so it's recognisable
  from the edge of your light, and it's the one tile that's always on the map. The hut isn't drawn
  while the wizard is standing on it — two dense sprites on one tile read as an unidentifiable blob,
  so the wizard is simply in the doorway.
- **The seed is validated at run start.** A clearing at spawn isn't enough: at any density of blocked
  ground that still looks like a cave system, a slice of seeds seals the base into a pocket of a few
  tiles, which would break the promise that the character is never permanently stuck (§5). So a run
  flood-fills a 40-tile window from the base and rejects a seed that can't reach most of the floor in
  it, bumping to the next seed until one opens up. Rock and trees together block a bit over a quarter
  of the world, and about one seed in eight needs a bump — a bump is cheap and one is always enough,
  which is the whole reason the check exists rather than a guarantee baked into the noise. The same fill checks that every sanctum door and every
  landmark can be walked to. Carving guaranteed corridors into the noise would be the alternative,
  and it leaves a visible lattice; this keeps the terrain organic and costs a few milliseconds once
  per run.
- **Rock covers about a fifth of the world**, from one noise channel with two octaves — broad masses
  from a coarse lattice, ragged edges from a fine one. It reads as floor with rock in it rather than
  the other way round: enough to grow caves worth navigating, not enough to make walking a maze.
- **Rock arrives in two formations that draw from the same tiles.** The masses above are one; the
  other is **loose boulders**, thrown as white noise into the open ground between them rather than
  grown on a lattice, because what makes them the other kind of rock is precisely that they stand
  alone instead of massing. Same terrain, same handful of tiles (§9), and a player meets them as two
  different things: a wall to walk round, or a stone to step past. The boulders are there because a wide stretch of clear floor
  was reading as an empty screen.
- **Trees cover about a fifteenth**, in groves, and they block a step exactly the way rock does. They
  grow on a lattice of their own, coarser than the rock masses, so a grove arrives as a stand you
  skirt rather than as scattered trunks, and where the trees are owes nothing to where the rock is.
  They are drawn as foliage rather than as stone (§9) — a blocked step that looks like something
  *grew* there is the cheapest variety the world has, and every tree is floor the player lost, which
  is why the share is small.

**Consumables are spread, never clumped.** Every kind is thrown onto a lattice and then thinned so
that **no two of the same kind ever land within 8 tiles of each other**. That rule is the whole
design of this layer, and it has a price worth being honest about: a kind can never be denser than
one instance per 8×8, so the world holds a fraction of the items an unthinned scatter would,
evenly, instead of several times as many in bunches. `MIN_SEPARATION` in `src/core/world.js` is the
single number that trades one against the other, and the measured curve is written down next to it.

**8 is where that trade sits, and it is a dial rather than a law.** Wider separations were tried and
made the walk too thin: at 15 a light's worth of ground was usually empty, and at 10 — roughly one
floor tile in 44 — a playtest still spent long stretches with nothing on screen at all, because a
light shows nine tiles and a screenful is 165. An expedition that finds nothing on the way out has no
reason to push further. At 8 something is under one floor tile in 35, about a quarter more, which
keeps a walk paying without turning the ground into a shop. 8 is still wider than any light in the
game, so a lit ring can never show the same kind twice. What it gives up is the outright guarantee
that a screenful holds one of anything: the 11×15 viewport can hold up to four of a kind, which reads
as a good patch of ground rather than a clump. Two consequences fall out:

- **A coin pickup is a small pile worth 1-5**, because one coin per 100 tiles could never pay for a
  100-coin map.
- **Sanctum clearings are the exception.** A clearing is a hoard somebody left there, so it keeps its
  dense cache — capped at two of any one kind, so it reads as a cache and not a pile (§4.4).

**A gem upgrades the world rather than adding to it.** Item quality still scales with distance from
the base — coins and water near home, the bigger torches only further out — and on top of that each
gem swaps one kind out for one kind in: the first retires the water drop for the flask, the second
the medium torch for the beacon, the third the flask for the spring vial. The lattice offers up the
same tiles either way, so **the map holds the same number of items after a gem as before**; what
changed is what they are. The swaps are one-for-one on purpose — retire two kinds for one and the
survivors crowd each other against the separation rule, and the world ends up emptier the further you
get, which is backwards. Walking ground you have already walked is worth it again because everything
on it is better, not because there is more of it.

**Everything on the ground comes back, somewhere new.** Two things respawn the consumable layer:
picking up a **gem**, and walking back onto the **hut**. Both relay the whole scatter — anything this
run had already emptied is back, and nothing is quite where it was. Nothing ever materialises under
the character's feet. This is what makes a hut round trip a way to gather rather than a wasted walk,
and it is why the map (§4.6) draws ground and never items: items would be a lie by the time they were
drawn. The unique layer doesn't move, so the gem you are walking towards is still where the compass
said it was.

- The base is where a run ends: walking onto it offers to stop, which banks the expedition and writes
  the save (§6). Choosing to keep going instead refills water to the ceiling before the expedition
  continues.
- **A world can be named.** The seed and the run's consumable salt are both plain numbers, so
  `?seed=1234&nonce=9` on the URL reproduces an expedition exactly — the same ground past the same
  coins. There is no UI for it: it is for sharing a world and for the test suite, not for playing.

### 4.4 Sanctums, gates and gems

The one built structure in an otherwise noise-grown world, and the spine of the campaign. There are **four sanctums**: a ring of masonry wall around a clearing of forced floor, with a gem at the centre and exactly one **gate** in the ring.

| Sanctum | Distance from the hut | Ring radius | Gate wants | Holds |
|---|---|---|---|---|
| 1 | 20 | 4 | nothing — the arch stands open | The first gem |
| 2 | 45 | 5 | 1 gem | The second gem |
| 3 | 80 | 6 | 2 gems | The third gem |
| 4 | 110 | 7 | 3 gems | No gem — the richest cache in the game, and what the third gem is *for* |

- **The chain is the pacing.** Sanctum 1's arch is open because the first gem has to be reachable carrying nothing; every gate after it wants the gem from the sanctum before it. Since each gem also raises the water ceiling by 50 and upgrades the water lying around the world (§4.3), the gem you just found is precisely what makes the next sanctum survivable — the distances above are past what a gemless run could walk home from.
- **Positions are derived from the seed, not authored.** Each sanctum takes a quarter of the compass with a jitter inside it, so the four always sit in different directions at different distances (a new seed relays all four, and no two are ever within 45° of each other). Distance is Chebyshev and exact, so a sanctum's ring lands on the number the HUD's furthest-out counter reports.
- **The gate always faces the hut**, on a wall *face* and never a corner — there are no diagonal steps, so a corner gate could never be walked through. The tile you approach from is therefore always orthogonally adjacent to the tile you walk into.
- **A sanctum's clearing is forced floor**, so once you are through the gate the gem is always reachable. That is what lets the seed check below worry only about the door.
- **The clearing is a hoard, and the hoard is fixed.** Each sanctum holds a named cache — coins, water and lights of its own tier — laid out **two of each**, ranked rather than rolled, so opening a gate always pays the same amount and a clearing can never turn into a pile of one thing. Unlike the open world it doesn't upgrade with your gems: what a sanctum holds is what it was built holding.
- **Reachability is guaranteed by placement, then by the seed.** Roughly one seed in ten drops a given sanctum where a rock blob seals its door into a pocket against its own wall. Rather than reroll the whole world for it, the sanctum is *turned* a few degrees around the hut until its door opens onto the cave system — measured with a bounded flood probe, which separates the two cases cleanly (a sealed door measures 6–22 tiles, a real one runs past the 80-tile limit). `pickSeed` then rejects any seed that still leaves a door sealed, which after placement is about 2 seeds in 120. Carving corridors to each gate was the alternative and was rejected twice over: it leaves the visible lattice §4.3 avoids, and a road pointing at each gem removes the search that makes finding one worth anything.

### 4.5 The merchant

One stall, 20-25 tiles from the hut, in the same place every run for a given seed — and deliberately
on the **far side of the hut from the first sanctum**, so an early expedition has two directions
worth walking rather than one. Its tile and the ring around it are forced floor, and `pickSeed`
checks it can be walked to from the hut with nothing in hand.

Stepping onto the stall opens the counter. It is the only thing coins are for.

| Stock | Price | Limit |
|---|---|---|
| Water drop | 5 | Unlimited |
| Small torch | 10 | Unlimited |
| Medium torch | 25 | Unlimited |
| Lamp torch | 40 | Unlimited |
| Compass | 50 | One, ever |
| Map | 100 | One, ever |

All six prices live in one table (`src/data/shop.js`) so retuning the economy never means reading the
shop's code.

- **The purse is everything you have ever banked plus what you are carrying**, and the merchant takes
  the banked half first. What is in your pocket is the half a bad walk home can still cost you, so it
  is the half worth keeping there.
- **A purchase is only real once the hut writes it down**, exactly like a gem. Die of thirst on the
  way back and you lose the compass — *and the coins come back with it*, because the run wrote
  nothing at all. That isn't a special case: the hut banks "what was already there plus what this run
  has", and a run that never reaches the hut never touches either number.
- Buying a light in blackout equips it immediately. Everything else about buying a light matches
  finding one: it arrives unequipped, in the inventory, at full durability.

### 4.6 The compass and the map

Two tools. Each exists exactly once — buy it from the merchant or find it lying in the dark, and
owning it takes it off the other. Neither is consumed, neither stacks, and neither takes an inventory
slot; they live in the top-right corner of the map viewport instead (§7). Like a gem, each is only
kept by walking it home.

The two lying in the world are placed like the merchant: seed-derived, forced-floor clearing,
reachability checked at run start. The compass sits past the second sanctum's distance and the map
past the third's, so finding either is a proper walk — which is what makes 50 and 100 coins a
shortcut rather than a tax.

**The compass** shows an arrow and the icon of what the arrow is pointing at, because "that way" on
its own is useless and "that way, and it's a gem" is a decision. The needle snaps to the four
directions its sprites can draw (§9) — enough to start walking, and the icon does the rest. It points at the nearest
**available** unique object: a gem whose gate this run can already open, a tool it doesn't own yet, or
the merchant while there is still a one-off on the shelf. It deliberately points at things the player
has *not* found — that is the whole value of it. When nothing qualifies it points at the hut, which
is also what it is for at three in the morning with no light left.

**The map** draws every tile this run has lit, at once, at one pixel a tile. It shows terrain and
nothing else: the ground you crossed, the rock and walls you skirted, markers for the hut and for the
unique objects you have actually laid eyes on, and a ring around where you are standing. Ground you
have never lit is not on it, because a map you didn't draw isn't a map. Items are absent on purpose —
they move every time the world respawns (§4.3), so a map of them would be out of date before it was
read.

**Walking persists whether or not you own the map** (§6.1). The explored set is saved with the slot
and handed back to the next run, so an expedition opens with every tile the campaign has ever lit
already drawn and pushes on from the edge of the dark rather than from the doorstep. What the map
adds is the *view*: seeing all of that at once instead of nine tiles at a time. What persists is
cartography, not progress — where the ground is, never where you were standing, how much water you
had, or what you were carrying. It is tied to the seed that drew it, so a world that ever changed
underneath it discards the drawing rather than showing one from somewhere else.

## 5. Constraints

- One light active at a time. Light and water are the two consumables — no food yet (§12), no timer.
- The character can never be permanently stuck: blackout still allows movement, the base's neighbourhood is always walkable, and no gate ever seals a run *in* — gates only ever hold ground back, never fence it off.
- Water is the one thing that can actually end a run: it depletes every step regardless of light state, and hitting zero is fatal (§6).
- **Two colours, plus one per gem recovered.** The world starts strictly duo-chromatic and can reach five colours only by earning them (§9). Every sprite is a 1-bit tile baked white, so what a gem changes is a tint at draw time, never an asset.
- Every gem is optional. Nothing in the game requires finding one; the sanctums gate their own contents and nothing else. The compass and the map are optional too — they make the walk legible, never possible.
- **No two of the same consumable within 8 tiles.** The world spreads items rather than scattering them, which caps how much there is to find (§4.3). One constant decides the trade.
- Portrait, mobile-first, touch as the primary input. 480×854 fixed canvas.
- Turn-based: the world only advances when the player steps. No real-time pressure.
- No build tooling: Phaser 3 from a CDN `<script>` tag, game code as plain ES modules.
- One art asset — the tile sheet every sprite is cut from — and no audio files: every sound and both loops are synthesised (§9).

## 6. Win / lose conditions

- **Win:** bringing all three colours home. It is a destination rather than an ending — the world is still there afterwards, with the fourth sanctum's cache open and nothing left to unlock.
- **Lose:** running out of water. It depletes independently of light and never auto-refills — only a water pickup does that — so hitting 0 ends the run on the spot and everything carried is lost — gems, lights, coins, and any tool bought or found on the way, though the ground it lit still goes into the slot (§6.1) — with a short screen reporting tiles explored, furthest distance, and steps taken before returning to the title screen. Running out of light, by contrast, is a setback (blackout), not a failure state; nothing about light kills the character.
- **Session end:** the player walks back to the hut and takes it up on the offer to stop (§4). The HUD tracks the numbers that stand in for a score while you're out — **tiles explored** (distinct tiles the campaign has ever lit, since ground carries between runs — §6.1), **coins**, **water** remaining, and the row of **colours** recovered — and stopping at the hut closes the run with a **recap**: tiles explored, **new ground** this expedition lit that no earlier one had, coins, lights found, colours saved, furthest distance reached, steps taken, and what's still in hand. The two ground numbers are both there on purpose: the total is how much of the world is drawn, the new one is what this particular walk was worth.

### 6.1 Saving

**The hut is the only place a run is banked**, and that single rule is what gives the walk home its weight. The one thing that outlives a run regardless is the ground it lit — cartography is not progress.

- There are **three save slots**, so more than one campaign can be walked at a time. A slot holds the gem count, banked coins, runs completed, the furthest distance ever reached, which of the two tools are owned, the ground the campaign has drawn, and which unique objects have been seen (§4.6). They live in `localStorage` and are the only state that outlives a run.
- **A run belongs to a slot before it starts.** The title screen offers **NEW GAME** and **LOAD GAME**, and both go through the slot picker: new empties the slot it is pointed at and starts a campaign there, load carries one on. The slot picked stays active, so a run banks itself without ever having to be told which campaign it is (§7).
- **Stopping at the hut** is the only thing that banks. Dying of thirst banks nothing, and leaving by the map's **X** abandons the run and banks nothing either — so a gem picked up but not carried home is still sitting in its sanctum next run, and a compass bought but not carried home is still on the merchant's shelf, with the coins still in the bank.
- **The ground is the exception, and it is deliberate.** However a run ends — banked, dead, or walked out of — the tiles it lit are written into its slot, and the next expedition opens with all of them already drawn. Everything the run was *holding* still lives or dies on the walk home; where the rock is does not. Re-walking ground you have already crossed is not the tension this game is about, and a world that opened black every time made every run start from scratch.
- The hut says so plainly when you arrive carrying a gem, because a player who doesn't know this rule can lose an hour's walk to it without ever being told the rule existed.
- A save is normalised on the way in and out, so a corrupt or hand-edited file costs the player their progress at worst — never the run's arithmetic.
- **Erasing** is in Settings and always means the slot you last played, so it says which slot it is about. It asks twice: the first tap arms the button, the second does it. Starting a **NEW GAME** over an occupied slot asks the same way, on the row itself.

### 6.2 Cheats

A developer switch in Settings, off by default, for looking at what the late game actually does without a campaign's worth of walking behind it.

- A run started with cheats on opens with **the whole world revealed** — every tile out past the fourth sanctum, drawn as remembered ground, exactly the way a long campaign would have left it — **all three colours recovered**, **one of every light** (the beacon lit, since it burns longest), **both tools**, the full water ceiling, and a purse the merchant cannot exhaust.
- **A cheat run writes nothing at all.** It banks no progress at the hut and it does not even keep its ground, because a run that was *handed* three gems is not a campaign and must never overwrite one. The toggle says so on itself, the title screen says so under the gem pips, and the recap says so instead of listing what is being carried home.
- It is a preference rather than run state: `src/config.js` persists it next to the palette, the scene reads it and hands it to `createRun`, and `src/core/rules.js` never asks.

## 7. Controls

Touch is primary. Keyboard is a desktop convenience, not a design target.

| Action | Input (touch — primary) | Input (keyboard/mouse) |
|---|---|---|
| Step | Swipe in a cardinal direction anywhere on the map area, or tap a D-pad arrow (right of the HUD) | Arrow keys / WASD, or click a D-pad arrow |
| Walk | Hold a D-pad arrow down — steps repeat at the rate set in Settings until released | Hold the same arrow's click |
| Inspect a stack | Tap its slot in the inventory strip (bottom left of the HUD) → opens the item card | Click the slot |
| Browse the full inventory | Tap **ITEMS**, the box after the strip's slots → opens the scrollable inventory panel | Click **ITEMS** |
| Equip a light | Tap **Equip** on its item card (single copy), or tap a copy's row in a stack's instance list (multiple copies) | Click the same |
| Close an overlay | Tap its close control, or tap outside it | Click, or press Esc |
| Answer the hut | Tap **KEEP GOING** or **STOP HERE** on the dialog | Click |
| Buy something | Tap a row on the merchant's counter, then **LEAVE** | Click the same |
| Open the map | Tap **MAP** in the top right of the viewport (only there if you own one) | Click **MAP** |
| Start a run | **NEW GAME** or **LOAD GAME** on the title screen, then a slot on the picker | Click the same |
| Overwrite a campaign | Tap an occupied slot under **NEW GAME**, then tap it again | Click the same |
| Change palette | Settings, from the title screen | Same |
| Turn the music off | Settings → **MUSIC** (§9), which silences both loops | Same |
| Turn the tile border off | Settings → **TILE BORDER** (§9) | Same |
| Set the walking speed | Settings → drag or tap the **MOVE SPEED** slider (2-10 steps/second) | Same |
| Turn cheats on or off | Settings → **CHEATS** (§6.2) | Same |
| Erase the slot you last played | Settings → **ERASE SLOT n**, then tap again | Same |
| Leave the run | Tap **X** in the top right of the map | Click **X** |

**Stacking.** The inventory strip and panel both group carried lights by kind rather than showing one slot per copy: a kind you're carrying more than one of shows a single icon badged `×N`. The run itself still tracks every copy separately, in pickup order, each with its own durability — grouping is purely a display concern, so equipping still targets one specific copy.

**The item card** is an overlay, opened from a slot in the strip or a row in the inventory panel, showing: the item's name, its sprite at large scale, and a one-line **effect** description ("Lights the 8 tiles around you"). A kind carried as a single copy shows that copy's **durability** as `current / max` with a bar and an **Equip** button (greyed out if it's already active). A kind carried as several copies shows a scrollable list instead — one row per copy, its own durability bar, and an `EQUIPPED` tag on whichever is active — since copies rarely share a durability and the choice of *which* one to equip has to be visible; tapping a row equips that exact copy and closes the card. Opening a card doesn't cost a step — the game is turn-based on movement only.

**The inventory panel** is opened from the HUD's **ITEMS** slot and lists every carried stack — icon, name, and count — in a scrollable list, so a run isn't limited to what fits in the strip's slots. Above the list sits the same gem-pip row the title screen shows a campaign's save with: one pip per gem, recovered ones in the colour they gave back and the rest dimmed, so the run's progress toward all three colours is visible without standing on screen throughout a walk. Tapping a stack closes the panel and opens its item card.

**The merchant's counter** is a modal listing one row per line of stock — icon, name, price — over
the purse it has to be paid from. A row the run can't act on is dimmed rather than hidden, so the
shop always says what it has and a player can see what they are saving towards; an owned one-off says
`OWNED` where its price was. Buying re-renders the counter rather than closing it, because a sale
moves the purse, which moves what every other row can do.

**The map overlay** owns the whole screen and draws the run's explored ground at one pixel a tile,
scaled to fit, with markers over the top (§4.6). Its only control is **CLOSE**.

**The hut dialog** is the other overlay: a title, a line or a two-column readout, and a row of buttons. It has no close control of its own — every way out is one of its buttons, because both of its uses (the stop/continue question and the recap) are decisions rather than inspections. Like the item card it owns the whole screen while it's up: nothing behind it steps, swipes, or answers a key.

**Screen layout** (480×854):

- The right edge of the map viewport is the **navigation rail**: the **X** at the very top, then the
  compass badge and the **MAP** button stacked under it — whichever of the two the run owns. Both can
  be bought mid-expedition, so the rail lays itself out again whenever ownership changes rather than
  being positioned once at the start.
- Top 624px: the map viewport. 48px tiles, with the character's tile centred exactly on the viewport centre (240, 312). Because 480 and 624 are both whole multiples of 48, exact centring puts the grid on a half-tile offset: 9 full columns plus a half column bleeding off each edge, and 12 full rows plus a half row top and bottom. That partial outer ring is a feature — tiles cut by the screen edge read as "the world keeps going", which is the right message for this game.
- Bottom ~230px (about a quarter): the HUD. Everything but the D-pad lives in a narrow left column: the run counters (tiles explored and the coin purse, each with an icon off the tile sheet; water on its own line under them with a bar the same way the active light gets one), the inventory strip with **ITEMS** as one more same-sized slot after it, then the active light's label and bar, then the status line for the things worth calling out the moment they happen. The four-direction D-pad fills the whole right side, sized for a thumb and with nothing else sharing its column.

## 8. Scope

**Built — the MVP, and what "is the walk interesting" gets judged on:**
- Procedural infinite grid (floor/rock) from a seed, with the base at `(0, 0)`
- Tile stepping via swipe and D-pad, with facing tracked from the last step
- Three visibility states with persistent memory of explored tiles
- Small torch (radius 1) equipped at start; durability ticking per step; auto-swap on burnout; blackout when nothing is left
- Medium torch and lamp torch as findable items, with distance-scaled spawning
- Coins and a coin counter
- Water: depletes one per step regardless of light state, starts at 200 and rises 50 per gem held, refilled by the three water pickups; hitting 0 ends the run and everything carried is lost
- Stacked inventory strip, a scrollable inventory panel, and an item card (durability, effect, Equip — a scrollable per-copy list for stacks of more than one)
- Duo-chromatic rendering with four CRT palettes selectable in Settings, persisted
- Tiles-explored counter
- The hut's stop/continue question and the end-of-run recap
- Synthesised sound throughout: pickup blips, a gem fanfare, a torch catching, a death knell, a tap on every button but the D-pad, and a loop for the walk with a smaller one for the menus (§9)
- Four seed-derived sanctums with masonry walls and gem-gated gates, guaranteed reachable (§4.4)
- Three gems, each restoring a colour, opening its gate, raising the water ceiling, and revealing its tier of items
- Three save slots, picked through NEW GAME / LOAD GAME, banked only by stopping at the hut, with progress on the title screen and an erase in Settings
- Explored ground carried between runs however a run ends, so a campaign never starts from black again (§6.1)
- A cheat toggle in Settings that opens a run on the whole map with one of everything, and banks nothing (§6.2)
- Consumables spread by a minimum-separation rule and relaid on every respawn, with unique objects fixed to the seed (§4.3)
- The merchant, and a price list that makes coins worth picking up
- The compass, pointing at the next unique object worth walking to
- The map, drawing the run's explored ground and remembering it between runs
- `?seed=&nonce=` on the URL, to walk a named world twice

**Nice to have (only after MVP works):**
- Line-of-sight occlusion so rock actually casts shadow
- Light falloff — an outer ring at partial brightness instead of a hard edge
- More light sources (something that lights a fixed radius around a *dropped* point, a one-shot flare that reveals a wide area for one step)
- More landmarks in the terrain generator: the sanctums and the merchant's stall are the only built things, and the ground between them is still pure noise
- Screen-shake-free CRT dressing: scanline overlay, phosphor bloom on the lit ring

**Explicitly out of scope:**
- Combat, enemies, or any threat
- Voice, licensed music, or any audio that arrives as a file
- Multiplayer, leaderboards
- Save/load of a run *in progress*. The save records what a finished run banked, not where you were standing — quitting mid-expedition abandons it, which is the point of §6.1

## 9. Art & audio style

- **Visual style:** Pixel art, **duo-chromatic**, retro CRT. Two colours are on screen at any moment — a dark background and a single foreground used for every tile border, the character, items, HUD, and text — **and one more for each gem recovered**. Every sprite is a 16×16 1-bit tile drawn at 3× with nearest-neighbour filtering and tinted at draw time, which is what makes both a palette swap and a restored colour a tint change rather than an asset rebuild.
  - **The art is one sheet, addressed by coordinate.** `assets/tiles.png` holds 49×22 tiles of 16px, one transparent pixel apart, drawn in near-white on transparent. `src/data/tiles.js` maps each sprite key the game draws with — `rock`, `torch-lamp`, `wizard-down` — to the **(col, row)** of its tile, zero-based from the top-left, and that table is the only place in the game that knows the sheet exists. At boot the sheet is read once, the named tiles are cut out of it as 1-bit masks, and each is baked into a **white** texture; white rather than the sheet's own near-white so a tint lands exactly on its hex. Changing what something looks like is editing one pair of numbers: open `tiles.html` through the same server the game runs on and it draws the sheet with those coordinates on it, boxing the tiles already claimed.
  - **A terrain can name several tiles and alternate between them.** Rock draws from three and trees from eight, picked per world tile from the seed (`variantAt` in `src/core/world.js`) — so a rock field isn't one boulder stamped fifty times, and the tile a given square draws never changes as you walk back past it. Which is the same rule as everything else about this world: derived from the seed, never stored.
  - **Two weights, still one colour.** A mask pixel is either full strength or `FLOOR_TEXTURE_LEVEL` of it (`src/config.js`, currently half), baked as white and mid-grey and multiplied through by the same tint. That is what lets ground texture sit under the things standing on it without becoming a second colour on screen.
  - **What a gem repaints, and what it doesn't.** Terrain is the constant: floor, rock and sanctum wall stay in the palette's own foreground however many gems you hold, because they are the thing every other colour has to read *against*. What changes is the character (who wears the newest colour brought home), the items of that gem's tier, the gem pips in the HUD, and any gate that gem opened. A gem's colour is the foreground of a palette you are **not** playing in — play PHOSPHOR and the three gems are amber, cyan and magenta — so a restored colour is always one the world genuinely did not have, and it is guaranteed to read against the background because those four combinations were already chosen to.
  - **An open gateway is drawn as plain floor while the character stands in it.** Two dense sprites on one tile read as one unidentifiable blob, which is the same reason the hut isn't drawn underneath them; it bites harder here, because a character wearing a gem's colour can be standing on a gate wearing the *same* colour.
  - **Tile edges:** a floor tile draws its dotted border on its top and left edges only, so the edge shared by two known tiles is drawn once rather than doubled. It closes off its right or bottom edge only where the neighbour there is still unknown, so the frontier of explored ground reads as a boundary instead of an unfinished grid.
  - **Three visibility states, one colour:** lit = foreground at full alpha; remembered = the same foreground at ~30% alpha; unknown = nothing drawn at all, just background. Dimming by alpha rather than by a third colour is what keeps the two-colour rule intact.
  - **Floor is a dotted border over ground drawn at half strength.** The border is what separates "ground I have lit" from "dark I have never been to", and it holds that read at the remembered state's 30% alpha; the texture inside it is scatter from the sheet, drawn at `FLOOR_TEXTURE_LEVEL` so a viewport of it reads as a surface rather than as noise. At full strength it was noise — loose pixels compete with the things that actually matter, and the wizard got lost in them. **TILE BORDER** in Settings turns the dotted line off entirely, leaving bare ground texture — now that the tile itself carries a visible surface, the border is a taste rather than the only thing separating lit ground from the dark, so it's the player's call whether to keep it. Rock uses the inverse weight: dense, near-solid, so a rock wall reads as a mass. A tree carries the same weight and spends it differently — a canopy over a trunk, so a grove reads as foliage rather than stone and a player can see at a glance that this blocked step is a different kind of thing. Both are drawn in the palette's own foreground: they are terrain, which is the constant every restored colour has to read against.
  - **Items are drawn hollow.** A solid silhouette turns to mush at 16×16 once it's tinted flat, so the item tiles are outlines with small solid accents — the hollow interior is what gives the eye an edge to read. The four lights differ in *silhouette* rather than in detail, because they have to be told apart at the edge of the light: a candle, a lantern, a candelabra, and — for the beacon, the only one that has to say "this lights everything" — a radiating burst. The three waters have the same job: a teardrop, a hard-sided flask, a round-bottomed vial.
  - **Sanctum wall is masonry where rock is a blob.** Rock's tiles are chosen to *mass*: several in a block read as one dense wall of stone, and one on its own still reads as a boulder. The sanctum wall is battlemented masonry, and it is drawn as a **nine-slice** — four corners, four runs and a standalone piece — picked from where the tile sits on its ring rather than from what its neighbours are, since neighbours can't tell a top run from a bottom one. A ring that turns proper corners is what stops a player reading it as more terrain. That contrast is load-bearing rather than decorative — a player who reads a sanctum wall as terrain walks its perimeter looking for a way round instead of looking for the gate. A shut gate is a barred arch drawn in the palette's own foreground, because a gate you can't open yet is just more wall; an open one is the same arch with the leaves folded back, in the colour of the gem that opened it.
  - **The merchant is a stall, not a person.** A pillared canopy over a counter. It has to read as
    "somebody is here" against the hut's pitched roof and door at the edge of a light, so the awning
    line carries it — a lone figure would read as a second wizard. Like the hut it isn't drawn while
    the wizard is standing on it.
  - **The compass needle is solid where every item is hollow.** It is an instrument reading in the
    corner of the screen, not an object lying on the ground, and it has to be legible at a glance.
    One tile per direction — drawn pointing rather than rotated, and four of them, so the heading is
    snapped to quarter turns and nothing depends on a pixel sprite surviving a rotation. The icon
    beside it takes the colour of whatever it points at, so a gem target reads in that gem's colour.
  - **One gem sprite, three tints.** The gems differ by the colour they gave back and nothing else, so pointing them at three tiles would be three ways of saying the same thing.

- **The character** is a hooded, bearded wizard with a staff, seen face-on. The hood and the staff line are the whole identity at 16×16.

  **All four facings currently draw the same tile.** The sheet is face-on throughout and holds no side or back view of a figure, and a turn that looks wrong is worse than no turn at all — so the four keys are there, pointed at one tile, waiting for side and back views to be drawn. Facing is still tracked and still mechanically load-bearing, because the lamp torch's cone points wherever the character does; meanwhile the *shape of the lit ground* is what shows which way they are looking, which is what makes the missing turn affordable rather than broken.
- **Palettes:** four combinations, chosen in Settings, persisted in `localStorage`, all CRT-flavoured:

  | Name | Background | Foreground |
  |---|---|---|
  | Phosphor | `#0b1a0b` | `#33ff66` |
  | Amber | `#1a0f00` | `#ffb000` |
  | Cathode | `#06121a` | `#4fd0ff` |
  | Magenta | `#14061a` | `#ff5fd2` |

- **Reference:** monochrome terminal monitors, Downwell (two-tone discipline), classic roguelike fog of war.
- **Audio:** every sound is synthesised through WebAudio rather than loaded as a file — the tile sheet is the game's one binary asset, there is no build step, and the score diffs in git. Square waves are the audio equivalent of the two-colour rule; the one exception is the torch, which is filtered noise, because a flame catching has no pitch. Everything goes through a single master gain in `src/ui/sfx.js`, so the game has one volume and the peaks below stay relative to each other, and everything shares one `AudioContext`. All of it is best-effort by design: a browser that blocks or lacks audio costs the player nothing.
  - **A pickup blip:** a short rising arpeggio when you pick something up, two notes for a coin and three, landing higher, for a light.
  - **A gem fanfare:** a run up, a leading note and a held chord over a bass, about a second and a half. A gem is the only pickup that repaints the world, so it is the only one that gets a tune instead of a blip.
  - **A torch catching:** a noise whoosh and a low thump whenever a light takes over — equipped from the item card, auto-equipped when the one before it burned out, or bought out of blackout. The player's choice and the dark's are the same event from two sides, and both change the shape of what is lit.
  - **A death knell:** three falling notes and a low one sagging under them when the water runs out. The only sound in the game that descends, and the one place the music stops before the scene does (§6).
  - **A tap:** a short tock on every button, panel and row in the game — except the D-pad, which is tapped often enough that a sound on it would turn walking into a rattle.
  - **Two loops, following the scene:** the walk gets eight eight-step phrases in A minor pentatonic over a filtered square-wave drone, about half a minute end to end, with the second half an octave up; the menus get a smaller, slower, thinner one — three phrases, a single-octave drone, a long release — in the same key, so the title screen sounds like the dark heard from indoors. Both are written as text in `src/ui/music.js`, and most of their steps are rests: a loop marks time in a place where nothing else does, and a tune would start competing with the blips, which are the sounds that actually mean something. They sit well under them in level for the same reason: the blip is information, the loop is weather. Each scene asks for the track it wants when it opens and none of them stop the music on the way out, so the handover is a crossfade. **MUSIC** in Settings turns it off, persisted in `localStorage` like the palette.

## 10. Theme

An explorer leaving a small base to map an unknown dark. The framing is deliberately thin — the fiction only has to justify why light is scarce and why you'd walk back home. The CRT palette does most of the tonal work: this reads as something being scanned rather than something being seen.

## 11. Tech notes

- **Platform:** Web (2D), portrait, mobile-first
- **Engine/library:** Phaser 3, via CDN `<script>` tag
- **Screen size:** 480×854 fixed (~9:16); 48px tiles; a 624px-tall viewport with the character pinned dead centre. The tile pool is 11×15 — one row wider than strictly visible, so the half-cut outer ring (§7) is always fully covered.
- **Source layout:**

  | Path | Holds |
  |---|---|
  | `src/main.js` | `Phaser.Game` config and scene registration — boot only |
  | `src/config.js` | Screen/HUD/tile layout constants, the palette table, the active-palette accessor (persisted to `localStorage`), the music, tile-border and cheat switches (§9, §6.2, persisted the same way), the move-speed setting (`getMoveSpeed`/`setMoveSpeed`, 2-10 steps/second, persisted the same way — §7), `FLOOR_TEXTURE_LEVEL` — how strongly ground texture is drawn — and `gemColour`, which colour each recovered gem paints in |
  | `src/core/world.js` | The three layers (§4.3): seeded hash → terrain; the seed-derived sanctums and landmarks (`sanctums`, `sanctumAt`, `landmarks`, `landmarkAt`, `isMerchant`, `canEnter`); `uniqueAt` and the separation-thinned `consumableAt`, composed by `itemAt`; and `reachableFraction`/`landmarksReachable`/`pickSeed` for the run-start seed validation, plus `variantAt` — which of a terrain's tiles a square draws (§9). `MIN_SEPARATION` and the `SCATTER` table are the two things to retune. Pure, no Phaser |
  | `src/core/compass.js` | Which unique object the compass points at, and the heading to draw, snapped to the four the needle has sprites for. Pure |
  | `src/core/cartography.js` | Run-length encoding the explored set into something a save slot can hold, and back. Pure |
  | `src/core/light.js` | Light shapes: given a light, a tile, and a facing, the set of visible tiles. Pure |
  | `src/core/rules.js` | The run: step legality (including gates), durability tick, burnout/auto-swap, water depletion/refill and the death condition, pickup, reveal, `inventoryStacks` for grouping same-id copies for display, `bankRun` for the hut's save, `rememberGround` for the ground a run keeps however it ends, the cheat setup (§6.2), and `runSummary` for the recap. Also where the water balance constants (`STARTING_WATER`, `WATER_PER_STEP`, `WATER_PER_GEM`) live. Pure |
  | `src/core/save.js` | The three save slots and which one is active: load, write, erase, start, the slot listing the picker draws, and the normaliser every save passes through whichever direction it came from. Pure bar its `localStorage` access, which is guarded |
  | `src/data/items.js` | Item definitions (name, sprite key, durability, light shape, water refill, effect text) plus `tier`/`hue` — the gem that brings an item into the world and the gem colour it's drawn in — and the two tools |
  | `src/data/shop.js` | The merchant's prices, stock order, and which lines are one-offs. One table to retune the economy |
  | `assets/tiles.png` | The tile sheet: 49×22 tiles of 16px, 1px apart, near-white on transparent. The game's only binary asset |
  | `tiles.html` | A development page, not part of the game: draws the sheet with its coordinates on it and boxes the tiles the game claims, so a sprite can be repointed by reading a label off the screen |
  | `src/data/tiles.js` | Which **(col, row)** of the sheet each sprite key is cut from — one tile, or a list to alternate between — plus the sheet's geometry, `variantKey` for picking one of a terrain's tiles and `wallSprite` for picking a piece of the wall nine-slice. The only place that knows the sheet exists |
  | `src/data/sprites.js` | Everything the sheet can't give: the wizard's four colour bands, the floor's half-strength texture under its dotted border, and the frontier edges — all derived from a sheet tile rather than drawn a second time |
  | `src/ui/textures.js` | Loads the sheet, cuts the named tiles out of it as 1-bit masks, and bakes each into a greyscale texture at boot. Rejects a sheet of the wrong size, a mask that isn't 16×16, and a stray mask character |
  | `src/ui/MapView.js` | The tile pool, the three visibility states, per-tile tinting (gates and gem-tier items), the step slide and the blocked-step bump. Holds no game state |
  | `src/ui/hud.js` | The grouped, icon-led run counters (explored, coins, water — water with its own bar), the stacked inventory strip with **ITEMS** as one more slot in it, the active light's durability, the status line |
  | `src/ui/scroll.js` | A drag/wheel-scrollable, mask-clipped list region shared by the item card's instance list and the inventory panel |
  | `src/ui/sfx.js` | Every sound but the music — the tap, the pickup blips, the gem fanfare, the torch and the death knell — plus the one `AudioContext` and the master gain everything audible goes through. No assets, and silently inert where audio is unavailable |
  | `src/ui/music.js` | The two loops: both scores as text, the square-wave voices, and the lookahead scheduler that writes them to the clock. The track follows the scene — `menu` for the title, slot picker and settings, `explore` for a run |
  | `src/ui/shop.js` | The merchant's counter: a row per line of stock, over the purse it's paid from |
  | `src/ui/worldMap.js` | The map overlay: explored ground baked into a canvas texture a pixel a tile, plus markers |
  | `src/ui/compassBadge.js` | The needle and target icon in the navigation rail |
  | `src/ui/dpad.js`, `src/ui/itemCard.js`, `src/ui/inventoryPanel.js`, `src/ui/dialog.js`, `src/ui/button.js`, `src/ui/slider.js` | The D-pad, held to repeat a step at the rate `getMoveSpeed` gives; the item card overlay (single-copy or scrollable instance list); the full scrollable inventory panel, with the gem-pip row above its list; the hut's title/rows/buttons dialog; the shared bordered button; the shared drag-or-tap slider, used once for the move-speed setting |
  | `src/scenes/` | `TitleScene`, `SlotScene` (the NEW GAME / LOAD GAME picker), `SettingsScene` (palettes, the music switch, the tile border switch, the move-speed slider, the cheat switch, erase), `ExploreScene` |
  | `tests/` | `harness.js` (local server + Playwright driver + runner) and `game.test.js` — see `TESTING.md` |

- **Sprites are coordinates on one sheet.** `src/data/tiles.js` names a **(col, row)** of `assets/tiles.png` per sprite key; the tile is cut out as a 1-bit mask at boot, baked into a white texture and tinted at draw time. One image, no image editor to repoint a sprite, no build step — and one texture set serves all four palettes.

- **Explored-tile storage:** a `Set` of `"x,y"` keys for tiles ever lit. Terrain and items are re-derived from the seed on demand, so nothing else about the world needs storing. A run additionally keeps only what the recap reports plus the water level: the coin count, the current water, the gem count, the two tools, the high-water mark of distance from the base, and a tally of what it has picked up — and, per epoch, the set of consumable tiles it has emptied, which a respawn simply clears.
- **The structures are derived, then memoised.** Placing four sanctums and three landmarks costs trig plus a bounded flood probe each, and `terrainAt` asks where they are on *every* tile lookup, so they're worked out once per seed and cached. The cache is a derivation, not world state: nothing in it is authored, and a given seed always produces the same seven. Placement deliberately reads the noise terrain directly rather than `terrainAt`, because asking `terrainAt` where a sanctum can go would ask where the sanctums are.
- **The consumable scatter is thrown, then thinned, then memoised.** A tile asks its lattice cell whether a candidate lands there, and a candidate is crowded out only by a same-kind conflict that *itself* landed — resolved by a short recursion that only ever walks to higher-priority candidates, so it terminates. Dropping every candidate that merely has a stronger neighbour would keep only local maxima and thin the world to a third of what the separation rule actually allows. The recursion is memoised per (seed, salt, gems); a respawn moves the salt, and old memos are dropped wholesale because the cache is a speed-up and never state. A full viewport repaint costs about a tenth of a millisecond.
- **Run-start cost.** `pickSeed` flood-fills for the base pocket check and again out past the furthest sanctum for the landmark check, which measures about 54ms on average and 131ms at worst — paid once, during a scene transition. The landmark fill short-circuits as soon as it has reached all four doors and all three landmarks, and never runs at all for a seed the cheaper pocket check has already rejected.
- **The page has to be the viewport.** Phaser fits the canvas to its parent element, so `#game` is sized to the full viewport and Phaser's own `autoCenter` does the centring. Centring the parent with flexbox instead leaves it shrink-to-fit — a size Phaser cannot fit into, which on a portrait phone scaled the canvas to the viewport *height* and let the width overflow: the sides of the HUD ran off screen and the page panned sideways, which ate taps, because a touch the browser is still deciding might be a pan never becomes a click. The canvas also sets `touch-action: none` so there is no pan gesture to wait on. `tests/game.test.js` pins this with a phone-sized viewport.
- **Rendering the viewport:** the tile window is repointed around the character's coordinate each step rather than instantiating sprites for a growing world — a fixed pool of 11×15 cells (three sprites each: ground, base hut, item) whose texture and alpha are reassigned from whatever tile now sits at that screen position. Sprite count stays constant however far you walk. A step slides the whole tile container one tile and tweens it home in 90ms, so the world moves and the wizard doesn't; input is blocked for that tween so a fast tapper can't outrun the renderer.
- **Key technical risks:**
  - Keeping the world genuinely unbounded — all tile lookups go through the seeded generator, never an array, and the camera works in world coordinates so there's no origin to drift from.
  - Swipe vs. tap disambiguation on the map area, with the D-pad live at the same time.
  - Colour discipline surviving contact with Phaser defaults (text, UI, particles all need explicit tinting) — and now that a tile's tint depends on the run rather than only on the palette, tints are reassigned on every repaint instead of once at construction. An object tinted only at construction silently stops tracking the gems.
  - The dotted tile border carrying the whole "this is ground I have lit" read on its own, including at the remembered state's ~30% alpha, now that floor has no decoration to help it.
- **Testing:** `core/world.js`, `core/light.js`, `core/rules.js` and `core/save.js` are pure and importable from Node, so light shapes, durability/burnout sequencing, spawn distribution, sanctum geometry and gate legality are unit-tested without a browser; everything a player *does* is driven against the real canvas with Playwright. Because there are no hand-authored levels to write coordinates against, the tests BFS the real world at load time to find their targets (the nearest torch, the nearest rock to walk into, the route to the first gem) and replay the route — see `TESTING.md`.

## 12. TODO — deferred, not yet designed

Not part of the initial implementation, listed here so the MVP doesn't paint them out:

- **Vault.** The base holds a vault; items and coins you're carrying are only truly *yours* once you've walked back and stored them. That's what turns "how far out can I get" into a decision with a cost, and it's the intended next step after the MVP proves the walk is interesting.
- **A reason to carry a light home.** Lights bank nowhere: the recap says what you were holding and then it's gone. The vault above is one answer; selling them back to the merchant is another.
