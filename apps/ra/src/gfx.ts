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

// Value noise that repeats every `p` lattice cells in x (p a whole number).
export function vnoiseP(x: number, y: number, s: number, p: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const x0 = ((xi % p) + p) % p;
  const x1 = (x0 + 1) % p;
  const a = hash2(x0, yi, s);
  const b = hash2(x1, yi, s);
  const c = hash2(x0, yi + 1, s);
  const d = hash2(x1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbmP(x: number, y: number, s: number, oct: number, p: number): number {
  let t = 0;
  let amp = 0.5;
  let f = 1;
  let norm = 0;
  for (let i = 0; i < oct; i++) {
    t += amp * vnoiseP(x * f, y * f, s + i * 17, p * f);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return t / norm;
}

// Fractal noise for a world that wraps around every `period` pixels in x,
// like fbm(x / cell, y / cellY) but seamless where the world joins up.
export type WrapNoise = (x: number, y: number, cell: number, s: number, oct?: number, cellY?: number) => number;
export function wrapNoise(period: number): WrapNoise {
  return (x, y, cell, s, oct = 4, cellY = cell) => {
    const n = Math.max(1, Math.round(period / cell));
    return fbmP((x * n) / period, y / cellY, s, oct, n);
  };
}

export function vnoise3(x: number, y: number, z: number, s: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  let u = x - xi;
  let v = y - yi;
  let w = z - zi;
  u = u * u * (3 - 2 * u);
  v = v * v * (3 - 2 * v);
  w = w * w * (3 - 2 * w);
  const z0 = xi + Math.imul(zi, 1013904223);
  const z1 = xi + Math.imul(zi + 1, 1013904223);
  const a0 = hash2(z0, yi, s);
  const b0 = hash2(z0 + 1, yi, s);
  const c0 = hash2(z0, yi + 1, s);
  const d0 = hash2(z0 + 1, yi + 1, s);
  const a1 = hash2(z1, yi, s);
  const b1 = hash2(z1 + 1, yi, s);
  const c1 = hash2(z1, yi + 1, s);
  const d1 = hash2(z1 + 1, yi + 1, s);
  const p0 = a0 + (b0 - a0) * u + (c0 - a0) * v + (a0 - b0 - c0 + d0) * u * v;
  const p1 = a1 + (b1 - a1) * u + (c1 - a1) * v + (a1 - b1 - c1 + d1) * u * v;
  return p0 + (p1 - p0) * w;
}

// The map covers the whole globe: x is longitude (wrapping every w pixels) and
// y runs from the north pole (0) to the south pole (h). A SphereField is fractal
// noise sampled on the sphere itself, so it is seamless where the map joins and
// across the poles. `cell` is the feature size in map pixels at the equator. It
// is computed on a coarse grid and interpolated, which keeps generation quick.
export class SphereField {
  private nx: number;
  private ny: number;
  private ix: number;
  private iy: number;
  private v: Float32Array;
  constructor(w: number, h: number, cell: number, s: number, oct = 4, step = 3) {
    const nx = (this.nx = Math.max(8, Math.round(w / step)));
    const ny = (this.ny = Math.max(4, Math.round(h / step)) + 1);
    this.ix = nx / w;
    this.iy = (ny - 1) / h;
    this.v = new Float32Array(nx * ny);
    const R = w / (2 * Math.PI) / cell;
    for (let j = 0; j < ny; j++) {
      const lat = Math.PI / 2 - (Math.PI * j) / (ny - 1);
      for (let i = 0; i < nx; i++) {
        const lon = (2 * Math.PI * i) / nx;
        const px = Math.cos(lat) * Math.cos(lon) * R;
        const py = Math.cos(lat) * Math.sin(lon) * R;
        const pz = Math.sin(lat) * R;
        let t = 0;
        let amp = 0.5;
        let f = 1;
        let norm = 0;
        for (let o = 0; o < oct; o++) {
          t += amp * vnoise3(px * f, py * f, pz * f, s + o * 17);
          norm += amp;
          amp *= 0.5;
          f *= 2;
        }
        this.v[j * nx + i] = t / norm;
      }
    }
  }
  at(x: number, y: number): number {
    const nx = this.nx;
    let fx = x * this.ix;
    let fy = y * this.iy;
    if (fx < 0 || fx >= nx) fx -= Math.floor(fx / nx) * nx;
    if (fy < 0) fy = 0;
    else if (fy > this.ny - 1.001) fy = this.ny - 1.001;
    const i = fx | 0;
    const j = fy | 0;
    const tx = fx - i;
    const ty = fy - j;
    const i1 = i + 1 === nx ? 0 : i + 1;
    const v = this.v;
    const r0 = j * nx;
    const r1 = r0 + nx;
    const a = v[r0 + i];
    const b = v[r0 + i1];
    const c = v[r1 + i];
    const d = v[r1 + i1];
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  }
}

// Fold a map point that has gone past a pole back onto the map: over the pole
// you come down the far side of the globe, half a world round.
export function overPole(x: number, y: number, w: number, h: number): [number, number, number] {
  if (y < 0) return [x + w / 2, -y, -1];
  if (y > h) return [x + w / 2, 2 * h - y, -1];
  return [x, y, 1];
}

// The copy of map point (x, y) that is closest to (x0, y0) on the globe: the
// same place one or more laps round, or the same place reached over a pole
// (which the map shows as a point beyond its top or bottom edge).
export function nearestCopy(x0: number, y0: number, x: number, y: number, w: number, h: number): [number, number] {
  let best: [number, number] = [x, y];
  let bd = Infinity;
  for (const [cx, cy] of [
    [x, y],
    [x + w / 2, -y],
    [x + w / 2, 2 * h - y],
  ]) {
    const k = Math.round((x0 - cx) / w);
    const px = cx + k * w;
    // east-west distances shrink towards the poles
    const lat = (Math.PI * ((y0 + cy) / 2 - h / 2)) / h;
    const d = Math.hypot((px - x0) * Math.max(0.15, Math.cos(lat)), cy - y0);
    if (d < bd) {
      bd = d;
      best = [px, cy];
    }
  }
  return best;
}

// How far towards a pole a map row is: 0 on the equator, 1 at the poles.
export const polar = (y: number, h: number) => Math.abs(y / h - 0.5) * 2;

// 0..1 bump that peaks at fraction `at` around the world and is lowest opposite it.
export const around = (fx: number, at: number) => 0.5 + 0.5 * Math.cos(2 * Math.PI * (fx - at));

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
