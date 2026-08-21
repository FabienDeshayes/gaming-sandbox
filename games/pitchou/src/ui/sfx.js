// Every sound in the game, synthesised through WebAudio.
//
// Nothing is loaded: no asset files, no CDN, no build step — the same reason
// the sprites are text. A storm is mostly noise and low tones anyway, which is
// cheap to make and expensive to ship as a file.
//
// Everything here is best-effort. A browser that blocks or lacks audio must
// cost the player nothing, so every call is wrapped and a failure is dropped
// silently and permanently.

import { getAudio } from '../config.js';

let ctx = null;
let broken = false;
let noiseBuffer = null;
let wind = null; // { source, filter, gain }

function audio() {
  if (ctx || broken) return ctx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) {
    broken = true;
    return null;
  }
  try {
    ctx = new Ctor();
  } catch (e) {
    broken = true;
  }
  return ctx;
}

// Live only when the player has asked for sound and the context is actually
// running — an autoplay-suspended context would queue notes that all fire at
// once the moment it opens.
function live() {
  if (!getAudio()) return null;
  const a = audio();
  return a && a.state === 'running' ? a : null;
}

// Autoplay policy: a context created before the player has touched anything
// starts suspended and stays silent. Called from every input the game handles,
// so the first tap is what opens it.
export function unlockAudio() {
  if (!getAudio()) return;
  const a = audio();
  if (a && a.state === 'suspended') a.resume().catch(() => {});
}

// One second of white noise, generated once and looped. This is the sea.
function noise(a) {
  if (noiseBuffer) return noiseBuffer;
  const buf = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noiseBuffer = buf;
  return buf;
}

// A single tone with a fast attack and an exponential tail, so it reads as a
// blip rather than a beep.
function tone(a, { freq, at, duration, peak = 0.06, type = 'triangle', slideTo = null }) {
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, at + duration);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(gain);
  gain.connect(a.destination);
  osc.start(at);
  osc.stop(at + duration + 0.02);
}

// A burst of filtered noise — water, gravel, anything that isn't pitched.
function burst(a, { at, duration, cutoff = 1200, peak = 0.12, sweepTo = null, type = 'lowpass' }) {
  const src = a.createBufferSource();
  src.buffer = noise(a);
  src.loop = true;
  const filter = a.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(cutoff, at);
  if (sweepTo !== null) filter.frequency.exponentialRampToValueAtTime(sweepTo, at + duration);
  const gain = a.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(a.destination);
  src.start(at);
  src.stop(at + duration + 0.02);
}

function safely(fn) {
  const a = live();
  if (!a) return;
  try {
    fn(a, a.currentTime);
  } catch (e) {
    /* a blip is never worth taking the game down for */
  }
}

// --- one-shots --------------------------------------------------------------

// Reaching into the surf: a short wet scuff, before you know what you got.
export function playDraw() {
  safely((a, now) => burst(a, { at: now, duration: 0.07, cutoff: 900, peak: 0.05 }));
}

// What you pulled out. Pitched per resource, so which meter just got fed is
// audible without reading the basket.
const GAIN_FREQ = { oil: 784, wood: 588, plank: 660 };

export function playGain(resource, amount = 1) {
  safely((a, now) => {
    const base = GAIN_FREQ[resource] || 660;
    tone(a, { freq: base, at: now, duration: 0.1, peak: 0.05 });
    // A doubled token is worth two notes — a tool paying off should sound like
    // it paid off.
    if (amount > 1) tone(a, { freq: base * 1.5, at: now + 0.07, duration: 0.11, peak: 0.05 });
  });
}

// A fall that costs you something but doesn't end the night: a slap and a low
// thud, the sound of going down on wet rock.
export function playFall() {
  safely((a, now) => {
    burst(a, { at: now, duration: 0.3, cutoff: 2400, sweepTo: 300, peak: 0.16 });
    tone(a, { freq: 150, at: now, duration: 0.22, peak: 0.1, type: 'sine', slideTo: 60 });
  });
}

// The fall that ends the night. Longer, and it takes the pitch down with it.
export function playBust() {
  safely((a, now) => {
    burst(a, { at: now, duration: 0.9, cutoff: 3000, sweepTo: 200, peak: 0.2 });
    tone(a, { freq: 220, at: now, duration: 0.7, peak: 0.12, type: 'sawtooth', slideTo: 55 });
  });
}

// Pouring a stack into its meter.
export function playPour() {
  safely((a, now) => {
    burst(a, { at: now, duration: 0.35, cutoff: 400, sweepTo: 1400, peak: 0.07 });
  });
}

// Two hammer blows: a tool going up.
export function playBuild() {
  safely((a, now) => {
    for (const at of [now, now + 0.13]) {
      tone(a, { freq: 320, at, duration: 0.12, peak: 0.09, type: 'square', slideTo: 180 });
      burst(a, { at, duration: 0.08, cutoff: 3000, peak: 0.07, type: 'highpass' });
    }
  });
}

export function playWin() {
  safely((a, now) => {
    [523, 659, 784, 1046].forEach((freq, i) =>
      tone(a, { freq, at: now + i * 0.13, duration: 0.28, peak: 0.07 })
    );
  });
}

export function playLose() {
  safely((a, now) => {
    [392, 330, 262, 196].forEach((freq, i) =>
      tone(a, { freq, at: now + i * 0.18, duration: 0.42, peak: 0.07, type: 'sine' })
    );
  });
}

// --- the wind ---------------------------------------------------------------
//
// One looping noise source under a lowpass, held open for the whole run. The
// shore picks up another fall on a fixed schedule (DESIGN.md §3C), so the drone
// opens up as the season goes — the squeeze is audible before it is arithmetic.

const WIND_LEVELS = [
  { cutoff: 260, gain: 0.018 },
  { cutoff: 380, gain: 0.028 },
  { cutoff: 520, gain: 0.038 },
  { cutoff: 700, gain: 0.05 },
];

export function startWind() {
  if (wind) return;
  const a = live();
  if (!a) return;
  try {
    const source = a.createBufferSource();
    source.buffer = noise(a);
    source.loop = true;
    const filter = a.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = WIND_LEVELS[0].cutoff;
    const gain = a.createGain();
    gain.gain.value = 0;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(a.destination);
    source.start();
    wind = { source, filter, gain };
    setWindLevel(0);
  } catch (e) {
    wind = null;
  }
}

// `level` is how many extra falls the shore has picked up so far, 0-3.
export function setWindLevel(level) {
  if (!wind) return;
  const a = live();
  if (!a) return;
  const step = WIND_LEVELS[Math.max(0, Math.min(WIND_LEVELS.length - 1, level))];
  try {
    wind.filter.frequency.linearRampToValueAtTime(step.cutoff, a.currentTime + 1.5);
    wind.gain.gain.linearRampToValueAtTime(step.gain, a.currentTime + 1.5);
  } catch (e) {
    /* the wind just stays where it was */
  }
}

export function stopWind() {
  if (!wind) return;
  try {
    wind.gain.gain.value = 0;
    wind.source.stop();
  } catch (e) {
    /* already gone */
  }
  wind = null;
}
