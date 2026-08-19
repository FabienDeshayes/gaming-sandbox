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
  beginNight,
  budgetLeft,
  countTokens,
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

// The all-or-nothing bust DESIGN.md §9 holds in reserve. One field, because the
// rules module already takes it as one.
function tuningFor(hard) {
  return hard ? { ...DEFAULT_TUNING, bustKeeps: 0 } : DEFAULT_TUNING;
}

// How many draws left in the bag would end the night outright. The same set
// `bustOdds` divides by the bag size — shown as a count instead of a fraction,
// because nothing in this game is allowed to need a percentage (DESIGN.md §5).
function killersLeft(state) {
  const left = budgetLeft(state);
  return state.bag.filter((token) => token.kind === 'wave' && token.size >= left).length;
}

// The whole run lives in one scene: dusk, the search, and the dawn panel over
// the top of it. Dawn is an in-canvas overlay rather than a second scene, the
// way every modal in this repo is built.
export class NightScene extends Phaser.Scene {
  constructor() {
    super('NightScene');
  }

  create(data) {
    ensureTextures(this);

    // scene.restart preserves fields, so every one of these is reset here
    // rather than only at construction.
    this.seed = data && data.seed !== undefined ? data.seed : 1;
    this.run = createRun({ seed: this.seed, tuning: tuningFor(getHardMode()) });
    // Season tallies for the recap. They live here rather than in the run,
    // because src/core/rules.js is the tuned part and a display counter has no
    // business in it.
    this.gathered = { oil: 0, wood: 0, plank: 0 };
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
      .text(cx, HEADER_Y, '', { fontFamily: FONT, fontSize: '22px', color: COLORS.text })
      .setOrigin(0.5);
    this.drainText = this.add
      .text(GAME_WIDTH - 20, HEADER_Y, '', {
        fontFamily: FONT,
        fontSize: '12px',
        color: COLORS.muted,
      })
      .setOrigin(1, 0.5);
    this.track = this.add.graphics();

    this.meters = {};
    for (const meter of METERS) this.meters[meter] = createMeterBar(this, METER_XS[meter], meter);

    this.strikes = this.add.graphics();
    this.strikeLabel = this.add
      .text(GAME_WIDTH - 20, RISK_Y, '', { fontFamily: FONT, fontSize: '12px', color: COLORS.muted })
      .setOrigin(1, 0.5);

    this.shore = createShoreView(this);
    this.basket = createBasketView(this);

    this.searchButton = createButton(this, cx, SEARCH_Y, 'SEARCH', () => this.onSearch(), {
      width: 400,
      fontSize: 30,
      padY: 20,
    });
    this.homeButton = createButton(this, cx, HOME_Y, 'GO HOME', () => this.onGoHome(), {
      width: 400,
      fontSize: 20,
      padY: 10,
    });

    createButton(this, 40, HEADER_Y, 'X', () => this.askQuit(), { fontSize: 14, padX: 10, padY: 6 });
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
      // The storm adds a wave after these nights — the squeeze is on a fixed
      // schedule, so it is drawn on the calendar rather than sprung.
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
    const killers = killersLeft(this.run);
    this.strikeLabel.setText(
      killers === 0
        ? 'nothing out there can end it'
        : `${killers} of ${this.run.bag.length} ends the night`
    );
    this.strikeLabel.setColor(killers === 0 ? COLORS.muted : COLORS.foam);
  }

  setControls(on) {
    this.searchButton.setEnabled(on && this.run.bag.length > 0);
    this.homeButton.setEnabled(on);
  }

  // --- the loop -------------------------------------------------------------
  //
  // Mirrors playSeason in sim/simulate.mjs. The two easy mistakes it avoids:
  // death happens inside beginNight and leaves the phase at 'dusk', and
  // search() can move to 'dawn' on its own — so both are re-checked rather
  // than assumed.

  enterDusk() {
    // Held from here until the shore is dealt: the dusk drain animates, and a
    // tap that landed during it would be a tap on a night that hasn't started.
    this.busy = true;
    this.setControls(false);
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
    this.shore.setTally(countTokens(this.run.bag));
    this.basket.set(this.run.basket);
    this.paintRisk();
    this.busy = false;
    this.setControls(true);
  }

  onSearch() {
    if (this.busy || this.confirmOpen) return;
    if (this.run.status !== 'playing' || this.run.phase !== 'search') return;
    if (this.run.bag.length === 0) return;

    this.busy = true;
    this.setControls(false);

    const motion = getMotion();
    const before = { ...this.run.basket };
    const token = search(this.run);
    playDraw();

    this.shore.reveal(token, motion).then(() => {
      this.shore.setTally(countTokens(this.run.bag));
      this.paintRisk();

      let settled;
      if (token.kind === 'resource') {
        this.gathered[token.resource] += token.amount;
        playGain(token.resource, token.amount);
        this.basket.set(this.run.basket);
        settled = Promise.resolve();
      } else if (this.run.busted) {
        this.busts += 1;
        playBust();
        settled = this.bustFlash(motion).then(() => this.basket.set(this.run.basket));
      } else {
        playWave();
        if (motion) this.cameras.main.shake(SHAKE_MS, 0.006);
        settled = this.basket.knock(before, this.run.basket, motion);
      }

      settled.then(() => {
        // A bust, or a bag drawn dry, has already moved the phase on. Offering
        // GO HOME after that would throw.
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
    this.dawn.open(this.run, () => this.afterDawn());
  }

  afterDawn() {
    endNight(this.run);
    if (this.run.status !== 'playing') {
      this.finish();
      return;
    }
    // The storm's extra waves are already on the shore by now; the wind follows
    // them, so the season audibly closes in.
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
          fontSize: '24px',
          color: COLORS.text,
        })
        .setOrigin(0.5)
        .setDepth(PANEL_CONTENT_DEPTH)
    );
    panel.push(
      this.add
        .text(GAME_WIDTH / 2, 394, 'The season is not saved.', {
          fontFamily: FONT,
          fontSize: '13px',
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
