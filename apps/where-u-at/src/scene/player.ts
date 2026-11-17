// Moves time forward while playing, optionally stopping on every event (except short moves) until
// its animation is done and a moment after.
import type { LifeEvent } from '../data/types';
import type { TimedEvent, Timeline } from '../engine/timeline';

/** Seconds of play per year of timeline. */
export const SPEEDS = [24, 12, 6, 3, 1.5];
export const DEFAULT_SPEED = 2;
export const SPEED_LABELS = ['0.25x', '0.5x', '1x', '2x', '4x'];
/** How long a move's flight takes, in seconds. */
export const FLIGHT_SECONDS = 2.4;
/** How long each kind of event's animation runs, in seconds. */
export const ANIMATION_SECONDS: Record<LifeEvent['type'], number> = { move: FLIGHT_SECONDS, birth: 1.5, marriage: 3 };
/** Seconds to wait after an event's animation before time moves on. */
export const EVENT_PAUSE = 3;
/** Moves wait less after landing, since the flight itself already took a while. */
export const MOVE_PAUSE = 1;

/** Moves shorter than this many miles play without stopping time. */
export const SHORT_MOVE_MILES = 500;

export function holdFor(e: TimedEvent): number {
  return ANIMATION_SECONDS[e.event.type] + (e.event.type === 'move' ? MOVE_PAUSE : EVENT_PAUSE);
}

export class Player {
  t: number;
  playing = false;
  speed = DEFAULT_SPEED;
  pauseForEvents = true;
  /** Events that don't stop time, such as ones about people who are filtered out. */
  skip: (e: TimedEvent) => boolean = () => false;
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
      const first = crossed.find((e) => !this.skip(e) && !this.isShortMove(e));
      if (first) {
        next = first.t;
        crossed = crossed.filter((e) => e.t <= first.t);
        this.hold = holdFor(first);
      }
    }
    this.t = next;
    if (this.t >= this.timeline.end) this.playing = false;
    return crossed;
  }

  private isShortMove(e: TimedEvent): boolean {
    return e.event.type === 'move' && this.timeline.moveMiles(e.event.id) < SHORT_MOVE_MILES;
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
