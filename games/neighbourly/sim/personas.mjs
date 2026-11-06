// The players the simulator stands in for. A persona looks at the run the way
// a player would (the board, the three offers, the pieces the run can offer,
// the level and turn) and picks [offerIndex, tileIndex]. None of them may read
// `state.script`: a player doesn't know what comes next.
//
// When one loses, check it isn't just playing badly before concluding a piece
// or a target is wrong.

import { currentOffer, scoreBoard } from '../src/core/rules.js';

// The board's total if `id` went on `i`.
function totalWith(board, tuning, id, i) {
  const next = board.slice();
  next[i] = id;
  return scoreBoard(next, tuning).total;
}

// Every (offer, tile) with its immediate gain, best first.
function moves(state, { emptyOnly = false } = {}) {
  const now = scoreBoard(state.board, state.tuning).total;
  const anyEmpty = state.board.some((x) => !x);
  const out = [];
  currentOffer(state).forEach((id, o) => {
    for (let i = 0; i < state.board.length; i++) {
      if (emptyOnly && anyEmpty && state.board[i]) continue;
      out.push({ o, i, id, d: totalWith(state.board, state.tuning, id, i) - now });
    }
  });
  // Stable: ties keep offer-then-tile order, so a persona is deterministic.
  return out.sort((a, b) => b.d - a.d);
}

// What the best placement of each piece in the pool would add to `board`,
// averaged: what an unknown next offer is worth.
function outlook(board, state) {
  const base = scoreBoard(board, state.tuning).total;
  let sum = 0;
  for (const id of state.pool) {
    let g = -Infinity;
    for (let i = 0; i < board.length; i++) g = Math.max(g, totalWith(board, state.tuning, id, i) - base);
    sum += g;
  }
  return sum / state.pool.length;
}

export const PERSONAS = {
  random: {
    about: 'a random offer on a random tile: the floor',
    pick: (state, r) => [Math.floor(r() * state.tuning.offerSize), Math.floor(r() * state.board.length)],
  },
  naive: {
    about: 'the first offer, filling the board in reading order, then replacing from the top: not reading the rules',
    pick: (state) => {
      const empty = state.board.indexOf(null);
      const n = state.level * state.tuning.turnsPerLevel + state.turn;
      return [0, empty >= 0 ? empty : n % state.board.length];
    },
  },
  filler: {
    about: 'the best immediate gain, but onto an empty tile while there is one: reads the previews, never throws a piece away early',
    pick: (state) => {
      const [m] = moves(state, { emptyOnly: true });
      return [m.o, m.i];
    },
  },
  greedy: {
    about: 'the best immediate gain over every offer and tile: a careful player with no plan',
    pick: (state) => {
      const [m] = moves(state);
      return [m.o, m.i];
    },
  },
  planner: {
    about: 'greedy, but weighs its best few moves by what the board would then let any piece in the run add next turn',
    pick: (state) => {
      const top = moves(state).slice(0, 4);
      if (state.turn === state.tuning.turnsPerLevel - 1) return [top[0].o, top[0].i]; // the level is judged now
      let best = null;
      for (const m of top) {
        const board = state.board.slice();
        board[m.i] = m.id;
        const value = m.d + 0.5 * outlook(board, state);
        if (!best || value > best.value) best = { ...m, value };
      }
      return [best.o, best.i];
    },
  },
};
