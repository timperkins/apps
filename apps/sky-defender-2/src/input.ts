// Tilt aiming. The phone's roll in the plane of its screen is read from the gravity
// direction (derived from deviceorientation beta/gamma, which are device-frame and so
// unaffected by any screen rotation), smoothed with a One Euro filter.

class OneEuro {
  private x: number | null = null;
  private dx = 0;
  private t = 0;
  constructor(private minCutoff: number, private beta: number, private dCutoff = 1) { }
  static a(cutoff: number, dt: number) { const r = 2 * Math.PI * cutoff * dt; return r / (r + 1); }
  filter(x: number, t: number): number {
    if (this.x === null) { this.x = x; this.t = t; return x; }
    const dt = Math.max(1e-3, t - this.t); this.t = t;
    const dx = (x - this.x) / dt;
    this.dx += OneEuro.a(this.dCutoff, dt) * (dx - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += OneEuro.a(cutoff, dt) * (x - this.x);
    return this.x;
  }
  reset() { this.x = null; this.dx = 0; }
}

/** iOS adds a static permission request to DeviceOrientationEvent. */
type OrientationEventWithPermission = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };
export type SensorResult = 'ok' | 'none' | 'denied';

class TiltInput {
  readonly debug = /[?&]debug\b/.test(location.search);
  /** On a computer, the arrow keys aim instead of the phone's roll. */
  keyboard = false;
  available = false;
  /** unfiltered roll, radians, clockwise positive */
  raw = 0;
  /** 0 upright .. 1 lying flat */
  flatness = 0;
  offset = 0;
  lastEvent = 0;
  value = 0;
  private filter = new OneEuro(1.4, 0.9);
  private keys = 0;
  private bound: ((e: DeviceOrientationEvent) => void) | null = null;
  private debugInstalled = false;
  private keysInstalled = false;

  onOrientation(e: DeviceOrientationEvent) {
    if (e.beta == null || e.gamma == null) return;
    const b = e.beta * Math.PI / 180, g = e.gamma * Math.PI / 180;
    // world "up" expressed in device coordinates
    const ux = -Math.sin(g) * Math.cos(b), uy = Math.sin(b), uz = Math.cos(b) * Math.cos(g);
    let roll = Math.atan2(-ux, uy);
    // keep continuity across the +/-180 seam
    while (roll - this.raw > Math.PI) roll -= 2 * Math.PI;
    while (roll - this.raw < -Math.PI) roll += 2 * Math.PI;
    this.raw = roll;
    this.flatness = Math.abs(uz);
    this.available = true;
    this.lastEvent = performance.now();
  }

  async start(): Promise<SensorResult> {
    if (this.debug) { this.available = true; this.keyboard = true; this.installDebug(); return 'ok'; }
    // a computer (a mouse and no touch screen) plays with the keyboard straight away
    if (isComputer()) { this.useKeyboard(); return 'ok'; }
    const DOE = window.DeviceOrientationEvent as OrientationEventWithPermission | undefined;
    if (!DOE) { this.useKeyboard(); return 'ok'; }
    if (typeof DOE.requestPermission === 'function') {
      try { if (await DOE.requestPermission() !== 'granted') return 'denied'; } catch { return 'denied'; }
    }
    if (!this.bound) {
      this.bound = this.onOrientation.bind(this);
      window.addEventListener('deviceorientation', this.bound);
      window.addEventListener('deviceorientationabsolute', this.bound as EventListener);
    }
    // wait briefly for a real reading
    const t0 = performance.now();
    while (performance.now() - t0 < 1500) {
      if (this.available) return 'ok';
      await new Promise(r => setTimeout(r, 50));
    }
    if (this.available) return 'ok';
    // no motion sensors after all: fall back to the keyboard
    this.useKeyboard();
    return 'ok';
  }

  /** Keyboard aiming: the left and right arrow keys (or A and D) turn the gun while held. */
  useKeyboard() {
    this.available = true; this.keyboard = true; this.flatness = 0;
    if (this.keysInstalled) return;
    this.keysInstalled = true;
    const held = new Set<string>();
    const sync = () => { this.keys = (held.has('r') ? 1 : 0) - (held.has('l') ? 1 : 0); };
    const side = (e: KeyboardEvent) => e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A' ? 'l' : e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D' ? 'r' : null;
    window.addEventListener('keydown', e => { const k = side(e); if (k) { held.add(k); sync(); e.preventDefault(); } });
    window.addEventListener('keyup', e => { const k = side(e); if (k) { held.delete(k); sync(); } });
    window.addEventListener('blur', () => { held.clear(); sync(); });
  }

  private installDebug() {
    if (this.debugInstalled) return;
    this.debugInstalled = true;
    // Developer testing only (?debug): mouse x or arrow keys stand in for the phone's roll.
    window.addEventListener('mousemove', e => { if (e.buttons === 0 || !e.shiftKey) this.raw = ((e.clientX / innerWidth) - .5) * 2 * 1.2; });
    window.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') this.keys = -1; if (e.key === 'ArrowRight') this.keys = 1; if (e.key === 'f') this.flatness = this.flatness > .5 ? 0 : 1; });
    window.addEventListener('keyup', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') this.keys = 0; });
  }

  calibrate() { this.offset = this.raw; this.filter.reset(); }

  update(t: number, dt: number): number {
    // held keys turn the gun steadily; it stops at the same limit tilting does
    if (this.keyboard && this.keys) this.raw = this.offset + Math.max(-1.2, Math.min(1.2, this.raw - this.offset + this.keys * dt * 1.1));
    this.value = this.filter.filter(this.raw - this.offset, t);
    return this.value;
  }

  /** sensors stopped reporting (e.g. permission revoked) */
  stale() { return !this.keyboard && performance.now() - this.lastEvent > 2500; }
}

/** A computer: a precise pointer and no touch screen. */
export function isComputer() { return matchMedia('(pointer: fine)').matches && !matchMedia('(any-pointer: coarse)').matches && navigator.maxTouchPoints === 0; }

export const Tilt = new TiltInput();
