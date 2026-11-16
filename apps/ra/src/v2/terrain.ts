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
import { ART, RGB, WorldField, WrapNoise, fbm, hash2, hex, mix, rng, shade, vnoise, wrapNoise } from '../gfx';
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
// The furthest a cliff's slope reaches out past the rim at its foot.
const SLOPE_OUT = Math.ceil(HP * 0.7 + 1.2);
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
const FLOWER = [hex('#e8dc72'), hex('#e6e0d0'), hex('#c98ac0'), hex('#d9694a'), hex('#8fa6e0')];
const DRY = hex('#8a8444');
const CLOVER = hex('#2a5a3a');
const W_BANDS = ['#5a9db0', '#4a8aa6', '#3b7498', '#2e5f86', '#244c72', '#1c3d5c'].map(hex);

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
  hi: Float32Array; // above zero on plateaus, falling away smoothly outside them
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
    const r: Region = { x0, y0, w: rw, h: rh, kind: new Uint8Array(n), wv: new Float32Array(n), road: new Float32Array(n), hi: new Float32Array(n) };
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
        const hi = (r.hi[q] = Math.min(highF.at(sx, sy) - hThr, (rd - 1.8) * 0.02, sandThr - 0.03 - wv));
        r.kind[q] = wv > wThr ? K.Water : wv > sandThr ? K.Sand : rd < 1 ? K.Road : hi > 0 ? K.High : K.Grass;
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

  // Is (wx, wy) up on a plateau or on the broken rock below its rim? Nothing
  // on the ground can go there. (The rock slopes out from the rim towards +x
  // and +y, the sides you see: see rockOut in paintSteps.)
  cliff(wx: number, wy: number): boolean {
    return (
      this.isHigh(wx, wy) ||
      this.isHigh(wx - 3, wy - 3) ||
      this.isHigh(wx - 6, wy - 6) ||
      this.isHigh(wx - 2, wy) ||
      this.isHigh(wx, wy - 2) ||
      this.isHigh(wx + 2, wy) ||
      this.isHigh(wx, wy + 2)
    );
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

  // Paint screen tile (tx, ty) of the map, at ART pixels to the map pixel.
  paintTile(tx: number, ty: number): PaintedTile {
    const g = this.paintSteps(tx, ty);
    for (;;) {
      const r = g.next();
      if (r.done) return r.value;
    }
  }

  // The same, a few rows at a time: painting a tile is too much work for one
  // frame, so the caller spreads the steps over several.
  *paintSteps(tx: number, ty: number): Generator<void, PaintedTile> {
    const { seed, wThr, sandThr } = this;
    const S = ART;
    const NP = CH * S;
    const R = this.tileRegion(tx, ty);
    const rw = R.w;
    const rh = R.h;
    const SX0 = tx * CH;
    const SY0 = ty * CH;

    // Smooth lookups into the region's fields, so shores, road edges and
    // plateau rims follow the art's finer grid and not the map's.
    const bl = (a: Float32Array, wx: number, wy: number): number => {
      const fx = wx - R.x0;
      const fy = wy - R.y0;
      let i = Math.floor(fx);
      let j = Math.floor(fy);
      if (i < 0) i = 0;
      else if (i > rw - 2) i = rw - 2;
      if (j < 0) j = 0;
      else if (j > rh - 2) j = rh - 2;
      const ax = Math.max(0, Math.min(1, fx - i));
      const ay = Math.max(0, Math.min(1, fy - j));
      const q = j * rw + i;
      return (a[q] * (1 - ax) + a[q + 1] * ax) * (1 - ay) + (a[q + rw] * (1 - ax) + a[q + rw + 1] * ax) * ay;
    };
    // cells on or next to high ground, so most rays skip the smooth lookup
    const hiNear = new Uint8Array(rw * rh);
    let anyHigh = false;
    for (let j = 0; j < rh; j++)
      for (let i = 0; i < rw; i++)
        if (R.hi[j * rw + i] > 0) {
          anyHigh = true;
          for (let b = Math.max(0, j - 2); b <= Math.min(rh - 1, j + 2); b++) for (let a = Math.max(0, i - 2); a <= Math.min(rw - 1, i + 2); a++) hiNear[b * rw + a] = 1;
        }
    // cells with high ground within reach of its shadow (towards the light)
    const hiClose = new Uint8Array(rw * rh);
    if (anyHigh)
      for (let j = 0; j < rh; j++)
        for (let i = 0; i < rw; i++) {
          if (!hiNear[j * rw + i]) continue;
          for (let b = Math.max(0, j - 4); b <= Math.min(rh - 1, j + 15); b++) for (let a = i; a <= Math.min(rw - 1, i + 16); a++) hiClose[b * rw + a] = 1;
        }
    // (the rim is pushed in and out a little by noise, so the edge of the
    // rock breaks up raggedly instead of running smooth)
    const hiAt = (wx: number, wy: number): boolean => {
      const i = Math.floor(wx) - R.x0;
      const j = Math.floor(wy) - R.y0;
      if (i < 0 || j < 0 || i >= rw || j >= rh) return this.isHigh(wx, wy);
      if (hiNear[j * rw + i] !== 1) return false;
      const jx = (vnoise(wx * 0.3, wy * 0.3, seed + 41) - 0.5) * 2.2 + (vnoise(wx * 0.9, wy * 0.9, seed + 43) - 0.5) * 0.9;
      const jy = (vnoise(wx * 0.3, wy * 0.3, seed + 42) - 0.5) * 2.2 + (vnoise(wx * 0.9, wy * 0.9, seed + 44) - 0.5) * 0.9;
      return bl(R.hi, wx + jx, wy + jy) > 0;
    };
    // Broken rock: a jumble of stones, each a cell of a jittered grid in
    // (u, v). Gives the stone's id, how far the point is from the crack
    // round it, and where it is in the stone (for lighting it as a facet).
    const stone = (u: number, v: number, s: number): [number, number, number, number] => {
      const ci = Math.floor(u);
      const cj = Math.floor(v);
      let d1 = 9;
      let d2 = 9;
      let id = 0;
      let ox = 0;
      let oy = 0;
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          const gi = ci + di;
          const gj = cj + dj;
          const cx = gi + 0.1 + hash2(gi, gj, s) * 0.8;
          const cy = gj + 0.1 + hash2(gi, gj, s + 1) * 0.8;
          const dd = Math.hypot(u - cx, v - cy);
          if (dd < d1) {
            d2 = d1;
            d1 = dd;
            id = hash2(gi, gj, s + 2);
            ox = u - cx;
            oy = v - cy;
          } else if (dd < d2) d2 = dd;
        }
      return [id, d2 - d1, ox, oy];
    };

    // How far out the rock reaches at height z below the rim (world units,
    // towards +x and +y, the sides you see): a rough slope down to the foot.
    const rockOut = (ax: number, ay: number, z: number): number => {
      const down = HP - z;
      // (steeper where a road runs under it, so the rock doesn't spill over the road)
      const sl = (0.25 + 0.45 * vnoise(ax * 0.15, ay * 0.15, seed + 46)) * Math.max(0.2, Math.min(1, (bl(R.road, ax, ay) - 1.2) / 1.5));
      const ledge = (vnoise((ax - ay) * 0.4, z * 0.45, seed + 47) - 0.5) * 2.4 * Math.min(1, down / 3);
      return Math.max(0, down * sl + ledge);
    };

    // Slow-changing noise, worked out on a coarse lattice over the tile (the
    // ground point under screen point (x, y)) and interpolated.
    const LS = 2;
    const ln = CH / LS + 1;
    const lm = Math.ceil((CH + HP) / LS) + 2;
    const lattice = (cell: number, s: number, oct: number, screenY = 0) => {
      const a = new Float32Array(ln * lm);
      for (let j = 0; j < lm; j++)
        for (let i = 0; i < ln; i++) {
          const x = SX0 + i * LS;
          const y = SY0 + j * LS;
          a[j * ln + i] = screenY ? this.ns(x, y, cell, s, oct, screenY) : this.noise(x / 2 + y, y - x / 2, cell, s, oct);
        }
      return (x: number, y: number): number => {
        const fx = (x - SX0) / LS;
        const fy = (y - SY0) / LS;
        const i = Math.max(0, Math.min(ln - 2, Math.floor(fx)));
        const j = Math.max(0, Math.min(lm - 2, Math.floor(fy)));
        const ax = fx - i;
        const ay = fy - j;
        const q = j * ln + i;
        return (a[q] * (1 - ax) + a[q + 1] * ax) * (1 - ay) + (a[q + ln] * (1 - ax) + a[q + ln + 1] * ax) * ay;
      };
    };
    const nPatch = lattice(18, seed + 11, 3);
    const nTone = lattice(6, seed + 12, 2);
    const nDirt = lattice(24, seed + 13, 3);
    const nBloom = lattice(34, seed + 14, 2);
    const nFine = lattice(5, seed + 17, 2);
    // water only: ripples and foam, stretched across the screen
    let nRip: ((x: number, y: number) => number) | null = null;
    let nFoam: ((x: number, y: number) => number) | null = null;

    const img = new ImageData(NP, NP);
    const d = img.data;
    let fimg: ImageData | null = null;
    let f2img: ImageData | null = null;
    const put = (x: number, y: number, c: RGB) => {
      if (x < 0 || y < 0 || x >= NP || y >= NP) return;
      const i = (y * NP + x) * 4;
      d[i] = c[0];
      d[i + 1] = c[1];
      d[i + 2] = c[2];
      d[i + 3] = 255;
    };
    const dots: [number, number, RGB][] = [];
    const wRange = this.wMax - wThr;
    const beach = wThr - sandThr;

    yield;
    for (let ly = 0; ly < NP; ly++) {
      if (ly % 12 === 0) yield;
      for (let lx = 0; lx < NP; lx++) {
        const px = SX0 + (lx + 0.5) / S;
        const py = SY0 + (ly + 0.5) / S;
        // the art pixel's own place on the map, for grain
        const ix = SX0 * S + lx;
        const iy = SY0 * S + ly;
        const rnd = hash2(ix, iy, seed);
        // ray cast against the plateau height field
        let hitZ = -1;
        let wx = 0;
        let wy = 0;
        let lean = 0; // how far the rock face leans back where the ray hit it
        if (anyHigh) {
          // a quick pass along the ray over the coarse cells first: most rays
          // pass nowhere near high ground
          const bx = px / 2 + py - R.x0;
          const by = py - px / 2 - R.y0;
          let may = false;
          for (let t = HP + 1; t >= -SLOPE_OUT; t--) {
            const i = (bx + t) | 0;
            const j = (by + t) | 0;
            if (i >= 0 && j >= 0 && i < rw && j < rh && hiNear[j * rw + i]) {
              may = true;
              break;
            }
          }
          if (may)
            for (let z = HP; z >= 0; z -= 0.5) {
              // the cliff isn't sheer: it slopes out towards its foot, more
              // in some places than others, with ledges and bulges
              const ax = px / 2 + py + z;
              const ay = py + z - px / 2;
              const o = z >= HP ? 0 : rockOut(ax, ay, z);
              if (hiAt(ax - o, ay - o)) {
                if (z < HP) lean = (rockOut(ax, ay, z - 0.5) - o) * 2;
                hitZ = z;
                wx = ax - o;
                wy = ay - o;
                break;
              }
            }
        }
        let c: RGB;
        if (hitZ === HP) {
          // plateau top: drier grass, with a lip of broken stone along the drop
          const gy = py + HP;
          const tone = nTone(px, gy) * 0.6 + nPatch(px, gy) * 0.4;
          c = HIGH[Math.max(0, Math.min(3, Math.floor(tone * 4.6 - 0.3 + (rnd - 0.5) * 1.5)))];
          const r2 = hash2(ix >> 1, iy >> 1, seed + 21);
          if (r2 > 0.985) c = shade(ROCK, (rnd - 0.5) * 0.3);
          else if (rnd > 0.98) c = shade(c, 0.1);
          else if (rnd < 0.03) c = shade(c, -0.2);
          const lip = !hiAt(wx + 0.8, wy) || !hiAt(wx, wy + 0.8);
          const rim = lip || !hiAt(wx + 2.2, wy) || !hiAt(wx, wy + 2.2);
          const back = !hiAt(wx - 1.2, wy) || !hiAt(wx, wy - 1.2);
          // bare rock breaks through along the edge in patches, not as a kerb
          const bare = vnoise(wx * 0.45, wy * 0.45, seed + 45);
          if (lip && bare > 0.35) c = shade(mix(ROCK, ROCK_L, r2), rnd > 0.85 ? -0.18 : 0.06);
          else if (lip) c = shade(c, -0.1);
          else if (rim && bare > 0.55 && r2 > 0.4) c = shade(mix(ROCK, ROCK_L, r2), rnd > 0.8 ? -0.2 : 0);
          else if (back) c = shade(c, -0.22);
        } else if (hitZ >= 0) {
          // a face of broken rock: +x faces are in shade, +y faces catch the
          // light. Rough layers, each a jumble of stones with dark cracks
          // between, lit on their upper sides, with the odd deep fissure,
          // lichen and moss, and grass hanging over the top.
          const rightFace = !hiAt(wx + 0.7, wy);
          const along = rightFace ? wy : wx;
          const zz = hitZ + (fbm(along / 7, 0, seed + 3, 2) - 0.5) * 5;
          const [id, crack, ox, oy] = stone(along / 5, zz / 4.2, seed + 4);
          // big slabs and smaller stones side by side
          const [id2, crack2, ox2, oy2] = stone(along / 2.4, zz / 1.9, seed + 14);
          const fine = vnoise(along / 9, 0.5, seed + 15) > 0.55;
          const sid = fine ? id2 : id;
          const scr = fine ? crack2 * 1.8 : crack;
          const sox = fine ? ox2 : ox;
          const soy = fine ? oy2 : oy;
          c = mix(ROCK_D, ROCK_L, 0.2 + sid * 0.65);
          // sloping rock catches the sky, sheer rock is darker
          c = shade(c, Math.max(-0.22, Math.min(0.16, (lean - 0.55) * 0.25)));
          c = shade(c, (vnoise(along / 14, zz / 20, seed + 16) - 0.5) * 0.3); // broad weathering
          if (sid > 0.84) c = mix(c, hex('#8d7a5c'), 0.55); // a browner stone now and then
          else if (sid < 0.14) c = mix(c, hex('#6e6f68'), 0.5); // or a greyer one
          // facets lit from up and to the left: each stone bulges, so its
          // upper side is bright and its foot falls into shadow
          const lit = soy * 0.9 + sox * (rightFace ? -0.3 : 0.4);
          c = shade(c, Math.max(-0.38, Math.min(0.26, lit * 0.7 + (soy > 0.2 ? 0.08 : 0))));
          const fis = Math.abs(fbm(along / 2.2, hitZ / 9, seed + 7, 2) - 0.5);
          const seam = vnoise(along / 3, zz / 3, seed + 17) > 0.3; // some joints are healed over
          if (scr < 0.06 && seam) c = shade(ROCK_D, -0.32 - (0.06 - scr) * 3); // cracks
          else if (scr < 0.12 && soy < -0.1 && seam) c = shade(c, -0.2); // shadow under a ledge
          else if (fis < 0.016 && hash2(Math.floor(along / 5), 0, seed + 9) > 0.55) c = shade(ROCK_D, -0.45); // a deep fissure
          else if (hash2(Math.floor(along * 2), Math.floor(zz * 2), seed + 6) > 0.92) c = shade(c, -0.14); // pitting
          const crack3 = scr;
          const moss = vnoise(along / 4, hitZ / 3, seed + 10);
          if (crack3 >= 0.06 && moss > 0.68 && rnd < (moss - 0.68) * 4) c = mix(c, HIGH[1], 0.6);
          else if (crack3 >= 0.06 && rnd > 0.985) c = mix(c, hex('#a9a36c'), 0.5); // lichen
          c = shade(c, rightFace ? -0.34 : 0);
          if (hitZ <= 1.5) c = shade(c, -0.22);
          if (hitZ > HP - 3.5 && hash2(Math.floor(along * 1.5), Math.floor(hitZ * 2), seed + 8) > 0.74 - (hitZ - HP + 3.5) * 0.12) c = mix(c, rightFace ? HIGH[0] : HIGH[2], 0.75); // grass hanging over the edge
          c = shade(c, (rnd - 0.5) * 0.1);
        } else {
          wx = px / 2 + py;
          wy = py - px / 2;
          const wv = bl(R.wv, wx, wy);
          const ci = Math.max(0, Math.min(rw - 1, Math.floor(wx) - R.x0));
          const cj = Math.max(0, Math.min(rh - 1, Math.floor(wy) - R.y0));
          const kc = R.kind[cj * rw + ci] as K;
          const rd = wv > sandThr ? 99 : bl(R.road, wx, wy);
          const k: K = wv > wThr ? K.Water : wv > sandThr ? K.Sand : kc === K.Pad ? K.Pad : rd < 1 ? K.Road : K.Grass;
          switch (k) {
            case K.Water: {
              // bands of depth, dithered where they meet, with the sandy bed showing in the shallows
              const dep = Math.min(1, ((wv - wThr) / wRange) * 1.6);
              const t = Math.pow(dep, 0.6) * (W_BANDS.length - 1);
              const bi = Math.min(W_BANDS.length - 1, Math.floor(t + (rnd - 0.5) * 0.5));
              c = W_BANDS[Math.max(0, bi)];
              nRip ??= lattice(7, seed + 30, 2, 1.7);
              nFoam ??= lattice(5, seed + 33, 2, 1.4);
              const rip = nRip(px, py);
              const rip2 = hash2(ix >> 2, iy, seed + 31) * 0.6 + rnd * 0.4; // short dashes
              if (rip > 0.6 && rip2 > 0.5) c = shade(c, rip > 0.7 && rip2 > 0.66 ? 0.2 : 0.07);
              else if (rip < 0.34) c = shade(c, -0.09);
              if (dep < 0.1 && rnd > 0.9) c = mix(c, SAND, 0.35);
              if (rnd > 0.9985 && dep > 0.15) c = [226, 244, 248]; // a glint
              const edge = wv - wThr;
              if (edge < beach * 0.22) {
                if (!fimg) fimg = new ImageData(NP, NP);
                if (edge < beach * 0.1 || rnd < 0.5) put4(fimg.data, ly * NP + lx, [205, 234, 236], 235);
              } else if (edge < beach * 0.75 && nFoam(px, py) > 0.56 && rnd < 0.6) {
                if (!f2img) f2img = new ImageData(NP, NP);
                put4(f2img.data, ly * NP + lx, [160, 208, 220], 200);
              }
              // dark bank line just below the shore
              if (bl(R.wv, wx - 1.2, wy - 1.2) <= wThr) c = shade(c, -0.22);
              break;
            }
            case K.Sand: {
              const sh = (wThr - wv) / beach; // 0 at the water, 1 at the grass
              c = sh < 0.2 ? WET : sh < 0.3 && rnd < 0.5 ? WET : SAND;
              // wind ripples, tide lines, pebbles, shells and tufts creeping in from the grass
              const rp = Math.sin((wx + wy * 0.3) * 1.3 + nPatch(px, py) * 9);
              if (rp > 0.82) c = shade(c, -0.09);
              else if (rp < -0.9) c = shade(c, 0.07);
              if (Math.abs(sh - 0.38 - nFine(px, py) * 0.12) < 0.025) c = shade(c, -0.14);
              c = shade(c, (rnd - 0.5) * 0.1);
              const r2 = hash2(ix, iy, seed + 22);
              if (r2 > 0.994) c = shade(ROCK, (rnd - 0.5) * 0.4);
              else if (r2 < 0.003) c = [236, 228, 208];
              else if (sh > 0.72 && rnd < (sh - 0.72) * 2.2) c = GRASS[2 + Math.floor(r2 * 3)];
              else if (sh > 0.5 && r2 > 0.985) dots.push([lx, ly, shade(DRY, 0.05)]);
              break;
            }
            case K.Road: {
              // packed dirt: two wheel ruts with a crown between, a gravel
              // shoulder and grass breaking in at the edges
              const fine = nFine(px, py);
              c = shade(ROAD, (fine - 0.5) * 0.24 + (rnd - 0.5) * 0.1);
              const rut = Math.abs(rd - 0.45);
              if (rut < 0.07) c = shade(RUT, -0.08);
              else if (rut < 0.15) c = RUT;
              else if (Math.abs(rd - 0.62) < 0.04) c = shade(ROAD, 0.1);
              const r2 = hash2(ix, iy, seed + 23);
              if (rd < 0.2 && r2 > 0.9 && fine > 0.45) c = shade(GRASS[3], (rnd - 0.5) * 0.2); // weeds down the middle
              if (rd > 0.8 && rnd < (rd - 0.8) * 4.5) c = GRASS[1 + Math.floor(r2 * 3)];
              else if (r2 > 0.988) c = shade(ROCK, 0.05 + (rnd - 0.5) * 0.3);
              else if (r2 < 0.012) c = shade(c, -0.22);
              if (fine > 0.74 && rd < 0.62) c = fine > 0.77 ? shade(mix(RUT, W_SHALLOW, 0.5), rnd > 0.93 ? 0.3 : -0.1) : shade(RUT, -0.2); // puddles
              break;
            }
            case K.Pad: {
              // concrete slabs: joints every 8 units, lit along one side, with
              // hairline cracks, stains and a kerb
              const mx = ((wx % 8) + 8) % 8;
              const my = ((wy % 8) + 8) % 8;
              const slab = hash2(Math.floor(wx / 8), Math.floor(wy / 8), seed + 9);
              c = shade(CONC, (slab - 0.5) * 0.12 + (nFine(px, py) - 0.5) * 0.14 + (rnd - 0.5) * 0.06);
              if (mx < 0.5 || my < 0.5) c = CONC_D;
              else if (mx < 1 || my < 1) c = shade(c, 0.1);
              else {
                const cr = this.noise(wx, wy, 7, seed + 24 + Math.floor(slab * 3), 2);
                if (slab > 0.6 && Math.abs(cr - 0.5) < 0.012) c = shade(c, -0.25);
                const r2 = hash2(ix >> 1, iy >> 1, seed + 25);
                if (r2 > 0.992) c = shade(c, -0.28); // oil
                else if (slab < 0.12 && (mx - 4) ** 2 + (my - 4) ** 2 < 2.2) c = (mx - 4) ** 2 + (my - 4) ** 2 < 1.2 && (Math.floor(mx * 2) + Math.floor(my * 2)) % 2 ? shade(CONC_D, -0.3) : CONC_D; // drain
              }
              const pad = (x: number, y: number) => {
                const i = Math.floor(x) - R.x0;
                const j = Math.floor(y) - R.y0;
                return i >= 0 && j >= 0 && i < rw && j < rh && R.kind[j * rw + i] === K.Pad;
              };
              if (!pad(wx + 0.6, wy) || !pad(wx, wy + 0.6)) c = shade(CONC_D, -0.2);
              else if (!pad(wx - 0.6, wy) || !pad(wx, wy - 0.6)) c = shade(CONC, 0.2);
              else if (!pad(wx + 1.6, wy) || !pad(wx, wy + 1.6) || !pad(wx - 1.6, wy) || !pad(wx, wy - 1.6)) c = shade(CONC, 0.06);
              break;
            }
            default: {
              // grass: broad patches of tone, mottled finely, with blades,
              // drifts of flowers, clover, dry and bare patches and pebbles
              const patch = nPatch(px, py);
              const tone = nTone(px, py);
              const cell = (hash2(ix >> 1, iy >> 1, seed + 2) - 0.5) * 1.3;
              let gi = Math.floor((patch * 0.7 + tone * 0.3) * 6.4 - 0.2 + cell + (rnd - 0.5) * 1.2);
              gi = Math.max(0, Math.min(GRASS.length - 1, gi));
              c = GRASS[gi];
              const dirt = nDirt(px, py);
              const bloom = nBloom(px, py);
              const r2 = hash2(ix, iy, seed + 26);
              if (dirt > 0.7 && tone > 0.42) {
                c = shade(DIRT, (tone - 0.5) * 0.3 + (rnd - 0.5) * 0.12); // bare earth
                if (r2 > 0.97) c = shade(ROCK, (rnd - 0.5) * 0.3);
                else if (r2 < 0.06) c = GRASS[2];
              } else if (dirt > 0.6 && rnd < (dirt - 0.6) * 7) c = mix(c, DRY, 0.55);
              else if (bloom < 0.3 && tone > 0.55 && rnd < 0.55) c = mix(c, CLOVER, 0.6);
              else if (r2 > 0.986) dots.push([lx, ly, shade(GRASS[5], rnd * 0.1)]); // blades
              else if (r2 < 0.035) c = shade(c, -0.26);
              else if (bloom > 0.62 && r2 < 0.035 + (bloom - 0.62) * 0.16) c = FLOWER[Math.floor(hash2(ix >> 3, iy >> 3, seed + 27) * FLOWER.length)];
              else if (r2 > 0.9853) c = shade(ROCK, -0.05);
              else if (r2 < 0.0358) c = FLOWER[Math.floor(rnd * FLOWER.length)];
              if (anyHigh && rnd < 0.4 && hiClose[cj * rw + ci] && (hiAt(wx + 2, wy) || hiAt(wx - 2, wy) || hiAt(wx, wy + 2) || hiAt(wx, wy - 2))) c = shade(mix(c, ROCK_D, 0.55), (r2 - 0.5) * 0.3); // scree
            }
          }
          // rocks fallen from the cliff, piled along its foot
          if (anyHigh && k !== K.Water && hiClose[cj * rw + ci]) {
            let foot = 0;
            const out = rockOut(wx, wy, 0);
            for (const dd of [1, 2.2, 3.5, 5, 6.5])
              if (hiAt(wx - dd - out, wy) || hiAt(wx, wy - dd - out)) {
                foot = dd;
                break;
              }
            if (foot) {
              const [bid, bcr, box, boy] = stone(wx / 3, wy / 3, seed + 50);
              const big = bid > 0.25 + foot * 0.1 && Math.hypot(box, boy) < 0.55 - foot * 0.05;
              if (big && bcr > 0.05) {
                // a boulder: lit on its upper left, dark underneath
                c = mix(ROCK_D, ROCK_L, 0.3 + hash2(Math.floor(bid * 1e4), 0, seed + 51) * 0.45);
                c = shade(c, Math.max(-0.35, Math.min(0.22, -(box + boy) * 0.5)));
                if (bcr < 0.12) c = shade(c, -0.25);
                c = shade(c, (rnd - 0.5) * 0.1);
              } else if (big || (foot < 2.5 && rnd < 0.45)) c = shade(mix(c, ROCK_D, 0.6), -0.25); // crevices and grit
            }
          }
          // shadows cast by plateaus
          if (anyHigh && hiClose[cj * rw + ci])
            for (let t = 1; t <= 9; t++) {
              if (hiAt(wx - t, wy + t * 0.25)) {
                c = shade(c, -0.38);
                break;
              }
            }
        }
        put(lx, ly, c);
      }
    }
    // blades and tufts stand a pixel or two tall, with a dark foot
    for (const [x, y, c] of dots) {
      const i = (y * NP + x) * 4;
      if (d[i + 1] < d[i]) continue; // painted over by something that isn't green
      put(x, y, c);
      put(x, y - 1, shade(c, 0.1));
    }

    // a couple of craters, kept clear of the tile's edges: a dark bowl with
    // a lit far wall, a raised rim and a spray of thrown earth
    for (let n = 0; n < 2; n++) {
      if (hash2(tx, ty, seed + 900 + n) > 0.8) continue;
      const cx = 10 + Math.floor(hash2(tx, ty, seed + 910 + n) * (CH - 20));
      const cy = 8 + Math.floor(hash2(tx, ty, seed + 920 + n) * (CH - 16));
      const rr = 2.5 + hash2(tx, ty, seed + 930 + n) * 3;
      const [cwx, cwy] = toWorld(SX0 + cx, SY0 + cy, 0);
      if (this.k(cwx, cwy) !== K.Grass || this.k(cwx + 4, cwy) !== K.Grass || this.k(cwx, cwy + 4) !== K.Grass || hiAt(cwx + HP, cwy + HP)) continue;
      for (let y = -5 * S; y <= 5 * S; y++)
        for (let x = -9 * S; x <= 9 * S; x++) {
          const X = cx * S + x;
          const Y = cy * S + y;
          if (X < 0 || Y < 0 || X >= NP || Y >= NP) continue;
          const dd = Math.hypot(x / S / 2, y / S) / (rr * 0.6);
          const h = hash2(X, Y, seed + 31);
          let f = 0;
          let earth = 0;
          if (dd < 0.45) (f = -0.5), (earth = 0.5);
          else if (dd < 0.8) (f = y < 0 ? -0.42 : -0.12), (earth = 0.6);
          else if (dd < 1.05) (f = y < 0 ? 0.2 : -0.05), (earth = 0.45);
          else if (dd < 1.7 && h < (1.7 - dd) * 0.5) (f = -0.12), (earth = 0.5);
          else continue;
          const i = (Y * NP + X) * 4;
          for (let ch = 0; ch < 3; ch++) {
            const v = d[i + ch] + (DIRT[ch] * 0.75 - d[i + ch]) * earth;
            d[i + ch] = f >= 0 ? v + (255 - v) * f : v * (1 + f);
          }
        }
    }

    const foam = fimg || f2img ? canvasOf(fimg ?? new ImageData(NP, NP)) : null;
    const foam2 = foam ? canvasOf(f2img ?? new ImageData(NP, NP)) : null;
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
