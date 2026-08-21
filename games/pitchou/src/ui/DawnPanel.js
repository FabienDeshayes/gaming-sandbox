import {
  COLORS,
  FALL_LABEL,
  FONT,
  FONT_LG,
  FONT_MD,
  FONT_RG,
  FONT_SM,
  GAME_HEIGHT,
  GAME_WIDTH,
  METER_LABELS,
  PANEL_CONTENT_DEPTH,
  PANEL_DEPTH,
  RESOURCE_COLORS,
  RESOURCE_LABELS,
  SPRITE_PX,
  SWIPE_THRESHOLD,
  TEXT_RESOLUTION,
} from '../config.js';
import {
  allocate,
  buildTool,
  buildsLeft,
  canAffordFromMeters,
  METER_OF,
  RESOURCES,
  toolUnlocked,
  toolUnlockNight,
} from '../core/rules.js';
import { createButton } from './button.js';
import { playBuild, playPour, unlockAudio } from './sfx.js';

const PANEL = { x: 20, y: 54, w: 440, h: 744 };
const ROW_H = 44;
const CARD_W = 204;
const CARD_GAP = 7;
const CARD_MAX_H = 104;
const CARDS_TOP = PANEL.y + 128;
const CARDS_BOTTOM = PANEL.y + PANEL.h - 86;

// Short, plain sentences. A keeper talking to themselves at dawn, not a rules
// reference — and never a second name for something the rest of the screen
// already calls a FALL.
const FLAVOUR = {
  fellNothing: 'You came home with nothing.',
  fellSome: 'A bad fall — but you kept some of it.',
  goodHaul: 'A good night on the rocks.',
  okHaul: 'Enough to keep the light burning.',
  poorHaul: 'Slim pickings tonight.',
  noHaul: 'Nothing worth carrying home.',
};

function pickFlavour(busted, totalBanked) {
  if (busted && totalBanked === 0) return FLAVOUR.fellNothing;
  if (busted) return FLAVOUR.fellSome;
  if (totalBanked >= 5) return FLAVOUR.goodHaul;
  if (totalBanked >= 2) return FLAVOUR.okHaul;
  if (totalBanked >= 1) return FLAVOUR.poorHaul;
  return FLAVOUR.noHaul;
}

// What one gain reads as: "2 WOOD", or "1-3 OIL" for the tokens whose value is
// rolled when they are drawn.
export function gainLabel(gain) {
  const amount = gain.max === undefined ? `${gain.amount}` : `${gain.min ?? 1}-${gain.max}`;
  return `${amount} ${RESOURCE_LABELS[gain.resource]}`;
}

// What a tool does to the shore, in one line short enough for a card. The
// three-way crate gets "1 of each" because spelling it out is the only line
// that doesn't fit, and it is the clearer sentence anyway.
export function toolEffectLabel(tool) {
  if (tool.removeFall) return `→ Removes a ${FALL_LABEL}`;
  const gains = tool.add.gains;
  const everyResource =
    gains.length === RESOURCES.length && gains.every((g) => g.amount === 1);
  if (everyResource) return '→ 1 of each';
  return `→ ${gains.map(gainLabel).join(' + ')}`;
}

export function toolCostLabel(tool) {
  const entries = Object.entries(tool.cost);
  const flat = entries.length === RESOURCES.length && new Set(entries.map(([, n]) => n)).size === 1;
  if (flat) return `Costs ${entries[0][1]} of each`;
  return `Costs ${entries.map(([r, n]) => `${n} ${RESOURCE_LABELS[r]}`).join(' + ')}`;
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
        .text(x, y, str, { fontFamily: FONT, fontSize: `${size}px`, color, resolution: TEXT_RESOLUTION })
        .setOrigin(originX, originY)
        .setDepth(PANEL_CONTENT_DEPTH)
    );
  }

  function icon(x, y, key, tint, px) {
    return add(
      scene.add
        .image(x, y, key)
        .setScale(px / SPRITE_PX)
        .setTint(tint)
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

  function backdrop() {
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
  }

  // One "3  WOOD" line with its icon. Returns the y to carry on from.
  function tally(y, resource, amount, colour) {
    const mid = y + ROW_H / 2 - 3;
    icon(PANEL.x + 42, mid, resource, RESOURCE_COLORS[resource], 28);
    text(PANEL.x + 66, mid, `${amount}  ${RESOURCE_LABELS[resource]}`, FONT_RG, colour);
    return mid;
  }

  function paintRecap() {
    backdrop();

    text(GAME_WIDTH / 2, PANEL.y + 34, `DAWN  ·  NIGHT ${state.night}`, FONT_LG, COLORS.text, 0.5);

    const totalBanked = RESOURCES.reduce((n, r) => n + banked[r], 0);
    const flavour = pickFlavour(state.busted, totalBanked);
    text(
      GAME_WIDTH / 2,
      PANEL.y + 72,
      flavour,
      FONT_SM,
      state.busted ? COLORS.fall : COLORS.muted,
      0.5
    );

    let y = PANEL.y + 108;

    const found = RESOURCES.filter((r) => nightGathered[r] > 0);
    if (found.length) {
      text(PANEL.x + 20, y, 'FOUND', FONT_SM, COLORS.dim);
      y += 26;
      for (const resource of found) {
        tally(y, resource, nightGathered[resource], COLORS.text);
        y += ROW_H - 4;
      }
      y += 10;
    }

    const lost = RESOURCES.filter((r) => nightLost[r] > 0);
    if (lost.length) {
      text(PANEL.x + 20, y, `DROPPED IN A ${FALL_LABEL}`, FONT_SM, COLORS.dim);
      y += 26;
      for (const resource of lost) {
        tally(y, resource, nightLost[resource], COLORS.fall);
        y += ROW_H - 4;
      }
      y += 10;
    }

    const held = RESOURCES.filter((r) => banked[r] > 0);
    if (held.length) {
      text(PANEL.x + 20, y, 'CARRIED HOME', FONT_SM, COLORS.dim);
      y += 26;
      for (const resource of held) {
        const meter = METER_OF[resource];
        const from = state.meters[meter];
        const to = Math.min(state.tuning.meterCap, from + banked[resource]);
        const overflow = banked[resource] - (to - from);
        const mid = tally(y, resource, banked[resource], COLORS.text);
        text(
          PANEL.x + PANEL.w - 28,
          mid - (overflow > 0 ? 10 : 0),
          `${METER_LABELS[meter]}  ${from} → ${to}`,
          FONT_SM,
          RESOURCE_COLORS[resource],
          1
        );
        if (overflow > 0)
          text(
            PANEL.x + PANEL.w - 28,
            mid + 12,
            `${overflow} over the brim, lost`,
            FONT_SM,
            COLORS.danger,
            1
          );
        y += ROW_H + 2;
      }
    } else {
      text(PANEL.x + 20, y + 14, 'Nothing survived the walk home.', FONT_RG, COLORS.muted);
      y += 44;
    }

    add(
      createButton(
        scene,
        GAME_WIDTH / 2,
        PANEL.y + PANEL.h - 46,
        'CONTINUE',
        () => {
          allocate(state);
          if (held.length) playPour();
          phase = 'workshop';
          paintWorkshop();
        },
        { width: 260, fontSize: FONT_MD }
      ).setPanelDepth(PANEL_CONTENT_DEPTH)
    );
  }

  function paintWorkshop() {
    backdrop();

    text(GAME_WIDTH / 2, PANEL.y + 34, 'WORKSHOP', FONT_LG, COLORS.text, 0.5);

    text(PANEL.x + 20, PANEL.y + 78, 'YOU HAVE', FONT_SM, COLORS.dim);
    const meterLine = RESOURCES.map((r) => {
      const meter = METER_OF[r];
      return `${state.meters[meter]} ${RESOURCE_LABELS[r]}`;
    }).join('   ');
    text(PANEL.x + PANEL.w - 20, PANEL.y + 78, meterLine, FONT_SM, COLORS.muted, 1);

    // Two rules on one line, because between them they are the whole workshop:
    // what you spend comes straight off a meter, and you only get one build.
    const left = buildsLeft(state);
    text(
      GAME_WIDTH / 2,
      PANEL.y + 108,
      left > 0
        ? 'Building costs you meters. One build a night.'
        : 'Built for tonight. Come back tomorrow.',
      FONT_SM,
      left > 0 ? COLORS.dim : COLORS.lamp,
      0.5
    );

    const tools = state.tuning.tools;
    const rows = Math.ceil(tools.length / 2);
    const cardH = Math.min(
      CARD_MAX_H,
      Math.floor((CARDS_BOTTOM - CARDS_TOP - (rows - 1) * CARD_GAP) / rows)
    );
    const gridH = rows * cardH + (rows - 1) * CARD_GAP;
    const top = CARDS_TOP + Math.max(0, (CARDS_BOTTOM - CARDS_TOP - gridH) / 2);

    tools.forEach((tool, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = PANEL.x + 12 + CARD_W / 2 + col * (CARD_W + CARD_GAP);
      const cy = top + cardH / 2 + row * (cardH + CARD_GAP);
      const built = state.toolsBuilt.includes(tool.id);
      const unlocked = built || toolUnlocked(tool, state.night, state.tuning);
      const buildable =
        !built && unlocked && left > 0 && canAffordFromMeters(state.meters, tool.cost);

      hitRect(
        cx,
        cy,
        CARD_W,
        cardH,
        built ? COLORS.panelHex : unlocked ? COLORS.bgHex : COLORS.disabledHex,
        built
          ? COLORS.dimHex
          : buildable
          ? COLORS.lampHex
          : unlocked
          ? COLORS.panelEdgeHex
          : COLORS.dimHex,
        buildable
          ? () => {
              buildTool(state, tool.id);
              playBuild();
              paintWorkshop();
            }
          : null
      );
      const tint = built
        ? COLORS.dimHex
        : buildable
        ? COLORS.lampHex
        : unlocked
        ? COLORS.mutedHex
        : COLORS.dimHex;
      icon(cx - CARD_W / 2 + 24, cy - 26, tool.id, tint, 30);
      const faded = built || !unlocked;
      const bodyColour = built
        ? COLORS.dim
        : buildable
        ? COLORS.text
        : unlocked
        ? COLORS.muted
        : COLORS.dim;
      text(cx - CARD_W / 2 + 44, cy - 26, tool.name, FONT_RG, bodyColour);
      const costLine = built
        ? 'BUILT'
        : unlocked
        ? toolCostLabel(tool)
        : `Opens night ${toolUnlockNight(tool, state.tuning)}`;
      text(cx - CARD_W / 2 + 10, cy - 1, costLine, FONT_SM, faded ? COLORS.dim : COLORS.muted);
      text(
        cx - CARD_W / 2 + 10,
        cy + 22,
        toolEffectLabel(tool),
        FONT_SM,
        faded ? COLORS.dim : COLORS.fall
      );
    });

    add(
      createButton(
        scene,
        GAME_WIDTH / 2,
        PANEL.y + PANEL.h - 46,
        'SLEEP',
        () => {
          const finish = onDone;
          view.close();
          if (finish) finish();
        },
        { width: 260, fontSize: FONT_MD }
      ).setPanelDepth(PANEL_CONTENT_DEPTH)
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
