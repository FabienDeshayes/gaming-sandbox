// The Ninth Guest: pure rules and story data (no Phaser). Plain script in the
// browser (window.NG), require()-able from node for tests.
(function (root) {
  const HOURS = ['6 pm', '7 pm', '8 pm', '9 pm', '10 pm', '11 pm'];
  const ROOMS = ['Library', 'Study', 'Hall', 'Dining Room', 'Conservatory'];
  const GUESTS = ['Reyes', 'Calloway', 'Hart', 'Finch'];
  const FULL = { Reyes: 'Dr. Reyes', Calloway: 'Miss Calloway', Hart: 'Colonel Hart', Finch: 'Mr. Finch', Host: 'the Host' };
  const NIGHTS = 6;
  const ACTIONS = 6; // one per hour

  // Default schedule: [room, activity] per hour.
  const SCHEDULE = {
    Host: [['Hall', 'greets the guests'], ['Dining Room', 'carves the roast'], ['Study', 'argues back, furious'], ['Conservatory', 'tends his orchids'], ['Hall', 'winds the grandfather clock'], [null, 'pours his nightly brandy']],
    Reyes: [['Hall', 'chats by the fire'], ['Dining Room', 'eats'], ['Dining Room', 'lingers over dessert'], ['Library', 'reads a medical journal'], ['Conservatory', 'smokes a pipe'], ['Library', 'dozes in an armchair']],
    Calloway: [['Hall', 'admires the portraits'], ['Dining Room', 'eats'], ['Conservatory', 'walks among the plants'], ['Library', 'browses the shelves'], ['Study', 'searches the desk for her letter'], ['Hall', 'waits for her carriage']],
    Hart: [['Hall', 'tells a long war story'], ['Dining Room', 'eats'], ['Study', 'argues with the Host about money'], ['Hall', 'paces, red-faced'], ['Library', 'plays solitaire'], ['Conservatory', 'sulks']],
    Finch: [['Hall', 'smiles politely'], ['Library', 'reads a book on poisonous plants'], ['Conservatory', 'examines the foxgloves closely'], ['Dining Room', 'fiddles with something in his pocket'], [null, 'goes to the decanter'], ['Library', 'reads, very calm']],
  };

  // Movable objects: where they start, where you can move them, and what
  // that predictably changes (shown to the player before they commit).
  const OBJECTS = {
    letter: { name: "Calloway's letter", short: 'the letter', from: 'Study', to: 'Library', effect: "Calloway is in the Library at 9 pm. If the letter is there by then, she finds it and stays in the Library at 10 pm instead of searching the Study." },
    decanter: { name: 'Brandy decanter', short: 'the decanter', from: 'Study', to: 'Dining Room', effect: 'Whoever goes to the decanter goes to the room it is in. The Host drinks from it at 11 pm, wherever it is.' },
  };

  const ANSWERS = {
    Reyes: 'Poison, if anything happens tonight, would go in his brandy. He takes one glass at eleven, never earlier.',
    Calloway: "I left a private letter in the Study desk. I'll fetch it at ten, unless it turns up somewhere first. I'm in the Library at nine.",
    Hart: 'Yes, we quarrelled at eight. I never went back to the Study after that. Ask anyone.',
    Finch: 'Me? I spent the whole evening in the Library, mostly.',
  };

  function newGame() {
    return { night: 1, hour: 0, moved: {}, poisoned: false, notes: [], status: 'play', nightOver: false, lastResult: null };
  }
  function clone(s) { return JSON.parse(JSON.stringify(s)); }

  // Room of an object at the start of hour h (a move at hour m counts from m+1).
  function objectRoom(s, obj, h) {
    const m = s.moved[obj];
    return m !== undefined && m < h ? OBJECTS[obj].to : OBJECTS[obj].from;
  }

  function whereAt(s, who, h) {
    if (who === 'Calloway' && h === 4 && objectRoom(s, 'letter', 3) === 'Library') return ['Library', 're-reads her letter, relieved'];
    if (who === 'Calloway' && h === 3 && objectRoom(s, 'letter', 3) === 'Library') return ['Library', 'finds her letter on a shelf'];
    if (who === 'Finch' && h === 4) return [objectRoom(s, 'decanter', 4), SCHEDULE.Finch[4][1]];
    if (who === 'Host' && h === 5) return [objectRoom(s, 'decanter', 5), SCHEDULE.Host[5][1]];
    return SCHEDULE[who][h];
  }

  function peopleIn(s, room, h) {
    return ['Host'].concat(GUESTS).filter((w) => whereAt(s, w, h)[0] === room);
  }

  // Everything you see while spending hour h in a room.
  function observe(s, room, h) {
    const here = peopleIn(s, room, h);
    const lines = [];
    let proof = null;
    const finchPoisoning = h === 4 && here.includes('Finch');
    if (finchPoisoning) {
      const others = here.filter((w) => w !== 'Finch' && w !== 'Host');
      if (others.length === 0) {
        lines.push('Mr. Finch, alone, empties a small vial into the brandy decanter.');
        proof = 'Finch';
      } else {
        lines.push('Mr. Finch and ' + others.map((o) => FULL[o]).join(' and ') + ' are both by the decanter. In the lamplight you cannot tell who touched it.');
      }
    }
    for (const w of here) {
      if (finchPoisoning && w !== 'Host') continue;
      lines.push(cap(FULL[w]) + ' ' + whereAt(s, w, h)[1] + '.');
    }
    if (here.length === 0) lines.push('Nobody is here.');
    if (objectRoom(s, 'decanter', h) === room) {
      lines.push(h < 4 ? 'The brandy decanter looks clear.' : h === 4 ? '' : 'The brandy smells faintly bitter.');
    }
    if (objectRoom(s, 'letter', h) === room && room === 'Study' && h < 4) lines.push('A sealed letter sits in the desk drawer.');
    return { here, text: lines.filter(Boolean).join(' '), proof };
  }

  function cap(t) { return t.charAt(0).toUpperCase() + t.slice(1); }

  function addNote(s, room, h, obs, extra) {
    const altered = Object.keys(s.moved).some((o) => s.moved[o] < h);
    const note = { night: s.night, hour: h, room, here: obs.here, text: (extra ? extra + ' ' : '') + obs.text, proof: obs.proof, altered };
    s.notes.push(note);
    return note;
  }

  // Action previews (what will happen, before committing).
  function preview(s, a) {
    const h = HOURS[s.hour];
    if (a.kind === 'watch') return 'Spend ' + h + ' in the ' + a.room + '. You note everyone there and what they do.';
    if (a.kind === 'ask') return 'Find ' + FULL[a.guest] + ' at ' + h + ' and ask about tonight. You also note the room and who is there.';
    if (a.kind === 'move') {
      const o = OBJECTS[a.obj];
      if (s.moved[a.obj] !== undefined) return o.name + ' is already moved tonight.';
      return 'Go to the ' + o.from + ' at ' + h + ' and move ' + o.short + ' to the ' + o.to + ' (in place from ' + (HOURS[s.hour + 1] || 'midnight') + '). ' + o.effect;
    }
    return '';
  }

  function canDo(s, a) {
    if (s.status !== 'play' || s.nightOver) return false;
    if (a.kind === 'move') return s.moved[a.obj] === undefined;
    return true;
  }

  function act(s0, a) {
    if (!canDo(s0, a)) return null;
    const s = clone(s0);
    const h = s.hour;
    let note;
    if (a.kind === 'watch') {
      note = addNote(s, a.room, h, observe(s, a.room, h));
    } else if (a.kind === 'ask') {
      const room = whereAt(s, a.guest, h)[0];
      note = addNote(s, room, h, observe(s, room, h), FULL[a.guest].replace(/^./, (c) => c.toUpperCase()) + ' says: "' + ANSWERS[a.guest] + '"');
    } else if (a.kind === 'move') {
      const o = OBJECTS[a.obj];
      note = addNote(s, o.from, h, observe(s, o.from, h));
      s.moved[a.obj] = h;
      note.text += ' You move ' + o.short + ' to the ' + o.to + '.';
    }
    s.lastResult = note;
    s.hour++;
    if (s.hour >= ACTIONS) endNight(s);
    return s;
  }

  function endNight(s) {
    s.nightOver = true;
    const room = objectRoom(s, 'decanter', 5);
    s.midnight = 'Midnight. A scream from the ' + room + ': the Host is dead, his brandy glass beside him. The clock strikes twelve...';
    if (s.night >= NIGHTS) { s.status = 'lost'; s.midnight += '\nThe loop closes for good. The killer walks free.'; }
  }

  function nextNight(s0) {
    const s = clone(s0);
    if (s.status !== 'play') return s;
    s.night++;
    s.hour = 0;
    s.moved = {};
    s.nightOver = false;
    s.lastResult = null;
    s.midnight = null;
    return s;
  }

  // Accuse a guest using one notebook entry (by index) as proof.
  function accuse(s0, guest, noteIndex) {
    const s = clone(s0);
    const n = s.notes[noteIndex];
    if (n && n.proof === guest) {
      s.status = 'won';
      s.verdict = FULL[guest] + ' poisoned the brandy at 10 pm, and your notebook shows it. The loop is broken.';
      return s;
    }
    s.verdict = 'The others are not convinced: that entry does not show ' + FULL[guest] + ' poisoning the brandy. The evening dissolves...';
    if (s.night >= NIGHTS) { s.status = 'lost'; s.midnight = s.verdict + '\nThe loop closes for good.'; return s; }
    s.nightOver = true;
    s.midnight = s.verdict;
    return s;
  }

  // Latest observed room per (person, hour) for the notebook grid.
  function knownGrid(s) {
    const grid = {};
    for (const w of ['Host'].concat(GUESTS)) grid[w] = HOURS.map(() => null);
    for (const n of s.notes) for (const w of n.here) grid[w][n.hour] = { room: n.room, altered: n.altered };
    return grid;
  }

  const api = { HOURS, ROOMS, GUESTS, FULL, NIGHTS, ACTIONS, OBJECTS, newGame, objectRoom, whereAt, peopleIn, observe, preview, canDo, act, nextNight, accuse, knownGrid };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NG = api;
})(typeof window !== 'undefined' ? window : this);
