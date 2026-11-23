// Tiny synthesized sound effects (no audio files).
let ctx: AudioContext | null = null;
let muted = false;

export function unlockAudio() {
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

export function setMuted(m: boolean) {
  muted = m;
}

export function isMuted() {
  return muted;
}

const last: Record<string, number> = {};

function tone(freq: number, dur: number, type: OscillatorType, vol = 0.15, slide = 0, delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol = 0.2, freq = 800) {
  if (!ctx) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(ctx.destination);
  src.start();
}

export function sfx(name: string) {
  if (!ctx || muted) return;
  const now = performance.now();
  if (last[name] && now - last[name] < 60) return;
  last[name] = now;
  switch (name) {
    case 'jump':
      tone(330, 0.15, 'square', 0.05, 330);
      break;
    case 'swing':
      noise(0.08, 0.06, 2000);
      break;
    case 'punch':
      noise(0.12, 0.3, 600);
      tone(120, 0.1, 'square', 0.08, -60);
      break;
    case 'hurt':
      tone(300, 0.18, 'sawtooth', 0.08, -180);
      break;
    case 'coin':
      tone(988, 0.08, 'square', 0.06);
      tone(1319, 0.15, 'square', 0.06, 0, 0.07);
      break;
    case 'cash':
      [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.12, 'square', 0.06, 0, i * 0.06));
      break;
    case 'crash':
      noise(0.25, 0.35, 900);
      break;
    case 'boom':
      noise(0.5, 0.45, 400);
      tone(80, 0.4, 'sine', 0.25, -50);
      break;
    case 'cannon':
      noise(0.3, 0.35, 500);
      break;
    case 'laser':
      tone(1400, 0.15, 'sawtooth', 0.05, -900);
      break;
    case 'flame':
      noise(0.2, 0.08, 1500);
      break;
    case 'throw':
      tone(500, 0.2, 'sine', 0.05, 300);
      break;
    case 'siren':
      tone(700, 0.25, 'square', 0.04, 300);
      tone(1000, 0.25, 'square', 0.04, -300, 0.25);
      break;
    case 'alarm':
      for (let i = 0; i < 4; i++) tone(i % 2 ? 660 : 880, 0.18, 'square', 0.05, 0, i * 0.2);
      break;
    case 'door':
      tone(220, 0.08, 'triangle', 0.1);
      tone(180, 0.1, 'triangle', 0.1, 0, 0.08);
      break;
    case 'unlock':
      tone(1200, 0.05, 'square', 0.06);
      tone(900, 0.08, 'square', 0.06, 0, 0.06);
      break;
    case 'vent':
      noise(0.2, 0.15, 3000);
      tone(400, 0.12, 'square', 0.04, -200);
      break;
    case 'lift':
      tone(300, 0.3, 'triangle', 0.08, 300);
      break;
    case 'horn':
      tone(440, 0.25, 'square', 0.06);
      tone(554, 0.25, 'square', 0.06);
      break;
    case 'cloth':
      noise(0.15, 0.1, 2500);
      break;
    case 'splash':
      noise(0.4, 0.2, 1200);
      break;
    case 'busted':
      [523, 392, 330, 262].forEach((f, i) => tone(f, 0.25, 'square', 0.06, 0, i * 0.18));
      break;
  }
}
