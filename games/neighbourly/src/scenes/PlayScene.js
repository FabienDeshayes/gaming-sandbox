// The whole run in one scene: the board, the offers, the tap-to-preview panel,
// and the end-of-level and set-list overlays (in-canvas, not separate scenes).
//
// Interaction: tap an offer to pick it, tap a tile to see what placing it
// there would do (the info panel and +n/-n on every tile that moves), then
// PLACE. Tapping a tile with no offer picked inspects what is there. Every
// number shown comes from src/core/rules.js; this scene holds no rule.

import {
  BOARD_X,
  BOARD_Y,
  CELL,
  COLORS,
  FONT,
  FONT_LG,
  FONT_MD,
  FONT_SM,
  GAME_HEIGHT,
  GAME_WIDTH,
  HEADER_Y,
  INFO_H,
  INFO_Y,
  OFFER_H,
  OFFER_W,
  OFFER_XS,
  OFFER_Y,
  PLACE_Y,
  RARITY_COLORS,
  RARITY_LABELS,
  SCORE_BAR_H,
  SCORE_BAR_Y,
} from '../config.js';
import { PIECES, pieceDef } from '../data/pieces.js';
import {
  createRun,
  currentOffer,
  nextLevel,
  place,
  previewPlacement,
  scoreBoard,
  targetFor,
  turnsLeft,
} from '../core/rules.js';
import { breakdown } from '../ui/describe.js';
import { button } from '../ui/button.js';

const text = (scene, x, y, s, size = FONT_SM, color = COLORS.text, extra = {}) =>
  scene.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, ...extra });

export class PlayScene extends Phaser.Scene {
  constructor() {
    super('PlayScene');
  }

  init(data) {
    this.seed = data && data.seed != null ? data.seed : null;
  }

  create() {
    this.run = createRun(this.seed == null ? {} : { seed: this.seed });
    this.selOffer = null;
    this.selTile = null;
    this.overlay = null;

    const { cols, rows } = this.run.tuning;

    // Header: level and turn on the left, score against target on the right.
    this.levelText = text(this, 20, HEADER_Y, '', FONT_MD, COLORS.text, { fontStyle: 'bold' });
    this.turnText = text(this, 20, HEADER_Y + 26, '', FONT_SM, COLORS.dim);
    this.scoreText = text(this, GAME_WIDTH - 86, HEADER_Y, '', FONT_MD, COLORS.text, { fontStyle: 'bold' }).setOrigin(1, 0);
    this.targetText = text(this, GAME_WIDTH - 86, HEADER_Y + 26, '', FONT_SM, COLORS.dim).setOrigin(1, 0);
    this.setButton = button(this, GAME_WIDTH - 42, HEADER_Y + 20, 'SET', () => this.openSetList(), {
      w: 60,
      h: 40,
      size: FONT_SM,
      color: COLORS.panel,
    });
    this.scoreBar = this.add.graphics();

    // The board.
    this.boardGfx = this.add.graphics();
    this.tiles = [];
    for (let i = 0; i < cols * rows; i++) {
      const { x, y } = this.tileCentre(i);
      const zone = this.add.zone(x, y, CELL, CELL).setInteractive({ useHandCursor: true });
      zone.on('pointerup', () => this.tapTile(i));
      this.tiles.push({
        zone,
        glyph: text(this, x, y - 4, '', 30, COLORS.pieceText).setOrigin(0.5),
        score: text(this, x + CELL / 2 - 8, y + CELL / 2 - 6, '', FONT_SM, COLORS.pieceText, { fontStyle: 'bold' }).setOrigin(1, 1),
        // The preview's +n/-n, on a dark tab across the tile's top edge so it
        // reads over any piece or terrain.
        delta: text(this, x, y - CELL / 2 + 1, '', 14, COLORS.gain, {
          fontStyle: 'bold',
          backgroundColor: '#000000',
          padding: { x: 4, y: 1 },
        })
          .setOrigin(0.5, 0)
          .setDepth(2),
      });
    }

    // The info panel.
    this.infoBox = this.add.rectangle(GAME_WIDTH / 2, INFO_Y + INFO_H / 2, GAME_WIDTH - 24, INFO_H, COLORS.panel).setStrokeStyle(1, COLORS.panelEdge);
    this.infoTitle = text(this, 24, INFO_Y + 8, '', FONT_MD, COLORS.text, { fontStyle: 'bold' });
    this.infoBody = text(this, 24, INFO_Y + 36, '', FONT_SM, COLORS.dim, { wordWrap: { width: GAME_WIDTH - 48 } });

    // The three offers.
    this.offerGfx = this.add.graphics();
    this.cards = OFFER_XS.map((x, k) => {
      const zone = this.add.zone(x, OFFER_Y, OFFER_W, OFFER_H).setInteractive({ useHandCursor: true });
      zone.on('pointerup', () => this.tapOffer(k));
      const top = OFFER_Y - OFFER_H / 2;
      return {
        zone,
        glyph: text(this, x, top + 30, '', 30, COLORS.pieceText).setOrigin(0.5),
        name: text(this, x, top + 62, '', FONT_MD, COLORS.text, { fontStyle: 'bold' }).setOrigin(0.5, 0),
        rarity: text(this, x, top + 86, '', FONT_SM, COLORS.dim).setOrigin(0.5, 0),
        rule: text(this, x, top + 106, '', 14, COLORS.text, { align: 'center', wordWrap: { width: OFFER_W - 12 } }).setOrigin(0.5, 0),
      };
    });

    this.placeButton = button(this, GAME_WIDTH / 2, PLACE_Y, 'PLACE', () => this.commit(), { w: 220, h: 54 });

    this.refresh();
  }

  tileCentre(i) {
    const { cols } = this.run.tuning;
    return { x: BOARD_X + (i % cols) * CELL + CELL / 2, y: BOARD_Y + Math.floor(i / cols) * CELL + CELL / 2 };
  }

  // --- input ------------------------------------------------------------------

  tapOffer(k) {
    if (this.overlay || this.run.status !== 'playing') return;
    this.selOffer = this.selOffer === k ? null : k;
    this.refresh();
  }

  tapTile(i) {
    if (this.overlay) return;
    this.selTile = this.selTile === i && this.selOffer == null ? null : i;
    this.refresh();
  }

  commit() {
    if (this.overlay || this.selOffer == null || this.selTile == null || this.run.status !== 'playing') return;
    place(this.run, this.selOffer, this.selTile);
    this.selOffer = null;
    this.selTile = null;
    this.refresh();
    if (this.run.status !== 'playing') this.openLevelEnd();
  }

  // --- drawing ----------------------------------------------------------------

  refresh() {
    const run = this.run;
    const { tuning } = run;
    const scored = scoreBoard(run.board, run.terrain, tuning);
    const offer = currentOffer(run);
    const picked = this.selOffer != null ? offer[this.selOffer] : null;
    const preview = picked && this.selTile != null ? previewPlacement(run, picked, this.selTile) : null;

    // Header.
    const level = Math.min(run.level, tuning.levels - 1);
    this.levelText.setText(`LEVEL ${level + 1}/${tuning.levels}`);
    this.turnText.setText(
      run.status === 'playing'
        ? `Turn ${run.turn + 1}/${tuning.turnsPerLevel} · ${turnsLeft(run)} left`
        : `Turn ${tuning.turnsPerLevel}/${tuning.turnsPerLevel}`
    );
    const target = targetFor(run, level);
    this.scoreText.setText(`SCORE ${scored.total}`);
    this.targetText.setText(`target ${target}`);
    this.scoreText.setColor(scored.total >= target ? COLORS.gain : COLORS.text);

    const barW = GAME_WIDTH - 40;
    const fill = Math.min(1, scored.total / target);
    this.scoreBar.clear();
    this.scoreBar.fillStyle(COLORS.panel).fillRect(20, SCORE_BAR_Y, barW, SCORE_BAR_H);
    this.scoreBar.fillStyle(scored.total >= target ? 0x5fc46b : 0xe0c15a).fillRect(20, SCORE_BAR_Y, barW * fill, SCORE_BAR_H);
    if (preview) {
      const after = Math.min(1, preview.after / target);
      this.scoreBar.lineStyle(2, 0xffffff, 0.9).strokeRect(20 + barW * after - 1, SCORE_BAR_Y - 3, 2, SCORE_BAR_H + 6);
    }

    // Board.
    const g = this.boardGfx;
    g.clear();
    const changed = new Map(preview ? preview.changes.map((c) => [c.i, c]) : []);
    for (let i = 0; i < run.board.length; i++) {
      const { x, y } = this.tileCentre(i);
      const left = x - CELL / 2;
      const top = y - CELL / 2;
      g.fillStyle(COLORS[run.terrain[i]]).fillRect(left + 1, top + 1, CELL - 2, CELL - 2);
      if (run.terrain[i] === 'water') {
        g.lineStyle(2, 0x6fa3d6, 0.5);
        g.lineBetween(left + 12, top + 18, left + 30, top + 18);
        g.lineBetween(left + 38, top + 50, left + 58, top + 50);
      } else if (run.terrain[i] === 'rock') {
        g.fillStyle(0x857f78).fillTriangle(left + 8, top + 60, left + 22, top + 40, left + 36, top + 60);
      }
      // What would stand here after the preview, else what stands here.
      const shownId = preview && i === this.selTile ? picked : run.board[i];
      const t = this.tiles[i];
      if (shownId) {
        const def = pieceDef(shownId);
        const ghost = preview && i === this.selTile;
        g.fillStyle(COLORS.piece, ghost ? 0.7 : 1).fillRoundedRect(left + 6, top + 6, CELL - 12, CELL - 12, 8);
        g.lineStyle(4, RARITY_COLORS[def.rarity], 1).strokeRoundedRect(left + 6, top + 6, CELL - 12, CELL - 12, 8);
        t.glyph.setText(def.glyph);
        const c = changed.get(i);
        const s = c ? c.to : scored.tiles[i].score;
        t.score.setText(String(s));
      } else {
        t.glyph.setText('');
        t.score.setText('');
      }
      const c = changed.get(i);
      const d = c ? c.to - c.from : 0;
      const label = c && d !== 0 ? (d > 0 ? `+${d}` : `${d}`) : '';
      t.delta.setText(label).setVisible(label !== '');
      t.delta.setColor(d >= 0 ? COLORS.gain : COLORS.loss);
      if (i === this.selTile) g.lineStyle(4, COLORS.select, 1).strokeRect(left + 2, top + 2, CELL - 4, CELL - 4);
    }

    // Info panel.
    this.drawInfo(scored, picked, preview);

    // Offers.
    const og = this.offerGfx;
    og.clear();
    this.cards.forEach((card, k) => {
      const id = offer[k];
      const x = OFFER_XS[k];
      const top = OFFER_Y - OFFER_H / 2;
      if (!id) {
        for (const o of [card.glyph, card.name, card.rarity, card.rule]) o.setText('');
        return;
      }
      const def = pieceDef(id);
      const sel = this.selOffer === k;
      og.fillStyle(COLORS.panel).fillRoundedRect(x - OFFER_W / 2, top, OFFER_W, OFFER_H, 10);
      og.lineStyle(sel ? 4 : 2, sel ? COLORS.select : RARITY_COLORS[def.rarity], 1).strokeRoundedRect(x - OFFER_W / 2, top, OFFER_W, OFFER_H, 10);
      og.fillStyle(COLORS.piece).fillRoundedRect(x - 22, top + 8, 44, 44, 6);
      card.glyph.setText(def.glyph);
      card.name.setText(def.name);
      card.rarity.setText(RARITY_LABELS[def.rarity]).setColor('#' + RARITY_COLORS[def.rarity].toString(16).padStart(6, '0'));
      card.rule.setText(def.text);
    });

    this.placeButton.setEnabled(run.status === 'playing' && this.selOffer != null && this.selTile != null);
  }

  drawInfo(scored, picked, preview) {
    const run = this.run;
    if (preview) {
      const def = pieceDef(picked);
      const where = run.terrain[this.selTile];
      const replacing = preview.replaces ? `, replacing ${pieceDef(preview.replaces).name}` : '';
      const d = preview.delta;
      this.infoTitle.setText(`${def.name} on ${where}${replacing}: ${d >= 0 ? '+' : ''}${d}`);
      this.infoTitle.setColor(d > 0 ? COLORS.gain : d < 0 ? COLORS.loss : COLORS.text);
      this.infoBody.setText(`Board ${preview.before} → ${preview.after}. It scores ${breakdown(preview.piece)}`);
      return;
    }
    this.infoTitle.setColor(COLORS.text);
    if (this.selTile != null) {
      const where = run.terrain[this.selTile];
      const tile = scored.tiles[this.selTile];
      if (tile) {
        const def = pieceDef(tile.id);
        this.infoTitle.setText(`${def.name} on ${where}`);
        this.infoBody.setText(`Scores ${breakdown(tile)}. ${def.text}`);
      } else {
        this.infoTitle.setText(`Empty ${where}`);
        this.infoBody.setText(picked ? '' : 'Pick a piece below to see what it would score here.');
      }
      return;
    }
    if (picked) {
      this.infoTitle.setText(pieceDef(picked).name);
      this.infoBody.setText('Tap a tile to preview the score. Placing replaces whatever is there.');
    } else if (run.status === 'playing') {
      this.infoTitle.setText('Pick a piece');
      this.infoBody.setText('Choose one of the three offers, then tap a tile to see what it would score.');
    } else {
      this.infoTitle.setText('');
      this.infoBody.setText('');
    }
  }

  // --- overlays ---------------------------------------------------------------

  // A full-screen blocker plus a panel; everything in it is destroyed together.
  openOverlay(height) {
    const parts = [];
    const add = (o) => {
      o.setDepth(10);
      parts.push(o);
      return o;
    };
    const blocker = add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.65));
    blocker.setInteractive(); // swallows taps meant for the board underneath
    add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH - 40, height, COLORS.panel).setStrokeStyle(2, COLORS.panelEdge));
    this.overlay = {
      add,
      addButton: (b) => {
        b.setDepth(11);
        parts.push(b);
        return b;
      },
      close: () => {
        parts.forEach((p) => p.destroy());
        this.overlay = null;
      },
    };
    return this.overlay;
  }

  openLevelEnd() {
    const run = this.run;
    const res = run.results[run.results.length - 1];
    const ov = this.openOverlay(330);
    const cx = GAME_WIDTH / 2;
    const top = GAME_HEIGHT / 2 - 150;
    const title = { levelEnd: `LEVEL ${res.level + 1} CLEARED`, won: 'RUN COMPLETE', lost: 'RUN OVER' }[run.status];
    ov.add(text(this, cx, top, title, FONT_LG, run.status === 'lost' ? COLORS.loss : COLORS.gain, { fontStyle: 'bold' }).setOrigin(0.5, 0));
    ov.add(text(this, cx, top + 50, `Board ${res.score} · target ${res.target}`, FONT_MD).setOrigin(0.5, 0));
    let line;
    if (run.status === 'levelEnd') {
      line = `Level ${res.level + 2} needs ${targetFor(run, res.level + 1)} in ${run.tuning.turnsPerLevel} more turns. The board stays as it is.`;
    } else if (run.status === 'won') {
      line = `All ${run.tuning.levels} levels cleared with a board worth ${res.score}.`;
    } else {
      line = `${res.target - res.score} short on level ${res.level + 1} of ${run.tuning.levels}.`;
    }
    ov.add(text(this, cx, top + 90, line, FONT_SM, COLORS.dim, { align: 'center', wordWrap: { width: GAME_WIDTH - 90 } }).setOrigin(0.5, 0));
    if (run.status === 'levelEnd') {
      ov.addButton(
        button(this, cx, top + 230, 'NEXT LEVEL', () => {
          ov.close();
          nextLevel(run);
          this.refresh();
        })
      );
    } else {
      ov.addButton(button(this, cx, top + 200, 'PLAY AGAIN', () => this.scene.restart({ seed: this.seed })));
      ov.addButton(button(this, cx, top + 264, 'TITLE', () => this.scene.start('TitleScene'), { color: COLORS.buttonOff }));
    }
  }

  // Every piece in the set and its rule: the whole set is knowable, even the
  // pieces that haven't been offered yet.
  openSetList() {
    if (this.overlay) return;
    const ov = this.openOverlay(GAME_HEIGHT - 60);
    const top = 50;
    ov.add(text(this, GAME_WIDTH / 2, top, 'THE SET', FONT_LG, COLORS.text, { fontStyle: 'bold' }).setOrigin(0.5, 0));
    PIECES.forEach((p, k) => {
      const y = top + 52 + k * 54;
      const col = '#' + RARITY_COLORS[p.rarity].toString(16).padStart(6, '0');
      ov.add(text(this, 44, y, p.glyph, 24, col).setOrigin(0.5, 0));
      ov.add(text(this, 70, y, `${p.name}`, FONT_SM, COLORS.text, { fontStyle: 'bold' }));
      ov.add(text(this, GAME_WIDTH - 36, y, RARITY_LABELS[p.rarity], 14, col).setOrigin(1, 0));
      ov.add(text(this, 70, y + 20, p.text, 14, COLORS.dim, { wordWrap: { width: GAME_WIDTH - 110 } }));
    });
    ov.addButton(button(this, GAME_WIDTH / 2, GAME_HEIGHT - 66, 'CLOSE', () => ov.close(), { w: 160, h: 46 }));
  }
}
