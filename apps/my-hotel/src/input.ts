// Keyboard (WASD / arrows) plus a drag-anywhere stick for touch screens.
import type { Input } from './sim/hotel';

const KEYS: Record<string, [number, number]> = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

export class Controls {
  private down = new Set<string>();
  private touch: { id: number; x0: number; y0: number; x: number; y: number } | null = null;
  private stick: HTMLDivElement;
  private knob: HTMLDivElement;
  used = false;

  constructor(private surface: HTMLElement) {
    this.stick = document.createElement('div');
    this.stick.className = 'stick';
    this.knob = document.createElement('div');
    this.stick.appendChild(this.knob);
    document.body.appendChild(this.stick);

    addEventListener('keydown', this.onKeyDown);
    addEventListener('keyup', this.onKeyUp);
    addEventListener('blur', this.onBlur);
    surface.addEventListener('pointerdown', this.onPointerDown);
    addEventListener('pointermove', this.onPointerMove);
    addEventListener('pointerup', this.onPointerUp);
    addEventListener('pointercancel', this.onPointerUp);
  }

  /**
   * 'all' reads every key (1 player). In 2-player mode player 1 ('p1') has WASD and the touch
   * stick, and player 2 ('p2') has the arrow keys.
   */
  read(who: 'all' | 'p1' | 'p2' = 'all'): Input {
    let x = 0, z = 0;
    for (const k of this.down) {
      const arrow = k.startsWith('Arrow');
      if ((who === 'p1' && arrow) || (who === 'p2' && !arrow)) continue;
      x += KEYS[k][0];
      z += KEYS[k][1];
    }
    if (this.touch && who !== 'p2') {
      const dx = this.touch.x - this.touch.x0, dy = this.touch.y - this.touch.y0;
      const d = Math.hypot(dx, dy);
      if (d > 8) {
        const k = Math.min(1, d / 60) / d;
        x += dx * k;
        z += dy * k;
      }
    }
    const len = Math.hypot(x, z);
    return len > 1 ? { x: x / len, z: z / len } : { x, z };
  }

  dispose() {
    removeEventListener('keydown', this.onKeyDown);
    removeEventListener('keyup', this.onKeyUp);
    removeEventListener('blur', this.onBlur);
    this.surface.removeEventListener('pointerdown', this.onPointerDown);
    removeEventListener('pointermove', this.onPointerMove);
    removeEventListener('pointerup', this.onPointerUp);
    removeEventListener('pointercancel', this.onPointerUp);
    this.stick.remove();
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (!(e.code in KEYS) || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    this.down.add(e.code);
    this.used = true;
  };
  private onKeyUp = (e: KeyboardEvent) => this.down.delete(e.code);
  private onBlur = () => {
    this.down.clear();
    this.touch = null;
    this.stick.style.display = 'none';
  };
  private onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.touch = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY };
    this.used = true;
    Object.assign(this.stick.style, { display: 'block', left: `${e.clientX}px`, top: `${e.clientY}px` });
    this.knob.style.transform = 'translate(-50%, -50%)';
  };
  private onPointerMove = (e: PointerEvent) => {
    if (!this.touch || e.pointerId !== this.touch.id) return;
    this.touch.x = e.clientX;
    this.touch.y = e.clientY;
    const dx = e.clientX - this.touch.x0, dy = e.clientY - this.touch.y0;
    const d = Math.hypot(dx, dy), k = d > 50 ? 50 / d : 1;
    this.knob.style.transform = `translate(calc(-50% + ${dx * k}px), calc(-50% + ${dy * k}px))`;
  };
  private onPointerUp = (e: PointerEvent) => {
    if (!this.touch || e.pointerId !== this.touch.id) return;
    this.touch = null;
    this.stick.style.display = 'none';
  };
}
