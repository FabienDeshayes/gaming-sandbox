# The House Remembers

## 1. One-liner

A turn-based haunted house where the ghost follows strict, learnable rules, and you sneak through the dark collecting keys to escape.

## 2. Pitch

Eight rooms, one ghost, three nights. The ghost never cheats: it walks one room per turn toward the loudest sound, and it shows itself only in candlelight. The fear comes from not knowing yet where it is, and the safety comes from understanding the rules well enough to steer it.

## 3. Core loops

1. Read the house: lit rooms, sound sources, where the ghost was last seen.
2. Pick one action: move to a neighbouring room, search, light a candle, take or drop the doll, wait, or escape. Each action's sound is shown on its button.
3. The ghost takes one step toward the loudest sound.
4. Repeat until you have 3 keys and escape from the Foyer, or the ghost finds you.

Session loop: three nights, each adding a rule or taking a resource away.

## 4. Core mechanics

| Mechanic | Description | Input |
|---|---|---|
| Sound | Move 1, search a dark room 2, search a lit room 1, take/drop doll 1, wait/light/escape 0. The Study clock always ticks at 1. From night 2, every lit room also makes sound 1. The ghost heads for the loudest sound; ties go to the one nearest the ghost, then to the lower room number. | Choosing an action |
| Light | A candle lights the current room for 5 ghost moves. Lit rooms show their key (or "no key") and the ghost if it is there. Candles: 3, 3, 2 per night. | Light candle button |
| The doll | The ghost won't enter a room where its doll rests. A carried doll does not count. Moving it reshapes the ghost's routes. | Take / Drop doll |
| Keys | 3 keys per night, hidden in rooms; Search picks up the key in your room. | Search button |

## 5. Constraints

- No external assets: Phaser shapes and text only.
- No randomness: key, doll and ghost positions are fixed per night; the ghost is fully deterministic.
- Portrait 480x854, tap-only input.

## 6. Win / lose conditions

- **Win:** escape all 3 nights (3 keys, then Escape while in the Foyer).
- **Lose:** you and the ghost end up in the same room (you walk into it, or it walks into you). You can retry the same night.
- **Session end:** after night 3.

## 7. Controls

| Action | Input (mouse) | Input (touch) |
|---|---|---|
| Move | Click a neighbouring room (teal outline) | Tap it |
| Wait / Search / Light / Doll / Escape | Click the button | Tap the button |
| Rules | `?` button, top right | Tap it |

## 8. Scope

**Built:** 8 rooms in a 3x3 grid minus one corner, fixed doors, 3 authored nights (each checked winnable by a breadth-first solver), ghost "last seen" marker, a preview arrow of where a visible ghost goes if you stay quiet.

**Ideas for later:**
- A preview of the ghost's next step for every action, not just Wait.
- Rules revealed by play rather than listed (the doc's "each night reveals a new rule").
- More ghost-owned objects; a second ghost with different rules.
- Sound that carries through doors and fades with distance.

## 9. Art & audio style

- **Visual style:** flat rooms; warm brown when lit, near-black when dark; simple shape icons for keys, doll, clock, ghost.
- **Audio:** none.

## 10. Theme

Quiet horror. The tension comes from planning around a creature that obeys rules, not from jump scares.

## 11. Tech notes

- **Platform:** Web (2D)
- **Engine/library:** Phaser 3 from the CDN, ES modules, no build step.
- **Files:** `logic.js` holds the pure rules (rooms, nights, `step`, `ghostStep`) and imports nothing, so it runs in Node; `main.js` holds the title and house scenes.
- **Screen size / aspect ratio:** 480x854 portrait, scaled to fit.
