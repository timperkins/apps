// Pixel-art helpers: colors, ordered dithering, a sprite grid and a framebuffer for painting
// the background pixel by pixel.

export type RGB = [number, number, number];
export type Color = string | RGB;

export function hex(h: string): RGB {
  const s = h.replace('#', '');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

export const rgb = (c: Color): RGB => (typeof c === 'string' ? hex(c) : c);

export function mix(a: Color, b: Color, t: number): RGB {
  const x = rgb(a);
  const y = rgb(b);
  return [x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t];
}

export const css = (c: Color): string => {
  const [r, g, b] = rgb(c);
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
};

const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bay = (x: number, y: number): number => (B4[(x & 3) + ((y & 3) << 2)] + 0.5) / 16;

// A seeded random number generator so the scene looks the same every time.
export function seeded(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function grad(stops: Color[], t: number, x: number, y: number): RGB {
  const v = Math.max(0, Math.min(0.9999, t)) * (stops.length - 1);
  const i = Math.floor(v);
  const f = v - i;
  return rgb(stops[bay(x, y) < f ? Math.min(i + 1, stops.length - 1) : i]);
}

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// A small sprite drawn pixel by pixel, then turned into a canvas.
export class Grid {
  p: (RGB | null)[];
  a: number[];
  constructor(
    public w: number,
    public h: number,
  ) {
    this.p = new Array(w * h).fill(null);
    this.a = new Array(w * h).fill(1);
  }

  set(x: number, y: number, c: Color | null, alpha = 1): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.p[y * this.w + x] = c === null ? null : rgb(c);
    this.a[y * this.w + x] = alpha;
  }

  get(x: number, y: number): RGB | null {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.p[y * this.w + x];
  }

  rect(x: number, y: number, w: number, h: number, c: Color): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }

  line(x0: number, y0: number, x1: number, y1: number, c: Color): void {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0;
    for (let k = 0; k <= n; k++) {
      const t = n ? k / n : 0;
      this.set(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, c);
    }
  }

  // Outlines each shape with a darker version of the color next to it.
  outlineAuto(f = 0.38, tint: Color = '#141a3a'): this {
    const out: [number, number, RGB][] = [];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y)) continue;
        const n = this.get(x, y + 1) || this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1);
        if (n) out.push([x, y, n]);
      }
    for (const [x, y, n] of out) this.set(x, y, mix([n[0] * f, n[1] * f, n[2] * f], tint, 0.35));
    return this;
  }

  // A soft two-pixel glow around the shape, in a player's color.
  glow(color: Color): Grid {
    const g = new Grid(this.w + 4, this.h + 4);
    const m = (x: number, y: number) => !!this.get(x - 2, y - 2);
    for (let y = 0; y < g.h; y++)
      for (let x = 0; x < g.w; x++) {
        if (m(x, y)) continue;
        if (m(x - 1, y) || m(x + 1, y) || m(x, y - 1) || m(x, y + 1)) g.set(x, y, color, 0.95);
        else if ([[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, 1], [-1, 1], [1, -1]].some(([a, b]) => m(x + a, y + b))) g.set(x, y, color, 0.4);
      }
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.get(x, y)) g.set(x + 2, y + 2, this.get(x, y), this.a[y * this.w + x]);
    return g;
  }

  // Tints rows below `fromY` toward the water color, for boats that sit in the sea.
  submerge(fromY: number): this {
    for (let y = fromY; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const c = this.get(x, y);
        if (c) this.set(x, y, mix(c, '#2aa9bf', 0.3 + 0.35 * Math.min(1, (y - fromY) / 14)));
      }
    return this;
  }

  toCanvas(flip = false): HTMLCanvasElement {
    const c = makeCanvas(this.w, this.h);
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(this.w, this.h);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const v = this.p[y * this.w + x];
        if (!v) continue;
        const sx = flip ? this.w - 1 - x : x;
        const i = (y * this.w + sx) * 4;
        img.data[i] = v[0];
        img.data[i + 1] = v[1];
        img.data[i + 2] = v[2];
        img.data[i + 3] = Math.round(this.a[y * this.w + x] * 255);
      }
    ctx.putImageData(img, 0, 0);
    return c;
  }
}

// A full-scene RGBA buffer used to paint the static background once.
export class Frame {
  data: Uint8ClampedArray<ArrayBuffer>;
  constructor(
    public w: number,
    public h: number,
  ) {
    this.data = new Uint8ClampedArray(w * h * 4);
  }

  px(x: number, y: number, c: Color, a = 1): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const v = rgb(c);
    const i = (y * this.w + x) * 4;
    const d = this.data;
    if (a >= 1) {
      d[i] = v[0];
      d[i + 1] = v[1];
      d[i + 2] = v[2];
    } else {
      d[i] += (v[0] - d[i]) * a;
      d[i + 1] += (v[1] - d[i + 1]) * a;
      d[i + 2] += (v[2] - d[i + 2]) * a;
    }
    d[i + 3] = 255;
  }

  rect(x: number, y: number, w: number, h: number, c: Color, a = 1): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c, a);
  }

  blit(g: Grid, X: number, Y: number, flip = false, alpha = 1): void {
    X = Math.round(X);
    Y = Math.round(Y);
    for (let y = 0; y < g.h; y++)
      for (let x = 0; x < g.w; x++) {
        const c = g.p[y * g.w + x];
        if (!c) continue;
        this.px(X + (flip ? g.w - 1 - x : x), Y + y, c, g.a[y * g.w + x] * alpha);
      }
  }

  toCanvas(): HTMLCanvasElement {
    const c = makeCanvas(this.w, this.h);
    c.getContext('2d')!.putImageData(new ImageData(this.data, this.w, this.h), 0, 0);
    return c;
  }
}
