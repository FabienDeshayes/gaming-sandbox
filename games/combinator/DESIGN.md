# Combinator

> Working title. Filled from design discussions so far. Sections marked _TBD_ have not been decided yet.
> The playable prototype covers two screens: a Workbench where machines are built and saved,
> and a Playground where each machine stands on one tile and a round plays out (§12). The fire
> and the encounter loop are not built yet.

## 1. One-liner

Build machines from modules that pass four flows (Motion, Matter, Heat, Signal) between them, then watch them contain a spreading disaster on a tile map.

## 2. Pitch

- **What the player does:** Combines modules into machines by connecting their ports, tests them freely, places them on a tile map, commits, and watches a deterministic simulation play out.
- **Why it's fun:** A handful of simple, physically grounded rules combine into a huge space of machines. The reward is a carefully planned machine working exactly as intended, and discovering combinations nobody told you about.
- **How it differs:** Puzzle-like machine building with near-perfect information and no reflex skill, applied to a living, spreading threat rather than a static puzzle. Goals describe what must happen (e.g. "stop the fire reaching the houses"), never what must be built, so unusual machines are never punished.

## 3. Core loops

**Moment to moment (one encounter)**

1. Read the map: the threat, how it will spread, and what the environment offers.
2. Build machines on the Workbench by connecting modules through ports, and save them.
3. Test freely and as often as wanted, at no cost, on the Workbench and on the Playground.
4. Place machines on the map, one machine per tile, and commit.
5. Watch the simulation resolve turn by turn. The outcome is fully predictable from the rules.

**Session / meta**

- _TBD._ Candidate under discussion: genetics as the way new modules are acquired (e.g. fusing two modules into a new one), across a run of encounters.

## 4. Core mechanics

| Mechanic | Description | Input |
| --- | --- | --- |
| Combining | Modules connect through ports. Only ports carrying the same flow can connect, and only an output to an input. A finished machine is one tile on the map. | Drag modules onto the Workbench grid; ports on touching sides connect (§12). |
| Flows | Four abstract flows: Motion, Matter, Heat, Signal. A port either carries its flow or it doesn't (no intensity or amount). | — |
| Roles | Every module is a **Source** (produces a flow), **Transmission** (carries a flow; sub-types **Converter**, which turns one flow into another, and **Control**, which gates a flow on a Signal) or **Effector** (acts on the world). A machine works only when a flow runs unbroken from a source to an effector. | — |
| Open ports | An unconnected output spills its flow onto the machine's tile; an unconnected input draws from the ground the machine stands on, so the environment can act as a source. | — |

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

Both screens:

| Action | Keyboard / mouse | Touch |
| --- | --- | --- |
| Flip between Workbench and Playground | The tabs at the top, or Tab | Tap a tab |
| Inspect | Hover a module, machine, list row or tile | — |
| Run | ▶ plays turns 1–8; \|◀ ▶\| or ← → step; click a turn in the timeline; Space plays | Tap the buttons or a turn |

Workbench:

| Action | Keyboard / mouse | Touch |
| --- | --- | --- |
| Place a module | Drag it from the palette onto a cell, or click it in the palette then click a cell | Same, with taps |
| Turn a module | Click it, or R over it (R also turns the module being dragged), or right-click | Tap it |
| Move / remove a module | Drag it to another empty cell / drag it off the grid, or Delete over it | Drag |
| Pick the test ground | Bare · Puddle · Embers · Draft, next to the name | Tap |
| Name the machine | Click the name, type, Enter (Esc cancels) | — |
| New / Save / Delete | The buttons at the top right. New over unsaved changes, and Delete, take a second click | Tap |
| Open a saved machine | Click it in Saved Machines (a second click if the open one has unsaved changes) | Tap |

Playground:

| Action | Keyboard / mouse | Touch |
| --- | --- | --- |
| Place a machine | Drag it from Saved Machines onto a tile, or click it then click a tile | Same, with taps |
| Turn a machine | Click it, R over it (or while dragging it), or right-click | Tap it |
| Move / remove a machine | Drag it to another empty tile / drag it off the grid, or Delete over it | Drag |
| Clear | Clear playground | Tap |

## 8. Scope (MVP vs. cut)

**Must have (MVP)**

- _TBD_ for the full game. The current prototype is building machines and trying them out on a map with no threat yet (§12).

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
- **Source layout:** `src/data/modules.js` (the module catalogue and `TUNING`), `src/data/world.js` (terrain, the Workbench and Playground grids, the starting machines and layout), `src/core/machine.js` (the rules: connections inside a machine, the round across a world, the plain-language readouts; no Phaser, so both screens and the tests share it), `src/store.js` (saved machines, the Playground layout and the open Workbench draft, in `localStorage`), `src/scenes/` (`WorkbenchScene`, `PlaygroundScene`), `src/ui/` (drawing: `BenchView`, `WorldView`, `machineArt`, `moduleArt`, `tileArt`, `Timeline`, `Readout`, `ListView`, `tabs`, `button`).
- **Key technical risks:** keeping the simulation deterministic (flows settle as a fixed point that starts with everything off, so evaluation order can't change a result), and keeping the building interface readable as machines grow.

## 12. Prototype: the Workbench and the Playground

What is playable now: two screens the player flips between with the tabs at the top (or Tab).

- **Workbench.** A 7×5 grid where a machine is built out of modules, then named, saved, opened again or deleted. It always shows what the machine will do.
- **Playground.** A 10×7 map where saved machines are placed, one machine per tile, and a round of 8 turns plays out. The map has ground of its own (puddles, embers, drafts) and the machines act on each other through the tiles.

**Building.** A module fills one cell of the Workbench and has up to four ports, one per side. Rotating it turns its ports. Two modules are connected when the ports on their shared side carry the same flow and one is an output, the other an input. Ports that touch but can't connect (different flows, or two outputs/two inputs) behave like open ports and are flagged on the Workbench and in the readout, since they are almost always a mistake.

**A machine is one tile.** Once built, a machine fills a single tile of the world, whatever its size on the Workbench. Its inside and the world meet in three places only:

- *Ground.* The tile the machine stands on is its ground. Every open input anywhere in the machine draws from that ground (Puddle gives Matter, Embers give Heat, Draft gives Motion), and it never runs out. Embers are also hot.
- *Effects.* Effectors act on world tiles measured from the machine's tile: a Sprinkler or Bell on the machine's own tile and the 4 around it, a Fan on the 2 tiles in front, a Torch on the tile in front. "In front" is the effector's facing turned by the machine's own rotation on the map.
- *Spills.* An open output spills onto the machine's tile: Matter wets it, Heat heats it, Motion and Signal go to waste.

Waste heat stays inside: a running converter heats the cells round it on the Workbench grid, not the world. Whatever lands on the machine's tile lands on every module in it, so water on the tile (from its own sprinkler or a neighbour's) turns heat inside the machine to steam, and embers under it heat every wooden part.

Machines don't connect to each other through ports: they only meet through the tiles. That keeps a machine a sealed unit that behaves the same wherever it is placed, apart from what the ground and its neighbours do to its tile.

**Running.** A run lasts 8 turns. Each turn:

1. Every machine settles its flows. A source runs while it has charge. Any other module runs when every one of its inputs carries flow; then all its outputs carry flow. A control is therefore just a module with a Signal input. A loop of carriers with no source in it never switches on. Machines settle independently, so the order they are listed in can't change a result.
2. The result lands on the world. Effectors act on their area, open outputs spill onto the machine's tile, and embers are hot. A tile that is both wet and hot steams instead: it is not hot that turn.
3. Each module feels its own cell's waste heat plus its machine's tile. Wet and hot together steam.
4. Each source spends one turn of charge. A wooden module that has been hot for 2 turns in a row burns down and is gone for the rest of the run.

The Workbench runs exactly the same rules, with the machine alone in the middle of a small 5×5 world standing on the ground picked under "Test on". A machine's test ground is saved with it.

**Saving.** Saved machines, the Playground layout and the machine open on the Workbench (saved or not) are kept in the browser's `localStorage`, so flipping screens or reloading never loses work. A placed machine always shows its last saved version: saving a change on the Workbench changes every copy on the Playground, and deleting a machine takes it off the Playground. Unsaved changes stay on the Workbench until saved; New or opening another machine over them, and Delete, ask for a second click. A first visit starts with three saved machines (Tank Sprinkler, Puddle Pump, Steam Fan) and all three placed. The Steam Fan burns its own shaft on the Workbench, but on the Playground it stands on the Tank Sprinkler's wet tile and survives, which is the point of testing in context.

**Feedback.** Every edit re-runs the whole run at once, so both screens always show the real outcome, including while a module or machine is being dragged (it is shown dropped where it hovers).

- Workbench: lit flow paths, coloured links with moving dots, a red ✕ where ports touch but can't connect, puffs where an output spills, dimmed modules that aren't running, the ground as a frame round the grid, cell overlays for waste heat, wet and steam, charge pips, a flame on wood heating up. "In the world" shows the machine as a tile with what it does round it; hovering an effector there shows its reach.
- Playground: each machine drawn as its layout shrunk onto its tile, modules lit while running and dark once burnt; tile overlays for wet, hot, steam, air and alert; the reach of the hovered machine.
- A readout in sentences on each screen: what each effector does and on which turns, why it stops (traced upstream to the real cause), problems, and notes. On the Playground the notes say which machines wet or heat which others.
- A timeline: one row per source, effector and burning module on the Workbench; one row per machine on the Playground. Clicking a turn shows it.

**On a phone.** A screen held upright gets a mobile layout of both screens, picked at load (turning the phone reloads into the other layout; `?layout=mobile` or `?layout=desktop` forces one). It is one column: the grid on top, what you drag from under it (the palette one shelf at a time on the Workbench, the saved machines in two columns on the Playground), and a tabbed panel at the bottom. The Workbench tabs are Readout, Inspect, Test run (the ground, the run controls, the test world and the timeline) and Saved; the Playground's are Readout, Inspect and Round (the run controls, Clear and the timeline). A finger has no hover, so a tap picks a thing out and shows it in Inspect; a second tap on a placed module or machine turns it, and Inspect has Turn and Remove buttons for it. Dragging works as on desktop. A machine is named through the phone's own keyboard.

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
| Effector | Sprinkler | Matter in S | metal | wets the machine's tile and the 4 around it |
| Effector | Fan | Motion in S | wood | blows air onto the 2 tiles in front of the machine |
| Effector | Torch | Heat in S | metal | heats the tile in front of the machine |
| Effector | Alarm Bell | Signal in S | metal | alerts the machine's tile and the 4 around it |

**Not in the prototype yet:** the fire and anything for machines to protect, committing a layout, machines connecting to each other through ports, scarcity (every module and machine is free and unlimited), and metal conducting heat.
