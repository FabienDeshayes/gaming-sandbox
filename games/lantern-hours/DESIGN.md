# Lantern Hours

## 1. One-liner

A turn-based manor heist where every guard's sight and next three steps are drawn on the map, and noise is how you steer them.

## 2. Pitch

You rob one floor of a manor at night, one tile per turn. Guards walk fixed loops and see in a short cone, all of it drawn, so getting caught is always your own miscalculation. Creaky doors, grabbing loot and thrown pebbles make noise that turns guards toward the sound for 2 turns: a danger and a tool.

## 3. Core loops

1. Read the board: vision cones (yellow), each guard's next 3 positions (numbered dots), loot, doors.
2. Pick a move, a pebble throw, an oil can, or a wait. Moves that would get you seen are marked red with "!"; noisy actions show their radius and which guards will turn.
3. Confirm. Every guard steps (twice on a heavy move).
4. Repeat until you reach the exit with loot, or get seen and undo / retry. The layout never changes, so each attempt teaches the house.

## 4. Core mechanics

| Mechanic | Description | Input |
|---|---|---|
| Patrols and sight | 3 guards (Hall, Study, Cellar) walk fixed loops. Each sees a cone 4 tiles ahead (1 wide, then 3 wide), stopped by walls; doors block sight beyond them. Ending a step in sight, or on a guard, loses. | Tap an adjacent tile |
| Noise | Doors (radius 3, unless oiled), grabbing loot (2), pebbles (3). Every guard within that Manhattan radius turns toward the source and stands still for 2 turns, then resumes its loop. | Tap a target; risky or noisy actions need a second tap to confirm |
| Tools | 2 pebbles (throw to any non-wall tile within 4 steps) and 1 oil can (silence an adjacent door for the rest of the night). Each use takes a turn. | Pebble / Oil buttons, then a tile |
| Heavy loot | Carrying k loot, every (5 - k)th move (minimum every 2nd) is heavy: guards step twice. The HUD shows how many light moves remain. | Automatic |

## 5. Constraints

- Phaser 3 graphics and text only, no assets, no build step. 480x854 portrait, tap-first.
- Fully deterministic: no randomness anywhere; Undo is free.

## 6. Win / lose conditions

- **Win:** step onto the exit carrying at least 1 of the 3 loot. The result shows loot taken and turns used.
- **Lose:** you are in a guard's sight (or on its tile) after your action or after any guard step.
- **Session end:** one manor floor per run; Play again / Undo / Restart.

## 7. Controls

| Action | Input (keyboard/mouse) | Input (touch) |
|---|---|---|
| Move | Click an outlined adjacent tile, or arrow keys | Tap |
| Wait a turn | Wait button or Space | Tap Wait |
| Throw pebble / oil a door | Pebble or Oil button, then click a target (twice for pebble) | Same |
| Inspect a guard | Click it | Tap it |
| Undo / Restart | Buttons | Buttons |

## 8. Scope

**Built:** one 10x12 manor floor, 3 guards, 3 loot, 2 tools (pebble, oil), heavy loot, previews of danger and noise, undo.

**Later:**
- Guards hearing each other (a turned guard's footsteps as noise) for chained herding.
- Choose 2 tools from a larger set before the night (cloth for the lantern, etc.).
- More floors, a star rating per floor (all loot, no tools, turn par).

## 9. Art & audio style

- **Visual style:** flat tiles, coloured circles, translucent overlays for sight and noise.
- **Audio:** none.

## 10. Tech notes

- **Engine/library:** Phaser 3 from CDN, plain scripts.
- `logic.js` holds the pure rules (`window.LH`, also `require()`-able in node); `main.js` is rendering and input. Every preview is computed by running the real rule function on a copy of the state.
