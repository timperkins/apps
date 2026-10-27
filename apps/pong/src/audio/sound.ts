// Square-wave beeps generated in code, pitched like the 1972 cabinet.
const SOUNDS = {
  paddle: { freq: 459, ms: 60 },
  wall: { freq: 226, ms: 30 },
  score: { freq: 490, ms: 260 },
} as const;

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
  const { freq, ms } = SOUNDS[name];
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = freq;
  const t = ctx.currentTime;
  gain.gain.setValueAtTime(0.15, t);
  gain.gain.setValueAtTime(0.15, t + ms / 1000 - 0.005);
  gain.gain.linearRampToValueAtTime(0, t + ms / 1000);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + ms / 1000 + 0.01);
}
