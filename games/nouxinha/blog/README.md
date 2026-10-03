# Nouxinha — pictures for the blog post

Two sets of screenshots:

- **[today.md](./today.md)**: the game as it is now (`abfa7e0`, 3 October 2026). Every kind of world,
  a before/after of the colour coming back, wisps, landmarks, sanctums, the map, the hall, the ending,
  the tutorial and the dev tools.
- **[timeline.md](./timeline.md)**: 27 past versions, from the first commit on 17 August to today. Each
  was checked out and played with the same script.

`../screenshots/` is a separate, older set. It is a full campaign played through to the credits on
5 September.

## Regenerating them

The scripts are in `tools/`. They use the test suite's dependencies (`npm install` in
`games/nouxinha`) and the preinstalled Chromium. No game code is changed.

```bash
cd games/nouxinha/blog/tools
node current.mjs ../out/current        # today's shots (a regex as a second argument picks some)
node dev.mjs ../out/current            # the dev tool pages
node timeline.mjs ../out/timeline      # every milestone in milestones.json (or "01,05,27")
```

- `current.mjs` plays each shot as a real run through `core/rules.js` in Node, saves it into a slot
  the way SAVE GAME does, then loads it in the browser and takes the last steps on the D-pad.
- `timeline.mjs` extracts each commit with `git archive`. It serves that version with the CDN Phaser
  swapped for the npm copy, then drives it the same way at every version: title, set out, a fixed
  walk, then (where the version has cheats) a cheat run and its map. Versions from 18 August onwards
  read `?seed=` from the URL, so from then on every version opens on the same seed, `DEFAULT_SEED`,
  "noux". Earlier versions already used `DEFAULT_SEED`.
