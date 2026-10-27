/**
 * Full screen support. Browsers only allow entering full screen from a user gesture, so the game
 * asks for it on the player's first click, tap or key press, and offers a toggle after that.
 */

const PREF_KEY = 'scorched.fullscreen';

type FsDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => void };

const doc = document as FsDocument;
const root = document.documentElement as FsElement;

export function fullscreenSupported(): boolean {
  return Boolean(document.fullscreenEnabled || root.webkitRequestFullscreen);
}

export function isFullscreen(): boolean {
  return Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement);
}

function enter(): Promise<void> {
  if (root.requestFullscreen) return root.requestFullscreen({ navigationUI: 'hide' });
  root.webkitRequestFullscreen?.();
  return Promise.resolve();
}

function exit(): void {
  if (document.exitFullscreen) void document.exitFullscreen().catch(() => {});
  else doc.webkitExitFullscreen?.();
}

/** Whether the player wants full screen on launch (on unless they turned it off). */
function wanted(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== '0';
  } catch {
    return true;
  }
}

function setWanted(on: boolean): void {
  try {
    localStorage.setItem(PREF_KEY, on ? '1' : '0');
  } catch {
    /* storage unavailable */
  }
}

/** Toggles full screen from a button press, remembering the choice for next time. */
export function toggleFullscreen(): void {
  if (isFullscreen()) {
    setWanted(false);
    exit();
  } else {
    setWanted(true);
    void enter().catch(() => {});
  }
}

/**
 * Enters full screen on the first gesture of the session. Leaving full screen afterwards (Esc or
 * the toggle) is respected; the game does not keep pulling the player back in.
 */
export function initFullscreen(onChange: () => void): void {
  document.addEventListener('fullscreenchange', onChange);
  document.addEventListener('webkitfullscreenchange', onChange);
  if (!fullscreenSupported() || !wanted()) return;

  const events = ['pointerdown', 'pointerup', 'keydown'] as const;
  let busy = false;
  const stop = () => events.forEach((t) => window.removeEventListener(t, onGesture, true));
  function onGesture(e: Event): void {
    if (busy) return;
    if (isFullscreen()) return stop();
    // Let the toggle button handle its own press; Escape never counts as a gesture.
    if ((e.target as HTMLElement).closest?.('[data-act="fullscreen"]')) return stop();
    if (e instanceof KeyboardEvent && (e.key === 'Escape' || e.repeat)) return;
    busy = true;
    enter()
      .then(stop)
      .catch(() => {
        /* no user activation on this event type (e.g. a touch pointerdown): try the next one */
      })
      .finally(() => (busy = false));
  }
  events.forEach((t) => window.addEventListener(t, onGesture, true));
}
