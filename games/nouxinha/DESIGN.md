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

## 4. Core mechanics

The world has three things in it: **terrain** (floor and rock, static, procedurally generated), **items** (lights and coins, lying on floor tiles until picked up), and **the character** (one tile, one facing).

| Mechanic | Description | Input |
|---|---|---|
| Tile stepping | The character moves exactly one tile per input, in a cardinal direction. Rock tiles are impassable: a step into rock is rejected, costs no durability, and doesn't change facing. The character's **facing** is the direction of their last successful step (it starts pointing north from the base). | Swipe in a cardinal direction anywhere on the map, or tap the D-pad |
| Light & visibility | The active light source defines a **shape** of tiles visible from the character's tile (see §4.1). Every tile has one of three states: **unknown** (never lit — drawn as flat background, indistinguishable from any other unknown tile), **remembered** (lit at some point — drawn dimmed), **lit** (inside the current light shape — drawn full brightness). Items and terrain are only readable in the lit state; a remembered tile keeps showing whatever was there when you last saw it. | — |
| Durability | Each successful step costs **1 durability** off the *active* light only. Rejected steps (into rock) cost nothing. Carried-but-inactive lights never burn. At 0 the light is spent and removed from the inventory, and the next light in inventory order auto-equips. With no lights left the character is in **blackout**: the light shape shrinks to the character's own tile. Blackout is not death — you can still walk home over remembered ground, and remembered tiles stay legible. | — |
| Water | Every successful step also costs **1 water**, independent of the light and never affected by blackout. Water starts at **200** and a water-drop pickup refills it by **20**, capped at 200. Unlike light, water has no auto-swap or backup: hitting **0** is the run's one hard failure state — the run ends and everything carried is lost (§6). The balance numbers are named constants at the top of `src/core/rules.js` (`STARTING_WATER`, `WATER_PER_STEP`, `WATER_REFILL`) so they can be retuned without touching the mechanic itself. | — |
| Pickup | Stepping onto a tile holding an item picks it up automatically, with a short rising blip (§9). Lights go into the inventory unequipped; coins and water drops apply immediately (coin counter, water level) rather than sitting in the inventory. | — |
| Coming home | Stepping onto the base asks whether to stop: **KEEP GOING** dismisses the question and the expedition continues, **STOP HERE** ends the run on a recap (§6) and returns to the title screen. It asks rather than assumes because the hut is also just a landmark to cross on the way somewhere else. Nothing else about the base tile changes — arriving costs a step and burns durability like any other. | Tap a button on the dialog |
| Fixed camera | **The character never moves on screen — the world moves around them.** The character sprite is pinned to the exact centre of the map viewport and every step scrolls the world one tile in the opposite direction. This is the first thing to reconsider if the game feels static: the alternative is a camera that only scrolls when the character nears the viewport edge, which reads as more grounded but hides how much dark is on each side. | — |

### 4.1 Light sources

A light shape is defined relative to the character's tile, and — for the lamp — relative to their facing. Rock does **not** occlude light in the MVP: the shape is applied literally, so you can light the far side of a wall. Line-of-sight occlusion is a nice-to-have (§8).

| Light | Shape | Durability | Notes |
|---|---|---|---|
| Small torch | Radius 1 — the 3×3 block centred on the character | 100 | The starting light, and the only item in the inventory at the start of a run |
| Medium torch | Radius 2 — the 5×5 block centred on the character | 50 | Twice the reach, half the leash |
| Lamp torch | A cone in the facing direction: 1 tile ahead → 1 wide, 2 ahead → 3 wide, 3 ahead → 5 wide, plus the character's own tile. Nothing behind or beside. | 60 | Reaches furthest of the three but only forward — turning re-aims it, so it rewards committing to a direction |

Only one light is active at a time. Equipping is manual (via the item card, §7) except for the auto-swap on burnout.

### 4.2 Items that aren't light

| Item | Effect |
|---|---|
| Coin | Currency. Accumulates in a counter in the HUD. Nothing spends it yet — the merchant is deferred (§12). |
| Water drop | Refills water by 20, capped at the 200 max (§4). Running dry is the run's one death condition — this is the thing worth detouring for. |

### 4.3 The world

Effectively infinite and **procedurally generated from a seed**: terrain and item spawns are derived by hashing the tile's `(x, y)` against the run's seed, so a tile's content is the same every time you walk back to it and nothing needs storing except which tiles you've seen. There is no world edge.

- The **base** sits at `(0, 0)` and is where every run starts. Its 3×3 neighbourhood is forced to floor so you can never be walled in at spawn. It renders as a hut with a flag so it's recognisable from the edge of your light, and it's the one tile that's always on the map. The hut isn't drawn while the wizard is standing on it — two dense sprites on one tile read as an unidentifiable blob, so the wizard is simply in the doorway.
- **The seed is validated at run start.** A clearing at spawn isn't enough: at any rock density that still looks like a cave system, a noticeable slice of seeds seals the base into a pocket of a few tiles, which would break the promise that the character is never permanently stuck (§5). So a run flood-fills a 40-tile window from the base and rejects a seed that can't reach most of the floor in it, bumping to the next seed until one opens up. Carving guaranteed corridors into the noise would be the alternative, and it leaves a visible lattice; this keeps the terrain organic and costs a few milliseconds once per run.
- Rock density comes from one noise channel; item spawns from another. **Item quality scales with distance from the base** — coins and water drops near home, medium torches in the middle band, lamp torches only far out. That's what makes walking away from the base worth the durability (and the water).
- The base is where a run ends: walking onto it offers to stop and bank the expedition into a recap. Beyond that it has no function until the vault exists (§12).

## 5. Constraints

- One light active at a time. Light and water are the two consumables — no food yet (§12), no timer.
- The character can never be permanently stuck: blackout still allows movement, and the base's neighbourhood is always walkable.
- Water is the one thing that can actually end a run: it depletes every step regardless of light state, and hitting zero is fatal (§6).
- Duo-chromatic rendering: exactly two colours on screen at once (§9). This is a hard rule, not a style suggestion — every sprite is authored as a 1-bit mask so the palette can be swapped globally.
- Portrait, mobile-first, touch as the primary input. 480×854 fixed canvas.
- Turn-based: the world only advances when the player steps. No real-time pressure.
- No build tooling: Phaser 3 from a CDN `<script>` tag, game code as plain ES modules.
- No external art assets beyond the game's own pixel sprites.

## 6. Win / lose conditions

- **Win:** none. Nouxinha is open-ended — the point is how far out you got and what you brought back.
- **Lose:** running out of water. It depletes independently of light and never auto-refills — only a water-drop pickup does that — so hitting 0 ends the run on the spot and everything carried is lost, with a short screen reporting tiles explored, furthest distance, and steps taken before returning to the title screen. Running out of light, by contrast, is a setback (blackout), not a failure state; nothing about light kills the character.
- **Session end:** the player walks back to the hut and takes it up on the offer to stop (§4). The HUD tracks the numbers that stand in for a score while you're out — **tiles explored** (distinct tiles ever lit), **coins**, and **water** remaining — and stopping at the hut closes the run with a **recap**: tiles explored, coins, lights found, furthest distance reached, steps taken, and what's still in hand. Leaving by the map's **X** abandons the run instead and skips the recap. Once the vault exists (§12), stopping at the hut is also what will bank what you're carrying.

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
- Bottom ~230px (about a quarter): the HUD. Inventory strip, the **ITEMS** button, and the run counters (tiles explored, coins, water) on the left; the four-direction D-pad on the right, thumb-reachable.

## 8. Scope

**Built — the MVP, and what "is the walk interesting" gets judged on:**
- Procedural infinite grid (floor/rock) from a seed, with the base at `(0, 0)`
- Tile stepping via swipe and D-pad, with facing tracked from the last step
- Three visibility states with persistent memory of explored tiles
- Small torch (radius 1) equipped at start; durability ticking per step; auto-swap on burnout; blackout when nothing is left
- Medium torch and lamp torch as findable items, with distance-scaled spawning
- Coins and a coin counter
- Water: depletes one per step regardless of light state, starts at 200, refilled by water-drop pickups (capped at 200); hitting 0 ends the run and everything carried is lost
- Stacked inventory strip, a scrollable inventory panel, and an item card (durability, effect, Equip — a scrollable per-copy list for stacks of more than one)
- Duo-chromatic rendering with four CRT palettes selectable in Settings, persisted
- Tiles-explored counter
- The hut's stop/continue question and the end-of-run recap
- A synthesised pickup blip

**Nice to have (only after MVP works):**
- Line-of-sight occlusion so rock actually casts shadow
- Light falloff — an outer ring at partial brightness instead of a hard edge
- More light sources (something that lights a fixed radius around a *dropped* point, a one-shot flare that reveals a wide area for one step)
- A compass or a base-direction hint for walking home in blackout
- Landmarks/structures in the terrain generator so the world has shapes worth remembering, not just noise
- Minimap of remembered tiles
- Screen-shake-free CRT dressing: scanline overlay, phosphor bloom on the lit ring

**Explicitly out of scope:**
- Combat, enemies, or any threat
- Music, and any sound beyond the pickup blip
- Multiplayer, leaderboards
- Save/load of a run in progress (the seed makes the *world* reproducible; visited-tile state is not persisted in MVP)

## 9. Art & audio style

- **Visual style:** Pixel art, **duo-chromatic**, retro CRT. Exactly two colours are on screen at any moment: a dark background and a single foreground used for every tile border, the character, items, HUD, and text. Sprites are authored as 16×16 1-bit masks (foreground shape on transparent) drawn at 3× with nearest-neighbour filtering, and tinted with the palette's foreground colour — which is what makes a palette swap a one-line change rather than an asset rebuild. The masks live in `src/data/sprites.js` as **text**, `#` and `.` — the art is data, it diffs in git, and changing it needs no image editor (see §11).
  - **Tile edges:** a floor tile draws its dotted border on its top and left edges only, so the edge shared by two known tiles is drawn once rather than doubled. It closes off its right or bottom edge only where the neighbour there is still unknown, so the frontier of explored ground reads as a boundary instead of an unfinished grid.
  - **Three visibility states, one colour:** lit = foreground at full alpha; remembered = the same foreground at ~30% alpha; unknown = nothing drawn at all, just background. Dimming by alpha rather than by a third colour is what keeps the two-colour rule intact.
  - **Floor is its border and nothing else.** An empty floor tile is bare background inside a dotted border — no stipple, no scatter, no per-tile decoration. The dotted grid alone separates "ground I have lit" from "dark I have never been to", and it holds that read at the remembered state's 30% alpha. Loose pixels in the middle of a tile were tried and cut: one tile's worth looks like texture, a viewport's worth looks like noise, and they compete with the things that actually matter — the wizard, the items, the frontier. Rock uses the inverse weight: a dense, near-solid mask, so a rock wall reads as a mass and floor reads as a surface.
  - **Items are drawn hollow.** A solid silhouette turns to mush at 16×16 once it's tinted flat, so the torches, the lantern, and the water drop are outlines with small solid accents — the hollow interior is what gives the eye an edge to read. The three lights also differ in *silhouette* rather than in detail (a thin stick, a fat stick, a lantern), because they have to be told apart at the edge of the light; the water drop's pointed-tip, rounded-bulb silhouette is deliberately unlike either the torches' diamond tip or the coin's ring, since it's read at a glance next to both.

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
  | `src/config.js` | Screen/HUD/tile layout constants, the palette table, and the active-palette accessor (persisted to `localStorage`) |
  | `src/core/world.js` | Seeded hash → terrain and item spawn for a tile coordinate, plus `reachableFraction`/`pickSeed` for the run-start seed validation. Pure, no Phaser |
  | `src/core/light.js` | Light shapes: given a light, a tile, and a facing, the set of visible tiles. Pure |
  | `src/core/rules.js` | The run: step legality, durability tick, burnout/auto-swap, water depletion/refill and the death condition, pickup, reveal, `inventoryStacks` for grouping same-id copies for display, and `runSummary` for the recap. Also where the water balance constants (`STARTING_WATER`, `WATER_PER_STEP`, `WATER_REFILL`) live. Pure |
  | `src/data/items.js` | Item definitions (name, sprite key, durability, light shape, effect text) |
  | `src/data/sprites.js` | Every sprite, as a 16×16 text mask — including the four floor-edge variants, derived from the base pattern rather than drawn a second time |
  | `src/ui/textures.js` | Bakes the masks into white textures at boot, and rejects any mask that isn't 16×16 |
  | `src/ui/MapView.js` | The tile pool, the three visibility states, the step slide and the blocked-step bump. Holds no game state |
  | `src/ui/hud.js` | Run counters, the stacked inventory strip, the **ITEMS** button, the active light's durability, the status line |
  | `src/ui/scroll.js` | A drag/wheel-scrollable, mask-clipped list region shared by the item card's instance list and the inventory panel |
  | `src/ui/sfx.js` | The pickup blip, synthesised through WebAudio. No assets, and silently inert where audio is unavailable |
  | `src/ui/dpad.js`, `src/ui/itemCard.js`, `src/ui/inventoryPanel.js`, `src/ui/dialog.js`, `src/ui/button.js` | The D-pad, the item card overlay (single-copy or scrollable instance list), the full scrollable inventory panel, the hut's title/rows/buttons dialog, the shared bordered button |
  | `src/scenes/` | `TitleScene`, `SettingsScene`, `ExploreScene` |
  | `tests/` | `harness.js` (local server + Playwright driver + runner) and `game.test.js` — see `TESTING.md` |

- **Sprites are text, not images.** Each is a 16×16 grid of `#`/`.` in `src/data/sprites.js`, baked into a white texture at boot and tinted at draw time. No binary assets, no image editor, no build step — and one texture set serves all four palettes.

- **Explored-tile storage:** a `Set` of `"x,y"` keys for tiles ever lit. Terrain and items are re-derived from the seed on demand, so nothing else about the world needs storing. A run additionally keeps only what the recap reports plus the water level: the coin count, the current water, the high-water mark of distance from the base, and a tally of what it has picked up.
- **The page has to be the viewport.** Phaser fits the canvas to its parent element, so `#game` is sized to the full viewport and Phaser's own `autoCenter` does the centring. Centring the parent with flexbox instead leaves it shrink-to-fit — a size Phaser cannot fit into, which on a portrait phone scaled the canvas to the viewport *height* and let the width overflow: the sides of the HUD ran off screen and the page panned sideways, which ate taps, because a touch the browser is still deciding might be a pan never becomes a click. The canvas also sets `touch-action: none` so there is no pan gesture to wait on. `tests/game.test.js` pins this with a phone-sized viewport.
- **Rendering the viewport:** the tile window is repointed around the character's coordinate each step rather than instantiating sprites for a growing world — a fixed pool of 11×15 cells (three sprites each: ground, base hut, item) whose texture and alpha are reassigned from whatever tile now sits at that screen position. Sprite count stays constant however far you walk. A step slides the whole tile container one tile and tweens it home in 90ms, so the world moves and the wizard doesn't; input is blocked for that tween so a fast tapper can't outrun the renderer.
- **Key technical risks:**
  - Keeping the world genuinely unbounded — all tile lookups go through the seeded generator, never an array, and the camera works in world coordinates so there's no origin to drift from.
  - Swipe vs. tap disambiguation on the map area, with the D-pad live at the same time.
  - Two-colour discipline surviving contact with Phaser defaults (text, UI, particles all need explicit tinting).
  - The dotted tile border carrying the whole "this is ground I have lit" read on its own, including at the remembered state's ~30% alpha, now that floor has no decoration to help it.
- **Testing:** `core/world.js`, `core/light.js`, and `core/rules.js` are pure and importable from Node, so light shapes, durability/burnout sequencing, and spawn distribution are unit-tested without a browser; everything a player *does* is driven against the real canvas with Playwright. Because there are no hand-authored levels to write coordinates against, the browser tests BFS the real world at load time to find their targets (the nearest torch, the nearest rock to walk into) and replay the route — see `TESTING.md`.

## 12. TODO — deferred, not yet designed

Not part of the initial implementation, listed here so the MVP doesn't paint them out:

- **Vault.** The base holds a vault; items and coins you're carrying are only truly *yours* once you've walked back and stored them. That's what turns "how far out can I get" into a decision with a cost, and it's the intended next step after the MVP proves the walk is interesting.
- **Merchant.** What coins are for. Presumably at the base, selling lights.
