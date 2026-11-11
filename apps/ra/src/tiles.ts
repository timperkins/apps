// The planet is far too big to paint into one canvas, so the ground is painted
// in square tiles as they come into view, a few each frame, and the least
// recently seen ones are dropped once there are too many. Tiles not painted yet
// are filled in from a coarse overview of the whole map in the meantime.
export const CH = 128; // tile size in map pixels; map sizes are multiples of it

export interface Tile<P> {
  canvas: HTMLCanvasElement;
  foam: HTMLCanvasElement | null; // shoreline foam layers, only on tiles with water
  foam2: HTMLCanvasElement | null;
  props: P[];
  used: number;
}

export class Tiles<P> {
  readonly nx: number;
  readonly ny: number;
  private map = new Map<number, Tile<P>>();
  private want: number[] = [];
  private wanted = new Set<number>();
  private frame = 0;

  constructor(
    w: number,
    h: number,
    // Builds a tile, either in one go or as steps that end with the tile, to
    // be spread over several frames.
    private build: (tx: number, ty: number) => Tile<P> | Generator<void, Tile<P>>,
    private max = 360,
  ) {
    this.nx = Math.round(w / CH);
    this.ny = Math.round(h / CH);
  }

  private key(tx: number, ty: number): number {
    const { nx, ny } = this;
    tx = ((tx % nx) + nx) % nx;
    ty = ((ty % ny) + ny) % ny;
    return ty * nx + tx;
  }

  // Start a new frame: forget last frame's requests.
  begin(): void {
    this.frame++;
    this.want = [];
    this.wanted.clear();
  }

  // The tile at tile coordinates (tx, ty), wrapping round, if painted. If not,
  // it is queued for painting.
  get(tx: number, ty: number): Tile<P> | undefined {
    const k = this.key(tx, ty);
    const t = this.map.get(k);
    if (t) {
      t.used = this.frame;
      return t;
    }
    if (!this.wanted.has(k)) {
      this.wanted.add(k);
      this.want.push(k);
    }
    return undefined;
  }

  // Painted tile under map point (x, y), without queueing it.
  at(x: number, y: number): Tile<P> | undefined {
    return this.map.get(this.key(Math.floor(x / CH), Math.floor(y / CH)));
  }

  // Repaint the tiles over map rect (x0, y0)-(x1, y1), when something on the
  // ground there changed. Tiles in view are repainted while the old picture
  // stays up; the others are just dropped and repainted when next seen.
  redo(x0: number, y0: number, x1: number, y1: number): void {
    for (let ty = Math.floor(y0 / CH); ty <= Math.floor(y1 / CH); ty++)
      for (let tx = Math.floor(x0 / CH); tx <= Math.floor(x1 / CH); tx++) {
        const k = this.key(tx, ty);
        if (this.job?.k === k) this.job = null; // half painted from what was there before
        if (this.map.has(k)) this.stale.add(k);
      }
  }
  private stale = new Set<number>();

  // The tile being painted, if it is taking more than one frame.
  private job: { k: number; steps: Generator<void, Tile<P>> } | null = null;

  // Paint queued tiles for up to `ms` milliseconds (always at least a step).
  pump(ms: number): void {
    const t0 = performance.now();
    for (;;) {
      if (!this.job) {
        let k = -1;
        for (const s of this.stale) {
          this.stale.delete(s);
          const old = this.map.get(s);
          if (!old) continue;
          if (old.used !== this.frame) {
            this.map.delete(s);
            continue;
          }
          k = s;
          break;
        }
        while (k < 0 && this.want.length) {
          const w = this.want.shift()!;
          if (!this.map.has(w)) k = w;
        }
        if (k < 0) break;
        const r = this.build(k % this.nx, Math.floor(k / this.nx));
        if ('canvas' in r) {
          r.used = this.frame;
          this.map.set(k, r);
        } else this.job = { k, steps: r };
      }
      while (this.job) {
        const r = this.job.steps.next();
        if (r.done) {
          r.value.used = this.frame;
          this.map.set(this.job.k, r.value);
          this.job = null;
        }
        if (performance.now() - t0 > ms) break;
      }
      if (performance.now() - t0 > ms) break;
    }
    if (this.map.size > this.max) {
      const old = [...this.map].sort((a, b) => a[1].used - b[1].used);
      for (let i = 0; i < old.length - this.max; i++) this.map.delete(old[i][0]);
    }
  }

  get pending(): number {
    return this.want.length;
  }
}

// Draw the ground for map rect (x0, y0)-(x1, y1), in unwrapped map pixels, onto
// a context already translated to map space: painted tiles where there are
// some, the overview (one pixel per `ov` map pixels) elsewhere.
export function drawTiles<P>(
  c: CanvasRenderingContext2D,
  tiles: Tiles<P>,
  overview: HTMLCanvasElement | null,
  ov: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  time: number,
): void {
  c.imageSmoothingEnabled = false;
  const tx0 = Math.floor(x0 / CH);
  const ty0 = Math.floor(y0 / CH);
  const tx1 = Math.floor((x1 - 1) / CH);
  const ty1 = Math.floor((y1 - 1) / CH);
  const s = CH / ov;
  const foamA = 0.45 + 0.35 * Math.sin(time * 1.6);
  const foamB = 0.35 + 0.3 * Math.sin(time * 1.6 + 2.2);
  for (let ty = ty0; ty <= ty1; ty++)
    for (let tx = tx0; tx <= tx1; tx++) {
      const t = tiles.get(tx, ty);
      const x = tx * CH;
      const y = ty * CH;
      if (!t && !overview) {
        c.fillStyle = '#2f4c23';
        c.fillRect(x, y, CH, CH);
        continue;
      }
      if (!t) {
        const u = (((tx % tiles.nx) + tiles.nx) % tiles.nx) * s;
        const v = (((ty % tiles.ny) + tiles.ny) % tiles.ny) * s;
        c.drawImage(overview!, u, v, s, s, x, y, CH, CH);
        continue;
      }
      c.drawImage(t.canvas, x, y, CH, CH);
      if (t.foam) {
        c.globalAlpha = foamA;
        c.drawImage(t.foam, x, y, CH, CH);
        c.globalAlpha = foamB;
        c.drawImage(t.foam2!, x, y, CH, CH);
        c.globalAlpha = 1;
      }
    }
}

export function canvasOf(img: ImageData): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  c.getContext('2d')!.putImageData(img, 0, 0);
  return c;
}

// Road segments, bucketed on a coarse grid so a point only measures the few it
// could be near. Segments are added with every copy needed to cover the
// bucketed area.
export class Roads {
  private cells: Map<number, number[]> = new Map();
  private segs: number[] = []; // ax, ay, bx, by, 1 / half-width
  private static C = 128;

  constructor(
    private bx0: number,
    private by0: number,
    private bw: number,
    private bh: number,
  ) {}

  add(ax: number, ay: number, bx: number, by: number, half: number, reach: number): void {
    const x0 = Math.min(ax, bx) - reach;
    const x1 = Math.max(ax, bx) + reach;
    const y0 = Math.min(ay, by) - reach;
    const y1 = Math.max(ay, by) + reach;
    if (x1 < this.bx0 || y1 < this.by0 || x0 > this.bx0 + this.bw || y0 > this.by0 + this.bh) return;
    const id = this.segs.length;
    this.segs.push(ax, ay, bx, by, 1 / half);
    const C = Roads.C;
    const cx0 = Math.max(0, Math.floor((x0 - this.bx0) / C));
    const cy0 = Math.max(0, Math.floor((y0 - this.by0) / C));
    const cx1 = Math.min(Math.ceil(this.bw / C), Math.floor((x1 - this.bx0) / C));
    const cy1 = Math.min(Math.ceil(this.bh / C), Math.floor((y1 - this.by0) / C));
    for (let cy = cy0; cy <= cy1; cy++)
      for (let cx = cx0; cx <= cx1; cx++) {
        const k = cy * 100000 + cx;
        let l = this.cells.get(k);
        if (!l) this.cells.set(k, (l = []));
        l.push(id);
      }
  }

  // Distance to the nearest road in road half-widths (99 when far away).
  dist(x: number, y: number): number {
    const C = Roads.C;
    const l = this.cells.get(Math.floor((y - this.by0) / C) * 100000 + Math.floor((x - this.bx0) / C));
    if (!l) return 99;
    const s = this.segs;
    let d = 99;
    for (const i of l) {
      const ax = s[i];
      const ay = s[i + 1];
      const dx = s[i + 2] - ax;
      const dy = s[i + 3] - ay;
      const L = dx * dx + dy * dy;
      let t = L > 0 ? ((x - ax) * dx + (y - ay) * dy) / L : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const e = Math.hypot(x - (ax + dx * t), y - (ay + dy * t)) * s[i + 4];
      if (e < d) d = e;
    }
    return d;
  }
}

// A winding road from a to b: the straight line pushed sideways by a few
// random amounts, so the roads between bases meander.
export function windingRoad(ax: number, ay: number, bx: number, by: number, rand: () => number): [number, number][] {
  const n = 5;
  const dx = bx - ax;
  const dy = by - ay;
  const L = Math.hypot(dx, dy);
  const px = -dy / (L || 1);
  const py = dx / (L || 1);
  const pts: [number, number][] = [[ax, ay]];
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const off = (rand() - 0.5) * L * 0.25 * Math.sin(Math.PI * t) * 2;
    pts.push([ax + dx * t + px * off, ay + dy * t + py * off]);
  }
  pts.push([bx, by]);
  return pts;
}
