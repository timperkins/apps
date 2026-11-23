import { makeCanvas } from './pix';

// Crisp pixel text: Silkscreen at 8px, drawn once and thresholded so there is no anti-aliasing.
const FONT = '8px Silkscreen, monospace';
const cache = new Map<string, HTMLCanvasElement>();
let measurer: CanvasRenderingContext2D | null = null;

export function loadPixelFont(): Promise<unknown> {
  return document.fonts?.load(FONT).catch(() => undefined) ?? Promise.resolve();
}

export function textWidth(s: string): number {
  measurer ??= makeCanvas(1, 1).getContext('2d')!;
  measurer.font = FONT;
  return Math.ceil(measurer.measureText(s.toUpperCase()).width);
}

// Returns a canvas with the text in `color`, plus an optional 1px drop shadow.
export function textSprite(s: string, color: string, shadow?: string): HTMLCanvasElement {
  const key = `${s}|${color}|${shadow ?? ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const text = s.toUpperCase();
  const w = textWidth(text) + 3;
  const c = makeCanvas(w, 12);
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.font = FONT;
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#fff';
  ctx.fillText(text, 1, 1);
  const img = ctx.getImageData(0, 0, w, 12);
  const out = ctx.createImageData(w, 12);
  const paint = (hexColor: string, ox: number, oy: number) => {
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    for (let y = 0; y < 12; y++)
      for (let x = 0; x < w; x++) {
        if (img.data[(y * w + x) * 4 + 3] <= 110) continue;
        const tx = x + ox;
        const ty = y + oy - 1;
        if (tx < 0 || ty < 0 || tx >= w || ty >= 12) continue;
        const i = (ty * w + tx) * 4;
        out.data[i] = r;
        out.data[i + 1] = g;
        out.data[i + 2] = b;
        out.data[i + 3] = 255;
      }
  };
  if (shadow) paint(shadow, 1, 1);
  paint(color, 0, 0);
  ctx.clearRect(0, 0, w, 12);
  ctx.putImageData(out, 0, 0);
  if (cache.size > 400) cache.clear();
  cache.set(key, c);
  return c;
}
