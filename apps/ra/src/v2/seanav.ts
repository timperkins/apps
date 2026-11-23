// Finding the way across the sea: a coarse grid of the whole map, laid in
// screen space (where the world wraps simply, across and down), of which
// cells are open water. For each kind of ship (by how far it keeps from the
// shore) it knows which cells it can be in and which stretches of water join
// up, so whether a ship can get somewhere at all is a lookup, and its way
// there is an A* search over the grid that never starts when there is no way.

// A screen offset (dx, dy) as a distance in world units (see toScreen: the
// world's axes run diagonally across the screen, squashed down it).
const worldLen = (dx: number, dy: number) => Math.sqrt(2 * dy * dy + (dx * dx) / 2);

// The eight neighbours of a cell: [di, dj].
const NB: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

// A min-heap of cell indices by score.
class Heap {
  k: number[] = [];
  f: number[] = [];
  get size() {
    return this.k.length;
  }
  push(key: number, f: number): void {
    const { k, f: fs } = this;
    let i = k.length;
    k.push(key);
    fs.push(f);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (fs[p] <= f) break;
      k[i] = k[p];
      fs[i] = fs[p];
      i = p;
    }
    k[i] = key;
    fs[i] = f;
  }
  pop(): number {
    const { k, f } = this;
    const top = k[0];
    const lk = k.pop()!;
    const lf = f.pop()!;
    if (k.length) {
      let i = 0;
      const n = k.length;
      for (;;) {
        const l = i * 2 + 1;
        if (l >= n) break;
        const r = l + 1;
        const c = r < n && f[r] < f[l] ? r : l;
        if (f[c] >= lf) break;
        k[i] = k[c];
        f[i] = f[c];
        i = c;
      }
      k[i] = lk;
      f[i] = lf;
    }
    return top;
  }
}

// One kind of ship's view of the grid: where it can be, and which of those
// cells join up (the same number for every cell of one stretch of water).
interface Lane {
  open: Uint8Array;
  comp: Int32Array;
}

export class SeaNav {
  readonly nw: number;
  readonly nh: number;
  readonly cw: number; // a cell's size in screen pixels, across and down
  readonly ch: number;
  // how far each cell's middle is from the nearest dry land, in world units
  private shore: Float32Array;
  private lanes = new Map<number, Lane>();

  /**
   * `wet(i, j)`: whether cell (i, j) of an nw by nh grid over a w by h
   * screen-pixel map is water.
   */
  constructor(nw: number, nh: number, w: number, h: number, wet: (i: number, j: number) => boolean) {
    this.nw = nw;
    this.nh = nh;
    this.cw = w / nw;
    this.ch = h / nh;
    const n = nw * nh;
    const d = (this.shore = new Float32Array(n));
    for (let j = 0; j < nh; j++) for (let i = 0; i < nw; i++) d[j * nw + i] = wet(i, j) ? 1e9 : 0;
    // distance to the shore: two chamfer passes, round the wrap twice so it
    // carries across the edges
    const steps = NB.map(([di, dj]) => [di, dj, worldLen(di * this.cw, dj * this.ch)] as const);
    const fwd = steps.filter(([di, dj]) => dj < 0 || (dj === 0 && di < 0));
    const back = steps.filter(([di, dj]) => dj > 0 || (dj === 0 && di > 0));
    for (let pass = 0; pass < 2; pass++) {
      for (let j = 0; j < nh; j++)
        for (let i = 0; i < nw; i++) {
          const c = j * nw + i;
          let v = d[c];
          if (!v) continue;
          for (const [di, dj, l] of fwd) {
            const o = d[this.idx(i + di, j + dj)] + l;
            if (o < v) v = o;
          }
          d[c] = v;
        }
      for (let j = nh - 1; j >= 0; j--)
        for (let i = nw - 1; i >= 0; i--) {
          const c = j * nw + i;
          let v = d[c];
          if (!v) continue;
          for (const [di, dj, l] of back) {
            const o = d[this.idx(i + di, j + dj)] + l;
            if (o < v) v = o;
          }
          d[c] = v;
        }
    }
  }

  private idx(i: number, j: number): number {
    const { nw, nh } = this;
    i %= nw;
    if (i < 0) i += nw;
    j %= nh;
    if (j < 0) j += nh;
    return j * nw + i;
  }

  // The cell holding screen point (sx, sy) (any copy of the map), as [i, j]
  // unwrapped (so neighbouring points give neighbouring cells).
  private cellOf(sx: number, sy: number): [number, number] {
    return [Math.floor(sx / this.cw), Math.floor(sy / this.ch)];
  }

  // The cells a ship keeping `clear` world units off the shore can be in, and
  // how they join up (worked out once for each distance).
  private lane(clear: number): Lane {
    let l = this.lanes.get(clear);
    if (l) return l;
    const { nw, nh } = this;
    const n = nw * nh;
    const open = new Uint8Array(n);
    // (half a cell's slack: the shore is measured between cell middles)
    const need = Math.max(0.5, clear - Math.min(this.cw, this.ch) * 0.35);
    for (let c = 0; c < n; c++) open[c] = this.shore[c] >= need ? 1 : 0;
    const comp = new Int32Array(n).fill(-1);
    const stack: number[] = [];
    let id = 0;
    for (let c0 = 0; c0 < n; c0++) {
      if (!open[c0] || comp[c0] >= 0) continue;
      comp[c0] = id;
      stack.push(c0);
      while (stack.length) {
        const c = stack.pop()!;
        const i = c % nw;
        const j = (c - i) / nw;
        for (const [di, dj] of NB) {
          const o = this.idx(i + di, j + dj);
          if (!open[o] || comp[o] >= 0) continue;
          // (no slipping diagonally between two dry cells)
          if (di && dj && !open[this.idx(i + di, j)] && !open[this.idx(i, j + dj)]) continue;
          comp[o] = id;
          stack.push(o);
        }
      }
      id++;
    }
    l = { open, comp };
    this.lanes.set(clear, l);
    return l;
  }

  // The nearest cell to (i, j) that the lane is open in, within r cells, or null.
  private nearOpen(l: Lane, i: number, j: number, r = 6): [number, number] | null {
    if (l.open[this.idx(i, j)]) return [i, j];
    for (let k = 1; k <= r; k++)
      for (let dj = -k; dj <= k; dj++)
        for (let di = -k; di <= k; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== k) continue;
          if (l.open[this.idx(i + di, j + dj)]) return [i + di, j + dj];
        }
    return null;
  }

  /** Can a ship keeping `clear` off the shore sail from screen point a to b? */
  joined(clear: number, ax: number, ay: number, bx: number, by: number): boolean {
    const l = this.lane(clear);
    const a = this.nearOpen(l, ...this.cellOf(ax, ay));
    const [bi, bj] = this.cellOf(bx, by);
    if (!a || !l.open[this.idx(bi, bj)]) return false;
    return l.comp[this.idx(a[0], a[1])] === l.comp[this.idx(bi, bj)];
  }

  /**
   * The way from screen point a to b for a ship keeping `clear` off the
   * shore, as screen points to sail to in turn (the last one b itself, on the
   * copy of the map nearest a, as b is given), or null if there is none.
   */
  path(clear: number, ax: number, ay: number, bx: number, by: number): [number, number][] | null {
    const l = this.lane(clear);
    const { nw, nh, cw, ch } = this;
    const s = this.nearOpen(l, ...this.cellOf(ax, ay));
    const [gi, gj] = this.cellOf(bx, by);
    if (!s) return null;
    const sk = this.idx(s[0], s[1]);
    const gk = this.idx(gi, gj);
    if (!l.open[gk] || l.comp[sk] !== l.comp[gk]) return null;
    // search in unwrapped cells round the start, keyed by their wrapped index
    // (the goal is taken on the copy nearest the start)
    const gu = gi - Math.round((gi - s[0]) / nw) * nw;
    const gv = gj - Math.round((gj - s[1]) / nh) * nh;
    const h = (i: number, j: number) => worldLen((i - gu) * cw, (j - gv) * ch) * 1.15;
    const g = new Map<number, number>([[sk, 0]]);
    const from = new Map<number, number>();
    const at = new Map<number, [number, number]>([[sk, [s[0], s[1]]]]);
    const closed = new Set<number>();
    const open = new Heap();
    open.push(sk, h(s[0], s[1]));
    const steps = NB.map(([di, dj]) => [di, dj, worldLen(di * cw, dj * ch)] as const);
    let found = false;
    while (open.size) {
      const c = open.pop();
      if (closed.has(c)) continue;
      closed.add(c);
      if (c === gk) {
        found = true;
        break;
      }
      const [ci, cj] = at.get(c)!;
      const gc = g.get(c)!;
      for (const [di, dj, cost] of steps) {
        const ni = ci + di;
        const nj = cj + dj;
        const nk = this.idx(ni, nj);
        if (!l.open[nk] || closed.has(nk)) continue;
        if (di && dj && (!l.open[this.idx(ci + di, cj)] || !l.open[this.idx(ci, cj + dj)])) continue;
        const ng = gc + cost;
        if (ng < (g.get(nk) ?? Infinity)) {
          g.set(nk, ng);
          from.set(nk, c);
          at.set(nk, [ni, nj]);
          open.push(nk, ng + h(ni, nj));
        }
      }
    }
    if (!found) return null;
    const cells: [number, number][] = [];
    for (let c: number | undefined = gk; c !== undefined && c !== sk; c = from.get(c)) cells.push(at.get(c)!);
    cells.reverse();
    // pull it tight: from each corner, straight on past every cell still in
    // sight over open water
    const mid = (i: number, j: number): [number, number] => [(i + 0.5) * cw, (j + 0.5) * ch];
    const out: [number, number][] = [];
    let [ai, aj] = s;
    for (let k = 0; k < cells.length - 1; k++) {
      const [ni, nj] = cells[k + 1];
      if (this.sight(l, ai, aj, ni, nj)) continue;
      out.push(mid(...cells[k]));
      [ai, aj] = cells[k];
    }
    // the goal itself, where it was asked for (on the copy nearest the start)
    out.push([bx + (gu - gi) * cw, by + (gv - gj) * ch]);
    return out;
  }

  // Is the straight run from cell a to cell b all open?
  private sight(l: Lane, ai: number, aj: number, bi: number, bj: number): boolean {
    const n = Math.max(Math.abs(bi - ai), Math.abs(bj - aj)) * 2;
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      if (!l.open[this.idx(Math.round(ai + (bi - ai) * t), Math.round(aj + (bj - aj) * t))]) return false;
    }
    return true;
  }
}
