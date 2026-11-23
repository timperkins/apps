// Small synthesized sounds and a soft music loop (no audio files).
let ctx: AudioContext | null = null;
let muted = false;
let musicOn = false;
let musicTimer = 0;

function ac(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export const isMuted = () => muted;
export function setMuted(m: boolean) {
  muted = m;
  if (m) stopMusic();
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0, delay = 0) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol: number, freq: number, type: BiquadFilterType = 'lowpass') {
  const a = ac();
  if (!a) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = a.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(a.destination);
  src.start();
}

export function sfx(name: string) {
  switch (name) {
    case 'tink':
      tone(900 + Math.random() * 300, 0.05, 'square', 0.025);
      break;
    case 'chop':
      noise(0.18, 0.25, 900);
      tone(180, 0.15, 'triangle', 0.1, -60);
      break;
    case 'break':
      noise(0.22, 0.3, 1600);
      tone(140, 0.18, 'square', 0.05, -50);
      break;
    case 'pop':
      tone(500, 0.1, 'sine', 0.12, 300);
      break;
    case 'place':
      tone(240, 0.08, 'triangle', 0.12);
      noise(0.06, 0.12, 700);
      break;
    case 'craft':
      tone(660, 0.08, 'triangle', 0.1);
      tone(990, 0.12, 'triangle', 0.1, 0, 0.07);
      break;
    case 'swing':
      noise(0.12, 0.18, 2400, 'bandpass');
      break;
    case 'bow':
      tone(300, 0.12, 'triangle', 0.1, 400);
      noise(0.08, 0.1, 3000, 'highpass');
      break;
    case 'hit':
      tone(220, 0.1, 'square', 0.08, -100);
      noise(0.08, 0.2, 1200);
      break;
    case 'die':
      tone(400, 0.3, 'sawtooth', 0.06, -300);
      break;
    case 'ouch':
      tone(300, 0.2, 'sawtooth', 0.1, -150);
      break;
    case 'down':
      tone(400, 0.7, 'triangle', 0.15, -300);
      break;
    case 'eat':
      tone(500, 0.06, 'sine', 0.1);
      tone(700, 0.08, 'sine', 0.1, 0, 0.08);
      break;
    case 'chest':
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, 'triangle', 0.12, 0, i * 0.09));
      break;
    case 'chime':
      [784, 988, 1175].forEach((f, i) => tone(f, 0.5, 'sine', 0.09, 0, i * 0.12));
      break;
    case 'travel':
      tone(300, 0.6, 'sine', 0.12, 900);
      break;
    case 'give':
      tone(440, 0.15, 'triangle', 0.1, 220);
      break;
    case 'lit':
      [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.7, 'triangle', 0.1, 0, i * 0.14));
      noise(1.2, 0.15, 500);
      break;
    case 'win':
      [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.6, 'triangle', 0.12, 0, i * 0.16));
      break;
    case 'spark':
      tone(1200, 0.12, 'square', 0.04, -600);
      break;
    case 'step':
      noise(0.04, 0.04, 500);
      break;
    case 'swim':
      noise(0.15, 0.06, 700);
      break;
    case 'click':
      tone(800, 0.04, 'square', 0.04);
      break;
  }
}

// A slow pentatonic melody over a drone, quieter at night.
const NOTES = [0, 2, 4, 7, 9, 12, 14];
export function startMusic(getNight: () => boolean) {
  if (musicOn) return;
  musicOn = true;
  let step = 0;
  const play = () => {
    if (!musicOn) return;
    const a = ac();
    if (a) {
      const night = getNight();
      const root = night ? 196 : 262;
      if (step % 8 === 0) tone(root / 2, 3.2, 'sine', 0.035);
      if (Math.random() < 0.7) {
        const n = NOTES[Math.floor(Math.random() * NOTES.length)];
        tone(root * Math.pow(2, n / 12), 1.1, 'triangle', night ? 0.02 : 0.03);
      }
      step++;
    }
    musicTimer = window.setTimeout(play, 520);
  };
  play();
}
export function stopMusic() {
  musicOn = false;
  clearTimeout(musicTimer);
}
