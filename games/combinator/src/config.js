// Layout, type and palette. No rules live here: what modules do is in
// src/data/modules.js and src/core/machine.js.

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 800;

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const TEXT_RESOLUTION = 2;
export const FONT_LG = 24;
export const FONT_MD = 18;
export const FONT_RG = 16;
export const FONT_SM = 14;

// A press that travels further than this is a drag, not a click.
export const DRAG_THRESHOLD = 8;
// How long each turn shows during a played-back test run.
export const PLAY_STEP_MS = 700;

export const LAYOUT = {
  header: { h: 56 },
  palette: { x: 16, y: 72, w: 224, rowH: 40, headingH: 26, gap: 6 },
  bench: { x: 282, y: 104, tile: 88 },
  legend: { y: 560 },
  timeline: { x: 262, y: 598, w: 632, labelW: 168, rowH: 24 },
  panel: { x: 914, y: 72, w: 350, h: 712, inspectH: 250 },
};

export const COLORS = {
  bg: '#12151b',
  bgHex: 0x12151b,
  panelHex: 0x1a1f28,
  panelEdgeHex: 0x2c3442,
  tileHex: 0x222934,
  tileEdgeHex: 0x323c4c,
  text: '#e8ecf2',
  muted: '#9aa4b2',
  good: '#6be38f',
  goodHex: 0x6be38f,
  bad: '#ff6b6b',
  badHex: 0xff5252,
  highlightHex: 0xffffff,
  buttonHex: 0x2a3240,
  buttonHoverHex: 0x384356,
  buttonEdgeHex: 0x465266,
  selectedHex: 0x3d5a80,
};

// Each flow has a colour *and* a shape, so the four stay apart for anyone who
// can't tell the colours apart.
export const FLOW_STYLE = {
  motion: { color: 0x5aa9ff, css: '#5aa9ff', shape: 'circle' },
  matter: { color: 0x33d1c4, css: '#33d1c4', shape: 'square' },
  heat: { color: 0xff8a3d, css: '#ff8a3d', shape: 'triangle' },
  signal: { color: 0xf5d547, css: '#f5d547', shape: 'diamond' },
};

export const ROLE_STYLE = {
  source: { color: 0x3f9b62, css: '#5cc985', label: 'Source' },
  carrier: { color: 0x56637a, css: '#a9b6cc', label: 'Transmission · Carrier' },
  converter: { color: 0x7a55c9, css: '#b593ff', label: 'Transmission · Converter' },
  control: { color: 0x3d6f9e, css: '#7fb2e5', label: 'Transmission · Control' },
  effector: { color: 0xb8456a, css: '#ff7aa2', label: 'Effector' },
};

export const MATERIAL_STYLE = {
  wood: { color: 0xc08a50, label: 'Wood — burns after 2 hot turns' },
  metal: { color: 0xb9c3d1, label: 'Metal — does not burn' },
};

export const EFFECT_STYLE = {
  wet: 0x3aa0ff,
  hot: 0xff6a2a,
  steam: 0xdfe8f0,
  air: 0xcfe3ff,
  alert: 0xf5d547,
};

export const TERRAIN_STYLE = {
  puddle: 0x2f6fb0,
  embers: 0xd9481e,
  draft: 0x8fa3bf,
};
