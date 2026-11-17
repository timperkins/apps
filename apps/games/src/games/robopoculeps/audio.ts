// Small synthesized sound effects (no audio files).
let ctx: AudioContext | null = null;
let muted = false;

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

export const setMuted = (m: boolean) => void (muted = m);
export const isMuted = () => muted;

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
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol: number, freq: number) {
  const a = ac();
  if (!a) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = freq;
  const g = a.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(a.destination);
  src.start();
}

export function sfx(name: string) {
  switch (name) {
    case 'tink':
      tone(1400 + Math.random() * 300, 0.07, 'square', 0.05);
      noise(0.05, 0.08, 3000);
      break;
    case 'crumble':
      noise(0.35, 0.25, 700);
      break;
    case 'coin':
      tone(1320, 0.06, 'square', 0.04);
      tone(1760, 0.1, 'square', 0.04, 0, 0.05);
      break;
    case 'cash':
      for (let i = 0; i < 4; i++) tone(1100 + i * 220, 0.08, 'triangle', 0.08, 0, i * 0.06);
      break;
    case 'buy':
      tone(520, 0.08, 'triangle', 0.1);
      tone(780, 0.14, 'triangle', 0.1, 0, 0.08);
      break;
    case 'place':
      tone(260, 0.07, 'square', 0.06, -80);
      break;
    case 'pick':
      tone(600, 0.06, 'triangle', 0.08, 300);
      break;
    case 'click':
      tone(900, 0.03, 'square', 0.04);
      break;
    case 'boom':
      noise(1.2, 0.6, 400);
      tone(90, 0.8, 'sawtooth', 0.2, -50);
      break;
    case 'nope':
      tone(200, 0.12, 'square', 0.05, -60);
      break;
    case 'win':
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.25, 'triangle', 0.1, 0, i * 0.12));
      break;
  }
}
