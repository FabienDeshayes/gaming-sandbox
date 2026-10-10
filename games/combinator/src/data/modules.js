// The module catalogue.
//
// A machine is a row of modules, read left to right. A module's inputs take
// flow from pieces to its left and its outputs offer flow to pieces on its
// right (src/core/machine.js says exactly how). Everything a module does
// follows from its role (DESIGN.md §4), so a definition only says which
// elements it takes and gives, what it is made of, and — for effectors — what
// it does to the world. Every module works every time its machine is made to
// work: nothing runs out.

// The four elements a flow can carry: three states of matter, and the energy
// that moves matter from one state to another.
export const FLOWS = ['liquid', 'solid', 'gas', 'energy'];

const port = (dir, flow) => ({ dir, flow });

export const MODULES = {
  // --- Sources: give an element every time the machine works -----------------
  tank: {
    name: 'Water Tank',
    role: 'source',
    material: 'metal',
    ports: [port('out', 'liquid')],
    blurb: 'Gives water (Liquid) every time the machine works.',
  },
  hopper: {
    name: 'Sand Hopper',
    role: 'source',
    material: 'metal',
    ports: [port('out', 'solid')],
    blurb: 'Gives sand (Solid) every time the machine works.',
  },
  bottle: {
    name: 'Gas Bottle',
    role: 'source',
    material: 'metal',
    ports: [port('out', 'gas')],
    blurb: 'Gives gas every time the machine works.',
  },
  battery: {
    name: 'Battery',
    role: 'source',
    material: 'metal',
    ports: [port('out', 'energy')],
    blurb: 'Gives Energy every time the machine works.',
  },

  // --- Transmission: converters turn one element into another (and run hot) --
  boiler: {
    name: 'Boiler',
    role: 'transmission',
    kind: 'converter',
    material: 'metal',
    ports: [port('in', 'liquid'), port('in', 'energy'), port('out', 'gas')],
    blurb: 'Boils Liquid into Gas with Energy. Needs both inputs.',
  },
  condenser: {
    name: 'Condenser',
    role: 'transmission',
    kind: 'converter',
    material: 'metal',
    ports: [port('in', 'gas'), port('out', 'liquid')],
    blurb: 'Cools Gas back into Liquid.',
  },
  melter: {
    name: 'Melter',
    role: 'transmission',
    kind: 'converter',
    material: 'metal',
    ports: [port('in', 'solid'), port('in', 'energy'), port('out', 'liquid')],
    blurb: 'Melts a Solid into Liquid with Energy. Needs both inputs.',
  },
  freezer: {
    name: 'Freezer',
    role: 'transmission',
    kind: 'converter',
    material: 'metal',
    ports: [port('in', 'liquid'), port('in', 'energy'), port('out', 'solid')],
    blurb: 'Uses Energy to freeze Liquid into a Solid. Needs both inputs.',
  },
  wheel: {
    name: 'Water Wheel',
    role: 'transmission',
    kind: 'converter',
    material: 'wood',
    ports: [port('in', 'liquid'), port('out', 'energy')],
    blurb: 'Turns flowing Liquid into Energy.',
  },
  engine: {
    name: 'Steam Engine',
    role: 'transmission',
    kind: 'converter',
    material: 'metal',
    ports: [port('in', 'gas'), port('out', 'energy')],
    blurb: 'Turns Gas under pressure into Energy.',
  },

  // --- Effectors: act on the world --------------------------------------------
  sprinkler: {
    name: 'Sprinkler',
    role: 'effector',
    material: 'metal',
    ports: [port('in', 'liquid')],
    effect: { kind: 'wet', area: 'cross' },
    blurb: 'Wets its own tile and the 4 tiles around it.',
  },
  chute: {
    name: 'Sand Chute',
    role: 'effector',
    material: 'metal',
    ports: [port('in', 'solid')],
    effect: { kind: 'sand', area: 'front1' },
    blurb: 'Pours sand over the tile in front of the machine.',
  },
  fan: {
    name: 'Fan',
    role: 'effector',
    material: 'wood',
    ports: [port('in', 'energy')],
    effect: { kind: 'wind', area: 'front2' },
    blurb: 'Blows wind onto the 2 tiles in front of the machine.',
  },
  torch: {
    name: 'Torch',
    role: 'effector',
    material: 'metal',
    ports: [port('in', 'gas')],
    effect: { kind: 'hot', area: 'front1' },
    blurb: 'Burns Gas to heat the tile in front of the machine.',
  },
};

// Palette order: grouped by role so the three roles read as three shelves.
export const PALETTE = [
  { heading: 'Sources', ids: ['tank', 'hopper', 'bottle', 'battery'] },
  { heading: 'Converters', ids: ['boiler', 'condenser', 'melter', 'freezer', 'wheel', 'engine'] },
  { heading: 'Effectors', ids: ['sprinkler', 'chute', 'fan', 'torch'] },
];
