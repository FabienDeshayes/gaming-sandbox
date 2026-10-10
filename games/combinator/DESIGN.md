# Combinator

> Working title. Filled from design discussions so far. Sections marked _TBD_ have not been decided yet.
> The playable prototype covers one slice: building and testing a machine on a test bench
> (§12). The tile map, the fire and the encounter loop are not built yet.

## 1. One-liner

Build machines from modules that pass four flows (Motion, Matter, Heat, Signal) between them, then watch them contain a spreading disaster on a tile map.

## 2. Pitch

- **What the player does:** Combines modules into machines by connecting their ports, tests them freely, places them on a tile map, commits, and watches a deterministic simulation play out.
- **Why it's fun:** A handful of simple, physically grounded rules combine into a huge space of machines. The reward is a carefully planned machine working exactly as intended, and discovering combinations nobody told you about.
- **How it differs:** Puzzle-like machine building with near-perfect information and no reflex skill, applied to a living, spreading threat rather than a static puzzle. Goals describe what must happen (e.g. "stop the fire reaching the houses"), never what must be built, so unusual machines are never punished.

## 3. Core loops

**Moment to moment (one encounter)**

1. Read the map: the threat, how it will spread, and what the environment offers.
2. Build machines on a test bench by connecting modules through ports.
3. Test freely and as often as wanted, at no cost.
4. Place machines on the map and commit.
5. Watch the simulation resolve turn by turn. The outcome is fully predictable from the rules.

**Session / meta**

- _TBD._ Candidate under discussion: genetics as the way new modules are acquired (e.g. fusing two modules into a new one), across a run of encounters.

## 4. Core mechanics

| Mechanic | Description | Input |
| --- | --- | --- |
| Combining | Modules connect through ports. Only ports carrying the same flow can connect, and only an output to an input. | Drag modules onto a tile grid; ports on touching sides connect (§12). |
| Flows | Four abstract flows: Motion, Matter, Heat, Signal. A port either carries its flow or it doesn't (no intensity or amount). | — |
| Roles | Every module is a **Source** (produces a flow), **Transmission** (carries a flow; sub-types **Converter**, which turns one flow into another, and **Control**, which gates a flow on a Signal) or **Effector** (acts on the world). A machine works only when a flow runs unbroken from a source to an effector. | — |
| Open ports | An unconnected output spills its flow onto its tile; an unconnected input draws from its tile, so the environment can act as a source. | — |

Supporting rules:

- Sources run out (a tank empties, a battery drains).
- Every conversion gives off waste heat, which can affect nearby tiles and modules.
- Modules are made of materials (e.g. wood burns, metal conducts heat), which is how the environment threatens machines.

## 5. Constraints

- **Near-perfect information:** every rule is inspectable and every outcome predictable. Chance may shape a situation, never the result of a player's action.
- **Small rules, deep combinations:** four flows, three roles. New content should be new combinations before new rules.
- **Thinking time over execution:** no reflex or dexterity tests; the player controls the pace.
- **Knowledge as progression:** players get stronger mainly by understanding more.
- **Scarcity and painful trade-offs:** the player never has enough to do everything.
- **Deterministic simulation:** the same machines on the same map always produce the same result.
- **Creativity is never punished:** goals describe properties, not blueprints.

## 6. Win / lose conditions

- **Win (fire environment, provisional):** a target number of districts saved from the fire.
- **Lose (fire environment, provisional):** too many districts burn.
- **Session end:** _TBD._

## 7. Controls

Test bench (the prototype):

| Action | Keyboard / mouse | Touch |
| --- | --- | --- |
| Place a module | Drag it from the palette onto a tile, or click it in the palette then click a tile | Same, with taps |
| Turn a module | Click it, or R over it (R also turns the module being dragged), or right-click | Tap it |
| Move a module | Drag it to another empty tile | Drag |
| Remove a module | Drag it off the bench, or Delete over it | Drag it off the bench |
| Inspect | Hover a module, palette entry or tile | — |
| Test run | ▶ Run test plays turns 1–8; \|◀ ▶\| or ← → step; click a turn in the timeline; Space plays | Tap the buttons or a turn |

## 8. Scope (MVP vs. cut)

**Must have (MVP)**

- _TBD_ for the full game. The current prototype is the machine-building slice only (§12).

**Nice to have**

- _TBD._

**Out of scope (for now)**

- Effort and amount on flows (intensity, pressure, volume).
- Opposing elements as a separate system.
- Multiplayer or build-versus-build duels.
- Genetics / evolution as a full system.

## 9. Art & audio style

- **Visual style:** _TBD_
- **References:** _TBD_
- **Audio:** _TBD_

## 10. Theme

Mechanics first. Machines grounded in real-world physics (fire triangle, flows of energy between domains), used to contain disasters. Fire spreading across a tile map is the first environment; the game is meant to support several environments, each changing what it offers as sources, what effectors must act on, and what threatens modules, while the machine rules stay the same.

## 11. Tech notes

- **Platform:** small 2D web prototype, desktop first (mouse and keyboard), also usable by touch.
- **Engine / library:** Phaser 3 from the CDN, plain ES modules, no build step (repo convention).
- **Screen size:** 1280×800 design size, scaled to fit with `Phaser.Scale.FIT`.
- **Source layout:** `src/data/modules.js` (the module catalogue and `TUNING`), `src/data/bench.js` (bench terrain and example machines), `src/core/machine.js` (the rules: connections, the turn-by-turn run, the plain-language readout; no Phaser, so the tests and a future tile map share it), `src/scenes/BenchScene.js` (the one screen and its input), `src/ui/` (drawing: `BenchView`, `Timeline`, `Readout`, `moduleArt`, `button`).
- **Key technical risks:** keeping the simulation deterministic (flows settle as a fixed point that starts with everything off, so evaluation order can't change a result), and keeping the building interface readable as machines grow.

## 12. Prototype: the machine bench

What is playable now: a 7×5 test bench where the player builds a machine and sees, at all times, what it will do.

**Building.** A module fills one tile and has up to four ports, one per side. Rotating it turns its ports. Two modules are connected when the ports on their shared side carry the same flow and one is an output, the other an input. Ports that touch but can't connect (different flows, or two outputs/two inputs) behave like open ports and are flagged on the bench and in the readout, since they are almost always a mistake.

**Running.** A test run lasts 8 turns. Each turn:

1. Flows settle. A source runs while it has charge. Any other module runs when every one of its inputs carries flow; then all its outputs carry flow. A control is therefore just a module with a Signal input. A loop of carriers with no source in it never switches on.
2. The result lands on the tiles. Effectors act on their area. Every running converter gives off waste heat onto the 4 tiles around it. An open output spills onto its own tile (Matter wets it, Heat heats it, Motion and Signal go to waste). An open input draws from the terrain under its own module, which never runs out.
3. A tile that is both wet and hot steams instead: it is not hot that turn.
4. Each source spends one turn of charge. A wooden module whose tile has been hot for 2 turns in a row burns down and is gone for the rest of the run.

**Feedback.** Every edit re-runs the whole test at once, so the screen always shows the real outcome:

- Lit flow paths through each module, coloured links with moving dots between modules, a red ✕ where ports touch but can't connect, puffs where an output spills, and dimmed modules that aren't running.
- While a module is dragged over the bench, it is shown dropped there, and every panel shows the machine *with* it.
- Tile overlays for wet, hot, steam, blown air and alert; the effect area of the hovered effector; charge pips on sources; a flame on wood that is heating up.
- A readout in sentences: what each effector does and on which turns, why it stops (traced upstream to the real cause, e.g. a tank running dry or a shaft burning), problems, and notes (spills, draws, waste heat).
- A timeline with one row per effector, source and burning module across the 8 turns. Clicking a turn shows that turn on the bench.

**Terrain.** Puddle (gives Matter), Embers (give Heat, always hot), Draft (gives Motion).

**Modules.**

| Role | Module | Ports (at rotation 0) | Material | Notes |
| --- | --- | --- | --- | --- |
| Source | Water Tank | Matter out E | metal | 4 turns |
| Source | Spring | Motion out E | metal | 3 turns |
| Source | Burner | Heat out E | metal | 4 turns |
| Source | Battery | Signal out E | metal | 5 turns |
| Carrier | Shaft / Gear Corner | Motion in W, out E / N | wood | |
| Carrier | Pipe / Pipe Bend | Matter in W, out E / N | metal | |
| Carrier | Heat Rod | Heat in W, out E | metal | |
| Carrier | Wire / Wire Corner | Signal in W, out E / N | metal | |
| Converter | Pump | Motion in W, Matter in S, Matter out E | metal | |
| Converter | Water Wheel | Matter in W, Motion out E | wood | |
| Converter | Steam Engine | Heat in W, Motion out E | metal | |
| Converter | Friction Brake | Motion in W, Heat out E | metal | |
| Converter | Thermo Switch | Heat in W, Signal out E | metal | |
| Control | Valve | Matter in W, Signal in S, Matter out E | metal | |
| Control | Clutch | Motion in W, Signal in S, Motion out E | metal | |
| Effector | Sprinkler | Matter in S | metal | wets its tile and the 4 around it |
| Effector | Fan | Motion in S | wood | blows air onto the 2 tiles in front |
| Effector | Torch | Heat in S | metal | heats the tile in front |
| Effector | Alarm Bell | Signal in S | metal | alerts its tile and the 4 around it |

**Not in the prototype yet:** the tile map and the fire, placing machines on a map and committing, scarcity (every module is free and unlimited on the bench), and metal conducting heat.
