// The menu across the top of every development page.
//
// There are seven of them now, and each used to carry its own row of links to
// the others — in its own order, and one short whenever a page was added. This
// is the one list instead: every page puts an empty `<nav id="tools">` first
// thing in its body and loads this module, which fills it in and marks the page
// it is on. Adding a tool is adding a line to `TOOLS` below.
//
// It is drawn in the page's own `--fg`/`--bg`, which every page sets from the
// biome it is being worked in, so the menu changes colour with the page rather
// than being a fifth colour on top of it. Not part of the game, and nothing in
// `src/` imports it.

// `group` is what a tool works on: the tile sheet and the sprites cut from it,
// or the world and the words said in it.
export const TOOLS = [
  { href: 'tiles.html', label: 'SHEET', group: 'sprites', about: 'browse the tile sheet, with its coordinates on it' },
  { href: 'draw.html', label: 'DRAW', group: 'sprites', about: "draw a tile's pixels and export the sheet" },
  { href: 'paint.html', label: 'PAINT', group: 'sprites', about: "paint a tile's colour zones" },
  { href: 'biomes.html', label: 'BIOMES', group: 'sprites', about: 'say which tile each biome draws a sprite with' },
  { href: 'states.html', label: 'STATES', group: 'sprites', about: 'every way the game can draw each sprite, by biome and by gems' },
  { href: 'distances.html', label: 'DISTANCES', group: 'world', about: 'measure how far apart everything in a world is' },
  { href: 'text.html', label: 'WORDS', group: 'world', about: 'review every word the player reads' },
];

const GROUPS = { sprites: 'SPRITES', world: 'WORLD' };

const STYLE = `
  nav#tools {
    display: flex; align-items: stretch; flex-wrap: wrap; gap: 0 18px;
    padding: 0 16px;
    background: color-mix(in srgb, var(--fg) 7%, var(--bg));
    border-bottom: 1px solid color-mix(in srgb, var(--fg) 30%, transparent);
    font: 12px/1 monospace; letter-spacing: 1px;
  }
  nav#tools .group { display: flex; align-items: stretch; gap: 2px; }
  nav#tools .group b {
    align-self: center; font-weight: normal; opacity: 0.4;
    margin-right: 6px; font-size: 10px;
  }
  nav#tools a {
    display: flex; align-items: center;
    padding: 9px 10px; min-height: 34px;
    color: var(--fg); text-decoration: none; opacity: 0.65;
    border-bottom: 2px solid transparent;
  }
  nav#tools a:hover { opacity: 1; background: color-mix(in srgb, var(--fg) 12%, transparent); }
  nav#tools a[aria-current] { opacity: 1; border-bottom-color: var(--fg); }
  nav#tools .play { margin-left: auto; }
`;

function mount() {
  const nav = document.getElementById('tools');
  if (!nav) return;
  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.append(style);

  const here = location.pathname.split('/').pop() || 'index.html';
  for (const [group, name] of Object.entries(GROUPS)) {
    const box = document.createElement('div');
    box.className = 'group';
    const title = document.createElement('b');
    title.textContent = name;
    box.append(title);
    for (const tool of TOOLS.filter((t) => t.group === group)) {
      const link = document.createElement('a');
      link.href = tool.href;
      link.textContent = tool.label;
      link.title = tool.about;
      if (tool.href === here) link.setAttribute('aria-current', 'page');
      box.append(link);
    }
    nav.append(box);
  }
  const play = document.createElement('a');
  play.className = 'play';
  play.href = 'index.html';
  play.textContent = 'PLAY ▸';
  play.title = 'the game itself';
  nav.append(play);
}

mount();
