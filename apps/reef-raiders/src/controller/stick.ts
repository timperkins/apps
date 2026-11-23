// A floating thumbstick: wherever the finger lands becomes the center.
// `axis: 'x'` only reports sideways movement, for steering a boat.

export const STICK_RADIUS = 56;
export const DEAD_ZONE = 0.12;

export interface StickState {
  active: boolean;
  x: number;
  y: number;
  // Center and knob, in pixels relative to the pad.
  cx: number;
  cy: number;
  kx: number;
  ky: number;
}

export const IDLE: StickState = { active: false, x: 0, y: 0, cx: 0, cy: 0, kx: 0, ky: 0 };

export function stickValue(dx: number, dy: number, axis: 'x' | 'xy', radius = STICK_RADIUS): { x: number; y: number } {
  if (axis === 'x') dy = 0;
  const d = Math.hypot(dx, dy);
  if (d < radius * DEAD_ZONE) return { x: 0, y: 0 };
  const m = Math.min(1, (d - radius * DEAD_ZONE) / (radius * (1 - DEAD_ZONE)));
  return { x: (dx / d) * m, y: (dy / d) * m };
}

export class Stick {
  state: StickState = IDLE;
  private pointer: number | null = null;

  constructor(
    private el: HTMLElement,
    private axis: 'x' | 'xy',
    private onChange: (s: StickState) => void,
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

  private local(e: PointerEvent) {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private down = (e: PointerEvent) => {
    if (this.pointer !== null) return;
    e.preventDefault();
    this.pointer = e.pointerId;
    this.el.setPointerCapture?.(e.pointerId);
    const p = this.local(e);
    this.state = { active: true, x: 0, y: 0, cx: p.x, cy: p.y, kx: p.x, ky: p.y };
    this.onChange(this.state);
  };

  private move = (e: PointerEvent) => {
    if (e.pointerId !== this.pointer) return;
    const p = this.local(e);
    let dx = p.x - this.state.cx;
    let dy = this.axis === 'x' ? 0 : p.y - this.state.cy;
    const d = Math.hypot(dx, dy);
    // Drag the center along when the finger goes past the rim, so the stick never feels stuck.
    if (d > STICK_RADIUS) {
      const k = (d - STICK_RADIUS) / d;
      this.state.cx += dx * k;
      this.state.cy += dy * k;
      dx -= dx * k;
      dy -= dy * k;
    }
    const v = stickValue(dx, dy, this.axis);
    this.state = { ...this.state, ...v, kx: this.state.cx + dx, ky: this.state.cy + dy };
    this.onChange(this.state);
  };

  private up = (e: PointerEvent) => {
    if (e.pointerId !== this.pointer) return;
    this.pointer = null;
    this.state = { ...IDLE };
    this.onChange(this.state);
  };
}
