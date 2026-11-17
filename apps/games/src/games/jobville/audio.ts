// Jobville: small synthesized sound effects (no audio files).
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

export const setMuted = (m: boolean) => (muted = m);
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

export const sfx = {
  coin: () => {
    tone(988, 0.08, 'square', 0.05);
    tone(1319, 0.18, 'square', 0.05, 0, 0.07);
  },
  chop: () => tone(180, 0.09, 'triangle', 0.15, -80),
  rock: () => tone(120, 0.08, 'square', 0.08, -40),
  pick: () => tone(660, 0.08, 'sine', 0.1, 200),
  splash: () => tone(400, 0.25, 'sine', 0.08, -300),
  bite: () => {
    tone(880, 0.06, 'square', 0.06);
    tone(880, 0.06, 'square', 0.06, 0, 0.1);
  },
  buy: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, 'triangle', 0.1, 0, i * 0.08)),
  nope: () => tone(200, 0.15, 'sawtooth', 0.05, -60),
  door: () => tone(300, 0.1, 'triangle', 0.08, 150),
  job: () => [392, 523, 659].forEach((f, i) => tone(f, 0.12, 'triangle', 0.1, 0, i * 0.09)),
  win: () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.2, 'triangle', 0.1, 0, i * 0.12)),
};

// Gentle background music: a looping tune made of soft notes.
const TUNE = [0, 4, 7, 9, 7, 4, 2, 4, 0, 4, 7, 12, 9, 7, 4, 2, 5, 9, 12, 9, 7, 4, 2, 0, -1, 2, 4, 7, 4, 2, 0, -1];
const BASS = [0, 0, 5, 5, 7, 7, 0, 0];
let musicTimer = 0;
let musicStep = 0;
export function startMusic() {
  if (musicTimer) return;
  musicTimer = window.setInterval(() => {
    const n = TUNE[musicStep % TUNE.length];
    if (n >= 0 && musicStep % 2 === 0) tone(392 * Math.pow(2, n / 12), 0.42, 'triangle', 0.025);
    if (musicStep % 8 === 0) tone(98 * Math.pow(2, BASS[(musicStep / 8) % BASS.length] / 12), 0.9, 'sine', 0.04);
    musicStep++;
  }, 230);
}
export function stopMusic() {
  clearInterval(musicTimer);
  musicTimer = 0;
}
