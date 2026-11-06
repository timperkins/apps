/** Touch joystick (drag anywhere) plus WASD / arrow keys. Directions are in screen space. */
export class Input {
  /** Joystick origin and knob in CSS pixels while a finger or mouse is down. */
  stick: { ox: number; oy: number; x: number; y: number } | null = null;
  readonly radius = 56;
  private keys = new Set<string>();
  private pointerId: number | null = null;
  private listeners: (() => void)[] = [];

  constructor(el: HTMLElement) {
    el.addEventListener('pointerdown', (e) => {
      if (this.pointerId !== null) return;
      this.pointerId = e.pointerId;
      el.setPointerCapture(e.pointerId);
      this.stick = { ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
      this.fire();
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.pointerId || !this.stick) return;
      let dx = e.clientX - this.stick.ox;
      let dy = e.clientY - this.stick.oy;
      const d = Math.hypot(dx, dy);
      if (d > this.radius) {
        // Drag the origin along so reversing direction feels immediate.
        this.stick.ox += (dx / d) * (d - this.radius);
        this.stick.oy += (dy / d) * (d - this.radius);
        dx = e.clientX - this.stick.ox;
        dy = e.clientY - this.stick.oy;
      }
      this.stick.x = e.clientX;
      this.stick.y = e.clientY;
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.pointerId) return;
      this.pointerId = null;
      this.stick = null;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);

    addEventListener('keydown', (e) => {
      const k = keyName(e);
      if (k) {
        this.keys.add(k);
        e.preventDefault();
        this.fire();
      }
    });
    addEventListener('keyup', (e) => {
      const k = keyName(e);
      if (k) this.keys.delete(k);
    });
    addEventListener('blur', () => this.keys.clear());
  }

  /** Called on the first user gesture (used to unlock audio). */
  onGesture(fn: () => void) {
    this.listeners.push(fn);
  }

  private fire() {
    for (const fn of this.listeners) fn();
    this.listeners = [];
  }

  /** Screen-space direction, length 0..1. */
  direction(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.keys.has('left')) x -= 1;
    if (this.keys.has('right')) x += 1;
    if (this.keys.has('up')) y -= 1;
    if (this.keys.has('down')) y += 1;
    if (x || y) {
      const d = Math.hypot(x, y);
      return { x: x / d, y: y / d };
    }
    if (this.stick) {
      const dx = this.stick.x - this.stick.ox;
      const dy = this.stick.y - this.stick.oy;
      const d = Math.hypot(dx, dy);
      if (d < 6) return { x: 0, y: 0 };
      const m = Math.min(1, d / (this.radius * 0.6));
      return { x: (dx / d) * m, y: (dy / d) * m };
    }
    return { x: 0, y: 0 };
  }
}

function keyName(e: KeyboardEvent): string | null {
  switch (e.code) {
    case 'KeyW':
    case 'ArrowUp':
      return 'up';
    case 'KeyS':
    case 'ArrowDown':
      return 'down';
    case 'KeyA':
    case 'ArrowLeft':
      return 'left';
    case 'KeyD':
    case 'ArrowRight':
      return 'right';
  }
  return null;
}
