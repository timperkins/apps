// Isometric landscape for v2. Fields live on a world-space grid; the screen is
// painted per pixel by casting a ray through a two-level height field, so
// plateaus get real rock faces on their two visible sides.
import { RGB, fbm, hash2, hex, mix, shade } from '../gfx';
import { toScreen, toWorld } from './stack';

export const enum K {
  Grass = 0,
  Water = 1,
  Sand = 2,
  Road = 3,
  Pad = 4,
  High = 5, // plateau top
}

export const HP = 11; // plateau height in world units (= screen pixels)

const GRASS = ['#22391b', '#284320', '#2f4d24', '#365628', '#3d5f2d', '#466833'].map(hex);
const HIGH = ['#3a4a24', '#425328', '#4b5c2d', '#556532'].map(hex);
const DIRT = hex('#7a6a4a');
const ROAD = hex('#8f7f5b');
const RUT = hex('#6a5c41');
const SAND = hex('#b8a676');
const WET = hex('#8e845f');
const W_SHALLOW = hex('#4d8ea6');
const W_DEEP = hex('#1c3d5c');
const ROCK_L = hex('#b1a48b');
const ROCK = hex('#8a7e69');
const ROCK_D = hex('#5a5043');
const CONC = hex('#8a877d');
const CONC_D = hex('#5f5d56');
const FLOWER = [hex('#e8dc72'), hex('#e6e0d0'), hex('#c98ac0')];

function percentile(arr: Float32Array, q: number, mask?: (i: number) => boolean): number {
  const step = Math.max(1, Math.floor(arr.length / 30000));
  const s: number[] = [];
  for (let i = 0; i < arr.length; i += step) if (!mask || mask(i)) s.push(arr[i]);
  s.sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * q))] ?? 0;
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class IsoTerrain {
  readonly gx0: number;
  readonly gy0: number;
  readonly gw: number;
  readonly gh: number;
  readonly kind: Uint8Array;
  readonly high: Uint8Array;
  private wv: Float32Array;
  private road: Float32Array;
  private wThr = 0;
  private wMax = 1;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly foam: HTMLCanvasElement;
  readonly foam2: HTMLCanvasElement;

  constructor(
    readonly w: number,
    readonly h: number,
    readonly seed: number,
  ) {
    this.gx0 = -6;
    this.gy0 = Math.floor(-w / 2) - 6;
    this.gw = Math.ceil(w / 2 + h + HP) + 12;
    this.gh = Math.ceil(w / 2 + h + HP) + 12;
    const n = this.gw * this.gh;
    this.kind = new Uint8Array(n);
    this.high = new Uint8Array(n);
    this.wv = new Float32Array(n);
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

  private idx(wx: number, wy: number): number {
    const x = Math.floor(wx) - this.gx0;
    const y = Math.floor(wy) - this.gy0;
    if (x < 0 || y < 0 || x >= this.gw || y >= this.gh) return -1;
    return y * this.gw + x;
  }

  k(wx: number, wy: number): K {
    const i = this.idx(wx, wy);
    return i < 0 ? K.Grass : (this.kind[i] as K);
  }

  isHigh(wx: number, wy: number): boolean {
    const i = this.idx(wx, wy);
    return i >= 0 && this.high[i] === 1;
  }

  elev(wx: number, wy: number): number {
    return this.isHigh(wx, wy) ? HP : 0;
  }

  // world coordinates of a fraction of the screen, on the ground
  at(fx: number, fy: number): [number, number] {
    return toWorld(fx * this.w, fy * this.h, 0);
  }

  private classify(): void {
    const { gw, gh, seed, w, h } = this;
    const S = Math.max(w, h);
    const hv = new Float32Array(gw * gh);
    for (let y = 0; y < gh; y++)
      for (let x = 0; x < gw; x++) {
        const i = y * gw + x;
        const wx = x + this.gx0;
        const wy = y + this.gy0;
        const [sx, sy] = toScreen(wx, wy);
        const fx = sx / w;
        const fy = sy / h;
        const n = fbm((wx / S) * 4, (wy / S) * 4, seed, 5);
        this.wv[i] = n * 0.9 + fx * 0.45 + fy * 0.7;
        const m = fbm((wx / S) * 5, (wy / S) * 5, seed + 211, 4);
        hv[i] = m - fx * 0.35 - fy * 0.15;
      }
    this.wThr = percentile(this.wv, 0.84);
    const sandThr = percentile(this.wv, 0.815);
    this.wMax = percentile(this.wv, 0.999);
    const hThr = percentile(hv, 0.86);

    const P = (fx: number, fy: number) => this.at(fx, fy);
    const main = [P(-0.08, 0.9), P(0.2, 0.68), P(0.45, 0.56), P(0.6, 0.36), P(0.8, 0.2), P(1.1, 0.04)];
    const spur = [P(0.45, 0.56), P(0.33, 0.3), P(0.28, -0.08)];
    const half = Math.max(4, Math.min(7, S / 120));
    for (let y = 0; y < gh; y++)
      for (let x = 0; x < gw; x++) {
        const i = y * gw + x;
        const wx = x + this.gx0;
        const wy = y + this.gy0;
        const jx = wx + (fbm(wx / 30, wy / 30, seed + 7, 2) - 0.5) * 20;
        const jy = wy + (fbm(wx / 30, wy / 30, seed + 8, 2) - 0.5) * 20;
        let d = 1e9;
        for (let s = 0; s < main.length - 1; s++) d = Math.min(d, segDist(jx, jy, main[s][0], main[s][1], main[s + 1][0], main[s + 1][1]));
        let d2 = 1e9;
        for (let s = 0; s < spur.length - 1; s++) d2 = Math.min(d2, segDist(jx, jy, spur[s][0], spur[s][1], spur[s + 1][0], spur[s + 1][1]));
        this.road[i] = Math.min(d / half, d2 / (half * 0.75));
        let k = K.Grass;
        if (this.wv[i] > this.wThr) k = K.Water;
        else if (this.wv[i] > sandThr) k = K.Sand;
        else if (this.road[i] < 1) k = K.Road;
        else if (hv[i] > hThr && this.road[i] > 1.8 && this.wv[i] < sandThr - 0.03) {
          k = K.High;
          this.high[i] = 1;
        }
        this.kind[i] = k;
      }
  }

  // Ground rect (world coords) free of water, sand, roads, plateaus and pads?
  clear(r: Rect, margin = 0): boolean {
    for (let y = r.y - margin; y <= r.y + r.h + margin; y += 2)
      for (let x = r.x - margin; x <= r.x + r.w + margin; x += 2) {
        const i = this.idx(x, y);
        if (i < 0 || this.kind[i] !== K.Grass) return false;
      }
    return true;
  }

  markPad(r: Rect): void {
    for (let y = Math.floor(r.y); y < r.y + r.h; y++)
      for (let x = Math.floor(r.x); x < r.x + r.w; x++) {
        const i = this.idx(x, y);
        if (i >= 0 && this.kind[i] === K.Grass) this.kind[i] = K.Pad;
      }
  }

  private padEdge(wx: number, wy: number): boolean {
    return this.k(wx + 1, wy) !== K.Pad || this.k(wx - 1, wy) !== K.Pad || this.k(wx, wy + 1) !== K.Pad || this.k(wx, wy - 1) !== K.Pad;
  }

  paint(): void {
    const { w, h, seed } = this;
    const img = this.ctx.createImageData(w, h);
    const d = img.data;
    const fimg = new ImageData(w, h);
    const f2img = new ImageData(w, h);
    const put = (x: number, y: number, c: RGB) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const i = (y * w + x) * 4;
      d[i] = c[0];
      d[i + 1] = c[1];
      d[i + 2] = c[2];
      d[i + 3] = 255;
    };
    const near = (wx: number, wy: number, r: number, test: (k: K) => boolean) => {
      for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if ((i || j) && test(this.k(wx + i, wy + j))) return true;
      return false;
    };
    const tufts: [number, number, RGB][] = [];

    for (let sy = 0; sy < h; sy++)
      for (let sx = 0; sx < w; sx++) {
        const rnd = hash2(sx, sy, seed);
        const px = sx + 0.5;
        const py = sy + 0.5;
        // ray cast against the plateau height field
        let hitZ = -1;
        let wx = 0;
        let wy = 0;
        for (let z = HP; z >= 0; z--) {
          const [ax, ay] = toWorld(px, py, z);
          if (this.isHigh(ax, ay)) {
            hitZ = z;
            wx = ax;
            wy = ay;
            break;
          }
        }
        let c: RGB;
        if (hitZ === HP) {
          // plateau top
          const tone = fbm(wx / 9, wy / 9, seed + 40, 3);
          c = HIGH[Math.max(0, Math.min(3, Math.floor(tone * 4 + (rnd - 0.5) * 1.6)))];
          if (rnd > 0.975) c = shade(ROCK, (rnd - 0.975) * 8);
          const rim = !this.isHigh(wx + 1.2, wy) || !this.isHigh(wx, wy + 1.2);
          const back = !this.isHigh(wx - 1.2, wy) || !this.isHigh(wx, wy - 1.2);
          if (rim) c = shade(mix(c, ROCK_L, 0.5), 0.1);
          else if (back) c = shade(c, -0.25);
        } else if (hitZ >= 0) {
          // rock face: +x faces are in shade, +y faces catch the light
          const rightFace = !this.isHigh(wx + 1, wy);
          const along = rightFace ? wy : wx;
          const band = Math.floor((hitZ + fbm(along / 6, 0, seed + 3, 2) * 4) / 3) % 2;
          const crack = hash2(Math.floor(along * 0.7), 0, seed + 5) > 0.85;
          c = band ? ROCK : mix(ROCK, ROCK_L, 0.4);
          if (crack) c = ROCK_D;
          c = shade(c, rightFace ? -0.32 : 0.02);
          if (hitZ <= 1) c = shade(c, -0.25);
          if (hitZ === HP - 1) c = shade(c, 0.12);
          c = shade(c, (rnd - 0.5) * 0.16);
        } else {
          [wx, wy] = toWorld(px, py, 0);
          const i = this.idx(wx, wy);
          const k = i < 0 ? K.Grass : (this.kind[i] as K);
          switch (k) {
            case K.Water: {
              const depth = Math.min(1, ((this.wv[i] - this.wThr) / (this.wMax - this.wThr)) * 1.6);
              c = mix(W_SHALLOW, W_DEEP, Math.pow(depth, 0.6));
              const rip = fbm(sx / 7, sy / 1.7, seed + 30, 2);
              if (rip > 0.62) c = shade(c, 0.12);
              else if (rip < 0.33) c = shade(c, -0.08);
              c = shade(c, (rnd - 0.5) * 0.07);
              const land = (kk: K) => kk !== K.Water;
              if (near(wx, wy, 1, land)) put4(fimg.data, sy * w + sx, [195, 228, 232], 235);
              else if (near(wx, wy, 3, land) && rnd < 0.4) put4(f2img.data, sy * w + sx, [150, 200, 215], 200);
              // dark bank line just below the shore
              if (land(this.k(wx - 1, wy - 1)) && !near(wx, wy, 0, land)) c = shade(c, -0.2);
              break;
            }
            case K.Sand: {
              const wet = near(wx, wy, 2, (kk) => kk === K.Water);
              c = wet ? WET : SAND;
              // wind ripples
              if (Math.sin((wx + wy * 0.3) * 1.3 + fbm(wx / 8, wy / 8, seed, 2) * 6) > 0.8) c = shade(c, -0.08);
              c = shade(c, (rnd - 0.5) * 0.14);
              if (rnd > 0.988) c = shade(c, -0.35);
              break;
            }
            case K.Road: {
              const rd = this.road[i];
              c = ROAD;
              if (Math.abs(rd - 0.45) < 0.1) c = RUT;
              c = shade(c, (rnd - 0.5) * 0.18 + (fbm(wx / 6, wy / 6, seed + 3, 2) - 0.5) * 0.2);
              if (rd > 0.82 && rnd < 0.4) c = GRASS[2];
              if (fbm(wx / 5, wy / 5, seed + 17, 2) > 0.72 && rd < 0.6) c = shade(mix(c, W_SHALLOW, 0.35), -0.15); // puddles
              if (rnd > 0.99) c = shade(ROCK, 0.1);
              break;
            }
            case K.Pad: {
              // concrete slab with seams every 8 units
              const seam = ((wx % 8) + 8) % 8 < 0.7 || ((wy % 8) + 8) % 8 < 0.7;
              c = seam ? CONC_D : shade(CONC, (fbm(wx / 4, wy / 4, seed + 9, 2) - 0.5) * 0.25);
              if (this.padEdge(wx, wy)) c = shade(CONC_D, -0.1);
              if (!seam && rnd > 0.985) c = shade(c, -0.3); // oil stains
              c = shade(c, (rnd - 0.5) * 0.1);
              break;
            }
            default: {
              const patch = fbm(wx / 18, wy / 18, seed + 11, 3);
              const tone = fbm(wx / 5, wy / 5, seed + 12, 2);
              const tile = (hash2(Math.floor(wx / 8), Math.floor(wy / 8), seed + 2) - 0.5) * 0.6;
              let gi = Math.floor((patch * 0.7 + tone * 0.3) * 6 + tile + (rnd - 0.5) * 2);
              gi = Math.max(0, Math.min(GRASS.length - 1, gi));
              c = GRASS[gi];
              const dirt = fbm(wx / 24, wy / 24, seed + 13, 3);
              if (dirt > 0.65 && rnd < (dirt - 0.65) * 6) c = mix(c, DIRT, 0.6);
              if (rnd > 0.975) tufts.push([sx, sy, shade(GRASS[5], 0.15)]);
              else if (rnd < 0.004) c = FLOWER[Math.floor(hash2(sx, sy, 3) * 3)];
              else if (rnd < 0.012) c = shade(c, -0.4);
              if (near(wx, wy, 2, (kk) => kk === K.High) && rnd < 0.3) c = shade(mix(c, ROCK_D, 0.5), -0.05); // rubble
            }
          }
          // shadows cast by plateaus
          for (let t = 1; t <= 9; t++) {
            if (this.isHigh(wx - t, wy + t * 0.25)) {
              c = shade(c, -0.38);
              break;
            }
          }
        }
        put(sx, sy, c);
      }
    for (const [x, y, c] of tufts) {
      put(x, y, c);
      put(x, y - 1, shade(c, 0.1));
    }

    // craters
    let r = seed;
    const rand = () => ((r = (Math.imul(r, 1103515245) + 12345) >>> 0) / 4294967296);
    const craters = Math.floor((w * h) / 10000);
    for (let n = 0; n < craters; n++) {
      const sx0 = Math.floor(rand() * w);
      const sy0 = Math.floor(rand() * h);
      const rr = 2.5 + rand() * 3;
      const [cwx, cwy] = toWorld(sx0, sy0, 0);
      if (this.k(cwx, cwy) !== K.Grass || this.isHigh(cwx, cwy)) continue;
      for (let y = -4; y <= 4; y++)
        for (let x = -7; x <= 7; x++) {
          const dd = Math.hypot(x / 2, y) / (rr * 0.6);
          const X = sx0 + x;
          const Y = sy0 + y;
          if (X < 0 || Y < 0 || X >= w || Y >= h || dd > 1.25) continue;
          const i = (Y * w + X) * 4;
          const f = dd < 0.7 ? -0.45 : dd < 1 ? (y < 0 ? -0.25 : 0.18) : -0.1;
          d[i] *= 1 + f;
          d[i + 1] *= 1 + f;
          d[i + 2] *= 1 + f;
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
