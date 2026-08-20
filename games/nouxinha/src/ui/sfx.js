// The pickup blip, and the AudioContext everything audible in the game shares.
//
// Synthesised through WebAudio rather than loaded as a file, for the same reason
// the sprites are text (DESIGN.md §9) — no binary assets, no build step, and the
// "art" diffs in git. Square waves at that, which is the audio equivalent of the
// two-colour rule.
//
// Everything here is best-effort: a browser that blocks or lacks audio must cost
// the player nothing, so every call is wrapped and a failure is silently dropped.

let ctx = null;
let broken = false;

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

// Autoplay policy: a context created before the player has touched anything
// starts suspended and stays silent. Called from every input the scene handles,
// so the first tap or key press is what opens it.
export function unlockAudio() {
  const a = audio();
  if (a && a.state === 'suspended') a.resume().catch(() => {});
}

// One square-wave note with a fast attack and an exponential tail, so it reads
// as a blip rather than a beep.
function note(a, freq, at, duration, peak) {
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(freq, at);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(gain);
  gain.connect(a.destination);
  osc.start(at);
  osc.stop(at + duration + 0.02);
}

// Rising arpeggios, because everything you can pick up is good news. A coin is
// two notes and a light is three and lands higher — finding a torch is the
// bigger moment, and you can tell which you got without looking at the HUD.
const PICKUP = {
  coin: [880, 1318],
  light: [659, 988, 1318],
};

export function playPickup(itemId) {
  const a = audio();
  if (!a || a.state !== 'running') return;
  const freqs = itemId === 'coin' ? PICKUP.coin : PICKUP.light;
  try {
    const now = a.currentTime;
    freqs.forEach((freq, i) => note(a, freq, now + i * 0.055, 0.09, 0.06));
  } catch (e) {
    /* a blip is never worth taking the game down for */
  }
}
