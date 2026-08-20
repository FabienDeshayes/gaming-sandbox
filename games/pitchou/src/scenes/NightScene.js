import {
  COLORS,
  EFFECT_DEPTH,
  FONT,
  GAME_HEIGHT,
  GAME_WIDTH,
  HEADER_Y,
  HOME_Y,
  METER_XS,
  PANEL_CONTENT_DEPTH,
  PANEL_DEPTH,
  RESOURCE_LABELS,
  RISK_PIP_GAP,
  RISK_PIP_X,
  RISK_Y,
  SEARCH_Y,
  SHAKE_MS,
  TRACK_GAP,
  TRACK_PIP_R,
  TRACK_Y,
  VIGNETTE_MS,
  getHardMode,
  getMotion,
} from '../config.js';
import {
  DEFAULT_TUNING,
  METERS,
  RESOURCES,
  beginNight,
  budgetLeft,
  createRun,
  drainForNight,
  endNight,
  goHome,
  search,
} from '../core/rules.js';
import { createBasketView } from '../ui/BasketView.js';
import { createButton } from '../ui/button.js';
import { createDawnPanel } from '../ui/DawnPanel.js';
import { createMeterBar } from '../ui/MeterBar.js';
import { createShoreView } from '../ui/ShoreView.js';
import {
  playBust,
  playDraw,
  playGain,
  playLose,
  playWave,
  playWin,
  setWindLevel,
  startWind,
  stopWind,
} from '../ui/sfx.js';
import { ensureTextures } from '../ui/textures.js';

function tuningFor(hard) {
  return hard ? { ...DEFAULT_TUNING, bustKeeps: 0 } : DEFAULT_TUNING;
}

export class NightScene extends Phaser.Scene {
  constructor() {
    super('NightScene');
  }

  create(data) {
    ensureTextures(this);

    this.seed = data && data.seed !== undefined ? data.seed : 1;
    this.run = createRun({ seed: this.seed, tuning: tuningFor(getHardMode()) });
    this.gathered = { oil: 0, wood: 0, plank: 0 };
    this.nightGathered = { oil: 0, wood: 0, plank: 0 };
    this.nightLost = { oil: 0, wood: 0, plank: 0 };
    this.busts = 0;
    this.busy = false;
    this.confirmOpen = false;

    this.buildChrome();
    this.dawn = createDawnPanel(this);

    startWind();
    setWindLevel(0);

    this.paintHeader();
    this.paintMeters(false);
    this.enterDusk();
  }

  // --- chrome ---------------------------------------------------------------

  buildChrome() {
    const cx = GAME_WIDTH / 2;

    this.nightText = this.add
      .text(cx, HEADER_Y, '', { fontFamily: FONT, fontSize: '23px', color: COLORS.text })
      .setOrigin(0.5);
    this.drainText = this.add
      .text(GAME_WIDTH - 20, HEADER_Y, '', {
        fontFamily: FONT,
        fontSize: '13px',
        color: COLORS.muted,
      })
      .setOrigin(1, 0.5);
    this.track = this.add.graphics();

    this.meters = {};
    for (const meter of METERS) this.meters[meter] = createMeterBar(this, METER_XS[meter], meter);

    this.strikes = this.add.graphics();
    this.enduranceText = this.add
      .text(GAME_WIDTH - 20, RISK_Y, '', { fontFamily: FONT, fontSize: '13px', color: COLORS.muted })
      .setOrigin(1, 0.5);

    this.shore = createShoreView(this);
    this.shore.setOnTileTap((index) => this.onTileTap(index));

    this.basket = createBasketView(this);

    this.feedbackText = this.add
      .text(cx, SEARCH_Y, '', {
        fontFamily: FONT,
        fontSize: '21px',
        color: COLORS.muted,
        align: 'center',
      })
      .setOrigin(0.5);

    this.homeButton = createButton(this, cx, HOME_Y, 'GO HOME', () => this.onGoHome(), {
      width: 400,
      fontSize: 21,
      padY: 10,
    });

    createButton(this, 40, HEADER_Y, 'X', () => this.askQuit(), { fontSize: 15, padX: 10, padY: 6 });
  }

  paintHeader() {
    const tuning = this.run.tuning;
    this.nightText.setText(`NIGHT ${this.run.night} / ${tuning.seasonNights}`);
    this.drainText.setText(`DRAIN ${drainForNight(this.run.night, tuning)} EACH`);

    const total = tuning.seasonNights;
    const left = GAME_WIDTH / 2 - ((total - 1) * TRACK_GAP) / 2;
    this.track.clear();
    for (let i = 1; i <= total; i++) {
      const x = left + (i - 1) * TRACK_GAP;
      const done = i < this.run.night;
      const now = i === this.run.night;
      this.track.fillStyle(now ? COLORS.lampHex : done ? COLORS.mutedHex : COLORS.dimHex, 1);
      this.track.fillCircle(x, TRACK_Y, now ? TRACK_PIP_R + 1 : TRACK_PIP_R - 1);
      if (tuning.stormWaveNights.includes(i)) {
        this.track.lineStyle(1, COLORS.foamHex, 0.8);
        this.track.strokeCircle(x, TRACK_Y, TRACK_PIP_R + 3);
      }
    }
  }

  paintMeters(animate) {
    const tuning = this.run.tuning;
    const next =
      this.run.night >= tuning.seasonNights ? 0 : drainForNight(this.run.night + 1, tuning);
    return Promise.all(
      METERS.map((meter) =>
        this.meters[meter].set(this.run.meters[meter], tuning.meterCap, next, animate)
      )
    );
  }

  paintRisk() {
    const tuning = this.run.tuning;
    const budget = tuning.waveBudget;
    this.strikes.clear();
    for (let i = 0; i < budget; i++) {
      const x = RISK_PIP_X + i * RISK_PIP_GAP;
      const spent = i < this.run.strikes;
      this.strikes.fillStyle(spent ? COLORS.foamHex : COLORS.panelHex, 1);
      this.strikes.fillCircle(x, RISK_Y, 11);
      this.strikes.lineStyle(2, spent ? COLORS.foamHex : COLORS.panelEdgeHex, 1);
      this.strikes.strokeCircle(x, RISK_Y, 11);
    }
    const remaining = budgetLeft(this.run);
    if (remaining <= 0) {
      this.enduranceText.setText('The waves swept you home');
      this.enduranceText.setColor(COLORS.foam);
    } else if (remaining === 1) {
      this.enduranceText.setText('One more squall and the waves take you home');
      this.enduranceText.setColor(COLORS.foam);
    } else {
      this.enduranceText.setText(`You can endure ${remaining} more squalls`);
      this.enduranceText.setColor(COLORS.muted);
    }
  }

  setControls(on) {
    this.shore.setInteractive(on && this.run.bag.length > 0);
    this.homeButton.setEnabled(on);
  }

  // --- the loop -------------------------------------------------------------

  enterDusk() {
    this.busy = true;
    this.setControls(false);
    this.nightGathered = { oil: 0, wood: 0, plank: 0 };
    this.nightLost = { oil: 0, wood: 0, plank: 0 };
    beginNight(this.run);
    this.paintHeader();
    this.paintMeters(getMotion()).then(() => {
      if (this.run.status !== 'playing') {
        this.finish();
        return;
      }
      this.startSearch();
    });
  }

  startSearch() {
    this.shore.deal(this.run.bag);
    this.basket.set(this.run.basket);
    this.paintRisk();
    this.feedbackText.setText('Choose a tile to explore').setColor(COLORS.muted);
    this.busy = false;
    this.setControls(true);
  }

  onTileTap(tileIndex) {
    if (this.busy || this.confirmOpen) return;
    if (this.run.status !== 'playing' || this.run.phase !== 'search') return;
    if (this.run.bag.length === 0) return;

    this.busy = true;
    this.setControls(false);

    const motion = getMotion();
    const before = { ...this.run.basket };
    const token = search(this.run);
    playDraw();

    this.shore.reveal(tileIndex, token, motion).then(() => {
      this.paintRisk();

      let settled;
      if (token.kind === 'resource') {
        this.gathered[token.resource] += token.amount;
        this.nightGathered[token.resource] += token.amount;
        playGain(token.resource, token.amount);
        this.basket.set(this.run.basket);
        const label = RESOURCE_LABELS[token.resource];
        this.feedbackText
          .setText(`You found ${token.amount > 1 ? token.amount + ' ' : ''}${label}`)
          .setColor(COLORS.text);
        settled = Promise.resolve();
      } else if (this.run.busted) {
        this.busts += 1;
        for (const r of RESOURCES) {
          const lost = before[r] - this.run.basket[r];
          if (lost > 0) this.nightLost[r] += lost;
        }
        playBust();
        this.feedbackText
          .setText('A rogue wave! Swept home with half your haul')
          .setColor(COLORS.foam);
        settled = this.bustFlash(motion).then(() => this.basket.set(this.run.basket));
      } else {
        playWave();
        if (motion) this.cameras.main.shake(SHAKE_MS, 0.006);
        const lostRes = RESOURCES.find((r) => this.run.basket[r] < before[r]);
        if (lostRes) {
          const amount = before[lostRes] - this.run.basket[lostRes];
          this.nightLost[lostRes] += amount;
          this.feedbackText
            .setText(`A squall! Lost ${amount} ${RESOURCE_LABELS[lostRes]}`)
            .setColor(COLORS.foam);
        } else {
          this.feedbackText.setText('A squall, but nothing to lose').setColor(COLORS.foam);
        }
        settled = this.basket.knock(before, this.run.basket, motion);
      }

      settled.then(() => {
        if (this.run.phase === 'dawn') {
          this.openDawn();
          return;
        }
        this.busy = false;
        this.setControls(true);
      });
    });
  }

  onGoHome() {
    if (this.busy || this.confirmOpen) return;
    if (this.run.status !== 'playing' || this.run.phase !== 'search') return;
    this.busy = true;
    this.setControls(false);
    goHome(this.run);
    this.openDawn();
  }

  openDawn() {
    this.busy = true;
    this.setControls(false);
    this.dawn.open(this.run, {
      nightGathered: { ...this.nightGathered },
      nightLost: { ...this.nightLost },
      onDone: () => this.afterDawn(),
    });
  }

  afterDawn() {
    endNight(this.run);
    if (this.run.status !== 'playing') {
      this.finish();
      return;
    }
    const added = this.run.tuning.stormWaveNights.filter((n) => n < this.run.night).length;
    setWindLevel(added);
    this.enterDusk();
  }

  finish() {
    stopWind();
    if (this.run.status === 'won') playWin();
    else playLose();
    this.dawn.close();
    this.scene.start('RecapScene', {
      status: this.run.status,
      seed: this.seed,
      night: this.run.night,
      seasonNights: this.run.tuning.seasonNights,
      lost: this.run.lost,
      meters: { ...this.run.meters },
      gathered: { ...this.gathered },
      busts: this.busts,
      toolsBuilt: this.run.tuning.tools.filter((t) => this.run.toolsBuilt.includes(t.id)).map((t) => t.name),
      hard: getHardMode(),
    });
  }

  // --- leaving mid-run ------------------------------------------------------

  bustFlash(motion) {
    if (!motion) return Promise.resolve();
    this.cameras.main.shake(SHAKE_MS * 2, 0.01);
    const flash = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.bustHex, 0)
      .setOrigin(0, 0)
      .setDepth(EFFECT_DEPTH);
    return new Promise((resolve) => {
      this.tweens.add({
        targets: flash,
        fillAlpha: 0.45,
        duration: VIGNETTE_MS / 2,
        yoyo: true,
        onComplete: () => {
          flash.destroy();
          resolve();
        },
      });
    });
  }

  askQuit() {
    if (this.confirmOpen || this.dawn.isOpen()) return;
    this.confirmOpen = true;
    this.setControls(false);

    const panel = [];
    panel.push(
      this.add
        .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.76)
        .setOrigin(0, 0)
        .setDepth(PANEL_DEPTH - 1)
        .setInteractive()
    );
    panel.push(
      this.add
        .text(GAME_WIDTH / 2, 360, 'Leave the light?', {
          fontFamily: FONT,
          fontSize: '25px',
          color: COLORS.text,
        })
        .setOrigin(0.5)
        .setDepth(PANEL_CONTENT_DEPTH)
    );
    panel.push(
      this.add
        .text(GAME_WIDTH / 2, 394, 'The season is not saved.', {
          fontFamily: FONT,
          fontSize: '14px',
          color: COLORS.muted,
        })
        .setOrigin(0.5)
        .setDepth(PANEL_CONTENT_DEPTH)
    );
    panel.push(
      createButton(
        this,
        GAME_WIDTH / 2,
        460,
        'LEAVE',
        () => {
          stopWind();
          this.scene.start('TitleScene');
        },
        { width: 220 }
      ).setPanelDepth(PANEL_CONTENT_DEPTH)
    );
    panel.push(
      createButton(
        this,
        GAME_WIDTH / 2,
        534,
        'STAY',
        () => {
          this.confirmOpen = false;
          panel.forEach((o) => (o.destroyAll ? o.destroyAll() : o.destroy()));
          this.setControls(!this.busy);
        },
        { width: 220 }
      ).setPanelDepth(PANEL_CONTENT_DEPTH)
    );
  }
}
