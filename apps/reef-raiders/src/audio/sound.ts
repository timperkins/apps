// Short synth blips generated in code; no audio files.
const SOUNDS = {
  eat: { freq: 880, to: 1320, ms: 50, type: 'sine', gain: 0.06 },
  chomp: { freq: 300, to: 140, ms: 160, type: 'square', gain: 0.1 },
  cast: { freq: 900, to: 300, ms: 220, type: 'sine', gain: 0.08 },
  bite: { freq: 520, to: 880, ms: 120, type: 'square', gain: 0.1 },
  catch: { freq: 660, to: 1320, ms: 300, type: 'triangle', gain: 0.14 },
  escape: { freq: 500, to: 200, ms: 260, type: 'sine', gain: 0.1 },
  coin: { freq: 1200, to: 1800, ms: 80, type: 'square', gain: 0.05 },
  ram: { freq: 160, to: 80, ms: 160, type: 'sawtooth', gain: 0.1 },
  sink: { freq: 260, to: 40, ms: 900, type: 'sawtooth', gain: 0.14 },
  pete: { freq: 330, to: 660, ms: 380, type: 'triangle', gain: 0.14 },
  sell: { freq: 990, to: 1480, ms: 70, type: 'square', gain: 0.06 },
  level: { freq: 520, to: 1040, ms: 240, type: 'triangle', gain: 0.1 },
  taunt: { freq: 700, to: 1100, ms: 300, type: 'sine', gain: 0.08 },
  tick: { freq: 520, to: 520, ms: 120, type: 'square', gain: 0.08 },
  go: { freq: 780, to: 1040, ms: 260, type: 'square', gain: 0.1 },
  end: { freq: 660, to: 220, ms: 700, type: 'triangle', gain: 0.18 },
} as const satisfies Record<string, { freq: number; to: number; ms: number; type: OscillatorType; gain: number }>;

export type SoundName = keyof typeof SOUNDS;

let ctx: AudioContext | null = null;
let muted = false;

// Must be called from a tap or click; browsers keep audio locked until then.
export function unlockAudio(): void {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
}

export function audioUnlocked(): boolean {
  return ctx?.state === 'running';
}

export function setMuted(value: boolean): void {
  muted = value;
}

export function isMuted(): boolean {
  return muted;
}

export function play(name: SoundName): void {
  if (muted || !ctx || ctx.state !== 'running') return;
  const { freq, to, ms, type, gain: level } = SOUNDS[name];
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  const t = ctx.currentTime;
  const end = t + ms / 1000;
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(to, end);
  gain.gain.setValueAtTime(level, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(end + 0.01);
}
