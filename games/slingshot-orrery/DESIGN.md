# Slingshot Orrery

## 1. One-liner

Steer a probe that is almost out of fuel through a clockwork solar system by borrowing the gravity of moving planets.

## 2. Pitch

Planets step along fixed, visible orbits one square per turn. Each turn you coast for free or burn 1 fuel to nudge your velocity, and the next 8 turns of your path are always drawn. Every mission gives you less fuel than the direct route needs, so the puzzle is finding the turn where a planet (or a moon) bends you the rest of the way.

## 3. Core loops

1. Pick a move (coast or a burn ↑ ↓ ← →); the predicted path for the next 8 turns redraws, with the planets' future positions numbered to match.
2. ENGAGE: the probe moves by its velocity, the bodies step, and any body now next to the probe bends its velocity.
3. Read where the path now goes; undo freely if the plan was wrong.
4. Dock on the beacon, then the next mission.

## 4. Core mechanics

| Mechanic | Description | Input |
|---|---|---|
| Momentum | Each turn the probe moves by its velocity vector (squares per turn). | Coast (free) |
| Burn | Change velocity by 1 on one axis; costs 1 fuel. Fuel is per mission. | ↑ ↓ ← → |
| Gravity | After moving, every body in the 8 squares around the probe changes its velocity by 1 on each axis toward it (Sun, planets) or away from it (moons). Pulls stack. | Automatic |
| Clockwork orbits | Planets walk a square ring around the Sun, one square per turn; the moon Pip walks a ring around Tethys. All positions are deterministic and previewed. | — |

Turn order: burn → probe moves → bodies step → crash / arrival check → gravity.

## 5. Constraints

- Fully deterministic; no randomness anywhere.
- Phaser 3 graphics primitives only, no assets, 480×854 portrait, tap-friendly.
- Pure rules in `logic.js` (no Phaser), so missions can be checked by a solver in node (`Orrery.solve(mission)`).

## 6. Win / lose conditions

- **Win:** end a turn on the beacon square.
- **Lose:** end a turn on a body, leave the 17×17 chart, or run out of turns (16 per mission). UNDO steps back from a loss.
- **Session end:** 5 missions, then back to the title.

## 7. Controls

| Action | Input (keyboard/mouse) | Input (touch) |
|---|---|---|
| Preview a move | Hover a move button, or arrows / C to select | Tap a move button |
| Commit the selected move | ENGAGE, Space or Enter | ENGAGE, or tap the selected move again quickly |
| Undo a turn | UNDO, U or Backspace | UNDO |
| Restart mission | RESET | RESET |

## 8. Scope

**Built:** title with how-to-play and mission picker; 5 missions (First Burn, Sun Dive, Ember Assist, Moon Brake, Grand Tour), each checked solvable with its fuel, most with exactly one minimum-fuel route; live 8-turn path preview with crash/arrival markers and pull rings; numbered future body positions; unlimited undo.

**Ideas for later:**
- Fuel carried over between missions in a campaign, with optional samples to collect (the P5 trade-off layer).
- Hex grid and the full 10-mission set; missions that need the double slingshot or parking in orbit.
- A replay of a failed run on the map showing which turn went wrong.
- A larger preview horizon as a purchasable upgrade.

## 9. Art & audio style

- **Visual style:** flat circles on a dark grid; gravity zones as tinted 3×3 squares, orbits as faint square rings.
- **Audio:** none.

## 10. Theme

A lone probe in a mechanical, wind-up solar system.

## 11. Tech notes

- **Platform:** Web (2D), Phaser 3 from CDN, plain scripts (`logic.js`, `missions.js`, `main.js`), no build step.
- **Screen size:** 480×854 portrait, scaled to fit.
