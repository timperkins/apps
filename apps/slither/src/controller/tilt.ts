// Turns the phone into a steering wheel: hold it sideways and turn it left or right.
// The roll comes from the gravity vector, which stays steady however far the phone leans back.

export type MotionResult = 'granted' | 'denied' | 'unsupported';

interface IOSMotionEvent {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

// iPhone needs explicit permission, requested from a tap; Android grants it over HTTPS.
export async function requestMotionPermission(): Promise<MotionResult> {
  if (typeof DeviceMotionEvent === 'undefined') return 'unsupported';
  const ios = DeviceMotionEvent as unknown as IOSMotionEvent;
  if (typeof ios.requestPermission === 'function') {
    try {
      return (await ios.requestPermission()) === 'granted' ? 'granted' : 'denied';
    } catch {
      return 'denied';
    }
  }
  return 'granted';
}

// Resolves true once a real reading arrives; desktops and sensorless phones never send one.
export function detectSensor(timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const onEvent = (e: DeviceMotionEvent) => {
      if (e.accelerationIncludingGravity?.x == null) return;
      cleanup();
      resolve(true);
    };
    const timer = setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener('devicemotion', onEvent);
    };
    window.addEventListener('devicemotion', onEvent);
  });
}

export interface TiltSettings {
  // Degrees of turn either side of neutral for a full turn.
  range: number;
  invert: boolean;
}

export const DEFAULT_SETTINGS: TiltSettings = { range: 35, invert: false };
const SMOOTHING = 0.4;
const DEAD_ZONE_DEG = 3;
// Below this much gravity in the screen's plane the phone is lying flat and roll means nothing.
const MIN_PLANE_G = 3;

// Angle of gravity in the screen's plane, in degrees. iPhone and Android report gravity with
// opposite signs, which shifts this by 180 degrees; only differences from neutral are used.
export function rollFromGravity(x: number, y: number): number {
  return (Math.atan2(x, y) * 180) / Math.PI;
}

function wrapDegrees(d: number): number {
  return d - 360 * Math.round(d / 360);
}

// Pure mapping, kept separate so it can be unit tested. Turning the phone clockwise steers right.
export function rollToSteer(roll: number, neutral: number, settings: TiltSettings): number {
  let delta = wrapDegrees(neutral - roll);
  if (Math.abs(delta) < DEAD_ZONE_DEG) delta = 0;
  else delta -= Math.sign(delta) * DEAD_ZONE_DEG;
  const s = delta / (settings.range - DEAD_ZONE_DEG);
  return Math.max(-1, Math.min(1, settings.invert ? -s : s));
}

export class TiltController {
  private neutral: number | null = null;
  private roll: number | null = null;
  private smoothed = 0;

  constructor(
    public settings: TiltSettings,
    private onSteer: (s: number) => void,
  ) {
    window.addEventListener('devicemotion', this.handle);
  }

  // Treats the way the phone is held right now as straight ahead.
  calibrate(): void {
    if (this.roll !== null) this.neutral = this.roll;
  }

  get calibrated(): boolean {
    return this.neutral !== null;
  }

  dispose(): void {
    window.removeEventListener('devicemotion', this.handle);
  }

  private handle = (e: DeviceMotionEvent) => {
    const g = e.accelerationIncludingGravity;
    if (g?.x == null || g.y == null) return;
    if (Math.hypot(g.x, g.y) < MIN_PLANE_G) return;
    this.roll = rollFromGravity(g.x, g.y);
    if (this.neutral === null) this.neutral = this.roll;
    const target = rollToSteer(this.roll, this.neutral, this.settings);
    this.smoothed += (target - this.smoothed) * SMOOTHING;
    this.onSteer(this.smoothed);
  };
}
