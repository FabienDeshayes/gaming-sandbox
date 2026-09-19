# `sim/` — playing the world to measure it

A headless bot that walks Nouxinha campaigns against the real `src/core/`, and
a survey of what the world's placement rose actually places. Both exist to
answer one question: **does it matter that a plan's `distance` is a Chebyshev
ring in a game with no diagonal steps?**

Nothing here is loaded by the game. `npm test` does not run it.

```
npm run sim              one placement rose, the three playstyles
npm run sim:compare      two or more roses, the same campaigns walked in each
npm run sim:geometry     what the roses place, with nobody playing
```

Flags go after `--`, e.g. `npm run sim:compare -- --seeds=20 --expeditions=150`.

| flag | what it does |
|---|---|
| `--seeds=N` | campaigns per cell (default 8) |
| `--expeditions=N` | cap on walks per campaign (default 120) |
| `--steps=N` | cap on steps per campaign (default 60000) |
| `--style=id` | `conservative`, `normal`, `eager`, a comma list, or `all` |
| `--roses=a,b` | `metric` or `metric:scale` — e.g. `chebyshev,manhattan,manhattan:1.3` |
| `--base=N` | the number every campaign seed comes from, so a run can be repeated |

## The two roses

`ringPoint` in `src/core/world.js` turns a plan's `distance` and a bearing into
a tile. Which ring it places on is `RING_METRIC` in `src/balance.js`, and
`setRingMetric(metric, scale)` is what this tool sweeps it with — the game
itself never calls that, and boots on the balance value at a scale of one.

* **chebyshev** — the square ring: `max(|x|, |y|)` is the distance. A thing at
  ring 110 is 110 steps away on an axis and 220 on a diagonal, because there
  are no diagonal steps.
* **manhattan** — the diamond ring: `|x| + |y|` is the distance, which *is* the
  walk. Every bearing costs the same.

A scale multiplies every plan distance, which is how the two are compared at a
walk of the same length rather than at a plan of the same number: the same
numbers are not the same world.

Two things stay Chebyshev whichever rose is picked, and should: the square
regions — a sanctum's wall, a landmark's court, an apron, `MIN_SEPARATION` —
which are shapes rather than rings, and the HUD's furthest-out counter, which
answers a different question.

## What the bot is

`autoplay.mjs` drives `createRun`, `step`, `openChest`, `bankRun` and
`turnCycle` through the real slot in `core/save.js`, so anything it reports is
something a player could have done. It is not a good player — it is a
consistent one, which is what a comparison needs.

**It knows what it has lit.** `state.explored` is its map and `seenUnique` is
what the game itself records having laid eyes on. The two things the game does
not write down — which sanctums it has seen the *wall* of, and which posts it
has walked past — it keeps itself, and both outlive an expedition the way a
player's memory does. It reads a post's **bearing and band**, never the
landmark coordinates the same call also carries.

**It routes optimistically.** Ground it has never lit is assumed to be floor,
because that is what a player heading somewhere assumes; when the next tile
turns out to be rock the walk re-plans, which is what produces wall-following.
The search is weighted A*, so its paths are a few steps off the shortest —
also what a player's are. The walk *home* is searched unweighted, because that
number is what it bets its water on.

**The wisps are its waypoints.** All ten are lit from the first reveal of a run
and on the map from then on (DESIGN.md §4.11), so walking the next one out is
what the map invites; past them it pushes into whichever of eight bearings the
campaign has lit least.

Known simplifications, all of which make the bot *worse* than a player rather
than better:

* It never buys the compass. At 250 coins that is most of a campaign's income,
  and a needle is a tool for somebody reading a screen.
* It circles a landmark on a fixed twelve-point ring to find the key chest
  beside it, rather than searching properly.
* It turns for home the moment it goes dark, which is right — a blackout walk
  reveals nothing — but it means a tank is often only half spent.

## The three styles

`styles.mjs`. Every style walks the same chain in the same order, because that
is the only order the game has. What differs is when to turn back, what is
worth a detour, and how far to push into unlit ground.

| | turns back at | detour it will take | pushes past its frontier by |
|---|---|---|---|
| conservative | walk home × 1.45 + 25 | 12 | 20 |
| normal | walk home × 1.2 + 12 | 18 | 35 |
| eager | walk home × 1.05 + 4 | 4 | 60 |

`normal` also weighs how much new ground a step would light when it has nowhere
in particular to be; `normal` and `eager` plot a course off what a post says.

**When a style does badly, check it isn't simply playing badly before
concluding the world is at fault.** That is the same warning `games/pitchou`
carries about its policies, and for the same reason.

## Reading the geometry table

`sim:geometry` has no policy in it at all, so nothing in it can be the bot's
fault. Per placed thing, over N worlds:

* **ring** — the number its plan asked for.
* **straight line** — `|x| + |y|`: the walk if the ground were empty. Under the
  diamond this is the ring; under the square it is the ring to twice it.
* **walk** — steps over the real ground, flooded out of the hut door holding
  every key.
* **walk spread** — that walk's standard deviation over its mean. **This is the
  number the comparison is about.**
* **ground tax** — walk ÷ straight line: what the rock costs, which is the same
  whichever rose is used, and so the control.
