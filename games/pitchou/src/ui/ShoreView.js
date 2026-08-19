import {
  COLORS,
  FLIP_MS,
  FONT,
  RESOURCE_COLORS,
  SHORE_BAND_H,
  SHORE_CELL,
  SHORE_COLS,
  SHORE_LEFT,
  SHORE_TOP,
  SPRITE_PX,
  TALLY_Y,
  GAME_WIDTH,
} from '../config.js';

const TOKEN_PX = 32;
const PLATE = SHORE_CELL - 8;

// The shore: one face-down plate per token in tonight's bag, each flipping in
// place as it is drawn and staying face-up until the night ends, plus the tally
// of what is still out there.
//
// The tally counts *down*, in whole tokens, because the only unknown in this
// game is draw order — the contents are inspectable at all times (DESIGN.md §5)
// and the odds are meant to be arithmetic a child can do out loud, which a
// percentage is not.
//
// The plates are slots, not positions in the bag. `search()` pops the bag from
// the end, so nothing on screen may imply that the leftmost plate is next: the
// first token drawn flips the first slot, and that is all the order there is.
export function createShoreView(scene) {
  const cells = [];
  const tally = {};
  const objects = [];

  const heading = scene.add
    .text(GAME_WIDTH / 2, TALLY_Y - 24, 'STILL OUT THERE', {
      fontFamily: FONT,
      fontSize: '11px',
      color: COLORS.dim,
    })
    .setOrigin(0.5);
  objects.push(heading);

  // Four groups across the width: the three resources and the waves.
  const groups = [
    { key: 'oil', tint: RESOURCE_COLORS.oil },
    { key: 'wood', tint: RESOURCE_COLORS.wood },
    { key: 'plank', tint: RESOURCE_COLORS.plank },
    { key: 'waves', tint: COLORS.foamHex, sprite: 'wave' },
  ];
  groups.forEach((group, i) => {
    const x = 72 + i * 112;
    const icon = scene.add
      .image(x - 16, TALLY_Y, group.sprite || group.key)
      .setScale(24 / SPRITE_PX)
      .setTint(group.tint);
    const count = scene.add
      .text(x + 6, TALLY_Y, '0', { fontFamily: FONT, fontSize: '18px', color: COLORS.text })
      .setOrigin(0, 0.5);
    tally[group.key] = count;
    objects.push(icon, count);
  });

  function cellAt(index) {
    const rows = Math.max(1, Math.ceil(cells.length / SHORE_COLS));
    const gridH = rows * SHORE_CELL;
    const top = SHORE_TOP + (SHORE_BAND_H - gridH) / 2;
    const col = index % SHORE_COLS;
    const row = Math.floor(index / SHORE_COLS);
    // The last row is centred on its own, so a shore of 22 doesn't leave a
    // ragged gap on the right.
    const inRow = Math.min(SHORE_COLS, cells.length - row * SHORE_COLS);
    const rowLeft = SHORE_LEFT + ((SHORE_COLS - inRow) * SHORE_CELL) / 2;
    return {
      x: rowLeft + col * SHORE_CELL + SHORE_CELL / 2,
      y: top + row * SHORE_CELL + SHORE_CELL / 2,
    };
  }

  function faceDown(cell) {
    cell.plate.setFillStyle(COLORS.panelHex).setStrokeStyle(2, COLORS.panelEdgeHex);
    cell.icon.setTexture('tokenBack').setTint(COLORS.dimHex).setScale(TOKEN_PX / SPRITE_PX);
  }

  function faceUp(cell, token) {
    const isWave = token.kind === 'wave';
    cell.plate
      .setFillStyle(isWave ? COLORS.panelHex : COLORS.bgHex)
      .setStrokeStyle(2, isWave ? COLORS.foamHex : RESOURCE_COLORS[token.resource]);
    cell.icon
      .setTexture(isWave ? 'wave' : token.resource)
      .setTint(isWave ? COLORS.foamHex : RESOURCE_COLORS[token.resource])
      .setScale(TOKEN_PX / SPRITE_PX);
    // A doubled token is the whole point of a tool, so it says so.
    cell.amount.setText(!isWave && token.amount > 1 ? `x${token.amount}` : '');
    cell.amount.setColor(isWave ? COLORS.foam : COLORS.text);
  }

  const view = {
    // Lay out one face-down plate per token in the bag.
    deal(bag) {
      view.destroyCells();
      // Fill the array first: cellAt centres the grid from the total count, so
      // it has to know how many plates there are before placing the first one.
      for (let i = 0; i < bag.length; i++) cells.push({});
      cells.forEach((cell, i) => {
        const at = cellAt(i);
        cell.plate = scene.add.rectangle(at.x, at.y, PLATE, PLATE, COLORS.panelHex);
        cell.icon = scene.add.image(at.x, at.y, 'tokenBack');
        cell.amount = scene.add
          .text(at.x + PLATE / 2 - 4, at.y + PLATE / 2 - 3, '', {
            fontFamily: FONT,
            fontSize: '13px',
            color: COLORS.text,
          })
          .setOrigin(1, 1);
        faceDown(cell);
      });
      view.revealed = 0;
    },

    // Turn the next slot face-up. Resolves when the flip is done, so the scene
    // can hold input for exactly as long as the animation runs.
    reveal(token, animate = true) {
      const cell = cells[view.revealed];
      view.revealed += 1;
      if (!cell) return Promise.resolve();
      if (!animate) {
        faceUp(cell, token);
        return Promise.resolve();
      }
      const targets = [cell.plate, cell.icon];
      return new Promise((resolve) => {
        scene.tweens.add({
          targets,
          scaleX: 0,
          duration: FLIP_MS / 2,
          ease: 'Quad.easeIn',
          onComplete: () => {
            faceUp(cell, token);
            cell.icon.setScale(0, TOKEN_PX / SPRITE_PX);
            scene.tweens.add({
              targets: [cell.plate],
              scaleX: 1,
              duration: FLIP_MS / 2,
              ease: 'Quad.easeOut',
            });
            scene.tweens.add({
              targets: [cell.icon],
              scaleX: TOKEN_PX / SPRITE_PX,
              duration: FLIP_MS / 2,
              ease: 'Quad.easeOut',
              onComplete: resolve,
            });
          },
        });
      });
    },

    // Counts from `countTokens(state.bag)` — what a player would get by
    // subtracting the face-up plates from the shore, done for them.
    setTally(counts) {
      tally.oil.setText(String(counts.oil));
      tally.wood.setText(String(counts.wood));
      tally.plank.setText(String(counts.plank));
      tally.waves.setText(String(counts.waves));
    },

    destroyCells() {
      for (const cell of cells) {
        if (!cell) continue;
        cell.plate.destroy();
        cell.icon.destroy();
        cell.amount.destroy();
      }
      cells.length = 0;
    },

    destroy() {
      view.destroyCells();
      objects.forEach((o) => o.destroy());
    },

    revealed: 0,
    cells,
  };

  return view;
}
