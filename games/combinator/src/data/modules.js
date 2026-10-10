// The module catalogue and the numbers the machine rules read.
//
// A machine is a row of modules, read left to right. A module's inputs take
// flow from pieces to its left and its outputs offer flow to pieces on its
// right (src/core/machine.js says exactly how). Everything a module does
// follows from its role (DESIGN.md §4), so a definition only says which flows
// it takes and gives, what it is made of, and — for sources and effectors —
// how long it runs or what it does to the world.

export const FLOWS = ['motion', 'matter', 'heat', 'signal'];

export const TUNING = {
  // How many turns a test run lasts. Long enough for every source to run dry.
  turns: 8,
  // A wooden module burns once its tile has been hot this many turns in a row.
  burnTurns: 2,
};

const port = (dir, flow) => ({ dir, flow });

export const MODULES = {
  // --- Sources: produce a flow until they run out -----------------------------
  tank: {
    name: 'Water Tank',
    role: 'source',
    material: 'metal',
    charge: 4,
    ports: [port('out', 'matter')],
    blurb: 'Pushes out water for 4 turns, then it is empty.',
  },
  spring: {
    name: 'Spring',
    role: 'source',
    material: 'metal',
    charge: 3,
    ports: [port('out', 'motion')],
    blurb: 'A wound spring. Turns for 3 turns, then it is unwound.',
  },
  burner: {
    name: 'Burner',
    role: 'source',
    material: 'metal',
    charge: 4,
    ports: [port('out', 'heat')],
    blurb: 'Burns its fuel for 4 turns, then it goes out.',
  },
  battery: {
    name: 'Battery',
    role: 'source',
    material: 'metal',
    charge: 5,
    ports: [port('out', 'signal')],
    blurb: 'Sends a signal for 5 turns, then it is flat.',
  },

  // --- Transmission: converters turn one flow into another (and run hot) ------
  pump: {
    name: 'Pump',
    role: 'transmission',
    kind: 'converter',
    material: 'metal',
    ports: [port('in', 'motion'), port('in', 'matter'), port('out', 'matter')],
    blurb: 'Uses motion to push water. Needs both inputs.',
  },
  wheel: {
    name: 'Water Wheel',
    role: 'transmission',
    kind: 'converter',
    material: 'wood',
    ports: [port('in', 'matter'), port('out', 'motion')],
    blurb: 'Turns flowing water into motion.',
  },
  engine: {
    name: 'Steam Engine',
    role: 'transmission',
    kind: 'converter',
    material: 'metal',
    ports: [port('in', 'heat'), port('out', 'motion')],
    blurb: 'Turns heat into motion.',
  },
  brake: {
    name: 'Friction Brake',
    role: 'transmission',
    kind: 'converter',
    material: 'metal',
    ports: [port('in', 'motion'), port('out', 'heat')],
    blurb: 'Turns motion into heat.',
  },
  thermo: {
    name: 'Thermo Switch',
    role: 'transmission',
    kind: 'converter',
    material: 'metal',
    ports: [port('in', 'heat'), port('out', 'signal')],
    blurb: 'Sends a signal while it is fed heat.',
  },

  // --- Transmission: controls let a flow through only on a signal -------------
  valve: {
    name: 'Valve',
    role: 'transmission',
    kind: 'control',
    material: 'metal',
    ports: [port('in', 'matter'), port('in', 'signal'), port('out', 'matter')],
    blurb: 'Lets water through only while it gets a signal too.',
  },
  clutch: {
    name: 'Clutch',
    role: 'transmission',
    kind: 'control',
    material: 'metal',
    ports: [port('in', 'motion'), port('in', 'signal'), port('out', 'motion')],
    blurb: 'Lets motion through only while it gets a signal too.',
  },

  // --- Effectors: act on the world --------------------------------------------
  sprinkler: {
    name: 'Sprinkler',
    role: 'effector',
    material: 'metal',
    ports: [port('in', 'matter')],
    effect: { kind: 'wet', area: 'cross' },
    blurb: 'Wets its own tile and the 4 tiles around it.',
  },
  fan: {
    name: 'Fan',
    role: 'effector',
    material: 'wood',
    ports: [port('in', 'motion')],
    effect: { kind: 'air', area: 'front2' },
    blurb: 'Blows air onto the 2 tiles in front of the machine.',
  },
  torch: {
    name: 'Torch',
    role: 'effector',
    material: 'metal',
    ports: [port('in', 'heat')],
    effect: { kind: 'hot', area: 'front1' },
    blurb: 'Heats the tile in front of the machine.',
  },
  bell: {
    name: 'Alarm Bell',
    role: 'effector',
    material: 'metal',
    ports: [port('in', 'signal')],
    effect: { kind: 'alert', area: 'cross' },
    blurb: 'Rings, alerting its own tile and the 4 around it.',
  },
};

// Palette order: grouped by role so the three roles read as three shelves.
export const PALETTE = [
  { heading: 'Sources', ids: ['tank', 'spring', 'burner', 'battery'] },
  { heading: 'Converters', ids: ['pump', 'wheel', 'engine', 'brake', 'thermo'] },
  { heading: 'Controls', ids: ['valve', 'clutch'] },
  { heading: 'Effectors', ids: ['sprinkler', 'fan', 'torch', 'bell'] },
];
