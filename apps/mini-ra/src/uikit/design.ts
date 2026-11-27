// Soft Pixel, the design Tim picked, and the choices the tweak panel offers on
// top of it: a font for each kind of text, an icon set and the colors. The
// page starts on the defaults below; whatever is changed is kept in the
// address (so a link brings the same tweaks back) and in this browser.
import type { IconSet } from './icons';

// ---------- Fonts ----------

export interface Font {
  name: string;
  kind: 'Pixel' | 'Smooth';
  q: string; // the family as Google Fonts asks for it
  w: number; // weight for headings
}

export const FONTS: Font[] = [
  { name: 'VT323', kind: 'Pixel', q: 'VT323', w: 400 },
  { name: 'Pixelify Sans', kind: 'Pixel', q: 'Pixelify+Sans:wght@400;500;600;700', w: 600 },
  { name: 'Silkscreen', kind: 'Pixel', q: 'Silkscreen:wght@400;700', w: 400 },
  { name: 'Handjet', kind: 'Pixel', q: 'Handjet:wght@400;500;600;700', w: 600 },
  { name: 'Jersey 10', kind: 'Pixel', q: 'Jersey+10', w: 400 },
  { name: 'Jersey 15', kind: 'Pixel', q: 'Jersey+15', w: 400 },
  { name: 'Tiny5', kind: 'Pixel', q: 'Tiny5', w: 400 },
  { name: 'Micro 5', kind: 'Pixel', q: 'Micro+5', w: 400 },
  { name: 'Bytesized', kind: 'Pixel', q: 'Bytesized', w: 400 },
  { name: 'Workbench', kind: 'Pixel', q: 'Workbench', w: 400 },
  { name: 'DotGothic16', kind: 'Pixel', q: 'DotGothic16', w: 400 },
  { name: 'Doto', kind: 'Pixel', q: 'Doto:wght@400;600;800', w: 800 },
  { name: 'Press Start 2P', kind: 'Pixel', q: 'Press+Start+2P', w: 400 },
  { name: 'Kode Mono', kind: 'Smooth', q: 'Kode+Mono:wght@400;500;600;700', w: 600 },
  { name: 'Share Tech Mono', kind: 'Smooth', q: 'Share+Tech+Mono', w: 400 },
  { name: 'Space Mono', kind: 'Smooth', q: 'Space+Mono:wght@400;700', w: 700 },
  { name: 'Chakra Petch', kind: 'Smooth', q: 'Chakra+Petch:wght@400;500;600;700', w: 600 },
  { name: 'Oxanium', kind: 'Smooth', q: 'Oxanium:wght@400;500;600;700', w: 600 },
  { name: 'Rajdhani', kind: 'Smooth', q: 'Rajdhani:wght@400;500;600;700', w: 600 },
  { name: 'Saira Condensed', kind: 'Smooth', q: 'Saira+Condensed:wght@400;500;600;700', w: 600 },
  { name: 'Barlow Condensed', kind: 'Smooth', q: 'Barlow+Condensed:wght@400;500;600;700', w: 600 },
  { name: 'Teko', kind: 'Smooth', q: 'Teko:wght@400;500;600;700', w: 500 },
  { name: 'Allerta Stencil', kind: 'Smooth', q: 'Allerta+Stencil', w: 400 },
  { name: 'Stardos Stencil', kind: 'Smooth', q: 'Stardos+Stencil:wght@400;700', w: 700 },
];

// The four kinds of text in the game. The key is the CSS variable's letter
// (--f-d and so on in kit.css).
export type Role = 'd' | 'b' | 'l' | 'n';
export const ROLES: { id: Role; name: string; note: string; sample: string }[] = [
  { id: 'd', name: 'Headings', note: 'Titles, Victory, the RA logo', sample: 'Choose a map' },
  { id: 'b', name: 'Body text', note: 'Blurbs, tooltips, inputs, prices', sample: 'Builds vehicles. Opens the Vehicles tab.' },
  { id: 'l', name: 'Labels and buttons', note: 'Buttons, item names, toasts, small labels', sample: 'Host a game · Settings' },
  { id: 'n', name: 'Numbers', note: 'Credits, counts, progress, the room code', sample: '12,450 · 40% · 14:32' },
];

// ---------- Icons ----------

export const ICON_SETS: { id: IconSet; name: string; note: string }[] = [
  { id: 'pixel', name: 'Chunky pixel', note: 'The game’s own 11-pixel icons' },
  { id: 'outline', name: 'Outlined pixel', note: 'The game’s icons with a dark edge, like stickers' },
  { id: 'glyph', name: 'Pixel glyph', note: 'Solid shapes redrawn on a 12-pixel grid' },
  { id: 'fine', name: 'Fine pixel', note: 'One-pixel lines on a 16-pixel grid' },
  { id: 'solid', name: 'Smooth solid', note: 'Filled vector shapes' },
  { id: 'line', name: 'Smooth line', note: 'Thin vector strokes' },
];

// ---------- Colors ----------

import { NIGHT_OPS, type ColorKey, type Colors } from '../theme';
export type { ColorKey, Colors };

export const COLOR_KEYS: { id: ColorKey; name: string; note: string }[] = [
  { id: 'panel', name: 'Panels', note: 'Panels and buttons; the page is a darker shade' },
  { id: 'edge', name: 'Outline', note: 'The dark pixel outline round everything' },
  { id: 'trim', name: 'Trim', note: 'The inner line on panels and the globe' },
  { id: 'ink', name: 'Text', note: 'Text, and the toast messages' },
  { id: 'accent', name: 'Main buttons', note: 'Play, Deploy, Start, prices, sliders' },
  { id: 'on', name: 'Switched on', note: 'The selected tool, tab or unit' },
  { id: 'good', name: 'Good', note: 'New items, ready, unlocked' },
  { id: 'danger', name: 'Danger', note: 'Leave game, can’t afford, errors' },
];

export const PRESETS: { id: string; name: string; c: Colors }[] = [
  { id: 'teal', name: 'Soft teal', c: { panel: '#1a3640', edge: '#07141a', trim: '#d9c08a', ink: '#f2e3bc', accent: '#f08a5c', on: '#f2e3bc', good: '#8fe0c0', danger: '#c0453a' } },
  { id: 'navy', name: 'Navy and brass', c: { panel: '#1b2440', edge: '#060912', trim: '#a8873c', ink: '#eef0f8', accent: '#e0b04a', on: '#3f82d6', good: '#5fd2ff', danger: '#b8432f' } },
  { id: 'olive', name: 'Olive drab', c: { panel: '#2e3822', edge: '#0d1108', trim: '#c9b47a', ink: '#ede7cc', accent: '#e3a23a', on: '#d9d09c', good: '#b0dc6a', danger: '#b8432f' } },
  { id: 'desert', name: 'Desert', c: { panel: '#4a3826', edge: '#1a1006', trim: '#e9c98c', ink: '#f7ebd3', accent: '#e07a3a', on: '#f0dca8', good: '#9fd4a4', danger: '#c0453a' } },
  { id: 'cobalt', name: 'Cobalt', c: { panel: '#1e2d4e', edge: '#070c18', trim: '#8fb2dc', ink: '#eaf0fa', accent: '#f0b43c', on: '#4f74a8', good: '#7fd6ff', danger: '#c0453a' } },
  { id: 'gunmetal', name: 'Gunmetal', c: { panel: '#2a2f36', edge: '#0b0d11', trim: '#8a96a6', ink: '#e8edf3', accent: '#ff9a3c', on: '#c8d2de', good: '#8fe0a0', danger: '#c8483a' } },
  { id: 'night', name: 'Night ops', c: { ...NIGHT_OPS } },
  { id: 'ember', name: 'Ember', c: { panel: '#3a1e1a', edge: '#120705', trim: '#e0a060', ink: '#f6e4d6', accent: '#ffb347', on: '#f0c8a0', good: '#a8e08a', danger: '#ff5a46' } },
];

// ---------- The whole set of choices ----------

export interface Design {
  fonts: Record<Role, string>;
  icons: IconSet;
  colors: Colors;
}

export const DEFAULT: Design = {
  fonts: { d: 'Jersey 15', b: 'Handjet', l: 'Handjet', n: 'Handjet' },
  icons: 'line',
  colors: { ...NIGHT_OPS },
};

// In the address: #d=VT323&b=Pixelify+Sans&l=…&n=…&i=pixel&c=1a3640-07141a-…
export function toHash(d: Design): string {
  const p = new URLSearchParams();
  for (const r of ROLES) if (d.fonts[r.id] !== DEFAULT.fonts[r.id]) p.set(r.id, d.fonts[r.id]);
  if (d.icons !== DEFAULT.icons) p.set('i', d.icons);
  const c = COLOR_KEYS.map((k) => d.colors[k.id].slice(1)).join('-');
  if (c !== COLOR_KEYS.map((k) => DEFAULT.colors[k.id].slice(1)).join('-')) p.set('c', c);
  return p.toString();
}

export function fromHash(h: string): Design | null {
  const p = new URLSearchParams(h.replace(/^#/, ''));
  if (![...p.keys()].some((k) => ['d', 'b', 'l', 'n', 'i', 'c'].includes(k))) return null;
  const d: Design = structuredClone(DEFAULT);
  for (const r of ROLES) {
    const f = p.get(r.id);
    if (f && FONTS.some((x) => x.name === f)) d.fonts[r.id] = f;
  }
  const i = p.get('i');
  if (i && ICON_SETS.some((x) => x.id === i)) d.icons = i as IconSet;
  const c = p.get('c')?.split('-') ?? [];
  COLOR_KEYS.forEach((k, j) => {
    if (/^[0-9a-f]{6}$/i.test(c[j] ?? '')) d.colors[k.id] = `#${c[j].toLowerCase()}`;
  });
  return d;
}

