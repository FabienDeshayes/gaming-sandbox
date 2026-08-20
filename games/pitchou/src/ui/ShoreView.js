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
  SWIPE_THRESHOLD,
} from '../config.js';

const TOKEN_PX = 38;
const PLATE = SHORE_CELL - 8;

export function createShoreView(scene) {
  const cells = [];
  let onTileTap = null;

  function cellAt(index) {
    const rows = Math.max(1, Math.ceil(cells.length / SHORE_COLS));
    const gridH = rows * SHORE_CELL;
    const top = SHORE_TOP + (SHORE_BAND_H - gridH) / 2;
    const col = index % SHORE_COLS;
    const row = Math.floor(index / SHORE_COLS);
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
    cell.amount.setText(!isWave && token.amount > 1 ? `x${token.amount}` : '');
    cell.amount.setColor(isWave ? COLORS.foam : COLORS.text);
  }

  const view = {
    deal(bag) {
      view.destroyCells();
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
        cell.flipped = false;
        faceDown(cell);

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
        cell.icon.destroy();
        cell.amount.destroy();
      }
      cells.length = 0;
    },

    destroy() {
      view.destroyCells();
    },

    cells,
  };

  return view;
}
