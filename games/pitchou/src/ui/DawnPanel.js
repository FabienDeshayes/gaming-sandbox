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
import { allocate, buildTool, canAfford, METER_OF, RESOURCES } from '../core/rules.js';
import { createButton } from './button.js';
import { playBuild, playPour, unlockAudio } from './sfx.js';

const PANEL = { x: 20, y: 54, w: 440, h: 744 };
const ROW_H = 46;
const CARD = { w: 205, h: 76, gap: 8 };

// Dawn: the basket is emptied, and every stack goes to its meter or to the
// workshop, never both (DESIGN.md §4). Survive tonight, or survive later.
//
// Built in-canvas over the running scene rather than as a second scene, the way
// every modal in this repo is: a full-screen interactive rectangle swallows
// taps, everything is collected into one array so closing destroys it in one
// go, and it sits in its own depth band above the board.
//
// Two taps, in order: STOW commits the routing (`allocate`), which is what puts
// resources in the stockpile a tool is paid from; SLEEP ends the night. Tools
// can be built at any point while the panel is open, since `buildTool` only
// ever spends what is already in the stockpile.
export function createDawnPanel(scene) {
  let objects = [];
  let open = false;
  let state = null;
  let routes = {};
  let stowed = false;
  // What came home, and what stowing it did. Both are kept because `allocate`
  // empties the basket and moves the meters: after the stow, the panel has no
  // way to re-derive what the player just did from the run state.
  let banked = null;
  let outcome = null;
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

  // A tappable row or card. Same tap-not-drag rule as createButton.
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

  // Where a stack is headed and what that costs: the meter it fills, the level
  // before and after, and how much the cap refuses. Anything a meter can't hold
  // is destroyed (`allocate` clamps at the cap), and that loss is the pressure
  // to spend a surplus on tools instead — so it is named on screen rather than
  // quietly happening.
  function plannedResult(resource) {
    if (routes[resource] === 'stock') return { dest: 'stock' };
    const meter = METER_OF[resource];
    const from = state.meters[meter];
    const to = Math.min(state.tuning.meterCap, from + banked[resource]);
    return { dest: 'meter', meter, from, to, lost: banked[resource] - (to - from) };
  }

  function repaint() {
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

    text(GAME_WIDTH / 2, PANEL.y + 30, `DAWN  ·  NIGHT ${state.night}`, 22, COLORS.text, 0.5);
    text(
      GAME_WIDTH / 2,
      PANEL.y + 56,
      state.busted
        ? 'The third wave took you off your feet.'
        : 'You made it back up the steps.',
      13,
      state.busted ? COLORS.foam : COLORS.muted,
      0.5
    );

    const held = RESOURCES.filter((r) => banked[r] > 0);
    let y = PANEL.y + 92;
    text(PANEL.x + 20, y, 'THE BASKET', 11, COLORS.dim);
    y += 24;

    if (!held.length) {
      text(PANEL.x + 20, y + 14, 'Nothing survived the walk home.', 14, COLORS.muted);
      y += 44;
    } else {
      for (const resource of held) {
        // Before the stow the row shows where the stack *would* go and toggles;
        // after it, the same row shows where it went and no longer responds.
        const result = stowed ? outcome[resource] : plannedResult(resource);
        const toStock = result.dest === 'stock';
        const rowY = y + ROW_H / 2;
        hitRect(
          GAME_WIDTH / 2,
          rowY,
          PANEL.w - 40,
          ROW_H - 6,
          COLORS.bgHex,
          toStock ? COLORS.panelEdgeHex : RESOURCE_COLORS[resource],
          stowed
            ? null
            : () => {
                routes[resource] = toStock ? 'meter' : 'stock';
                repaint();
              }
        );
        add(
          scene.add
            .image(PANEL.x + 40, rowY, resource)
            .setScale(24 / SPRITE_PX)
            .setTint(RESOURCE_COLORS[resource])
            .setDepth(PANEL_CONTENT_DEPTH)
        );
        text(
          PANEL.x + 60,
          rowY,
          `${banked[resource]}  ${RESOURCE_LABELS[resource]}`,
          15,
          stowed ? COLORS.muted : COLORS.text
        );

        if (toStock) {
          text(
            PANEL.x + PANEL.w - 34,
            rowY,
            stowed ? 'IN THE WORKSHOP' : 'KEEP FOR THE WORKSHOP',
            12,
            COLORS.muted,
            1
          );
        } else {
          const detail = `${METER_LABELS[result.meter]}  ${result.from} → ${result.to}`;
          text(
            PANEL.x + PANEL.w - 34,
            rowY - (result.lost ? 8 : 0),
            detail,
            13,
            RESOURCE_COLORS[resource],
            1
          );
          // The cap sits only two above the starting level on purpose, so this
          // line shows up often and is meant to sting.
          if (result.lost)
            text(PANEL.x + PANEL.w - 34, rowY + 10, `${result.lost} over the brim, lost`, 11, COLORS.bust, 1);
        }
        y += ROW_H;
      }
    }

    y += 14;
    text(PANEL.x + 20, y, 'THE WORKSHOP', 11, COLORS.dim);
    const stockLine = RESOURCES.map((r) => `${RESOURCE_LABELS[r]} ${state.stock[r]}`).join('   ');
    text(PANEL.x + PANEL.w - 20, y, stockLine, 12, COLORS.muted, 1);
    y += 22;

    state.tuning.tools.forEach((tool, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = PANEL.x + 12 + CARD.w / 2 + col * (CARD.w + CARD.gap);
      const cy = y + CARD.h / 2 + row * (CARD.h + CARD.gap);
      const built = state.toolsBuilt.includes(tool.id);
      const affordable = !built && canAfford(state.stock, tool.cost);

      hitRect(
        cx,
        cy,
        CARD.w,
        CARD.h,
        built ? COLORS.panelHex : COLORS.bgHex,
        built ? COLORS.dimHex : affordable ? COLORS.lampHex : COLORS.panelEdgeHex,
        affordable
          ? () => {
              buildTool(state, tool.id);
              playBuild();
              repaint();
            }
          : null
      );
      const tint = built ? COLORS.dimHex : affordable ? COLORS.lampHex : COLORS.mutedHex;
      add(
        scene.add
          .image(cx - CARD.w / 2 + 26, cy - 6, tool.id)
          .setScale(32 / SPRITE_PX)
          .setTint(tint)
          .setDepth(PANEL_CONTENT_DEPTH)
      );
      const bodyColour = built ? COLORS.dim : affordable ? COLORS.text : COLORS.muted;
      text(cx - CARD.w / 2 + 48, cy - 22, tool.name, 14, bodyColour);
      const cost = Object.entries(tool.cost)
        .map(([r, n]) => `${n} ${RESOURCE_LABELS[r]}`)
        .join(' + ');
      text(cx - CARD.w / 2 + 48, cy - 3, built ? 'BUILT' : cost, 11, built ? COLORS.dim : COLORS.muted);
      // Each tool is the player's only lever on probability, so the card says
      // exactly what it does to the shore rather than naming a stat.
      const effect = tool.removeWave
        ? 'Takes a wave off the shore'
        : `Adds ${RESOURCE_LABELS[tool.add.resource]} x${tool.add.amount}`;
      text(cx - CARD.w / 2 + 12, cy + 24, effect, 11, built ? COLORS.dim : COLORS.foam);
    });

    const buttonY = PANEL.y + PANEL.h - 44;
    if (!stowed) {
      add(
        createButton(scene, GAME_WIDTH / 2, buttonY, held.length ? 'STOW' : 'NOTHING TO STOW', () => {
          // Work out what each stack is about to do before allocate does it —
          // afterwards the basket is empty and the meters have already moved.
          outcome = {};
          for (const resource of held) outcome[resource] = plannedResult(resource);
          allocate(state, routes);
          if (held.length) playPour();
          stowed = true;
          repaint();
        }, { width: 260 }).setPanelDepth(PANEL_CONTENT_DEPTH)
      );
    } else {
      add(
        createButton(scene, GAME_WIDTH / 2, buttonY, 'SLEEP', () => {
          const finish = onDone;
          view.close();
          if (finish) finish();
        }, { width: 260 }).setPanelDepth(PANEL_CONTENT_DEPTH)
      );
    }
  }

  const view = {
    // `done` runs after SLEEP, with the basket already allocated — the scene
    // only has to call endNight.
    open(runState, done) {
      state = runState;
      onDone = done;
      banked = { ...runState.basket };
      outcome = null;
      routes = {};
      // Default every stack to its meter: the safe read is the obvious one, and
      // routing to the workshop should be a decision the player makes.
      for (const resource of RESOURCES) routes[resource] = 'meter';
      stowed = false;
      open = true;
      repaint();
    },

    close() {
      objects.forEach((o) => (o.destroyAll ? o.destroyAll() : o.destroy()));
      objects = [];
      open = false;
      state = null;
      onDone = null;
    },

    isOpen: () => open,
    // Test seam: what the panel currently intends to do with each stack.
    currentRoutes: () => ({ ...routes }),
    hasStowed: () => stowed,
  };

  return view;
}
