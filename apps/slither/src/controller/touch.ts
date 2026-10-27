// Touch steering: the first touch sets the center and only sideways distance from it counts.
// Double-tap and hold boosts; in tilt mode the pad only does the boost part.

export const DEAD_ZONE = 0.04;
// Sideways distance, as a share of the pad's width, that gives a full turn.
export const FULL_TURN = 0.25;
export const DOUBLE_TAP_MS = 320;

export function touchToSteer(dx: number, width: number): number {
  if (width <= 0) return 0;
  let t = dx / width;
  if (Math.abs(t) < DEAD_ZONE) return 0;
  t -= Math.sign(t) * DEAD_ZONE;
  return Math.max(-1, Math.min(1, t / (FULL_TURN - DEAD_ZONE)));
}

export interface PadState {
  active: boolean;
  boost: boolean;
  s: number;
  // Where the finger went down and where it is now, relative to the pad.
  cx: number;
  cy: number;
  x: number;
  y: number;
}

export class TouchPad {
  state: PadState = { active: false, boost: false, s: 0, cx: 0, cy: 0, x: 0, y: 0 };
  private pointer: number | null = null;
  private lastUp = -Infinity;

  constructor(
    private el: HTMLElement,
    public steering: boolean,
    private onChange: (state: PadState) => void,
  ) {
    el.addEventListener('pointerdown', this.down);
    el.addEventListener('pointermove', this.move);
    el.addEventListener('pointerup', this.up);
    el.addEventListener('pointercancel', this.up);
  }

  dispose(): void {
    this.el.removeEventListener('pointerdown', this.down);
    this.el.removeEventListener('pointermove', this.move);
    this.el.removeEventListener('pointerup', this.up);
    this.el.removeEventListener('pointercancel', this.up);
  }

  private local(e: PointerEvent): { x: number; y: number } {
    const rect = this.el.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private down = (e: PointerEvent) => {
    // Extra fingers are ignored; the first one steers.
    if (this.pointer !== null) return;
    e.preventDefault();
    this.pointer = e.pointerId;
    this.el.setPointerCapture?.(e.pointerId);
    const { x, y } = this.local(e);
    const boost = e.timeStamp - this.lastUp < DOUBLE_TAP_MS;
    this.state = { active: true, boost, s: 0, cx: x, cy: y, x, y };
    this.onChange(this.state);
  };

  private move = (e: PointerEvent) => {
    if (e.pointerId !== this.pointer) return;
    const { x, y } = this.local(e);
    const s = this.steering ? touchToSteer(x - this.state.cx, this.el.clientWidth) : 0;
    this.state = { ...this.state, x, y, s };
    this.onChange(this.state);
  };

  private up = (e: PointerEvent) => {
    if (e.pointerId !== this.pointer) return;
    this.pointer = null;
    this.lastUp = e.timeStamp;
    this.state = { ...this.state, active: false, boost: false, s: 0 };
    this.onChange(this.state);
  };
}
