// The music: a slow loop under the walk, synthesised rather than loaded.
//
// Same rule as the sprites and the blips (DESIGN.md §9): no binary assets, no
// build step, and the "art" diffs in git. So the score is text below and the
// instruments are square waves through a low-pass — the audio equivalent of the
// two-colour rule, with the filter doing what alpha does for the remembered
// state: taking the edge off without adding a third thing.
//
// It plays under the expedition and nowhere else. The title screen and the
// menus are quiet on purpose, so starting a run is when the dark gets a sound.
//
// Everything here is best-effort. A browser that blocks or lacks audio, and a
// context the autoplay policy has not opened yet, both cost the player nothing:
// the scheduler simply finds no clock to write to and waits for the next tick.

import { audioContext } from './sfx.js';
import { getMusic } from '../config.js';

// --- The score ---------------------------------------------------------------
//
// Four phrases of eight steps, in A minor pentatonic. Each step is either a
// semitone offset from the root or '.', a rest — and most of them are rests,
// because the loop has to survive being heard for an hour. What it is doing is
// marking time in a place where nothing else does; a tune would start competing
// with the pickup blips, which are the sounds that actually mean something.
//
// The roots walk A - A - F - G and land back on A, so the loop closes rather
// than just stopping, and the phrase you hear at the far end of an expedition
// is the phrase you set out on.

const PHRASES = [
  { root: 0, steps: '0 . . 7 . . 3 .' },
  { root: 0, steps: '. 5 . . 3 . . 0' },
  { root: -4, steps: '. . 8 . 3 . . .' },
  { root: -2, steps: '5 . . 3 . . 2 .' },
];

const STEPS_PER_PHRASE = 8;

// Slow: a step is about two walked tiles at a comfortable pace, so the music
// never feels like it is counting the player's steps for them.
const STEP_SECONDS = 0.46;
const PHRASE_SECONDS = STEP_SECONDS * STEPS_PER_PHRASE;

// A3 for the melody, two octaves down for the drone.
const MELODY_HZ = 220;
const DRONE_HZ = 55;

// Quieter than the pickup blip (0.06), and by enough that a blip lands on top
// of the loop rather than in it — the blip is information, the loop is weather.
const MASTER_GAIN = 0.05;
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
let nextStepAt = 0;
let step = 0;

// One melody note: a square through a low-pass, struck hard and let go quickly,
// so it reads as a pluck rather than a beep.
function pluck(a, freq, at) {
  const osc = a.createOscillator();
  const gain = a.createGain();
  const tone = a.createBiquadFilter();
  osc.type = 'square';
  osc.frequency.setValueAtTime(freq, at);
  tone.type = 'lowpass';
  tone.frequency.setValueAtTime(1400, at);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(MELODY_PEAK, at + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.42);
  osc.connect(tone);
  tone.connect(gain);
  gain.connect(master);
  osc.start(at);
  osc.stop(at + 0.5);
}

// The drone under a phrase: two squares an octave apart, filtered down to
// almost nothing but the fundamental, faded in and out slowly enough that one
// phrase dissolves into the next instead of restarting.
function drone(a, root, at) {
  const gain = a.createGain();
  const tone = a.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.setValueAtTime(240, at);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(DRONE_PEAK, at + 0.9);
  gain.gain.setValueAtTime(DRONE_PEAK, at + PHRASE_SECONDS - 0.9);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + PHRASE_SECONDS);
  tone.connect(gain);
  gain.connect(master);

  for (const octave of [0, 12]) {
    const osc = a.createOscillator();
    osc.type = 'square';
    // A couple of cents apart, which is what stops two square waves at the same
    // pitch from sounding like one thin one.
    osc.frequency.setValueAtTime(hz(DRONE_HZ, root + octave) * (octave ? 1.003 : 1), at);
    osc.connect(tone);
    osc.start(at);
    osc.stop(at + PHRASE_SECONDS + 0.1);
  }
}

function scheduleStep(a, index, at) {
  const phrase = PHRASES[Math.floor(index / STEPS_PER_PHRASE) % PHRASES.length];
  const beat = index % STEPS_PER_PHRASE;
  if (beat === 0) drone(a, phrase.root, at);
  const token = phrase.steps.split(' ')[beat];
  if (token !== '.') pluck(a, hz(MELODY_HZ, phrase.root + Number(token)), at);
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
      nextStepAt += STEP_SECONDS;
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
export function startMusic() {
  if (timer || !getMusic()) return;
  const a = audioContext();
  if (!a) return;
  try {
    master = a.createGain();
    master.gain.setValueAtTime(MASTER_GAIN, a.currentTime);
    master.connect(a.destination);
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
