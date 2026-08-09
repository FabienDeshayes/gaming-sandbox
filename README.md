# gaming-sandbox
A sandbox to quickly iterate on web 2D games, driven by remote prompts.

## Starting a new game prototype

Use the `new-game` skill (`.claude/skills/new-game/`) to scaffold a game: it asks
for the game's name, copies the shared skeleton from `templates/game/` into
`games/<your-game-name>/`, copies the design doc template, and links the new
game from the home page (`index.html`).

To do it by hand instead:

1. Copy the game skeleton: `cp templates/game/*.html templates/game/*.js games/<your-game-name>/`
   and replace the `{{GAME_NAME}}` placeholders.
2. Copy the design doc template: `cp templates/GAME_DESIGN_DOC_TEMPLATE.md games/<your-game-name>/DESIGN.md`
3. Fill it in — keep it short, it's a working doc for a small prototype.
4. Add a link to `games/<your-game-name>/index.html` in the root `index.html`.
5. Build the prototype alongside it.
