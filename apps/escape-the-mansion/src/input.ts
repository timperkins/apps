// Two controls: move (keys, or a floating thumbstick on touch) and one action button.

export class Controls {
  private keys = new Set<string>();
  private actionQueued = false;
  private stickId: number | null = null;
  private stickOrigin = { x: 0, y: 0 };
  private stickVec = { x: 0, y: 0 };
  touch = false;
  enabled = true;
  stickEl: HTMLElement;
  knobEl: HTMLElement;
  actionEl: HTMLElement;
  /** Called on any action press (also used by menus). */
  onAction: (() => void) | null = null;
  onDir: ((dx: number, dy: number) => void) | null = null;

  constructor(stage: HTMLElement, stickEl: HTMLElement, knobEl: HTMLElement, actionEl: HTMLElement) {
    this.stickEl = stickEl;
    this.knobEl = knobEl;
    this.actionEl = actionEl;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) {
        if (isMoveKey(e.key)) e.preventDefault();
        return;
      }
      const k = e.key.toLowerCase();
      if (k === ' ' || k === 'enter' || k === 'j' || k === 'x' || k === 'z' || k === 'e') {
        e.preventDefault();
        this.press();
        return;
      }
      if (isMoveKey(e.key)) {
        e.preventDefault();
        this.keys.add(k);
        const d = keyDir(k);
        if (d) this.onDir?.(d[0], d[1]);
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());

    actionEl.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.touch = true;
      actionEl.classList.add('down');
      this.press();
    });
    const up = () => actionEl.classList.remove('down');
    actionEl.addEventListener('pointerup', up);
    actionEl.addEventListener('pointercancel', up);
    actionEl.addEventListener('pointerleave', up);

    stage.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' || !this.enabled) return;
      this.touch = true;
      document.body.classList.add('touch');
      if (this.stickId !== null) return;
      this.stickId = e.pointerId;
      this.stickOrigin = { x: e.clientX, y: e.clientY };
      this.stickVec = { x: 0, y: 0 };
      stickEl.style.left = `${e.clientX}px`;
      stickEl.style.top = `${e.clientY}px`;
      stickEl.classList.add('on');
      knobEl.style.transform = 'translate(-50%,-50%)';
    });
    stage.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.stickId) return;
      const dx = e.clientX - this.stickOrigin.x;
      const dy = e.clientY - this.stickOrigin.y;
      const R = 48;
      const d = Math.hypot(dx, dy);
      const k = d > R ? R / d : 1;
      // let the origin drift so the thumb never runs out of room
      if (d > R * 1.4) {
        this.stickOrigin.x += dx * (1 - (R * 1.4) / d);
        this.stickOrigin.y += dy * (1 - (R * 1.4) / d);
        stickEl.style.left = `${this.stickOrigin.x}px`;
        stickEl.style.top = `${this.stickOrigin.y}px`;
      }
      this.stickVec = { x: (dx * k) / R, y: (dy * k) / R };
      knobEl.style.transform = `translate(calc(-50% + ${dx * k}px), calc(-50% + ${dy * k}px))`;
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.stickId) return;
      this.stickId = null;
      this.stickVec = { x: 0, y: 0 };
      stickEl.classList.remove('on');
    };
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
  }

  private press() {
    this.actionQueued = true;
    this.onAction?.();
  }

  /** Movement vector with length up to 1. */
  move(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    for (const k of this.keys) {
      const d = keyDir(k);
      if (d) {
        x += d[0];
        y += d[1];
      }
    }
    if (x || y) {
      const l = Math.hypot(x, y);
      return { x: x / l, y: y / l };
    }
    return this.stickVec;
  }

  takeAction(): boolean {
    const a = this.actionQueued;
    this.actionQueued = false;
    return a;
  }
  clear() {
    this.actionQueued = false;
  }
}

function keyDir(k: string): [number, number] | null {
  switch (k) {
    case 'arrowleft':
    case 'a':
      return [-1, 0];
    case 'arrowright':
    case 'd':
      return [1, 0];
    case 'arrowup':
    case 'w':
      return [0, -1];
    case 'arrowdown':
    case 's':
      return [0, 1];
  }
  return null;
}
const isMoveKey = (k: string) => keyDir(k.toLowerCase()) !== null;
