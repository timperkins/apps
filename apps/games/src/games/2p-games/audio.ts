// Little made-up sound effects for 2p Games (Web Audio), no sound files.
let ctx: AudioContext | null = null;
let muted = false;
try { muted = localStorage.getItem('2p-muted') === '1'; } catch { /* private mode */ }

export const isMuted = () => muted;
export function setMuted(m: boolean) {
  muted = m;
  try { localStorage.setItem('2p-muted', m ? '1' : '0'); } catch { /* ignore */ }
}

export function unlockAudio() {
  if (!ctx) { try { ctx = new AudioContext(); } catch { return; } }
  if (ctx.state === 'suspended') void ctx.resume();
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0, delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol: number, freq: number, delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(t);
}

export type Sound =
  | 'click' | 'coin' | 'crate' | 'pick' | 'upgrade' | 'no' | 'win' | 'lose'
  | 'swing' | 'hit' | 'bow' | 'heal' | 'build' | 'train' | 'boom' | 'eat' | 'hurt'
  | 'taunt' | 'box' | 'freeze' | 'burn' | 'zap' | 'poison' | 'ghost' | 'horn' | 'heart';

const last: Partial<Record<Sound, number>> = {};

/** `vol` is 0–1, smaller for things far from the camera. */
export function play(s: Sound, vol = 1) {
  if (muted || !ctx || vol <= 0.05) return;
  const now = performance.now();
  if ((last[s] ?? 0) > now - 60) return;
  last[s] = now;
  const v = vol;
  switch (s) {
    case 'click': tone(660, 0.05, 'triangle', 0.05 * v); break;
    case 'coin': tone(990, 0.05, 'square', 0.025 * v); tone(1320, 0.1, 'square', 0.025 * v, 0, 0.05); break;
    case 'crate': noise(0.25, 0.4 * v, 500); [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.14, 'triangle', 0.07 * v, 0, 0.15 + i * 0.07)); break;
    case 'pick': tone(784, 0.1, 'triangle', 0.08 * v); tone(1175, 0.18, 'triangle', 0.08 * v, 0, 0.08); break;
    case 'upgrade': [523, 784, 1046, 1568].forEach((f, i) => tone(f, 0.12, 'square', 0.04 * v, 0, i * 0.06)); break;
    case 'no': tone(160, 0.14, 'square', 0.05 * v); break;
    case 'win': [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.3, 'triangle', 0.1, 0, i * 0.13)); break;
    case 'lose': [392, 330, 262, 196].forEach((f, i) => tone(f, 0.4, 'triangle', 0.1, 0, i * 0.2)); break;
    case 'swing': noise(0.1, 0.25 * v, 1800); break;
    case 'hit': noise(0.06, 0.35 * v, 700); tone(200, 0.07, 'square', 0.04 * v, -80); break;
    case 'bow': noise(0.05, 0.2 * v, 2600); tone(650, 0.07, 'triangle', 0.04 * v, -350); break;
    case 'heal': [660, 880, 1100].forEach((f, i) => tone(f, 0.16, 'sine', 0.06 * v, 0, i * 0.07)); break;
    case 'build': noise(0.2, 0.4 * v, 400); [392, 523, 659].forEach((f, i) => tone(f, 0.14, 'triangle', 0.08 * v, 0, 0.1 + i * 0.08)); break;
    case 'train': tone(523, 0.1, 'triangle', 0.08 * v); tone(784, 0.16, 'triangle', 0.08 * v, 0, 0.09); break;
    case 'boom': noise(0.7, 0.7 * v, 160); tone(90, 0.6, 'sawtooth', 0.1 * v, -50); break;
    case 'eat': [0, 0.12, 0.24].forEach(d => noise(0.07, 0.35 * v, 1400, d)); tone(520, 0.12, 'triangle', 0.06 * v, 200, 0.3); break;
    case 'hurt': tone(300, 0.16, 'sawtooth', 0.07 * v, -180); break;
    case 'taunt': tone(440, 0.12, 'square', 0.05 * v, 220); tone(330, 0.12, 'square', 0.05 * v, 220, 0.14); tone(660, 0.2, 'square', 0.05 * v, -200, 0.28); break;
    case 'box': [880, 660, 990, 1320].forEach((f, i) => tone(f, 0.18, 'sine', 0.08 * v, 0, i * 0.1)); break;
    case 'freeze': tone(1800, 0.25, 'sine', 0.05 * v, -900); noise(0.2, 0.15 * v, 5000); break;
    case 'burn': noise(0.3, 0.3 * v, 300); break;
    case 'zap': tone(1400, 0.08, 'sawtooth', 0.05 * v, -1000); tone(1700, 0.08, 'sawtooth', 0.04 * v, -1200, 0.06); break;
    case 'poison': tone(220, 0.25, 'sine', 0.06 * v, 120); tone(260, 0.2, 'sine', 0.04 * v, 80, 0.1); break;
    case 'ghost': tone(500, 1.2, 'sine', 0.07, -300); tone(510, 1.2, 'sine', 0.05, -310, 0.05); break;
    case 'horn': tone(147, 0.9, 'sawtooth', 0.09, -10); tone(220, 0.9, 'sawtooth', 0.05, -15, 0.05); break;
    case 'heart': tone(70, 0.2, 'sine', 0.2 * v, -20); tone(60, 0.25, 'sine', 0.2 * v, -20, 0.22); break;
  }
}
