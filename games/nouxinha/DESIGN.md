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

Somewhere out there are three gems, and each one gives the world back a colour it lost. Finding one is not the hard part — carrying it home is, because the hut is the only place a run is ever written down.

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

1. Find the first sanctum and take the gem at its centre — the world gains a colour, and items you'd walked past all along become visible
2. That tier of items carries water further, which is what makes the next sanctum survivable at all
3. Its gate wants the gem you're carrying, so the ground beyond it opens for the first time
4. Walk home and stop at the hut to write it down. Die on the way and the gem goes back where it came from

## 4. Core mechanics

The world has three things in it: **terrain** (floor, rock, and the built walls and gates of the sanctums — all static and procedurally generated), **items** (lights, water, coins and gems, lying on floor tiles until picked up), and **the character** (one tile, one facing).

| Mechanic | Description | Input |
|---|---|---|
| Tile stepping | The character moves exactly one tile per input, in a cardinal direction. Rock and sanctum wall are impassable, and so is a gate you don't hold the gem for: a rejected step costs no durability and doesn't change facing. The character's **facing** is the direction of their last successful step (it starts pointing north from the base). | Swipe in a cardinal direction anywhere on the map, or tap the D-pad |
| Gems and gates | Three gems sit at the centres of walled **sanctums** scattered around the hut. Picking one up gives a colour back to the world and opens the gate that wants it (§4.4). | Walk onto the gem |
| Saving | A run is only written down by stopping at the hut (§6). Dying of thirst or leaving by the map's **X** writes nothing, so a gem picked up but not carried home is still out there next run. | **STOP HERE** on the hut's dialog |
| Light & visibility | The active light source defines a **shape** of tiles visible from the character's tile (see §4.1). Every tile has one of three states: **unknown** (never lit — drawn as flat background, indistinguishable from any other unknown tile), **remembered** (lit at some point — drawn dimmed), **lit** (inside the current light shape — drawn full brightness). Items and terrain are only readable in the lit state; a remembered tile keeps showing whatever was there when you last saw it. | — |
| Durability | Each successful step costs **1 durability** off the *active* light only. Rejected steps (into rock) cost nothing. Carried-but-inactive lights never burn. At 0 the light is spent and removed from the inventory, and the next light in inventory order auto-equips. With no lights left the character is in **blackout**: the light shape shrinks to the character's own tile. Blackout is not death — you can still walk home over remembered ground, and remembered tiles stay legible. | — |
| Water | Every successful step also costs **1 water**, independent of the light and never affected by blackout. Water starts at **200** and each gem held raises that ceiling by **50**, to 350 with all three. A water pickup refills by its own amount (§4.2), capped at the ceiling. Unlike light, water has no auto-swap or backup: hitting **0** is the run's one hard failure state — the run ends and everything carried is lost (§6). The balance numbers are named constants at the top of `src/core/rules.js` (`STARTING_WATER`, `WATER_PER_STEP`, `WATER_PER_GEM`) so they can be retuned without touching the mechanic itself. | — |
| Pickup | Stepping onto a tile holding an item picks it up automatically, with a short rising blip (§9). Lights go into the inventory unequipped; coins, water and gems apply immediately (coin counter, water level, colour restored) rather than sitting in the inventory. An item needing more gems than you hold isn't there to pick up at all (§4.3). | — |
| Coming home | Stepping onto the base asks whether to stop: **KEEP GOING** dismisses the question and the expedition continues, **STOP HERE** ends the run on a recap (§6) and returns to the title screen. It asks rather than assumes because the hut is also just a landmark to cross on the way somewhere else. Nothing else about the base tile changes — arriving costs a step and burns durability like any other. | Tap a button on the dialog |
| Fixed camera | **The character never moves on screen — the world moves around them.** The character sprite is pinned to the exact centre of the map viewport and every step scrolls the world one tile in the opposite direction. This is the first thing to reconsider if the game feels static: the alternative is a camera that only scrolls when the character nears the viewport edge, which reads as more grounded but hides how much dark is on each side. | — |

### 4.1 Light sources

A light shape is defined relative to the character's tile, and — for the lamp — relative to their facing. Rock does **not** occlude light in the MVP: the shape is applied literally, so you can light the far side of a wall. Line-of-sight occlusion is a nice-to-have (§8).

| Light | Shape | Durability | Notes |
|---|---|---|---|
| Small torch | Radius 1 — the 3×3 block centred on the character | 100 | The starting light, and the only item in the inventory at the start of a run |
| Medium torch | Radius 2 — the 5×5 block centred on the character | 50 | Twice the reach, half the leash |
| Lamp torch | A cone in the facing direction: 1 tile ahead → 1 wide, 2 ahead → 3 wide, 3 ahead → 5 wide, plus the character's own tile. Nothing behind or beside. | 60 | Reaches furthest of the three but only forward — turning re-aims it, so it rewards committing to a direction |
| Beacon | Radius 3 — the 7×7 block centred on the character | 140 | Needs **2 gems** to be visible. The one light that breaks the "more reach, shorter leash" trade, because it exists to make the walk to the third sanctum possible at all |

Only one light is active at a time. Equipping is manual (via the item card, §7) except for the auto-swap on burnout.

### 4.2 Items that aren't light

Water items differ only in how much they give back — the point of the better ones is range, since the sanctums sit further out than a starting run can reach (§4.4).

| Item | Gems needed | Effect |
|---|---|---|
| Coin | — | Currency. Accumulates in a counter in the HUD, and banks at the hut. Nothing spends it yet — the merchant is deferred (§12). |
| Water drop | — | Refills water by 20 (§4). Running dry is the run's one death condition — this is the thing worth detouring for. |
| Water flask | 1 | Refills water by 60. Three drops in one. |
| Spring vial | 3 | Refills water to the ceiling, wherever you are. |
| Gem | — | One per sanctum, three in all. Gives a colour back to the world and opens the gate that wants it (§4.4). |

### 4.3 The world

Effectively infinite and **procedurally generated from a seed**: terrain and item spawns are derived by hashing the tile's `(x, y)` against the run's seed, so a tile's content is the same every time you walk back to it and nothing needs storing except which tiles you've seen. There is no world edge.

- The **base** sits at `(0, 0)` and is where every run starts. Its 3×3 neighbourhood is forced to floor so you can never be walled in at spawn. It renders as a hut with a flag so it's recognisable from the edge of your light, and it's the one tile that's always on the map. The hut isn't drawn while the wizard is standing on it — two dense sprites on one tile read as an unidentifiable blob, so the wizard is simply in the doorway.
- **The seed is validated at run start.** A clearing at spawn isn't enough: at any rock density that still looks like a cave system, a noticeable slice of seeds seals the base into a pocket of a few tiles, which would break the promise that the character is never permanently stuck (§5). So a run flood-fills a 40-tile window from the base and rejects a seed that can't reach most of the floor in it, bumping to the next seed until one opens up. Carving guaranteed corridors into the noise would be the alternative, and it leaves a visible lattice; this keeps the terrain organic and costs a few milliseconds once per run.
- Rock density comes from one noise channel; item spawns from another. **Item quality scales with distance from the base** — coins and water drops near home, medium torches in the middle band, lamp torches only far out. That's what makes walking away from the base worth the durability (and the water).
- **Gem-tier items are in the world from the start and invisible until their gem.** A flask lies on its tile whether or not you can see it; the run simply doesn't report an item whose `unlock` is above your gem count. That's why a gem makes ground you have *already walked* worth walking again, and it's a filter on the run's view of the world, not a second world.
- The base is where a run ends: walking onto it offers to stop, which banks the expedition and writes the save (§6). Beyond that it has no function until the vault exists (§12).

### 4.4 Sanctums, gates and gems

The one built structure in an otherwise noise-grown world, and the spine of the campaign. There are **four sanctums**: a ring of masonry wall around a clearing of forced floor, with a gem at the centre and exactly one **gate** in the ring.

| Sanctum | Distance from the hut | Ring radius | Gate wants | Holds |
|---|---|---|---|---|
| 1 | 20 | 4 | nothing — the arch stands open | The first gem |
| 2 | 45 | 5 | 1 gem | The second gem |
| 3 | 80 | 6 | 2 gems | The third gem |
| 4 | 110 | 7 | 3 gems | No gem — the richest cache in the game, and what the third gem is *for* |

- **The chain is the pacing.** Sanctum 1's arch is open because the first gem has to be reachable carrying nothing; every gate after it wants the gem from the sanctum before it. Since each gem also raises the water ceiling by 50 and reveals a tier of items that carry water further, the gem you just found is precisely what makes the next sanctum survivable — the distances above are past what a gemless run could walk home from.
- **Positions are derived from the seed, not authored.** Each sanctum takes a quarter of the compass with a jitter inside it, so the four always sit in different directions at different distances (a new seed relays all four, and no two are ever within 45° of each other). Distance is Chebyshev and exact, so a sanctum's ring lands on the number the HUD's furthest-out counter reports.
- **The gate always faces the hut**, on a wall *face* and never a corner — there are no diagonal steps, so a corner gate could never be walked through. The tile you approach from is therefore always orthogonally adjacent to the tile you walk into.
- **A sanctum's clearing is forced floor**, so once you are through the gate the gem is always reachable. That is what lets the seed check below worry only about the door.
- **Reachability is guaranteed by placement, then by the seed.** Roughly one seed in six drops a given sanctum where a rock blob seals its door into a pocket against its own wall. Rather than reroll the whole world for it, the sanctum is *turned* a few degrees around the hut until its door opens onto the cave system — measured with a bounded flood probe, which separates the two cases cleanly (a sealed door measures 6–22 tiles, a real one runs past the 80-tile limit). `pickSeed` then rejects any seed that still leaves a door sealed, which after placement is about 2 seeds in 120. Carving corridors to each gate was the alternative and was rejected twice over: it leaves the visible lattice §4.3 avoids, and a road pointing at each gem removes the search that makes finding one worth anything.

## 5. Constraints

- One light active at a time. Light and water are the two consumables — no food yet (§12), no timer.
- The character can never be permanently stuck: blackout still allows movement, the base's neighbourhood is always walkable, and no gate ever seals a run *in* — gates only ever hold ground back, never fence it off.
- Water is the one thing that can actually end a run: it depletes every step regardless of light state, and hitting zero is fatal (§6).
- **Two colours, plus one per gem recovered.** The world starts strictly duo-chromatic and can reach five colours only by earning them (§9). Every sprite is still authored as a 1-bit mask, so what a gem changes is a tint at draw time, never an asset.
- Every gem is optional. Nothing in the game requires finding one; the sanctums gate their own contents and nothing else.
- Portrait, mobile-first, touch as the primary input. 480×854 fixed canvas.
- Turn-based: the world only advances when the player steps. No real-time pressure.
- No build tooling: Phaser 3 from a CDN `<script>` tag, game code as plain ES modules.
- No external art assets beyond the game's own pixel sprites.

## 6. Win / lose conditions

- **Win:** bringing all three colours home. It is a destination rather than an ending — the world is still there afterwards, with the fourth sanctum's cache open and nothing left to unlock.
- **Lose:** running out of water. It depletes independently of light and never auto-refills — only a water pickup does that — so hitting 0 ends the run on the spot and everything carried is lost, with a short screen reporting tiles explored, furthest distance, and steps taken before returning to the title screen. Running out of light, by contrast, is a setback (blackout), not a failure state; nothing about light kills the character.
- **Session end:** the player walks back to the hut and takes it up on the offer to stop (§4). The HUD tracks the numbers that stand in for a score while you're out — **tiles explored** (distinct tiles ever lit), **coins**, **water** remaining, and the row of **colours** recovered — and stopping at the hut closes the run with a **recap**: tiles explored, coins, lights found, colours saved, furthest distance reached, steps taken, and what's still in hand.

### 6.1 Saving

**The hut is the only place a run is written down**, and that single rule is what gives the walk home its weight.

- There is **one save slot**, holding the gem count, banked coins, runs completed, and the furthest distance ever reached. It lives in `localStorage` and is the only state that outlives a run.
- **Stopping at the hut** is the only thing that writes it. Dying of thirst writes nothing, and leaving by the map's **X** abandons the run and writes nothing either — so a gem picked up but not carried home is still sitting in its sanctum next run.
- The hut says so plainly when you arrive carrying a gem, because a player who doesn't know this rule can lose an hour's walk to it without ever being told the rule existed.
- A save is normalised on the way in and out, so a corrupt or hand-edited file costs the player their progress at worst — never the run's arithmetic.
- **Erasing** is in Settings, and asks twice: the first tap arms the button, the second does it.

## 7. Controls

Touch is primary. Keyboard is a desktop convenience, not a design target.

| Action | Input (touch — primary) | Input (keyboard/mouse) |
|---|---|---|
| Step | Swipe in a cardinal direction anywhere on the map area, or tap a D-pad arrow (bottom right of the HUD) | Arrow keys / WASD, or click a D-pad arrow |
| Inspect a stack | Tap its slot in the inventory strip (bottom left of the HUD) → opens the item card | Click the slot |
| Browse the full inventory | Tap **ITEMS** next to the strip → opens the scrollable inventory panel | Click **ITEMS** |
| Equip a light | Tap **Equip** on its item card (single copy), or tap a copy's row in a stack's instance list (multiple copies) | Click the same |
| Close an overlay | Tap its close control, or tap outside it | Click, or press Esc |
| Answer the hut | Tap **KEEP GOING** or **STOP HERE** on the dialog | Click |
| Change palette | Settings, from the title screen | Same |
| Leave the run | Tap **X** in the top right of the map | Click **X** |

**Stacking.** The inventory strip and panel both group carried lights by kind rather than showing one slot per copy: a kind you're carrying more than one of shows a single icon badged `×N`. The run itself still tracks every copy separately, in pickup order, each with its own durability — grouping is purely a display concern, so equipping still targets one specific copy.

**The item card** is an overlay, opened from a slot in the strip or a row in the inventory panel, showing: the item's name, its sprite at large scale, and a one-line **effect** description ("Lights the 8 tiles around you"). A kind carried as a single copy shows that copy's **durability** as `current / max` with a bar and an **Equip** button (greyed out if it's already active). A kind carried as several copies shows a scrollable list instead — one row per copy, its own durability bar, and an `EQUIPPED` tag on whichever is active — since copies rarely share a durability and the choice of *which* one to equip has to be visible; tapping a row equips that exact copy and closes the card. Opening a card doesn't cost a step — the game is turn-based on movement only.

**The inventory panel** is opened from the HUD's **ITEMS** button and lists every carried stack — icon, name, and count — in a scrollable list, so a run isn't limited to what fits in the strip's slots. Tapping a stack closes the panel and opens its item card.

**The hut dialog** is the other overlay: a title, a line or a two-column readout, and a row of buttons. It has no close control of its own — every way out is one of its buttons, because both of its uses (the stop/continue question and the recap) are decisions rather than inspections. Like the item card it owns the whole screen while it's up: nothing behind it steps, swipes, or answers a key.

**Screen layout** (480×854):

- Top 624px: the map viewport. 48px tiles, with the character's tile centred exactly on the viewport centre (240, 312). Because 480 and 624 are both whole multiples of 48, exact centring puts the grid on a half-tile offset: 9 full columns plus a half column bleeding off each edge, and 12 full rows plus a half row top and bottom. That partial outer ring is a feature — tiles cut by the screen edge read as "the world keeps going", which is the right message for this game.
- Bottom ~230px (about a quarter): the HUD. Inventory strip, the **ITEMS** button, and the run counters (tiles explored, coins, water) on the left; the four-direction D-pad on the right, thumb-reachable. Under the status line, the **COLOURS** row: one gem pip per gem, the recovered ones in the colour they gave back and the rest dimmed, so the row always says how many there are left to find.

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
- A synthesised pickup blip
- Four seed-derived sanctums with masonry walls and gem-gated gates, guaranteed reachable (§4.4)
- Three gems, each restoring a colour, opening its gate, raising the water ceiling, and revealing its tier of items
- One save slot, written only by stopping at the hut, with progress on the title screen and an erase in Settings

**Nice to have (only after MVP works):**
- Line-of-sight occlusion so rock actually casts shadow
- Light falloff — an outer ring at partial brightness instead of a hard edge
- More light sources (something that lights a fixed radius around a *dropped* point, a one-shot flare that reveals a wide area for one step)
- A compass or a base-direction hint for walking home in blackout, and for pointing at the sanctum you haven't found yet
- More landmarks in the terrain generator: the sanctums are the only built structure, and the ground between them is still pure noise
- Minimap of remembered tiles
- Screen-shake-free CRT dressing: scanline overlay, phosphor bloom on the lit ring

**Explicitly out of scope:**
- Combat, enemies, or any threat
- Music, and any sound beyond the pickup blip
- Multiplayer, leaderboards
- Save/load of a run *in progress*. The save records what a finished run banked, not where you were standing — quitting mid-expedition abandons it, which is the point of §6.1

## 9. Art & audio style

- **Visual style:** Pixel art, **duo-chromatic**, retro CRT. Two colours are on screen at any moment — a dark background and a single foreground used for every tile border, the character, items, HUD, and text — **and one more for each gem recovered**. Sprites are authored as 16×16 1-bit masks (foreground shape on transparent) drawn at 3× with nearest-neighbour filtering and tinted at draw time, which is what makes both a palette swap and a restored colour a tint change rather than an asset rebuild. The masks live in `src/data/sprites.js` as **text**, `#` and `.` — the art is data, it diffs in git, and changing it needs no image editor (see §11).
  - **What a gem repaints, and what it doesn't.** Terrain is the constant: floor, rock and sanctum wall stay in the palette's own foreground however many gems you hold, because they are the thing every other colour has to read *against*. What changes is the character (who wears the newest colour brought home), the items of that gem's tier, the gem pips in the HUD, and any gate that gem opened. A gem's colour is the foreground of a palette you are **not** playing in — play PHOSPHOR and the three gems are amber, cyan and magenta — so a restored colour is always one the world genuinely did not have, and it is guaranteed to read against the background because those four combinations were already chosen to.
  - **An open gateway is drawn as plain floor while the character stands in it.** Two dense sprites on one tile read as one unidentifiable blob, which is the same reason the hut isn't drawn underneath them; it bites harder here, because a character wearing a gem's colour can be standing on a gate wearing the *same* colour.
  - **Tile edges:** a floor tile draws its dotted border on its top and left edges only, so the edge shared by two known tiles is drawn once rather than doubled. It closes off its right or bottom edge only where the neighbour there is still unknown, so the frontier of explored ground reads as a boundary instead of an unfinished grid.
  - **Three visibility states, one colour:** lit = foreground at full alpha; remembered = the same foreground at ~30% alpha; unknown = nothing drawn at all, just background. Dimming by alpha rather than by a third colour is what keeps the two-colour rule intact.
  - **Floor is its border and nothing else.** An empty floor tile is bare background inside a dotted border — no stipple, no scatter, no per-tile decoration. The dotted grid alone separates "ground I have lit" from "dark I have never been to", and it holds that read at the remembered state's 30% alpha. Loose pixels in the middle of a tile were tried and cut: one tile's worth looks like texture, a viewport's worth looks like noise, and they compete with the things that actually matter — the wizard, the items, the frontier. Rock uses the inverse weight: a dense, near-solid mask, so a rock wall reads as a mass and floor reads as a surface.
  - **Items are drawn hollow.** A solid silhouette turns to mush at 16×16 once it's tinted flat, so the torches, the lantern, and the waters are outlines with small solid accents — the hollow interior is what gives the eye an edge to read. The lights differ in *silhouette* rather than in detail (a thin stick, a fat stick, a lantern, a bowl on splayed legs), because they have to be told apart at the edge of the light. The three waters have the same job and solve it the same way: the drop is a teardrop, the flask square-shouldered and hard-sided, the vial round-bottomed and sparkling, each with its water pooled solid in the bottom.
  - **Sanctum wall is a grid where rock is a blob.** Rock is a dense, near-solid organic mass; the wall is coursed masonry with staggered joints. That contrast is load-bearing rather than decorative — a player who reads a sanctum wall as terrain walks its perimeter looking for a way round instead of looking for the gate. A shut gate is a barred arch drawn in the palette's own foreground, because a gate you can't open yet is just more wall; an open one is the same arch with the leaves folded back, in the colour of the gem that opened it.
  - **One gem sprite, three tints.** The gems differ by the colour they gave back and nothing else, so drawing three masks would be three ways of saying the same thing.

- **The character** is a small wizard: pointed hat, robe, staff held to one side. Four sprites, one per facing, and the sprite swaps on every step so the facing is always readable — this matters mechanically, because the lamp torch's cone points wherever the character does.

  | Facing | Reads as |
  |---|---|
  | Down (toward the player) | Front view: face under the hat brim, staff on the right |
  | Up | Back view: hat and shoulders, no face, staff still visible past the shoulder |
  | Left / Right | Profile: hat point trailing back, staff planted forward in the facing direction (one sprite mirrored for the other, unless the staff hand needs to differ) |

  At 16×16 the hat silhouette and the staff line are the whole identity — those two shapes have to survive the 1-bit mask; detail below that gets cut.
- **Palettes:** four combinations, chosen in Settings, persisted in `localStorage`, all CRT-flavoured:

  | Name | Background | Foreground |
  |---|---|---|
  | Phosphor | `#0b1a0b` | `#33ff66` |
  | Amber | `#1a0f00` | `#ffb000` |
  | Cathode | `#06121a` | `#4fd0ff` |
  | Magenta | `#14061a` | `#ff5fd2` |

- **Reference:** monochrome terminal monitors, Downwell (two-tone discipline), classic roguelike fog of war.
- **Audio:** one sound — a short rising square-wave arpeggio when you pick something up, two notes for a coin and three, landing higher, for a light. Synthesised through WebAudio rather than loaded as a file, for the same reason the sprites are text: no binary assets, no build step. Square waves are the audio equivalent of the two-colour rule. It is best-effort by design — a browser that blocks or lacks audio costs the player nothing.

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
  | `src/config.js` | Screen/HUD/tile layout constants, the palette table, the active-palette accessor (persisted to `localStorage`), and `gemColour` — which colour each recovered gem paints in |
  | `src/core/world.js` | Seeded hash → terrain and item spawn for a tile coordinate; the seed-derived sanctums (`sanctums`, `sanctumAt`, `canEnter`); and `reachableFraction`/`gatesReachable`/`pickSeed` for the run-start seed validation. Pure, no Phaser |
  | `src/core/light.js` | Light shapes: given a light, a tile, and a facing, the set of visible tiles. Pure |
  | `src/core/rules.js` | The run: step legality (including gates), durability tick, burnout/auto-swap, water depletion/refill and the death condition, pickup, reveal, `inventoryStacks` for grouping same-id copies for display, `bankRun` for the hut's save, and `runSummary` for the recap. Also where the water balance constants (`STARTING_WATER`, `WATER_PER_STEP`, `WATER_PER_GEM`) live. Pure |
  | `src/core/save.js` | The one save slot: load, write, erase, and the normaliser every save passes through whichever direction it came from. Pure bar its `localStorage` access, which is guarded |
  | `src/data/items.js` | Item definitions (name, sprite key, durability, light shape, water refill, effect text) plus `unlock`/`hue` — the gems needed to see an item and the gem colour it's drawn in |
  | `src/data/sprites.js` | Every sprite, as a 16×16 text mask — including the four floor-edge variants, derived from the base pattern rather than drawn a second time |
  | `src/ui/textures.js` | Bakes the masks into white textures at boot, and rejects any mask that isn't 16×16 |
  | `src/ui/MapView.js` | The tile pool, the three visibility states, per-tile tinting (gates and gem-tier items), the step slide and the blocked-step bump. Holds no game state |
  | `src/ui/hud.js` | Run counters, the stacked inventory strip, the **ITEMS** button, the active light's durability, the status line, the **COLOURS** gem row |
  | `src/ui/scroll.js` | A drag/wheel-scrollable, mask-clipped list region shared by the item card's instance list and the inventory panel |
  | `src/ui/sfx.js` | The pickup blip, synthesised through WebAudio. No assets, and silently inert where audio is unavailable |
  | `src/ui/dpad.js`, `src/ui/itemCard.js`, `src/ui/inventoryPanel.js`, `src/ui/dialog.js`, `src/ui/button.js` | The D-pad, the item card overlay (single-copy or scrollable instance list), the full scrollable inventory panel, the hut's title/rows/buttons dialog, the shared bordered button |
  | `src/scenes/` | `TitleScene`, `SettingsScene`, `ExploreScene` |
  | `tests/` | `harness.js` (local server + Playwright driver + runner) and `game.test.js` — see `TESTING.md` |

- **Sprites are text, not images.** Each is a 16×16 grid of `#`/`.` in `src/data/sprites.js`, baked into a white texture at boot and tinted at draw time. No binary assets, no image editor, no build step — and one texture set serves all four palettes.

- **Explored-tile storage:** a `Set` of `"x,y"` keys for tiles ever lit. Terrain and items are re-derived from the seed on demand, so nothing else about the world needs storing. A run additionally keeps only what the recap reports plus the water level: the coin count, the current water, the gem count, the high-water mark of distance from the base, and a tally of what it has picked up.
- **The sanctums are derived, then memoised.** Placing four of them costs trig plus a bounded flood probe each, and `terrainAt` asks where they are on *every* tile lookup, so they're worked out once per seed and cached. The cache is a derivation, not world state: nothing in it is authored, and a given seed always produces the same four. Placement deliberately reads the noise terrain directly rather than `terrainAt`, because asking `terrainAt` where a sanctum can go would ask where the sanctums are.
- **Run-start cost.** `pickSeed` flood-fills for the base pocket check and again out past the furthest sanctum for the gate check, which measures about 29ms on average and 56ms at worst — paid once, during a scene transition. The gate fill short-circuits as soon as it has reached all four doors, and never runs at all for a seed the cheaper pocket check has already rejected.
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
- **Merchant.** What coins are for. Presumably at the base, selling lights.
