// Tiny made-up sound effects (Web Audio beeps and noise), no files needed.
import type { Sound } from './game';

let ctx: AudioContext | null = null;
let muted = false;
try {
  muted = localStorage.getItem('north-pole-muted') === '1';
} catch {
  /* private mode */
}

export const isMuted = () => muted;
export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem('north-pole-muted', m ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function unlockAudio() {
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0, delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol: number, freq: number) {
  if (!ctx) return;
  const t = ctx.currentTime;
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

export function play(s: Sound) {
  if (muted || !ctx) return;
  const now = performance.now();
  if ((last[s] ?? 0) > now - 50) return;
  last[s] = now;
  switch (s) {
    case 'chop':
      noise(0.08, 0.5, 900);
      tone(180, 0.08, 'square', 0.05);
      break;
    case 'fall':
      noise(0.4, 0.4, 300);
      tone(140, 0.4, 'triangle', 0.12, -90);
      break;
    case 'shoot':
      noise(0.06, 0.25, 2500);
      tone(700, 0.08, 'triangle', 0.06, -400);
      break;
    case 'hit':
      tone(220, 0.08, 'square', 0.06, -80);
      break;
    case 'growl':
      tone(110, 0.35, 'sawtooth', 0.08, -50);
      break;
    case 'hurt':
      tone(300, 0.18, 'sawtooth', 0.08, -200);
      break;
    case 'coin':
      tone(990, 0.08, 'square', 0.05);
      tone(1320, 0.18, 'square', 0.05, 0, 0.08);
      break;
    case 'place':
      tone(260, 0.06, 'triangle', 0.12);
      noise(0.05, 0.2, 600);
      break;
    case 'pop':
      tone(600, 0.06, 'sine', 0.1, 300);
      break;
    case 'base':
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'triangle', 0.1, 0, i * 0.12));
      break;
    case 'wave':
      tone(150, 0.6, 'sawtooth', 0.08, -60);
      tone(155, 0.6, 'sawtooth', 0.06, -60, 0.15);
      break;
    case 'heal':
      [660, 880, 1100].forEach((f, i) => tone(f, 0.18, 'sine', 0.1, 0, i * 0.08));
      break;
    case 'no':
      tone(160, 0.15, 'square', 0.05);
      break;
  }
}
