import type { Input } from '../core/sim';

/**
 * Keyboard, gamepad and on-screen touch controls, merged into one Input. Button presses are
 * counters so a quick tap between two network messages still counts.
 */
export class Controls {
  private keys = new Set<string>();
  private counts = { attack: 0, jump: 0, grab: 0 };
  private stick = { x: 0, y: 0 };
  private stickId: number | null = null;
  private stickOrigin = { x: 0, y: 0 };
  private padPrev = [false, false, false];
  readonly touch: boolean;
  private root: HTMLElement | null = null;
  private knob: HTMLElement | null = null;
  private base: HTMLElement | null = null;
  private onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    this.keys.add(k);
    if (k === 'j' || k === 'z' || k === ' ') this.counts.attack++;
    if (k === 'k' || k === 'x' || k === 'shift') this.counts.jump++;
    if (k === 'l' || k === 'c' || k === 'e') this.counts.grab++;
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  };
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());

  constructor() {
    this.touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    addEventListener('keydown', this.onKeyDown);
    addEventListener('keyup', this.onKeyUp);
    addEventListener('blur', () => this.keys.clear());
  }

  /** Adds the on-screen joystick and buttons. */
  mount(parent: HTMLElement): void {
    const root = document.createElement('div');
    root.className = 'controls';
    root.innerHTML = `
      <div class="stick-zone"><div class="stick-base"><div class="stick-knob"></div></div></div>
      <button class="cbtn hit" data-b="attack" aria-label="Attack"><svg viewBox="0 0 24 24"><path d="M4 14l8-10 2 2-4 6h8l-8 10-2-2 4-6z"/></svg></button>
      <button class="cbtn jump" data-b="jump" aria-label="Jump"><svg viewBox="0 0 24 24"><path d="M12 3l8 9h-5v9H9v-9H4z"/></svg></button>
      <button class="cbtn grab" data-b="grab" aria-label="Grab or throw"><svg viewBox="0 0 24 24"><path d="M7 11V6a1.5 1.5 0 0 1 3 0v4-6a1.5 1.5 0 0 1 3 0v6-5a1.5 1.5 0 0 1 3 0v6-3a1.5 1.5 0 0 1 3 0v6c0 4-3 7-7 7s-6-2-8-5l-2-3a1.5 1.5 0 0 1 2.5-1.7z"/></svg></button>`;
    parent.appendChild(root);
    this.root = root;
    this.base = root.querySelector('.stick-base');
    this.knob = root.querySelector('.stick-knob');
    const zone = root.querySelector<HTMLElement>('.stick-zone')!;
    zone.addEventListener('pointerdown', (e) => {
      if (this.stickId !== null) return;
      this.stickId = e.pointerId;
      zone.setPointerCapture(e.pointerId);
      this.stickOrigin = { x: e.clientX, y: e.clientY };
      const r = zone.getBoundingClientRect();
      this.base!.style.left = `${e.clientX - r.left}px`;
      this.base!.style.top = `${e.clientY - r.top}px`;
      this.base!.classList.add('active');
      this.moveStick(e.clientX, e.clientY);
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.stickId) this.moveStick(e.clientX, e.clientY);
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.stickId) return;
      this.stickId = null;
      this.stick = { x: 0, y: 0 };
      this.knob!.style.transform = '';
      this.base!.classList.remove('active');
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
    for (const b of root.querySelectorAll<HTMLButtonElement>('.cbtn')) {
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const which = b.dataset.b as 'attack' | 'jump' | 'grab';
        this.counts[which]++;
        b.classList.add('down');
        navigator.vibrate?.(8);
      });
      const up = () => b.classList.remove('down');
      b.addEventListener('pointerup', up);
      b.addEventListener('pointerleave', up);
      b.addEventListener('pointercancel', up);
    }
  }

  private moveStick(x: number, y: number): void {
    const max = 46;
    let dx = x - this.stickOrigin.x;
    let dy = y - this.stickOrigin.y;
    const d = Math.hypot(dx, dy);
    if (d > max) {
      dx = (dx / d) * max;
      dy = (dy / d) * max;
    }
    this.stick = { x: dx / max, y: dy / max };
    this.knob!.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  read(): Input {
    let mx = 0;
    let mz = 0;
    const k = this.keys;
    if (k.has('a') || k.has('arrowleft')) mx -= 1;
    if (k.has('d') || k.has('arrowright')) mx += 1;
    if (k.has('w') || k.has('arrowup')) mz -= 1;
    if (k.has('s') || k.has('arrowdown')) mz += 1;
    if (Math.abs(this.stick.x) > 0.15 || Math.abs(this.stick.y) > 0.15) {
      mx = this.stick.x;
      mz = this.stick.y;
    }
    for (const pad of navigator.getGamepads?.() ?? []) {
      if (!pad) continue;
      const ax = pad.axes[0] ?? 0;
      const ay = pad.axes[1] ?? 0;
      if (Math.abs(ax) > 0.2 || Math.abs(ay) > 0.2) {
        mx = ax;
        mz = ay;
      }
      if (pad.buttons[14]?.pressed) mx = -1;
      if (pad.buttons[15]?.pressed) mx = 1;
      if (pad.buttons[12]?.pressed) mz = -1;
      if (pad.buttons[13]?.pressed) mz = 1;
      const btn = [pad.buttons[2]?.pressed || pad.buttons[1]?.pressed, pad.buttons[0]?.pressed, pad.buttons[3]?.pressed];
      if (btn[0] && !this.padPrev[0]) this.counts.attack++;
      if (btn[1] && !this.padPrev[1]) this.counts.jump++;
      if (btn[2] && !this.padPrev[2]) this.counts.grab++;
      this.padPrev = btn.map(Boolean);
      break;
    }
    return { mx: Math.round(mx * 100) / 100, mz: Math.round(mz * 100) / 100, ...this.counts };
  }

  destroy(): void {
    removeEventListener('keydown', this.onKeyDown);
    removeEventListener('keyup', this.onKeyUp);
    this.root?.remove();
  }
}
