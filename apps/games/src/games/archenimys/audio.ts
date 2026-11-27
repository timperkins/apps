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

export const isMuted = () => muted;
export const setMuted = (m: boolean) => {
  muted = m;
};

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
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol: number, freq: number, type: BiquadFilterType = 'lowpass') {
  const a = ac();
  if (!a) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = a.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(a.destination);
  src.start();
}

const last: Record<string, number> = {};
export function sfx(name: string) {
  const now = performance.now();
  // don't stack the same sound too often
  if (now - (last[name] ?? 0) < 45) return;
  last[name] = now;
  switch (name) {
    case 'shoot':
      tone(520, 0.08, 'triangle', 0.06, -260);
      noise(0.05, 0.05, 3000, 'highpass');
      break;
    case 'boom':
      noise(0.5, 0.35, 500);
      tone(90, 0.4, 'sine', 0.25, -50);
      break;
    case 'pop':
      tone(300, 0.1, 'square', 0.05, 300);
      break;
    case 'hurt':
      tone(180, 0.15, 'sawtooth', 0.08, -80);
      break;
    case 'thorns':
      noise(0.12, 0.08, 2500, 'bandpass');
      break;
    case 'spit':
      tone(140, 0.18, 'sine', 0.1, 120);
      break;
    case 'splat':
      noise(0.18, 0.12, 700);
      break;
    case 'fuse':
      noise(0.5, 0.05, 5000, 'highpass');
      break;
    case 'pinch':
      tone(1200, 0.04, 'square', 0.05);
      tone(900, 0.04, 'square', 0.05, 0, 0.05);
      break;
    case 'dash':
      noise(0.15, 0.06, 1200, 'bandpass');
      break;
    case 'level':
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, 'triangle', 0.08, 0, i * 0.07));
      break;
    case 'upgrade':
      [784, 988, 1175].forEach((f, i) => tone(f, 0.2, 'sine', 0.08, 0, i * 0.06));
      break;
    case 'reveal':
      tone(660, 0.05, 'square', 0.03);
      break;
    case 'chest':
      [392, 523, 659, 784].forEach((f, i) => tone(f, 0.22, 'triangle', 0.09, 0, i * 0.08));
      break;
    case 'heal':
      tone(440, 0.3, 'sine', 0.09, 440);
      break;
    case 'stage':
      [330, 440, 554].forEach((f, i) => tone(f, 0.25, 'triangle', 0.08, 0, i * 0.12));
      break;
    case 'clear':
      [523, 784].forEach((f, i) => tone(f, 0.3, 'triangle', 0.08, 0, i * 0.15));
      break;
    case 'die':
      tone(300, 0.5, 'sawtooth', 0.08, -240);
      break;
    case 'bossdie':
      noise(0.9, 0.3, 400);
      [262, 330, 392, 523].forEach((f, i) => tone(f, 0.35, 'triangle', 0.1, 0, 0.3 + i * 0.12));
      break;
    case 'phoenix':
      [523, 784, 1046, 1568].forEach((f, i) => tone(f, 0.25, 'sine', 0.09, 0, i * 0.06));
      break;
    case 'over':
      [392, 330, 262, 196].forEach((f, i) => tone(f, 0.4, 'triangle', 0.09, 0, i * 0.22));
      break;
    case 'win':
      [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone(f, 0.3, 'triangle', 0.09, 0, i * 0.13));
      break;
    case 'thud':
      tone(120, 0.06, 'sine', 0.05);
      break;
    case 'zap':
      noise(0.2, 0.15, 3000, 'highpass');
      tone(900, 0.15, 'sawtooth', 0.05, -700);
      break;
    case 'rain':
      noise(0.15, 0.05, 2500, 'bandpass');
      break;
    case 'enchant':
      [880, 1175, 1568].forEach((f, i) => tone(f, 0.18, 'sine', 0.05, 0, i * 0.05));
      break;
    case 'block':
      tone(1500, 0.05, 'square', 0.04);
      noise(0.06, 0.06, 4000, 'highpass');
      break;
    case 'shieldbreak':
      noise(0.3, 0.15, 900);
      break;
    case 'swing':
      noise(0.12, 0.08, 1800, 'bandpass');
      break;
    case 'bite':
      tone(220, 0.06, 'square', 0.05, -80);
      break;
    case 'click':
      tone(800, 0.04, 'square', 0.03);
      break;
  }
}
