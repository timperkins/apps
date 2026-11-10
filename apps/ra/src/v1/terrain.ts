// Procedural landscape: grass, a dirt road, rocky ridges, a lake with a
// beach, and dirt pads under buildings. Painted once per pixel into a canvas.
// The map covers a whole tiny globe (see SphereField), with the same kind of land everywhere.
import { RGB, SphereField, WrapNoise, around, hash2, hex, mix, shade, wrapNoise } from '../gfx';

export const enum K {
  Grass = 0,
  Water = 1,
  Sand = 2,
  Cliff = 3,
  Road = 4,
  Pad = 5,
}

// Road segments (and their copies one lap either way) with padded bounding
// boxes, so each point only measures the few segments it could be near.
type Seg = { ax: number; ay: number; bx: number; by: number; x0: number; x1: number; y0: number; y1: number; k: number };
function roadSegs(lines: [number, number][][], widths: number[], half: number, shifts: number[][], jitter: number): Seg[] {
  const segs: Seg[] = [];
  const m = half * 3 + jitter;
  lines.forEach((line, li) => {
    for (const [dx, dy] of shifts)
      for (let s = 0; s < line.length - 1; s++) {
        const ax = line[s][0] + dx;
        const ay = line[s][1] + dy;
        const bx = line[s + 1][0] + dx;
        const by = line[s + 1][1] + dy;
        segs.push({ ax, ay, bx, by, x0: Math.min(ax, bx) - m, x1: Math.max(ax, bx) + m, y0: Math.min(ay, by) - m, y1: Math.max(ay, by) + m, k: 1 / (half * widths[li]) });
      }
  });
  return segs;
}
// Distance to the nearest road in road half-widths (large when far away).
function roadDist(segs: Seg[], x: number, y: number): number {
  let d = 1e9;
  for (const g of segs) {
    if (x < g.x0 || x > g.x1 || y < g.y0 || y > g.y1) continue;
    d = Math.min(d, segDist(x, y, g.ax, g.ay, g.bx, g.by) * g.k);
  }
  return d === 1e9 ? 99 : d;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const GRASS = ['#22381b', '#28421f', '#2f4c23', '#355427', '#3c5d2c', '#456632'].map(hex);
const DIRT = hex('#7a6a4a');
const ROAD = hex('#8d7d5a');
const TRACK = hex('#6b5d42');
const SAND = hex('#b5a273');
const WET_SAND = hex('#8f8460');
const WATER_SHALLOW = hex('#4a8aa3');
const WATER_DEEP = hex('#1d3f5e');
const ROCK_L = hex('#b3a78f');
const ROCK = hex('#857a66');
const ROCK_D = hex('#4b4337');
const PAD = hex('#6e6452');

function percentile(arr: Float32Array, q: number): number {
  const step = Math.max(1, Math.floor(arr.length / 20000));
  const s: number[] = [];
  for (let i = 0; i < arr.length; i += step) s.push(arr[i]);
  s.sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * q))];
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

export class Terrain {
  readonly kind: Uint8Array;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly foam: HTMLCanvasElement;
  readonly foam2: HTMLCanvasElement;
  private wv: Float32Array;
  private cv: Float32Array;
  private road: Float32Array;
  private wThr = 0;
  private wMax = 1;
  readonly noise: WrapNoise;

  constructor(
    readonly w: number,
    readonly h: number,
    readonly seed: number,
  ) {
    this.noise = wrapNoise(w);
    const n = w * h;
    this.kind = new Uint8Array(n);
    this.wv = new Float32Array(n);
    this.cv = new Float32Array(n);
    this.road = new Float32Array(n);
    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d')!;
    this.foam = document.createElement('canvas');
    this.foam2 = document.createElement('canvas');
    this.foam.width = this.foam2.width = w;
    this.foam.height = this.foam2.height = h;
    this.classify();
  }

  k(x: number, y: number): K {
    x = Math.floor(x);
    y = Math.floor(y);
    // past a pole: the far side of the globe, half a world round
    if (y < 0 || y >= this.h) {
      y = y < 0 ? -1 - y : 2 * this.h - 1 - y;
      x += this.w / 2;
      if (y < 0 || y >= this.h) return K.Grass;
    }
    if (x < 0 || x >= this.w) x = ((x % this.w) + this.w) % this.w;
    return this.kind[y * this.w + x] as K;
  }

  private classify(): void {
    const { w, h, seed } = this;
    const scale = Math.max(w, h) * 0.6;
    const lakeF = new SphereField(w, h, scale / 5, seed, 5);
    const ridgeF = new SphereField(w, h, scale / 4, seed + 101, 5);
    const jitX = new SphereField(w, h, 40, seed + 7, 2);
    const jitY = new SphereField(w, h, 40, seed + 8, 2);
    // Water: lakes anywhere, with one likely just south-east of the second base.
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const n = lakeF.at(x, y);
        this.wv[i] = n * 0.9 + around(x / w, 0.88) * Math.max(0, 1 - Math.abs(y / h - 0.72) * 3.5) * 0.4;
        const r = 1 - Math.abs(ridgeF.at(x, y) * 2 - 1);
        this.cv[i] = r - around(x / w, 0.85) * 0.2;
      }
    this.wThr = percentile(this.wv, 0.84);
    const sandThr = percentile(this.wv, 0.81);
    this.wMax = percentile(this.wv, 0.999);
    const cThr = percentile(this.cv, 0.945);

    // Road: a winding loop right around the world, plus a spur to the north.
    const P = (fx: number, fy: number): [number, number] => [fx * w, fy * h];
    const main = [P(0, 0.72), P(0.12, 0.78), P(0.22, 0.66), P(0.46, 0.55), P(0.62, 0.36), P(0.8, 0.2), P(0.9, 0.42), P(1, 0.72)];
    const spur = [P(0.46, 0.55), P(0.34, 0.3), P(0.3, 0.16)];
    const half = Math.max(5, Math.min(8, scale / 110));
    const segs = roadSegs([main, spur], [1, 0.7], half, [0, -w, w].map((k) => [k, 0]), 30);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const jx = x + (jitX.at(x, y) - 0.5) * 30;
        const jy = y + (jitY.at(x, y) - 0.5) * 30;
        this.road[i] = roadDist(segs, jx, jy);

        let k = K.Grass;
        if (this.wv[i] > this.wThr) k = K.Water;
        else if (this.wv[i] > sandThr) k = K.Sand;
        else if (this.road[i] < 1) k = K.Road;
        else if (this.cv[i] > cThr) k = K.Cliff;
        this.kind[i] = k;
      }
  }

  // Free of water, sand, cliffs, roads and existing pads?
  clear(r: Rect, margin = 0): boolean {
    for (let y = Math.floor(r.y - margin); y < r.y + r.h + margin; y += 2)
      for (let x = Math.floor(r.x - margin); x < r.x + r.w + margin; x += 2) {
        if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
        if (this.kind[y * this.w + x] !== K.Grass) return false;
      }
    return true;
  }

  markPad(r: Rect): void {
    for (let y = Math.floor(r.y); y < r.y + r.h; y++)
      for (let x = Math.floor(r.x); x < r.x + r.w; x++) {
        if (x < 0 || y < 0 || x >= this.w || y >= this.h) continue;
        // Rough, noisy edge
        const ex = Math.min(x - r.x, r.x + r.w - x);
        const ey = Math.min(y - r.y, r.y + r.h - y);
        if (Math.min(ex, ey) < hash2(x, y, 77) * 3) continue;
        const i = y * this.w + x;
        if (this.kind[i] === K.Grass) this.kind[i] = K.Pad;
      }
  }

  paint(): void {
    const { w, h, seed } = this;
    const N = this.noise;
    const img = this.ctx.createImageData(w, h);
    const d = img.data;
    const fimg = new ImageData(w, h);
    const f2img = new ImageData(w, h);
    const put = (i: number, c: RGB) => {
      d[i * 4] = c[0];
      d[i * 4 + 1] = c[1];
      d[i * 4 + 2] = c[2];
      d[i * 4 + 3] = 255;
    };
    const near = (x: number, y: number, r: number, test: (k: K) => boolean) => {
      for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if ((i || j) && test(this.k(x + i, y + j))) return true;
      return false;
    };
    const land = (k: K) => k !== K.Water;

    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const k = this.kind[i] as K;
        const rnd = hash2(x, y, seed);
        let c: RGB;
        switch (k) {
          case K.Water: {
            const depth = Math.min(1, (this.wv[i] - this.wThr) / (this.wMax - this.wThr) * 1.6);
            c = mix(WATER_SHALLOW, WATER_DEEP, Math.pow(depth, 0.6));
            // horizontal ripples
            const rip = N(x, y, 6, seed + 30, 2, 1.6);
            if (rip > 0.62) c = shade(c, 0.12);
            else if (rip < 0.32) c = shade(c, -0.08);
            c = shade(c, (rnd - 0.5) * 0.08);
            if (near(x, y, 1, land)) {
              put4(fimg.data, i, [190, 225, 230], 230);
            } else if (near(x, y, 3, land) && rnd < 0.45) {
              put4(f2img.data, i, [150, 200, 215], 200);
            }
            break;
          }
          case K.Sand: {
            const wet = near(x, y, 2, (kk) => kk === K.Water);
            c = shade(wet ? WET_SAND : SAND, (rnd - 0.5) * 0.18);
            if (rnd > 0.985) c = shade(c, -0.3);
            break;
          }
          case K.Road: {
            const rd = this.road[i];
            c = ROAD;
            if (Math.abs(rd - 0.45) < 0.12 || Math.abs(rd - 0.0) < 0.06) c = TRACK;
            c = shade(c, (rnd - 0.5) * 0.2 + (N(x, y, 8, seed + 3, 2) - 0.5) * 0.18);
            if (rd > 0.8 && rnd < 0.35) c = GRASS[2];
            if (rnd > 0.99) c = shade(ROCK, 0.1);
            break;
          }
          case K.Cliff: {
            const cv = this.cv;
            const gx = cv[Math.min(i + 1, cv.length - 1)] - cv[Math.max(i - 1, 0)];
            const gy = cv[Math.min(i + w, cv.length - 1)] - cv[Math.max(i - w, 0)];
            const fine = N(x, y, 4, seed + 50, 3) - 0.5;
            const l = (gx + gy) * 14 + fine * 1.1;
            c = l > 0.3 ? ROCK_L : l > -0.25 ? ROCK : ROCK_D;
            // raised look: lit rim on top, dark rock face along the bottom edge
            if (this.k(x, y - 1) !== K.Cliff) c = ROCK_L;
            else if (this.k(x, y + 1) !== K.Cliff) c = shade(ROCK_D, -0.35);
            else if (this.k(x, y + 2) !== K.Cliff) c = shade(ROCK_D, -0.15);
            else if (this.k(x, y + 3) !== K.Cliff) c = ROCK_D;
            c = shade(c, (rnd - 0.5) * 0.16);
            break;
          }
          case K.Pad: {
            c = shade(PAD, (rnd - 0.5) * 0.25 + (N(x, y, 5, seed + 9, 2) - 0.5) * 0.2);
            if (rnd > 0.97) c = shade(c, 0.25);
            break;
          }
          default: {
            const patch = N(x, y, 22, seed + 11, 3);
            const tone = N(x, y, 7, seed + 12, 2);
            let gi = Math.floor((patch * 0.7 + tone * 0.3) * 6 + (rnd - 0.5) * 2.2);
            gi = Math.max(0, Math.min(GRASS.length - 1, gi));
            c = GRASS[gi];
            const dirt = N(x, y, 30, seed + 13, 3);
            if (dirt > 0.66 && rnd < (dirt - 0.66) * 6) c = mix(c, DIRT, 0.6);
            if (rnd > 0.992) c = shade(c, 0.35);
            else if (rnd < 0.012) c = shade(c, -0.45);
            // rubble and shade around cliffs
            if (near(x, y, 2, (kk) => kk === K.Cliff) && rnd < 0.4) c = shade(mix(c, ROCK_D, 0.5), -0.1);
          }
        }
        // drop shadow cast by cliffs to the bottom-right
        if (k !== K.Cliff && (this.k(x - 2, y - 3) === K.Cliff || this.k(x - 1, y - 2) === K.Cliff)) c = shade(c, -0.4);
        put(i, c);
      }

    // craters
    let r = seed;
    const rand = () => ((r = (Math.imul(r, 1103515245) + 12345) >>> 0) / 4294967296);
    const craters = Math.floor((w * h) / 9000);
    for (let n = 0; n < craters; n++) {
      const cx = Math.floor(rand() * w);
      const cy = Math.floor(rand() * h);
      const rr = 2 + rand() * 3;
      if (this.k(cx, cy) !== K.Grass) continue;
      for (let y = -4; y <= 4; y++)
        for (let x = -6; x <= 6; x++) {
          const dd = Math.hypot(x / 1.3, y) / rr;
          const i = (cy + y) * w + cx + x;
          if (cx + x < 0 || cy + y < 0 || cx + x >= w || cy + y >= h || dd > 1.2) continue;
          const f = dd < 0.7 ? -0.45 : dd < 1 ? (y < 0 ? -0.25 : 0.15) : -0.1;
          d[i * 4] *= 1 + f;
          d[i * 4 + 1] *= 1 + f;
          d[i * 4 + 2] *= 1 + f;
        }
    }

    this.ctx.putImageData(img, 0, 0);
    this.foam.getContext('2d')!.putImageData(fimg, 0, 0);
    this.foam2.getContext('2d')!.putImageData(f2img, 0, 0);
  }
}

function put4(d: Uint8ClampedArray, i: number, c: RGB, a: number): void {
  d[i * 4] = c[0];
  d[i * 4 + 1] = c[1];
  d[i * 4 + 2] = c[2];
  d[i * 4 + 3] = a;
}
