// The module catalogue and the numbers the machine rules read.
//
// A module is drawn facing north (rotation 0). Its ports sit on the four sides
// of its tile; rotating the module turns the ports with it. Everything a module
// does follows from its role (DESIGN.md §4), so a definition only says which
// ports it has, what it is made of, and — for sources and effectors — how long
// it runs or what it does to the world.

export const FLOWS = ['motion', 'matter', 'heat', 'signal'];

export const TUNING = {
  // How many turns a test run lasts. Long enough for every source to run dry.
  turns: 8,
  // A wooden module burns once its tile has been hot this many turns in a row.
  burnTurns: 2,
};

const port = (side, dir, flow) => ({ side, dir, flow });

export const MODULES = {
  // --- Sources: produce a flow until they run out -----------------------------
  tank: {
    name: 'Water Tank',
    role: 'source',
    material: 'metal',
    charge: 4,
    ports: [port('E', 'out', 'matter')],
    blurb: 'Pushes out water for 4 turns, then it is empty.',
  },
  spring: {
    name: 'Spring',
    role: 'source',
    material: 'metal',
    charge: 3,
    ports: [port('E', 'out', 'motion')],
    blurb: 'A wound spring. Turns for 3 turns, then it is unwound.',
  },
  burner: {
    name: 'Burner',
    role: 'source',
    material: 'metal',
    charge: 4,
    ports: [port('E', 'out', 'heat')],
    blurb: 'Burns its fuel for 4 turns, then it goes out.',
  },
  battery: {
    name: 'Battery',
    role: 'source',
    material: 'metal',
    charge: 5,
    ports: [port('E', 'out', 'signal')],
    blurb: 'Sends a signal for 5 turns, then it is flat.',
  },

  // --- Transmission: carriers pass one flow straight through -----------------
  shaft: {
    name: 'Shaft',
    role: 'transmission',
    kind: 'carrier',
    material: 'wood',
    ports: [port('W', 'in', 'motion'), port('E', 'out', 'motion')],
    blurb: 'Carries motion in a straight line.',
  },
  gear: {
    name: 'Gear Corner',
    role: 'transmission',
    kind: 'carrier',
    material: 'wood',
    ports: [port('W', 'in', 'motion'), port('N', 'out', 'motion')],
    blurb: 'Carries motion round a corner.',
  },
  pipe: {
    name: 'Pipe',
    role: 'transmission',
    kind: 'carrier',
    material: 'metal',
    ports: [port('W', 'in', 'matter'), port('E', 'out', 'matter')],
    blurb: 'Carries water in a straight line.',
  },
  bend: {
    name: 'Pipe Bend',
    role: 'transmission',
    kind: 'carrier',
    material: 'metal',
    ports: [port('W', 'in', 'matter'), port('N', 'out', 'matter')],
    blurb: 'Carries water round a corner.',
  },
  rod: {
    name: 'Heat Rod',
    role: 'transmission',
    kind: 'carrier',
    material: 'metal',
    ports: [port('W', 'in', 'heat'), port('E', 'out', 'heat')],
    blurb: 'Carries heat in a straight line.',
  },
  wire: {
    name: 'Wire',
    role: 'transmission',
    kind: 'carrier',
    material: 'metal',
    ports: [port('W', 'in', 'signal'), port('E', 'out', 'signal')],
    blurb: 'Carries a signal in a straight line.',
  },
  wireBend: {
    name: 'Wire Corner',
    role: 'transmission',
    kind: 'carrier',
    material: 'metal',
    ports: [port('W', 'in', 'signal'), port('N', 'out', 'signal')],
    blurb: 'Carries a signal round a corner.',
  },

  // --- Transmission: converters turn one flow into another (and run hot) ------
  pump: {
    name: 'Pump',
    role: 'transmission',
    kind: 'converter',
    material: 'metal',
    ports: [port('W', 'in', 'motion'), port('S', 'in', 'matter'), port('E', 'out', 'matter')],
    blurb: 'Uses motion to push water. Needs both inputs.',
  },
  wheel: {
    name: 'Water Wheel',
    role: 'transmission',
    kind: 'converter',
    material: 'wood',
    ports: [port('W', 'in', 'matter'), port('E', 'out', 'motion')],
    blurb: 'Turns flowing water into motion.',
  },
  engine: {
    name: 'Steam Engine',
    role: 'transmission',
    kind: 'converter',
    material: 'metal',
    ports: [port('W', 'in', 'heat'), port('E', 'out', 'motion')],
    blurb: 'Turns heat into motion.',
  },
  brake: {
    name: 'Friction Brake',
    role: 'transmission',
    kind: 'converter',
    material: 'metal',
    ports: [port('W', 'in', 'motion'), port('E', 'out', 'heat')],
    blurb: 'Turns motion into heat.',
  },
  thermo: {
    name: 'Thermo Switch',
    role: 'transmission',
    kind: 'converter',
    material: 'metal',
    ports: [port('W', 'in', 'heat'), port('E', 'out', 'signal')],
    blurb: 'Sends a signal while it is fed heat.',
  },

  // --- Transmission: controls let a flow through only on a signal -------------
  valve: {
    name: 'Valve',
    role: 'transmission',
    kind: 'control',
    material: 'metal',
    ports: [port('W', 'in', 'matter'), port('S', 'in', 'signal'), port('E', 'out', 'matter')],
    blurb: 'Lets water through only while it gets a signal.',
  },
  clutch: {
    name: 'Clutch',
    role: 'transmission',
    kind: 'control',
    material: 'metal',
    ports: [port('W', 'in', 'motion'), port('S', 'in', 'signal'), port('E', 'out', 'motion')],
    blurb: 'Lets motion through only while it gets a signal.',
  },

  // --- Effectors: act on the world --------------------------------------------
  sprinkler: {
    name: 'Sprinkler',
    role: 'effector',
    material: 'metal',
    ports: [port('S', 'in', 'matter')],
    effect: { kind: 'wet', area: 'cross' },
    blurb: 'Wets its own tile and the 4 tiles around it.',
  },
  fan: {
    name: 'Fan',
    role: 'effector',
    material: 'wood',
    ports: [port('S', 'in', 'motion')],
    effect: { kind: 'air', area: 'front2' },
    blurb: 'Blows air onto the 2 tiles in front of it.',
  },
  torch: {
    name: 'Torch',
    role: 'effector',
    material: 'metal',
    ports: [port('S', 'in', 'heat')],
    effect: { kind: 'heat', area: 'front1' },
    blurb: 'Heats the tile in front of it.',
  },
  bell: {
    name: 'Alarm Bell',
    role: 'effector',
    material: 'metal',
    ports: [port('S', 'in', 'signal')],
    effect: { kind: 'alert', area: 'cross' },
    blurb: 'Rings, alerting its own tile and the 4 around it.',
  },
};

// Palette order: grouped by role so the three roles read as three shelves.
export const PALETTE = [
  { heading: 'Sources', ids: ['tank', 'spring', 'burner', 'battery'] },
  { heading: 'Carriers', ids: ['shaft', 'gear', 'pipe', 'bend', 'rod', 'wire', 'wireBend'] },
  { heading: 'Converters', ids: ['pump', 'wheel', 'engine', 'brake', 'thermo'] },
  { heading: 'Controls', ids: ['valve', 'clutch'] },
  { heading: 'Effectors', ids: ['sprinkler', 'fan', 'torch', 'bell'] },
];
