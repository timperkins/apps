// The game's look: Soft Pixel, in the Night ops colors, as Tim picked it on
// the UI kit page (/ui/). Everything is drawn from eight colors: the rounded
// pixel frames (frames.ts) become CSS border-images, and the rest become CSS
// variables, which style.css and theme.css use.
import { pixelFrame } from './frames';

export type ColorKey = 'panel' | 'edge' | 'trim' | 'ink' | 'accent' | 'on' | 'good' | 'danger';
export type Colors = Record<ColorKey, string>;

export const NIGHT_OPS: Colors = { panel: '#141c1c', edge: '#040707', trim: '#4fa070', ink: '#cfe8d4', accent: '#5fe08a', on: '#2f6a48', good: '#5fe08a', danger: '#e05a46' };

// ---------- Color math ----------

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (c: number[]) => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
export const mix = (a: string, b: string, t: number) => {
  const x = rgb(a), y = rgb(b);
  return hex(x.map((v, i) => v + (y[i] - v) * t));
};
const lum = (h: string) => {
  const [r, g, b] = rgb(h).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
// Dark text on a light color, light text on a dark one.
export const inkOn = (bg: string, dark: string, light = '#ffffff') => (lum(bg) > 0.3 ? dark : light);
export const rgba = (h: string, a: number) => `rgba(${rgb(h).join(', ')}, ${a})`;

// The panel frames (see frames.ts) and the color variables, from the eight
// colors picked.
const STEPS = [5, 3, 2, 1, 1];
export function themeVars(c: Colors): Record<string, string> {
  const W = '#ffffff', K = '#000000';
  const f = (fill: string, line: string, trim?: string) => pixelFrame({ fill, line, hi: mix(fill, W, 0.18), lo: mix(fill, K, 0.3), trim, steps: STEPS });
  const btn = mix(c.panel, c.ink, 0.1);
  const hover = mix(c.panel, c.ink, 0.17);
  const well = mix(c.panel, K, 0.42);
  const dark = (x: string) => mix(x, K, 0.82);
  return {
    '--fr-panel': f(c.panel, c.edge, c.trim),
    '--fr-btn': f(btn, c.edge),
    '--fr-hover': f(hover, c.edge),
    '--fr-on': f(c.on, dark(c.on)),
    '--fr-primary': f(c.accent, dark(c.accent)),
    '--fr-danger': f(c.danger, dark(c.danger)),
    '--fr-well': pixelFrame({ fill: well, line: c.edge, hi: mix(well, K, 0.25), lo: mix(c.panel, W, 0.1), steps: STEPS }),
    '--fr-toast': f(c.ink, dark(c.ink)),
    '--page': mix(c.panel, K, 0.58),
    '--page-2': mix(c.panel, K, 0.4),
    '--card': mix(c.panel, K, 0.5),
    '--card-line': rgba(c.ink, 0.1),
    '--panel-solid': c.panel,
    '--line': c.edge,
    '--trim': c.trim,
    '--ink': c.ink,
    '--page-ink': c.ink,
    '--dim': mix(c.ink, c.panel, 0.38),
    '--page-dim': mix(c.ink, c.panel, 0.42),
    '--accent': c.accent,
    '--accent-ink': dark(c.accent),
    '--bubble': c.accent,
    '--bubble-ink': dark(c.accent),
    '--thumb': c.accent,
    '--thumb-line': dark(c.accent),
    '--accent-2': c.good,
    '--ok': c.good,
    '--new-ink': dark(c.good),
    '--danger': mix(c.danger, W, 0.25),
    '--on': c.on,
    '--on-ink': inkOn(c.on, mix(c.panel, K, 0.3)),
    '--sel': mix(c.ink, W, 0.4),
    '--mini-view': mix(c.ink, W, 0.4),
    '--toast-ink': inkOn(c.ink, mix(c.panel, K, 0.3)),
    '--move-line': rgba(mix(c.ink, W, 0.4), 0.85),
    '--title-shadow': `0 3px 0 ${c.edge}`,
    '--track': well,
    '--track-shadow': `inset 0 0 0 2px ${c.edge}`,
    '--pwr-track': c.edge,
  };
}

// Sets the variables on the page.
export function applyTheme(c: Colors = NIGHT_OPS, el: HTMLElement = document.documentElement): void {
  for (const [k, v] of Object.entries(themeVars(c))) el.style.setProperty(k, v);
}
