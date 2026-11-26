// Little made-up sound effects (Web Audio), no sound files.
import type { Sound } from './game';

let ctx: AudioContext | null = null;
let muted = false;
try { muted = localStorage.getItem('tiny-kingdoms-muted') === '1'; } catch { /* private mode */ }

export const isMuted = () => muted;
export function setMuted(m: boolean) {
  muted = m;
  try { localStorage.setItem('tiny-kingdoms-muted', m ? '1' : '0'); } catch { /* ignore */ }
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

const last: Partial<Record<Sound, number>> = {};

/** `vol` is 0–1, smaller for things far from the camera. */
export function play(s: Sound, vol = 1) {
  if (muted || !ctx || vol <= 0.05) return;
  const now = performance.now();
  if ((last[s] ?? 0) > now - 70) return;
  last[s] = now;
  const v = vol;
  switch (s) {
    case 'swing': noise(0.1, 0.25 * v, 1800); break;
    case 'hit': noise(0.06, 0.35 * v, 700); tone(200, 0.07, 'square', 0.04 * v, -80); break;
    case 'bow': noise(0.05, 0.2 * v, 2600); tone(650, 0.07, 'triangle', 0.04 * v, -350); break;
    case 'chop': noise(0.07, 0.4 * v, 900); tone(170, 0.07, 'square', 0.04 * v); break;
    case 'mine': tone(1200, 0.05, 'square', 0.04 * v); noise(0.05, 0.3 * v, 3000); break;
    case 'coin': tone(990, 0.06, 'square', 0.03 * v); tone(1320, 0.12, 'square', 0.03 * v, 0, 0.06); break;
    case 'build': noise(0.2, 0.4 * v, 400); [392, 523, 659].forEach((f, i) => tone(f, 0.14, 'triangle', 0.08 * v, 0, 0.1 + i * 0.08)); break;
    case 'train': tone(523, 0.1, 'triangle', 0.08 * v); tone(784, 0.16, 'triangle', 0.08 * v, 0, 0.09); break;
    case 'boom': noise(0.7, 0.7 * v, 160); tone(90, 0.6, 'sawtooth', 0.1 * v, -50); break;
    case 'heal': [660, 880, 1100].forEach((f, i) => tone(f, 0.16, 'sine', 0.06 * v, 0, i * 0.07)); break;
    case 'baa': tone(420, 0.25, 'sawtooth', 0.04 * v, -60); break;
    case 'hurt': tone(300, 0.16, 'sawtooth', 0.07 * v, -180); break;
    case 'horn': tone(147, 0.9, 'sawtooth', 0.09, -10); tone(220, 0.9, 'sawtooth', 0.05, -15, 0.05); break;
    case 'win': [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.3, 'triangle', 0.1, 0, i * 0.13)); break;
    case 'lose': [392, 330, 262, 196].forEach((f, i) => tone(f, 0.4, 'triangle', 0.1, 0, i * 0.2)); break;
    case 'no': tone(160, 0.14, 'square', 0.05); break;
  }
}
