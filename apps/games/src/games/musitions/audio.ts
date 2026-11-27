// Musitions sounds: every note is made with Web Audio, no sound files.
import { laneSemis } from './game';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
try { muted = localStorage.getItem('musitions-muted') === '1'; } catch { /* private mode */ }

export type Instrument = 'bells' | 'piano' | 'flute' | 'robot';
export const INSTRUMENTS: { id: Instrument; name: string }[] = [
  { id: 'bells', name: '🔔 Bells' },
  { id: 'piano', name: '🎹 Piano' },
  { id: 'flute', name: '🪈 Flute' },
  { id: 'robot', name: '🤖 Robot' },
];

export const isMuted = () => muted;
export function setMuted(m: boolean) {
  muted = m;
  try { localStorage.setItem('musitions-muted', m ? '1' : '0'); } catch { /* ignore */ }
  if (master && ctx) master.gain.setValueAtTime(m ? 0 : 0.6, ctx.currentTime);
}

export function unlockAudio() {
  if (!ctx) {
    try { ctx = new AudioContext(); } catch { return; }
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.6;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

const LOW_C = 261.63; // middle C is the lowest lane
export const laneFreq = (lane: number) => LOW_C * Math.pow(2, laneSemis(lane) / 12);

function osc(type: OscillatorType, freq: number, t: number, dur: number, vol: number, attack = 0.005, dest?: AudioNode) {
  if (!ctx || !master) return null;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest ?? master);
  o.start(t);
  o.stop(t + dur + 0.05);
  return o;
}

export function playNote(lane: number, inst: Instrument, len = 0.5) {
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  const f = laneFreq(lane);
  if (inst === 'bells') {
    osc('sine', f, t, 1.4, 0.35);
    osc('sine', f * 2, t, 0.6, 0.12);
    osc('sine', f * 3.01, t, 0.3, 0.05);
  } else if (inst === 'piano') {
    osc('triangle', f, t, 0.9, 0.35);
    osc('sine', f * 2, t, 0.4, 0.1);
    osc('square', f, t, 0.08, 0.03);
  } else if (inst === 'flute') {
    const o = osc('sine', f, t, Math.max(0.35, len), 0.3, 0.06);
    osc('triangle', f * 2, t, Math.max(0.3, len * 0.8), 0.04, 0.08);
    if (o && ctx) {
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 5.5; lg.gain.value = f * 0.008;
      lfo.connect(lg).connect(o.frequency);
      lfo.start(t); lfo.stop(t + len + 0.1);
    }
  } else {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(f * 6, t);
    lp.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.3);
    lp.connect(master);
    osc('square', f, t, 0.35, 0.12, 0.005, lp);
    osc('sawtooth', f * 1.005, t, 0.35, 0.06, 0.005, lp);
  }
}

export function boing() {
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(620, t + 0.18);
  o.frequency.exponentialRampToValueAtTime(300, t + 0.35);
  g.gain.setValueAtTime(0.25, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + 0.45);
}

export function thump() {
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  const len = 0.08;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
  const s = ctx.createBufferSource(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 900;
  g.gain.value = 0.25;
  s.buffer = buf;
  s.connect(lp).connect(g).connect(master);
  s.start(t);
}

export function fanfare(stars: number) {
  if (!ctx) return;
  const lanes = stars >= 4 ? [0, 2, 4, 7, 9, 11, 14] : stars >= 2 ? [0, 4, 7, 11] : [4, 2, 0];
  lanes.forEach((l, i) => setTimeout(() => playNote(l, 'bells'), i * 110));
}
