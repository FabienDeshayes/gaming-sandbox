# Nouxinha

> Grid exploration game about walking into the dark on a limited supply of light.

> See [`TESTING.md`](./TESTING.md) for how to run the suite and how to write a test against a
> procedural world with no authored levels in it, and [`STORY.md`](./STORY.md) for the fiction the
> late game is pointed at — who took the sun, what the shards are for, and why a campaign is a
> cycle. The first turn of that cycle is built (§4.9); the rest of `STORY.md` is not, and this doc
> stays the record of what is.

> **Doc convention:** this doc describes the game *as it is now*. When something changes, edit the
> relevant sections in place — don't leave "superseded"/"previously"/"was X, now Y" notes. Git history
> is the changelog; this doc is the current source of truth.

## 1. One-liner

A tile-by-tile exploration game where the only thing you can really spend is light: every step burns your torch, and the dark you haven't lit is the only place worth going.

## 2. Pitch

You step out of your base onto a vast dark grid with a small torch that shows one tile in every direction and lasts 100 steps. Everything you find — brighter torches, stranger torches, coins — is out there in the dark, and the further you push the better it gets. The tension is that light is fuel: a torch that shows you more burns out faster, so every upgrade is also a shorter leash.

And at the far end of it, behind the last gate, there is somebody waiting. Bringing the three
colours home is the middle of the game rather than the end of it: the walk that finishes it is the
walk out to the hall at 110, where a sorcerer called Nouxinha takes everything you found and
carried off you and moulds the world again — a new dark, in the same save slot, with nothing left in
hand but the tally of how far the campaign has come (§4.9).

Somewhere out there are three gems, and each one gives the world back a colour it lost. Finding one is not the hard part — carrying it home is, because the hut is the only place a run is ever written down. Reach it and it is yours; the walk is the whole of the risk. Three of the four sanctums they sit in are locked, and what opens them is out in the dark too: chests, standing on their own tiles, holding a key apiece in the colour of the gate it fits. Twenty tiles out there is also a merchant, who will sell you a map for fifty coins and a compass for two hundred and fifty, on the same terms as everything else: only yours once you've walked it back.

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
3. The next sanctum's gate is locked, so the walk is to a chest first: it holds a key in the colour of that gate, and the ground beyond it opens for the first time
4. Walk home. Reaching the hut writes it down — die on the way and the gem and the key both go back where they came from
5. Coins from all of it — including the hoards in the other chests — buy a compass and eventually a map, which is what turns a walk into an expedition you can plan

## 4. Core mechanics

The world has three things in it: **terrain** (floor, two formations of rock, groves of trees, the chests standing on their own tiles, the sorcerer standing on his, and the built walls and gates of the sanctums — all static and procedurally generated), **items** (lights, water, coins and gems, lying on floor tiles until picked up), and **the character** (one tile, one facing).

| Mechanic | Description | Input |
|---|---|---|
| Tile stepping | The character moves exactly one tile per input, in a cardinal direction. Rock, trees and sanctum wall are impassable, and so is a gate you don't hold the gem for: a rejected step costs no durability and doesn't change facing. The character's **facing** is the direction of their last successful step (it starts pointing south, out of the base). | Swipe in a cardinal direction anywhere on the map, or tap the D-pad |
| Gems and gates | Three gems sit at the centres of walled **sanctums** scattered around the hut. Picking one up gives a colour back to the world and opens the gate that wants it (§4.4). | Walk onto the gem |
| Saving | A run is banked by **reaching** the hut, whether or not the expedition ends there (§6). Dying of thirst or leaving by the menu's **EXIT GAME** banks nothing since the last time the hut was stood on, so a gem picked up but never carried back is still out there next run — though the ground the run lit is kept whichever way it ends (§6.1). Separately, the cogwheel menu's **SAVE GAME** suspends the expedition mid-walk so it can be carried on later; that is a bookmark, not a banking (§6.1). | Walk onto the hut, or **SAVE GAME** on the menu |
| Light & visibility | The active light source defines a **shape** of tiles visible from the character's tile (see §4.1). Every tile has one of three states: **unknown** (never lit — drawn as flat background, indistinguishable from any other unknown tile), **remembered** (lit at some point — drawn dimmed), **lit** (inside the current light shape — drawn full brightness). Items and terrain are only readable in the lit state; a remembered tile keeps showing whatever was there when you last saw it. | — |
| Durability | Each successful step costs **1 durability** off the *active* light only. Rejected steps (into rock) cost nothing. Carried-but-inactive lights never burn. At 0 the light is spent and removed from the inventory, and another light auto-equips: another of the same kind if the run is carrying one, so a walk under a beacon carries on under a beacon, and otherwise the **smallest** light left — a burnout is not the moment to start spending the run's widest light, and the smallest is the longest leash home. With no lights left the character is in **blackout**: the light shape shrinks to the character's own tile, and memory shrinks with it — a remembered tile more than one step away stops being drawn until it's lit again, so the screen is the character's own tile plus a small ring of fog of war. Blackout is not death — the character can still feel their way home a step at a time — but it is the moment the walk actually gets dangerous. | — |
| Water | Every successful step also costs **1 water**, independent of the light and never affected by blackout. Water starts at **200** and each gem held raises that ceiling by **50**, to 350 with all three. A water pickup refills by its own amount (§4.2), capped at the ceiling. Unlike light, water has no auto-swap or backup: hitting **0** is the run's one hard failure state — the run ends and everything it was carrying drops into a **bag** on the tile it happened on rather than the hut's books (§6). The one place it cannot happen is the hut, which fills the tank the moment it is stood on: a walk that gets to its own doorstep on its last drop has got home. The balance numbers are named constants in `src/balance.js` (`STARTING_WATER`, `WATER_PER_STEP`, `WATER_PER_GEM`) so they can be retuned without touching the mechanic itself. | — |
| Pickup | Stepping onto a tile holding an item picks it up automatically, with a short rising blip — or, for a gem, a fanfare (§9). Lights go into the inventory unequipped; coins, water and gems apply immediately (coin counter, water level, colour restored) rather than sitting in the inventory. An item needing more gems than you hold isn't there to pick up at all (§4.3). | — |
| Coming home | Stepping onto the base **writes the run down and fills the tank**, then says what it wrote and asks the one question left: **HEAD BACK OUT** carries the expedition on, **END HERE** closes it on a recap (§6) and returns to the title screen. Neither answer risks anything, and the panel says so — that is the whole difference between them (§6.1). Arriving still costs a step and burns durability like any other. | Tap a button on the dialog |
| The hall | The fourth sanctum holds no gem and no hoard: it holds **Nouxinha**, standing at the centre of its clearing. Walking into him is a conversation, and the end of it is a new world in the same slot (§4.9). | Walk into him |
| The merchant | Three stalls, roughly 20-25/40-47/65-74 tiles from the hut and always in the same places for a seed. Selling lights, water, a **compass** and a **map** for coins — the only thing coins are for (§4.5). | Walk onto a stall |
| Compass & map | Two tools, each bought once or found lying in the dark. The compass points at whatever unique object is worth walking to next; the map draws everywhere you have walked (§4.6). | Owned, not carried — neither takes an inventory slot |
| Respawning | Everything lying on the ground goes back, in **new places**, whenever the world respawns — which is only ever walking back onto the hut. A gem no longer does this: it leaves the ground exactly where it is and only upgrades, in place, whatever kind of item it retires (§4.3). Unique objects — gems, the merchants, the compass and map lying out there — never move. | — |
| Fixed camera | **The character never moves on screen — the world moves around them.** The character sprite is pinned to the exact centre of the map viewport and every step scrolls the world one tile in the opposite direction. This is the first thing to reconsider if the game feels static: the alternative is a camera that only scrolls when the character nears the viewport edge, which reads as more grounded but hides how much dark is on each side. | — |

### 4.1 Light sources

A light shape is defined relative to the character's tile, and — for the lamp — relative to their
facing. What the shape says is how far the light *reaches*; what it shows is that minus whatever it
cannot see round.

**Rock, trees and masonry cast shadow; a chest, the sorcerer, a landmark, a signpost, a carved stone and a wisp never do.** A tile inside the shape is lit only if a
straight line reaches it from the character's tile without crossing something solid — and what counts
as solid is the *shape of the world*, not everything that blocks a step. A chest (§4.8) stops a step
and stops nothing else, because a box you could hide behind would read as a wall wearing a lid; the
sorcerer (§4.9), a landmark and a post (§4.10) are the same kind of thing standing on the same kind
of tile — every one of them is walked *into* rather than onto, and a monument that cast a shadow
would be a wall with a name on it. So a
rock mass has ground behind it that stays dark until you walk round — which is what makes routing
past one a decision rather than bookkeeping, and what separates the two rock formations (§4.3) in
play as well as on screen: a mass is a wall to see round, a lone boulder throws a wedge you can step
past. Light spills through a gap in a wall and widens as it goes.

Three rules hold it together:

- **The thing in the way is always lit.** You see the rock; you just don't see past it. A wall that
  hid itself would be a wall the player only finds by walking into it, which is the failure mode this
  game's whole visibility design is arranged to avoid.
- **Nothing a step away can ever be hidden**, because there is no tile in between for anything to
  stand on. A player can always see the ground they could step onto, whatever they are walled in by —
  which is what keeps §5's promise intact, and why a radius-1 torch is unaffected by shadow entirely.
- **A shut gate stops a light; the gem that opens it opens a window.** Sight and passage are the same
  question everywhere else in the terrain, and the gate is the one tile where they come apart — the
  gem lights the inside of the sanctum in the same moment it unbars the door.

The line is traced two ways rather than one, because a line between tile centres passes exactly
through a lattice corner whenever the run and the rise divide evenly, and which side it comes down on
is arbitrary; trying both is what stops a lone boulder throwing a wedge it has no business throwing.
The bias is deliberately permissive — a light this small has little enough to show without being
stingy about corners. Measured against the real world, shadow costs the small torch nothing at all,
the medium torch about 1%, the beacon about 5% and the lamp about 7% of what its shape reaches, so it
sharpens the walk without needing the scatter (§4.3) retuned around it.

| Light | Shape | Durability | Notes |
|---|---|---|---|
| Small torch | Radius 1 — the 3×3 block centred on the character | 100 | The starting light, and the only item in the inventory at the start of a run |
| Medium torch | Radius 2 — the 5×5 block centred on the character | 50 | Twice the reach, half the leash |
| Lamp torch | A cone in the facing direction: 1 tile ahead → 3 wide, 2 ahead → 5 wide, 3 ahead → 7 wide, 4 ahead → 9 wide, plus the character's own tile. Nothing behind or beside. | 60 | Reaches furthest of the three but only forward — turning re-aims it, so it rewards committing to a direction |
| Beacon | Radius 3 — the 7×7 block centred on the character | 140 | Needs **2 gems** to be visible. The one light that breaks the "more reach, shorter leash" trade, because it exists to make the walk to the third sanctum possible at all |

Only one light is active at a time. Equipping is manual (via the item card, §7) except for the auto-swap on burnout, which prefers another of the spent light's own kind and falls back to the smallest one carried (§4.1).

### 4.2 Items that aren't light

Water items differ only in how much they give back — the point of the better ones is range, since the sanctums sit further out than a starting run can reach (§4.4). The `Gems needed` column is the gem that brings an item into the world; each one also retires the item it replaces (§4.3).

The compass and the map are **tools** rather than items: one of each exists, neither is consumed, and neither takes an inventory slot. They live in the top-right corner of the map instead (§7).

| Item | Gems needed | Effect |
|---|---|---|
| Coins | — | What the merchant takes (§4.5). A pickup is a small pile worth 1-5, because the separation rule (§4.3) caps how many piles the world can hold. The HUD's counter shows the whole **purse** — banked plus carried — because that is the number the merchant spends; what this expedition found on its own is a separate line in the recap. |
| Water drop | — | Refills water by 30 (§4), a seventh of a full tank. Running dry is the run's one death condition — this is the thing worth detouring for. |
| Water flask | 1 | Refills water by 60. Two drops in one. |
| Spring vial | 3 | Refills water to the ceiling, wherever you are. |
| Gem | — | One per sanctum, three in all. Gives a colour back to the world, widens the water ceiling and upgrades what is lying about (§4.4). |
| Key | — | One per shut gate, three in all, each found in a chest (§4.8) and drawn in the colour of the gate it opens. Held rather than carried: never consumed, never stacked, and only the campaign's once the hut has written it down. |
| Compass | — | Points at the next unique object worth walking to (§4.6). Bought for 250 or found. |
| Map | — | Draws everywhere the campaign has walked, all at once (§4.6). Bought for 50 or found. |

### 4.3 The world

Very large and **procedurally generated from a seed**, in three layers that differ in what
they depend on. Nothing about the world is ever stored — a run remembers only which tiles it has
*seen*. It is bounded, a long way out, by the dark itself (§4.7).

| Layer | Depends on | Holds |
|---|---|---|
| **Terrain** | `(x, y, seed)` | Floor, rock in two formations, groves of trees, the built walls, gates and clearings, the eight landmarks and fourteen posts set into it (§4.10), the four carved stones (§4.12), and the ten wisps (§4.11). The same every run, forever. |
| **Unique objects** | `(x, y, seed)` | The three gems, the three merchants, the nine chests, and one compass and one map lying out in the dark. Also the same every run — walk back next time and they are where you left them. |
| **Consumables** | `(x, y, seed, salt)` | Coins, water and lights. The salt changes every run and every respawn, so these are never twice in the same places. |

- **Each campaign gets a world of its own.** The seed is drawn when NEW GAME claims a save slot and
  lives in that slot from then on, so the three slots are three different cave systems and starting
  over in one gives it a fourth. Every expedition out of a slot walks the same world — that is what
  makes the ground a campaign has lit worth carrying between runs (§6.1), and what makes the gems
  stay where the compass said they were.
- **Every world is one kind of world, and there are four.** Temperate, frozen, desert and a
  mystical realm — a **biome**, drawn from the seed the same way the ground is, so a slot's seed is
  the whole of its world's identity and a campaign can no more drift into another biome than it can
  drift onto other ground. There is never a border between two inside one world: a biome is a
  property of the world, not of any tile in it, which is what makes "which world am I in" a question
  with one answer.

  A biome is three things. It has a **colour of its own** — temperate is drawn in PHOSPHOR,
  frozen in CATHODE, desert in AMBER, the mystical realm in MAGENTA (§9), and that is the whole of how
  a world's colour is decided; there is no picking one in Settings. The colour is set when a run
  opens, so the menus are drawn in whatever world was last walked and a page opened cold is drawn in
  the temperate green until the first expedition sets out. And it has **tiles of its own**: a biome names the world tiles it wants drawn differently and
  shares the rest, so frozen rock and desert rock can be different stone without either being a
  second copy of the sheet. Each biome spells out **its own floors, its own rock and its own trees** —
  the three terrains a world is mostly made of, each a list the world alternates between — and falls
  back on the shared table for everything else. Today all four name the same tiles, so giving a world
  stone of its own is repointing one of those lists.

  And it has **ground of its own** (`BIOME_TERRAIN` in `src/balance.js`, read by `terrainTuning`).
  This is the one that makes a campaign's four worlds four different *walks*, which the game needs
  because finishing all four is how it ends (§4.9): a biome that was only a tint asked the player to
  walk the same world three more times. Everything the shared table says is the temperate world's,
  and each of the other three is a set of exceptions to it — how much rock and how broadly it masses,
  how thick the groves are, how loose the boulders, how often the ground offers anything and which
  kinds it favours when it does. The distances, the sanctums, the landmarks, the water and the lights
  stay one set of numbers for every world: what changes is the ground between them.

  The four lean on different pressures rather than on different difficulties, and the rate a walk
  *pays* is deliberately level across all four — about one thing found every 37 floor tiles, the
  number the scatter was playtested at — so what differs is what it pays in and what it costs to
  walk:

  | World | Blocked | What it is | What it costs you |
  |---|---|---|---|
  | Temperate | 27% | The baseline every other number was tuned against | Nothing in particular |
  | Frozen | 19% | Open and legible, stone in long broad masses, hardly a tree | A fifth less light on the ground: you can see where to go and have to ration what you go there with |
  | Desert | 12% | The emptiest ground in the game — almost nothing blocks a step | A sixth less water: distance is the only thing between you and anywhere, and distance is the whole problem |
  | Mystical | 30% | Tangled. Not much more stone than temperate, but the finest lattice in the game, so a hundred small formations to thread rather than walls to round | Steps: the walk to anywhere is longer than the distance to it. It pays for that in coin |

  One thing here can break the game rather than merely retune it, and it is written down next to the
  table: **a sanctum has to stay reachable on the water the gem before it hands over** (§4.4). Broad
  rock masses are far worse for that than a blocked share suggests — a coarse lattice grows blobs big
  enough to wall a gate off and send the route the long way round — which is why the tangled world
  has the finest lattice of the four rather than the coarsest. `tests/campaign.test.js` walks that
  invariant in one world of every kind.
- The **base** sits at `(0, 0)`. Its 3×3 neighbourhood is forced to floor so you can never be walled
  in at spawn. It renders as a hut with a flag so it's recognisable from the edge of your light, and
  it's the one tile that's always on the map. The hut isn't drawn while the wizard is standing on
  it — two dense sprites on one tile read as an unidentifiable blob — which is why every run actually
  starts one tile south of it, facing further away: the hut is in view, behind the character, from
  the first frame, rather than hidden until the first step off it.
- **The seed is validated at run start.** A clearing at spawn isn't enough: at any density of blocked
  ground that still looks like a cave system, a slice of seeds seals the base into a pocket of a few
  tiles, which would break the promise that the character is never permanently stuck (§5). So a run
  flood-fills a 40-tile window from the base and rejects a seed that can't reach most of the floor in
  it, bumping to the next seed until one opens up. Rock and trees together block a bit over a quarter
  of the world, and about one seed in ten needs a bump — a bump is cheap and one is always enough,
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
evenly, instead of several times as many in bunches. `MIN_SEPARATION` in `src/balance.js` is the
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

**And the ground is uneven: some of it is worth combing and some is worth crossing.** The separation
rule says how *close* two of a kind may land and nothing about where the good ground is, so every
screenful used to hold about what every other one did, and no stretch was ever worth remembering. So
the chance a patch offers anything at all is scaled by a slow noise field of its own, broad enough
(`RICHNESS_CELL`, 28 tiles) that a light can never take a whole patch in — richness is something a
walk learns, never something a glance reads. The leanest tenth of the world now holds something every
61 floor tiles and the richest every 26, against a flat 49 and 28 before, with the total unchanged:
the same amount to find, half again as unevenly arranged.

**The separation law is untouched by that.** Richness scales what the ground *offers*, and the
thinning that follows is the same everywhere, so nowhere in any world do two of a kind land closer
than 8. The rich end is capped by that rule rather than by the field, which is why widening the range
only ever thins the lean end — and why a lean patch is a stretch you notice crossing rather than one
you could starve in.

**Water outweighs light on the ground, before any gem.** A step costs one water and one point of
durability off the burning light, so the honest way to read the scatter is what a walk gets back per
tile crossed. The opening weights had light very nearly paying for itself out at range while water
paid for about a sixth of itself, which made the leash the game is actually about invisible behind a
torch supply that never ran out. Water is the pressure; light is the thing meant to be rationed —
so before the first gem, every band offers more water than light.

**A gem upgrades the world rather than adding to it.** Item quality still scales with distance from
the base — coins and water near home, the bigger torches only further out — and on top of that each
gem swaps one kind out for one kind in: the first retires the water drop for the flask, the second
the medium torch for the beacon, the third the flask for the spring vial. The swaps are one-for-one
on purpose: what a gem changes is what is lying about, never how many kinds are in play. Walking
ground you have already walked is worth it again because everything on it is better.

**And it thins the ground as it upgrades it.** The upgrades are steep — a drop refills 30 and a
spring vial refills everything, a medium torch burns 50 steps and a beacon burns 140 — so a world
that kept the same number of pickups would hand out several times the water and nearly twice the
light per tile walked by the end of the campaign, which is what turned the late game into stopping
every few steps for something you did not need. So the count comes down as the value goes up: at
three gems the ground holds about three fifths of what it opened with. Fewer things, each worth
several times more, and picking something up stays a thing that happens rather than a thing that
keeps happening. The taper never touches the opening world, and never bites until a gem has been
banked — by which point the water ceiling has gone up by 50 with it.

**Everything on the ground comes back, somewhere new — and only walking back onto the hut does it.**
A respawn relays the whole scatter: anything this run had already emptied is back, and nothing is
quite where it was. Nothing ever materialises under the character's feet. This is what makes a hut
round trip a way to gather rather than a wasted walk, and it is why the map (§4.6) draws ground and
never items: items would be a lie by the time they were drawn. The unique layer doesn't move, so the
gem you are walking towards is still where the compass said it was.

**A gem does not respawn the world — it upgrades what is already lying on it, in place.** Everything
already on the ground when a gem lands is generous enough on its own; a full relay the instant a gem
comes home would only be moving pickups the run hasn't even seen yet. So a gem changes exactly one
thing about the scatter: wherever the kind it retires was already sitting — a water drop, once the
first gem is in hand — that exact tile now holds the kind it was swapped for, the water flask,
without moving, without touching anything else on the ground, and without any of it costing a
respawn. That is the whole of "the new category of items that were not visible before": nowhere else
changes, and nothing needs to be added for a walk to keep paying — the ground a run had already found
is doing that on its own. A sanctum's own hoard is the one exception: it is fixed at what the sanctum
was built holding and never upgrades this way (§4.4).

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
| 2 | 45 | 5 | the first key | The second gem |
| 3 | 80 | 6 | the second key | The third gem |
| 4 | 110 | 7 | the third key | No gem and no cache — **the hall**, and Nouxinha standing in it (§4.9). What the third key is *for* |

- **The fourth is not a fourth sanctum.** Three of them are a wall around a gem; the last is a wall around a person, and what is behind its gate is a conversation rather than a hoard (§4.9). Everything else about it is the same object: the same masonry, the same one gate, the same forced-floor clearing, and its own key well inside its own distance.
- **The chain is the pacing, and it is two chains braided.** Sanctum 1's arch is open because the first gem has to be reachable carrying nothing. Every gate after it is *locked*, and what opens it is a key in a chest (§4.8) standing well inside that gate's own distance — so the walk to a gem is always a walk to a chest first. Meanwhile each gem raises the water ceiling by 50 and upgrades the water lying around the world (§4.3), so the gem you just found is precisely what makes the next sanctum survivable — the distances above are past what a gemless run could walk home from. A key says *whether* you may go; a gem says whether you would get back.
- **Positions are derived from the seed, not authored.** Each sanctum takes a quarter of the compass with a jitter inside it, so the four always sit in different directions at different distances (a new seed relays all four, and no two are ever within 45° of each other). Distance is Chebyshev and exact, so a sanctum's ring lands on the number the HUD's furthest-out counter reports — its bearing is also pulled back toward the nearest N/E/S/W if the jitter would otherwise carry it too near a diagonal, which is what keeps the edge of the world close (§4.7).
- **A gate wears the colour of the key that opens it**, and so does the key — one colour per gate, taken from the gem of the same number. That pairing is the whole of the UI: a player who has picked up a blue key knows at a glance which arch it is for. Like every restored colour it only appears once *that gem* has been brought home (§9), so a key found before its colour is drawn in the plain foreground, exactly as its gate is.
- **The gate always faces the hut**, on a wall *face* and never a corner — there are no diagonal steps, so a corner gate could never be walked through. The tile you approach from is therefore always orthogonally adjacent to the tile you walk into.
- **A sanctum's clearing is forced floor**, so once you are through the gate the gem is always reachable. That is what lets the seed check below worry only about the door.
- **The clearing is a hoard, and the hoard is fixed.** Each gem-keeping sanctum holds a named cache — coins, water and lights of its own tier — laid out **two of each**, ranked rather than rolled, so opening a gate always pays the same amount and a clearing can never turn into a pile of one thing. Unlike the open world it doesn't upgrade with your gems: what a sanctum holds is what it was built holding.
- **The distances are looked at, not only written.** Every number above is a *ring* — Chebyshev from the hut, which is what `ringPoint` places on — and none of them is what the walk costs, because the walk goes round the rock. `distances.html`, opened through the same server the game runs on, draws the gap: **the rose** puts the world from above — all of it, out to `EDGE_RADIUS`, drawn as the circle it is rather than as another Chebyshev ring — with the water leash drawn as the brightness of the floor, so how much of a world is open to a run at nought, one, two and three gems is a picture rather than a sum, and so is how much room the edge keeps past the furthest thing any plan places; **the ladder** puts every placed thing on one axis of steps walked, each over the band its plan in `src/balance.js` authored, and will walk a run of fresh worlds of the same biome to put the spread of that band next to it; **the chain** walks the campaign's own route leg by leg — hut to landmark to its chest to the gate to the gem — against the tank the run is carrying at that point, which is the one table that says outright whether a sanctum can be reached dry; and **the matrix** is every pair in walking steps. It is where a `near`/`span` is decided, and where a biome's ground shows what it costs: the same plan is a different walk in each of the four (§4.3).

- **Reachability is guaranteed by placement, then by the seed.** Roughly one seed in ten drops a given sanctum where a rock blob seals its door into a pocket against its own wall. Rather than reroll the whole world for it, the sanctum is *turned* a few degrees around the hut until its door opens onto the cave system — measured with a bounded flood probe, which separates the two cases cleanly (a sealed door measures 6–22 tiles, a real one runs past the 80-tile limit). `pickSeed` then rejects any seed that still leaves a door sealed, which after placement is about 2 seeds in 120. Carving corridors to each gate was the alternative and was rejected twice over: it leaves the visible lattice §4.3 avoids, and a road pointing at each gem removes the search that makes finding one worth anything.

### 4.5 The merchant

Three stalls, each in the same place every run for a given seed. The first is 20-25 tiles from the
hut and deliberately on the **far side of the hut from the first sanctum**, so an early expedition
has two directions worth walking rather than one. The second sits roughly level with the second
sanctum and opposite it the same way, and the third the same again opposite the third — so a
campaign that has pushed that far out always has somewhere to spend what it found without the walk
all the way back home. Every stall's tile and the ring around it are forced floor, and `pickSeed`
checks each can be walked to from the hut with nothing in hand.

Stepping onto any stall opens the same counter. It is the only thing coins are for — and buying the
compass or the map at one takes it off every other stall's shelf too, since it's the same tool
wherever you found it.

| Stock | Price | Limit |
|---|---|---|
| Water drop | 5 | Unlimited |
| Small torch | 10 | Unlimited |
| Medium torch | 25 | Unlimited |
| Lamp torch | 40 | Unlimited |
| Map | 50 | One, ever |
| Compass | 250 | One, ever |

All six prices live in one table (`PRICES` in `src/balance.js`) so retuning the economy never means reading the
shop's code.

- **The purse is everything you have ever banked plus what you are carrying**, and the merchant takes
  the banked half first. What is in your pocket is the half a bad walk home can still cost you, so it
  is the half worth keeping there.
- **A purchase is only real once the hut writes it down**, exactly like a gem — and the hut writes it
  down by being reached. Die of thirst on the way back and you lose the compass — *and the coins come
  back with it*, because nothing was written between the stall and the sand. That isn't a special case: the hut banks "what was already there plus what this run
  has", and a run that never reaches the hut never touches either number.
- Buying a light in blackout equips it immediately. Everything else about buying a light matches
  finding one: it arrives unequipped, in the inventory, at full durability.

### 4.6 The compass and the map

Two tools. Each exists exactly once — buy it from a merchant or find it lying in the dark, and
owning it takes it off both the ground and every stall's shelf. Neither is consumed, neither stacks,
and neither takes an inventory slot; they live in the top-right corner of the map viewport instead
(§7). Like a gem, each is only kept by walking it home.

The two lying in the world are placed like the merchants: seed-derived, forced-floor clearing,
reachability checked at run start. The map sits past the second sanctum's distance and the compass
past the third's, so finding either is a proper walk — the map is cheap enough at 50 coins that it
doesn't need to be the longer one. The compass costs five times the map on purpose: it is the tool
that turns the rest of the campaign into following a needle, so it should take most of an early
campaign's coin to afford outright, where the map is cheap enough that a couple of chests cover it.

**The compass** shows an arrow and the icon of what the arrow is pointing at, because "that way" on
its own is useless and "that way, and it's a gem" is a decision. The needle snaps to the four
directions its sprites can draw (§9) — enough to start walking, and the icon does the rest. It points at the nearest
**available** unique object *within 40 tiles*: a chest still shut, a gem whose gate this run already has the key to, a
tool it doesn't own yet, the nearest merchant while there is still a one-off on any shelf, or — once all
three colours and the third key are in hand — the sorcerer at 110 (§4.9), which by then is the only
thing left in the world worth walking to.

**It has a range, and that is what keeps it a compass rather than a quest marker.** Unranged it named
the nearest unfound thing anywhere in a 155-tile world, which turned the back half of every campaign
into walking down an arrow and left the fourteen signposts (§4.10) — the game's actual wayfinding —
with nothing to do. Ranged, it answers the question it is genuinely good at: *something is near, and
this is which way.* Finding the far things is the walking's job and the posts'. 40 is a little under
the second sanctum's distance, so the needle reaches the next thing worth walking to from anywhere a
campaign has got to rather than from the doorstep, and it is wider than any light in the game by an
order of magnitude, so it is never merely telling you what you can already see. With nothing in
range it turns for home, which is not a failure state but the tool's other use — the thing you want
at three in the morning with no light left. **Not** the landmarks: they have the fourteen posts
(§4.10), and a needle that counted them would rarely be pointing anywhere else. It deliberately
points at things the player has *not* found — that is the whole value of it, and with the keys behind
chests (§4.8) it is also what keeps the chain from dead-ending. When nothing qualifies it points at the hut, which
is also what it is for at three in the morning with no light left.

**The map** draws every tile this run has lit, at once, a pixel a tile scaled up to fill the width of
the screen. It shows terrain and nothing else: the ground you crossed, the rock and walls you skirted, markers for the hut and for the
unique objects you have actually laid eyes on — chests among them, drawn shut or open as you left
them, and the landmarks, each in the colour it keeps (§4.10) — plus anywhere a signpost has pointed
you and anywhere a standing has told you about, and a ring around where you are standing. Ground you
have never lit is not on it, because a map you didn't draw isn't a map. Items are absent on purpose —
they move every time the world respawns (§4.3), so a map of them would be out of date before it was
read.

A campaign's walk outgrows a phone screen long before the campaign ends, so the whole walk is where
the map *opens* rather than all it can show: from there it pinches, drags, wheels and buttons into,
down to a tile the size of a viewport tile. The markers and the you-are-here dot hold their size on
screen while the ground under them grows — they are chrome, not cartography — and the drawing can
never be dragged out of its own window, so there is always a map under the finger.

**Walking persists whether or not you own the map** (§6.1). The explored set is saved with the slot
and handed back to the next run, so an expedition opens with every tile the campaign has ever lit
already drawn and pushes on from the edge of the dark rather than from the doorstep. What the map
adds is the *view*: seeing all of that at once instead of nine tiles at a time. What persists is
cartography, not progress — where the ground is, never where you were standing, how much water you
had, or what you were carrying. It is tied to the seed that drew it, so a world that ever changed
underneath it discards the drawing rather than showing one from somewhere else.

### 4.7 The edge of the world

The world is **bounded at a radius of 155 tiles** from the hut, and what bounds it is the dark
itself. It is large — about 53,000 walkable tiles, over 300 screenfuls, and 99% of it connects
back to the hut on foot — but it does end, so the design has an outside to work against rather than
an infinity to fill. Every ring placement free to roll its own bearing (a sanctum, a site not pinned
opposite one, a chest, a signpost, a stone, a wisp) is pulled back toward the nearest N/E/S/W
direction if it strays more than 25° off it (`MAX_BEARING_DRIFT`, balance.js): left free, one landing
near a true diagonal sits up to 1.1x further out in this radius than its own Chebyshev distance from
the hut suggests, which is the room the edge would otherwise have to hold in reserve for nothing. A
landmark is the one exception — its bearing is pinned to a sanctum's own direction rather than free
to begin with, which is the point of it.

**The dark eats light.** Everywhere inside 125 or so, a torch is a torch. Past that the dark stops
being something a light pushes back and becomes something that pushes back: it takes **one tile of
reach for every ten tiles closer to the edge**, applied to whatever light is burning. A beacon shows
49 tiles at home, 25 at 133 out, and 9 at the rim; a lamp's cone narrows the same way. The reserve
between the furthest anything is placed (about 130, with the bearing cap applied) and the rim is
tight now — about 25 tiles — so the widest lights are already a little short of their full reach by
the time a walk reaches the outermost court, rather than staying full-strength until well past it.
Two things fall out of the rule, both wanted:

- **The bigger the light, the sooner the dark starts eating it** — so the last stretch is walked at
  the same guttering ring whatever you set out carrying, and the beacon's advantage is a reason to
  get *there*, not a way to see once you have arrived.
- **It costs the light nothing.** The choke is a property of where you are standing, not of what you
  are holding: a beacon choked to one tile is still a beacon, and is as wide as ever on the walk back
  in. Nothing is spent by going to look.

**A tile of reach is always left.** The dark never takes the last one, because the boundary is read
by *seeing the floor stop* — the tiles outside the world are drawn as nothing at all, so what the
player meets is ground running out rather than a wall standing up. A player who could see nothing
would only have bumped into something invisible, which is the failure mode this whole design is
arranged to avoid.

**And it says so, once.** The first time a campaign walks into the edge, the dark explains itself in
a panel: it has been eating your light for a while now, and this is where it has eaten all of it.
After that it is a line in the HUD, because by then the player knows. The fact is filed with the
things the campaign has laid eyes on, so it is written down whichever way the expedition ends and
never offered twice.

**It is a circle, not a box.** Measured as a true radius, unlike the Chebyshev distance the rest of
the game counts in, because this is the one boundary the player will see the shape of — on the map,
where the drawing's own outline becomes the shape of the world. A square edge would read as an
authored wall around a level. The HUD's furthest-out counter stays Chebyshev: how far out you walked
is a different question from how close to the edge you got.

**There is room past the content.** The hall's wall — the outermost of the four — stands at 117, so
the last third of the world is still unspoken for: nothing out there is placed, nothing out there is
generated differently, and the edge is far enough out that reaching it is a 400-step round trip and
therefore a late-campaign expedition in its own right rather than something stumbled into. What
`STORY.md` §8 wants to put there (a thinner ground, and one remnant near the rim) is not built.

### 4.8 Chests and keys

The one thing in the world you interact with by **failing to walk onto it**. A chest stands on its own tile: it cannot be stepped on, and stepping into it is what opens it — a bump, not a step, so it costs no water, no durability and no facing. It never stops a light, because a box you could hide behind would read as a wall wearing a lid, and every shadow rule in §4.1 is about the shape of the world rather than about the things standing on it.

**A chest opens once, and after that it is scenery.** The lid stays up, on the map and in the viewport, and walking back into it says so and does nothing else. There is no second hoard and no second key. That is deliberate: a chest is the only thing in this world somebody else left there on purpose, and a box that refilled would be a vending machine.

**There are nine, and they belong to the slot rather than to the expedition.** Like the merchant and the two tools lying in the dark, a chest is placed from the seed and never relaid by a respawn (§4.3) — so a chest you saw last run is exactly where you left it. Each has a forced-floor apron round it, so whichever side you come from there is somewhere to stand, and `pickSeed` checks every one of them can be walked to.

| Holds | How many | Where |
|---|---|---|
| The three keys | 3 | Beside the Drowned Bell, the Lantern Tree and the Gnomon (§4.10) — three to five tiles off the court, and each one well inside the gate it opens |
| A hoard of coins: 30, 50 or 75, picked from the seed | 5 loose, plus the Mint's | Beside the Mint, and on rings of their own at 12-19, 32-41, 58-69, 84-97 and 104-117 |

- **A key is what a gate wants** (§4.4). Try to walk through a shut gate without it and the HUD says which key it wants, by name and therefore by colour; walk through with it and the lock turns, with a sound of its own. A key is never consumed — once it is yours, that gate is simply a doorway.
- **A key is held on a gem's terms, not a torch's.** It doesn't stack, doesn't burn down, and takes no inventory slot: it shows as a pip beside the gem pips in the inventory panel, in the colour of the gate it opens. And like a gem it is only the campaign's once the hut has written it down — die on the way home and the key goes back in its chest, *with the lid shut again*, because the set of opened chests is banked at the hut exactly like the set of keys. There is no way to lose a key and leave its chest empty.
- **A coin chest is worth an order of magnitude more than a coin pile**, because it is opened once per campaign and never comes back: 30 is most of the way to the map, 50 buys it outright, and 75 is a third of the way to the compass. Those three numbers live in `CHEST_COIN_VALUES` in `src/balance.js`, next to the prices they were set against.
- **The compass points at shut chests** (§4.6), which is what stops the chain dead-ending: a key you have to stumble on would leave a campaign standing at a gate with nowhere to go. An opened chest drops off the needle immediately. Chests are on the map too, drawn with the lid the way you left it — the one marker on that map that says what you have *done* rather than what is there.
- **Opening one earns the text panel** (§7) rather than a line in the HUD, because the panel leaves the world on screen: the lid is visibly up behind the words while they are read.

### 4.9 The hall, and the cycle

The fourth sanctum's clearing holds no gem and no cache. It holds **Nouxinha**, the sorcerer who
took the sun, standing dead centre of it — and the only conversation in the game
([`STORY.md`](./STORY.md) §5-7).

- **He is terrain, of the kind a chest is.** His tile can't be stepped on and can't be opened by any
  key, and — like a chest, and for the same reason — he stops no light at all: he is somebody
  standing on the floor rather than a piece of the world's shape. Anything switching on terrain has
  to answer for him as well as for floor, rock, trees and chests.
- **You talk to him by walking into him**, exactly as a chest is opened by walking into it: a bump
  rather than a step, costing no water, no durability and no facing.
- **What he says is the text panel** (§7), because the panel leaves the world on screen and he is
  visibly standing there while he talks. He introduces himself, he is courteous, he takes the
  colours out of your hands — and what he says about them depends on how many you actually brought,
  because a walk that arrives one short is a walk that happened.
- **He says something different every time a kind of world is finished.** Five conversations, in
  `src/text.js`, picked by how many of the four **biomes** (§4.3) this campaign has already carried
  three colours into the hall of: the first meeting, one world finished, two, three — and a fifth,
  clamped to for a slot that already has every kind of world finished (`SAY.hall`), which the
  ending itself never produces since it writes nothing to reach. Inside each of them the line
  about what you are carrying still moves with the walk you actually had, so arriving
  empty-handed never reads like arriving in full. The count is the only thing about the player he
  has to go on, and it is the whole of what makes him a person who is getting somewhere rather
  than a cutscene on a loop.
- **He takes nothing until the last block is read.** Reading him out is what turns the world over,
  so the crossing is something the player reads about and then sees.

**Then the world is moulded again, and that is what a cycle is.** Everything about the world falls
out of its seed (§4.3), so re-drawing the seed *is* the re-mould, and it happens inside the same
save slot.

**What turns a cycle is walking into him, not finding three colours.** Arriving with two, or one, or
none is still a meeting, still ends the expedition and still takes the world — the three colours only
decide whether that world counts as *finished* (below). There is no other way to turn a cycle and no
way to decline one: the conversation is the last thing that happens in a world.

**He takes everything that came out of the world, and the purse and the tools come out of the
world.** That is the whole rule, and it is worth stating flatly because it is the harshest thing in
the game and the easiest to assume away: **a campaign does not keep its coins or its compass and map
across a cycle.** `turnCycle` in `core/rules.js` rebuilds the slot from `emptySave()` and copies over
six things and no others — the seed it just drew, `cycles`, `finished`, `standings`, `runs` and
`furthest`. Everything absent from that list is gone, coins and tools included, and
`tests/save.test.js` asserts it outright.

| He takes | He leaves |
|---|---|
| The three colours, banked and carried alike | The expeditions you have walked, and how far out you got |
| The keys, and every lid you left up | The count of worlds he has taken, which is the one number that survives every one of them |
| **The purse, banked and pocketed alike** | **The standings** — everywhere this campaign has ever stood (§4.10). He can carry you out of the country a landmark stood in; he has never found a way to carry off having been there |
| **The compass and the map, if you own them** | Which **kinds** of world the campaign has finished, which is what the ending counts (below) |
| The ground the campaign drew, and the unique things it had laid eyes on | |
| Which landmarks *this* world was stood at, and which posts were read in it | |
| The expedition you were on, and any walk suspended in the slot | |
| The bag a death left on the ground, since the new world has no tile that used to be that spot | |

**So a cycle keeps what you know and nothing you own.** Four of the seven standings are
deliberately not numbers (§4.10.5) and the purse and the tools deliberately do not survive, which means the ladder a
campaign climbs across worlds is made of knowledge — a bell you can hear, a spare candle, a stall on
the map, a distance on the HUD — rather than of accumulation. Whether that ladder is *enough* is an
open design question and the honest answer today is that a second cycle plays very much like a first:
the compass costs 250 and one world's coin income is roughly enough to buy the compass and the map
once, so a campaign that loses both every cycle re-earns them every cycle and rarely gets there. §12
records that as unfinished business rather than a settled design.

What comes back is a **fresh expedition out of the hut door**: a full tank, a candle (two, for a
campaign that has stood at the Lantern Tree), no colours,
and a world nobody has lit a tile of — which is generally a different **biome**, so the whole game
is drawn in a different colour from the moment his last line is read. It opens on a dialog rather
than on the three blocks a normal expedition sets out to (§7), and that dialog is where the walk can
also simply be stopped: **SET OUT AGAIN** starts walking, **END HERE** goes back to the title screen
with the new world already written into the slot.

- **The walk into the hall counts as an expedition finished**, because it is one — it ended
  somewhere other than the hut, but it ended, and everything it was carrying was written down by
  the only thing that ever writes anything down: him. The one exception is the meeting that ends
  the game (below): there is no next world for him to mould, so he writes nothing and this walk
  is never banked either.
- **Nothing about it is a death.** The run isn't lost, the world is. Only water kills (§6).
- **The counter is the reminder.** Worlds ended shows in the HUD's counter row while a campaign has
  any, and on the slot's own row in **LOAD GAME** — a campaign three worlds in reads as a campaign
  three worlds in before it is loaded.
- **The compass turns to him** once all three colours are in hand and the third key with them
  (§4.6): everything else worth walking to has been found by then, so the needle saying "that way,
  and it's him" is the whole of how the endgame is signposted.
- **A cheat run gets the hall too** and writes none of it (§6.2) — the switch exists to look at the
  late game without walking to it, and the late game is now the ending below, so a sandbox run
  opens with the other three kinds of world already finished and meets him at the end of the last.

#### Finishing a world, and the end of the game

**A world is finished by walking into the hall of it carrying all three colours.** Which *kinds* of
world a campaign has finished — a list of biomes (§4.3) — is the third thing that survives a
re-moulding, alongside the count of worlds ended and the standings (§4.10): he can unmake the
ground, and he has never found a way to unmake having been walked out of. Arriving one colour short
is still a meeting, still ends the expedition and still turns the world over; it simply finishes
nothing, which is what keeps the ending a walk rather than a formality.

**So the world he moulds next is a kind you have not finished, while there is one left to give.**
Without that, the four kinds come up at random and the last one can take a dozen cycles to arrive,
which turns the end of the game into a wait. Candidates are judged on `biomeOf` alone — one hash —
and only the seed actually taken is put through `pickSeed`, so preferring a kind of world costs
nothing (`mouldSeed` in `core/rules.js`, `MOULD_ATTEMPTS` in `balance.js`).

**The fourth one finished is the end of the game.** Walk into him in the last kind of world this
campaign has not finished, carrying every colour, and there is nothing left for him to mould that
you have not already walked out of — so he stops. What follows is not a fight and not a defeat: he
says the two things the whole campaign has been walking towards, and he opens his hands.

- **A light explosion**, from where the character is standing, taking the whole screen.
- **Every colour on screen is then inverted** — the same two colours this world was drawn in, the
  other way round, so a game that has spent its whole life being a hole in the light is suddenly
  the light with things standing in it. It is the only thing a two-colour game can do to say the
  sun is back, and it costs one line of arithmetic because every colour in the game comes out of
  three accessors in `src/config.js`.
- **Then the credits**, in that light, a line at a time, tapped through like the text panel.
- **And the cycle never turns.** Every other meeting moulds a new world and writes it into the
  slot; this one doesn't — there is nothing left for him to mould, so `turnCycle` is never called,
  nothing about the walk into the hall is banked, and the slot is left exactly as it already stood.
  The credits hand the screen straight back to the title screen, over whatever was last saved
  there.
- **The colours it is read in are a switch of their own**, INVERT COLOURS in Settings (§6.2) —
  always there while the cheats are on, and off until it is asked for. The inversion the ending
  itself draws is *not* that switch: it is an override that is dropped on the way back to the
  title screen, so a page closed on the credits comes back to an ordinary dark world and a player
  who had the switch on keeps it on.

Three things in `STORY.md` that this deliberately does *not* do yet, so the doc and the game don't
drift: there are no **remnants** out past the fourth wall and so no **truths** to say back to him,
the far dark is not thinned, and the rim does not come in cycle over cycle. Every cycle is the same
world size, and what changes across them is what he says and how many kinds of world are left.

### 4.10 Landmarks and signposts

#### 4.10.1 What a landmark is

**Eight of them per world**, in two tiers. They are the only things in the game that are neither
terrain nor a pickup: places, with names, that you walk to in order to have stood there.

- **The seven.** The same seven in every world he moulds. Each pays a **gift** on every touch and a
  **standing** the first time the campaign ever touches it.
- **The one this kind of world keeps to itself.** A different object in a frozen world than in a
  desert one — four in the game, and a campaign meets all four only by finishing it. No gift, no
  standing. What it hands over is a piece of what this ground was (§4.10.3).

The fiction for the seven is in `STORY.md` §11.10 and it is one sentence: **the landmarks are the
pins he pushes into the map before the ground goes on.** He re-moulds terrain, sanctums, stalls and
scatter every cycle, but he anchors each new world to the same points, because nobody can mould a
world out of nothing without something to measure from. They are the second thing in this game he
cannot make from scratch; the first is the fact that you have been here before.

They are mute. They never speak, never move, never open, and nothing is ever standing next to one —
this world has one person in it and that has to stay true (`STORY.md` §12). What changes cycle over
cycle is what *you* recognise, which is the only kind of progress this story allows.

**The footprint is one shape, used eight times**, so it is one piece of code and sixteen sprites:

- a **centrepiece**: one tile, impassable, **bumped into rather than stepped on** — the chest
  contract exactly (§4.8). No water, no durability, no facing, and it never stops a light, because a
  monument you could hide behind would be a wall with a name.
- a **court**: the eight tiles around it, forced walkable and drawn in the landmark's own ground
  tile rather than plain floor. Whatever the noise did, there is always a way in and a way round.

A landmark is therefore 3x3 — and a small torch shows a 3x3 block, so **arriving at one fills your
light**. Nothing else in the world does that. That is the whole of what makes them read as special,
and it costs no new mechanic.

#### 4.10.2 The seven

Ring order is Mint, Aqueduct, Bell, Weighhouse, Lantern Tree, Watchtower, Gnomon — nearest to
furthest — and that order is also what they are about: coin, water, water, coin, light, distance,
distance, which is every currency the game has, each named twice. The first of a pair hands it to
you for this walk; the second changes what it is worth for the rest of the campaign.

| | Name | Colour | Ring | Stands | The chest beside it |
|---|---|---|---|---|---|
| 1 | **THE MINT** | magenta | 12-18 | on sanctum 1's spoke, inside its ring of 20 | a hoard of coins |
| 2 | **THE AQUEDUCT** | cathode blue | 20-26 | in the gap between sanctums 1 and 2 | — |
| 3 | **THE DROWNED BELL** | cathode blue | 28-36 | on sanctum 2's spoke, inside its ring of 45 | key 1 |
| 4 | **THE WEIGHHOUSE** | magenta | 38-45 | in the gap between sanctums 2 and 3 | — |
| 5 | **THE LANTERN TREE** | amber | 48-57 | on sanctum 3's spoke, inside its ring of 80 | key 2 |
| 6 | **THE WATCHTOWER** | amber | 58-65 | in the gap between sanctums 3 and the hall | — |
| 7 | **THE GNOMON** | phosphor green | 66-75 | on the hall's spoke, inside its ring of 110 | key 3 |

**THE MINT.** A stone coin press with the die still in it, standing in a drift of **blanks** — coins
with nothing struck on them. It is the closest landmark to the hut and the first one any campaign
meets, and it is the game's best beat that nobody has to say out loud: the coins are worthless and
he minted them anyway, because a world with no money in it does not look like a world (`STORY.md`
§4). A player who works that out from a drift of blanks has been told something real about him
without a line of dialogue.

**THE AQUEDUCT.** A line of dry stone arches striding out of the dark on one side and stopping in
mid-air on the other, with a channel cut smooth along the top of it that has not been wet in a very
long time. It is the first thing on the walk out that is plainly *infrastructure* — not a monument
and not a shrine, but a piece of plumbing, built at scale, for a population.

**THE DROWNED BELL.** A bell bigger than the hut, mouth-down in ground that is wet for no reason
this world can account for, standing water round its lip. Touching it rings it: one low synthesised
note, so long it is still going when the panel closes. It is the only object in the game that makes
a sound of its own, and that is what its standing is built on.

**THE WEIGHHOUSE.** A stone shed open on three sides, with a balance in it big enough to weigh a
loaded cart: one pan heaped with blanks, the other empty, the beam dead level between them and the
conversion tables cut into its length. It is the Mint's other half — somebody built the press, and
then somebody built the place that says what the press's output is worth, and neither of them was
ever worth anything.

**THE LANTERN TREE.** A dead tree hung with lanterns that were lit a very long time ago and are
still, faintly, going. Its court is a drift of fallen glass. This is the burnt tree `STORY.md` §8
wanted at the rim, brought in where the campaign can actually reach it — and the one landmark that
answers the question the whole game is about, which is who else has been out here carrying a light.

**THE WATCHTOWER.** A tower with no door at the bottom, nothing at all at the top, and a stair going
up the outside of it. The rail at the top is worn to a shine on one side. Somebody stood up here a
great deal, watching a dark that never once changed — which makes it the only object in the game
that is evidence of *waiting*, as against the Gnomon's evidence of expecting.

**THE GNOMON.** A shaft on a stepped base at the centre of a dial cut into the ground, and it has
never once cast a shadow, because there has been no sun since it was raised. It is the furthest out
of the seven and the least useful thing in the world, and it is the only object in the game that is
*evidence*: somebody built a machine for measuring a sun, here, and expected to need it.

#### 4.10.3 The one a world keeps to itself

The seven above are his. The eighth is not, and everything about how it behaves follows from that
one sentence.

| Biome | Landmark |
|---|---|
| temperate | **THE PLOUGH** — standing in the middle of a furrow, share still down, the furrow nine paces long and then stopped |
| frozen | **THE LINE OF WASHING** — two posts, a line, a wash frozen through and hanging perfectly still, and it is your size |
| desert | **THE CARAVAN** — pack-frames in order, roped one to the next, every load still square, no animals and no people |
| mystical realm | **THE SECOND HUT** — your hut, the same door, the same lean in it, your things inside in the places you leave them, cold |

**What they are for.** The seven are waystations: you walk to one because it pays. These pay nothing
at all, and are the only things in the game that don't. What they are worth is that somebody was
here doing something entirely ordinary, and stopped mid-gesture — which is the one thing the seven
cannot say, because a monument is what a civilisation builds on purpose and a plough left in a
furrow is what it leaves behind by accident.

**The escalation is the point.** Three of them are about strangers. The fourth is about you, and it
lands in the world that is least real.

**The fiction is that he is working from memory, and his memory is thin.** He does not invent a
frozen world each time; he reaches for the one he knows, and it comes with its furniture. Which is
why these are *not* remnants in `STORY.md` §8's sense — those are pieces of the true world he cannot
unmake, they sit past his wall at the rim, they are gated on carrying all three colours, and they
bank as **truths**. That system is untouched and still unbuilt. These are his own hand repeating
itself.

**What follows mechanically**, all of it from `standing: null` in `src/data/landmarks.js`:

- **No gift and no standing.** `hasStanding` is false for it forever; `touchLandmark` never reports
  a `firstEver`; the campaign has nothing of it to carry across a cycle.
- **It is banked like a landmark all the same** — this world knows you stood there — and goes with
  the world when the hall takes it, exactly as a signpost does.
- **No post is put up for it** (§4.10.7). The posts are his signage; the thing this ground kept is
  not his to have written down. A post names it only by happening to land within `NEARBY` of it,
  which is the same accident that lets any post name a second landmark.
- **It is never drawn in a colour.** It holds no standing, and colour is what a standing buys — so
  it takes its own biome's palette, which is the same as saying it reads plain in the only world it
  ever stands in (§4.10.4).
- **It is on the rose like everything else**, in the one gap the seven leave over, at rings 34-46 —
  mid-walk, because a thing that pays nothing and stands at the rim is a thing nobody visits twice.

#### 4.10.4 Colour, and how it is earned

Each landmark is drawn in one of the four palette foregrounds (`src/config.js`), **absolutely** — not
through `gemColour`, which is relative to the palette you are playing in and reshuffles per biome.
Absolute is the point: a colour that survives a re-moulding is an identity, and identity is the only
thing landmarks are for.

**Seven of them and four palettes, so a colour is a family rather than a name.** They pair off by
what they are about: the Bell and the Aqueduct are cathode because both are water, the Tree and the
Watchtower are amber because both are seeing, the Mint and the Weighhouse are magenta because both
are money, and the Gnomon keeps phosphor on its own. Two to a colour at most, and the rings
interleave the pairs so you never meet two of a colour in a row. One consequence, kept deliberately:
in each biome one or two of the seven are drawn in the world's own foreground and read plain. Those
are the ones at home here — and so, always, is the eighth (§4.10.3).

But `STORY.md` §12 has a rule the whole art direction rests on — **nothing is ever shown in a colour
the campaign has not brought back** — and painting them on sight would break it. So the colour is the
progression:

> A landmark you have never touched is a grey shape with a name you do not know. Touch it, walk it
> home, and it is drawn in its colour **in every world after, for the rest of the campaign**.

Cycle one is eight grey shapes and fourteen grey arms in a black world. By cycle three the new dark
arrives with coloured pins and coloured arrows already in it, and is legible from the first step.
**The colour is the meta progression**, and it costs no new vocabulary: it is the existing zone
system with one hue role, `'landmark'`, resolved from which landmark's tile is being drawn — the same
way `'gem'` and `'opened'` already resolve from where a tile stands.

**A landmark with no zone map of its own is one zone: itself.** The entries in `src/data/paint.js`
name the part of a tile that is *doing* something — the die in the press, the bell's mouth — and a
landmark that has not been through `paint.html` yet has no such part named. Rather than let it never
gain a colour at all, `MapView` draws the whole silhouette in the landmark's colour instead. Two
colours on screen either way; a zone map is the refinement, not the mechanism.

#### 4.10.5 What a landmark gives

Two tiers, and both are needed: one so that finding a landmark matters to the campaign, one so that
a landmark is still worth walking to in the fourth world, when you have already found them all. The
eighth landmark has neither, on purpose (§4.10.3).

**A standing — once per campaign, kept through every re-moulding.** Touching the landmark is what
wins it and the hut is what keeps it, like everything else that is real (§4.4). `turnCycle` carries
the standings over by hand; the record of which landmarks *this* world has been stood at goes with
the world, because the new one has its own to find.

| Landmark | Standing |
|---|---|
| The Mint | Every stall is on your map from the first step of every world after. |
| The Aqueduct | Your tank is 25 wider, for good — the one widening the hall cannot take back. |
| The Drowned Bell | You hear it. In every world after, the bell sounds when you are within 20 tiles, and closer is louder. |
| The Weighhouse | A quarter off every price on the merchant's shelf, for good. |
| The Lantern Tree | You never set out with one light again: every expedition starts with a second small torch in the pack. |
| The Watchtower | The dark at the rim waits 20 tiles longer before it starts eating your light. |
| The Gnomon | The HUD's counter row gains your distance from the hut — not how far you have ever been, how far you are *now*. |

**At most one number per axis, and each is half of what that axis's own currency is worth.** This
used to read "none of them is a number", and the reasoning behind that was sound and still is: a
stack of permanent boons on the same axis — `+20` max water apiece, say — would flatten the water
leash the whole game is about by the second cycle, and `STORY.md` §7 is explicit that what survives a
cycle is what you *know*. What changed is the count, not the rule. There are now three numbers among
seven standings, no two of them on the same axis, and each one deliberately under-powered:

- **+25 water** is half a gem (`WATER_PER_GEM` is 50) and about 12% of the base tank. It is a
  sanctum reached a little drier, not a different leash. It earns its place by being the one
  widening a cycle cannot undo, which is exactly the shape §12's open problem is short of.
- **20 tiles of choke grace** does nothing at all inside ring 170 (§4.1), so it cannot touch the
  balance of ordinary play. What it touches is the far dark of `STORY.md` §8, which nothing else in
  the game makes walkable.
- **A quarter off prices** is aimed straight at the open problem in §12: the compass at 250 is about
  a world's entire coin income and gone by the next cycle. A discount is the smallest lever that
  moves it without adding a meta-currency.

The other four are a sound, a spare candle, a number on the HUD and a pin on the map — knowledge
wearing four different coats. If playtesting says the ladder is still too thin, the place to add is
this table and nowhere else, and the test is whether the new number shares an axis with one already
here.

**A gift — every fresh touch, in this world or any world after.** Not just the first time: a landmark
already found is still worth the detour, because walking up to it again pays out the same gift again.

| Landmark | Gift |
|---|---|
| The Mint | It strikes you a handful of blanks: a small purse, on the spot. |
| The Aqueduct | The ground along the channel it runs on — a band out into the dark and a little way back. |
| The Drowned Bell | Your tank fills. It is drowned; there is water here. |
| The Weighhouse | Something on the empty pan: a drop of water and a candle, applied as picking them up would be. |
| The Lantern Tree | Your equipped light burns back up to full. |
| The Watchtower | You climb it, and a wide block of ground draws — three times the Gnomon's and then some. |
| The Gnomon | The ground reveals in a radius around it — you get to see how far you have come. |

Two of the seven reveal ground and they are deliberately different *shapes* of reveal: the Gnomon
draws a clearing round where you are standing and the Aqueduct draws a **direction**, a band along
the ray out from the hut through the landmark itself. That is the whole reason both are worth having.

A gift is an in-run effect like a pickup, so a run that dies loses what it was given, along with the
world's own record of having stood there — exactly the rule the keys and the chest lids already live
under (§4.8). Walking to a landmark and dying on the way home means walking back to it, and the walk
pays out again when you do. What does not repeat is only what is held against the same bump with no
step in between — a direction key held down pays nothing twice — and the standing, which is the
campaign's and lands once ever, on the first touch of any world.

**The flavour text is the text panel** (§7) — in the same voice as setting out, the chest and the
hall:

> *The bell is bigger than the hut. It is mouth-down in the wet, and it has been here longer than the
> dark has.*
> *You put your hand on it. It answers — one note, so low it is more felt than heard.*
> *You have stood here before. Not here: the ground is new. But here.*

Two blocks of copy per landmark: the meeting, and the re-meeting — which is shorter, because the
second time you are not discovering it, you are recognising it. The re-meeting plays on every touch
after the first, whether that first was this world or an earlier one, as long as a step landed
somewhere between this bump and the last. Only a bump right after another bump on the same landmark,
with no step in between, gets the status line instead of the panel. The status line is one line per
landmark, because two of them reveal ground and a shared "GROUND REVEALED" would lose which place
just did it; the eighth has no such line, because it hands nothing over and the panel is the whole of
it. Every word goes in `src/text.js` like every other word in the game.

#### 4.10.6 Where they stand

- **The rose is the sanctums' rose, and every landmark takes an eighth of it.** A plan's `heading`
  in `LANDMARK_PLAN` is either a sanctum's index — and then the landmark stands on that sanctum's own
  bearing, jittered, and inside its distance — or a *pair* of indices, and then it stands on the
  bearing halfway between two of them. Four of the seven are spokes, three are gaps, and the eighth
  takes the gap left over. The whole rose is rotated by the seed, so every world has a landmark in
  each direction and *which* direction holds which changes every time. "There is one in every
  direction" is knowledge that survives a re-moulding, and it is what makes them orient you at all.
- **The rings interleave the spokes and the gaps**, so a walk out meets them one at a time rather
  than in pairs, and no two of a colour come up in a row. The four spoke landmarks each stay inside
  the sanctum they share a bearing with, which is what makes the gifts worth anything: a full tank at
  the Bell is a waystation on a route the campaign is already walking. Moving one of those rings past
  its sanctum's distance is what would undo it. The furthest is 75 at the outside, which is nearer
  than the third sanctum and a long way inside the hall.
- **The key chests belong to the spoke four** (§4.8). A chest with an `at` in `CHEST_PLAN` takes no
  ring of its own: it stands three to five tiles off that landmark's court, so the landmark is what a
  walk finds and the chest is what it came for. Every key is still well inside the gate it opens. The
  Mint's chest is a coin hoard, the five loose coin chests are placed exactly as they always were,
  and the three gap landmarks and the eighth have no chest at all — a waystation is not a reward.
- **`pickSeed` validates them like everything else** (§4.3) — eight courts and four chests on top of
  what it already checked. A landmark that cannot be reached rejects the seed. A **post is the one
  placed thing the world may go without**: if the sweep finds nowhere to stand it, it isn't stood,
  and it is deliberately left off the reachability check too, because thirteen sets of directions are
  still directions where a landmark nobody can walk to is a hole in the world.

#### 4.10.7 Signposts

Fourteen of them, and they are the half that makes the other half work. Seven named places in a
155-tile dark are seven rumours without them.

- **A post with an arm**, one tile, blocking a step and never a light, bumped into like a chest and
  costing nothing.
- **The arm is painted in its landmark's colour**, and plain until that landmark is known — so a blue
  arm means water, read at a glance from inside a torch, and a plain one means somewhere this
  campaign has never been. The *heading* is in the words rather than in the tile: the post's sprite
  is one of the standing-in tiles off the sheet (§4.10), and drawing four of it, one per direction,
  is the obvious thing to do the day it is drawn properly. Where a post names a second landmark too
  (below), that second name shares the one arm's colour on the tile — the extra reading is a line in
  the text, not a second painted arm.
- **A post is usually assigned one landmark, occasionally two.** Each post's own spot is rolled
  independently of the heading of the landmark it was assigned to name, so nothing pins it to that
  landmark's neighbourhood — and every so often, in some worlds, it lands close enough to a
  *different* landmark to be worth naming as well (within the `NEARBY` band below). That accident is
  the only way the world's own eighth landmark is ever named by signage at all (§4.10.3). Most posts
  only ever say the one name they were built to say.
- **Reading one opens the panel**, and opens it again on every later read too, as long as a step
  landed somewhere between this bump and the last one — one line per landmark named, each
  `THE DROWNED BELL — SOUTH-EAST — A LONG WALK`, eight-point bearing and a banded distance (`NEARBY`
  under 15, `A WALK` under 40, `A LONG WALK` under 80, `FAR` beyond), both computed at read time from
  the post's own tile, so a signpost stores nothing and is as pure as the ground it stands on. Only a
  bump on the same post with no step in between — a direction held against it — echoes those lines to
  the status bar instead, since nothing has changed since the panel was last up.
- **A signpost names a landmark you have never seen**, and that is how you learn the name. The name
  is legible; the colour is not, until you have been.
- **Reading one pins every landmark it named on the map** for the rest of this world, in colour if you
  know it. That is the payoff that makes the map item better rather than redundant: the map draws
  where you have been, and a read signpost draws where you have not.
- **A third arm, always a blank stub, gestures toward the hut** — a heading and nothing else, no name
  burned into it and no distance given, because a signpost out in the dark that knew the way to
  *your* hut would be a strange thing to find (§4.5's stalls and the compass's home fallback are the
  player's own tools; a landmark's own signage knowing where you live is not). It only ever shows up
  on the first read of the world, alongside the named directions, never in the repeated status-bar
  line — it is atmosphere, not a fact worth re-reading.

**Where the fourteen stand**, and what each one is assigned to name:

| Ring | Names |
|---|---|
| 5 | The Mint |
| 13 | The Aqueduct |
| 20 | The Drowned Bell |
| 22 | The Mint |
| 30 | The Weighhouse |
| 32 | The Aqueduct |
| 40 | The Lantern Tree |
| 44 | The Drowned Bell |
| 50 | The Watchtower |
| 52 | The Weighhouse |
| 58 | The Gnomon |
| 66 | The Lantern Tree |
| 74 | The Watchtower |
| 84 | The Gnomon |

Two posts per landmark — one nearer the hut than it is and one further out — so every one of the
seven is pointed at from both sides of itself and a walk in either direction runs into its signage.
**The post at 5 tiles is the one every campaign meets on its first expedition** — near enough that the
opening walk cannot miss it, far enough to be outside the hut's clearing — and it points at the Mint,
which is the nearest landmark there is. It teaches the system and pulls the first walk in a direction
in the same bump. (It also can never end up close enough to a second landmark to name one: the
nearest ring any landmark but the Mint can be placed on is 20, which is `NEARBY`'s own threshold away
at the very closest, and so never inside it.)

Each post takes a heading of its own from the seed, and has to stand at least eight tiles clear of
any landmark court and ten from another post — a signpost next to the thing it points at is a joke
the player has to walk to get to.

#### 4.10.8 What is remembered

Three sets, and the difference between them is the whole design (§6.1):

| In the slot | What | Survives |
|---|---|---|
| `landmarks` | the landmarks stood at **in this world**, the eighth included | the world; cleared by `turnCycle` |
| `posts` | the signposts read in this world | the world; cleared by `turnCycle` |
| `standings` | what the campaign kept out of them — seven at most, never the eighth | everything, `turnCycle` included |

All three are banked exactly like the keys and the opened chests: a run holds them, and the hut is
what makes them the campaign's. `bankRun`, `depositRun` and `turnCycle` all rebuild a slot from
scratch, so the standings are carried across the cycle by hand, alongside `cycles`, `finished`,
`runs` and `furthest` — the whole of what a cycle keeps (§4.9). The purse and the tools are *not* on
that list and are meant not to be. Forgetting to carry a standing over would not look like a bug — it
would look like the game working, one cycle at a time, quietly forgetting everywhere the campaign had
ever stood.

**The compass deliberately does not point at landmarks** (§4.6). They already have a way of being
found, and it is the fourteen posts with their names on: the compass is the instrument and a post is
somebody's directions, and spending the instrument on the one thing that does not need it would also
cost the hall its moment — the Mint stands twelve tiles out, so a needle that counted landmarks would
rarely be pointing anywhere else.

The standings want somewhere to be read, and `STORY.md` §11.9 already wants a "what you know" list
beside the gem pips. Seven coloured landmark pips are its first tenant; today the only place a
standing shows itself is in what it does.

#### 4.10.9 Where it lives

| Path | Holds |
|---|---|
| `src/balance.js` | `LANDMARK_PLAN`, `LANDMARK_COURT`, `LANDMARK_GIFTS`, `BELL_HEARING`, `AQUEDUCT_TANK`, `WATCHTOWER_GRACE`, `WEIGHHOUSE_DISCOUNT`, `SIGNPOST_PLAN`, `SIGNPOST_BANDS`, and the chest plan the four landmark chests hang off |
| `src/data/landmarks.js` | what a landmark *is*: name, sprite, court, the palette it keeps, the standing it hands over or doesn't — and `BIOME_LANDMARKS`, which world keeps which |
| `src/core/world.js` | `buildLandmarks` / `spokeHeading` / `buildSignposts` and the lookups over them, the `'landmark'` and `'signpost'` terrains, `chokeAt`'s grace, and `signpostTargets`/`signpostReadings`/`signpostHutBearing` |
| `src/core/rules.js` | `touchLandmark`, `readSignpost`, `hasStanding`, `markedLandmarks`, `tankCeiling`, `chokeGrace`, `priceFor`, and the three sets above |
| `src/text.js` | `LANDMARK_TEXT` — the names, the standings, and both sets of panel copy — plus `FLASH.landmarkGift` and `SIGNPOST` |
| `src/ui/MapView.js` | drawing them, their courts and the posts, and `landmarkRole`, which is where the colour is earned |
| `tests/landmarks.test.js` | the rules, pure; `tests/ui-landmarks.test.js` is the two claims that need a browser |

The rename that made room for all of it: `LANDMARK_PLAN` / `landmarks()` / `landmarkAt()` used to
mean the merchant, the compass and the map. Those are **sites** now — `SITE_PLAN`, `sites()`,
`siteAt()` — which is what `spotIsClear` always called them.

### 4.11 Wisps

**Ten of them per world, and the simplest thing in it.** A chest holds a key or a hoard; a landmark
holds a gift and a standing; a signpost holds a name and a bearing. A wisp holds nothing at all —
touching one earns a line of text and changes nothing about the run — which is exactly what makes it
able to do the one thing none of those can: it lights its own little clearing **on its own account**,
whatever the character happens to be carrying.

Every other lit tile in the game is lit because the character's own torch reaches it. That is fine
until the torch is gone: in blackout the world shrinks to the character's own tile, and a chest, a
landmark, a post — everything the game has to orient a lost run by — is invisible until it is bumped
into blind. A wisp is the answer. It burns whether or not anything in the inventory does, so a run
that has burned its last torch is not walking through featureless black — it is walking towards ten
small lit rooms scattered through the dark, each one worth aiming for and none of them worth detouring
far for.

- **Placed like the loose coin chests**, on rings of their own from 6 tiles out to 106
  (`WISP_PLAN` in `src/balance.js`) — near ones a first expedition stumbles across, far ones spread
  out past the sanctums. Like a signpost, a wisp is the one kind of placed thing the world may go
  without: `pickSeed` never rejects a seed over one that found nowhere to stand.
- **A tile of its own**, impassable and bumped into rather than stepped on — the chest contract
  exactly (§4.8) — with a forced-floor apron round it, and it never stops a light for the same reason
  a chest, the sorcerer, a landmark and a signpost never do: a small light that cast its own shadow
  would be a contradiction standing in the world.
- **Its own light is round, not square.** Every shape a character can carry is a Chebyshev block or a
  cone (§4.1) — flat-edged, because that is what a torch held at the centre of a grid draws. A wisp's
  is a true (Euclidean) disc, radius 2: the tile it stands on, its four orthogonal neighbours, the four
  diagonal ones just past those, and the two tiles straight out on each axis — thirteen tiles, wider
  than a small torch's own 3x3 block, and still visibly round rather than square, since the disc stops
  short of the furthest corners a radius-2 block would also show.
- **It is composed in `litTiles`, not drawn by a second renderer, and always — never gated by
  distance.** Every wisp in the world has its own disc worked out through the same shadow rule the
  character's own light uses (`blocksSight`) and unioned into what the step reveals, whatever the
  character is carrying and wherever they are standing — so the viewport, the map and the explored set
  all agree on the answer for free, the same way they already did for the character's own light. A
  wisp does not wait to be approached: every one a world has is lit, and marked on the map, from the
  very first reveal of a fresh expedition — a wisp is a fixture of the world rather than a discovery,
  and finding one on the map is how you learn where to walk.
- **Touching one is a bump like every other placed thing**: no water, no durability, no facing
  change. It hands back a line of flavour text on the panel and nothing else — no gift, no standing,
  no gate — so `touchWisp` in `core/rules.js` only has one thing worth reporting, which is whether
  this world has had a hand on this one before.
- **What it remembers belongs to the world**, on exactly the signposts' terms: `wisps` in the save is
  which of them this world has had a hand put on, banked at the hut alongside the landmarks and the
  posts, and dropped with the ground the moment the hall moulds the world again (§4.9). There is
  nothing here for a standing to keep, because there is nothing about a wisp that outlasts knowing
  where it stood.
- **A different sprite per biome, and that is the point of it being a biome's to repoint at all**
  (`BIOME_KEYS` in `src/data/tiles.js`). Unlike a landmark, a wisp carries no identity from world to
  world — nothing recognises it, nothing colours it — so four worlds are free to draw it four
  different ways: temperate's own small four-point glint, a ringed glass orb for the frozen world, a
  low ember for the desert, a scatter of motes for the mystical realm. All four are tiles the sheet
  already had, standing in until they are drawn for this game like the landmarks once were (§4.10).

| Path | Holds |
|---|---|
| `src/balance.js` | `WISP_PLAN`, `WISP_SHAPE` |
| `src/core/world.js` | `buildWisps`, `wisps()`, `wispAt()`, and the `'wisp'` terrain |
| `src/core/light.js` | the `round` shape kind (`roundTiles`) |
| `src/core/rules.js` | `wispOnTile`, `touchWisp`, and `wispLitTiles` inside `litTiles` |
| `src/data/tiles.js` | the shared `wisp` sprite and each biome's own |
| `src/text.js` | `SAY.wisp`, `FLASH.wispAgain` |
| `src/ui/MapView.js` / `src/ui/worldMap.js` | drawing the tile, and marking it once it has been lit |

### 4.12 Carved stones

**Four per world, and the only thing in the dark addressed to you.** A signpost is the world's own
signage and a landmark is somebody's building; a carved stone is Nouxinha's own hand — a block stood
on end, dressed flat on one face and cut deep enough to read with a hand, left standing where a walk
will run into it. He takes your world off you every time you finish one, and he would also rather you
knew how it worked. Both of those are true at once, and the stones are where the game says so.

Mechanically a stone **is a signpost** (§4.10.7), down to the debounce: one tile, blocking a step and
never a light, bumped into rather than stepped on, the panel on a fresh read and the status line on a
bump with no step in between, remembered for this world and dropped with it. Nothing about the
placement machinery is new. What is new is only what it says.

- **Each stone is about one thing the game does not otherwise explain.** The first is the colours and
  what the gates actually want; the second the keys, the boxes and the named places they stand beside;
  the third what a light costs and what the far dark does to it; the fourth that water is distance and
  that a walk which doesn't get home didn't happen. They are the four things a player otherwise learns
  by losing an hour to each.
- **Every stone is cut five ways, and which one you read is how many kinds of world this campaign has
  finished** (`state.finished`, the same count the hall reads, §4.9). Nought is a stranger who may not
  know what a colour is for; one is somebody who has done it once; by three he is admitting what the
  arrangement between you actually is, and by four — a campaign that has walked every kind of world he
  has and watched him open his hands — the instructions are no use to either of you and he cuts something else
  underneath them instead. The stone is the same stone every time. What changes is who is standing in
  front of it. A campaign past the end of the table keeps reading the last cut.
- **There is a set of them in every world, cut by the same hand, and the copy says so.** You walk out of
  a new hut and the four stones are standing there too. That is the one thing about the cycle the
  stones are allowed to notice, and it is how the game says he keeps doing this on purpose — an hour's
  work apiece, and he has nothing but hours (`STORY.md`).
- **Where the four stand.** The first on the doorstep, five to eight tiles out (`STONE_PLAN` in
  `src/balance.js`), so a first expedition cannot miss it and the thing it cannot miss is the one that
  says what the colours are. The other three inside ring 50 — 18-24, 30-37 and 42-50 — which is the ring
  a fresh tank can reach and walk back from. A ring is not a walk — the ground makes it about half again
  as long — so the furthest stone measures about 67 steps out in the median world and 95 in the awkward
  tenth, against a fresh tank of 200: comfortably a round trip nearly everywhere, and a walk worth
  planning where the rock has gone against you. A stone nobody can afford to read is a stone nobody
  reads (`distances.html` is where that was measured). Each keeps six tiles clear of the landmark courts
  and the posts and fourteen from the other stones, because he cut them to be come across on the way to
  something rather than to stand in its doorway.
- **Like a signpost and a wisp, a stone is placed rather than forced**: `pickSeed` never rejects a seed
  over one that found nowhere to stand. Three stones say three quarters of what four say, where a
  landmark nobody can reach is a hole in the world. (In practice the sweep finds all four in every seed
  tried.)
- **It never wears a colour.** A post's arm is painted in the colour of the landmark it names; a stone
  has no landmark behind it to earn one from, so it is drawn in the plain foreground for the whole
  campaign, and is the only standing thing in the world that never changes colour. Its sprite is not a
  biome's to repoint either, for the landmarks' reason rather than the wisps': the ground did not cut
  these, and the same hand cut them in all four worlds.
- **What it remembers belongs to the world**, on exactly the posts' terms: `stones` in the save is which
  of them this world has had read, banked at the hut with the landmarks, the posts and the wisps, and
  dropped with the ground the moment the hall moulds it again (§4.9). There is no standing here — what a
  stone told you is already yours, and it is not the kind of thing a save can take back.
- **On the map**, a stone is marked like a chest rather than like a post: once a light has actually
  reached it, and never before. Reading one tells you nothing about where anything else is, so there is
  nothing for it to pin. **The compass ignores them**, for the landmarks' reason (§4.10.8) and one of
  their own: a stone is something you come across on the way somewhere, and four more targets on a
  needle that already has the gems, the chests and the stalls to name would cost the needle more than
  the stones would gain.

| Path | Holds |
|---|---|
| `src/balance.js` | `STONE_PLAN`, `STONE_CLEARANCE`, `STONE_SPACING` |
| `src/core/world.js` | `buildStones`, `stones()`, `stoneAt()`, and the `'stone'` terrain |
| `src/core/rules.js` | `stoneOnTile`, `readStone`, and the `stones` set on the run |
| `src/data/tiles.js` | the `stone` sprite, shared by all four worlds |
| `src/text.js` | `STONE_TEXT` — four stones, five cuts each — plus `SAY.stone` and `FLASH.stoneAgain` |
| `src/ui/MapView.js` / `src/ui/worldMap.js` | drawing the tile, and marking it once it has been lit |
| `tests/stones.test.js` | the rules, pure; `tests/ui-landmarks.test.js` has the two claims that need a browser |

## 5. Constraints

- One light active at a time. Light and water are the two consumables — no food yet (§12), no timer.
- The character can never be permanently stuck: blackout still allows movement, the base's neighbourhood is always walkable, and no gate ever seals a run *in* — gates only ever hold ground back, never fence it off. A chest can't wall anything off either: its own tile is solid, but the forced-floor apron round it means there is always a way past.
- The only conversation in the game is at the hall (§4.9), and it is never a fight: he takes the world, never the run and never your life.
- **Nothing a step away is ever hidden.** Shadow (§4.1) can darken any tile a light reaches except the ones the character could walk onto next, so no arrangement of rock can leave a player unable to see where to go.
- Water is the one thing that can actually end a run: it depletes every step regardless of light state, and hitting zero is fatal (§6).
- **Two colours, plus one per gem recovered.** The world starts strictly duo-chromatic and can reach five colours only by earning them (§9). Every sprite is a 1-bit tile baked white, so what a gem changes is a tint at draw time, never an asset.
- **The world ends at radius 200, and the dark is what ends it** (§4.7). Nothing is walled off by it: the rim is reachable on foot from the hut, and the last third of the world sits past the outermost content.
- Every gem is optional. Nothing in the game requires finding one; the sanctums gate their own contents and nothing else. The compass and the map are optional too — they make the walk legible, never possible. So is every chest: a key only ever opens ground that was closed anyway.
- **No two of the same consumable within 8 tiles.** The world spreads items rather than scattering them, which caps how much there is to find (§4.3). One constant decides the trade.
- Portrait, mobile-first, touch as the primary input. 480×854 fixed canvas.
- Turn-based: the world only advances when the player steps. No real-time pressure.
- No build tooling: Phaser 3 from a CDN `<script>` tag, game code as plain ES modules.
- One art asset — the tile sheet every sprite is cut from — and no audio files: every sound and both loops are synthesised (§9).

## 6. Win / lose conditions

- **Win:** walking the three colours home and then carrying them out to the hall at 110, where the sorcerer takes them and moulds the world again (§4.9) — four times over, once for each kind of world, which is what ends the game: the fourth one finished is the one where he opens his hands instead, and what is on the other side of that is the light and the credits. Bringing the colours home is the middle of a cycle rather than the end of one: what it opens is the last gate and the walk behind it. The campaign does not end there either — a cycle turns, the slot keeps its standings (§4.10), its count of worlds ended and which kinds of world it has finished, and the whole game is walked again in a world nobody has lit. It does **not** keep its purse or its tools: those came out of the world and go with it (§4.9).
- **Lose:** running out of water. It depletes independently of light and refills only at a water pickup or the hut, so hitting 0 out in the dark ends the run on the spot. Everything carried since the hut was last stood on — gems, keys, lights, coins, and any tool bought or found on the way — drops into a **bag** on the tile the run died on rather than into the hut's books (§6.1), with a short screen reporting tiles explored, furthest distance, and steps taken before returning to the title screen; the ground it lit goes into the slot regardless of any of that. Running out of light, by contrast, is a setback (blackout), not a failure state; nothing about light kills the character.
- **Session end:** the player walks back to the hut and takes it up on the offer to end the expedition (§4). The HUD tracks the numbers that stand in for a score while you're out — **tiles explored** (distinct tiles the campaign has ever lit, since ground carries between runs — §6.1), **coins**, **water** remaining, and the row of **colours** recovered — and ending the expedition closes the run with a **recap**: tiles explored, **new ground** this expedition lit that no earlier one had, **coins found** — the whole walk's, since the hut empties the pocket into the bank every time it is crossed — lights found, colours saved, furthest distance reached, steps taken, and what's still in hand. The two ground numbers are both there on purpose: the total is how much of the world is drawn, the new one is what this particular walk was worth.

### 6.1 Saving

**The hut is the only place a run is banked, and reaching it is what banks it**, whether or not the
expedition ends there. That single rule is what gives the walk home its weight — and putting it on
*arriving* rather than on the button afterwards is deliberate. Standing on the hut, there was never a
reason to decline: coins in the pocket go into a bag on a death and banked ones are not, the merchant
spends the banked half first, and a gem raises the water ceiling whether it is banked or carried. A
question whose answer is always the same is not a decision, it is a trap — and it was a trap that
could cost an hour's walk to a mistap. So the hut writes the walk down on arrival and then asks the
one question that does have two answers: does the expedition go on, or is it over? The panel says in
so many words that both answers keep what was just written, because the game has to unteach the
opposite.

The one thing that outlives a run regardless is the ground it lit — cartography is not progress.

- There are **three save slots**, so more than one campaign can be walked at a time. A slot holds the gem count, the keys held, which chests have been opened, which landmarks have been stood at, which posts read and which carved stones read in this world (§4.10, §4.12), the standings the campaign keeps out of them (§4.10), banked coins, runs completed, worlds ended in the hall (§4.9), the furthest distance ever reached, which of the two tools are owned, the ground the campaign has drawn, which unique objects have been seen (§4.6), and — when the cogwheel menu has saved one — the expedition the campaign is in the middle of. They live in `localStorage` and are the only state that outlives a run.
- **A run belongs to a slot before it starts.** The title screen offers **NEW GAME** and **LOAD GAME**, and both go through the slot picker: new empties the slot it is pointed at and starts a campaign there, load carries one on. The slot picked stays active, so a run banks itself without ever having to be told which campaign it is (§7). A slot holding a saved expedition says so on its row, because that is the difference between the two things **LOAD GAME** can do: set out from the hut again, or carry on from wherever you stopped. A used row also names the kind of world that campaign walks (§4.3), which is the one thing on it that is about the ground rather than about the walking — three slots read as three places rather than three numbers.
- **Reaching the hut** is the only thing that banks, and it banks the moment the tile is stepped on. Dying of thirst banks nothing, and leaving by the menu's **EXIT GAME** abandons the run and banks nothing either — so a gem picked up but never carried back is still sitting in its sanctum next run, a compass bought but never carried back is still on the merchant's shelf, with the coins still in the bank, and a landmark stood at but not walked home from is one this campaign has never stood at (§4.10). What those two cost is always and only the walk *since the hut was last stood on*. Leaving asks before it does it, since an abandoned expedition can't be got back.
- **Dying leaves a bag rather than simply losing everything.** The tile the run was standing on when the water ran out holds everything that run hadn't banked — coins, gems, keys, tools, every light in the inventory — the way a chest does: its own bit of terrain, walked into rather than onto, opened by the bump (§4.8). A later expedition out of the same slot can walk back to it and take all of it up again, at which point it is exactly like any other pickup — only real once carried home. It belongs to the slot, not the world the seed draws, so it is tied to the seed it was dropped in: **EXIT GAME**'s campaign keeps it, a fresh **NEW GAME** overwrites it, and the world the hall moulds next (§4.9) leaves it behind for good, since neither has a tile that used to be that spot.
- **The hut fills the tank on arrival too**, for the same reason and in the same moment — so a walk that gets to its own doorstep on its last drop of water has got home. Dying in the doorway of the one place with water in it was the cruellest outcome the game had, and it is now impossible.
- **The hut hands back a starting light too, if the walk arrives in blackout.** Blackout is a setback everywhere else in the world (§4.7), never a dead end — but the hut is the one tile the game promises is always safe, so it is the one place a lightless run shouldn't be left unable to see. Arriving with nothing lit equips a fresh `torch-small` on the spot, the same moment the tank refills.
- **Ending the expedition adds the recap and nothing else.** What **END HERE** does that **HEAD BACK OUT** doesn't is close the walk down: count it as a run completed, clear whatever the menu had suspended, and total it up. It banks nothing further, because there is nothing further to bank.
- **The ground is the exception, and it is deliberate.** However a run ends — banked, dead, or walked out of — the tiles it lit are written into its slot, and the next expedition opens with all of them already drawn. Everything the run was *holding* still lives or dies on the walk home; where the rock is does not. Re-walking ground you have already crossed is not the tension this game is about, and a world that opened black every time made every run start from scratch.
- **A suspended walk is rewritten when the hut banks under it.** The bookmark records the campaign it belonged to as well as the walk itself, so one left standing across a deposit would hand back the purse from before it. It is written again rather than dropped, so **LOAD GAME** still has a walk to carry on with — from the hut, which is where it now is.
- **Saving mid-walk suspends an expedition; it never banks one.** The cogwheel menu's **SAVE GAME** writes the run into its slot exactly as it stands — the tile you are on, the water and coins you are carrying, how far each light has burned down, the tools and gems in hand, and which of the things on the ground you have already picked up. None of it becomes the campaign's: the gem in your pocket is still unbanked and still only becomes yours at the hut. **LOAD GAME** on that slot picks the walk back up instead of setting out again, and saving confirms what it wrote before asking the one question that follows from it — keep playing, or leave now.
- **The save holds no world.** Terrain and items are pure functions of the seed and the run's salt (§4.3), so a saved expedition stores its seed, its nonce, how many times the world has respawned under it, and the list of item tiles it has already emptied. Everything else is re-derived: the coin you didn't pick up is back because the seed says it is there, not because the save remembered it.
- **What ends a saved expedition is the expedition ending.** Coming home to the hut clears it — that walk is over and banked. So does running dry: death is the one hard failure this game has, and a save you could reload out of would make it a rewind instead. Leaving by **EXIT GAME** is the one that doesn't touch it — not saving is not unsaving, so what you lose is the walking since your last save, never the save itself.
- The hut names what it has just written down — the colour, the tool, the coins — because a player who doesn't know the rule would otherwise never learn that the risk is over.
- A save is normalised on the way in and out, so a corrupt or hand-edited file costs the player their progress at worst — never the run's arithmetic.
- **The hall rewrites the whole slot** (§4.9), and it is the only thing besides NEW GAME that ever does: a new seed, no colours, no keys, no chests, no drawing, no suspended walk — **and no purse and no tools**, since both came out of the world he just took. What is carried across by hand is `cycles`, `finished`, `standings`, `runs` and `furthest`, and nothing else. A slot's world is drawn when NEW GAME claims it *and* every time a cycle turns; what outlives a world is the tally of the campaign and what it learned, never what it was carrying.
- **Erasing** happens by starting a **NEW GAME** over an occupied slot — there is no standalone erase control in Settings. It asks twice, on the slot's own row: the first tap arms it, the second overwrites it.

### 6.2 Cheats

A developer switch in Settings, off by default, for looking at what the late game actually does without a campaign's worth of walking behind it.

- A run started with cheats on opens with **the ground revealed out to 130 tiles** (`CHEAT_REVEAL_RADIUS`) — well past the fourth sanctum's wall at 117 though short of the rim, drawn as remembered ground, exactly the way a long campaign would have left it — **all three colours recovered**, **all three keys** so every gate stands open, **one of every light** (the beacon lit, since it burns longest), **both tools**, the full water ceiling, and a purse the merchant cannot exhaust. It also holds **every standing** (§4.10) — one of which widens the tank past what three gems alone can — and has laid eyes on every gem, site, chest, landmark, carved stone and wisp, so the map opens coloured and complete the way a campaign several cycles in would. The chests and the landmarks themselves are left untouched, so a sandbox for looking at the late game still has something to walk to.
- **A cheat run writes nothing at all.** It banks no progress at the hut, it cannot be saved mid-walk from the menu (which says so instead of writing), and it does not even keep its ground, because a run that was *handed* three gems is not a campaign and must never overwrite one. The toggle says so on itself, the title screen says so under the character, and the recap says so instead of listing what is being carried home.
- **A cheat run opens at the end of the game.** The late game is now the ending (§4.9), so a sandbox is handed the other three kinds of world already finished: walk it into the hall carrying the three colours it started with and the sorcerer opens his hands. Like everything else a cheat run does, it writes no campaign.
- **INVERT COLOURS lives here**, under the cheats and on screen exactly while they are on — it is the same kind of thing they are, a way of looking at the game rather than a way of playing it, and it is the colours the ending is read in (§4.9) available on demand. It draws the whole game inside out — the same two colours the other way round — and turning the cheats off turns it off with them, because a screen drawn inside out with nothing on it to undo that would be a trap rather than a setting.
- It is a preference rather than run state: `src/config.js` persists it to `localStorage`, the scene reads it and hands it to `createRun`, and `src/core/rules.js` never asks.

## 7. Controls

Touch is primary. Keyboard is a desktop convenience, not a design target — but
every button on every screen is reachable from one. Tab, or the arrow keys,
moves a focus ring between whatever is actually on screen — a dialog's
buttons, a slot-picker row, a shop's stock — wrapping past whichever ones are
disabled, and Enter or Space activates whichever one has it
(`ui/keyboardNav.js`). Settings' **MOVE SPEED** slider is the one control that
isn't really a button: focused, Left/Right change its value instead of moving
off it, the same split a native slider makes, while Up/Down and Tab still step
past it. None of this is a second control scheme — it's the same buttons a
thumb taps, reached a different way, and a screen opens with the first one
already focused so Enter alone repeats whatever a fresh page's own first tap
would have been.

| Action | Input (touch — primary) | Input (keyboard/mouse) |
|---|---|---|
| Step | Swipe in a cardinal direction anywhere on the map area, or tap a D-pad arrow (right of the HUD) | Arrow keys / WASD, or click a D-pad arrow |
| Open a chest | Step into it — it can't be stood on, so walking against it is what lifts the lid (§4.8) | The same |
| Talk to the sorcerer | Step into him, the same way, at the centre of the hall (§4.9) | The same |
| Walk | Hold a D-pad arrow down — after a 300ms hold, steps repeat at the rate set in Settings until released | Hold the same arrow's click |
| Inspect a stack | Tap its slot in the inventory strip (bottom left of the HUD) → opens the item card | Click the slot — the strip itself has no Tab stop, only the full panel below does |
| Browse the full inventory | Tap **ITEMS**, the box after the strip's slots → opens the scrollable inventory panel | Click **ITEMS** |
| Equip a light | Tap **Equip** on its item card (single copy), or tap a copy's row in a stack's instance list (multiple copies) | Tab to **EQUIP** and press Enter/Space (single copy), or click a row (the instance list isn't a Tab stop) |
| Close an overlay | Tap its close control, or tap outside it | Tab to its close button and press Enter/Space, click, or press Esc |
| Read the text panel on | Tap anywhere — once to put the rest of the block up, again for the next one, and once more on the last to close it | Click, or press Space, Enter or Esc |
| Answer the hut | Tap **HEAD BACK OUT** or **END HERE** on the dialog | Tab between them and press Enter/Space, or click |
| Answer a new world | Tap **SET OUT AGAIN** or **END HERE** on the dialog the hall leaves you on (§4.9) | Tab between them and press Enter/Space, or click |
| Buy something | Tap a row on the merchant's counter, then **LEAVE** | Tab between the affordable rows and **LEAVE**, Enter/Space to pick one, or click |
| Open the map | Tap **MAP** in the top right of the viewport (only there if you own one) | Click **MAP** |
| Zoom the map | Pinch the drawing, or tap **-** / **+** under it; **FIT** puts the whole walk back on screen | Wheel over the drawing, Tab to a zoom button and press Enter/Space, or click |
| Pan the map | Drag the drawing (or move both fingers of a pinch together) | Drag it |
| Start a run | **NEW GAME** or **LOAD GAME** on the title screen, then a slot on the picker | Tab (both screens open with the first choice focused) and press Enter/Space, or click |
| Overwrite a campaign | Tap an occupied slot under **NEW GAME**, then tap it again | Tab to the row and press Enter/Space twice, or click twice |
| Back out of the slot picker | Tap **BACK** | Tab to it and press Enter/Space, click, or press Esc |
| Turn the music off | Settings → **MUSIC** (§9), which silences both loops | Tab to it and press Enter/Space, or click |
| Set the walking speed | Settings → drag or tap the **MOVE SPEED** slider (2-10 steps/second) | Tab to it, Left/Right to change it, or drag/click |
| Turn cheats on or off | Settings → **CHEATS** (§6.2) | Tab to it and press Enter/Space, or click |
| Open the in-run menu | Tap the **cogwheel** in the top right of the map | Click it, or press Esc |
| Save the expedition | Menu → **SAVE GAME**, then **KEEP PLAYING** or **EXIT GAME** | Tab between the menu's four choices and press Enter/Space, or click |
| Leave the run | Menu → **EXIT GAME**, then **LEAVE** | Tab between them and press Enter/Space, or click |
| Settings mid-run | Menu → **SETTINGS**, then **BACK** | Tab to it and press Enter/Space, or click — Esc reaches **BACK** directly on the Settings screen itself |

**Stacking.** The inventory strip and panel both group carried lights by kind rather than showing one slot per copy: a kind you're carrying more than one of shows a single icon badged `×N`. The run itself still tracks every copy separately, in pickup order, each with its own durability — grouping is purely a display concern, so equipping still targets one specific copy.

**The item card** is an overlay, opened from a slot in the strip or a row in the inventory panel, showing: the item's name, its sprite at large scale, and a one-line **effect** description ("Lights the 8 tiles around you"). A kind carried as a single copy shows that copy's **durability** as `current / max` with a bar and an **Equip** button (greyed out if it's already active). A kind carried as several copies shows a scrollable list instead — one row per copy, its own durability bar, and an `EQUIPPED` tag on whichever is active — since copies rarely share a durability and the choice of *which* one to equip has to be visible; tapping a row equips that exact copy and closes the card. Opening a card doesn't cost a step — the game is turn-based on movement only. **Equip** and **Close** are both Tab stops (§7); the per-copy list, like the inventory panel's own stack list, is a tap/drag list rather than separately-focusable rows.

**The inventory panel** is opened from the HUD's **ITEMS** slot and lists every carried stack — icon, name, and count — in a scrollable list, so a run isn't limited to what fits in the strip's slots. Above the list sits a gem-pip row: one pip per gem, recovered ones in the colour they gave back and the rest dimmed, so the run's progress toward all three colours is visible without standing on screen throughout a walk. The three keys sit on the same row after a gap, drawn in the same colours, because a key *is* a gate's colour and two rows would only be asking the player to hold two palettes in their head. Tapping a stack closes the panel and opens its item card.

**The merchant's counter** is a modal listing one row per line of stock — icon, name, price — over
the purse it has to be paid from. A row the run can't act on is dimmed rather than hidden, so the
shop always says what it has and a player can see what they are saving towards; an owned one-off says
`OWNED` where its price was. Buying re-renders the counter rather than closing it, because a sale
moves the purse, which moves what every other row can do. Every affordable row is a Tab stop
alongside **LEAVE** (§7), so the counter re-registers them on every re-render the same way a sale
changes what's dimmed.

**The map overlay** owns the whole screen and draws the run's explored ground at one pixel a tile,
scaled up to fill the width of the screen, with markers over the top (§4.6). It opens on the whole
walk and is zoomed by pinch, by wheel, or by the **-** / **FIT** / **+** row under it, and panned by
dragging the drawing itself; **CLOSE** is the way out. Whichever of those buttons the current zoom
leaves enabled are Tab stops (§7) — a fresh map opens at its own fit scale, where **-** and **FIT**
have nothing left to do and are skipped.

**The dialog** is the other overlay: a title, a line or a two-column readout, and a row of buttons — stacked one per line once there are more than two of them. It has no close control of its own: every way out is one of its buttons, because all of its uses (the hut's out-or-over question, the recap, the death screen, and the cogwheel menu) are decisions rather than inspections. Like the item card it owns the whole screen while it's up: nothing behind it steps, swipes, or answers a key — though its own buttons do, from Tab (or the arrows) and Enter or Space (§7), and it opens with the first one already focused.

**The text panel** is the game's own voice, and the one overlay that leaves the world on screen: a bordered box across the bottom band of the screen — flush with the HUD divider, whose rule its own top edge becomes — covering the HUD and nothing above it. It reads a few sentences out **a character at a time**, with a blip every couple of characters, one **block** per tap: a tap mid-sentence puts the rest of that block up at once, a tap on a finished block moves to the next, and a tap on the last closes the panel. A blinking caret in the corner is what says a block has finished rather than got stuck. Anywhere on the screen is its tap target — hunting for a button to advance a text box is the one thing a text box must never ask for — and Space, Enter or Esc do the same from a keyboard, all three reading it on rather than closing it, since there is nothing behind it to go back to (§7). Like every other overlay it owns the input while it is up, so nothing behind it steps. It says nothing specific to any one moment: it takes a list of blocks and a callback, and setting out is only its first use. **Setting out** is one: a fresh expedition opens with three blocks about walking into the dark, and a walk merely being *carried on* — resumed from a slot, or coming back from Settings mid-run — is not read them again. **Opening a chest** (§4.8) is the second, and the reason the panel leaves the world on screen: the lid is visibly up behind the words. **The sorcerer** (§4.9) is the third and the longest, and the only one whose callback does something the player cannot undo — the world turns over when his last block has been read.

**The cogwheel menu** is a dialog with four choices — **SETTINGS**, **SAVE GAME**, **EXIT GAME** and **KEEP PLAYING**. Settings is the same screen the title screen opens and comes straight back to the tile you were standing on. Saving reports what it wrote and then asks the one question that follows from it: keep playing, or leave now. Leaving asks first, and says what it is about to cost, because an abandoned expedition can't be got back (§6.1).

**Screen layout** (480×854):

- The right edge of the map viewport is the **navigation rail**: the **cogwheel** at the very top,
  then the compass badge and the **MAP** button stacked under it — whichever of the two the run owns.
  Both can be bought mid-expedition, so the rail lays itself out again whenever ownership changes
  rather than being positioned once at the start. The cogwheel is the only chrome in the corner:
  settings, saving and leaving are all one tap in rather than three buttons fighting over the same
  48 pixels.
- Top 624px: the map viewport. 48px tiles, with the character's tile centred exactly on the viewport centre (240, 312). Because 480 and 624 are both whole multiples of 48, exact centring puts the grid on a half-tile offset: 9 full columns plus a half column bleeding off each edge, and 12 full rows plus a half row top and bottom. That partial outer ring is a feature — tiles cut by the screen edge read as "the world keeps going", which is the right message for this game.
- Bottom ~230px (about a quarter): the HUD. Everything but the D-pad lives in a narrow left column: the run counters (tiles explored and the coin purse, each with an icon off the tile sheet, then — once there is one to count — the worlds ended, and at the far end of the same row how far out you are standing, for a campaign that has stood at the Gnomon (§4.10)), the inventory strip with **ITEMS** as one more same-sized slot after it, then the active light's label and bar, then water's — same size, directly under it, since the two read as the same kind of resource — then the status line for the things worth calling out the moment they happen. The four-direction D-pad fills the whole right side, sized for a thumb and with nothing else sharing its column.

## 8. Scope

**Built — the MVP, and what "is the walk interesting" gets judged on:**
- Procedural grid (floor/rock) from a seed, bounded by the dark at radius 200, with the base at `(0, 0)`
- Tile stepping via swipe and D-pad, with facing tracked from the last step
- Three visibility states with persistent memory of explored tiles
- Line-of-sight occlusion: rock, trees and shut gates cast shadow, chests don't, and the thing in the way is always lit (§4.1)
- Small torch (radius 1) equipped at start; durability ticking per step; auto-swap on burnout (same kind first, smallest otherwise); blackout when nothing is left
- Medium torch and lamp torch as findable items, with distance-scaled spawning
- Coins and a coin counter
- Water: depletes one per step regardless of light state, starts at 200 and rises 50 per gem held, refilled by the three water pickups; hitting 0 ends the run and drops everything carried into a bag on the tile it happened on
- Stacked inventory strip, a scrollable inventory panel, and an item card (durability, effect, Equip — a scrollable per-copy list for stacks of more than one)
- Duo-chromatic rendering with four CRT palettes, one per biome
- Tiles-explored counter
- The hut's stop/continue question and the end-of-run recap
- Synthesised sound throughout: pickup blips, a gem fanfare, a torch catching, a death knell, a tap on every button but the D-pad, and a loop for the walk with a smaller one for the menus (§9)
- Four seed-derived sanctums with masonry walls and key-locked gates, guaranteed reachable (§4.4)
- Nine seed-derived chests, opened by walking into them, holding the three keys and six hoards of coins — the Mint's and five loose ones (§4.8)
- Three gems, each restoring a colour, raising the water ceiling, and revealing its tier of items
- The hall at 110: the sorcerer standing in the fourth sanctum, the conversation, and the cycle it turns — a new world in the same slot, the colours, the ground, the purse and both tools taken, the standings and the kinds of world finished kept, and a counter of worlds ended in the HUD and on the slot's row (§4.9)
- Eight landmarks per world — seven that stand in every world, four of them with a chest apiece, and one more that only this kind of world has and that pays nothing but a piece of what this ground was — plus fourteen signposts pointing at the seven (some naming two, and all gesturing cryptically at the hut), and the standings a campaign keeps out of them through every world after (§4.10)
- Ten wisps per world: lights with nobody carrying them, lit and mapped from the first reveal whatever the run holds, so a blackout walk has somewhere to aim (§4.11)
- Four carved stones per world, read like signposts and written like letters: the colours, the keys, the light and the walk home, each cut five ways by how many kinds of world the campaign has finished (§4.12)
- Three save slots, picked through NEW GAME / LOAD GAME, banked by reaching the hut whether or not the expedition ends there, with progress on the title screen and a slot erased by starting a new game over it
- Explored ground carried between runs however a run ends, so a campaign never starts from black again (§6.1)
- A cheat toggle in Settings that opens a run on the whole map with one of everything, and banks nothing (§6.2)
- Consumables spread by a minimum-separation rule, relaid whenever the hut respawns the world and upgraded in place by a gem without one, with unique objects fixed to the seed (§4.3)
- The merchant, and a price list that makes coins worth picking up
- The compass, pointing at the next unique object worth walking to
- The map, drawing the run's explored ground and remembering it between runs
- `?seed=&nonce=` on the URL, to walk a named world twice

**Nice to have (only after MVP works):**
- Light falloff — an outer ring at partial brightness instead of a hard edge
- More light sources (something that lights a fixed radius around a *dropped* point, a one-shot flare that reveals a wide area for one step)
- More built things in the terrain generator: the sanctums, the landmarks, the posts, the stones, the chests, the wisps and the merchant's stall are what there is, and the ground between them is still pure noise
- Screen-shake-free CRT dressing: scanline overlay, phosphor bloom on the lit ring

**Explicitly out of scope:**
- Combat, enemies, or any threat
- Voice, licensed music, or any audio that arrives as a file
- Multiplayer, leaderboards
- Combat rewards, scoring tables, or anything that turns the recap into a leaderboard

## 9. Art & audio style

- **Visual style:** Pixel art, **duo-chromatic**, retro CRT. Two colours are on screen at any moment — a dark background and a single foreground used for every tile border, the character, items, HUD, and text — **and one more for each gem recovered**. The one thing that ever breaks the dark is the end of the game (§4.9), which turns every colour on screen into its opposite and leaves that behind as a switch: the same palette, the same tints, the same one-colour-per-gem rule, drawn inside out. Every sprite is a 16×16 1-bit tile drawn at 3× with nearest-neighbour filtering and tinted at draw time, which is what makes both a palette swap and a restored colour a tint change rather than an asset rebuild.
  - **The art is one sheet, addressed by coordinate.** `assets/tiles.png` holds 49×22 tiles of 16px, one transparent pixel apart, drawn in near-white on transparent. `src/data/tiles.js` maps each sprite key the game draws with — `rock`, `torch-lamp`, `wizard-down` — to the **(col, row)** of its tile, zero-based from the top-left, and that table is the only place in the game that knows the sheet exists. At boot the sheet is read once, the named tiles are cut out of it as 1-bit masks, and each is baked into a **white** texture; white rather than the sheet's own near-white so a tint lands exactly on its hex. Changing what something looks like is editing one pair of numbers: open `tiles.html` through the same server the game runs on and it draws the sheet with those coordinates on it, boxing the tiles already claimed and boxing the painted ones (below) in their own colour. It is the way in to the other three, which it links to for whatever tile is picked, and which link back. Painting (below) is `paint.html`. Redrawing a tile is `draw.html`: it picks a tile off the sheet, draws its pixels one by one — the sheet is 1-bit, so there is a brush and a rubber and no colour to choose — and exports the whole sheet back out as a PNG to save over `assets/tiles.png`. It only ever rewrites the pixels that changed state, so every other byte of the sheet comes out of it exactly as it went in. Saying which tile a sprite is cut from is `biomes.html`: it lists every one of the world's own sprites, shows what each of the four biomes draws it with next to the default they all fall back on, and builds a terrain's list of tiles by clicking them off the sheet. None of the four has a palette to pick — they are drawn in the colour of the biome being worked on, exactly as the game would draw it (§4.3).
  - **A terrain can name several tiles and alternate between them.** Floor, rock and trees are lists — one floor, three rocks and eight trees today — picked per world tile from the seed (`variantAt` in `src/core/world.js`), so a rock field isn't one boulder stamped fifty times and the tile a given square draws never changes as you walk back past it. Which is the same rule as everything else about this world: derived from the seed, never stored. Those three are the terrains each biome names for itself, and a world can alternate between a different number of them than the shared table does; everything else a biome draws is one tile, because a hut is a hut.
  - **A biome can draw the world's own tiles its own way.** Which world a run is in decides which
    tiles its ground, masonry, gates, chests, hut and stall are cut from: `BIOME_TILES` in
    `src/data/tiles.js` gives a biome the keys it wants to repoint, and everything it leaves out is
    the shared tile — so assigning a tile in `TILES` assigns it in all four worlds at once, and
    naming one in `BIOME_TILES` is a single world's exception. Each biome names its own floors, rock
    and trees in full (§4.3); what it names today is what everyone draws. A biome that draws the same
    tile as everyone else *is* the shared sprite — the key it is drawn under is the shared one, and
    naming the default's own tiles counts as drawing the same tile — so four biomes of the same art
    cost exactly what one does, which is what they cost today. Paint (below) follows the tile a
    biome's sprite was cut from, and past the end of the shared list follows the terrain, so a world
    with six floors where the shared table has one keeps the ground's flecks on all six without the
    zone maps being authored four times. Items, the character and the HUD are deliberately *not* in
    this: they belong to the campaign that carries them from world to world, and they are drawn on
    screens that have no world to ask.
  - **Two weights, still one colour.** A mask pixel is either full strength or `FLOOR_TEXTURE_LEVEL` of it (`src/config.js`, currently half), baked as white and mid-grey and multiplied through by the same tint. That is what lets ground texture sit under the things standing on it without becoming a second colour on screen.
  - **A tile can be painted in up to four colours.** One texture takes one tint, so a tile that has to be two colours at once is not one sprite but a stack of them. `src/data/paint.js` gives a sprite key a **zone map** — 16 lines of 16 characters laid over the tile, where `1`, `2` and `3` claim a pixel for that zone and everything else stays zone 0 — plus a **hue** per zone saying which colour it turns. At boot each zone is cut into its own mask and baked into its own texture, and `src/ui/painted.js` stacks them back into the one silhouette, tinting each separately. The zones never overlap, so the stack survives being drawn at the remembered state's 30% alpha exactly as a single sprite would. A tile with no entry in the table is the same stack with one layer showing, which is why nothing that draws a tile has to know which tiles are painted.

    Zone maps are drawn, not typed: `paint.html` paints them onto the real tile, previews what the tile looks like at nought, one, two and three gems, and hands back the entry to paste into the table. It paints either the tile every world falls back on or one biome's own version of it, whichever world is picked at the top of the page.
  - **What a gem repaints, and what it doesn't.** A gem's colour is the foreground of a palette you are **not** playing in — play PHOSPHOR and the three gems are amber, cyan and magenta — so a restored colour is always one the world genuinely did not have, and it is guaranteed to read against the background because those four combinations were already chosen to. **A hue always resolves to the plain foreground until its gem is actually held**, which is the rule the whole scheme rests on: nothing is ever on screen in a colour the campaign has not brought back yet, and every painted tile *gains* a colour at the moment the gem lands rather than having one taken away.

    What each gem reaches:

    | Gem | Turns |
    |---|---|
    | The character | the hood on the first, the robe on the second, the staff on the third — so a wizard carrying everything is three colours over the one they set out in |
    | Terrain | flecks in the ground on the first, veins in the stone on the second, the lit edge of a canopy on the third — a handful of pixels each, one layer of the world per gem |
    | Sanctums | the crown and outward faces of the ring, in the colour of the gem that sanctum keeps (the last one keeps none, so it takes the colour of the gem its gate wanted) |
    | Gates | the arch belongs to the sanctum behind it; the bars — or the leaves folded back once it is open — to the gem whose colour the key that opens it wears |
    | Keys | the whole tile, in the colour of the gate it fits |
    | Items | the whole tile, in the colour of the gem whose tier brought it into the world |
    | The HUD | the gem pips |

    **The one colour that is not a gem's** is a landmark's (§4.10). It is *absolute* — the same
    palette foreground in all four worlds, named outright in `src/data/landmarks.js` rather than
    resolved through `gemColour` — because a landmark is the same object in every world the hall
    moulds, and a colour that reshuffles per biome would be decoration rather than an identity. Its
    zone still obeys the rule above: it draws in the plain foreground until this campaign has stood
    at that landmark, so it is earned exactly as a gem's colour is. Seven landmarks share four
    palettes, so a colour is a *family* — water, seeing, money — rather than a name, and in each
    biome one or two of them happen to be the colour the world itself is drawn in and read plain.
    Those are the ones at home here, and so is the landmark this kind of world keeps to itself: it
    takes its own biome's palette, holds no standing, and therefore never wears a colour at all.
    A landmark with no zone map of its own is drawn as one zone — the whole silhouette — so that
    every one of them can gain a colour whether or not it has been through `paint.html` yet.

    The *bulk* of terrain is still the constant everything else reads against: floor, rock, trees and masonry are drawn in the palette's own foreground and a gem only lights an edge or a fleck of them. A sanctum repainted wholesale would be a colour-shaped hole in the world rather than a place in it.
  - **An open gateway is drawn as plain floor while the character stands in it.** Two dense sprites on one tile read as one unidentifiable blob, which is the same reason the hut isn't drawn underneath them; it bites harder here, because a character wearing a gem's colour can be standing on a gate wearing the *same* colour.
  - **Three visibility states, one colour:** lit = foreground at full alpha; remembered = the same foreground at ~30% alpha; unknown = nothing drawn at all, just background. Dimming by alpha rather than by a third colour is what keeps the two-colour rule intact.
  - **Floor is ground drawn at half strength, and nothing else.** The texture — scatter from the sheet, drawn at `FLOOR_TEXTURE_LEVEL` — is what separates "ground I have lit" from "dark I have never been to", and it holds that read at the remembered state's 30% alpha too. At full strength it was noise — loose pixels compete with the things that actually matter, and the wizard got lost in them. Rock uses the inverse weight: dense, near-solid, so a rock wall reads as a mass. A tree carries the same weight and spends it differently — a canopy over a trunk, so a grove reads as foliage rather than stone and a player can see at a glance that this blocked step is a different kind of thing. Both are drawn in the palette's own foreground: they are terrain, which is the constant every restored colour has to read against.
  - **Items are drawn hollow.** A solid silhouette turns to mush at 16×16 once it's tinted flat, so the item tiles are outlines with small solid accents — the hollow interior is what gives the eye an edge to read. The four lights differ in *silhouette* rather than in detail, because they have to be told apart at the edge of the light: a candle, a lantern, a candelabra, and — for the beacon, the only one that has to say "this lights everything" — a radiating burst. The three waters have the same job: a teardrop, a hard-sided flask, a round-bottomed vial.
  - **Sanctum wall is masonry where rock is a blob.** Rock's tiles are chosen to *mass*: several in a block read as one dense wall of stone, and one on its own still reads as a boulder. The sanctum wall is battlemented masonry, and it is drawn as a **nine-slice** — four corners, four runs and a standalone piece — picked from where the tile sits on its ring rather than from what its neighbours are, since neighbours can't tell a top run from a bottom one. A ring that turns proper corners is what stops a player reading it as more terrain. That contrast is load-bearing rather than decorative — a player who reads a sanctum wall as terrain walks its perimeter looking for a way round instead of looking for the gate. A shut gate is a barred arch and an open one the same arch with the leaves folded back; a gate you can't open yet is drawn in the palette's own foreground on its own, because the gem that would colour its bars is one you don't have.
  - **A chest is a chest, drawn for this game.** The sheet is a dungeon set with no chest in it, so
    two tiles were drawn over crates nothing claimed — the same way three of the wizard's four
    facings were. Shut, it is a domed lid over a hollow body with a lock hanging under the seam;
    open, the lid is tipped back above an empty mouth. The pair has to be told apart at the edge of
    a light and from the map's one-pixel-a-tile drawing, so the difference is the *silhouette* — the
    lid moving — rather than any detail inside it. Its bands and lock carry a `PAINT` zone map of
    their own (§9), in the three gems' own colours rather than a role: what is in a chest is still
    not something the player is allowed to know before opening it, but the fittings glint in whatever
    colours this campaign has already brought home.
  - **The sorcerer is a person, and the wizard is the only other one.** A deep cowl over a robe with
    nothing readable inside the hood — where the character is face-on and bearded, with a staff. The
    two are the only figures in the world and they stand a tile apart while he talks, so the whole
    job of his tile is to not be mistaken for the player's. He is drawn in the palette's own
    foreground and nothing paints him: he is the one thing on screen that belongs to no gem, and a
    world he has just moulded is a world with none of them in it anyway. Nor is he a biome's to
    repoint (§4.3) — the ground changes every cycle and he does not.
  - **The key is one tile and three tints**, like the gem, and for the same reason: three keys
    pointed at three tiles would be three ways of saying the same thing. What tells them apart is
    the colour, which is the colour of the gate — that pairing is doing all the work, so nothing
    else should compete with it.
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

- **The character** is a hooded, bearded wizard with a staff. The hood and the staff line are the whole identity at 16×16 — which is why they are also the two things a gem colours, along with the robe between them. Facing down, the face stays the colour they set out in.

  **Each facing is its own tile.** Down is the sheet's own face-on figure; up turns it around, the same hood and robe mirrored so the staff swaps hands, with the face closed over — no brow or eyes, just hood, since there is nothing to show from behind. Left and right are a profile silhouette drawn for this game (the sheet holds none), mirrored off each other. Facing is mechanically load-bearing regardless — the lamp torch's cone points wherever the character does — but until these existed, only the *shape of the lit ground* showed which way they were looking; a wrong-looking turn would have been worse than no turn at all, which is why the sheet's face-on tile stood in for all four for as long as it did.
- **Palettes:** four combinations, all CRT-flavoured, one per biome (§4.3) — a world is always drawn
  in its own biome's colour; there is no picking one in Settings:

  | Name | Background | Foreground | The world it colours |
  |---|---|---|---|
  | Phosphor | `#0b1a0b` | `#33ff66` | Temperate |
  | Amber | `#1a0f00` | `#ffb000` | Desert |
  | Cathode | `#06121a` | `#4fd0ff` | Frozen |
  | Magenta | `#14061a` | `#ff5fd2` | The mystical realm |

- **Reference:** monochrome terminal monitors, Downwell (two-tone discipline), classic roguelike fog of war.
- **Audio:** every sound is synthesised through WebAudio rather than loaded as a file — the tile sheet is the game's one binary asset, there is no build step, and the score diffs in git. Square waves are the audio equivalent of the two-colour rule; the one exception is the torch, which is filtered noise, because a flame catching has no pitch. Everything goes through a single master gain in `src/ui/sfx.js`, so the game has one volume and the peaks below stay relative to each other, and everything shares one `AudioContext`. All of it is best-effort by design: a browser that blocks or lacks audio costs the player nothing.
  - **A pickup blip:** a short rising arpeggio when you pick something up, two notes for a coin and three, landing higher, for a light.
  - **A gem fanfare:** a run up, a leading note and a held chord over a bass, about a second and a half. A gem is the only pickup that repaints the world, so it is the only one that gets a tune instead of a blip.
  - **A chest lid:** a short noise creak going up with a low note under it, and two bright notes on
    top of that for what was inside. Much shorter than the gem's fanfare, because a chest is a good
    moment and a gem is *the* moment.
  - **A key turning:** a clack and two notes a fifth apart as a gate gives. Short and mechanical —
    this is a lock, not a reward, and the reward is on the other side of it.
  - **A torch catching:** a noise whoosh and a low thump whenever a light takes over — equipped from the item card, auto-equipped when the one before it burned out, or bought out of blackout. The player's choice and the dark's are the same event from two sides, and both change the shape of what is lit.
  - **Standing at a landmark:** four notes climbing, the chest's shape opened out — what a landmark
    hands over is the campaign's rather than the run's, so it gets the longer sound (§4.10).
  - **A signpost:** wood, so a knock rather than a note. Short, flat and over: the post is not the
    thing, the direction is.
  - **The Drowned Bell:** one low struck note with its fifth under it and a very long tail, tolled
    every few steps while a campaign that has stood at it walks inside its reach (§4.10). It is the
    only sound in the game that comes out of the world rather than out of something the player did,
    and its level is the whole of the mix — walking towards it is the sound getting louder.
  - **A death knell:** three falling notes and a low one sagging under them when the water runs out. The only sound in the game that descends, and the one place the music stops before the scene does (§6).
  - **A tap:** a short tock on every button, panel and row in the game — except the D-pad, which is tapped often enough that a sound on it would turn walking into a rattle.
  - **The typewriter:** a very short, quiet, high blip every couple of characters while the text panel types itself out (§7). It is the one sound that fires dozens of times a second, which is why it is the shortest and quietest thing in the game — anything with a tail on it at that rate is a buzz rather than a voice.
  - **Two loops, following the scene:** the walk gets eight eight-step phrases in A minor pentatonic over a filtered square-wave drone, about half a minute end to end, with the second half an octave up; the menus get a smaller, slower, thinner one — three phrases, a single-octave drone, a long release — in the same key, so the title screen sounds like the dark heard from indoors. Both are written as text in `src/ui/music.js`, and most of their steps are rests: a loop marks time in a place where nothing else does, and a tune would start competing with the blips, which are the sounds that actually mean something. They sit well under them in level for the same reason: the blip is information, the loop is weather. Each scene asks for the track it wants when it opens and none of them stop the music on the way out, so the handover is a crossfade. **MUSIC** in Settings turns it off, persisted in `localStorage`. A backgrounded tab or app stops the loop the same way — WebAudio keeps running behind an inactive tab, so `music.js` listens for `visibilitychange` and fades out on hide, resuming the same track from the top of its phrase on return.

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
  | `src/balance.js` | **Every number the game is balanced on, and nothing else**: terrain thresholds, the edge of the world and its choke, seed validation, the sanctum, site, landmark, signpost and chest plans (and what a landmark hands over), the scatter lattice (`MIN_SEPARATION`, `SCATTER`, the per-band spawn chance and the gem density taper), coin values, water and the leash, light durability and shapes, the merchant's prices and the cheat switch's reach. Imports nothing — it is a table, not code |
  | `src/text.js` | **Every word the game says to the player, and nothing else**: the title screen and its tagline, the slot picker, Settings, the HUD's counters and status line, every dialog — the hut, the recap, the death screen, the menu, the edge — the merchant, the map, the panels, and each item's name and card copy. Anything that varies is a function of what it varies on, so copy and the number it quotes cannot drift apart. Imports only `src/balance.js`, for the refill figures the water cards quote. No layout, no logic — a scene never spells a player-facing string itself |
  | `src/config.js` | Screen/HUD/tile layout constants, the palette table, the active-palette accessor and `setDefaultPalette` — which sets it from a run's biome, the only way it is ever set (§4.3) — `invertColour` and the two ways the game is drawn inside out (§4.9): the Settings switch and the override the ending itself draws with, both of which reach the whole screen because every colour in the game comes out of `getPalette`, `gemColour` and `paletteColour` — the music and cheat switches (§9, §6.2, persisted to `localStorage`), the move-speed setting (`getMoveSpeed`/`setMoveSpeed`, 2-10 steps/second, persisted the same way — §7), `FLOOR_TEXTURE_LEVEL` — how strongly ground texture is drawn — and `gemColour`, which colour each recovered gem paints in. Holds no gameplay numbers; those are `src/balance.js`'s |
  | `src/core/world.js` | The three layers (§4.3): seeded hash → terrain; the seed-derived sanctums, sites, landmarks, signposts and chests (`sanctums`, `sanctumAt`, `sites`, `siteAt`, `isMerchant`, `landmarks`, `landmarkAt`, `signposts`, `signpostAt`, `signpostTargets`/`signpostReadings`/`signpostHutBearing`, `chests`, `chestAt`, `entryKey`/`canEnter` — which key a tile wants — and `blocksSight`, what stops a light rather than a step); `uniqueAt` and the separation-thinned `consumableAt`, composed by `itemAt`; and `reachableFraction`/`sitesReachable`/`pickSeed` for the run-start seed validation, plus `variantAt` — which of a terrain's tiles a square draws — and `biomeOf`, which kind of world a seed is (§9, §4.3). The machinery only: every number it is tuned on comes from `src/balance.js`, where `MIN_SEPARATION` and the `SCATTER` table are the two things to retune. Pure, no Phaser |
  | `src/core/compass.js` | Which unique object the compass points at, and the heading to draw, snapped to the four the needle has sprites for. Pure |
  | `src/core/cartography.js` | Run-length encoding the explored set into something a save slot can hold, and back. Pure |
  | `src/core/light.js` | Light shapes: given a light, a tile, and a facing, the set of visible tiles — and, handed a predicate saying what is opaque, the same set with its shadows cut out of it (§4.1). Knows what a shadow is and nothing at all about rock, which is what keeps it pure |
  | `src/core/rules.js` | The run: step legality (including gates and chests), durability tick, burnout/auto-swap, water depletion/refill and the death condition, pickup, `openChest`/`chestOnTile` for the lid, `hallMeeting` for which of the five conversations the sorcerer is having and whether this one is the ending, `turnCycle` and `mouldSeed` for the world he moulds next (§4.9), reveal, `inventoryStacks` for grouping same-id copies for display, `depositRun` for what reaching the hut writes down and `bankRun` for the same thing plus the end of the expedition, `rememberGround` for the ground a run keeps however it ends, `abandonRun` for the death that takes the slot's saved walk with it, `suspendRun`/`resumeRun` for the menu's SAVE GAME and the LOAD GAME that carries it on (§6.1), the cheat setup (§6.2), and `runSummary` for the recap. Pure |
  | `src/core/save.js` | The three save slots and which one is active: load, write, erase, start, the keys held and chests opened, which kinds of world the campaign has finished (§4.9), the slot listing the picker draws, the shape of a suspended expedition (§6.1), and the normaliser every save — and every run block inside one — passes through whichever direction it came from. Pure bar its `localStorage` access, which is guarded |
  | `src/data/items.js` | Item definitions — sprite key, `hue` (the gem colour it's drawn in), the three keys and the two tools. The words (name, effect text) are spread in from `src/text.js` and the numbers (durability, light shape, water refill) from `src/balance.js`; which gem brings an item into the world is the `SCATTER` table's, not an item's |
  | `src/data/biomes.js` | The four biomes (§4.3): what each is called and the palette it is drawn in. Which tiles each draws is `src/data/tiles.js`'s, and which biome a world is is `biomeOf`'s |
  | `src/data/shop.js` | The merchant's stock order and which lines are one-offs; the prices themselves are `src/balance.js`'s |
  | `assets/tiles.png` | The tile sheet: 49×22 tiles of 16px, 1px apart, near-white on transparent. The game's only binary asset |
  | `tiles.html` | A development page, not part of the game: draws the sheet with its coordinates on it and boxes the tiles the game claims, so a tile can be found by looking at it. The way in to the other three, which it links whatever is picked to |
  | `paint.html` | A development page, not part of the game: paints a tile's colour zones for `src/data/paint.js`, previewing it at nought to three gems — the tile every world falls back on, or one biome's own version of it |
  | `draw.html` | A development page, not part of the game: draws the pixels of one tile of the sheet and exports the sheet as a PNG to save over `assets/tiles.png` |
  | `biomes.html` | A development page, not part of the game: says which tile of the sheet each of the world's own sprites is cut from, for all biomes at once or for one, and builds a terrain's list of tiles by clicking them off the sheet — the two tables in `src/data/tiles.js` (§4.3) |
  | `distances.html` | A development page, not part of the game, and the one that is not about the sheet: how far apart everything a world stands up is, measured from the hut door — the rose, the ladder, the chain and the pair matrix described in §4.4 |
  | `src/data/tiles.js` | Which **(col, row)** of the sheet each sprite key is cut from — one tile, or a list to alternate between — plus the sheet's geometry, `VARIANT_KEYS` (the terrains that alternate), `variantKey` for picking one of a terrain's tiles, `wallSprite` for picking a piece of the wall nine-slice, and `BIOME_TILES` with `biomeKey` for the world tiles a biome draws differently (§4.3). The only place that knows the sheet exists |
  | `src/data/sprites.js` | Everything the sheet can't give: the colour zones a tile is cut into, the floor's half-strength texture, and a biome's own version of a tile it repoints — all derived from a sheet tile rather than drawn a second time |
  | `src/ui/textures.js` | Loads the sheet, cuts the named tiles out of it as 1-bit masks, and bakes each into a greyscale texture at boot. Rejects a sheet of the wrong size, a mask that isn't 16×16, and a stray mask character |
  | `src/ui/MapView.js` | The tile pool, the three visibility states, per-tile tinting (gates and gem-tier items), the step slide and the blocked-step bump. Holds no game state |
  | `src/ui/hud.js` | The grouped, icon-led run counters (explored, coins), the stacked inventory strip with **ITEMS** as one more slot in it, the active light's durability and water's — same size, stacked one under the other — and the status line |
  | `src/ui/scroll.js` | A drag/wheel-scrollable, mask-clipped list region shared by the item card's instance list and the inventory panel |
  | `src/ui/sfx.js` | Every sound but the music — the tap, the pickup blips, the gem fanfare, the chest lid, the key turning, the torch, the death knell and the sun coming back (§4.9) — plus the one `AudioContext` and the master gain everything audible goes through. No assets, and silently inert where audio is unavailable |
  | `src/ui/music.js` | The two loops: both scores as text, the square-wave voices, and the lookahead scheduler that writes them to the clock. The track follows the scene — `menu` for the title, slot picker and settings, `explore` for a run |
  | `src/ui/shop.js` | The merchant's counter: a row per line of stock, over the purse it's paid from |
  | `src/ui/worldMap.js` | The map overlay: explored ground baked into a canvas texture a pixel a tile, plus markers — and the pinch/drag/wheel/button zoom and pan over the top of it, which are one container's scale and position |
  | `src/ui/compassBadge.js` | The needle and target icon in the navigation rail |
  | `src/ui/dpad.js`, `src/ui/itemCard.js`, `src/ui/inventoryPanel.js`, `src/ui/dialog.js`, `src/ui/button.js`, `src/ui/slider.js` | The D-pad, held to repeat a step at the rate `getMoveSpeed` gives; the item card overlay (single-copy or scrollable instance list); the full scrollable inventory panel, with the gem-pip row above its list; the title/rows/buttons dialog the hut, the recap and the cogwheel menu all use, its buttons in a row or stacked one per line once there are more than two; the shared bordered button; the shared drag-or-tap slider, used once for the move-speed setting |
  | `src/scenes/` | `TitleScene`, `SlotScene` (the NEW GAME / LOAD GAME picker, which says which slots are mid-expedition), `SettingsScene` (the music switch, the move-speed slider, the cheat switch, the inversion that rides with it — and, opened from a run, the way back into it), `ExploreScene` (the run, the cogwheel menu hanging off it, and the light explosion that ends the game), `CreditsScene` (what is on the other side of that explosion, and the only scene drawn with the colours inverted — §4.9) |
  | `tests/` | `harness.js` (local server + Playwright driver + runner), `world.js` (the seed and every route BFSed out of it), fourteen `*.test.js` suites and `all.test.js`, which runs them all — see `TESTING.md` |

- **Sprites are coordinates on one sheet.** `src/data/tiles.js` names a **(col, row)** of `assets/tiles.png` per sprite key; the tile is cut out as a 1-bit mask at boot, baked into a white texture and tinted at draw time. One image, no image editor to repoint a sprite, no build step — and one texture set serves all four palettes.

- **Explored-tile storage:** a `Set` of `"x,y"` keys for tiles ever lit. Terrain and items are re-derived from the seed on demand, so nothing else about the world needs storing. A run additionally keeps only what the recap reports plus the water level: the coin count, the current water, the gem count, the keys held, the chests opened, the two tools, the high-water mark of distance from the base, and a tally of what it has picked up — and, per epoch, the set of consumable tiles it has emptied, which a respawn simply clears. That short list is exactly what a suspended expedition writes into its slot (§6.1), run-length encoded the same way the explored set is: saving a run is describing it, never copying a world.
- **The structures are derived, then memoised.** Placing four sanctums, eight landmarks, five sites, nine chests, fourteen posts, four carved stones and ten wisps costs trig plus a bounded flood probe each, and `terrainAt` asks where they are on *every* tile lookup, so they're worked out once per seed and cached. The cache is a derivation, not world state: nothing in it is authored, and a given seed always produces the same fifty-four. They are placed onto one claimed list, in the order each needs: the landmarks take their eighths of the rose first, because they are the most constrained and everything else is placed against them; then the sites; then the chests, four of which want a landmark to stand beside; then the posts, which have to keep their distance from every landmark there is; and last the stones and the wisps, the two things a world may go without. Placement deliberately reads the noise terrain directly rather than `terrainAt`, because asking `terrainAt` where a sanctum can go would ask where the sanctums are.
- **Nothing draws the world's own shape but the page that was built to.** The structures are forty-four numbers spread over six plans, and the only way to see whether they add up to a walk is to walk them: `distances.html` derives a world exactly as a run does (`pickSeed`, then the same structures), floods the ground once out of the hut door with every gate open — a byte a tile and one breadth-first pass, about eighty milliseconds — and reads every distance off that one fill. The fill's own bounds are `EDGE_RADIUS`, taken off `balance.js` rather than typed: past it a step is refused, so a grid of that half-width holds every tile a walk could stand on and needs no margin of its own. Sampling a run of worlds is the same work repeated, which is why it is a button rather than something the page does on the way in. It imports `core/world.js`, `balance.js`, `config.js` and the three data tables it names things out of (`biomes`, `landmarks`, `items`), and nothing else; there is no Phaser on it and no state in it.
- **The consumable scatter is thrown, then thinned, then memoised.** A tile asks its lattice cell whether a candidate lands there, and a candidate is crowded out only by a same-kind conflict that *itself* landed — resolved by a short recursion that only ever walks to higher-priority candidates, so it terminates. Dropping every candidate that merely has a stronger neighbour would keep only local maxima and thin the world to a third of what the separation rule actually allows. The recursion is memoised per (seed, salt, gems); a respawn moves the salt, and old memos are dropped wholesale because the cache is a speed-up and never state. A full viewport repaint costs about a tenth of a millisecond.
- **Run-start cost.** `pickSeed` flood-fills for the base pocket check and again out past the furthest sanctum for the reachability check — about 90ms in total on this machine, paid once, during a scene transition, and **memoised per preference** (`pickedCache` in `core/world.js`, the same idiom as the structures), so a slot asked the same question again — every run built off the same save — pays nothing the second time. That second fill short-circuits as soon as it has reached every door, site, landmark and chest, and never runs at all for a seed the cheaper pocket check has already rejected. Roughly one seed in ten is bumped, about three in five of those by the pocket check.
- **The page has to be the viewport.** Phaser fits the canvas to its parent element, so `#game` is sized to the full viewport and Phaser's own `autoCenter` does the centring. Centring the parent with flexbox instead leaves it shrink-to-fit — a size Phaser cannot fit into, which on a portrait phone scaled the canvas to the viewport *height* and let the width overflow: the sides of the HUD ran off screen and the page panned sideways, which ate taps, because a touch the browser is still deciding might be a pan never becomes a click. The canvas also sets `touch-action: none` so there is no pan gesture to wait on. `tests/ui-shell.test.js` pins this with a phone-sized viewport.
- **Rendering the viewport:** the tile window is repointed around the character's coordinate each step rather than instantiating sprites for a growing world — a fixed pool of 11×15 cells (three sprites each: ground, base hut, item) whose texture and alpha are reassigned from whatever tile now sits at that screen position. Sprite count stays constant however far you walk. A step slides the whole tile container one tile and tweens it home in 90ms, so the world moves and the wizard doesn't; input is blocked for that tween so a fast tapper can't outrun the renderer.
- **Key technical risks:**
  - Keeping the world genuinely unbounded — all tile lookups go through the seeded generator, never an array, and the camera works in world coordinates so there's no origin to drift from.
  - Swipe vs. tap disambiguation on the map area, with the D-pad live at the same time.
  - Colour discipline surviving contact with Phaser defaults (text, UI, particles all need explicit tinting) — and now that a tile's tint depends on the run rather than only on the palette, tints are reassigned on every repaint instead of once at construction. An object tinted only at construction silently stops tracking the gems.
  - The half-strength floor texture carrying the whole "this is ground I have lit" read on its own, including at the remembered state's ~30% alpha.
- **Testing:** `balance.js`, `core/world.js`, `core/light.js`, `core/rules.js` and `core/save.js` are pure and importable from Node, so light shapes, durability/burnout sequencing, spawn distribution, sanctum geometry and gate legality are unit-tested without a browser; everything a player *does* is driven against the real canvas with Playwright. Because there are no hand-authored levels to write coordinates against, the tests BFS the real world at load time to find their targets (the nearest torch, the nearest rock to walk into, the route to the first gem) and replay the route — see `TESTING.md`.

## 12. TODO — deferred, not yet designed

Not part of the initial implementation, listed here so the MVP doesn't paint them out:

- **Vault.** The base holds a vault; items and coins you're carrying are only truly *yours* once you've walked back and stored them. That's what turns "how far out can I get" into a decision with a cost, and it's the intended next step after the MVP proves the walk is interesting.
- **A reason to carry a light home.** Lights bank nowhere: the recap says what you were holding and then it's gone. The vault above is one answer; selling them back to the merchant is another.
- **What a cycle is worth.** The purse and both tools go with the world (§4.9), so the only thing a campaign accumulates across cycles is the seven standings, and only three of those are numbers (§4.10.5) — one of which, the Weighhouse's quarter off every price, is aimed straight at this problem. The consequence, measured rather than guessed: one world's coin income is roughly 430 — about 40 piles averaging 3, plus six chests at 30-75 — against a 250 compass and a 50 map, so a campaign that loses both every cycle spends almost its whole income re-buying tools it already had, and in practice rarely reaches the compass at all. Either the cycle needs a meta-currency that is not coins, or the coins need somewhere else to go, or the tools need to survive after all. **The rule itself is settled and the code is right; what is unfinished is what fills the hole it leaves.** `STORY.md` §13 records the argument for the other answer, and why it was not taken.
