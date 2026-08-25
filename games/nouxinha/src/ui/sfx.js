// Every sound the game makes that isn't the music loop, and the one
// AudioContext everything audible shares.
//
// Synthesised through WebAudio rather than loaded as files, for the same reason
// the sprites are cut from one sheet (DESIGN.md §9) — no audio assets, no build
// step, and the "score" diffs in git. Square waves at that, which is the audio
// equivalent of the two-colour rule; the only exception is the torch, which
// needs noise because a flame catching is not a pitch.
//
// Everything here is best-effort: a browser that blocks or lacks audio must cost
// the player nothing, so every call is wrapped and a failure is silently dropped.

let ctx = null;
let out = null;
let broken = false;

// Everything the game plays — the blips, the tunes and the music loop — goes
// through this one gain, so the mix stays relative and the game has a single
// volume. It sits above 1 because the whole game was mixed 40% quieter than it
// wanted to be on a phone speaker; the individual peaks below are still the
// numbers that say how loud each sound is *relative to the others*.
const MASTER_VOLUME = 1.4;

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

// The one context, handed out so the music (ui/music.js) plays through the same
// clock and the same output as the blips. A second AudioContext would be a
// second hardware voice on mobile, and some browsers only allow a couple.
export function audioContext() {
  return audio();
}

// The node every voice in the game connects to instead of `destination`.
export function audioOut() {
  const a = audio();
  if (!a) return null;
  if (!out) {
    try {
      out = a.createGain();
      out.gain.setValueAtTime(MASTER_VOLUME, a.currentTime);
      out.connect(a.destination);
    } catch (e) {
      broken = true;
      return null;
    }
  }
  return out;
}

// Autoplay policy: a context created before the player has touched anything
// starts suspended and stays silent. Called from every input the scene handles,
// so the first tap or key press is what opens it.
export function unlockAudio() {
  const a = audio();
  if (a && a.state === 'suspended') a.resume().catch(() => {});
}

// What has been played, in order — there is nothing about a square wave that a
// headless browser can be asked to listen to, so this is how the suite checks a
// tap makes a sound and the D-pad doesn't (TESTING.md). Capped, because a long
// session plays a lot of blips and none of them are worth keeping.
const LOG_MAX = 64;
const log = [];

export function soundLog() {
  return log.slice();
}

// Schedules a sound, or doesn't, and never throws. A context the player hasn't
// opened yet is resumed first and the sound follows it — the tap that unlocks
// the audio is usually a tap that should be heard.
//
// `collapse` is for a sound that fires dozens of times a second and means one
// thing while it does — the typewriter, and only the typewriter. Such a run
// goes into the log as a single entry, so a sentence being read out doesn't
// push every other sound in the run off the end of it.
function play(name, schedule, { collapse = false } = {}) {
  const a = audio();
  const bus = audioOut();
  if (!a || !bus) return;
  const run = () => {
    try {
      schedule(a, bus, a.currentTime);
      if (!collapse || log[log.length - 1] !== name) log.push(name);
      if (log.length > LOG_MAX) log.shift();
    } catch (e) {
      /* a sound is never worth taking the game down for */
    }
  };
  if (a.state === 'running') return run();
  a.resume().then(run, () => {});
}

// One note: a square through a low-pass, with a fast attack and an exponential
// tail, so it reads as a struck thing rather than a beep. `glide` bends the
// pitch across the note, which is what makes the tap a tock and the last note
// of the death tune sag.
function note(a, bus, { freq, at, duration, peak, cutoff = 3000, glide }) {
  const osc = a.createOscillator();
  const gain = a.createGain();
  const tone = a.createBiquadFilter();
  osc.type = 'square';
  osc.frequency.setValueAtTime(freq, at);
  if (glide) osc.frequency.exponentialRampToValueAtTime(glide, at + duration);
  tone.type = 'lowpass';
  tone.frequency.setValueAtTime(cutoff, at);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(tone);
  tone.connect(gain);
  gain.connect(bus);
  osc.start(at);
  osc.stop(at + duration + 0.02);
}

// A burst of noise through a band-pass that sweeps up and falls back — the
// shape of air catching. Built from a buffer rather than an oscillator because
// a flame has no pitch to give it.
function whoosh(a, bus, { at, duration, peak, from, to }) {
  const frames = Math.floor(a.sampleRate * duration);
  const buffer = a.createBuffer(1, frames, a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

  const source = a.createBufferSource();
  source.buffer = buffer;
  const band = a.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.setValueAtTime(1.1, at);
  band.frequency.setValueAtTime(from, at);
  band.frequency.exponentialRampToValueAtTime(to, at + duration * 0.35);
  band.frequency.exponentialRampToValueAtTime(from * 0.7, at + duration);

  const gain = a.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);

  source.connect(band);
  band.connect(gain);
  gain.connect(bus);
  source.start(at);
  source.stop(at + duration + 0.02);
}

// --- The sounds --------------------------------------------------------------

// Every button in the game except the D-pad, which is the one control tapped
// often enough that a sound on it would turn walking into a rattle. Short,
// quiet and pitched down as it goes, so it reads as a tock under whatever the
// button actually did.
export function playTap() {
  play('tap', (a, bus, now) =>
    note(a, bus, { freq: 1046, glide: 740, at: now, duration: 0.05, peak: 0.03, cutoff: 2400 })
  );
}

// The game talking: one blip every couple of characters while the text panel
// types itself out (ui/textPanel.js). Higher, quieter and far shorter than the
// button's tock — at this rate anything with a tail turns into a buzz, and the
// pitch drop across the note is what stops a run of them reading as one held
// tone.
export function playTextBlip() {
  play(
    'text',
    (a, bus, now) =>
      note(a, bus, { freq: 1568, glide: 1244, at: now, duration: 0.022, peak: 0.014, cutoff: 2800 }),
    { collapse: true }
  );
}

// Rising arpeggios, because everything you can pick up is good news. A coin is
// two notes and a light is three and lands higher — finding a torch is the
// bigger moment, and you can tell which you got without looking at the HUD.
const PICKUP = {
  coin: [880, 1318],
  light: [659, 988, 1318],
};

// The gem's own fanfare: the run up, a leading note, and a held chord over a
// bass. A gem is the only pickup that repaints the world, and the only one worth
// a second and a half of everything else being quiet.
const FANFARE = [
  { freq: 523, at: 0, duration: 0.12 },
  { freq: 659, at: 0.11, duration: 0.12 },
  { freq: 784, at: 0.22, duration: 0.12 },
  { freq: 1046, at: 0.33, duration: 0.17 },
  { freq: 988, at: 0.5, duration: 0.12 },
  { freq: 1046, at: 0.61, duration: 0.95 },
];

function playFanfare() {
  play('gem', (a, bus, now) => {
    for (const step of FANFARE) {
      note(a, bus, { ...step, at: now + step.at, peak: 0.075, cutoff: 3600 });
      // The same line an octave down, quietly: two square waves are what turns
      // a blip into a fanfare without adding an instrument.
      note(a, bus, {
        freq: step.freq / 2,
        at: now + step.at,
        duration: step.duration,
        peak: 0.035,
        cutoff: 1600,
      });
    }
    // The bass: the tonic under the run, then a fifth under the held note.
    note(a, bus, { freq: 131, at: now, duration: 0.6, peak: 0.05, cutoff: 500 });
    note(a, bus, { freq: 196, at: now + 0.61, duration: 1.05, peak: 0.05, cutoff: 500 });
    // The third, so the last note lands as a chord rather than a long beep.
    note(a, bus, { freq: 1318, at: now + 0.61, duration: 0.95, peak: 0.04, cutoff: 3600 });
  });
}

export function playPickup(itemId) {
  if (itemId && itemId.startsWith('gem-')) return playFanfare();
  const freqs = itemId === 'coin' ? PICKUP.coin : PICKUP.light;
  play(itemId === 'coin' ? 'coin' : 'pickup', (a, bus, now) => {
    freqs.forEach((freq, i) =>
      note(a, bus, { freq, at: now + i * 0.055, duration: 0.09, peak: 0.06 })
    );
  });
}

// A chest lifting its lid: the creak of it going up, and a small bright figure
// on top of that for what was inside. Noise rather than a tone for the hinge,
// the same reason the torch is noise — a lid has no pitch — and much shorter
// than the gem's fanfare, because a chest is a good moment and a gem is *the*
// moment.
export function playChest() {
  play('chest', (a, bus, now) => {
    whoosh(a, bus, { at: now, duration: 0.3, peak: 0.05, from: 240, to: 900 });
    note(a, bus, { freq: 147, glide: 196, at: now, duration: 0.22, peak: 0.05, cutoff: 600 });
    note(a, bus, { freq: 587, at: now + 0.14, duration: 0.1, peak: 0.05 });
    note(a, bus, { freq: 880, at: now + 0.23, duration: 0.16, peak: 0.05 });
  });
}

// A key turning: two notes a fifth apart with a clack under them, once, as the
// gate gives. Short and mechanical — this is a lock, not a reward, and the
// reward is on the other side of it.
export function playUnlock() {
  play('unlock', (a, bus, now) => {
    note(a, bus, { freq: 196, glide: 131, at: now, duration: 0.07, peak: 0.05, cutoff: 900 });
    note(a, bus, { freq: 784, at: now + 0.06, duration: 0.1, peak: 0.05 });
    note(a, bus, { freq: 1174, at: now + 0.15, duration: 0.2, peak: 0.045 });
  });
}

// A light taking over: the catch of the flame, and the low thump of it settling
// under it. Played whether the player chose the light or the dark chose it for
// them — a torch burning out and the next one lighting is the same event from
// the other side, and it is the moment the screen changes shape.
export function playTorch() {
  play('torch', (a, bus, now) => {
    whoosh(a, bus, { at: now, duration: 0.55, peak: 0.09, from: 320, to: 1900 });
    note(a, bus, { freq: 110, glide: 62, at: now, duration: 0.3, peak: 0.055, cutoff: 400 });
    note(a, bus, { freq: 659, at: now + 0.06, duration: 0.22, peak: 0.03, cutoff: 1800 });
  });
}

// Running dry: three notes falling, then the low one sagging as it goes. The
// only sound in the game that descends, because it is the only thing that
// happens to you rather than for you.
const KNELL = [
  { freq: 440, at: 0, duration: 0.3 },
  { freq: 349, at: 0.24, duration: 0.3 },
  { freq: 262, at: 0.48, duration: 0.36 },
];

export function playDeath() {
  play('death', (a, bus, now) => {
    for (const step of KNELL)
      note(a, bus, { ...step, at: now + step.at, peak: 0.07, cutoff: 1600 });
    note(a, bus, {
      freq: 220,
      glide: 196,
      at: now + 0.8,
      duration: 1.8,
      peak: 0.07,
      cutoff: 700,
    });
    note(a, bus, {
      freq: 110,
      glide: 98,
      at: now + 0.8,
      duration: 2,
      peak: 0.06,
      cutoff: 400,
    });
  });
}
