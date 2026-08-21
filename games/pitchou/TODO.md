# TODO

Agents, don't use this file as a list of things to implement — ignore it unless you are
explicitly asked to add to it or take something out.

* **Meta progression between runs.** A season is five to eight minutes and currently
  every one of them starts from exactly the same shore with exactly the same twelve
  tools, which is why a loss reads as "that seed was unlucky" rather than "I'll do
  better next time". Wants deciding before any of it gets built: what carries over (a
  tool unlocked for good? a starting meter? a shore that begins one token richer?),
  what earns it (nights survived? tools built? a win?), and how it stays honest — the
  whole tuning in `DESIGN.md` §8 rests on every run starting from the same numbers, so
  anything persistent has to be either small enough not to move the win rate or fed
  into `sim/simulate.mjs` as another axis. Note this contradicts §9's "explicitly out
  of scope", which is the current state of the design and should be edited when this
  is actually decided rather than left as two doc sections disagreeing.
* Locked tool cards show the night they open but not what they cost, so you can't save
  up for one you can see coming. There is no room on the card for both at twelve tools;
  it probably wants the cost to replace the effect line once the tier is one night away.
* The 1-3 tokens are the only thing in the game whose value isn't knowable before it is
  drawn, which sits oddly against "no hidden information" in §5. Worth a playtest
  question: does the gamble read as exciting or as the game cheating?
* Nothing anywhere says how to play. The tools and the fall pips are learnable by
  poking, but the fact that tool costs come straight off the meters is not.
