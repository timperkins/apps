// The shroud: black over the parts of the map you haven't seen yet. Your
// units and buildings lift it round themselves for good as they go.
//
// It works in screen space (the iso map's own rectangle, which wraps round
// both ways), so a unit's sight is a 2:1 ellipse there, the shape of a circle
// on the ground. How much of each CELL-pixel cell has been seen is kept as
// 0..255 (255 well inside someone's sight, falling off at the edge of it).
// The edge is drawn by interpolating that and dithering it in 2-pixel dots,
// tile by tile: a tile all seen is skipped, one all unseen is a black
// square, and only tiles on the edge get a little canvas of their own.
import { CH } from '../tiles';

const S = 8; // cell size, in map pixels
const P = 2; // the dots of the dithered edge, in map pixels
const N = CH / P; // dots across a tile
const FADE = 0.2; // how much of a sight's radius the edge fades over
// a 4 x 4 Bayer matrix: thresholds for the dithered edge
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((b) => ((b + 0.5) / 16) * 255);

const BLACK = 0;
const EDGE = 1;
const CLEAR = 2;

export class Shroud {
  readonly gw: number;
  readonly gh: number;
  private g: Uint8Array;
  private nx: number;
  private ny: number;
  private state: Uint8Array;
  private dirty: Uint8Array;
  private canvases = new Map<number, HTMLCanvasElement>();
  private img: ImageData | null = null;
  // goes up whenever more of the map is seen
  version = 0;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.gw = Math.ceil(w / S);
    this.gh = Math.ceil(h / S);
    this.g = new Uint8Array(this.gw * this.gh);
    this.nx = Math.ceil(w / CH);
    this.ny = Math.ceil(h / CH);
    this.state = new Uint8Array(this.nx * this.ny);
    this.dirty = new Uint8Array(this.nx * this.ny);
  }

  // Lift the shroud round screen point (sx, sy), out to r map pixels on the
  // ground (an ellipse r√2 across and r/√2 down on screen).
  reveal(sx: number, sy: number, r: number): void {
    const a = r * Math.SQRT2;
    const b = r / Math.SQRT2;
    const { gw, gh, g } = this;
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
          grew = true;
        }
      }
    }
    if (!grew) return;
    this.version++;
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

  private cell(i: number, j: number): number {
    const { gw, gh } = this;
    return this.g[(((j % gh) + gh) % gh) * gw + (((i % gw) + gw) % gw)];
  }

  // How much of screen point (x, y) has been seen, 0..255.
  at(x: number, y: number): number {
    const fx = x / S - 0.5;
    const fy = y / S - 0.5;
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    const tx = fx - i;
    const ty = fy - j;
    const a = this.cell(i, j) + (this.cell(i + 1, j) - this.cell(i, j)) * tx;
    const b = this.cell(i, j + 1) + (this.cell(i + 1, j + 1) - this.cell(i, j + 1)) * tx;
    return a + (b - a) * ty;
  }

  // Has screen point (x, y) been seen (past the middle of the dithered edge)?
  seen(x: number, y: number): boolean {
    return this.at(x, y) >= 128;
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
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const v = this.at(tx * CH + x * P + P / 2, ty * CH + y * P + P / 2);
        const o = (y * N + x) * 4;
        const on = v < BAYER[(x & 3) + (y & 3) * 4];
        d[o] = d[o + 1] = d[o + 2] = 0;
        d[o + 3] = on ? 255 : 0;
        if (on) black++;
      }
    if (black === 0 || black === N * N) {
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
    for (const [cv, x, y] of edges) c.drawImage(cv, x, y, CH, CH);
  }
}
