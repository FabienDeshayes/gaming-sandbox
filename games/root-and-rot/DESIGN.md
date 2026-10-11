# Root & Rot

## 1. One-liner

A garden puzzle where you plant up to three seeds and the season grows itself by fixed cellular-automaton rules.

## 2. Pitch

Each species spreads in its own fixed shape, and rock-paper-scissors decides fights where they meet. Beaten plants turn to rot, and rot is the only thing that eats through stone. You can scrub a full, exact preview of the season before committing, so the challenge is understanding the rules, not guessing.

## 3. Core loops

1. Pick a seed and tap bare soil to plant it.
2. Scrub the turn slider to see exactly how the season plays out, and check the "targets met" count.
3. Move seeds around until every ringed cell is right at the last turn.
4. Press Grow to play the season. Win: next level. Fail: try again with your seeds left in place.

## 4. Core mechanics

| Mechanic | Description | Input |
|---|---|---|
| Spread shapes | Every turn, each plant claims bare soil in its shape. Moss: 4 side neighbours. Fern: 4 diagonals. Bramble: jumps 2 squares straight. | - |
| Rock-paper-scissors | Moss beats Fern, Fern beats Bramble, Bramble beats Moss. A plant reached by a species that beats it dies and becomes rot. Two species claiming the same soil: the winner takes it. All three at once cancel. | - |
| Rot | Rot blocks growth, lasts 2 turns, then leaves bare soil. Fresh rot eats into orthogonally adjacent stone, so it can open walls. | - |
| Seeds and preview | Each level gives a fixed set of seeds (1-3). The whole season is deterministic and previewable turn by turn. | Tap seed button, tap cell, turn slider |

## 5. Constraints

- No external assets: Phaser shapes and text only.
- Deterministic: no randomness anywhere.
- Portrait 480x854, tap-only.

## 6. Win / lose conditions

- **Win (level):** at the last turn every target holds its species (solid ring) or is bare soil (dashed ring).
- **Lose (level):** any target is wrong at the last turn. Retry keeps your seeds.
- **Session end:** clearing all 5 levels; then back to the title.

## 7. Controls

| Action | Input (keyboard/mouse) | Input (touch) |
|---|---|---|
| Select a seed | Click its button | Tap |
| Plant / remove | Click soil / click the seed again | Tap |
| Scrub preview | Turn buttons, or Left/Right arrows | Tap turn buttons |
| Commit | Grow! | Tap |

## 8. Scope

**Built:** title screen, help overlay, 8x8 grid, 3 species, 5 levels (seasons of 3-8 turns), live preview with per-target badges, animated season, win/lose/next/retry. Each level's targets were chosen by a brute-force search so the intended solution works (levels 1, 2, 3 and 5 have exactly one solution).

**Ideas for later:**
- More levels (the brainstorm suggests 10) that need discovered patterns: walls, firebreaks, gliders.
- A level select and saved progress.
- Hover/tap any cell at any turn to see why it changed (which plant claimed it).
- A solver hint or "par" seed count.

## 9. Art & audio style

- **Visual style:** flat shapes on dark soil. Moss is a green circle, Fern a teal diamond, Bramble a magenta triangle, rot brown with a turns-left number.
- **Audio:** none.

## 10. Theme

A tended garden as a little automaton: life spreads, competes, rots and clears the ground for more.

## 11. Tech notes

- **Engine/library:** Phaser 3 (CDN), plain scripts, no build step.
- **Files:** `logic.js` holds the pure rules and level data (works in Node too, as `require('./logic.js')`), `main.js` holds the scenes.
- **Screen size:** 480x854 portrait, scaled to fit.
- **Debug:** `?level=N` opens level N directly.
