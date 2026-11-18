// The shroud: black over the parts of the map you haven't seen yet. Your
// units and buildings lift it round themselves for good as they go.
//
// It works in screen space (the iso map's own rectangle, which wraps round
// both ways), so a unit's sight is a 2:1 ellipse there, the shape of a circle
// on the ground. How much of each CELL-pixel cell has been seen is kept as
// 0..255 (255 well inside someone's sight, falling off at the edge of it).
// The edge is drawn by interpolating that into a soft fade to black (its
// opacity eased so it blurs out smoothly), tile by tile: a tile all seen is skipped, one all unseen is a black
// square, and only tiles on the edge get a little canvas of their own.
//
// Open sea is never drawn shrouded: the black covers the land, and the water
// only near its coasts, thinning out a little way from shore. That is only
// how it's drawn; what you have seen (an enemy boat out at sea, say) still
// goes by where your units have been.
import { CH } from '../tiles';

const S = 8; // cell size, in map pixels
const P = 2; // the edge's pixels, in map pixels (smoothed when drawn)
const N = CH / P; // pixels across a tile
const FADE = 0.4; // how much of a sight's radius the edge fades over
// Over the sea the shroud reaches SEA_IN map pixels (on the ground) out from
// the shore, and has faded away by SEA_OUT.
const SEA_IN = 24;
const SEA_OUT = 96;
// Water smaller than this many cells (a pond or a small lake) is shrouded
// like the land round it.
const SEA_MIN = 3000;

const BLACK = 0;
const EDGE = 1;
const CLEAR = 2;

export class Shroud {
  readonly gw: number;
  readonly gh: number;
  private g: Uint8Array; // seen
  private v: Uint8Array; // as drawn: seen, or open sea
  private nx: number;
  private ny: number;
  private state: Uint8Array;
  private dirty: Uint8Array;
  private canvases = new Map<number, HTMLCanvasElement>();
  private img: ImageData | null = null;
  // goes up whenever more of the map is seen
  version = 0;
  // the screen rect seen since changed() was last asked (unwrapped)
  private box: [number, number, number, number] | null = null;

  // water(sx, sy): is screen point (sx, sy) water?
  constructor(
    readonly w: number,
    readonly h: number,
    water?: (sx: number, sy: number) => boolean,
  ) {
    this.gw = Math.ceil(w / S);
    this.gh = Math.ceil(h / S);
    this.g = new Uint8Array(this.gw * this.gh);
    this.v = new Uint8Array(this.gw * this.gh);
    this.nx = Math.ceil(w / CH);
    this.ny = Math.ceil(h / CH);
    this.state = new Uint8Array(this.nx * this.ny);
    this.dirty = new Uint8Array(this.nx * this.ny);
    if (water) {
      this.v.set(seaFloor(this.gw, this.gh, water));
      this.dirty.fill(1);
    }
  }

  // Lift the shroud round screen point (sx, sy), out to r map pixels on the
  // ground (an ellipse r√2 across and r/√2 down on screen).
  reveal(sx: number, sy: number, r: number): void {
    const a = r * Math.SQRT2;
    const b = r / Math.SQRT2;
    const { gw, gh, g, v: shown } = this;
    const i0 = Math.floor((sx - a) / S);
    const i1 = Math.floor((sx + a) / S);
    const j0 = Math.floor((sy - b) / S);
    const j1 = Math.floor((sy + b) / S);
    let grew = false;
    for (let j = j0; j <= j1; j++) {
      const dy = ((j + 0.5) * S - sy) / b;
      const row = (((j % gh) + gh) % gh) * gw;
      for (let i = i0; i <= i1; i++) {
        const dx = ((i + 0.5) * S - sx) / a;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d >= 1) continue;
        const v = Math.min(255, Math.round(((1 - d) / FADE) * 255));
        const k = row + (((i % gw) + gw) % gw);
        if (v > g[k]) {
          g[k] = v;
          if (v > shown[k]) shown[k] = v;
          grew = true;
        }
      }
    }
    if (!grew) return;
    this.version++;
    const m = 2 * S;
    const bx: [number, number, number, number] = [i0 * S - m, j0 * S - m, (i1 + 1) * S + m, (j1 + 1) * S + m];
    const o = this.box;
    this.box = o ? [Math.min(o[0], bx[0]), Math.min(o[1], bx[1]), Math.max(o[2], bx[2]), Math.max(o[3], bx[3])] : bx;
    // the tiles these cells reach (a cell's value blends into its neighbours)
    const t0 = Math.floor(((i0 - 1) * S) / CH);
    const t1 = Math.floor(((i1 + 2) * S) / CH);
    const u0 = Math.floor(((j0 - 1) * S) / CH);
    const u1 = Math.floor(((j1 + 2) * S) / CH);
    for (let ty = u0; ty <= u1; ty++)
      for (let tx = t0; tx <= t1; tx++) this.dirty[this.tile(tx, ty)] = 1;
  }

  private tile(tx: number, ty: number): number {
    const { nx, ny } = this;
    return (((ty % ny) + ny) % ny) * nx + (((tx % nx) + nx) % nx);
  }

  // a cell's value: as drawn, or (seen) what has really been seen
  private cell(i: number, j: number, seen = false): number {
    const { gw, gh } = this;
    return (seen ? this.g : this.v)[(((j % gh) + gh) % gh) * gw + (((i % gw) + gw) % gw)];
  }

  // How much of screen point (x, y) is drawn clear (or with `seen`, has been
  // seen), 0..255.
  at(x: number, y: number, seen = false): number {
    const fx = x / S - 0.5;
    const fy = y / S - 0.5;
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    const tx = fx - i;
    const ty = fy - j;
    const c00 = this.cell(i, j, seen);
    const c10 = this.cell(i + 1, j, seen);
    const c01 = this.cell(i, j + 1, seen);
    const c11 = this.cell(i + 1, j + 1, seen);
    const a = c00 + (c10 - c00) * tx;
    const b = c01 + (c11 - c01) * tx;
    return a + (b - a) * ty;
  }

  // Has screen point (x, y) been seen (past the middle of the faded edge)?
  seen(x: number, y: number): boolean {
    return this.at(x, y, true) >= 128;
  }

  /** The screen rect where more has been seen since last asked, if any. */
  changed(): [number, number, number, number] | null {
    const b = this.box;
    this.box = null;
    // (one that has gone a long way round: all of it)
    if (b && (b[2] - b[0] > this.w || b[3] - b[1] > this.h)) return [0, 0, this.w, this.h];
    return b;
  }

  /** How dark the shroud is drawn at screen point (x, y): 0 seen, 1 unseen. */
  dark(x: number, y: number): number {
    const v = this.at(x, y) / 255;
    return 1 - v * v * (3 - 2 * v);
  }

  /** Over screen rect (x0, y0)-(x1, y1): 0 if all of it is seen, 1 if none of it, else -1. */
  span(x0: number, y0: number, x1: number, y1: number): number {
    let lo = 255;
    let hi = 0;
    for (let j = Math.floor(y0 / S) - 1; j <= Math.ceil(y1 / S); j++)
      for (let i = Math.floor(x0 / S) - 1; i <= Math.ceil(x1 / S); i++) {
        const v = this.cell(i, j);
        if (v < lo) lo = v;
        if (v > hi) hi = v;
        if (lo < 255 && hi > 0) return -1;
      }
    return hi === 0 ? 1 : 0;
  }

  // Bring a tile's picture up to date.
  private refresh(k: number): void {
    this.dirty[k] = 0;
    const tx = k % this.nx;
    const ty = Math.floor(k / this.nx);
    // all the cells that reach into it: all seen, or none of them
    const c = CH / S;
    let lo = 255;
    let hi = 0;
    for (let j = ty * c - 1; j <= (ty + 1) * c; j++)
      for (let i = tx * c - 1; i <= (tx + 1) * c; i++) {
        const v = this.cell(i, j);
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    if (hi === 0 || lo === 255) {
      this.state[k] = hi === 0 ? BLACK : CLEAR;
      this.canvases.delete(k);
      return;
    }
    const img = (this.img ??= new ImageData(N, N));
    const d = img.data;
    let black = 0;
    let clear = 0;
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const v = this.at(tx * CH + x * P + P / 2, ty * CH + y * P + P / 2) / 255;
        // smoothstep, so the fade has no hard start or end
        const a = Math.round(255 * (1 - v * v * (3 - 2 * v)));
        const o = (y * N + x) * 4;
        d[o] = d[o + 1] = d[o + 2] = 0;
        d[o + 3] = a;
        if (a === 255) black++;
        else if (a === 0) clear++;
      }
    if (black === N * N || clear === N * N) {
      this.state[k] = black ? BLACK : CLEAR;
      this.canvases.delete(k);
      return;
    }
    this.state[k] = EDGE;
    let cv = this.canvases.get(k);
    if (!cv) {
      cv = document.createElement('canvas');
      cv.width = cv.height = N;
      this.canvases.set(k, cv);
    }
    cv.getContext('2d')!.putImageData(img, 0, 0);
  }

  // Draw it over screen rect (x0, y0)-(x1, y1), in unwrapped map pixels.
  draw(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
    const tx0 = Math.floor(x0 / CH);
    const tx1 = Math.floor((x1 - 1) / CH);
    const ty0 = Math.floor(y0 / CH);
    const ty1 = Math.floor((y1 - 1) / CH);
    c.fillStyle = '#000';
    c.beginPath();
    const edges: [HTMLCanvasElement, number, number][] = [];
    for (let ty = ty0; ty <= ty1; ty++) {
      // runs of black tiles go in as one rectangle
      let run = -1;
      for (let tx = tx0; tx <= tx1 + 1; tx++) {
        let st = CLEAR;
        if (tx <= tx1) {
          const k = this.tile(tx, ty);
          if (this.dirty[k]) this.refresh(k);
          st = this.state[k];
          if (st === EDGE) edges.push([this.canvases.get(k)!, tx * CH, ty * CH]);
        }
        if (st === BLACK) {
          if (run < 0) run = tx;
        } else if (run >= 0) {
          c.rect(run * CH, ty * CH, (tx - run) * CH, CH);
          run = -1;
        }
      }
    }
    c.fill();
    // the edge tiles smoothed as they are scaled up, for a soft blur
    const smooth = c.imageSmoothingEnabled;
    c.imageSmoothingEnabled = true;
    for (const [cv, x, y] of edges) c.drawImage(cv, x, y, CH, CH);
    c.imageSmoothingEnabled = smooth;
  }
}

// How clear the shroud is drawn over each cell before anything is seen
// (0..255): clear over open sea, from a little way out from its shores.
function seaFloor(gw: number, gh: number, water: (sx: number, sy: number) => boolean): Uint8Array {
  const n = gw * gh;
  const wet = new Uint8Array(n);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) wet[j * gw + i] = water((i + 0.5) * S, (j + 0.5) * S) ? 1 : 0;
  // only water in big bodies counts as sea (flood fill, wrapping round)
  const sea = new Uint8Array(n);
  const comp: number[] = [];
  const stack: number[] = [];
  const done = new Uint8Array(n);
  for (let q0 = 0; q0 < n; q0++) {
    if (!wet[q0] || done[q0]) continue;
    comp.length = 0;
    stack.push(q0);
    done[q0] = 1;
    while (stack.length) {
      const q = stack.pop()!;
      comp.push(q);
      const i = q % gw;
      const j = (q - i) / gw;
      const nb = [j * gw + ((i + 1) % gw), j * gw + ((i + gw - 1) % gw), ((j + 1) % gh) * gw + i, ((j + gh - 1) % gh) * gw + i];
      for (const k of nb)
        if (wet[k] && !done[k]) {
          done[k] = 1;
          stack.push(k);
        }
    }
    if (comp.length >= SEA_MIN) for (const q of comp) sea[q] = 1;
  }
  // distance on the ground (screen y counts double) from the nearest cell
  // that isn't sea, as far as SEA_OUT: a chamfer pass each way, twice round
  // so it carries over the map's edges
  const BIG = 1e9;
  const d = new Float32Array(n);
  for (let q = 0; q < n; q++) d[q] = sea[q] ? BIG : 0;
  const ax = S;
  const ay = 2 * S;
  const dg = Math.hypot(ax, ay);
  const at = (i: number, j: number) => (((j % gh) + gh) % gh) * gw + (((i % gw) + gw) % gw);
  for (let rep = 0; rep < 2; rep++) {
    for (let j = 0; j < gh; j++)
      for (let i = 0; i < gw; i++) {
        const q = j * gw + i;
        if (!d[q]) continue;
        d[q] = Math.min(d[q], d[at(i - 1, j)] + ax, d[at(i, j - 1)] + ay, d[at(i - 1, j - 1)] + dg, d[at(i + 1, j - 1)] + dg);
      }
    for (let j = gh - 1; j >= 0; j--)
      for (let i = gw - 1; i >= 0; i--) {
        const q = j * gw + i;
        if (!d[q]) continue;
        d[q] = Math.min(d[q], d[at(i + 1, j)] + ax, d[at(i, j + 1)] + ay, d[at(i + 1, j + 1)] + dg, d[at(i - 1, j + 1)] + dg);
      }
  }
  const out = new Uint8Array(n);
  for (let q = 0; q < n; q++) out[q] = Math.round(Math.max(0, Math.min(1, (d[q] - SEA_IN) / (SEA_OUT - SEA_IN))) * 255);
  return out;
}
