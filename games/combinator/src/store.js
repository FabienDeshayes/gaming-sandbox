// What the player keeps between visits, in the browser's localStorage: the
// saved machines, what stands on the Playground and which of its machines have
// been made to work so far, and the machine open on the Workbench (saved or
// not). Both screens read and write through here, so
// flipping between them never loses anything.
//
// A machine is { id, name, ground, parts } with its parts ({ id, type }) in
// order, left to right; a Playground placement is { id, machineId, x, y, rot }
// and always shows the machine as last saved. The Playground's run is the list
// of placement ids made to work, in order.

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
    actions: [],
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
  if (!Array.isArray(data.actions)) data.actions = [];
  return data;
}

// Sources from before the four elements were Liquid, Solid, Gas and Energy,
// and what does their job now: a Spring gave motion and a Burner heat, which a
// Battery's Energy and a Gas Bottle (feeding an engine or a torch) do now.
const RENAMED = { spring: 'battery', burner: 'bottle' };

// Machines saved before they were rows were built on a grid, with an x and a
// y on each part. They are read left to right (top to bottom where two share
// a column). Old sources are swapped for the ones that do their job now, and
// modules that no longer exist (carriers and corners, which the row made
// pointless; the pump, brake, thermo switch, valve, clutch and bell, which
// went with the old flows) are left out.
function asRow(parts) {
  if (!Array.isArray(parts)) return [];
  const gridded = parts.some((p) => p.x !== undefined);
  const ordered = gridded ? [...parts].sort((a, b) => a.x - b.x || a.y - b.y) : parts;
  return ordered
    .map(({ id, type }) => ({ id, type: RENAMED[type] ?? type }))
    .filter((p) => MODULES[p.type])
    .slice(0, WORKBENCH.slots);
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
  const ids = new Set(d.placed.map((p) => p.id));
  d.actions = d.actions.filter((a) => ids.has(a));
  persist();
}

export function placedCount(machineId) {
  return load().placed.filter((p) => p.machineId === machineId).length;
}

export function placed() {
  return load().placed;
}

export function setPlaced(list) {
  const d = load();
  d.placed = copy(list);
  const ids = new Set(d.placed.map((p) => p.id));
  d.actions = d.actions.filter((id) => ids.has(id));
  persist();
}

export function actions() {
  return load().actions;
}

export function setActions(list) {
  load().actions = [...list];
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
