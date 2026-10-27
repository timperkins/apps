// Turns phone tilt into a paddle position from 0 (top) to 1 (bottom).

export type MotionResult = 'granted' | 'denied' | 'unsupported';

interface IOSOrientationEvent {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

// iPhone needs explicit permission, requested from a tap; Android grants it over HTTPS.
export async function requestMotionPermission(): Promise<MotionResult> {
  if (typeof DeviceOrientationEvent === 'undefined') return 'unsupported';
  const ios = DeviceOrientationEvent as unknown as IOSOrientationEvent;
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
    const onEvent = (e: DeviceOrientationEvent) => {
      if (e.beta === null) return;
      cleanup();
      resolve(true);
    };
    const timer = setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener('deviceorientation', onEvent);
    };
    window.addEventListener('deviceorientation', onEvent);
  });
}

export interface TiltSettings {
  // Degrees of tilt either side of neutral that cover the full paddle range.
  range: number;
  invert: boolean;
}

export const DEFAULT_SETTINGS: TiltSettings = { range: 30, invert: false };
const SMOOTHING = 0.35;
const DEAD_ZONE_DEG = 2;

// Pure mapping, kept separate so it can be unit tested.
export function tiltToPosition(beta: number, neutral: number, settings: TiltSettings): number {
  let delta = beta - neutral;
  if (Math.abs(delta) < DEAD_ZONE_DEG) delta = 0;
  else delta -= Math.sign(delta) * DEAD_ZONE_DEG;
  // Tipping the top of the phone away from you (beta falls) moves the paddle up.
  const signed = settings.invert ? -delta : delta;
  const y = 0.5 + signed / (2 * (settings.range - DEAD_ZONE_DEG));
  return Math.min(1, Math.max(0, y));
}

export class TiltController {
  private neutral: number | null = null;
  private beta: number | null = null;
  private smoothed = 0.5;

  constructor(
    public settings: TiltSettings,
    private onPosition: (y: number) => void,
  ) {
    window.addEventListener('deviceorientation', this.handle);
  }

  // Treats the way the phone is held right now as the middle of the screen.
  calibrate(): void {
    if (this.beta !== null) this.neutral = this.beta;
  }

  get calibrated(): boolean {
    return this.neutral !== null;
  }

  dispose(): void {
    window.removeEventListener('deviceorientation', this.handle);
  }

  private handle = (e: DeviceOrientationEvent) => {
    if (e.beta === null) return;
    this.beta = e.beta;
    if (this.neutral === null) return;
    const target = tiltToPosition(e.beta, this.neutral, this.settings);
    this.smoothed += (target - this.smoothed) * SMOOTHING;
    this.onPosition(this.smoothed);
  };
}
