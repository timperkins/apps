/** Tiny synthesized sound effects, no asset files. */
let ctx: AudioContext | null = null;

export function unlockAudio() {
  if (ctx) return;
  try {
    ctx = new AudioContext();
  } catch {
    ctx = null;
  }
}

function now() {
  return ctx!.currentTime;
}

export function chop() {
  if (!ctx) return;
  const len = 0.09;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 900 + Math.random() * 300;
  const g = ctx.createGain();
  g.gain.value = 0.5;
  src.connect(f).connect(g).connect(ctx.destination);
  src.start();

  const o = ctx.createOscillator();
  const og = ctx.createGain();
  o.frequency.setValueAtTime(180, now());
  o.frequency.exponentialRampToValueAtTime(70, now() + 0.08);
  og.gain.setValueAtTime(0.35, now());
  og.gain.exponentialRampToValueAtTime(0.001, now() + 0.1);
  o.connect(og).connect(ctx.destination);
  o.start();
  o.stop(now() + 0.11);
}

function blip(freq: number, at: number, dur: number, vol: number, type: OscillatorType = 'sine') {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, now() + at);
  g.gain.exponentialRampToValueAtTime(vol, now() + at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now() + at + dur);
  o.connect(g).connect(ctx.destination);
  o.start(now() + at);
  o.stop(now() + at + dur + 0.02);
}

export function pop() {
  blip(520 + Math.random() * 80, 0, 0.06, 0.12, 'triangle');
}

export function coin() {
  blip(988, 0, 0.08, 0.15);
  blip(1319, 0.06, 0.16, 0.15);
}

export function timber() {
  blip(140, 0, 0.25, 0.25, 'triangle');
  blip(90, 0.08, 0.3, 0.2, 'triangle');
}

export function upgrade() {
  blip(523, 0, 0.12, 0.15, 'triangle');
  blip(659, 0.09, 0.12, 0.15, 'triangle');
  blip(784, 0.18, 0.25, 0.18, 'triangle');
}

export function growl() {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(110, now());
  o.frequency.linearRampToValueAtTime(70, now() + 0.4);
  g.gain.setValueAtTime(0.0001, now());
  g.gain.exponentialRampToValueAtTime(0.12, now() + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, now() + 0.45);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 500;
  o.connect(f).connect(g).connect(ctx.destination);
  o.start();
  o.stop(now() + 0.5);
}

export function howl() {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(380, now());
  o.frequency.linearRampToValueAtTime(620, now() + 0.5);
  o.frequency.linearRampToValueAtTime(420, now() + 1.3);
  g.gain.setValueAtTime(0.0001, now());
  g.gain.exponentialRampToValueAtTime(0.1, now() + 0.2);
  g.gain.exponentialRampToValueAtTime(0.0001, now() + 1.4);
  o.connect(g).connect(ctx.destination);
  o.start();
  o.stop(now() + 1.5);
}
