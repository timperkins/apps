// Pixel buffers, noise and colour helpers. Every sprite in the game is drawn
// procedurally into one of these buffers and then copied to a canvas.

export type RGB = [number, number, number];

export function hex(h: string): RGB {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function shade(c: RGB, f: number): RGB {
  // f > 0 lightens towards white, f < 0 darkens towards black.
  if (f >= 0) return [c[0] + (255 - c[0]) * f, c[1] + (255 - c[1]) * f, c[2] + (255 - c[2]) * f];
  const k = 1 + f;
  return [c[0] * k, c[1] * k, c[2] * k];
}

export function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function css(c: RGB, a = 1): string {
  return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
}

export function hash2(x: number, y: number, s: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function vnoise(x: number, y: number, s: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s);
  const b = hash2(xi + 1, yi, s);
  const c = hash2(xi, yi + 1, s);
  const d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x: number, y: number, s: number, oct = 4): number {
  let t = 0;
  let amp = 0.5;
  let f = 1;
  let norm = 0;
  for (let i = 0; i < oct; i++) {
    t += amp * vnoise(x * f, y * f, s + i * 17);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return t / norm;
}

export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

export class Pix {
  readonly data: Uint8ClampedArray;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.data = new Uint8ClampedArray(w * h * 4);
  }

  set(x: number, y: number, c: RGB, a = 255): void {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    if (a >= 255 || this.data[i + 3] === 0) {
      this.data[i] = c[0];
      this.data[i + 1] = c[1];
      this.data[i + 2] = c[2];
      this.data[i + 3] = a;
      return;
    }
    const t = a / 255;
    this.data[i] += (c[0] - this.data[i]) * t;
    this.data[i + 1] += (c[1] - this.data[i + 1]) * t;
    this.data[i + 2] += (c[2] - this.data[i + 2]) * t;
    this.data[i + 3] = Math.max(this.data[i + 3], a);
  }

  alpha(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.data[(y * this.w + x) * 4 + 3];
  }

  rect(x: number, y: number, w: number, h: number, c: RGB | ((x: number, y: number) => RGB), a = 255): void {
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) this.set(x + i, y + j, typeof c === 'function' ? c(x + i, y + j) : c, a);
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: RGB | ((x: number, y: number) => RGB), a = 255): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, typeof c === 'function' ? c(x, y) : c, a);
      }
  }

  line(x0: number, y0: number, x1: number, y1: number, c: RGB, a = 255): void {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.set(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), c, a);
  }

  // Classic sprite finish: light the top-left edges, darken the bottom-right
  // ones and add a dark outline. Only fully opaque pixels count as solid, so
  // soft shadows drawn at lower alpha are left alone.
  finish(outline: RGB = [16, 20, 14], light = 0.22, dark = -0.3): this {
    const solid = (x: number, y: number) => this.alpha(x, y) === 255;
    const src = this.data.slice();
    const at = (x: number, y: number): RGB => {
      const i = (y * this.w + x) * 4;
      return [src[i], src[i + 1], src[i + 2]];
    };
    const outl: [number, number][] = [];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (solid(x, y)) {
          const up = !solid(x, y - 1) || !solid(x - 1, y);
          const dn = !solid(x, y + 1) || !solid(x + 1, y);
          if (up && !dn) this.set(x, y, shade(at(x, y), light));
          else if (dn && !up) this.set(x, y, shade(at(x, y), dark));
        } else if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
          outl.push([x, y]);
        }
      }
    for (const [x, y] of outl) this.set(x, y, outline, 255);
    return this;
  }

  // Grain: nudge each opaque pixel's brightness by a small random amount.
  grain(amount: number, seed: number): this {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const i = (y * this.w + x) * 4;
        if (this.data[i + 3] !== 255) continue;
        const d = (hash2(x, y, seed) - 0.5) * 2 * amount;
        this.data[i] += d;
        this.data[i + 1] += d;
        this.data[i + 2] += d;
      }
    return this;
  }

  shadow(alpha = 0.38): Pix {
    const p = new Pix(this.w, this.h);
    for (let i = 0; i < this.data.length; i += 4) {
      if (this.data[i + 3] > 0) p.data[i + 3] = Math.round(255 * alpha);
    }
    return p;
  }

  canvas(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.w;
    c.height = this.h;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(this.w, this.h);
    img.data.set(this.data);
    ctx.putImageData(img, 0, 0);
    return c;
  }
}

// A shader receives local sprite coordinates (u forward, v to the right of
// travel) and returns a colour, or null for transparent.
export type Shader = (u: number, v: number, sx: number, sy: number) => RGB | null;

// Renders a top-down vehicle in `dirs` evenly spaced headings by sampling the
// shader per output pixel, so rotated frames stay crisp instead of blurry.
export function rotFrames(size: number, dirs: number, shader: Shader, finish = true): { img: HTMLCanvasElement[]; shadow: HTMLCanvasElement[] } {
  const img: HTMLCanvasElement[] = [];
  const shadow: HTMLCanvasElement[] = [];
  const c = size / 2;
  for (let d = 0; d < dirs; d++) {
    const a = (d / dirs) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const p = new Pix(size, size);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const dx = x + 0.5 - c;
        const dy = y + 0.5 - c;
        const u = ca * dx + sa * dy;
        const v = -sa * dx + ca * dy;
        const col = shader(u, v, x, y);
        if (col) p.set(x, y, col);
      }
    if (finish) p.finish();
    img.push(p.canvas());
    shadow.push(p.shadow().canvas());
  }
  return { img, shadow };
}

export function dirIndex(angle: number, dirs: number): number {
  const t = angle / (Math.PI * 2);
  return ((Math.round(t * dirs) % dirs) + dirs) % dirs;
}
