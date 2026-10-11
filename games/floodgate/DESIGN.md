# Floodgate

## 1. One-liner

Tower defence against water: reshape a height map one tile at a time so three river waves miss the town.

## 2. Pitch

A spring will release three waves of water, and you can see exactly where each one will settle before it comes. Between waves you raise or lower single tiles to dig channels and build dams. The flow is deterministic and every height is printed on the map, so the puzzle is pure planning.

## 3. Core loops

1. Read the forecast: the blue overlay shows where the next wave's water will end up, and the line under the map says how many houses flood, fields turn fertile or drown, and how much reaches the sea.
2. Tap a tile and raise or lower it by 1 (one action). The forecast updates immediately.
3. When the actions run out (or you choose to), release the wave. The map then shows what it did.
4. Repeat for 3 waves of growing volume (10, 18, 28).

## 4. Core mechanics

| Mechanic | Description | Input |
|---|---|---|
| Flow | Water comes in whole units, poured one at a time on the spring. Each unit settles on the lowest tile it can reach from the spring without stepping uphill (flat is fine); ties go to the last tile found in a north/east/south/west breadth-first search, which tends to be furthest downstream. A unit that can reach the sea leaves the map. Damage is counted once the wave settles, then the water soaks away. | None: it is the rule |
| Terraform | Raise or lower one land tile by 1 (heights 0-9). Houses, fields, the spring and the sea can't be changed. | Tap tile, then Raise/Lower |
| Actions | 4 before wave 1, then 3 before each later wave, plus 1 for each fertile field. | Release the wave early to skip leftovers |
| Fields | A field left with 1-2 water is fertile (+1 action next turn); 3 or more water drowns it for good. | None: decided by the flow |

## 5. Constraints

- Integer heights and volumes only; no randomness.
- No external assets: Phaser shapes and text only.
- Portrait 480x854, tap-only input.

## 6. Win / lose conditions

- **Win:** at least 3 of the 4 houses are still dry after wave 3.
- **Lose:** after any wave, fewer than 3 houses are dry. A house that gets any water is flooded for good.
- **Session end:** after wave 3, or as soon as you lose.

## 7. Controls

| Action | Input (mouse) | Input (touch) |
|---|---|---|
| Inspect / select a tile | Click it | Tap it |
| Raise / lower selected tile | Raise +1 / Lower -1 buttons | Tap the buttons |
| Start the wave | Release button | Tap it |
| Compare forecast with the last wave | Show next / Show last | Tap it |

## 8. Scope

**Built:** one hand-made 10x10 map. A rockfall blocks the river channel, so water pools behind it and overflows west onto two fields and then east down toward the town. A sill lower in the channel sends anything that reaches it into the town instead of the sea. Doing nothing floods 2 houses on wave 3 and loses. Digging the sill (2 actions) wins. Clearing the rockfall or raising the banks are other ways to steer the water.

**Ideas for later:**
- Water that stays between waves (reservoirs filling up over the game).
- More maps that need tricks learned on earlier ones.
- Animate units flowing during the wave.
- A limited earth budget, so raising one tile means digging another.

## 9. Art & audio style

- **Visual style:** flat tiles shaded by height, height number on every tile, translucent blue for water with its depth (`~n`). Red outline: house that will flood or field that will drown. Green outline: field that will turn fertile.
- **Audio:** none.

## 10. Theme

A river town before the floods. Mechanics first.

## 11. Tech notes

- **Platform:** Web (2D)
- **Engine/library:** Phaser 3 from the CDN, ES modules, no build step.
- **Files:** `logic.js` holds the pure rules (map, `pour`, `runWave`, `previewWave`) and runs in Node; `main.js` holds the title and map scenes. The forecast is the real `runWave` run on a copy of the state, so the forecast always matches what happens.
- **Screen size / aspect ratio:** 480x854 portrait, scaled to fit.
