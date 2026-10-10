# Combinator

> Working title. Filled from design discussions so far. Sections marked _TBD_ have not been decided yet.
> The playable prototype covers two screens: a Workbench where machines are built and saved,
> and a Playground where each machine stands on one tile and a round plays out (§12). The fire
> and the encounter loop are not built yet.

## 1. One-liner

Build machines from modules that pass four flows (Motion, Matter, Heat, Signal) between them, then watch them contain a spreading disaster on a tile map.

## 2. Pitch

- **What the player does:** Combines modules into machines by lining them up so flows pass from one to the next, tests them freely, places them on a tile map, commits, and watches a deterministic simulation play out.
- **Why it's fun:** A handful of simple, physically grounded rules combine into a huge space of machines. The reward is a carefully planned machine working exactly as intended, and discovering combinations nobody told you about.
- **How it differs:** Puzzle-like machine building with near-perfect information and no reflex skill, applied to a living, spreading threat rather than a static puzzle. Goals describe what must happen (e.g. "stop the fire reaching the houses"), never what must be built, so unusual machines are never punished.

## 3. Core loops

**Moment to moment (one encounter)**

1. Read the map: the threat, how it will spread, and what the environment offers.
2. Build machines on the Workbench by lining modules up in a row, and save them.
3. Test freely and as often as wanted, at no cost, on the Workbench and on the Playground.
4. Place machines on the map, one machine per tile, and commit.
5. Watch the simulation resolve turn by turn. The outcome is fully predictable from the rules.

**Session / meta**

- _TBD._ Candidate under discussion: genetics as the way new modules are acquired (e.g. fusing two modules into a new one), across a run of encounters.

## 4. Core mechanics

| Mechanic | Description | Input |
| --- | --- | --- |
| Combining | A machine is a row of modules, read left to right. Flow only goes rightwards: each input takes the nearest flow of its kind offered by a module to its left that nothing nearer has taken. A finished machine is one tile on the map. | Drag modules into the Workbench row (§12). |
| Flows | Four abstract flows: Motion, Matter, Heat, Signal. A port either carries its flow or it doesn't (no intensity or amount). | — |
| Roles | Every module is a **Source** (produces a flow), **Transmission** (sub-types **Converter**, which turns one flow into another, and **Control**, which lets a flow through only on a Signal) or **Effector** (acts on the world). A machine works only when a flow runs unbroken from a source to an effector. | — |
| Open ports | An output nobody takes spills its flow onto the machine's tile; an input with nothing to take draws from the ground the machine stands on, so the environment can act as a source. | — |

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
| Add a module | Drag it from the palette into the row (between two pieces, or at the end), or click it in the palette then click the row to add it at the end | Same, with taps |
| Move a module | Drag it along the row | Drag, or ◀ ▶ in Inspect |
| Remove a module | Drag it out of the row, or Delete over it | Drag, or Remove in Inspect |
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
- **Source layout:** `src/data/modules.js` (the module catalogue and `TUNING`), `src/data/world.js` (terrain, the Workbench row's length, the Playground grid, the starting machines and layout), `src/core/machine.js` (the rules: connections inside a machine, the round across a world, the plain-language readouts; no Phaser, so both screens and the tests share it), `src/store.js` (saved machines, the Playground layout and the open Workbench draft, in `localStorage`), `src/scenes/` (`WorkbenchScene`, `PlaygroundScene`), `src/ui/` (drawing: `BenchView`, `WorldView`, `machineArt`, `moduleArt`, `tileArt`, `Timeline`, `Readout`, `ListView`, `tabs`, `button`).
- **Key technical risks:** keeping the simulation deterministic (flows settle as a fixed point that starts with everything off, so evaluation order can't change a result), and keeping the building interface readable as machines grow.

## 12. Prototype: the Workbench and the Playground

What is playable now: two screens the player flips between with the tabs at the top (or Tab).

- **Workbench.** A row of up to 7 slots where a machine is built out of modules, then named, saved, opened again or deleted. It always shows what the machine will do.
- **Playground.** A 10×7 map where saved machines are placed, one machine per tile, and a round of 8 turns plays out. The map has ground of its own (puddles, embers, drafts) and the machines act on each other through the tiles.

**Building.** A machine is a row of up to 7 modules side by side, read left to right; there are no gaps, no grid and no turning modules. Each module has inputs (drawn on its left side) and outputs (on its right). The row is a line that carries flows rightwards:

- An output offers its flow to every module on its right.
- An input takes the **nearest** flow of its kind offered to its left that no module nearer has already taken. Each output feeds one input, so one Water Tank feeds one Sprinkler, and two tanks are needed for two.
- A flow passes by modules that don't take it, so a Battery at the start of the row can reach a Valve three pieces along. The order still matters: a module only ever takes from its left.
- An input with nothing to take is open (it draws from the ground), and so is an output nobody takes (it spills).

There are no modules that only carry a flow along: the row itself does that. Spacing a wooden module away from a converter's waste heat is done by putting any other module between them.

**A machine is one tile.** Once built, a machine fills a single tile of the world, whatever its size on the Workbench. Its inside and the world meet in three places only:

- *Ground.* The tile the machine stands on is its ground. Every open input anywhere in the machine draws from that ground (Puddle gives Matter, Embers give Heat, Draft gives Motion), and it never runs out. Embers are also hot.
- *Effects.* Effectors act on world tiles measured from the machine's tile: a Sprinkler or Bell on the machine's own tile and the 4 around it, a Fan on the 2 tiles in front, a Torch on the tile in front. "In front" is the machine's front: north until the machine is turned on the map. Every effector in a machine faces the same way.
- *Spills.* An open output spills onto the machine's tile: Matter wets it, Heat heats it, Motion and Signal go to waste.

Waste heat stays inside: a running converter heats the modules either side of it in the row, not the world. Whatever lands on the machine's tile lands on every module in it, so water on the tile (from its own sprinkler or a neighbour's) turns heat inside the machine to steam, and embers under it heat every wooden part.

Machines don't connect to each other through ports: they only meet through the tiles. That keeps a machine a sealed unit that behaves the same wherever it is placed, apart from what the ground and its neighbours do to its tile.

**Running.** A run lasts 8 turns. Each turn:

1. Every machine settles its flows. A source runs while it has charge. Any other module runs when every one of its inputs carries flow; then all its outputs carry flow. A control is therefore just a module with a Signal input. Which output feeds which input is fixed by the row, so a tank that runs dry leaves its sprinkler dry rather than it taking water from another tank. Machines settle independently, so the order they are listed in can't change a result.
2. The result lands on the world. Effectors act on their area, open outputs spill onto the machine's tile, and embers are hot. A tile that is both wet and hot steams instead: it is not hot that turn.
3. Each module feels waste heat from a converter beside it plus its machine's tile. Wet and hot together steam.
4. Each source spends one turn of charge. A wooden module that has been hot for 2 turns in a row burns down and is gone for the rest of the run.

The Workbench runs exactly the same rules, with the machine alone in the middle of a small 5×5 world standing on the ground picked under "Test on". A machine's test ground is saved with it.

**Saving.** Saved machines, the Playground layout and the machine open on the Workbench (saved or not) are kept in the browser's `localStorage`, so flipping screens or reloading never loses work. Machines saved by an older version of the prototype, built on a grid, are read as a row, left to right (top to bottom within a column), leaving out modules that no longer exist. A placed machine always shows its last saved version: saving a change on the Workbench changes every copy on the Playground, and deleting a machine takes it off the Playground. Unsaved changes stay on the Workbench until saved; New or opening another machine over them, and Delete, ask for a second click. A first visit starts with three saved machines (Tank Sprinkler, Puddle Pump, Steam Fan) and all three placed. The Steam Fan's wooden fan sits beside its engine's waste heat and burns on the Workbench, but on the Playground it stands on the Tank Sprinkler's wet tile and survives, which is the point of testing in context.

**Feedback.** Every edit re-runs the whole run at once, so both screens always show the real outcome, including while a module or machine is being dragged (it is shown dropped where it hovers).

- Workbench: lit flow paths, coloured links with moving dots (a link that skips modules runs over their tops), puffs where an output spills, dots rising from the ground into an input that draws from it, dimmed modules that aren't running, the ground as a band under the row, overlays for waste heat, wet and steam, charge pips, a flame on wood heating up. Under each module, a few words: its place and whether it is running, where each input comes from, where each output goes, what it does to the world, and what it is feeling (hot, wet, steaming). "In the world" shows the machine as a tile with what it does round it; hovering an effector there shows its reach.
- Playground: each machine drawn as its row shrunk onto its tile, with a notch on the side it faces, modules lit while running and dark once burnt; tile overlays for wet, hot, steam, air and alert; the reach of the hovered machine.
- A readout in sentences on each screen: what each effector does and on which turns, why it stops (traced upstream to the real cause), problems, and notes. On the Playground the notes say which machines wet or heat which others.
- A timeline: one row per source, effector and burning module on the Workbench; one row per machine on the Playground. Clicking a turn shows it.

**On a phone.** A screen held upright gets a mobile layout of both screens, picked at load (turning the phone reloads into the other layout; `?layout=mobile` or `?layout=desktop` forces one). It is one column: the row on top, what you drag from under it (the palette one shelf at a time on the Workbench, the saved machines in two columns on the Playground), and a tabbed panel at the bottom. The Workbench tabs are Readout, Inspect, Test run (the ground, the run controls, the test world and the timeline) and Saved; the Playground's are Readout, Inspect and Round (the run controls, Clear and the timeline). A finger has no hover, so a tap picks a thing out and shows it in Inspect. Inspect has ◀ ▶ and Remove for a module picked out of the row; a second tap on a placed machine turns it, and Inspect has Turn and Remove for it. Dragging works as on desktop. A machine is named through the phone's own keyboard.

**Modules.**

| Role | Module | Takes (left) | Gives (right) | Material | Notes |
| --- | --- | --- | --- | --- | --- |
| Source | Water Tank | | Matter | metal | 4 turns |
| Source | Spring | | Motion | metal | 3 turns |
| Source | Burner | | Heat | metal | 4 turns |
| Source | Battery | | Signal | metal | 5 turns |
| Converter | Pump | Motion, Matter | Matter | metal | |
| Converter | Water Wheel | Matter | Motion | wood | |
| Converter | Steam Engine | Heat | Motion | metal | |
| Converter | Friction Brake | Motion | Heat | metal | |
| Converter | Thermo Switch | Heat | Signal | metal | |
| Control | Valve | Matter, Signal | Matter | metal | |
| Control | Clutch | Motion, Signal | Motion | metal | |
| Effector | Sprinkler | Matter | | metal | wets the machine's tile and the 4 around it |
| Effector | Fan | Motion | | wood | blows air onto the 2 tiles in front of the machine |
| Effector | Torch | Heat | | metal | heats the tile in front of the machine |
| Effector | Alarm Bell | Signal | | metal | alerts the machine's tile and the 4 around it |

**Not in the prototype yet:** the fire and anything for machines to protect, committing a layout, machines connecting to each other through ports, scarcity (every module and machine is free and unlimited), and metal conducting heat.
