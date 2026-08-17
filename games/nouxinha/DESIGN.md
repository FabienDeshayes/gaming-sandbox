# Nouxinha

> Grid exploration game about walking into the dark on a limited supply of light.

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
| Pickup | Stepping onto a tile holding an item picks it up automatically. Lights go into the inventory unequipped; coins go straight to the coin counter. | — |

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

### 4.3 The world

Effectively infinite and **procedurally generated from a seed**: terrain and item spawns are derived by hashing the tile's `(x, y)` against the run's seed, so a tile's content is the same every time you walk back to it and nothing needs storing except which tiles you've seen. There is no world edge.

- The **base** sits at `(0, 0)` and is where every run starts. Its 3×3 neighbourhood is forced to floor so you can never be walled in at spawn. It renders as a distinct landmark so it's recognisable from the edge of your light, and it's the one tile that's always on the map.
- Rock density comes from one noise channel; item spawns from another. **Item quality scales with distance from the base** — coins near home, medium torches in the middle band, lamp torches only far out. That's what makes walking away from the base worth the durability.
- The base has no function beyond "start point and landmark" until the vault exists (§12).

## 5. Constraints

- One light active at a time, and light is the only consumable resource in the game — no health, no hunger, no timer.
- The character can never be permanently stuck: blackout still allows movement, and the base's neighbourhood is always walkable.
- Duo-chromatic rendering: exactly two colours on screen at once (§9). This is a hard rule, not a style suggestion — every sprite is authored as a 1-bit mask so the palette can be swapped globally.
- Portrait, mobile-first, touch as the primary input. 480×854 fixed canvas.
- Turn-based: the world only advances when the player steps. No real-time pressure.
- No build tooling: Phaser 3 from a CDN `<script>` tag, game code as plain ES modules.
- No external art assets beyond the game's own pixel sprites.

## 6. Win / lose conditions

- **Win:** none. Nouxinha is open-ended — the point is how far out you got and what you brought back.
- **Lose:** none. Running out of light is a setback (blackout), not a failure state; nothing kills the character.
- **Session end:** the player stops. The HUD tracks the two numbers that stand in for a score: **tiles explored** (distinct tiles ever lit) and **coins**. Once the vault exists (§12), "made it back to base" becomes the thing that banks a run.

## 7. Controls

Touch is primary. Keyboard is a desktop convenience, not a design target.

| Action | Input (touch — primary) | Input (keyboard/mouse) |
|---|---|---|
| Step | Swipe in a cardinal direction anywhere on the map area, or tap a D-pad arrow (bottom right of the HUD) | Arrow keys / WASD, or click a D-pad arrow |
| Inspect an item | Tap its slot in the inventory strip (bottom left of the HUD) → opens the item card | Click the slot |
| Equip a light | Tap **Equip** on its item card | Click **Equip** |
| Close the item card | Tap the card's close control, or tap outside it | Click, or press Esc |
| Change palette | Settings, from the title screen | Same |

**The item card** is an overlay, opened from an inventory slot, showing: the item's name, its sprite at large scale, **durability** as `current / max` with a bar, a one-line **effect** description ("Lights the 8 tiles around you"), and an **Equip** button for lights (greyed out on the already-active one). Opening a card doesn't cost a step — the game is turn-based on movement only.

**Screen layout** (480×854):

- Top ~624px: the map viewport, 10×13 tiles at 48px, camera centred on the character so the world scrolls under them and they stay put in the middle.
- Bottom ~230px (about a quarter): the HUD. Inventory strip and the run counters (tiles explored, coins) on the left; the four-direction D-pad on the right, thumb-reachable.

## 8. Scope — MVP vs. cut

**MVP (must have to test if the core loop is fun):**
- Procedural infinite grid (floor/rock) from a seed, with the base at `(0, 0)`
- Tile stepping via swipe and D-pad, with facing tracked from the last step
- Three visibility states with persistent memory of explored tiles
- Small torch (radius 1) equipped at start; durability ticking per step; auto-swap on burnout; blackout when nothing is left
- Medium torch and lamp torch as findable items, with distance-scaled spawning
- Coins and a coin counter
- Inventory strip + item card with durability, effect, and Equip
- Duo-chromatic rendering with four CRT palettes selectable in Settings, persisted
- Tiles-explored counter

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
- Sound effects and music
- Multiplayer, leaderboards
- Save/load of a run in progress (the seed makes the *world* reproducible; visited-tile state is not persisted in MVP)

## 9. Art & audio style

- **Visual style:** Pixel art, **duo-chromatic**, retro CRT. Exactly two colours are on screen at any moment: a dark background and a single foreground used for every tile border, the character, items, HUD, and text. Sprites are authored as 16×16 1-bit masks (foreground shape on transparent) drawn at 3× with nearest-neighbour filtering, and tinted with the palette's foreground colour — which is what makes a palette swap a one-line change rather than an asset rebuild.
  - **Three visibility states, one colour:** lit = foreground at full alpha; remembered = the same foreground at ~30% alpha; unknown = nothing drawn at all, just background. Dimming by alpha rather than by a third colour is what keeps the two-colour rule intact.
- **Palettes:** four combinations, chosen in Settings, persisted in `localStorage`, all CRT-flavoured:

  | Name | Background | Foreground |
  |---|---|---|
  | Phosphor | `#0b1a0b` | `#33ff66` |
  | Amber | `#1a0f00` | `#ffb000` |
  | Cathode | `#06121a` | `#4fd0ff` |
  | Magenta | `#14061a` | `#ff5fd2` |

- **Reference:** monochrome terminal monitors, Downwell (two-tone discipline), classic roguelike fog of war.
- **Audio:** none for the prototype.

## 10. Theme

An explorer leaving a small base to map an unknown dark. The framing is deliberately thin — the fiction only has to justify why light is scarce and why you'd walk back home. The CRT palette does most of the tonal work: this reads as something being scanned rather than something being seen.

## 11. Tech notes

- **Platform:** Web (2D), portrait, mobile-first
- **Engine/library:** Phaser 3, via CDN `<script>` tag
- **Screen size:** 480×854 fixed (~9:16); 48px tiles; ~10×13 visible tiles
- **Source layout** (target, once past the single-file template):

  | Path | Holds |
  |---|---|
  | `src/main.js` | `Phaser.Game` config and scene registration — boot only |
  | `src/config.js` | Screen/HUD/tile layout constants, the palette table, and the active-palette accessor |
  | `src/core/world.js` | Seeded hash → terrain and item spawn for a tile coordinate. Pure, no Phaser |
  | `src/core/light.js` | Light shapes: given a light, a tile, and a facing, the set of visible tiles. Pure |
  | `src/core/rules.js` | Step resolution: legality, durability tick, burnout/auto-swap, pickup. Pure |
  | `src/data/items.js` | Item definitions (name, sprite key, durability, light shape, effect text) |
  | `src/ui/` | D-pad, inventory strip, item card overlay |
  | `src/scenes/` | `TitleScene`, `SettingsScene`, `ExploreScene` |
  | `assets/sprites/` | 16×16 1-bit sprites (character, rock, base, torches, coin) |

- **Explored-tile storage:** a `Set` of `"x,y"` keys for tiles ever lit. Terrain and items are re-derived from the seed on demand, so nothing else about the world needs storing.
- **Key technical risks:**
  - Keeping the world genuinely unbounded — all tile lookups go through the seeded generator, never an array, and the camera works in world coordinates so there's no origin to drift from.
  - Swipe vs. tap disambiguation on the map area, with the D-pad live at the same time.
  - Two-colour discipline surviving contact with Phaser defaults (text, UI, particles all need explicit tinting).
- **Testing:** `core/world.js`, `core/light.js`, and `core/rules.js` are pure and importable from Node, so light shapes, durability/burnout sequencing, and spawn distribution can be unit-tested without a browser — the same split `games/bibou/` uses.

## 12. TODO — deferred, not yet designed

Not part of the initial implementation, listed here so the MVP doesn't paint them out:

- **Vault.** The base holds a vault; items and coins you're carrying are only truly *yours* once you've walked back and stored them. That's what turns "how far out can I get" into a decision with a cost, and it's the intended next step after the MVP proves the walk is interesting.
- **Merchant.** What coins are for. Presumably at the base, selling lights.
