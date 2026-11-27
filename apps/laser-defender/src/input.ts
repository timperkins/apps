/** Keyboard + mouse, or twin-stick touch controls. */
export class Input {
  keys = new Set<string>();
  mouseX = 0;
  mouseY = 0;
  mouseSeen = false;
  mouseFire = false;
  /** Screen-space move vector, length 0..1. y is down. */
  moveX = 0;
  moveY = 0;
  /** Touch aim vector in screen space, or null when the right stick is idle. */
  touchAim: { x: number; y: number } | null = null;
  touch = false;
  private boltQueued = false;
  private dashQueued = false;
  private moveId = -1;
  private aimId = -1;
  private moveOrigin = { x: 0, y: 0 };
  private aimOrigin = { x: 0, y: 0 };

  constructor(
    private surface: HTMLElement,
    private stickL: HTMLElement,
    private stickR: HTMLElement,
    boltBtn: HTMLElement,
    dashBtn: HTMLElement,
    private onKey: (code: string) => void,
  ) {
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'KeyQ' || e.code === 'KeyE') this.boltQueued = true;
      if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.dashQueued = true;
      if (e.code === 'Space') e.preventDefault();
      this.onKey(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => {
      this.keys.clear();
      this.mouseFire = false;
    });
    surface.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      this.mouseSeen = true;
    });
    surface.addEventListener('mousedown', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      this.mouseSeen = true;
      if (e.button === 0) this.mouseFire = true;
      if (e.button === 2) this.boltQueued = true;
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseFire = false;
    });
    surface.addEventListener('contextmenu', (e) => e.preventDefault());

    surface.addEventListener('touchstart', (e) => this.touchStart(e), { passive: false });
    surface.addEventListener('touchmove', (e) => this.touchMove(e), { passive: false });
    surface.addEventListener('touchend', (e) => this.touchEnd(e), { passive: false });
    surface.addEventListener('touchcancel', (e) => this.touchEnd(e), { passive: false });

    const press = (el: HTMLElement, fn: () => void) => {
      el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.touch = true;
        fn();
        el.classList.add('down');
      }, { passive: false });
      el.addEventListener('touchend', () => el.classList.remove('down'));
      el.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        fn();
      });
    };
    press(boltBtn, () => (this.boltQueued = true));
    press(dashBtn, () => (this.dashQueued = true));
  }

  private touchStart(e: TouchEvent) {
    e.preventDefault();
    this.touch = true;
    document.body.classList.add('touch');
    for (const t of Array.from(e.changedTouches)) {
      if (t.clientX < innerWidth / 2 && this.moveId < 0) {
        this.moveId = t.identifier;
        this.moveOrigin = { x: t.clientX, y: t.clientY };
        this.place(this.stickL, t.clientX, t.clientY, 0, 0);
      } else if (t.clientX >= innerWidth / 2 && this.aimId < 0) {
        this.aimId = t.identifier;
        this.aimOrigin = { x: t.clientX, y: t.clientY };
        this.place(this.stickR, t.clientX, t.clientY, 0, 0);
      }
    }
  }

  private touchMove(e: TouchEvent) {
    e.preventDefault();
    const R = 55;
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === this.moveId) {
        let dx = t.clientX - this.moveOrigin.x, dy = t.clientY - this.moveOrigin.y;
        const d = Math.hypot(dx, dy);
        if (d > R) {
          // Drag the stick base along so it never feels stuck.
          this.moveOrigin.x += (dx / d) * (d - R);
          this.moveOrigin.y += (dy / d) * (d - R);
          dx = t.clientX - this.moveOrigin.x;
          dy = t.clientY - this.moveOrigin.y;
        }
        this.moveX = dx / R;
        this.moveY = dy / R;
        const l = Math.hypot(this.moveX, this.moveY);
        if (l < 0.15) this.moveX = this.moveY = 0;
        this.place(this.stickL, this.moveOrigin.x, this.moveOrigin.y, dx, dy);
      } else if (t.identifier === this.aimId) {
        let dx = t.clientX - this.aimOrigin.x, dy = t.clientY - this.aimOrigin.y;
        const d = Math.hypot(dx, dy);
        if (d > R) {
          this.aimOrigin.x += (dx / d) * (d - R);
          this.aimOrigin.y += (dy / d) * (d - R);
          dx = t.clientX - this.aimOrigin.x;
          dy = t.clientY - this.aimOrigin.y;
        }
        this.touchAim = d > 12 ? { x: dx, y: dy } : null;
        this.place(this.stickR, this.aimOrigin.x, this.aimOrigin.y, dx, dy);
      }
    }
  }

  private touchEnd(e: TouchEvent) {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === this.moveId) {
        this.moveId = -1;
        this.moveX = this.moveY = 0;
        this.stickL.classList.remove('on');
      } else if (t.identifier === this.aimId) {
        this.aimId = -1;
        this.touchAim = null;
        this.stickR.classList.remove('on');
      }
    }
  }

  private place(el: HTMLElement, x: number, y: number, dx: number, dy: number) {
    el.classList.add('on');
    el.style.transform = `translate(${x}px, ${y}px)`;
    (el.firstElementChild as HTMLElement).style.transform = `translate(${dx}px, ${dy}px)`;
  }

  /** Keyboard movement merged with the touch stick. */
  readMove(): { x: number; y: number } {
    let x = this.moveX, y = this.moveY;
    const k = this.keys;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) y -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y += 1;
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x, y };
  }

  firing() {
    return this.mouseFire || this.keys.has('KeyJ') || this.touchAim !== null;
  }

  takeBolt() {
    const b = this.boltQueued;
    this.boltQueued = false;
    return b;
  }

  takeDash() {
    const d = this.dashQueued;
    this.dashQueued = false;
    return d;
  }

  reset() {
    this.boltQueued = this.dashQueued = false;
    this.mouseFire = false;
  }
}
