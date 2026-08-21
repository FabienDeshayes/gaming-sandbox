import {
  COLORS,
  FLIP_MS,
  FONT,
  GAME_WIDTH,
  RESOURCE_COLORS,
  SHORE_BAND_H,
  SHORE_COL_CHOICES,
  SHORE_MAX_CELL,
  SHORE_MIN_CELL,
  SHORE_TOP,
  SHORE_WIDTH,
  SPRITE_PX,
  SWIPE_THRESHOLD,
  TEXT_RESOLUTION,
} from '../config.js';
// The tile grid: face-down plates that flip in place when tapped and stay
// face-up for the rest of the night.
//
// The grid sizes itself. A shore is 15 tokens on night one and can reach 28 by
// night twelve, and the design promises every one of them is on screen at once
// (DESIGN.md §5) — so rather than fix a column count for the worst case and
// draw a typical night in postage stamps, `layoutFor` takes the fewest columns
// that still fit the band and gives the tiles all the room that leaves.
export function layoutFor(count) {
  const choices = SHORE_COL_CHOICES;
  let best = null;
  for (const cols of choices) {
    const rows = Math.max(1, Math.ceil(count / cols));
    const cell = Math.min(
      SHORE_MAX_CELL,
      Math.floor(SHORE_BAND_H / rows),
      Math.floor(SHORE_WIDTH / cols)
    );
    if (best === null || cell > best.cell) best = { cols, rows, cell };
    if (cell >= SHORE_MIN_CELL) return { cols, rows, cell };
  }
  return best;
}

export function createShoreView(scene) {
  const cells = [];
  let grid = layoutFor(0);
  let onTileTap = null;

  function tokenPx() {
    return Math.round(grid.cell * 0.72);
  }

  function platePx() {
    return grid.cell - 8;
  }

  function cellAt(index) {
    const gridH = grid.rows * grid.cell;
    const top = SHORE_TOP + (SHORE_BAND_H - gridH) / 2;
    const col = index % grid.cols;
    const row = Math.floor(index / grid.cols);
    const inRow = Math.min(grid.cols, cells.length - row * grid.cols);
    const rowLeft = (GAME_WIDTH - inRow * grid.cell) / 2;
    return {
      x: rowLeft + col * grid.cell + grid.cell / 2,
      y: top + row * grid.cell + grid.cell / 2,
    };
  }

  function clearIcons(cell) {
    for (const icon of cell.icons) icon.destroy();
    cell.icons = [];
  }

  // One image per icon, laid out in a row and shrunk to fit — a mixed token
  // shows the two or three things it actually pays, each in its own resource
  // colour, rather than one generic crate the player has to remember the
  // contents of.
  function setIcons(cell, at, keys, tints) {
    clearIcons(cell);
    const n = keys.length;
    const px = n === 1 ? tokenPx() : Math.floor((platePx() - 6) / n);
    const span = px * n;
    for (let i = 0; i < n; i++) {
      const icon = scene.add
        .image(at.x - span / 2 + px / 2 + i * px, at.y, keys[i])
        .setScale(px / SPRITE_PX)
        .setTint(tints[i]);
      cell.icons.push(icon);
    }
  }

  function faceDown(cell, at) {
    cell.plate.setFillStyle(COLORS.panelHex).setStrokeStyle(2, COLORS.panelEdgeHex);
    setIcons(cell, at, ['tokenBack'], [COLORS.dimHex]);
    cell.amount.setText('');
  }

  // A drawn token shows what it actually paid: `token.rolled` is what the rules
  // settled at the moment of the flip, so a 1-3 token reads as the 3 it turned
  // out to be rather than the promise it was.
  function faceUp(cell, at, token) {
    const isFall = token.kind === 'fall';
    if (isFall) {
      cell.plate.setFillStyle(COLORS.panelHex).setStrokeStyle(2, COLORS.fallHex);
      setIcons(cell, at, ['fall'], [COLORS.fallHex]);
      cell.amount.setText('');
      return;
    }
    const gains = token.rolled || token.gains.map((g) => ({ ...g, amount: g.amount ?? g.max }));
    cell.plate
      .setFillStyle(COLORS.bgHex)
      .setStrokeStyle(2, gains.length > 1 ? COLORS.textHex : RESOURCE_COLORS[gains[0].resource]);
    setIcons(
      cell,
      at,
      gains.map((g) => g.resource),
      gains.map((g) => RESOURCE_COLORS[g.resource])
    );
    // Only a single-resource find gets a numeral; a mixed token is read off its
    // icons, and every mixed token this game builds pays one of each.
    const total = gains.reduce((n, g) => n + g.amount, 0);
    cell.amount.setText(gains.length === 1 && total > 1 ? `x${total}` : '');
    cell.amount.setColor(COLORS.text);
  }

  const view = {
    deal(bag) {
      view.destroyCells();
      grid = layoutFor(bag.length);
      for (let i = 0; i < bag.length; i++) cells.push({ icons: [] });
      const plate = platePx();
      cells.forEach((cell, i) => {
        const at = cellAt(i);
        cell.at = at;
        cell.plate = scene.add.rectangle(at.x, at.y, plate, plate, COLORS.panelHex);
        cell.amount = scene.add
          .text(at.x + plate / 2 - 4, at.y + plate / 2 - 2, '', {
            fontFamily: FONT,
            fontSize: `${Math.max(15, Math.round(grid.cell * 0.3))}px`,
            color: COLORS.text,
            resolution: TEXT_RESOLUTION,
          })
          .setOrigin(1, 1);
        cell.flipped = false;
        faceDown(cell, at);

        cell.plate.setInteractive({ useHandCursor: true });
        cell.plate.on('pointerup', (pointer) => {
          if (pointer.getDistance() >= SWIPE_THRESHOLD) return;
          if (cell.flipped) return;
          if (onTileTap) onTileTap(i);
        });
      });
    },

    reveal(index, token, animate = true) {
      const cell = cells[index];
      if (!cell || cell.flipped) return Promise.resolve();
      cell.flipped = true;
      if (cell.plate.input) cell.plate.disableInteractive();
      if (!animate) {
        faceUp(cell, cell.at, token);
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        scene.tweens.add({
          targets: [cell.plate, ...cell.icons],
          scaleX: 0,
          duration: FLIP_MS / 2,
          ease: 'Quad.easeIn',
          onComplete: () => {
            faceUp(cell, cell.at, token);
            const scales = cell.icons.map((icon) => icon.scaleX);
            cell.icons.forEach((icon, i) => icon.setScale(0, scales[i]));
            scene.tweens.add({
              targets: [cell.plate],
              scaleX: 1,
              duration: FLIP_MS / 2,
              ease: 'Quad.easeOut',
            });
            let pending = cell.icons.length;
            if (pending === 0) {
              resolve();
              return;
            }
            cell.icons.forEach((icon, i) => {
              scene.tweens.add({
                targets: [icon],
                scaleX: scales[i],
                duration: FLIP_MS / 2,
                ease: 'Quad.easeOut',
                onComplete: () => {
                  if (--pending === 0) resolve();
                },
              });
            });
          },
        });
      });
    },

    setOnTileTap(callback) {
      onTileTap = callback;
    },

    setInteractive(on) {
      for (const cell of cells) {
        if (cell.flipped) continue;
        if (on) cell.plate.setInteractive({ useHandCursor: true });
        else if (cell.plate.input) cell.plate.disableInteractive();
      }
    },

    firstUnflipped() {
      return cells.findIndex((c) => !c.flipped);
    },

    destroyCells() {
      for (const cell of cells) {
        if (!cell) continue;
        cell.plate.destroy();
        clearIcons(cell);
        cell.amount.destroy();
      }
      cells.length = 0;
    },

    destroy() {
      view.destroyCells();
    },

    cells,
    layout: () => ({ ...grid }),
  };

  return view;
}
