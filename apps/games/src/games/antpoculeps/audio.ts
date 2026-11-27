// Little synthesized sounds (Web Audio), no files.
let ctx: AudioContext | null = null;
let muted = localStorage.getItem('antpoculeps-muted') === '1';

export const isMuted = () => muted;
export function setMuted(m: boolean) {
  muted = m;
  try { localStorage.setItem('antpoculeps-muted', m ? '1' : '0'); } catch { /* ignore */ }
}

function ac(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    try { ctx = new AudioContext(); } catch { return null; }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0, delay = 0) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol: number, freq: number) {
  const a = ac();
  if (!a) return;
  const n = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = buf;
  f.type = 'bandpass';
  f.frequency.value = freq;
  g.gain.value = vol;
  s.connect(f).connect(g).connect(a.destination);
  s.start();
}

export const sfx = {
  eat: () => tone(520 + Math.random() * 120, 0.07, 'square', 0.05, 1.6),
  meat: () => { tone(220, 0.1, 'square', 0.06, 1.5); tone(330, 0.08, 'square', 0.04, 1.4, 0.06); },
  bite: (big = false) => noise(big ? 0.12 : 0.06, big ? 0.35 : 0.22, big ? 900 : 2200),
  miss: () => noise(0.04, 0.08, 3000),
  hurt: () => tone(180, 0.12, 'sawtooth', 0.06, 0.6),
  kill: () => { noise(0.18, 0.3, 600); tone(300, 0.15, 'triangle', 0.08, 0.5); },
  die: () => { tone(400, 0.5, 'sawtooth', 0.08, 0.25); },
  evolve: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.1, 1, i * 0.08)),
  hatch: () => { noise(0.1, 0.2, 1500); [659, 880].forEach((f, i) => tone(f, 0.15, 'triangle', 0.1, 1, 0.08 + i * 0.09)); },
  rebirth: () => [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, 'sine', 0.12, 1, i * 0.1)),
  join: () => { tone(660, 0.1, 'sine', 0.08); tone(880, 0.12, 'sine', 0.08, 1, 0.1); },
};
