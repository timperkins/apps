// Isometric landscape for v2. Fields live on the screen-space map; the screen
// is painted per pixel by casting a ray through a two-level height field, so
// plateaus get real rock faces on their two visible sides.
//
// The screen-space map wraps round both ways: every `w` pixels across and every
// `h` pixels down. On the ground one lap across is the world-space shift
// (w/2, -w/2) and one lap down is (h, h), so lookups first fold a point back
// into the rectangle 0 <= sx < w, 0 <= sy < h. The land is the same all over.
// The map is planet-sized, so nothing is stored per pixel: the ground is
// classified and painted a tile at a time, on demand.
import { RGB, WorldField, WrapNoise, fbm, hash2, hex, mix, rng, shade, wrapNoise } from '../gfx';
import { CH, Roads, canvasOf } from '../tiles';
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
// Map pixels per pixel of the overview used for the globe and unpainted tiles.
export const OV = 4;
// Margin of ground classified round a tile's footprint, for the painter's
// neighbour tests, plateau shadows and props.
const M = 12;
// Ground features keep a fixed size however big the planet is.
export const LAKE_CELL = 234;
export const HIGH_CELL = 187;
const ROAD_HALF = 7;

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

function percentile(s: number[], q: number): number {
  const a = s.slice().sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.floor(a.length * q))] ?? 0;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Classified ground over a rectangle of world cells.
export interface Region {
  x0: number;
  y0: number;
  w: number;
  h: number;
  kind: Uint8Array;
  wv: Float32Array;
  road: Float32Array;
}

export interface PaintedTile {
  canvas: HTMLCanvasElement;
  foam: HTMLCanvasElement | null;
  foam2: HTMLCanvasElement | null;
  region: Region;
}

// How a map shapes its land (see maps.ts).
export interface LandShape {
  water: number; // share of the map under water
  high: number; // share raised into plateaus
  mask?: (sx: number, sy: number, w: number, h: number, N: WrapNoise, s: number) => number;
}

// A map's land mask, worked out on a coarse grid and interpolated.
class MaskField {
  private nx: number;
  private ny: number;
  private v: Float32Array;
  constructor(
    private w: number,
    private h: number,
    f: (sx: number, sy: number) => number,
    step = 32,
  ) {
    const nx = (this.nx = Math.max(8, Math.round(w / step)));
    const ny = (this.ny = Math.max(8, Math.round(h / step)));
    this.v = new Float32Array(nx * ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) this.v[j * nx + i] = f((i * w) / nx, (j * h) / ny);
  }
  at(x: number, y: number): number {
    const { nx, ny, v } = this;
    let fx = (x / this.w) * nx;
    let fy = (y / this.h) * ny;
    fx -= Math.floor(fx / nx) * nx;
    fy -= Math.floor(fy / ny) * ny;
    const i = Math.min(nx - 1, fx | 0);
    const j = Math.min(ny - 1, fy | 0);
    const tx = fx - i;
    const ty = fy - j;
    const i1 = i + 1 >= nx ? 0 : i + 1;
    const j1 = j + 1 >= ny ? 0 : j + 1;
    const a = v[j * nx + i] + (v[j * nx + i1] - v[j * nx + i]) * tx;
    const b = v[j1 * nx + i] + (v[j1 * nx + i1] - v[j1 * nx + i]) * tx;
    return a + (b - a) * ty;
  }
}

export class IsoTerrain {
  private wThr: number;
  private sandThr: number;
  private wMax: number;
  private hThr: number;
  private lakeF: WorldField;
  private highF: WorldField;
  private jitX: WorldField;
  private jitY: WorldField;
  private roads: Roads;
  readonly pads: Rect[] = [];
  private cache = new Map<number, Uint8Array>();
  private ovImg: ImageData | null = null;
  private ovRow = 0;
  private na: WrapNoise; // noise in rotated world units (along and across the screen)
  private ns: WrapNoise; // noise in screen pixels
  // bounding box of the folded map in world units, with room to spare
  private bx0: number;
  private by0: number;
  private bs: number;

  constructor(
    readonly w: number,
    readonly h: number,
    readonly seed: number,
    shape: LandShape = { water: 0.15, high: 0.14 },
  ) {
    const mask = shape.mask;
    if (mask) {
      const N = wrapNoise(w, h);
      this.mask = new MaskField(w, h, (sx, sy) => mask(sx, sy, w, h, N, seed + 300));
    }
    this.na = wrapNoise(w / Math.SQRT2, h * Math.SQRT2);
    this.ns = wrapNoise(w, h);
    this.lakeF = new WorldField(w, h, LAKE_CELL, seed, 5);
    this.highF = new WorldField(w, h, HIGH_CELL, seed + 211, 4);
    this.jitX = new WorldField(w, h, 30, seed + 7, 2, 8);
    this.jitY = new WorldField(w, h, 30, seed + 8, 2, 8);
    const rand = rng(seed * 37 + 11);
    const wv: number[] = [];
    const hv: number[] = [];
    for (let i = 0; i < 30000; i++) {
      const sx = rand() * w;
      const sy = rand() * h;
      wv.push(this.wat(sx, sy));
      hv.push(this.highF.at(sx, sy));
    }
    this.wThr = percentile(wv, 1 - shape.water);
    this.sandThr = percentile(wv, 1 - shape.water - 0.025);
    this.wMax = percentile(wv, 0.999);
    this.hThr = percentile(hv, 1 - shape.high);
    this.bx0 = -64;
    this.by0 = -w / 2 - 64;
    this.bs = w / 2 + h + HP + 128;
    this.roads = new Roads(this.bx0, this.by0, this.bs, this.bs);
  }

  private mask: MaskField | null = null;

  // How wet the ground is at screen point (sx, sy): water above wThr, beach
  // just below it.
  wat(sx: number, sy: number): number {
    return this.mask ? this.lakeF.at(sx, sy) + this.mask.at(sx, sy) : this.lakeF.at(sx, sy);
  }

  // Seamless noise over the ground, like fbm(wx / cell, wy / cell).
  noise(wx: number, wy: number, cell: number, s: number, oct = 4): number {
    return this.na((wx - wy) / Math.SQRT2, (wx + wy) / Math.SQRT2, cell, s, oct);
  }

  // The copy of world point (wx, wy) whose screen position is on the map.
  fold(wx: number, wy: number): [number, number] {
    const sy = (wx + wy) / 2;
    if (sy < 0 || sy >= this.h) {
      const k = Math.floor(sy / this.h) * this.h;
      wx -= k;
      wy -= k;
    }
    const sx = wx - wy;
    if (sx < 0 || sx >= this.w) {
      const k = Math.floor(sx / this.w) * (this.w / 2);
      wx -= k;
      wy += k;
    }
    return [wx, wy];
  }

  // world coordinates of a point on the screen-space map, on the ground
  at(sx: number, sy: number): [number, number] {
    return toWorld(sx, sy, 0);
  }

  // Roads as polylines in world units, with copies one lap round each way.
  setRoads(lines: [number, number][][]): void {
    const { w, h } = this;
    this.roads = new Roads(this.bx0, this.by0, this.bs, this.bs);
    for (const line of lines)
      for (let s = 0; s < line.length - 1; s++)
        for (const j of [-1, 0, 1])
          for (const k of [-1, 0, 1]) {
            const dx = (k * w) / 2 + j * h;
            const dy = (-k * w) / 2 + j * h;
            this.roads.add(line[s][0] + dx, line[s][1] + dy, line[s + 1][0] + dx, line[s + 1][1] + dy, ROAD_HALF, ROAD_HALF * 3 + 14);
          }
    this.cache.clear();
  }

  // Classify a rectangle of world cells (near the folded map).
  region(x0: number, y0: number, rw: number, rh: number): Region {
    const { w, h, highF, jitX, jitY, roads, wThr, sandThr, hThr } = this;
    const n = rw * rh;
    const r: Region = { x0, y0, w: rw, h: rh, kind: new Uint8Array(n), wv: new Float32Array(n), road: new Float32Array(n) };
    for (let j = 0; j < rh; j++)
      for (let i = 0; i < rw; i++) {
        const wx = x0 + i;
        const wy = y0 + j;
        let sx = wx - wy;
        let sy = (wx + wy) / 2;
        if (sx < 0 || sx >= w) sx -= Math.floor(sx / w) * w;
        if (sy < 0 || sy >= h) sy -= Math.floor(sy / h) * h;
        const q = j * rw + i;
        const wv = this.wat(sx, sy);
        const rd = wv > sandThr ? 99 : roads.dist(wx + (jitX.at(sx, sy) - 0.5) * 20, wy + (jitY.at(sx, sy) - 0.5) * 20);
        r.wv[q] = wv;
        r.road[q] = rd;
        r.kind[q] = wv > wThr ? K.Water : wv > sandThr ? K.Sand : rd < 1 ? K.Road : highF.at(sx, sy) > hThr && rd > 1.8 && wv < sandThr - 0.03 ? K.High : K.Grass;
      }
    // concrete pads under buildings
    for (const p of this.pads)
      for (const lj of [-1, 0, 1])
        for (const lk of [-1, 0, 1]) {
          const dx = (lk * w) / 2 + lj * h;
          const dy = (-lk * w) / 2 + lj * h;
          const px0 = Math.max(Math.floor(p.x + dx), x0);
          const py0 = Math.max(Math.floor(p.y + dy), y0);
          const px1 = Math.min(Math.ceil(p.x + p.w + dx), x0 + rw);
          const py1 = Math.min(Math.ceil(p.y + p.h + dy), y0 + rh);
          for (let y = py0; y < py1; y++)
            for (let x = px0; x < px1; x++) {
              const q = (y - y0) * rw + (x - x0);
              if (r.kind[q] === K.Grass) r.kind[q] = K.Pad;
            }
        }
    return r;
  }

  k(wx: number, wy: number): K {
    const [fx, fy] = this.fold(wx, wy);
    const X = Math.floor(fx) - this.bx0;
    const Y = Math.floor(fy) - this.by0;
    const key = (Y >> 6) * 4096 + (X >> 6);
    let b = this.cache.get(key);
    if (!b) {
      b = this.region(((X >> 6) << 6) + this.bx0, ((Y >> 6) << 6) + this.by0, 64, 64).kind;
      this.cache.set(key, b);
    }
    return b[(Y & 63) * 64 + (X & 63)] as K;
  }

  isHigh(wx: number, wy: number): boolean {
    return this.k(wx, wy) === K.High;
  }

  elev(wx: number, wy: number): number {
    return this.isHigh(wx, wy) ? HP : 0;
  }

  // Ground rect (world coords) free of water, sand, roads, plateaus and pads?
  clear(r: Rect, margin = 0): boolean {
    for (let y = r.y - margin; y <= r.y + r.h + margin; y += 2)
      for (let x = r.x - margin; x <= r.x + r.w + margin; x += 2) if (this.k(x, y) !== K.Grass) return false;
    return true;
  }

  markPad(r: Rect): void {
    this.pads.push(r);
    this.forget(r);
  }

  unmarkPad(r: Rect): void {
    const i = this.pads.indexOf(r);
    if (i >= 0) this.pads.splice(i, 1);
    this.forget(r);
  }

  // Drop the cached ground classes around a rect that changed.
  private forget(r: Rect): void {
    for (let y = Math.floor(r.y) - 64; y < r.y + r.h + 64; y += 32)
      for (let x = Math.floor(r.x) - 64; x < r.x + r.w + 64; x += 32) {
        const [fx, fy] = this.fold(x, y);
        this.cache.delete(((Math.floor(fy) - this.by0) >> 6) * 4096 + ((Math.floor(fx) - this.bx0) >> 6));
      }
  }

  // World-cell rect covering screen tile (tx, ty), plateaus and margins included.
  tileRegion(tx: number, ty: number): Region {
    const SX0 = tx * CH;
    const SY0 = ty * CH;
    const x0 = Math.floor(SX0 / 2 + SY0) - M;
    const x1 = Math.ceil((SX0 + CH) / 2 + SY0 + CH + HP) + M;
    const y0 = Math.floor(SY0 - (SX0 + CH) / 2) - M;
    const y1 = Math.ceil(SY0 + CH + HP - SX0 / 2) + M;
    return this.region(x0, y0, x1 - x0, y1 - y0);
  }

  // Paint screen tile (tx, ty) of the map.
  paintTile(tx: number, ty: number): PaintedTile {
    const { seed } = this;
    const N = (wx: number, wy: number, cell: number, s: number, oct: number) => this.noise(wx, wy, cell, s, oct);
    const R = this.tileRegion(tx, ty);
    const kAt = (wx: number, wy: number): K => {
      const i = Math.floor(wx) - R.x0;
      const j = Math.floor(wy) - R.y0;
      return i < 0 || j < 0 || i >= R.w || j >= R.h ? this.k(wx, wy) : (R.kind[j * R.w + i] as K);
    };
    const hiAt = (wx: number, wy: number) => kAt(wx, wy) === K.High;
    const SX0 = tx * CH;
    const SY0 = ty * CH;
    const img = new ImageData(CH, CH);
    const d = img.data;
    let fimg: ImageData | null = null;
    let f2img: ImageData | null = null;
    const put = (x: number, y: number, c: RGB) => {
      if (x < 0 || y < 0 || x >= CH || y >= CH) return;
      const i = (y * CH + x) * 4;
      d[i] = c[0];
      d[i + 1] = c[1];
      d[i + 2] = c[2];
      d[i + 3] = 255;
    };
    const near = (wx: number, wy: number, r: number, test: (k: K) => boolean) => {
      for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if ((i || j) && test(kAt(wx + i, wy + j))) return true;
      return false;
    };
    const padEdge = (wx: number, wy: number) => kAt(wx + 1, wy) !== K.Pad || kAt(wx - 1, wy) !== K.Pad || kAt(wx, wy + 1) !== K.Pad || kAt(wx, wy - 1) !== K.Pad;
    const tufts: [number, number, RGB][] = [];

    for (let ly = 0; ly < CH; ly++)
      for (let lx = 0; lx < CH; lx++) {
        const sx = SX0 + lx;
        const sy = SY0 + ly;
        const rnd = hash2(sx, sy, seed);
        const px = sx + 0.5;
        const py = sy + 0.5;
        // ray cast against the plateau height field
        let hitZ = -1;
        let wx = 0;
        let wy = 0;
        for (let z = HP; z >= 0; z--) {
          const ax = px / 2 + py + z;
          const ay = py + z - px / 2;
          if (hiAt(ax, ay)) {
            hitZ = z;
            wx = ax;
            wy = ay;
            break;
          }
        }
        let c: RGB;
        if (hitZ === HP) {
          // plateau top
          const tone = N(wx, wy, 9, seed + 40, 3);
          c = HIGH[Math.max(0, Math.min(3, Math.floor(tone * 4 + (rnd - 0.5) * 1.6)))];
          if (rnd > 0.975) c = shade(ROCK, (rnd - 0.975) * 8);
          const rim = !hiAt(wx + 1.2, wy) || !hiAt(wx, wy + 1.2);
          const back = !hiAt(wx - 1.2, wy) || !hiAt(wx, wy - 1.2);
          if (rim) c = shade(mix(c, ROCK_L, 0.5), 0.1);
          else if (back) c = shade(c, -0.25);
        } else if (hitZ >= 0) {
          // rock face: +x faces are in shade, +y faces catch the light
          const rightFace = !hiAt(wx + 1, wy);
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
          wx = px / 2 + py;
          wy = py - px / 2;
          const i = Math.floor(wx) - R.x0;
          const j = Math.floor(wy) - R.y0;
          const q = j * R.w + i;
          const k = R.kind[q] as K;
          switch (k) {
            case K.Water: {
              const depth = Math.min(1, ((R.wv[q] - this.wThr) / (this.wMax - this.wThr)) * 1.6);
              c = mix(W_SHALLOW, W_DEEP, Math.pow(depth, 0.6));
              const rip = this.ns(sx, sy, 7, seed + 30, 2, 1.7);
              if (rip > 0.62) c = shade(c, 0.12);
              else if (rip < 0.33) c = shade(c, -0.08);
              c = shade(c, (rnd - 0.5) * 0.07);
              const land = (kk: K) => kk !== K.Water;
              if (near(wx, wy, 1, land)) {
                if (!fimg) fimg = new ImageData(CH, CH);
                put4(fimg.data, ly * CH + lx, [195, 228, 232], 235);
              } else if (near(wx, wy, 3, land) && rnd < 0.4) {
                if (!f2img) f2img = new ImageData(CH, CH);
                put4(f2img.data, ly * CH + lx, [150, 200, 215], 200);
              }
              // dark bank line just below the shore
              if (land(kAt(wx - 1, wy - 1))) c = shade(c, -0.2);
              break;
            }
            case K.Sand: {
              const wet = near(wx, wy, 2, (kk) => kk === K.Water);
              c = wet ? WET : SAND;
              // wind ripples
              if (Math.sin((wx + wy * 0.3) * 1.3 + N(wx, wy, 8, seed, 2) * 6) > 0.8) c = shade(c, -0.08);
              c = shade(c, (rnd - 0.5) * 0.14);
              if (rnd > 0.988) c = shade(c, -0.35);
              break;
            }
            case K.Road: {
              const rd = R.road[q];
              c = ROAD;
              if (Math.abs(rd - 0.45) < 0.1) c = RUT;
              c = shade(c, (rnd - 0.5) * 0.18 + (N(wx, wy, 6, seed + 3, 2) - 0.5) * 0.2);
              if (rd > 0.82 && rnd < 0.4) c = GRASS[2];
              if (N(wx, wy, 5, seed + 17, 2) > 0.72 && rd < 0.6) c = shade(mix(c, W_SHALLOW, 0.35), -0.15); // puddles
              if (rnd > 0.99) c = shade(ROCK, 0.1);
              break;
            }
            case K.Pad: {
              // concrete slab with seams every 8 units
              const seam = ((wx % 8) + 8) % 8 < 0.7 || ((wy % 8) + 8) % 8 < 0.7;
              c = seam ? CONC_D : shade(CONC, (N(wx, wy, 4, seed + 9, 2) - 0.5) * 0.25);
              if (padEdge(wx, wy)) c = shade(CONC_D, -0.1);
              if (!seam && rnd > 0.985) c = shade(c, -0.3); // oil stains
              c = shade(c, (rnd - 0.5) * 0.1);
              break;
            }
            default: {
              const patch = N(wx, wy, 18, seed + 11, 3);
              const tone = N(wx, wy, 5, seed + 12, 2);
              const tile = (hash2(Math.floor(wx / 8), Math.floor(wy / 8), seed + 2) - 0.5) * 0.6;
              let gi = Math.floor((patch * 0.7 + tone * 0.3) * 6 + tile + (rnd - 0.5) * 2);
              gi = Math.max(0, Math.min(GRASS.length - 1, gi));
              c = GRASS[gi];
              const dirt = N(wx, wy, 24, seed + 13, 3);
              if (dirt > 0.65 && rnd < (dirt - 0.65) * 6) c = mix(c, DIRT, 0.6);
              if (rnd > 0.975) tufts.push([lx, ly, shade(GRASS[5], 0.15)]);
              else if (rnd < 0.004) c = FLOWER[Math.floor(hash2(sx, sy, 3) * 3)];
              else if (rnd < 0.012) c = shade(c, -0.4);
              if (rnd < 0.3 && near(wx, wy, 2, (kk) => kk === K.High)) c = shade(mix(c, ROCK_D, 0.5), -0.05); // rubble
            }
          }
          // shadows cast by plateaus
          for (let t = 1; t <= 9; t++) {
            if (hiAt(wx - t, wy + t * 0.25)) {
              c = shade(c, -0.38);
              break;
            }
          }
        }
        put(lx, ly, c);
      }
    for (const [x, y, c] of tufts) {
      put(x, y, c);
      put(x, y - 1, shade(c, 0.1));
    }

    // a couple of craters, kept clear of the tile's edges
    for (let n = 0; n < 2; n++) {
      if (hash2(tx, ty, seed + 900 + n) > 0.8) continue;
      const cx = 8 + Math.floor(hash2(tx, ty, seed + 910 + n) * (CH - 16));
      const cy = 6 + Math.floor(hash2(tx, ty, seed + 920 + n) * (CH - 12));
      const rr = 2.5 + hash2(tx, ty, seed + 930 + n) * 3;
      const [cwx, cwy] = toWorld(SX0 + cx, SY0 + cy, 0);
      if (kAt(cwx, cwy) !== K.Grass || hiAt(cwx + HP, cwy + HP)) continue;
      for (let y = -4; y <= 4; y++)
        for (let x = -7; x <= 7; x++) {
          const dd = Math.hypot(x / 2, y) / (rr * 0.6);
          if (dd > 1.25) continue;
          const i = ((cy + y) * CH + cx + x) * 4;
          const f = dd < 0.7 ? -0.45 : dd < 1 ? (y < 0 ? -0.25 : 0.18) : -0.1;
          d[i] *= 1 + f;
          d[i + 1] *= 1 + f;
          d[i + 2] *= 1 + f;
        }
    }

    const foam = fimg || f2img ? canvasOf(fimg ?? new ImageData(CH, CH)) : null;
    const foam2 = foam ? canvasOf(f2img ?? new ImageData(CH, CH)) : null;
    return { canvas: canvasOf(img), foam, foam2, region: R };
  }

  // A coarse picture of the whole map, one pixel per OV screen pixels, with
  // `tint` to darken forests and so on.
  // Built a few rows at a time (for up to `ms` milliseconds per call); null
  // until it is finished.
  overview(tint: (sx: number, sy: number, c: RGB) => RGB, ms: number): HTMLCanvasElement | null {
    const tw = Math.round(this.w / OV);
    const th = Math.round(this.h / OV);
    const img = (this.ovImg ??= new ImageData(tw, th));
    const d = img.data;
    const { highF, jitX, jitY, roads, wThr, sandThr, wMax, hThr, w, h } = this;
    const t0 = performance.now();
    for (; this.ovRow < th && performance.now() - t0 < ms; this.ovRow++)
      for (let i = 0, j = this.ovRow; i < tw; i++) {
        const sx = i * OV + OV / 2;
        const sy = j * OV + OV / 2;
        const rnd = hash2(i, j, this.seed + 3);
        // plateau tops sit HP pixels up the screen from their ground
        let tsy = sy + HP;
        if (tsy >= h) tsy -= h;
        const lift = highF.at(sx, tsy) > hThr && this.wat(sx, tsy) < sandThr - 0.03;
        let c: RGB;
        const wv = this.wat(sx, sy);
        if (lift) c = HIGH[1 + Math.floor(rnd * 2)];
        else if (wv > wThr) c = mix(W_SHALLOW, W_DEEP, Math.pow(Math.min(1, ((wv - wThr) / (wMax - wThr)) * 1.6), 0.6));
        else if (wv > sandThr) c = SAND;
        else {
          const [wx, wy] = toWorld(sx, sy, 0);
          const jx = jitX.at(sx, sy);
          const rd = roads.dist(wx + (jx - 0.5) * 20, wy + (jitY.at(sx, sy) - 0.5) * 20);
          if (rd < 1) c = ROAD;
          else if (highF.at(sx, sy) > hThr) c = rnd < 0.5 ? ROCK : ROCK_D;
          else c = tint(sx, sy, shade(mix(GRASS[2], GRASS[4], jx), (rnd - 0.5) * 0.12));
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
    c.fillStyle = `rgb(${CONC.join(',')})`;
    for (const p of this.pads) {
      // the pad's diamond on the screen, wrapped onto the map
      const pts = [toScreen(p.x, p.y), toScreen(p.x + p.w, p.y), toScreen(p.x + p.w, p.y + p.h), toScreen(p.x, p.y + p.h)];
      const ox = Math.floor(pts[0][0] / w) * w;
      const oy = Math.floor(pts[0][1] / h) * h;
      c.beginPath();
      pts.forEach(([x, y], n) => (n ? c.lineTo((x - ox) / OV, (y - oy) / OV) : c.moveTo((x - ox) / OV, (y - oy) / OV)));
      c.fill();
    }
    return cv;
  }
}

function put4(d: Uint8ClampedArray, i: number, c: RGB, a: number): void {
  d[i * 4] = c[0];
  d[i * 4 + 1] = c[1];
  d[i * 4 + 2] = c[2];
  d[i * 4 + 3] = a;
}
