// Layout, type and palette. No rules live here: what modules do is in
// src/data/modules.js and src/core/machine.js.

// Two layouts. A portrait screen (a phone held upright) gets the mobile one:
// a narrow design that stacks the screen and puts the panels under tabs, and
// is driven by tapping and dragging with a finger. Anything else gets the
// desktop one. `?layout=mobile` or `?layout=desktop` forces either. The choice
// is made once, at load; src/main.js reloads the page if the screen turns.
const view = globalThis.window ?? { innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1 };
const forced = new URLSearchParams(globalThis.location?.search ?? '').get('layout');
export const isPortrait = () => view.innerHeight > view.innerWidth;
export const MOBILE = forced ? forced === 'mobile' : isPortrait();

const MOBILE_WIDTH = 450;
// The design size, in the coordinates every layout below is written in. The
// mobile height follows the phone's shape, so a tall phone gets taller panels.
export const GAME_WIDTH = MOBILE ? MOBILE_WIDTH : 1280;
export const GAME_HEIGHT = MOBILE
  ? Math.round(Math.min(1000, Math.max(800, (MOBILE_WIDTH * view.innerHeight) / view.innerWidth)))
  : 800;
// A phone's screen has two to three pixels per CSS pixel, so the mobile canvas
// is drawn that many times bigger and each scene's camera zooms in to match:
// the layout stays in design coordinates and comes out sharp.
export const ZOOM = MOBILE
  ? Math.min(3, Math.max(1, (view.devicePixelRatio || 1) * Math.min(view.innerWidth / GAME_WIDTH, view.innerHeight / GAME_HEIGHT)))
  : 1;

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const TEXT_RESOLUTION = Math.max(2, Math.ceil(ZOOM));
export const FONT_LG = 24;
export const FONT_MD = 18;
export const FONT_RG = 16;
export const FONT_SM = 14;

// A press that travels further than this (in design pixels) is a drag, not a
// click. A fingertip wobbles more than a mouse.
export const DRAG_THRESHOLD = MOBILE ? 10 : 8;
// How long each turn shows during a played-back test run.
export const PLAY_STEP_MS = 700;

// The Workbench: modules on the left, the machine's row in the middle with a
// few words under each piece and its test world and run below that, saved
// machines and the readout on the right. `bench.top` is where the row starts
// taking drops; links that skip pieces run over it between `top` and `y`.
export const LAYOUT = {
  header: { h: 56 },
  machineBar: { y: 78 },
  palette: { x: 16, y: 72, w: 224, rowH: 40, headingH: 26, gap: 6 },
  bench: { x: 268, y: 172, slot: 84, gap: 6, top: 112, captionH: 168 },
  legend: { y: 444 },
  preview: { x: 262, y: 500, tile: 34 },
  timeline: { x: 454, y: 474, w: 440, labelW: 150, rowH: 26, bottom: 784 },
  library: { x: 914, y: 72, w: 350, rowH: 30, rows: 4 },
  panel: { x: 914, y: 256, w: 350, h: 528, inspectH: 210 },
};

// The Playground: saved machines on the left, the world in the middle with the
// round below it, the readout on the right.
export const PLAY_LAYOUT = {
  machines: { x: 16, y: 72, w: 224, rowH: 44, rows: 13 },
  world: { x: 282, y: 104, tile: 62 },
  legend: { y: 562 },
  timeline: { x: 262, y: 588, w: 632, labelW: 190, rowH: 24, bottom: 784 },
  panel: { x: 914, y: 72, w: 350, h: 712, inspectH: 250 },
};

// The mobile layouts: one column, the grid on top, what you drag from under
// it, and a tabbed panel at the bottom for everything else (the readout, the
// inspector, the test run and the saved machines). `panel` runs to the bottom
// of the screen, however tall the phone makes it.
const panelTo = (y) => ({ x: 16, y, w: GAME_WIDTH - 32, h: GAME_HEIGHT - 8 - y });

export const MOBILE_LAYOUT = {
  header: { y: 24 },
  machineBar: { y: 62, status: 80 },
  bench: { x: 17, y: 128, slot: 56, gap: 4, top: 100, captionH: 106 },
  legend: { y: 306 },
  palette: { x: 16, y: 322, w: GAME_WIDTH - 32, chipH: 30, rowH: 42, gap: 6, cols: 4 },
  tabs: { y: 478 },
  panel: panelTo(500),
};

export const MOBILE_PLAY_LAYOUT = {
  header: { y: 24 },
  world: { x: 30, y: 68, tile: 41 },
  legend: { y: 372 },
  machines: { x: 16, y: 386, w: GAME_WIDTH - 32, rowH: 40, rows: 2, cols: 2 },
  tabs: { y: 526 },
  panel: panelTo(548),
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
  warn: '#f5b547',
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
