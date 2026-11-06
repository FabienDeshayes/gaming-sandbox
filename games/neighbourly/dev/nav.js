// The menu across the top of every development page, and the look they share.
//
// Every page puts an empty `<nav id="tools">` first thing in its body and
// loads this module, which fills it in, marks the page it is on, and adds the
// shared styles. Adding a tool is a line in `TOOLS`. Not part of the game:
// nothing in `src/` imports it.

import { PALETTE } from '../src/data/palette.js';

export const TOOLS = [
  { href: 'entities.html', label: 'BROWSE', about: 'every piece in every set: sprite, rule, numbers' },
  { href: 'sets.html', label: 'SETS', about: 'define the sets and what each piece does, and try them on a board' },
  { href: 'palette.html', label: 'PALETTE', about: 'edit the 32 colours and see every sprite in them' },
  { href: 'draw.html', label: 'DRAW', about: "draw a sprite's pixels" },
  { href: 'text.html', label: 'WORDS', about: 'review and edit every word the player reads' },
];

const hex = (name) => PALETTE.find((c) => c.name === name)?.hex || '#000';

const STYLE = `
  :root {
    --bg: ${hex('ink')}; --panel: ${hex('night')}; --edge: ${hex('slate')};
    --fg: ${hex('white')}; --dim: ${hex('mist')}; --accent: ${hex('lemon')};
    --good: ${hex('leaf')}; --bad: ${hex('coral')};
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--fg); font: 14px/1.4 system-ui, sans-serif; }
  main { padding: 16px; max-width: 1400px; margin: 0 auto; }
  h1 { font-size: 20px; margin: 0 0 4px; } h2 { font-size: 15px; margin: 18px 0 8px; color: var(--dim); text-transform: uppercase; letter-spacing: 1px; }
  p.about { color: var(--dim); margin: 0 0 14px; max-width: 70ch; }
  button, select, input, textarea { font: inherit; color: var(--fg); background: var(--panel); border: 1px solid var(--edge); padding: 5px 8px; }
  button { cursor: pointer; } button:hover { border-color: var(--accent); }
  button.primary { background: ${hex('green')}; border-color: ${hex('leaf')}; }
  textarea { width: 100%; font: 12px/1.4 monospace; }
  .panel { background: var(--panel); border: 1px solid var(--edge); padding: 12px; }
  .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .muted { color: var(--dim); } .bad { color: var(--bad); } .good { color: var(--good); }
  canvas.px { image-rendering: pixelated; }
  code { font-family: monospace; color: var(--accent); }
  nav#tools { display: flex; flex-wrap: wrap; gap: 2px; padding: 0 16px; background: var(--panel); border-bottom: 1px solid var(--edge); font: 12px/1 monospace; letter-spacing: 1px; }
  nav#tools a { display: flex; align-items: center; padding: 10px; min-height: 36px; color: var(--fg); text-decoration: none; opacity: .65; border-bottom: 2px solid transparent; }
  nav#tools a:hover { opacity: 1; } nav#tools a[aria-current] { opacity: 1; border-bottom-color: var(--accent); }
  nav#tools .play { margin-left: auto; }
  @media (max-width: 700px) { main { padding: 12px 16px; } }
`;

function mount() {
  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.prepend(style);
  const nav = document.getElementById('tools');
  if (!nav) return;
  const here = location.pathname.split('/').pop() || 'index.html';
  for (const tool of TOOLS) {
    const a = document.createElement('a');
    a.href = tool.href;
    a.textContent = tool.label;
    a.title = tool.about;
    if (tool.href === here) a.setAttribute('aria-current', 'page');
    nav.append(a);
  }
  const play = document.createElement('a');
  play.className = 'play';
  play.href = 'index.html';
  play.textContent = 'PLAY ▸';
  nav.append(play);
}

mount();
