import { cryptoRng, shuffle, type Rng } from './random'
import { pickTaunts } from './taunts'

export const COUNTDOWN_MS = 4000
export const MIN_PLAYERS = 2
export const MAX_FINGERS = 10
/** How long the result stays up at minimum, even if everyone lets go at once. */
export const RESULT_HOLD_MS = 2500
export const FADE_OUT_MS = 600
/** The countdown ticks this often (8 ticks over 4 seconds). */
export const TICK_MS = 500

export type Phase = 'idle' | 'counting' | 'chosen' | 'fading'

export interface Finger {
  id: number
  x: number
  y: number
  /** Index into the color palette; the lowest free index is reused. */
  color: number
  joinedAt: number
  /** Set while the result is showing and this finger has already lifted. */
  lifted: boolean
}

export interface Taunt {
  fingerId: number
  message: string
}

export interface Result {
  winnerId: number
  taunts: Taunt[]
  chosenAt: number
}

export type GameEvent =
  | { type: 'join'; color: number }
  | { type: 'leave'; color: number }
  | { type: 'restart' }
  | { type: 'tick'; index: number }
  | { type: 'chosen'; winnerColor: number }
  | { type: 'reset' }

export class Game {
  phase: Phase = 'idle'
  readonly fingers = new Map<number, Finger>()
  /** Pointers that touched down while a result was showing; they don't play. */
  readonly ignored = new Set<number>()
  countdownStart = 0
  lastRestartAt = -Infinity
  result: Result | null = null
  fadeStart = 0
  /** Bumps every time a new round's result is chosen. */
  round = 0
  private ticksFired = 0
  private readonly rng: Rng

  constructor(rng: Rng = cryptoRng) {
    this.rng = rng
  }

  get activeCount(): number {
    return this.fingers.size
  }

  /** 0..1 progress through the countdown, or 0 when not counting. */
  progress(now: number): number {
    if (this.phase !== 'counting') return 0
    return Math.min(1, Math.max(0, (now - this.countdownStart) / COUNTDOWN_MS))
  }

  add(id: number, x: number, y: number, now: number): GameEvent[] {
    if (this.phase === 'chosen' || this.phase === 'fading') {
      this.ignored.add(id)
      return []
    }
    if (this.fingers.has(id) || this.fingers.size >= MAX_FINGERS) {
      this.ignored.add(id)
      return []
    }
    const color = this.freeColor()
    this.fingers.set(id, { id, x, y, color, joinedAt: now, lifted: false })
    return [{ type: 'join', color }, ...this.recount(now)]
  }

  move(id: number, x: number, y: number): void {
    const f = this.fingers.get(id)
    if (!f || f.lifted) return
    f.x = x
    f.y = y
  }

  remove(id: number, now: number): GameEvent[] {
    if (this.ignored.delete(id)) return this.maybeFinish(now)
    const f = this.fingers.get(id)
    if (!f) return []
    if (this.phase === 'chosen' || this.phase === 'fading') {
      f.lifted = true
      return this.maybeFinish(now)
    }
    this.fingers.delete(id)
    return [{ type: 'leave', color: f.color }, ...this.recount(now)]
  }

  /** Advance timers. Call once per animation frame. */
  tick(now: number): GameEvent[] {
    const events: GameEvent[] = []
    if (this.phase === 'counting') {
      const elapsed = now - this.countdownStart
      while (this.ticksFired < COUNTDOWN_MS / TICK_MS - 1 && elapsed >= (this.ticksFired + 1) * TICK_MS) {
        this.ticksFired++
        events.push({ type: 'tick', index: this.ticksFired })
      }
      if (elapsed >= COUNTDOWN_MS) events.push(this.choose(now))
    } else if (this.phase === 'chosen') {
      events.push(...this.maybeFinish(now))
    } else if (this.phase === 'fading' && now - this.fadeStart >= FADE_OUT_MS) {
      this.fingers.clear()
      this.result = null
      this.phase = 'idle'
      events.push({ type: 'reset' })
    }
    return events
  }

  private recount(now: number): GameEvent[] {
    if (this.fingers.size >= MIN_PLAYERS) {
      const wasCounting = this.phase === 'counting'
      this.phase = 'counting'
      this.countdownStart = now
      this.ticksFired = 0
      if (wasCounting) {
        this.lastRestartAt = now
        return [{ type: 'restart' }]
      }
      return []
    }
    this.phase = 'idle'
    return []
  }

  private choose(now: number): GameEvent {
    const ids = [...this.fingers.keys()]
    const winnerId = ids[Math.floor(this.rng() * ids.length)]
    const losers = ids.filter((id) => id !== winnerId)
    const tauntCount = ids.length >= 4 ? 2 : 1
    const taunted = shuffle(losers, this.rng).slice(0, tauntCount)
    const messages = pickTaunts(taunted.length, this.rng)
    this.result = {
      winnerId,
      chosenAt: now,
      taunts: taunted.map((fingerId, i) => ({ fingerId, message: messages[i] })),
    }
    this.phase = 'chosen'
    this.round++
    return { type: 'chosen', winnerColor: this.fingers.get(winnerId)!.color }
  }

  private maybeFinish(now: number): GameEvent[] {
    if (this.phase !== 'chosen') return []
    const allLifted = [...this.fingers.values()].every((f) => f.lifted) && this.ignored.size === 0
    if (allLifted && this.result && now - this.result.chosenAt >= RESULT_HOLD_MS) {
      this.phase = 'fading'
      this.fadeStart = now
    }
    return []
  }

  private freeColor(): number {
    const used = new Set([...this.fingers.values()].map((f) => f.color))
    let i = 0
    while (used.has(i)) i++
    return i
  }
}
