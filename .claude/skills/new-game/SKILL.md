---
name: new-game
description: Scaffold a new game prototype from the shared template — asks for the game name, copies templates/game into games/<slug>/, and adds a link to it on the home index.html. Use when the user asks to create, add, start, or generate a new game/prototype.
---

# New game generator

Scaffolds a new game under `games/<slug>/` from the shared template in
`templates/game/`, and links it from the home page (`index.html`).

## Steps

1. **Get the game name.** If not given in the invocation args, ask the user
   for the game's display name (e.g. "Starfall").

2. **Derive a slug.** Lowercase the name, replace spaces/non-alphanumeric
   runs with `-`, trim leading/trailing `-` (e.g. "Starfall" -> `starfall`,
   "Bibou 2" -> `bibou-2`). This is the folder name under `games/`.

   - If `games/<slug>/` already exists, stop and ask the user how to
     proceed (pick a different name, or confirm overwrite) rather than
     clobbering an existing game.

3. **Copy the template.**
   - Copy `templates/game/index.html` to `games/<slug>/index.html`,
     replacing every `{{GAME_NAME}}` placeholder with the display name.
   - Copy `templates/game/main.js` to `games/<slug>/main.js`, replacing
     every `{{GAME_NAME}}` placeholder with the display name.
   - Copy `templates/GAME_DESIGN_DOC_TEMPLATE.md` to
     `games/<slug>/DESIGN.md` (matches the workflow documented in
     `README.md`). Leave its placeholders as-is for the user to fill in,
     but replace the `# [Game Name]` heading with `# <display name>`.

4. **Wire it into the home page.** Edit `index.html` at the repo root and
   add a new `<li><a href="games/<slug>/index.html"><display name></a></li>`
   entry to the `<ul>` list. Keep the page static (no JS) and keep the
   existing entries — just append the new one.

5. **Report back** the files created and the path to the new game's
   `index.html` and `DESIGN.md` so the user knows where to start building.
