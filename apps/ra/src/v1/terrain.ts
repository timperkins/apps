// Procedural landscape: grass, dirt roads, rocky ridges, lakes with beaches,
// and dirt pads under buildings. The world wraps round both ways (east-west and
// north-south), so every field is seamless where the map joins up, and the land
// is the same kind all over. The map is planet-sized, so nothing is stored per
// pixel: the ground is classified and painted a tile at a time, on demand.
import { RGB, WorldField, WrapNoise, hash2, hex, mix, rng, shade, wrapNoise } from '../gfx';
import { CH, Roads, canvasOf } from '../tiles';

export const enum K {
  Grass = 0,
  Water = 1,
  Sand = 2,
  Cliff = 3,
  Road = 4,
  Pad = 5,
}

// Map pixels per pixel of the overview used for the globe and unpainted tiles.
export const OV = 4;
// Margin of ground classified round a tile, for the painter's neighbor tests
// and for props whose jittered spot pokes over the edge.
export const M = 8;
// Ground features keep a fixed size however big the planet is.
const LAKE_CELL = 170;
const RIDGE_CELL = 215;
const ROAD_HALF = 8;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Classified ground over a rectangle of map pixels (unwrapped coordinates).
export interface Region {
  x0: number;
  y0: number;
  w: number;
  h: number;
  kind: Uint8Array;
  wv: Float32Array;
  cv: Float32Array;
  road: Float32Array;
}

export interface PaintedTile {
  canvas: HTMLCanvasElement;
  foam: HTMLCanvasElement | null;
  foam2: HTMLCanvasElement | null;
  region: Region;
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

function percentile(s: number[], q: number): number {
  const a = s.slice().sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.floor(a.length * q))];
}

export class Terrain {
  readonly noise: WrapNoise;
  private lakeF: WorldField;
  private ridgeF: WorldField;
  private jitX: WorldField;
  private jitY: WorldField;
  private wThr: number;
  private sandThr: number;
  private wMax: number;
  private cThr: number;
  private roads: Roads;
  readonly pads: Rect[] = [];
  // Ground kinds for game logic, in 64 x 64 blocks, filled in as asked for.
  private cache = new Map<number, Uint8Array>();
  private ovImg: ImageData | null = null;
  private ovRow = 0;

  constructor(
    readonly w: number,
    readonly h: number,
    readonly seed: number,
  ) {
    this.noise = wrapNoise(w, h);
    this.lakeF = new WorldField(w, h, LAKE_CELL, seed, 5);
    this.ridgeF = new WorldField(w, h, RIDGE_CELL, seed + 101, 5);
    this.jitX = new WorldField(w, h, 40, seed + 7, 2, 10);
    this.jitY = new WorldField(w, h, 40, seed + 8, 2, 10);
    // thresholds from a sample of the whole world
    const rand = rng(seed * 31 + 5);
    const wv: number[] = [];
    const cv: number[] = [];
    for (let i = 0; i < 30000; i++) {
      const x = rand() * w;
      const y = rand() * h;
      wv.push(this.lakeF.at(x, y));
      cv.push(1 - Math.abs(this.ridgeF.at(x, y) * 2 - 1));
    }
    this.wThr = percentile(wv, 0.85);
    this.sandThr = percentile(wv, 0.82);
    this.wMax = percentile(wv, 0.999);
    this.cThr = percentile(cv, 0.945);
    this.roads = new Roads(-64, -64, w + 128, h + 128);
  }

  // Roads as polylines in map pixels (they may run off the map; copies one lap
  // round each way are added).
  setRoads(lines: [number, number][][]): void {
    this.roads = new Roads(-64, -64, this.w + 128, this.h + 128);
    for (const line of lines)
      for (let s = 0; s < line.length - 1; s++)
        for (const dy of [-this.h, 0, this.h])
          for (const dx of [-this.w, 0, this.w])
            this.roads.add(line[s][0] + dx, line[s][1] + dy, line[s + 1][0] + dx, line[s + 1][1] + dy, ROAD_HALF, ROAD_HALF * 3 + 20);
    this.cache.clear();
  }

  private wrapX(x: number): number {
    return x < 0 || x >= this.w ? x - Math.floor(x / this.w) * this.w : x;
  }
  private wrapY(y: number): number {
    return y < 0 || y >= this.h ? y - Math.floor(y / this.h) * this.h : y;
  }

  // Classify the ground over a rectangle (any copy of the map).
  region(x0: number, y0: number, rw: number, rh: number): Region {
    const n = rw * rh;
    const r: Region = { x0, y0, w: rw, h: rh, kind: new Uint8Array(n), wv: new Float32Array(n), cv: new Float32Array(n), road: new Float32Array(n) };
    const { lakeF, ridgeF, jitX, jitY, roads, wThr, sandThr, cThr } = this;
    for (let j = 0; j < rh; j++) {
      const y = this.wrapY(y0 + j);
      for (let i = 0; i < rw; i++) {
        const x = this.wrapX(x0 + i);
        const q = j * rw + i;
        const wv = lakeF.at(x, y);
        const cv = 1 - Math.abs(ridgeF.at(x, y) * 2 - 1);
        const rd = wv > sandThr ? 99 : roads.dist(x + (jitX.at(x, y) - 0.5) * 30, y + (jitY.at(x, y) - 0.5) * 30);
        r.wv[q] = wv;
        r.cv[q] = cv;
        r.road[q] = rd;
        r.kind[q] = wv > wThr ? K.Water : wv > sandThr ? K.Sand : rd < 1 ? K.Road : cv > cThr ? K.Cliff : K.Grass;
      }
    }
    // dirt pads under buildings, with rough, noisy edges
    for (const p of this.pads)
      for (const dy of [-this.h, 0, this.h])
        for (const dx of [-this.w, 0, this.w]) {
          const px0 = Math.max(Math.floor(p.x + dx), x0);
          const py0 = Math.max(Math.floor(p.y + dy), y0);
          const px1 = Math.min(Math.ceil(p.x + p.w + dx), x0 + rw);
          const py1 = Math.min(Math.ceil(p.y + p.h + dy), y0 + rh);
          for (let y = py0; y < py1; y++)
            for (let x = px0; x < px1; x++) {
              const ex = Math.min(x - dx - p.x, p.x + p.w - (x - dx));
              const ey = Math.min(y - dy - p.y, p.y + p.h - (y - dy));
              if (Math.min(ex, ey) < hash2(x - dx, y - dy, 77) * 3) continue;
              const q = (y - y0) * rw + (x - x0);
              if (r.kind[q] === K.Grass) r.kind[q] = K.Pad;
            }
        }
    return r;
  }

  k(x: number, y: number): K {
    const X = Math.floor(this.wrapX(Math.floor(x)));
    const Y = Math.floor(this.wrapY(Math.floor(y)));
    const key = (Y >> 6) * 4096 + (X >> 6);
    let b = this.cache.get(key);
    if (!b) {
      b = this.region((X >> 6) << 6, (Y >> 6) << 6, 64, 64).kind;
      this.cache.set(key, b);
    }
    return b[(Y & 63) * 64 + (X & 63)] as K;
  }

  // Free of water, sand, cliffs, roads and existing pads?
  clear(r: Rect, margin = 0): boolean {
    for (let y = Math.floor(r.y - margin); y < r.y + r.h + margin; y += 2)
      for (let x = Math.floor(r.x - margin); x < r.x + r.w + margin; x += 2) if (this.k(x, y) !== K.Grass) return false;
    return true;
  }

  markPad(r: Rect): void {
    this.pads.push(r);
    // forget cached blocks the pad touches
    for (let y = Math.floor(r.y) - 64; y < r.y + r.h + 64; y += 32)
      for (let x = Math.floor(r.x) - 64; x < r.x + r.w + 64; x += 32) {
        const X = this.wrapX(x);
        const Y = this.wrapY(y);
        this.cache.delete((Y >> 6) * 4096 + (X >> 6));
      }
  }

  // Paint tile (tx, ty) of the map.
  paintTile(tx: number, ty: number): PaintedTile {
    const { seed } = this;
    const N = this.noise;
    const X0 = tx * CH;
    const Y0 = ty * CH;
    const R = this.region(X0 - M, Y0 - M, CH + M * 2, CH + M * 2);
    const RW = R.w;
    const kind = R.kind;
    const img = new ImageData(CH, CH);
    const d = img.data;
    let fimg: ImageData | null = null;
    let f2img: ImageData | null = null;
    const kk = (x: number, y: number) => kind[(y - Y0 + M) * RW + (x - X0 + M)] as K;
    const near = (x: number, y: number, r: number, test: (k: K) => boolean) => {
      for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if ((i || j) && test(kk(x + i, y + j))) return true;
      return false;
    };
    const land = (k: K) => k !== K.Water;

    for (let ly = 0; ly < CH; ly++)
      for (let lx = 0; lx < CH; lx++) {
        const x = X0 + lx;
        const y = Y0 + ly;
        const q = (ly + M) * RW + lx + M;
        const k = kind[q] as K;
        const rnd = hash2(x, y, seed);
        let c: RGB;
        switch (k) {
          case K.Water: {
            const depth = Math.min(1, ((R.wv[q] - this.wThr) / (this.wMax - this.wThr)) * 1.6);
            c = mix(WATER_SHALLOW, WATER_DEEP, Math.pow(depth, 0.6));
            // horizontal ripples
            const rip = N(x, y, 6, seed + 30, 2, 1.6);
            if (rip > 0.62) c = shade(c, 0.12);
            else if (rip < 0.32) c = shade(c, -0.08);
            c = shade(c, (rnd - 0.5) * 0.08);
            if (near(x, y, 1, land)) {
              if (!fimg) fimg = new ImageData(CH, CH);
              put4(fimg.data, ly * CH + lx, [190, 225, 230], 230);
            } else if (near(x, y, 3, land) && rnd < 0.45) {
              if (!f2img) f2img = new ImageData(CH, CH);
              put4(f2img.data, ly * CH + lx, [150, 200, 215], 200);
            }
            break;
          }
          case K.Sand: {
            const wet = near(x, y, 2, (o) => o === K.Water);
            c = shade(wet ? WET_SAND : SAND, (rnd - 0.5) * 0.18);
            if (rnd > 0.985) c = shade(c, -0.3);
            break;
          }
          case K.Road: {
            const rd = R.road[q];
            c = ROAD;
            if (Math.abs(rd - 0.45) < 0.12 || Math.abs(rd - 0.0) < 0.06) c = TRACK;
            c = shade(c, (rnd - 0.5) * 0.2 + (N(x, y, 8, seed + 3, 2) - 0.5) * 0.18);
            if (rd > 0.8 && rnd < 0.35) c = GRASS[2];
            if (rnd > 0.99) c = shade(ROCK, 0.1);
            break;
          }
          case K.Cliff: {
            const cv = R.cv;
            const gx = cv[q + 1] - cv[q - 1];
            const gy = cv[q + RW] - cv[q - RW];
            const fine = N(x, y, 4, seed + 50, 3) - 0.5;
            const l = (gx + gy) * 14 + fine * 1.1;
            c = l > 0.3 ? ROCK_L : l > -0.25 ? ROCK : ROCK_D;
            // raised look: lit rim on top, dark rock face along the bottom edge
            if (kk(x, y - 1) !== K.Cliff) c = ROCK_L;
            else if (kk(x, y + 1) !== K.Cliff) c = shade(ROCK_D, -0.35);
            else if (kk(x, y + 2) !== K.Cliff) c = shade(ROCK_D, -0.15);
            else if (kk(x, y + 3) !== K.Cliff) c = ROCK_D;
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
            if (rnd < 0.4 && near(x, y, 2, (o) => o === K.Cliff)) c = shade(mix(c, ROCK_D, 0.5), -0.1);
          }
        }
        // drop shadow cast by cliffs to the bottom-right
        if (k !== K.Cliff && (kk(x - 2, y - 3) === K.Cliff || kk(x - 1, y - 2) === K.Cliff)) c = shade(c, -0.4);
        const o = (ly * CH + lx) * 4;
        d[o] = c[0];
        d[o + 1] = c[1];
        d[o + 2] = c[2];
        d[o + 3] = 255;
      }

    // a couple of craters, kept clear of the tile's edges
    for (let n = 0; n < 2; n++) {
      if (hash2(tx, ty, seed + 900 + n) > 0.9) continue;
      const cx = 8 + Math.floor(hash2(tx, ty, seed + 910 + n) * (CH - 16));
      const cy = 8 + Math.floor(hash2(tx, ty, seed + 920 + n) * (CH - 16));
      const rr = 2 + hash2(tx, ty, seed + 930 + n) * 3;
      if (kk(X0 + cx, Y0 + cy) !== K.Grass) continue;
      for (let y = -4; y <= 4; y++)
        for (let x = -6; x <= 6; x++) {
          const dd = Math.hypot(x / 1.3, y) / rr;
          if (dd > 1.2) continue;
          const i = ((cy + y) * CH + cx + x) * 4;
          const f = dd < 0.7 ? -0.45 : dd < 1 ? (y < 0 ? -0.25 : 0.15) : -0.1;
          d[i] *= 1 + f;
          d[i + 1] *= 1 + f;
          d[i + 2] *= 1 + f;
        }
    }

    const foam = fimg || f2img ? canvasOf(fimg ?? new ImageData(CH, CH)) : null;
    const foam2 = foam ? canvasOf(f2img ?? new ImageData(CH, CH)) : null;
    return { canvas: canvasOf(img), foam, foam2, region: R };
  }

  // A coarse picture of the whole map, one pixel per OV map pixels: water,
  // beaches, roads, rock and grass, with `tint` to darken forests and so on.
  // Built a few rows at a time (for up to `ms` milliseconds per call); null
  // until it is finished.
  overview(tint: (x: number, y: number, c: RGB) => RGB, ms: number): HTMLCanvasElement | null {
    const tw = Math.round(this.w / OV);
    const th = Math.round(this.h / OV);
    const img = (this.ovImg ??= new ImageData(tw, th));
    const d = img.data;
    const { lakeF, ridgeF, jitX, jitY, roads, wThr, sandThr, cThr, wMax } = this;
    const t0 = performance.now();
    for (; this.ovRow < th && performance.now() - t0 < ms; this.ovRow++)
      for (let i = 0, j = this.ovRow; i < tw; i++) {
        const x = i * OV + OV / 2;
        const y = j * OV + OV / 2;
        const wv = lakeF.at(x, y);
        const rnd = hash2(i, j, this.seed + 3);
        let c: RGB;
        if (wv > wThr) c = mix(WATER_SHALLOW, WATER_DEEP, Math.pow(Math.min(1, ((wv - wThr) / (wMax - wThr)) * 1.6), 0.6));
        else if (wv > sandThr) c = SAND;
        else {
          const jx = jitX.at(x, y);
          const rd = roads.dist(x + (jx - 0.5) * 30, y + (jitY.at(x, y) - 0.5) * 30);
          if (rd < 1) c = ROAD;
          else if (1 - Math.abs(ridgeF.at(x, y) * 2 - 1) > cThr) c = rnd < 0.5 ? ROCK : ROCK_L;
          else c = tint(x, y, shade(mix(GRASS[2], GRASS[4], jx), (rnd - 0.5) * 0.12));
        }
        const o = (j * tw + i) * 4;
        d[o] = c[0];
        d[o + 1] = c[1];
        d[o + 2] = c[2];
        d[o + 3] = 255;
      }
    if (this.ovRow < th) return null;
    const cv = canvasOf(img);
    const c = cv.getContext('2d')!;
    c.fillStyle = `rgb(${PAD.join(',')})`;
    for (const p of this.pads) c.fillRect(p.x / OV, p.y / OV, p.w / OV, p.h / OV);
    return cv;
  }
}

function put4(d: Uint8ClampedArray, i: number, c: RGB, a: number): void {
  d[i * 4] = c[0];
  d[i * 4 + 1] = c[1];
  d[i * 4 + 2] = c[2];
  d[i * 4 + 3] = a;
}
