import {
  COLORS,
  FONT,
  GAME_HEIGHT,
  GAME_WIDTH,
  METER_LABELS,
  PANEL_CONTENT_DEPTH,
  PANEL_DEPTH,
  RESOURCE_COLORS,
  RESOURCE_LABELS,
  SPRITE_PX,
  SWIPE_THRESHOLD,
} from '../config.js';
import {
  allocate,
  buildTool,
  canAffordFromMeters,
  METER_OF,
  RESOURCES,
  toolUnlocked,
  toolUnlockNight,
} from '../core/rules.js';
import { createButton } from './button.js';
import { playBuild, playPour, unlockAudio } from './sfx.js';

const PANEL = { x: 20, y: 54, w: 440, h: 744 };
const ROW_H = 46;
const CARD = { w: 205, h: 76, gap: 8 };

const FLAVOUR = {
  bustNothing: 'The sea took everything back.',
  bustSome: 'The waves had the last word — but you held on to something.',
  safeGood: 'A fine haul from the rocks tonight.',
  safeOk: 'Enough to keep the light burning.',
  safePoor: 'Slim pickings from the shore tonight.',
  safeNothing: 'Nothing worth carrying home.',
};

function pickFlavour(busted, totalBanked) {
  if (busted && totalBanked === 0) return FLAVOUR.bustNothing;
  if (busted) return FLAVOUR.bustSome;
  if (totalBanked >= 5) return FLAVOUR.safeGood;
  if (totalBanked >= 2) return FLAVOUR.safeOk;
  if (totalBanked >= 1) return FLAVOUR.safePoor;
  return FLAVOUR.safeNothing;
}

export function createDawnPanel(scene) {
  let objects = [];
  let open = false;
  let state = null;
  let banked = null;
  let nightGathered = null;
  let nightLost = null;
  let phase = 'recap';
  let onDone = null;

  function add(object) {
    objects.push(object);
    return object;
  }

  function text(x, y, str, size, color, originX = 0, originY = 0.5) {
    return add(
      scene.add
        .text(x, y, str, { fontFamily: FONT, fontSize: `${size}px`, color })
        .setOrigin(originX, originY)
        .setDepth(PANEL_CONTENT_DEPTH)
    );
  }

  function hitRect(x, y, w, h, fill, edge, onTap) {
    const rect = add(
      scene.add
        .rectangle(x, y, w, h, fill)
        .setStrokeStyle(2, edge)
        .setDepth(PANEL_CONTENT_DEPTH - 1)
    );
    if (onTap) {
      rect.setInteractive({ useHandCursor: true });
      rect.on('pointerup', (pointer) => {
        if (pointer.getDistance() >= SWIPE_THRESHOLD) return;
        unlockAudio();
        onTap();
      });
    }
    return rect;
  }

  function paintRecap() {
    objects.forEach((o) => (o.destroyAll ? o.destroyAll() : o.destroy()));
    objects = [];

    add(
      scene.add
        .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.88)
        .setOrigin(0, 0)
        .setDepth(PANEL_DEPTH - 1)
        .setInteractive()
    );
    add(
      scene.add
        .rectangle(PANEL.x, PANEL.y, PANEL.w, PANEL.h, COLORS.panelHex)
        .setOrigin(0, 0)
        .setStrokeStyle(2, COLORS.panelEdgeHex)
        .setDepth(PANEL_DEPTH)
    );

    text(GAME_WIDTH / 2, PANEL.y + 30, `DAWN  ·  NIGHT ${state.night}`, 23, COLORS.text, 0.5);

    const totalBanked = RESOURCES.reduce((n, r) => n + banked[r], 0);
    const flavour = pickFlavour(state.busted, totalBanked);
    text(GAME_WIDTH / 2, PANEL.y + 62, flavour, 14, state.busted ? COLORS.foam : COLORS.muted, 0.5);

    let y = PANEL.y + 102;

    const found = RESOURCES.filter((r) => nightGathered[r] > 0);
    if (found.length) {
      text(PANEL.x + 20, y, 'FOUND', 12, COLORS.dim);
      y += 24;
      for (const resource of found) {
        add(
          scene.add
            .image(PANEL.x + 40, y + ROW_H / 2 - 3, resource)
            .setScale(24 / SPRITE_PX)
            .setTint(RESOURCE_COLORS[resource])
            .setDepth(PANEL_CONTENT_DEPTH)
        );
        text(
          PANEL.x + 60,
          y + ROW_H / 2 - 3,
          `${nightGathered[resource]}  ${RESOURCE_LABELS[resource]}`,
          16,
          COLORS.text
        );
        y += ROW_H - 6;
      }
      y += 10;
    }

    const lost = RESOURCES.filter((r) => nightLost[r] > 0);
    if (lost.length) {
      text(PANEL.x + 20, y, 'LOST TO THE SQUALLS', 12, COLORS.dim);
      y += 24;
      for (const resource of lost) {
        add(
          scene.add
            .image(PANEL.x + 40, y + ROW_H / 2 - 3, resource)
            .setScale(24 / SPRITE_PX)
            .setTint(RESOURCE_COLORS[resource])
            .setDepth(PANEL_CONTENT_DEPTH)
        );
        text(
          PANEL.x + 60,
          y + ROW_H / 2 - 3,
          `${nightLost[resource]}  ${RESOURCE_LABELS[resource]}`,
          16,
          COLORS.foam
        );
        y += ROW_H - 6;
      }
      y += 10;
    }

    const held = RESOURCES.filter((r) => banked[r] > 0);
    if (held.length) {
      text(PANEL.x + 20, y, 'CARRIED HOME', 12, COLORS.dim);
      y += 24;
      for (const resource of held) {
        const meter = METER_OF[resource];
        const from = state.meters[meter];
        const to = Math.min(state.tuning.meterCap, from + banked[resource]);
        const overflow = banked[resource] - (to - from);
        add(
          scene.add
            .image(PANEL.x + 40, y + ROW_H / 2 - 3, resource)
            .setScale(24 / SPRITE_PX)
            .setTint(RESOURCE_COLORS[resource])
            .setDepth(PANEL_CONTENT_DEPTH)
        );
        text(
          PANEL.x + 60,
          y + ROW_H / 2 - 3,
          `${banked[resource]}  ${RESOURCE_LABELS[resource]}`,
          16,
          COLORS.text
        );
        const detail = `${METER_LABELS[meter]}  ${from} → ${to}`;
        text(
          PANEL.x + PANEL.w - 34,
          y + ROW_H / 2 - 3 - (overflow > 0 ? 8 : 0),
          detail,
          14,
          RESOURCE_COLORS[resource],
          1
        );
        if (overflow > 0)
          text(PANEL.x + PANEL.w - 34, y + ROW_H / 2 - 3 + 10, `${overflow} over the brim, lost`, 12, COLORS.danger, 1);
        y += ROW_H;
      }
    } else {
      text(PANEL.x + 20, y + 14, 'Nothing survived the walk home.', 15, COLORS.muted);
      y += 44;
    }

    const buttonY = PANEL.y + PANEL.h - 44;
    add(
      createButton(scene, GAME_WIDTH / 2, buttonY, 'CONTINUE', () => {
        allocate(state);
        if (held.length) playPour();
        phase = 'workshop';
        paintWorkshop();
      }, { width: 260 }).setPanelDepth(PANEL_CONTENT_DEPTH)
    );
  }

  function paintWorkshop() {
    objects.forEach((o) => (o.destroyAll ? o.destroyAll() : o.destroy()));
    objects = [];

    add(
      scene.add
        .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.88)
        .setOrigin(0, 0)
        .setDepth(PANEL_DEPTH - 1)
        .setInteractive()
    );
    add(
      scene.add
        .rectangle(PANEL.x, PANEL.y, PANEL.w, PANEL.h, COLORS.panelHex)
        .setOrigin(0, 0)
        .setStrokeStyle(2, COLORS.panelEdgeHex)
        .setDepth(PANEL_DEPTH)
    );

    text(GAME_WIDTH / 2, PANEL.y + 30, 'WORKSHOP', 23, COLORS.text, 0.5);

    let y = PANEL.y + 70;
    text(PANEL.x + 20, y, 'YOUR STORES', 12, COLORS.dim);
    const meterLine = RESOURCES.map((r) => {
      const meter = METER_OF[r];
      return `${METER_LABELS[meter]} ${state.meters[meter]}`;
    }).join('   ');
    text(PANEL.x + PANEL.w - 20, y, meterLine, 13, COLORS.muted, 1);
    y += 30;

    text(
      GAME_WIDTH / 2,
      y,
      'Tools are built from your stores — spending\nresources lowers your meters.',
      13,
      COLORS.dim,
      0.5
    );
    y += 40;

    state.tuning.tools.forEach((tool, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = PANEL.x + 12 + CARD.w / 2 + col * (CARD.w + CARD.gap);
      const cy = y + CARD.h / 2 + row * (CARD.h + CARD.gap);
      const built = state.toolsBuilt.includes(tool.id);
      const unlocked = built || toolUnlocked(tool, state.night, state.tuning);
      const affordable = !built && unlocked && canAffordFromMeters(state.meters, tool.cost);

      hitRect(
        cx,
        cy,
        CARD.w,
        CARD.h,
        built ? COLORS.panelHex : unlocked ? COLORS.bgHex : COLORS.disabledHex,
        built
          ? COLORS.dimHex
          : affordable
          ? COLORS.lampHex
          : unlocked
          ? COLORS.panelEdgeHex
          : COLORS.dimHex,
        affordable
          ? () => {
              buildTool(state, tool.id);
              playBuild();
              paintWorkshop();
            }
          : null
      );
      const tint = built ? COLORS.dimHex : affordable ? COLORS.lampHex : unlocked ? COLORS.mutedHex : COLORS.dimHex;
      add(
        scene.add
          .image(cx - CARD.w / 2 + 26, cy - 6, tool.id)
          .setScale(32 / SPRITE_PX)
          .setTint(tint)
          .setDepth(PANEL_CONTENT_DEPTH)
      );
      const bodyColour = built ? COLORS.dim : affordable ? COLORS.text : unlocked ? COLORS.muted : COLORS.dim;
      text(cx - CARD.w / 2 + 48, cy - 22, tool.name, 15, bodyColour);
      const cost = Object.entries(tool.cost)
        .map(([r, n]) => `${n} ${RESOURCE_LABELS[r]}`)
        .join(' + ');
      const costLine = built ? 'BUILT' : unlocked ? cost : `Unlocks night ${toolUnlockNight(tool, state.tuning)}`;
      text(cx - CARD.w / 2 + 48, cy - 3, costLine, 12, built || !unlocked ? COLORS.dim : COLORS.muted);
      const effect = tool.removeWave
        ? 'Takes a wave off the shore'
        : `Adds ${RESOURCE_LABELS[tool.add.resource]} x${tool.add.amount}`;
      text(cx - CARD.w / 2 + 12, cy + 24, effect, 12, built || !unlocked ? COLORS.dim : COLORS.foam);
    });

    const buttonY = PANEL.y + PANEL.h - 44;
    add(
      createButton(scene, GAME_WIDTH / 2, buttonY, 'SLEEP', () => {
        const finish = onDone;
        view.close();
        if (finish) finish();
      }, { width: 260 }).setPanelDepth(PANEL_CONTENT_DEPTH)
    );
  }

  const view = {
    open(runState, opts) {
      state = runState;
      onDone = opts.onDone;
      banked = { ...runState.basket };
      nightGathered = opts.nightGathered || { oil: 0, wood: 0, plank: 0 };
      nightLost = opts.nightLost || { oil: 0, wood: 0, plank: 0 };
      phase = 'recap';
      open = true;
      paintRecap();
    },

    close() {
      objects.forEach((o) => (o.destroyAll ? o.destroyAll() : o.destroy()));
      objects = [];
      open = false;
      state = null;
      onDone = null;
    },

    isOpen: () => open,
    currentPhase: () => phase,
  };

  return view;
}
