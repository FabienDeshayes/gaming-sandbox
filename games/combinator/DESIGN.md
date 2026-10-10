# Combinator

> Working title. Filled from design discussions so far. Sections marked _TBD_ have not been decided yet.
> The playable prototype covers two screens: a Workbench where machines are built and saved,
> and a Playground where each machine stands on one tile and works when the player says so (§12). The fire
> and the encounter loop are not built yet.

## 1. One-liner

Build machines from modules that pass four elements (Liquid, Solid, Gas, Energy) between them, then set them working to contain a spreading disaster on a tile map.

## 2. Pitch

- **What the player does:** Combines modules into machines by lining them up so elements flow from one to the next, tests them freely, places them on a tile map, and decides when each machine works. Every outcome follows deterministically from the rules.
- **Why it's fun:** A handful of simple, physically grounded rules combine into a huge space of machines. The reward is a carefully planned machine working exactly as intended, and discovering combinations nobody told you about.
- **How it differs:** Puzzle-like machine building with near-perfect information and no reflex skill, applied to a living, spreading threat rather than a static puzzle. Goals describe what must happen (e.g. "stop the fire reaching the houses"), never what must be built, so unusual machines are never punished.

## 3. Core loops

**Moment to moment (one encounter)**

1. Read the map: the threat, how it will spread, and what the environment offers.
2. Build machines on the Workbench by lining modules up in a row, and save them.
3. Test freely and as often as wanted, at no cost, on the Workbench and on the Playground.
4. Place machines on the map, one machine per tile.
5. Make machines work, one at a time, in the order the player chooses. What a machine leaves on the tiles stays there for the next one. The outcome is fully predictable from the rules.

**Session / meta**

- _TBD._ Candidate under discussion: genetics as the way new modules are acquired (e.g. fusing two modules into a new one), across a run of encounters.

## 4. Core mechanics

| Mechanic | Description | Input |
| --- | --- | --- |
| Combining | A machine is a row of modules, read left to right. Flow only goes rightwards: each input takes the nearest flow of its kind offered by a module to its left that nothing nearer has taken. A finished machine is one tile on the map. | Drag modules into the Workbench row (§12). |
| Elements | Four elements flow through ports: **Liquid**, **Solid** and **Gas** (the three states of matter) and **Energy** (what moves matter from one state to another). A port either carries its element or it doesn't (no intensity or amount). | — |
| Roles | Every module is a **Source** (gives an element), **Transmission** (sub-type **Converter**, which turns one element into another) or **Effector** (acts on the world). A machine does something only when a flow runs unbroken from a source, or from the ground, to an effector. | — |
| Working | Nothing happens on its own. Every module works for the whole run, and a machine performs its action when the player makes it work. | Click (or tap twice) a machine on the Playground. |
| Open ports | An output nobody takes spills its element onto the machine's tile; an input with nothing to take draws from the tile the machine stands on, so the same machine draws on different sources depending on where it is placed. | — |

Supporting rules:

- Every conversion gives off waste heat, which can affect nearby modules.
- Modules are made of materials (e.g. wood burns, metal conducts heat), which is how the environment threatens machines.

## 5. Constraints

- **Near-perfect information:** every rule is inspectable and every outcome predictable. Chance may shape a situation, never the result of a player's action.
- **Small rules, deep combinations:** four elements, three roles. New content should be new combinations before new rules.
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

Workbench:

| Action | Keyboard / mouse | Touch |
| --- | --- | --- |
| Add a module | Drag it from the palette into the row (between two pieces, or at the end), or click it in the palette then click the row to add it at the end | Same, with taps |
| Move a module | Drag it along the row | Drag, or ◀ ▶ in Inspect |
| Remove a module | Drag it out of the row, or Delete over it | Drag, or Remove in Inspect |
| Pick the test ground | Bare · Puddle · Sand · Gas Vent · Embers · Draft, under Test on beside the test world | Tap (in the Test tab) |
| Name the machine | Click the name, type, Enter (Esc cancels) | — |
| New / Save / Delete | The buttons at the top right. New over unsaved changes, and Delete, take a second click | Tap |
| Open a saved machine | Click it in Saved Machines (a second click if the open one has unsaved changes) | Tap |

Playground:

| Action | Keyboard / mouse | Touch |
| --- | --- | --- |
| Place a machine | Drag it from Saved Machines onto a tile, or click it then click a tile | Same, with taps |
| Make a machine work | Click it, or Space / Enter over it | Tap it to pick it out, then tap it again (or ▶ Work in Inspect) |
| Turn a machine | R over it (or while dragging it), or right-click | ⟳ Turn in Inspect |
| Move / remove a machine | Drag it to another empty tile / drag it off the grid, or Delete over it | Drag, or ✕ Remove in Inspect |
| Undo / reset the run | ↶ Undo (or Z) takes back the last action; Reset starts the run again | Under Run |
| Clear | Clear playground | Tap (under Run) |

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
- **Source layout:** `src/data/modules.js` (the elements and the module catalogue), `src/data/world.js` (terrain, what can be left on a tile and what spills leave, the Workbench row's length, the Playground grid, the starting machines and layout), `src/core/machine.js` (the rules: connections inside a machine, a machine working, a run of actions across a world, the plain-language readouts; no Phaser, so both screens and the tests share it), `src/store.js` (saved machines, the Playground layout and run, and the open Workbench draft, in `localStorage`), `src/scenes/` (`WorkbenchScene`, `PlaygroundScene`), `src/ui/` (drawing: `BenchView`, `WorldView`, `machineArt`, `moduleArt`, `tileArt`, `Readout`, `ListView`, `panelTabs`, `tabs`, `button`).
- **Key technical risks:** keeping the simulation deterministic (flows settle as a fixed point that starts with everything off, so evaluation order can't change a result; a run is replayed from its list of actions, never stored as a world), and keeping the building interface readable as machines grow.

## 12. Prototype: the Workbench and the Playground

What is playable now: two screens the player flips between with the tabs at the top (or Tab).

- **Workbench.** A row of up to 7 slots where a machine is built out of modules, then named, saved, opened again or deleted. It always shows what the machine does when it works.
- **Playground.** A 10×7 map where saved machines are placed, one machine per tile, and made to work one at a time, whenever and in whatever order the player likes. The map has ground of its own (puddles, sand, gas vents, embers, drafts) and the machines act on each other through the tiles.

**Elements.** Flows carry one of four elements: Liquid, Solid and Gas, the three classic states of matter, and Energy, which is not matter at all but what moves matter between those states (boiling, melting, freezing, condensing). That is why most converters take Energy alongside the matter they change. Each element has a colour and a shape: Liquid a blue circle, Solid a sand square, Gas a pale green diamond, Energy an amber triangle.

**Building.** A machine is a row of up to 7 modules side by side, read left to right; there are no gaps, no grid and no turning modules. Each module has inputs (drawn hollow, on its left side) and outputs (filled, on its right). The row is a line that carries flows rightwards:

- An output offers its element to every module on its right.
- An input takes the **nearest** flow of its element offered to its left that no module nearer has already taken. Each output feeds one input, so one Water Tank feeds one Sprinkler, and two tanks are needed for two.
- A flow passes by modules that don't take it, so a Battery at the start of the row can reach a Boiler three pieces along. The order still matters: a module only ever takes from its left.
- An input with nothing to take is open (it draws from the tile under the machine), and so is an output nobody takes (it spills).

There are no modules that only carry a flow along: the row itself does that. Spacing a wooden module away from a converter's waste heat is done by putting any other module between them.

**A machine is one tile.** Once built, a machine fills a single tile of the world, whatever its size on the Workbench. Its inside and the world meet in three places only:

- *Ground.* Every open input anywhere in the machine draws from the tile the machine stands on, and never runs out. The ground gives one element each: Puddle gives Liquid, Sand gives Solid, a Gas Vent gives Gas, Embers and a Draft both give Energy. Embers are also hot. So one machine draws on different sources depending on where it is placed: a Fan with nothing feeding it works on embers and in a draft alike, and a Boiler with an open Liquid input boils a puddle, or the water a neighbour's sprinkler left on its tile.
- *Effects.* Effectors act on world tiles measured from the machine's tile: a Sprinkler on the machine's own tile and the 4 around it, a Fan on the 2 tiles in front, a Torch and a Sand Chute on the tile in front. "In front" is the machine's front: north until the machine is turned on the map. Every effector in a machine faces the same way.
- *Spills.* An open output spills its element onto the machine's tile: Liquid wets it, Solid sands it, Gas fills it with fumes, Energy heats it.

**What tiles keep.** What a machine leaves on a tile stays there until the run is reset: water (wet), sand, fumes, wind and heat. Each is also something to draw: a machine standing on a wet tile can draw Liquid from it, on a sanded tile Solid, in fumes Gas, in wind or on a hot tile Energy. Water on a hot tile turns the heat to steam and sand smothers it; either way the tile is not hot, and its heat gives nothing.

Waste heat stays inside: a working converter heats the modules either side of it in the row, not the world. Whatever is on the machine's tile is felt by every module in it, so water on the tile (from its own sprinkler or a neighbour's) turns the heat inside the machine to steam, and embers under it heat every wooden part.

Machines don't connect to each other through ports: they only meet through the tiles. That keeps a machine a sealed unit that behaves the same wherever it is placed, apart from what the ground and its neighbours have left on its tile.

**Working.** Nothing runs out and nothing happens on its own: there are no turns. Every module works for the whole run, and a machine performs its action each time the player makes it work. One action:

1. The machine settles its flows against what its tile offers at that moment. A source always gives. Any other module works when every one of its inputs carries flow; then all its outputs carry flow. Which output feeds which input is fixed by the row.
2. Its effectors leave their mark on the tiles they reach, and its open outputs spill onto its own tile. These stay.
3. Each module feels waste heat from a converter beside it plus whatever is on its tile. A wooden module that is hot (not steamed or smothered) burns down once the action is done, and is gone for the rest of the run. A wooden module in another machine burns too if this action heats that machine's tile.

So the order matters: the Steam Fan's wooden fan, beside its engine's waste heat, burns the first time it works on dry ground; make the Tank Sprinkler next to it work first and its tile is wet, the heat turns to steam and the fan survives every time.

The run is the list of actions so far. It is replayed from the start whenever anything changes (a machine moved, turned, added, removed, or saved differently on the Workbench), so the map always shows the real outcome of those actions in that order. Undo takes back the last action; Reset clears the run and every tile. The order machines are listed in can never change a result, only the order the player makes them work.

The Workbench runs exactly the same rules: the machine alone in the middle of a small 5×5 world, standing on the ground picked under "Test on", made to work once. A machine's test ground is saved with it.

**Saving.** Saved machines, the Playground layout and its run, and the machine open on the Workbench (saved or not) are kept in the browser's `localStorage`, so flipping screens or reloading never loses work. Machines saved by older versions of the prototype are read as a row, left to right (top to bottom within a column, for machines built on a grid); a Spring becomes a Battery and a Burner a Gas Bottle, which do their jobs with the new elements, and modules that no longer exist (the Pump, Friction Brake, Thermo Switch, Valve, Clutch and Alarm Bell) are left out. A placed machine always shows its last saved version: saving a change on the Workbench changes every copy on the Playground, and deleting a machine takes it off the Playground and out of the run. Unsaved changes stay on the Workbench until saved; New or opening another machine over them, and Delete, ask for a second click. A first visit starts with three saved machines (Tank Sprinkler, Puddle Torch, Steam Fan), all three placed, and nothing worked yet.

**Feedback.** Every edit re-runs everything at once, so both screens always show the real outcome, including while a module or machine is being dragged (it is shown dropped where it hovers).

- Workbench: lit flow paths, coloured links with moving dots (a link that skips modules runs over their tops), puffs where an output spills, dots rising from the ground into an input that draws from it, dimmed modules that don't work, the ground as a band under the row, overlays for waste heat, wet, sand and steam, a flame on hot wood. Under each module, a few words: its place and whether it works (and burns), where each input comes from, where each output goes, what it does to the world, and what it is feeling. "Working once" shows the machine as a tile with what it leaves round it; hovering an effector there shows its reach. The grounds under "Test on" each say which element they give.
- Playground: each machine drawn as its row shrunk onto its tile, with a notch on the side it faces; modules that would work if the machine worked now are lit, the others dim, burnt ones dark. Tiles show what has been left on them (wet, sand, fumes, wind, hot, steam). The hovered machine shows its reach; a machine that has just worked flashes. Under the map, the run: how many actions so far and which machine worked in each.
- A readout in sentences on each screen: what each effector does when its machine works, why one can't (traced upstream to the real cause), what would burn, and notes. On the Playground it is what each machine would do if made to work now, and the notes say which machines have left what on which others' tiles and where each draws its elements from.

**On a phone.** A screen held upright gets a mobile layout of both screens, picked at load (turning the phone reloads into the other layout; `?layout=mobile` or `?layout=desktop` forces one). It is one column: the row on top, what you drag from under it (the palette one shelf at a time on the Workbench, the saved machines in two columns on the Playground), and a tabbed panel at the bottom. The Workbench tabs are Readout, Inspect, Test (the test world and the grounds) and Saved; the Playground's are Readout, Inspect and Run (the run, Undo, Reset and Clear). A finger has no hover, so a tap picks a thing out and shows it in Inspect. Inspect has ◀ ▶ and Remove for a module picked out of the row. On the Playground a second tap on a machine already picked out makes it work, and Inspect has Work, Turn and Remove for it. Dragging works as on desktop. A machine is named through the phone's own keyboard.

**Modules.**

| Role | Module | Takes (left) | Gives (right) | Material | Notes |
| --- | --- | --- | --- | --- | --- |
| Source | Water Tank | | Liquid | metal | |
| Source | Sand Hopper | | Solid | metal | |
| Source | Gas Bottle | | Gas | metal | |
| Source | Battery | | Energy | metal | |
| Converter | Boiler | Liquid, Energy | Gas | metal | |
| Converter | Condenser | Gas | Liquid | metal | |
| Converter | Melter | Solid, Energy | Liquid | metal | |
| Converter | Freezer | Liquid, Energy | Solid | metal | |
| Converter | Water Wheel | Liquid | Energy | wood | |
| Converter | Steam Engine | Gas | Energy | metal | |
| Effector | Sprinkler | Liquid | | metal | wets the machine's tile and the 4 around it |
| Effector | Sand Chute | Solid | | metal | sands the tile in front of the machine |
| Effector | Fan | Energy | | wood | blows wind onto the 2 tiles in front of the machine |
| Effector | Torch | Gas | | metal | heats the tile in front of the machine |

**Not in the prototype yet:** the fire and anything for machines to protect, committing a layout, machines connecting to each other through ports, scarcity (every module and machine is free and unlimited, and nothing runs out), anything that clears a tile other than Reset, and metal conducting heat.
