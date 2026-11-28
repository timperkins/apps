// Tiny synthesised sound effects and a creepy ambient drone. No audio files.

let ac: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let drone: { stop: () => void } | null = null;

export function unlockAudio() {
  if (!ac) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    ac = new Ctx();
    master = ac.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ac.destination);
  }
  if (ac.state === 'suspended') void ac.resume();
}

export function setMuted(m: boolean) {
  muted = m;
  if (master && ac) master.gain.setTargetAtTime(m ? 0 : 0.5, ac.currentTime, 0.05);
}
export const isMuted = () => muted;

function tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.2, slide = 0, delay = 0) {
  if (!ac || !master) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol = 0.2, freq = 1200, q = 1, delay = 0, type: BiquadFilterType = 'bandpass') {
  if (!ac || !master) return;
  const t = ac.currentTime + delay;
  const len = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

export function sfx(name: string) {
  if (!ac || muted) return;
  switch (name) {
    case 'pickup':
      tone(660, 0.07, 'square', 0.12);
      tone(990, 0.09, 'square', 0.12, 0, 0.06);
      break;
    case 'throw':
      noise(0.15, 0.15, 900, 2);
      break;
    case 'bonk':
      tone(220, 0.15, 'square', 0.25, -150);
      noise(0.08, 0.25, 600, 1);
      tone(1200, 0.25, 'sine', 0.1, 400, 0.08);
      break;
    case 'yelp':
      tone(900, 0.2, 'sawtooth', 0.15, 600);
      break;
    case 'clack':
      noise(0.06, 0.3, 2500, 3);
      noise(0.05, 0.2, 1800, 3, 0.09);
      break;
    case 'glass':
      noise(0.35, 0.3, 4500, 2);
      tone(2400, 0.2, 'triangle', 0.08, 300);
      tone(3100, 0.25, 'triangle', 0.06, -200, 0.04);
      break;
    case 'splat':
      noise(0.15, 0.3, 300, 1, 0, 'lowpass');
      break;
    case 'toy':
      tone(1500, 0.04, 'square', 0.08);
      tone(1300, 0.04, 'square', 0.08, 0, 0.12);
      break;
    case 'smoke':
      noise(0.8, 0.25, 500, 0.5, 0, 'lowpass');
      break;
    case 'hurt':
      tone(300, 0.25, 'sawtooth', 0.2, -200);
      break;
    case 'alarm':
      for (let i = 0; i < 3; i++) {
        tone(880, 0.14, 'square', 0.14, 0, i * 0.3);
        tone(660, 0.14, 'square', 0.14, 0, i * 0.3 + 0.15);
      }
      break;
    case 'spotted':
      tone(500, 0.08, 'square', 0.18);
      tone(1000, 0.18, 'square', 0.18, 0, 0.08);
      break;
    case 'bark':
      noise(0.1, 0.35, 700, 2);
      tone(260, 0.1, 'sawtooth', 0.18, -80);
      noise(0.1, 0.3, 700, 2, 0.16);
      tone(240, 0.1, 'sawtooth', 0.15, -80, 0.16);
      break;
    case 'spike':
      noise(0.07, 0.15, 3500, 4);
      break;
    case 'heal':
      [523, 659, 784].forEach((f, i) => tone(f, 0.12, 'triangle', 0.15, 0, i * 0.07));
      break;
    case 'jeff':
      tone(110, 0.9, 'sawtooth', 0.12, -30);
      tone(116, 0.9, 'sawtooth', 0.1, -30);
      tone(55, 1.1, 'sine', 0.25);
      break;
    case 'poof':
      noise(0.3, 0.2, 800, 0.7);
      break;
    case 'caught':
      [392, 370, 349, 262].forEach((f, i) => tone(f, 0.25, 'square', 0.15, 0, i * 0.18));
      break;
    case 'complete':
      [392, 494, 587, 784].forEach((f, i) => tone(f, 0.18, 'square', 0.14, 0, i * 0.1));
      break;
    case 'levelup':
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.16, 'triangle', 0.16, 0, i * 0.08));
      break;
    case 'click':
      tone(800, 0.04, 'square', 0.1);
      break;
    case 'blip':
      tone(300 + Math.random() * 60, 0.03, 'square', 0.04);
      break;
  }
}

/** Low droning ambience; the pitch drops in the dungeon and lifts outside. */
export function startDrone(section: number) {
  stopDrone();
  if (!ac || !master) return;
  const g = ac.createGain();
  g.gain.value = 0;
  g.gain.setTargetAtTime(0.05, ac.currentTime, 1.5);
  g.connect(master);
  const base = [41.2, 43.65, 49, 55, 46.25, 51.9, 43.65, 58.3, 61.7, 55][section] ?? 49;
  const oscs = [base, base * 1.5, base * 2.02].map((f, i) => {
    const o = ac!.createOscillator();
    o.type = i === 0 ? 'sawtooth' : 'sine';
    o.frequency.value = f;
    const lfo = ac!.createOscillator();
    lfo.frequency.value = 0.07 + i * 0.05;
    const lg = ac!.createGain();
    lg.gain.value = f * 0.01;
    lfo.connect(lg).connect(o.frequency);
    lfo.start();
    const f2 = ac!.createBiquadFilter();
    f2.type = 'lowpass';
    f2.frequency.value = 220;
    o.connect(f2).connect(g);
    o.start();
    return { o, lfo };
  });
  drone = {
    stop: () => {
      if (!ac) return;
      g.gain.setTargetAtTime(0, ac.currentTime, 0.3);
      oscs.forEach(({ o, lfo }) => {
        o.stop(ac!.currentTime + 1.5);
        lfo.stop(ac!.currentTime + 1.5);
      });
    },
  };
}
export function stopDrone() {
  drone?.stop();
  drone = null;
}
