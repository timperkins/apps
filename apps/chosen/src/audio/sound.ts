// All sounds are synthesized with Web Audio, so there are no audio files to cache.

let ctx: AudioContext | null = null

/** Must run inside a user gesture (pointerdown) for iOS to allow audio. */
export function unlockAudio(): void {
  if (!ctx) {
    try {
      ctx = new AudioContext()
    } catch {
      return
    }
  }
  if (ctx.state === 'suspended') void ctx.resume()
}

interface Note {
  freq: number
  /** Seconds from now. */
  at?: number
  dur?: number
  type?: OscillatorType
  gain?: number
  /** Frequency to glide to by the end of the note. */
  slideTo?: number
}

function play(notes: Note[]): void {
  if (!ctx || ctx.state !== 'running') return
  const now = ctx.currentTime
  for (const { freq, at = 0, dur = 0.12, type = 'sine', gain = 0.2, slideTo } of notes) {
    const osc = ctx.createOscillator()
    const amp = ctx.createGain()
    const start = now + at
    osc.type = type
    osc.frequency.setValueAtTime(freq, start)
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur)
    amp.gain.setValueAtTime(0.0001, start)
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.01)
    amp.gain.exponentialRampToValueAtTime(0.0001, start + dur)
    osc.connect(amp).connect(ctx.destination)
    osc.start(start)
    osc.stop(start + dur + 0.02)
  }
}

// Pentatonic scale so any mix of fingers sounds pleasant together.
const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760]

export const sounds = {
  join(color: number) {
    const f = SCALE[color % SCALE.length]
    play([{ freq: f * 0.8, slideTo: f, dur: 0.12, type: 'triangle', gain: 0.25 }])
  },
  leave(color: number) {
    const f = SCALE[color % SCALE.length]
    play([{ freq: f, slideTo: f * 0.6, dur: 0.14, type: 'triangle', gain: 0.18 }])
  },
  restart() {
    play([{ freq: 300, slideTo: 180, dur: 0.18, type: 'square', gain: 0.06 }])
  },
  /** index runs 1..7 over the countdown; pitch climbs to build tension. */
  tick(index: number) {
    play([{ freq: 440 * 2 ** (index / 12 * 2), dur: 0.06, type: 'square', gain: 0.07 }])
  },
  chosen() {
    const fanfare = [523.25, 659.25, 783.99, 1046.5]
    play([
      ...fanfare.map((freq, i) => ({ freq, at: i * 0.09, dur: 0.18, type: 'triangle' as const, gain: 0.25 })),
      { freq: 1046.5, at: 0.36, dur: 0.6, type: 'triangle', gain: 0.22 },
      { freq: 1318.51, at: 0.36, dur: 0.6, type: 'sine', gain: 0.12 },
    ])
  },
  /** Sad trombone "womp womp" for the taunts. */
  womp() {
    play([
      { freq: 233, slideTo: 220, at: 0, dur: 0.3, type: 'sawtooth', gain: 0.08 },
      { freq: 220, slideTo: 196, at: 0.34, dur: 0.3, type: 'sawtooth', gain: 0.08 },
      { freq: 207, slideTo: 185, at: 0.68, dur: 0.3, type: 'sawtooth', gain: 0.08 },
      { freq: 196, slideTo: 155, at: 1.02, dur: 0.7, type: 'sawtooth', gain: 0.08 },
    ])
  },
}
