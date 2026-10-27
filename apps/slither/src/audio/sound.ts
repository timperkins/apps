// Short synth blips generated in code; no audio files.
const SOUNDS = {
  eat: { freq: 880, to: 1320, ms: 50, type: 'sine', gain: 0.06 },
  death: { freq: 300, to: 60, ms: 420, type: 'sawtooth', gain: 0.12 },
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
