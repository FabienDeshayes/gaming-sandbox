# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A sandbox for quickly iterating on small web-based 2D game prototypes, driven by remote prompts. The repo root is a static home page (`index.html`) that links to each prototype under `games/`. There is no monorepo tooling, no shared package.json, and no cross-game code — each game is a self-contained folder.

## Starting a new game prototype

Use the `new-game` skill (`.claude/skills/new-game/SKILL.md`) to scaffold a game: it asks for the game's display name, derives a slug, copies `templates/game/` into `games/<slug>/` with `{{GAME_NAME}}` placeholders replaced, copies `templates/GAME_DESIGN_DOC_TEMPLATE.md` to `games/<slug>/DESIGN.md`, and links the new game from the root `index.html`.

To do it by hand instead, follow the same steps in `README.md`.

The template convention (`templates/game/index.html` + `main.js`): Phaser 3 loaded via CDN `<script>` tag, no build step, a single `TitleScene`. New games are expected to grow their own scene/module structure from there as needed — see `games/bibou/` for what a more developed prototype looks like.

## Design doc convention

Every game has a `DESIGN.md` (from `templates/GAME_DESIGN_DOC_TEMPLATE.md`) that documents the game **as it currently is**, not as a changelog. When a mechanic changes, edit the relevant section in place — never leave "previously X, now Y" or "superseded" notes. Git history is the changelog; the doc is the current source of truth. This convention applies to all docs in a game folder (e.g. `games/bibou/DESIGN.md`, `LEVEL_DESIGN.md`, `TESTING.md`).

## Working in `games/bibou/` (the reference prototype)

Bibou is a turn-based grid puzzle game (move tiles to get a character to a goal). It's the most fleshed-out prototype and the one with a real test suite — read its docs before making changes:

- `DESIGN.md` — mechanics, actions (Move/Rotate/Shift/Flip), win/lose conditions, source layout table.
- `LEVEL_DESIGN.md` — coordinate system, precise action specs, per-level data.
- `TESTING.md` — how to test a level, including a full runnable headless-browser harness.

### Running tests

```bash
cd games/bibou
npm install     # playwright-core + phaser, from the allowed npm registry — do NOT run `playwright install`
npm test        # node tests/game.test.js
```

- Chromium is preinstalled in the sandbox under `/opt/pw-browsers/`; the harness (`tests/harness.js`) finds it automatically (override with `CHROMIUM_PATH`).
- `tests/harness.js` — local static server + Playwright driver (click a label, tap a cell, swipe, read Phaser scene state back out) + a minimal runner/assertions.
- `tests/game.test.js` — the suite itself. `unit(...)` tests exercise pure `src/core/rules.js` math with no browser; `test(...)` tests each drive a fresh page against the real canvas.
- `node_modules/` is gitignored; `package.json` is committed and is test-only — the game itself needs no build step and runs straight from `index.html`.
- Add a test whenever a bug fix covers something a player could hit by just playing. `TESTING.md` also covers "rule-math only" checks (import `src/core/rules.js` directly into a `.mjs`/ESM scratch file) for sanity-checking a new level's solution before wiring up the UI.

**Sandbox gotcha:** `index.html` loads Phaser from `cdn.jsdelivr.net`, but outbound CDN requests are blocked in this environment. The test harness works around this by installing Phaser from npm and serving it locally, rewriting the CDN `<script src>` on the fly in its own local server — never edit `index.html` itself to work around this.

### Source layout (`games/bibou/src/`)

| Path | Holds |
|---|---|
| `main.js` | `Phaser.Game` config and scene registration — boot only |
| `config.js` | Screen/board layout constants and the colour palette |
| `data/levels.js` | Level definitions, the `LEVELS` list — where a new level goes |
| `core/rules.js` | Pure grid math: `wrap`, `moveEntity`, `rotateEntity`, `shiftEntity`, `flipEntity`, wall logic (`isValidWallPair`, `validateLevelWalls`, `buildWallSet`, `isWallBetween`), and jam/push resolution (`resolveMoveChain`, `resolveCycleOutcome`). No Phaser, no scene state — importable straight into Node for tests. |
| `ui/button.js` | Shared text button (nav/overlay) |
| `ui/actionCard.js` | Bordered "playable card" control for the four action buttons |
| `ui/BoardView.js` | Grid/goal/wall/entity rendering, cell↔pixel mapping, transient action-preview arrows. Holds no game state. |
| `scenes/` | `TitleScene`, `LevelSelectScene`, `PuzzleScene` |
| `assets/sprites/` | Image assets loaded via `this.load.image` |

Board/entity model: a 5×5 grid with three layers — static Background (floor/goal), static Wall (edges between adjacent tiles, not tile-indexed), and movable Entity (character, crates, collectibles). Actions only ever touch the Entity layer. The board wraps (borderless). See `DESIGN.md` §4-6 for the full mechanics and `LEVEL_DESIGN.md` for exact coordinate/action semantics before changing `core/rules.js`.

## Conventions across the repo

- No build tooling anywhere in this repo: games are plain ES modules loaded via `<script type="module">`, with Phaser pulled from a CDN `<script>` tag. Because ES modules don't work over `file://`, any game must be opened through a web server, not opened as a local file.
- Keep `templates/game/` and `templates/GAME_DESIGN_DOC_TEMPLATE.md` generic — they're the skeleton every new prototype starts from, not a place for Bibou-specific logic.
