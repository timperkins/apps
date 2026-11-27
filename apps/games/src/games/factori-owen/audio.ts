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

export function setMuted(m: boolean) {
  muted = m;
}
export function isMuted() {
  return muted;
}

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
  const s = a.createBufferSource();
  s.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  const g = a.createGain();
  g.gain.value = vol;
  s.connect(f).connect(g).connect(a.destination);
  s.start();
}

export const sfx = {
  place: () => { tone(180, 0.12, 'square', 0.06, -60); noise(0.08, 0.15, 900); },
  pickup: () => tone(520, 0.1, 'triangle', 0.08, 220),
  mine: () => noise(0.07, 0.25, 1400 + Math.random() * 600),
  chop: () => noise(0.09, 0.3, 500 + Math.random() * 200),
  craft: () => { tone(660, 0.07, 'triangle', 0.06); tone(990, 0.09, 'triangle', 0.05, 0, 0.06); },
  click: () => tone(880, 0.04, 'square', 0.03),
  error: () => tone(140, 0.18, 'sawtooth', 0.05, -40),
  rotate: () => tone(400, 0.05, 'square', 0.03, 120),
  research: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, 'triangle', 0.07, 0, i * 0.12)),
  shot: () => { noise(0.05, 0.12, 2500); tone(220, 0.05, 'square', 0.02, -100); },
  reload: () => { noise(0.04, 0.12, 3000); tone(300, 0.05, 'square', 0.03, -60); tone(420, 0.04, 'square', 0.035, 0, 1.25); tone(620, 0.05, 'square', 0.04, 0, 1.35); },
  laser: () => tone(1400, 0.12, 'sawtooth', 0.025, -900),
  rail: () => { tone(1800, 0.4, 'sawtooth', 0.05, -1600); noise(0.3, 0.25, 600); },
  hurt: () => tone(200, 0.12, 'sawtooth', 0.06, -80),
  boom: () => { noise(0.5, 0.5, 180); tone(90, 0.4, 'sine', 0.12, -50); },
  alarm: () => [0, 1, 2].forEach((i) => tone(660, 0.18, 'square', 0.04, -200, i * 0.25)),
  launch: () => { noise(2.5, 0.35, 160); tone(70, 2.5, 'sawtooth', 0.06, 120); },
  flame: () => noise(0.08, 0.1, 700),
  rocket: () => { noise(0.25, 0.2, 900); tone(300, 0.25, 'sawtooth', 0.03, 400); },
  catch: () => tone(760, 0.08, 'triangle', 0.04, -200),
  win: () => [392, 523, 659, 784, 659, 784, 1046].forEach((f, i) => tone(f, 0.35, 'triangle', 0.08, 0, i * 0.15)),
};
