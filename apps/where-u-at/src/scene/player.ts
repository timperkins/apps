// Moves time forward while playing, optionally pausing on births and marriages.
import type { TimedEvent, Timeline } from '../engine/timeline';

/** Seconds of play per year of timeline. */
export const SPEEDS = [24, 12, 6, 3, 1.5];
export const DEFAULT_SPEED = 2;
export const SPEED_LABELS = ['0.25x', '0.5x', '1x', '2x', '4x'];
export const EVENT_HOLD = 1.5;

export function isBigEvent(e: TimedEvent): boolean {
  return e.event.type === 'birth' || e.event.type === 'marriage';
}

export class Player {
  t: number;
  playing = false;
  speed = DEFAULT_SPEED;
  pauseForEvents = true;
  private hold = 0;

  constructor(private readonly timeline: Timeline) {
    this.t = timeline.start;
  }

  /** Advances by dt real seconds and returns the events crossed. */
  advance(dt: number): TimedEvent[] {
    if (!this.playing) return [];
    if (this.hold > 0) {
      this.hold -= dt;
      if (this.hold > 0) return [];
      dt = -this.hold;
      this.hold = 0;
    }
    const monthsPerSecond = 12 / SPEEDS[this.speed];
    let next = Math.min(this.t + dt * monthsPerSecond, this.timeline.end);
    let crossed = this.timeline.eventsBetween(this.t, next);
    if (this.pauseForEvents) {
      const big = crossed.find(isBigEvent);
      if (big) {
        next = big.t;
        crossed = crossed.filter((e) => e.t <= big.t);
        this.hold = EVENT_HOLD;
      }
    }
    this.t = next;
    if (this.t >= this.timeline.end) this.playing = false;
    return crossed;
  }

  play(): void {
    if (this.t >= this.timeline.end) this.t = this.timeline.start;
    this.playing = true;
  }

  seek(t: number): void {
    this.t = Math.max(this.timeline.start, Math.min(this.timeline.end, t));
    this.hold = 0;
  }
}
