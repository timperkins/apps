// Synthesised sound effects, plus the music tracks (mp3s in public/music).

let ac: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

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
  resumeMusic();
}

export function setMuted(m: boolean) {
  muted = m;
  if (master && ac) master.gain.setTargetAtTime(m ? 0 : 0.5, ac.currentTime, 0.05);
  for (const a of Object.values(tracks)) a.muted = m;
}

// ---------------------------------------------------------------- music

export type Track = 'main' | 'loop' | 'hall' | 'manor';
const TRACK_FILES: Record<Track, string> = {
  main: 'music/main-theme.mp3', // "Escape Mansion 3": opening, level 50 and the getaway
  loop: 'music/mansion-escape-2.mp3', // "Mansion Escape2": after level 5, on a loop
  hall: 'music/levels-15-25.mp3',
  manor: 'music/levels-26-36.mp3',
};
const tracks: Partial<Record<Track, HTMLAudioElement>> = {};
const missing = new Set<Track>();
let current: Track | null = null;
const MUSIC_VOL = 0.55;

function el(t: Track): HTMLAudioElement {
  let a = tracks[t];
  if (!a) {
    a = new Audio(TRACK_FILES[t]);
    a.loop = true;
    a.preload = 'auto';
    a.volume = 0;
    a.muted = muted;
    a.addEventListener('error', () => {
      // a track that isn't in the build yet falls back to the loop theme
      missing.add(t);
      if (current === t) {
        current = null;
        playMusic('loop');
      }
    });
    tracks[t] = a;
  }
  return a;
}

function fade(a: HTMLAudioElement, to: number, ms: number, done?: () => void) {
  const from = a.volume;
  const start = performance.now();
  const step = () => {
    const k = Math.min(1, (performance.now() - start) / ms);
    a.volume = Math.max(0, Math.min(1, from + (to - from) * k));
    if (k < 1) requestAnimationFrame(step);
    else done?.();
  };
  step();
}

/**
 * Crossfades to a track. Restarting the same track does nothing, so the main
 * theme carries on from the title through the opening dialogue and levels 1-5.
 * Resolves false when the browser blocked playback until a tap.
 */
export function playMusic(t: Track): Promise<boolean> {
  if (missing.has(t)) t = 'loop';
  if (current === t) {
    const a = el(t);
    return a.paused ? a.play().then(() => true, () => false) : Promise.resolve(true);
  }
  const old = current ? tracks[current] : null;
  current = t;
  if (old) fade(old, 0, 900, () => old.pause());
  const a = el(t);
  a.currentTime = 0;
  fade(a, MUSIC_VOL, 1200);
  return a.play().then(() => true, () => false);
}

export function stopMusic() {
  if (!current) return;
  const old = tracks[current];
  current = null;
  if (old) fade(old, 0, 700, () => old.pause());
}

export function pauseMusic() {
  if (current) tracks[current]?.pause();
}

/** Resume after the tab comes back or audio unlocks. */
export function resumeMusic() {
  if (current) {
    const a = el(current);
    if (a.paused) void a.play().catch(() => {});
  }
}

export function trackForLevel(level: number): Track {
  if (level <= 5 || level >= 50) return 'main';
  if (level >= 15 && level <= 25) return 'hall';
  if (level >= 26 && level <= 36) return 'manor';
  return 'loop';
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
    case 'whoosh':
      noise(1.2, 0.35, 400, 0.6, 0, 'lowpass');
      noise(0.8, 0.2, 1200, 0.5, 0.2);
      break;
    case 'engine':
      tone(55, 0.9, 'sawtooth', 0.18, 60);
      tone(82, 0.9, 'sawtooth', 0.1, 90, 0.1);
      break;
    case 'horn':
      tone(392, 0.35, 'square', 0.12);
      tone(494, 0.35, 'square', 0.1);
      break;
    case 'gate':
      noise(0.5, 0.4, 900, 0.8);
      tone(180, 0.5, 'square', 0.2, -100);
      tone(1400, 0.4, 'triangle', 0.08, -600, 0.05);
      break;
    case 'intercom':
      tone(660, 0.12, 'sine', 0.12);
      tone(880, 0.18, 'sine', 0.12, 0, 0.13);
      noise(0.4, 0.04, 3000, 0.5, 0.3);
      break;
    case 'clang':
      tone(1800, 0.35, 'triangle', 0.14, -300);
      tone(2650, 0.3, 'sine', 0.08, -200);
      noise(0.06, 0.25, 5000, 3);
      break;
    case 'click':
      tone(800, 0.04, 'square', 0.1);
      break;
    case 'blip':
      tone(300 + Math.random() * 60, 0.03, 'square', 0.04);
      break;
  }
}
