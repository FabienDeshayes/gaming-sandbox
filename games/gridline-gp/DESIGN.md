# Gridline GP

## 1. One-liner

Turn-based motorsport on graph paper: steer by nudging your velocity, save your tyres, and outfox rivals whose next moves you can see.

## 2. Pitch

Based on the classic pencil-and-paper racing game. Your car keeps its momentum and each turn you can only change velocity by one square per axis, so corners are planned several turns ahead. Tyres are the scarce resource: every nudge wears them. Three AI rivals play by the same rules and telegraph their next two moves, so you can block their line.

## 3. Core loops

1. Look at the 9 reachable squares (coloured by tyre wear) and the rivals' dashed next-2-move lines.
2. Tap a square to preview the move: path, new velocity, tyre cost, and where momentum takes you next turn.
3. Tap again (or Go) to drive. Every rival then makes its move, changing line if you blocked it.
4. Repeat for 2 laps; decide whether to spend 3 turns in the pit for fresh tyres.

## 4. Core mechanics

| Mechanic | Description | Input |
|---|---|---|
| Momentum | New position = position + velocity. Each turn change velocity by -1/0/+1 on each axis. A move whose straight path leaves the track is not allowed. With no legal move you spin: velocity drops to 0 and you lose 2 tyres. | Tap a dot |
| Tyres | 16 tyres. Each axis changed costs 1. At 0 tyres you can change only one axis per turn. | - |
| Pit | End a move on a yellow PIT square: tyres refilled, velocity 0, and you sit out 2 more turns (3 turns in all). | Drive into the pit |
| Rivals and blocking | 3 AI cars with the same rules (two have a speed cap of 3). Each shows its next 2 moves. No two cars share a square, so landing on a rival's next square forces it onto another line. Finished cars leave the track. | - |

## 5. Constraints

- No external assets: Phaser shapes and text only.
- No randomness: rival AI is a fixed, deterministic search, and every number (velocity, tyres, caps, laps) is on screen or a tap away.
- Portrait 480x854, tap-only.

## 6. Win / lose conditions

- **Win:** first across the line after 2 laps.
- **Lose:** a rival takes the flag first. The race ends when you finish and shows your place.
- **Session end:** race again or return to the title.

## 7. Controls

| Action | Input (keyboard/mouse) | Input (touch) |
|---|---|---|
| Preview a move | Click a dot | Tap a dot |
| Drive | Click the same dot again, or Go | Tap again, or Go |
| Inspect a car | Click it | Tap it |
| Wait in pit / spin | Go button (it reads Wait or Spin) | Tap |

## 8. Scope

**Built:** title screen, help overlay, one 20x28 track with a chicane and a pit box, 2-lap race against 3 AI cars, tyre wear and worn-tyre rule, optional pit stop, move preview, rival telegraphs, live standings, result screen with restart. A bot check in Node showed a strong line (5-move lookahead) wins and weaker play does not.

**Ideas for later:**
- Drafting: no tyre wear when directly behind another car.
- A full-speed replay after each lap.
- More tracks, a lap-time ghost, and qualifying for grid position.
- Smarter rivals that pit, and rivals that react to blocking more aggressively.

## 9. Art & audio style

- **Visual style:** flat top-down grid, coloured discs for cars, dashed lines for intentions.
- **Audio:** none.

## 10. Theme

Grand-prix racing told as a turn-based plan.

## 11. Tech notes

- **Engine/library:** Phaser 3 (CDN), plain scripts, no build step.
- **Files:** `logic.js` holds the track, rules and AI (works in Node, as `require('./logic.js')`), `main.js` holds the scenes.
- **Screen size:** 480x854 portrait, scaled to fit.
- **AI:** depth-limited search (2-3 moves) over the 9 options, scored by progress along a distance-to-finish field.
