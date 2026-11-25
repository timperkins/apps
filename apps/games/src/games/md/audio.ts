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

export const isMuted = () => muted;
export const setMuted = (m: boolean) => {
  muted = m;
};

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
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
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

let last: Record<string, number> = {};
export function sfx(name: string) {
  const now = performance.now();
  if (now - (last[name] ?? 0) < 45) return;
  last[name] = now;
  switch (name) {
    case 'swing': noise(0.12, 0.25, 2200, 'bandpass'); break;
    case 'slam': noise(0.3, 0.5, 300); tone(80, 0.3, 'sine', 0.3, -40); break;
    case 'hit': tone(220, 0.08, 'square', 0.08, -120); noise(0.06, 0.2, 900); break;
    case 'kill': tone(330, 0.12, 'square', 0.07, -200); noise(0.15, 0.25, 600); break;
    case 'bossdie': tone(110, 0.8, 'sawtooth', 0.15, -80); noise(0.8, 0.4, 400); break;
    case 'hurt': tone(160, 0.18, 'sawtooth', 0.12, -90); break;
    case 'die': tone(300, 0.9, 'triangle', 0.18, -250); break;
    case 'bow': noise(0.08, 0.2, 3000, 'highpass'); tone(500, 0.06, 'triangle', 0.05, -200); break;
    case 'cast': tone(600, 0.18, 'sine', 0.06, 300); break;
    case 'bite': noise(0.08, 0.25, 1200); break;
    case 'roll': noise(0.18, 0.15, 500); break;
    case 'coin': tone(988, 0.06, 'square', 0.05); tone(1319, 0.1, 'square', 0.05, 0, 0.05); break;
    case 'pickup': tone(660, 0.1, 'triangle', 0.08, 220); break;
    case 'drink': tone(400, 0.25, 'sine', 0.1, 400); break;
    case 'crate': noise(0.2, 0.35, 900); break;
    case 'chest': [523, 659, 784].forEach((f, i) => tone(f, 0.18, 'triangle', 0.08, 0, i * 0.08)); break;
    case 'buy': [784, 988].forEach((f, i) => tone(f, 0.12, 'square', 0.05, 0, i * 0.07)); break;
    case 'portal': tone(220, 0.6, 'sine', 0.12, 440); tone(330, 0.6, 'sine', 0.08, 660, 0.05); break;
    case 'win': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.1, 0, i * 0.12)); break;
    case 'roar': tone(90, 0.7, 'sawtooth', 0.15, 40); noise(0.6, 0.25, 300); break;
    case 'throw': noise(0.1, 0.15, 1500); break;
    case 'boom': noise(0.6, 0.6, 250); tone(60, 0.5, 'sine', 0.35, -20); break;
    case 'click': tone(700, 0.04, 'square', 0.04); break;
  }
}
