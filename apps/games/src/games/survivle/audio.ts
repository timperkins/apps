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

export const setMuted = (m: boolean) => void (muted = m);
export const isMuted = () => muted;

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

function noise(dur: number, vol: number, freq: number, delay = 0) {
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
  s.start(a.currentTime + delay);
}

export const sfx = {
  swing: () => noise(0.12, 0.18, 2200),
  hit: () => { noise(0.08, 0.3, 700); tone(220, 0.08, 'square', 0.05, -80); },
  chop: () => noise(0.1, 0.35, 450 + Math.random() * 200),
  treeFall: () => { noise(0.35, 0.3, 300); tone(120, 0.3, 'sawtooth', 0.04, -60); },
  bow: () => tone(500, 0.12, 'triangle', 0.07, -300),
  hurt: () => { tone(300, 0.18, 'sawtooth', 0.08, -180); },
  jump: () => tone(330, 0.12, 'triangle', 0.06, 220),
  land: () => noise(0.08, 0.2, 300),
  coin: () => { tone(988, 0.06, 'square', 0.04); tone(1319, 0.12, 'square', 0.04, 0, 0.06); },
  chest: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.07, 0, i * 0.09)); },
  fire: () => noise(0.4, 0.2, 900),
  eat: () => { tone(400, 0.06, 'square', 0.04); tone(500, 0.06, 'square', 0.04, 0, 0.08); },
  enemyDie: () => { tone(500, 0.2, 'square', 0.05, -380); noise(0.15, 0.15, 1200); },
  beastWind: () => tone(90, 0.6, 'sawtooth', 0.06, 60),
  beastBlast: () => { noise(0.6, 0.45, 160); tone(70, 0.6, 'sawtooth', 0.09, -30); },
  orb: () => tone(260, 0.25, 'sine', 0.08, -140),
  slam: () => { noise(0.25, 0.4, 220); tone(110, 0.2, 'square', 0.06, -50); },
  door: () => { noise(0.5, 0.5, 120); tone(60, 0.5, 'square', 0.08, -20); },
  win: () => { [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, 'triangle', 0.08, 0, i * 0.15)); },
  click: () => tone(880, 0.04, 'square', 0.03),
  gloom: () => { tone(55, 2.5, 'sawtooth', 0.05, 30); noise(2, 0.12, 200); },
};
