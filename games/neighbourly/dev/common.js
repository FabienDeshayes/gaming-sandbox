// Helpers the dev pages share: drawing a sprite onto a canvas, saving a file,
// and keeping an unsaved draft in the browser. Not part of the game.

// key → hex, for drawing.
export const hexByKey = (palette) => Object.fromEntries(palette.map((c) => [c.key, c.hex]));

// A canvas with `rows` drawn at `scale`, on `bg` if given.
export function spriteCanvas(rows, scale, hex, bg = null) {
  const c = document.createElement('canvas');
  c.width = rows[0].length * scale;
  c.height = rows.length * scale;
  c.className = 'px';
  drawSprite(c.getContext('2d'), rows, 0, 0, scale, hex, bg);
  return c;
}

export function drawSprite(ctx, rows, x0, y0, scale, hex, bg = null) {
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(x0, y0, rows[0].length * scale, rows.length * scale);
  } else ctx.clearRect(x0, y0, rows[0].length * scale, rows.length * scale);
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === '.' || !hex[ch]) return;
      ctx.fillStyle = hex[ch];
      ctx.fillRect(x0 + x * scale, y0 + y * scale, scale, scale);
    })
  );
}

// Hands `text` to the browser as a file to save.
export function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/javascript' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// An unsaved draft, kept per page in localStorage so a reload doesn't lose
// work. Storage can be missing or refuse (a private window): then it just
// isn't kept.
export const draft = {
  load(key) {
    try {
      const raw = localStorage.getItem(`neighbourly-dev:${key}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  save(key, value) {
    try {
      localStorage.setItem(`neighbourly-dev:${key}`, JSON.stringify(value));
    } catch {
      /* not kept */
    }
  },
  clear(key) {
    try {
      localStorage.removeItem(`neighbourly-dev:${key}`);
    } catch {
      /* nothing to clear */
    }
  },
};

// The export box every editing page ends with: the file as it would be
// written, a note on what changed, and buttons to copy or save it.
export function exportBox(host, { file, build, changed }) {
  host.innerHTML = `
    <h2>Export <code>${file}</code></h2>
    <div class="row"><button class="primary" data-act="dl">SAVE FILE</button><button data-act="copy">COPY</button><span data-note class="muted"></span></div>
    <p class="muted">Save it over <code>games/neighbourly/${file}</code>, or paste it to Claude Code. With no edits it is byte for byte the file on disk.</p>
    <textarea rows="10" readonly></textarea>`;
  const ta = host.querySelector('textarea');
  const note = host.querySelector('[data-note]');
  const name = file.split('/').pop();
  host.querySelector('[data-act=dl]').onclick = () => download(name, build());
  host.querySelector('[data-act=copy]').onclick = async () => {
    try {
      await navigator.clipboard.writeText(build());
      note.textContent = 'copied';
    } catch {
      ta.select();
      note.textContent = 'select-all done: copy it by hand';
    }
  };
  return () => {
    ta.value = build();
    const c = changed();
    note.textContent = c ? `${c} edited` : 'no edits';
    note.className = c ? 'good' : 'muted';
  };
}
