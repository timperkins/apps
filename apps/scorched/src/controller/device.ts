/**
 * Phone niceties that browsers support unevenly. Every call here is best-effort: iOS Safari,
 * for example, has no orientation lock and no full screen, and the controller works without them.
 */

type WakeLock = { release: () => Promise<void>; released: boolean };
type WakeLockNav = Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLock> } };
type LockableOrientation = ScreenOrientation & { lock?: (o: string) => Promise<void> };

let wake: WakeLock | null = null;
let wantAwake = false;

async function requestWake(): Promise<void> {
  const nav = navigator as WakeLockNav;
  if (!wantAwake || !nav.wakeLock || (wake && !wake.released) || document.visibilityState !== 'visible') return;
  try {
    wake = await nav.wakeLock.request('screen');
  } catch {
    /* refused, e.g. battery saver */
  }
}

/** Keeps the screen on while the phone is in a game. */
export function keepAwake(on: boolean): void {
  wantAwake = on;
  if (on) void requestWake();
  else {
    void wake?.release().catch(() => {});
    wake = null;
  }
}

// The browser drops the wake lock whenever the page is hidden; take it back on return.
document.addEventListener('visibilitychange', () => void requestWake());

/** Asks for full screen. Must be called from a tap. */
export function enterFullscreen(): void {
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
  if (document.fullscreenElement) return;
  try {
    if (el.requestFullscreen) void el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
    else el.webkitRequestFullscreen?.();
  } catch {
    /* not allowed here */
  }
}

/** Locks to landscape where the browser allows it (Android, in full screen). */
export function lockLandscape(on: boolean): void {
  const o = screen.orientation as LockableOrientation | undefined;
  try {
    if (on) void o?.lock?.('landscape')?.catch(() => {});
    else o?.unlock?.();
  } catch {
    /* not supported */
  }
}
