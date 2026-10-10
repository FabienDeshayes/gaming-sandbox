// What the player keeps between visits, in the browser's localStorage: the
// saved machines, what stands on the Playground, and the machine open on the
// Workbench (saved or not). Both screens read and write through here, so
// flipping between them never loses anything.
//
// A machine is { id, name, ground, parts } with its parts ({ id, type }) in
// order, left to right; a Playground placement is { id, machineId, x, y, rot }
// and always shows the machine as last saved.

import { MODULES } from './data/modules.js';
import { EXAMPLES, PLAYGROUND_START, WORKBENCH } from './data/world.js';

const KEY = 'combinator.v1';
let data = null;

export const copy = (v) => JSON.parse(JSON.stringify(v));

const partsOf = (example) => example.parts.map((type, i) => ({ id: `m${i + 1}`, type }));

function seed() {
  const machines = EXAMPLES.map((ex, i) => ({ id: `k${i + 1}`, name: ex.name, ground: ex.ground, parts: partsOf(ex) }));
  return {
    nextMachine: machines.length + 1,
    nextPlaced: PLAYGROUND_START.length + 1,
    machines,
    placed: PLAYGROUND_START.map(([ex, x, y, rot], i) => ({ id: `p${i + 1}`, machineId: `k${ex + 1}`, x, y, rot })),
    draft: { machineId: machines[0].id, name: machines[0].name, ground: machines[0].ground, parts: copy(machines[0].parts) },
  };
}

function load() {
  if (data) return data;
  try {
    const raw = localStorage.getItem(KEY);
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }
  if (!data || !Array.isArray(data.machines) || !Array.isArray(data.placed) || !data.draft) data = seed();
  for (const m of [...data.machines, data.draft]) m.parts = asRow(m.parts);
  return data;
}

// Machines saved before they were rows were built on a grid, with an x and a
// y on each part. They are read left to right (top to bottom where two share
// a column), and modules that no longer exist (the carriers and corners, which
// the row made pointless) are left out.
function asRow(parts) {
  if (!Array.isArray(parts)) return [];
  const gridded = parts.some((p) => p.x !== undefined);
  const ordered = gridded ? [...parts].sort((a, b) => a.x - b.x || a.y - b.y) : parts;
  return ordered
    .filter((p) => MODULES[p.type])
    .slice(0, WORKBENCH.slots)
    .map(({ id, type }) => ({ id, type }));
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Private windows and full storage still get a working session.
  }
}

export function machines() {
  return load().machines;
}

export function machine(id) {
  return load().machines.find((m) => m.id === id) ?? null;
}

// Creates the machine when it has no id yet; returns its id.
export function saveMachine({ machineId, name, ground, parts }) {
  const d = load();
  const entry = { name, ground, parts: copy(parts) };
  let id = machineId && machine(machineId) ? machineId : null;
  if (id) Object.assign(machine(id), entry);
  else {
    id = `k${d.nextMachine++}`;
    d.machines.push({ id, ...entry });
  }
  persist();
  return id;
}

// Deleting a machine also takes it off the Playground.
export function deleteMachine(id) {
  const d = load();
  d.machines = d.machines.filter((m) => m.id !== id);
  d.placed = d.placed.filter((p) => p.machineId !== id);
  persist();
}

export function placedCount(machineId) {
  return load().placed.filter((p) => p.machineId === machineId).length;
}

export function placed() {
  return load().placed;
}

export function setPlaced(list) {
  load().placed = copy(list);
  persist();
}

export function newPlacedId() {
  const id = `p${load().nextPlaced++}`;
  persist();
  return id;
}

export function draft() {
  return copy(load().draft);
}

export function setDraft(next) {
  load().draft = copy(next);
  persist();
}

export function freshName() {
  const names = new Set(machines().map((m) => m.name));
  for (let n = 1; ; n++) if (!names.has(`Machine ${n}`)) return `Machine ${n}`;
}
