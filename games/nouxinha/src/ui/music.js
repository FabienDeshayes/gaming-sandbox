// The music: two loops, synthesised rather than loaded — one under the walk and
// a smaller one for the screens either side of it.
//
// Same rule as the sprites and the blips (DESIGN.md §9): no audio assets, no
// build step, and the "art" diffs in git. So the score is text below and the
// instruments are square waves through a low-pass — the audio equivalent of the
// two-colour rule, with the filter doing what alpha does for the remembered
// state: taking the edge off without adding a third thing.
//
// Which loop is playing follows the scene: the menus get `menu`, an expedition
// gets `explore`, and each scene asks for its own on create. Asking for the one
// already playing is a no-op, so walking title → slots → settings never
// restarts the tune; asking for the other one crossfades.
//
// Everything here is best-effort. A browser that blocks or lacks audio, and a
// context the autoplay policy has not opened yet, both cost the player nothing:
// the scheduler simply finds no clock to write to and waits for the next tick.

import { audioContext, audioOut } from './sfx.js';
import { getMusic } from '../config.js';

// --- The scores --------------------------------------------------------------
//
// Each step is either a semitone offset from the phrase's root or '.', a rest.
// Most of them are rests, because a loop has to survive being heard for an
// hour: what it is doing is marking time in a place where nothing else does,
// and a tune would start competing with the pickup blips, which are the sounds
// that actually mean something.
//
// Both scores are A minor pentatonic, so the menus and the dark are the same
// place; what separates them is pace, register and how much of the loop is
// silence.

// Eight phrases, about half a minute end to end. The roots walk
// A A F G A E F G and land back on A, so the loop closes rather than just
// stopping, and the phrase you hear at the far end of an expedition is the
// phrase you set out on. The second half opens the melody an octave up and
// leans on the lower roots, which is the variety a loop this long needs to not
// announce its own seam.
const EXPLORE_PHRASES = [
  { root: 0, steps: '0 . . 7 . . 3 .' },
  { root: 0, steps: '. 5 . . 3 . . 0' },
  { root: -4, steps: '. . 8 . 3 . . .' },
  { root: -2, steps: '5 . . 3 . . 2 .' },
  { root: 0, steps: '12 . . 10 . 7 . .' },
  { root: -5, steps: '. 7 . . 12 . . 5' },
  { root: -4, steps: '3 . . . 8 . 10 .' },
  { root: -2, steps: '. . 5 . . 3 . 0' },
];

// The menus: three phrases, slower, higher and thinner — a single-octave drone
// instead of two, and a long release on every note. It is the same key as the
// dark heard from indoors, and it is short on purpose, because nobody is meant
// to be on the title screen long enough to learn it.
const MENU_PHRASES = [
  { root: 0, steps: '. 12 . 10 . . 7 .' },
  { root: 5, steps: '. . 10 . 7 . 3 .' },
  { root: 0, steps: '. 7 . . 12 . . .' },
];

const STEPS_PER_PHRASE = 8;

const TRACKS = {
  // A step is about two walked tiles at a comfortable pace, so the music never
  // feels like it is counting the player's steps for them.
  explore: {
    phrases: EXPLORE_PHRASES,
    stepSeconds: 0.46,
    melodyHz: 220, // A3
    droneHz: 55, // two octaves under it
    droneOctaves: [0, 12],
    melodyCutoff: 1400,
    droneCutoff: 240,
    release: 0.42,
    // Quieter than the pickup blip (0.06), and by enough that a blip lands on
    // top of the loop rather than in it — the blip is information, the loop is
    // weather. Both are lifted together by the master gain in ui/sfx.js.
    gain: 0.05,
  },
  menu: {
    phrases: MENU_PHRASES,
    stepSeconds: 0.62,
    melodyHz: 330, // E4: a fifth above the walk, so it reads as a lighter room
    droneHz: 55,
    droneOctaves: [0],
    melodyCutoff: 1000,
    droneCutoff: 180,
    release: 0.8,
    gain: 0.038,
  },
};

const MELODY_PEAK = 0.5;
const DRONE_PEAK = 0.42;

// The lookahead scheduler. WebAudio can only be told about a note in advance,
// and a timer can't be trusted to fire on the beat, so the timer runs much
// faster than the music and each wake-up writes whatever falls inside the
// window. Standard practice, and it is what keeps the loop steady while the
// main thread is busy repainting a viewport.
const TICK_MS = 200;
const LOOKAHEAD = 1.2;

const hz = (base, semitones) => base * Math.pow(2, semitones / 12);

let timer = null;
let master = null;
let track = null;
let trackId = null;
let nextStepAt = 0;
let step = 0;

const phraseSeconds = () => track.stepSeconds * STEPS_PER_PHRASE;

// One melody note: a square through a low-pass, struck hard and let go, so it
// reads as a pluck rather than a beep. How quickly it is let go is the track's
// own — the walk plucks, the menu rings.
function pluck(a, freq, at) {
  const osc = a.createOscillator();
  const gain = a.createGain();
  const tone = a.createBiquadFilter();
  osc.type = 'square';
  osc.frequency.setValueAtTime(freq, at);
  tone.type = 'lowpass';
  tone.frequency.setValueAtTime(track.melodyCutoff, at);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(MELODY_PEAK, at + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + track.release);
  osc.connect(tone);
  tone.connect(gain);
  gain.connect(master);
  osc.start(at);
  osc.stop(at + track.release + 0.08);
}

// The drone under a phrase: one or two squares an octave apart, filtered down
// to almost nothing but the fundamental, faded in and out slowly enough that
// one phrase dissolves into the next instead of restarting.
function drone(a, root, at) {
  const span = phraseSeconds();
  const gain = a.createGain();
  const tone = a.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.setValueAtTime(track.droneCutoff, at);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(DRONE_PEAK, at + 0.9);
  gain.gain.setValueAtTime(DRONE_PEAK, at + span - 0.9);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + span);
  tone.connect(gain);
  gain.connect(master);

  for (const octave of track.droneOctaves) {
    const osc = a.createOscillator();
    osc.type = 'square';
    // A couple of cents apart, which is what stops two square waves at the same
    // pitch from sounding like one thin one.
    osc.frequency.setValueAtTime(hz(track.droneHz, root + octave) * (octave ? 1.003 : 1), at);
    osc.connect(tone);
    osc.start(at);
    osc.stop(at + span + 0.1);
  }
}

function scheduleStep(a, index, at) {
  const phrases = track.phrases;
  const phrase = phrases[Math.floor(index / STEPS_PER_PHRASE) % phrases.length];
  const beat = index % STEPS_PER_PHRASE;
  if (beat === 0) drone(a, phrase.root, at);
  const token = phrase.steps.split(' ')[beat];
  if (token !== '.') pluck(a, hz(track.melodyHz, phrase.root + Number(token)), at);
}

function tick() {
  const a = audioContext();
  if (!a || !master) return stopMusic();
  // A context the player hasn't opened yet has a frozen clock, so there is
  // nothing to schedule against — pick the beat up wherever it resumes.
  if (a.state !== 'running') {
    nextStepAt = 0;
    return;
  }
  try {
    if (!nextStepAt) nextStepAt = a.currentTime + 0.1;
    while (nextStepAt < a.currentTime + LOOKAHEAD) {
      scheduleStep(a, step, nextStepAt);
      step += 1;
      nextStepAt += track.stepSeconds;
    }
  } catch (e) {
    // A loop is never worth taking the game down for.
    stopMusic();
  }
}

// Idempotent, and safe to call before the player has touched anything: the
// scheduler will find the clock frozen and simply wait. Which is why every
// input that unlocks the audio calls this too — the first tap of a run is
// usually the one that gets the music going.
export function startMusic(id = 'explore') {
  if (!TRACKS[id] || !getMusic()) return;
  if (timer && trackId === id) return;
  // The other loop is still playing, so it is faded out from under this one.
  if (timer) stopMusic();
  const a = audioContext();
  const out = audioOut();
  if (!a || !out) return;
  try {
    track = TRACKS[id];
    trackId = id;
    master = a.createGain();
    master.gain.setValueAtTime(track.gain, a.currentTime);
    master.connect(out);
    // The phrase always starts at the top, so a run opens on the same bar.
    step = 0;
    nextStepAt = 0;
    timer = setInterval(tick, TICK_MS);
    tick();
  } catch (e) {
    stopMusic();
  }
}

export function stopMusic() {
  if (timer) clearInterval(timer);
  timer = null;
  trackId = null;
  // Notes already scheduled are still coming, so the output is faded out rather
  // than cut — and the node is left connected until they have all played.
  const a = audioContext();
  if (master && a) {
    try {
      master.gain.cancelScheduledValues(a.currentTime);
      master.gain.setValueAtTime(master.gain.value, a.currentTime);
      master.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.35);
      const dying = master;
      setTimeout(() => {
        try {
          dying.disconnect();
        } catch (e) {
          /* already gone */
        }
      }, 1500);
    } catch (e) {
      /* nothing left to fade */
    }
  }
  master = null;
}

export function isMusicPlaying() {
  return !!timer;
}

// Which of the two loops is running, or null. The suite reads this: a headless
// browser can't be asked to listen, but it can be asked what is playing.
export function musicTrack() {
  return trackId;
}
