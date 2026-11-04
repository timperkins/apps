import type { Fx } from './core/sim';

/** Small synthesized sound effects, so the game needs no audio files. */
let ctx: AudioContext | null = null;
let muted = false;

export function unlockAudio(): void {
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

export function setMuted(m: boolean): void {
  muted = m;
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0): void {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur);
}

function noise(dur: number, vol: number, freq = 1200): void {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
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

export function playEvents(evs: Fx[], myId: number): void {
  let hits = 0;
  for (const ev of evs) {
    switch (ev.t) {
      case 'hit':
        if (hits++ < 2) {
          noise(0.12, ev.big ? 0.5 : 0.3, ev.big ? 500 : 900);
          tone(ev.big ? 110 : 160, 0.12, 'square', 0.08, 0.5);
        }
        break;
      case 'swing':
        if (ev.id === myId) noise(0.08, 0.12, 2400);
        break;
      case 'throw':
        noise(0.15, 0.1, 1800);
        break;
      case 'ko':
        tone(300, 0.35, 'sawtooth', 0.06, 0.3);
        break;
      case 'pickup':
        if (ev.id === myId) {
          tone(660, 0.08, 'triangle', 0.12);
          setTimeout(() => tone(990, 0.1, 'triangle', 0.12), 70);
        }
        break;
      case 'heal':
        tone(520, 0.1, 'sine', 0.15, 2);
        break;
      case 'revive':
        [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.12, 'triangle', 0.12), i * 90));
        break;
      case 'whistle':
        tone(2400, 0.5, 'square', 0.04, 1.05);
        break;
      case 'splat':
        noise(0.1, 0.2, 400);
        break;
      case 'section':
      case 'go':
        tone(440, 0.1, 'square', 0.06);
        setTimeout(() => tone(660, 0.15, 'square', 0.06), 100);
        break;
      case 'won':
        [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.2, 'square', 0.07), i * 140));
        break;
      case 'lost':
        [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'triangle', 0.1), i * 200));
        break;
    }
  }
}
