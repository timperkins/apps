// The player's settings (the Settings panel in the menu): how loud the music,
// sounds and voices are, and how fast the keys scroll and the wheel zooms.
// Kept in localStorage under 'ra.settings', so they stay across visits.
// The audio modules read their volume from here and follow changes.

export interface Settings {
  music: number; // 0..1, 0 is off
  sfx: number; // 0..1
  voice: number; // 0..1
  scroll: number; // keyboard pan speed, times the default (0.25..3)
  zoom: number; // wheel zoom speed, times the default (0.25..3)
}

export const DEFAULTS: Settings = { music: 1, sfx: 1, voice: 1, scroll: 1, zoom: 1 };

const KEY = 'ra.settings';
const RANGE: Record<keyof Settings, [number, number]> = {
  music: [0, 1],
  sfx: [0, 1],
  voice: [0, 1],
  scroll: [0.25, 3],
  zoom: [0.25, 3],
};

function clamp(k: keyof Settings, v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : DEFAULTS[k];
  const [lo, hi] = RANGE[k];
  return Math.min(hi, Math.max(lo, n));
}

function read(): Settings {
  const s = { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const got = JSON.parse(raw) as Partial<Settings>;
      for (const k of Object.keys(DEFAULTS) as (keyof Settings)[]) s[k] = clamp(k, got[k]);
    } else {
      // the old on/off buttons
      if (localStorage.getItem('ra.music') === 'off') s.music = 0;
      if (localStorage.getItem('ra.sfx') === 'off') s.sfx = 0;
      if (localStorage.getItem('ra.voice') === 'off') s.voice = 0;
    }
  } catch {
    /* private window, or a bad value: defaults */
  }
  return s;
}

const now: Settings = typeof window !== 'undefined' ? read() : { ...DEFAULTS };
const fns: ((s: Settings) => void)[] = [];

export function settings(): Readonly<Settings> {
  return now;
}

export function setSetting<K extends keyof Settings>(k: K, v: number): void {
  now[k] = clamp(k, v);
  try {
    localStorage.setItem(KEY, JSON.stringify(now));
  } catch {
    /* private window */
  }
  for (const f of fns) f(now);
}

export function resetSettings(): void {
  for (const k of Object.keys(DEFAULTS) as (keyof Settings)[]) now[k] = DEFAULTS[k];
  try {
    localStorage.setItem(KEY, JSON.stringify(now));
  } catch {
    /* private window */
  }
  for (const f of fns) f(now);
}

/** Calls f whenever a setting changes. */
export function onSettings(f: (s: Settings) => void): void {
  fns.push(f);
}
