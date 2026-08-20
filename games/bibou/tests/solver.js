// A headless replay of a level, and a breadth-first solver over it.
//
// This is *not* a second copy of the rules: every state transition below calls
// straight into `src/core/rules.js`, and mirrors what `PuzzleScene` does with
// the result — the same destroy/pickup/no-op handling, the same per-action
// budgets, the same win check. It exists so a level can be proved solvable (and
// proved to *need* the action it grants) without launching a browser, which is
// what the level-design checks in tests/game.test.js use it for. See
// TESTING.md's "Solver check".
//
// If the rules or PuzzleScene's handling of them change, this file has to
// follow — the browser tests are still the authority on what the game does.

import {
  applyMoveChain,
  buildWallSet,
  flipEntity,
  resolveCycleOutcome,
  resolveMoveChain,
  samePos,
  shiftOrder,
} from '../src/core/rules.js';

const DIRECTIONS = ['Up', 'Down', 'Left', 'Right'];

// The entity layer as PuzzleScene.create builds it (see its own comment): the
// character first, then crates (each keeping whatever it contains), then loose
// collectibles.
export function initState(level) {
  const entities = [
    { kind: 'character', pos: { ...level.entities.character } },
    ...(level.entities.crates ?? []).map((c) => ({
      kind: 'crate',
      pos: { x: c.x, y: c.y },
      contains: c.contains ? { ...c.contains } : null,
    })),
    ...(level.entities.collectibles ?? []).map((c) => ({
      kind: 'collectible',
      type: c.type,
      required: c.required === true,
      pos: { x: c.x, y: c.y },
    })),
  ];
  const remaining = {};
  Object.entries(level.actionBudget ?? {}).forEach(([action, n]) => {
    if (n > 0) remaining[action] = n;
  });
  return { entities, collected: [], remaining };
}

// The required collectible *types*, fixed at load time — a key still sealed in
// a crate counts, exactly as PuzzleScene.requiredTypes does.
export function requiredTypes(level) {
  return [
    ...new Set(
      [
        ...(level.entities.collectibles ?? []),
        ...(level.entities.crates ?? []).map((c) => c.contains).filter(Boolean),
      ]
        .filter((c) => c.required === true)
        .map((c) => c.type)
    ),
  ];
}

export function characterPos(state) {
  return state.entities.find((e) => e.kind === 'character').pos;
}

export function isWin(level, state) {
  return (
    samePos(characterPos(state), level.background.goal) &&
    requiredTypes(level).every((t) => state.collected.includes(t))
  );
}

function cloneState(state) {
  return {
    entities: state.entities.map((e) => ({
      ...e,
      pos: { ...e.pos },
      contains: e.contains ? { ...e.contains } : e.contains,
    })),
    collected: [...state.collected],
    remaining: { ...state.remaining },
  };
}

// A crate's death drops whatever it carried onto the tile it died on
// (PuzzleScene.destroyEntity).
function destroy(state, entity) {
  state.entities = state.entities.filter((e) => e !== entity);
  if (entity.contains) {
    state.entities.push({
      kind: 'collectible',
      type: entity.contains.type,
      required: entity.contains.required === true,
      pos: { ...entity.pos },
    });
  }
}

function collect(state, collectible) {
  state.entities = state.entities.filter((e) => e !== collectible);
  if (!state.collected.includes(collectible.type)) state.collected.push(collectible.type);
}

// Every action a level offers, as plain descriptors. Move is always in here —
// it's free and unlimited — and a budgeted action only while its pool holds.
export function legalActions(level, state) {
  const actions = DIRECTIONS.map((dir) => ({ type: 'move', dir }));
  if ((state.remaining.shift ?? 0) > 0) {
    for (let index = 0; index < level.gridSize; index++) {
      actions.push({ type: 'shift', axis: 'row', index, dir: 'Left' });
      actions.push({ type: 'shift', axis: 'row', index, dir: 'Right' });
      actions.push({ type: 'shift', axis: 'column', index, dir: 'Up' });
      actions.push({ type: 'shift', axis: 'column', index, dir: 'Down' });
    }
  }
  if ((state.remaining.flip ?? 0) > 0) {
    actions.push({ type: 'flip', axis: 'row' });
    actions.push({ type: 'flip', axis: 'column' });
  }
  return actions;
}

// Applies one action, returning the resulting state — or `null` when the game
// would reject it outright (an illegal move, a shift that changes nothing).
// Rejected actions cost nothing, exactly as in PuzzleScene.
export function applyAction(level, state, action, wallSet = buildWallSet(level.walls)) {
  const size = level.gridSize;
  const next = cloneState(state);

  if (action.type === 'move') {
    const result = resolveMoveChain(
      wallSet,
      next.entities,
      characterPos(next),
      action.dir,
      size
    );
    if (result.kind === 'illegal') return null;
    if (result.kind === 'destroy') {
      // Nothing behind a crushed crate advances (LEVEL_DESIGN.md §5.4).
      destroy(next, result.victim);
      return next;
    }
    if (result.kind === 'pickup') {
      const character = next.entities.find((e) => e.kind === 'character');
      character.pos = { ...result.path[1] };
      collect(next, result.collectible);
      return next;
    }
    applyMoveChain(next.entities, result.path);
    return next;
  }

  if (action.type === 'shift') {
    const order = shiftOrder(action.axis, action.index, action.dir, size);
    const outcomes = resolveCycleOutcome(wallSet, next.entities, order);
    // Nothing on the line, or nothing on it that can move: rejected and free.
    if (outcomes.length === 0) return null;
    if (outcomes.every((o) => o.outcome === 'stay')) return null;

    outcomes
      .filter((o) => o.outcome === 'move')
      .forEach((o) => {
        o.entity.pos = { ...o.dest };
      });
    outcomes
      .filter((o) => o.outcome === 'pickup')
      .forEach((o) => {
        if (!o.characterStays) o.entity.pos = { ...o.collectible.pos };
        collect(next, o.collectible);
      });
    outcomes
      .filter((o) => o.outcome === 'destroy')
      .forEach((o) => destroy(next, o.entity));
    next.remaining.shift -= 1;
    return next;
  }

  if (action.type === 'flip') {
    // Flip never checks walls and never jams: a reflection is a permutation of
    // the board, so nothing can collide (LEVEL_DESIGN.md §5.3).
    next.entities.forEach((e) => {
      e.pos = flipEntity(e.pos, action.axis, size);
    });
    next.remaining.flip -= 1;
    return next;
  }

  throw new Error(`unknown action type: ${action.type}`);
}

// Order-independent fingerprint of a state, so the search doesn't revisit a
// board it has already seen by another route.
function stateKey(state) {
  const entities = state.entities
    .map((e) => `${e.kind}:${e.type ?? ''}:${e.pos.x},${e.pos.y}:${e.contains ? e.contains.type : ''}`)
    .sort()
    .join(';');
  const remaining = Object.entries(state.remaining)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join(',');
  return `${entities}|${[...state.collected].sort().join(',')}|${remaining}`;
}

export function describeAction(action) {
  if (action.type === 'move') return `Move ${action.dir}`;
  if (action.type === 'shift') return `Shift ${action.axis} ${action.index} ${action.dir}`;
  return `Flip ${action.axis}`;
}

// Breadth-first search over the whole reachable state space, so a returned
// `path` is a shortest solution and `solved: false` means the level is
// genuinely unwinnable from `opts.start` under `opts` — not that the search
// gave up.
//
// Options:
//   start   — a state from initState (defaults to the level's own start), so a
//             caller can play a few actions first and ask what's left.
//   prefix  — actions to play before the search begins; the returned path
//             includes them. Throws if one of them is rejected.
//   allow   — action types the search may use ('move' is always allowed), for
//             asking "is this level solvable *without* spending the Flip?".
export function solve(level, opts = {}) {
  const wallSet = buildWallSet(level.walls);
  let start = opts.start ? cloneState(opts.start) : initState(level);
  const prefix = (opts.prefix ?? []).map((a) => ({ ...a }));
  prefix.forEach((action) => {
    const next = applyAction(level, start, action, wallSet);
    if (!next) throw new Error(`prefix action rejected: ${describeAction(action)}`);
    start = next;
  });
  const allow = opts.allow ?? null;

  if (isWin(level, start)) return { solved: true, path: prefix };

  const queue = [{ state: start, path: [] }];
  const seen = new Set([stateKey(start)]);
  while (queue.length > 0) {
    const { state, path } = queue.shift();
    for (const action of legalActions(level, state)) {
      if (allow && action.type !== 'move' && !allow.includes(action.type)) continue;
      const next = applyAction(level, state, action, wallSet);
      if (!next) continue;
      const key = stateKey(next);
      if (seen.has(key)) continue;
      seen.add(key);
      const nextPath = [...path, action];
      if (isWin(level, next)) return { solved: true, path: [...prefix, ...nextPath] };
      queue.push({ state: next, path: nextPath });
    }
  }
  return { solved: false, path: null, explored: seen.size };
}
