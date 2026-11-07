// The whole run in one scene: the board, the offers, the tap-to-preview panel,
// and the end-of-level and set-list overlays (in-canvas, not separate scenes).
//
// Interaction: tap an offer to pick it, tap a tile to see what placing it
// there would do (the info panel and +n/-n on every tile that moves), then
// PLACE. Tapping a tile with no offer picked inspects what is there. Every
// number shown comes from src/core/rules.js and every word from src/text.js;
// this scene holds neither.

import {
  BOARD_X,
  BOARD_Y,
  CARD_SCALE,
  CELL,
  COLORS,
  FONT,
  TEXT_RESOLUTION,
  FONT_LG,
  FONT_MD,
  FONT_SM,
  GAME_HEIGHT,
  GAME_WIDTH,
  HEADER_Y,
  INFO_H,
  INFO_Y,
  LIST_SCALE,
  OFFER_H,
  OFFER_W,
  OFFER_XS,
  OFFER_Y,
  PIECE_SCALE,
  PLACE_Y,
  RARITY_COLORS,
  RARITY_TEXT_COLORS,
  SCORE_BAR_H,
  SCORE_BAR_Y,
  SPRITE,
  TEXT,
} from '../config.js';
import { pieceDef, piecesIn } from '../data/catalogue.js';
import { createRun, currentOffer, nextLevel, place, previewPlacement, scoreBoard, targetFor, turnsLeft } from '../core/rules.js';
import { HUD, INFO, LEVEL_END, RARITY_TEXT, SET_LIST, SET_TEXT } from '../text.js';
import { breakdown, pieceName, pieceRule } from '../ui/describe.js';
import { button } from '../ui/button.js';
import { PX, pixelBox, pixelRim, sharpen } from '../ui/pixel.js';
import { bakeSprites, spriteKey } from '../ui/textures.js';

const text = (scene, x, y, s, size = FONT_SM, color = TEXT.text, extra = {}) =>
  scene.add.text(x, y, s, { fontFamily: FONT, resolution: TEXT_RESOLUTION, fontSize: `${size}px`, color, ...extra });

export class PlayScene extends Phaser.Scene {
  constructor() {
    super('PlayScene');
  }

  init(data) {
    this.seed = data && data.seed != null ? data.seed : null;
    this.special = data && data.special ? data.special : null;
  }

  create() {
    sharpen(this);
    bakeSprites(this);
    const opts = {};
    if (this.seed != null) opts.seed = this.seed;
    if (this.special) opts.special = this.special;
    this.run = createRun(opts);
    this.selOffer = null;
    this.selTile = null;
    this.overlay = null;

    const { cols, rows } = this.run.tuning;

    // Header: level and turn on the left, score against target on the right.
    this.levelText = text(this, 20, HEADER_Y, '', FONT_MD, TEXT.text, { fontStyle: 'bold' });
    this.turnText = text(this, 20, HEADER_Y + 26, '', FONT_SM, TEXT.dim);
    this.scoreText = text(this, GAME_WIDTH - 92, HEADER_Y, '', FONT_MD, TEXT.text, { fontStyle: 'bold' }).setOrigin(1, 0);
    this.targetText = text(this, GAME_WIDTH - 92, HEADER_Y + 26, '', FONT_SM, TEXT.dim).setOrigin(1, 0);
    this.setButton = button(this, GAME_WIDTH - 46, HEADER_Y + 22, HUD.sets, () => this.openSetList(), {
      w: 72,
      h: 42,
      size: FONT_SM,
      fill: COLORS.panel,
      light: COLORS.panelEdge,
    });
    this.scoreBar = this.add.graphics();

    // The board: tiles and frames in one graphics layer, a sprite per tile
    // above it, then the numbers.
    this.boardGfx = this.add.graphics();
    this.tiles = [];
    for (let i = 0; i < cols * rows; i++) {
      const { x, y } = this.tileCentre(i);
      const zone = this.add.zone(x, y, CELL, CELL).setInteractive({ useHandCursor: true });
      zone.on('pointerup', () => this.tapTile(i));
      this.tiles.push({
        zone,
        sprite: this.add.image(x, y - 6, spriteKey('basic')).setScale(PIECE_SCALE).setVisible(false),
        score: text(this, x + CELL / 2 - 7, y + CELL / 2 - 5, '', FONT_SM, TEXT.text, {
          fontStyle: 'bold',
          backgroundColor: TEXT.badge,
          padding: { x: 3, y: 0 },
        }).setOrigin(1, 1),
        // The preview's +n/-n, on a dark tab across the tile's top edge so it
        // reads over any piece.
        delta: text(this, x, y - CELL / 2 + 1, '', 14, TEXT.gain, {
          fontStyle: 'bold',
          backgroundColor: TEXT.badge,
          padding: { x: 4, y: 1 },
        })
          .setOrigin(0.5, 0)
          .setDepth(2),
      });
    }
    this.selGfx = this.add.graphics().setDepth(1);

    // The info panel.
    this.infoGfx = this.add.graphics();
    pixelBox(this.infoGfx, 12, INFO_Y, GAME_WIDTH - 24, INFO_H, { fill: COLORS.panel, light: COLORS.panelEdge, dark: COLORS.shadow });
    this.infoTitle = text(this, 26, INFO_Y + 10, '', FONT_MD, TEXT.text, { fontStyle: 'bold' });
    this.infoBody = text(this, 26, INFO_Y + 38, '', FONT_SM, TEXT.dim, { wordWrap: { width: GAME_WIDTH - 52 } });

    // The three offers.
    this.offerGfx = this.add.graphics();
    this.cards = OFFER_XS.map((x, k) => {
      const zone = this.add.zone(x, OFFER_Y, OFFER_W, OFFER_H).setInteractive({ useHandCursor: true });
      zone.on('pointerup', () => this.tapOffer(k));
      const top = OFFER_Y - OFFER_H / 2;
      return {
        zone,
        sprite: this.add.image(x, top + 10 + (SPRITE * CARD_SCALE) / 2, spriteKey('basic')).setScale(CARD_SCALE),
        name: text(this, x, top + 62, '', FONT_MD, TEXT.text, { fontStyle: 'bold' }).setOrigin(0.5, 0),
        rarity: text(this, x, top + 86, '', 14, TEXT.dim).setOrigin(0.5, 0),
        rule: text(this, x, top + 104, '', 13, TEXT.text, { align: 'center', wordWrap: { width: OFFER_W - 16 } }).setOrigin(0.5, 0),
      };
    });

    this.placeButton = button(this, GAME_WIDTH / 2, PLACE_Y, HUD.place, () => this.commit(), { w: 220, h: 54 });

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
    const scored = scoreBoard(run.board, tuning);
    const offer = currentOffer(run);
    const picked = this.selOffer != null ? offer[this.selOffer] : null;
    const preview = picked && this.selTile != null ? previewPlacement(run, picked, this.selTile) : null;

    // Header.
    const level = Math.min(run.level, tuning.levels - 1);
    this.levelText.setText(HUD.level(level + 1, tuning.levels));
    this.turnText.setText(
      run.status === 'playing' ? HUD.turn(run.turn + 1, tuning.turnsPerLevel, turnsLeft(run)) : HUD.turnDone(tuning.turnsPerLevel)
    );
    const target = targetFor(run, level);
    this.scoreText.setText(HUD.score(scored.total));
    this.targetText.setText(HUD.target(target));
    this.scoreText.setColor(scored.total >= target ? TEXT.gain : TEXT.text);

    const barX = 20;
    const barW = GAME_WIDTH - 40;
    const fill = Math.min(1, scored.total / target);
    const bar = this.scoreBar;
    bar.clear();
    pixelBox(bar, barX, SCORE_BAR_Y, barW, SCORE_BAR_H, { fill: COLORS.panel });
    const inner = barW - 2 * PX;
    const met = scored.total >= target;
    bar.fillStyle(met ? COLORS.barMet : COLORS.bar).fillRect(barX + PX, SCORE_BAR_Y + PX, Math.round(inner * fill), SCORE_BAR_H - 2 * PX);
    if (preview) {
      const after = Math.min(1, preview.after / target);
      bar.fillStyle(COLORS.text).fillRect(barX + PX + Math.round(inner * after) - PX, SCORE_BAR_Y - PX, PX, SCORE_BAR_H + 2 * PX);
    }

    // Board.
    const g = this.boardGfx;
    g.clear();
    this.selGfx.clear();
    const changed = new Map(preview ? preview.changes.map((c) => [c.i, c]) : []);
    for (let i = 0; i < run.board.length; i++) {
      const { x, y } = this.tileCentre(i);
      const left = x - CELL / 2;
      const top = y - CELL / 2;
      // What would stand here after the preview, else what stands here.
      const ghost = preview && i === this.selTile;
      const shownId = ghost ? picked : run.board[i];
      pixelBox(g, left + 1, top + 1, CELL - 2, CELL - 2, { fill: COLORS.tile, light: COLORS.tileLight, dark: COLORS.tileDark });
      const t = this.tiles[i];
      if (shownId) {
        const def = pieceDef(shownId);
        pixelRim(g, left + 1 + PX, top + 1 + PX, CELL - 2 - 2 * PX, CELL - 2 - 2 * PX, RARITY_COLORS[def.rarity]);
        t.sprite.setTexture(spriteKey(shownId)).setVisible(true).setAlpha(ghost ? 0.6 : 1);
        const c = changed.get(i);
        t.score.setText(String(c ? c.to : scored.tiles[i].score)).setVisible(true);
      } else {
        t.sprite.setVisible(false);
        t.score.setText('').setVisible(false);
      }
      const c = changed.get(i);
      const d = c ? c.to - c.from : 0;
      const label = c && d !== 0 ? (d > 0 ? `+${d}` : `${d}`) : '';
      t.delta.setText(label).setVisible(label !== '');
      t.delta.setColor(d >= 0 ? TEXT.gain : TEXT.loss);
      if (i === this.selTile) pixelRim(this.selGfx, left, top, CELL, CELL, COLORS.select, 4);
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
        card.sprite.setVisible(false);
        for (const o of [card.name, card.rarity, card.rule]) o.setText('');
        return;
      }
      const def = pieceDef(id);
      const sel = this.selOffer === k;
      pixelBox(og, x - OFFER_W / 2, top, OFFER_W, OFFER_H, { fill: COLORS.panel, light: COLORS.panelEdge, dark: COLORS.shadow });
      pixelRim(og, x - OFFER_W / 2, top, OFFER_W, OFFER_H, sel ? COLORS.select : RARITY_COLORS[def.rarity], sel ? 2 * PX : PX);
      card.sprite.setTexture(spriteKey(id)).setVisible(true);
      card.name.setText(pieceName(id));
      card.rarity.setText(RARITY_TEXT[def.rarity]).setColor(RARITY_TEXT_COLORS[def.rarity]);
      card.rule.setText(pieceRule(id));
    });

    this.placeButton.setEnabled(run.status === 'playing' && this.selOffer != null && this.selTile != null);
  }

  drawInfo(scored, picked, preview) {
    const run = this.run;
    if (preview) {
      const d = preview.delta;
      this.infoTitle.setText(INFO.preview(pieceName(picked), preview.replaces ? pieceName(preview.replaces) : null, d));
      this.infoTitle.setColor(d > 0 ? TEXT.gain : d < 0 ? TEXT.loss : TEXT.text);
      this.infoBody.setText(INFO.previewBody(preview.before, preview.after, breakdown(preview.piece)));
      return;
    }
    this.infoTitle.setColor(TEXT.text);
    if (this.selTile != null) {
      const tile = scored.tiles[this.selTile];
      if (tile) {
        this.infoTitle.setText(INFO.inspect(pieceName(tile.id)));
        this.infoBody.setText(INFO.inspectBody(breakdown(tile), pieceRule(tile.id)));
      } else {
        this.infoTitle.setText(INFO.empty);
        this.infoBody.setText(picked ? '' : INFO.emptyBody);
      }
      return;
    }
    if (picked) {
      this.infoTitle.setText(INFO.picked(pieceName(picked)));
      this.infoBody.setText(INFO.pickedBody);
    } else if (run.status === 'playing') {
      this.infoTitle.setText(INFO.idle);
      this.infoBody.setText(INFO.idleBody);
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
    const blocker = add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.shadow, 0.75));
    blocker.setInteractive(); // swallows taps meant for the board underneath
    const panel = add(this.add.graphics());
    pixelBox(panel, 20, (GAME_HEIGHT - height) / 2, GAME_WIDTH - 40, height, {
      fill: COLORS.panel,
      light: COLORS.panelEdge,
      dark: COLORS.shadow,
    });
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
    const title = { levelEnd: LEVEL_END.cleared(res.level + 1), won: LEVEL_END.won, lost: LEVEL_END.lost }[run.status];
    ov.add(text(this, cx, top, title, FONT_LG, run.status === 'lost' ? TEXT.loss : TEXT.gain, { fontStyle: 'bold' }).setOrigin(0.5, 0));
    ov.add(text(this, cx, top + 50, LEVEL_END.result(res.score, res.target), FONT_MD).setOrigin(0.5, 0));
    let line;
    if (run.status === 'levelEnd') line = LEVEL_END.next(res.level + 2, targetFor(run, res.level + 1), run.tuning.turnsPerLevel);
    else if (run.status === 'won') line = LEVEL_END.wonLine(run.tuning.levels, res.score);
    else line = LEVEL_END.lostLine(res.target - res.score, res.level + 1, run.tuning.levels);
    ov.add(text(this, cx, top + 90, line, FONT_SM, TEXT.dim, { align: 'center', wordWrap: { width: GAME_WIDTH - 90 } }).setOrigin(0.5, 0));
    if (run.status === 'levelEnd') {
      ov.addButton(
        button(this, cx, top + 230, LEVEL_END.nextLevel, () => {
          ov.close();
          nextLevel(run);
          this.refresh();
        })
      );
    } else {
      ov.addButton(button(this, cx, top + 200, LEVEL_END.again, () => this.scene.restart({ seed: this.seed, special: this.special })));
      ov.addButton(
        button(this, cx, top + 264, LEVEL_END.title, () => this.scene.start('TitleScene'), {
          fill: COLORS.buttonOff,
          light: COLORS.tileLight,
        })
      );
    }
  }

  // Every piece this run can offer and its rule, one tab per set in play: the
  // whole pool is knowable, even the pieces that haven't been offered yet.
  openSetList(tab = 0) {
    if (this.overlay) return;
    const ov = this.openOverlay(GAME_HEIGHT - 40);
    this.setTab = tab;
    const top = 36;
    ov.add(text(this, GAME_WIDTH / 2, top, SET_LIST.heading, FONT_LG, TEXT.text, { fontStyle: 'bold' }).setOrigin(0.5, 0));
    const sets = this.run.sets;
    const tabW = Math.min(160, (GAME_WIDTH - 80) / sets.length);
    sets.forEach((id, k) => {
      const x = GAME_WIDTH / 2 + (k - (sets.length - 1) / 2) * (tabW + 8);
      const on = k === tab;
      ov.addButton(
        button(
          this,
          x,
          top + 64,
          SET_TEXT[id].name,
          () => {
            if (k === this.setTab) return;
            ov.close();
            this.openSetList(k);
          },
          on ? { w: tabW, h: 40, size: FONT_SM } : { w: tabW, h: 40, size: FONT_SM, fill: COLORS.tile, light: COLORS.tileLight }
        )
      );
    });
    const setId = sets[tab];
    ov.add(
      text(this, GAME_WIDTH / 2, top + 96, SET_TEXT[setId].about, 14, TEXT.dim, {
        align: 'center',
        wordWrap: { width: GAME_WIDTH - 80 },
      }).setOrigin(0.5, 0)
    );
    piecesIn(setId).forEach((id, k) => {
      const p = pieceDef(id);
      const y = top + 130 + k * 50;
      ov.add(this.add.image(52, y + 18, spriteKey(id)).setScale(LIST_SCALE));
      ov.add(text(this, 80, y, pieceName(id), FONT_SM, TEXT.text, { fontStyle: 'bold' }));
      ov.add(text(this, GAME_WIDTH - 40, y, RARITY_TEXT[p.rarity], 14, RARITY_TEXT_COLORS[p.rarity]).setOrigin(1, 0));
      ov.add(text(this, 80, y + 20, pieceRule(id), 14, TEXT.dim, { wordWrap: { width: GAME_WIDTH - 124 } }));
    });
    ov.addButton(button(this, GAME_WIDTH / 2, GAME_HEIGHT - 58, SET_LIST.close, () => ov.close(), { w: 160, h: 46 }));
  }
}
