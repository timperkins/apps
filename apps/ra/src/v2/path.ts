// Finding a way round cliffs and water: A* over a coarse grid laid on the
// world, then pulled tight so units drive in straight lines between corners.
// The world wraps round, but its coordinates keep counting as you go, so the
// grid here is just as unbounded: `ok` folds points back itself.

export type Ok = (x: number, y: number) => boolean;

// Grid step in world units. Plateaus and lakes are far bigger than this.
export const STEP = 6;
const DEFAULT_STEP = STEP;
// Most grid cells one search looks at before it gives up and heads for the
// closest place it found.
const MAX_NODES = 5000;

/** How finely to search and for how long: ships cross whole oceans, so they
 * search a coarser grid for longer. */
export interface PathOpts {
  step?: number;
  maxNodes?: number;
}

/** A way found: the points to drive to (see findPath), whether it gets all
 * the way to the goal (or only as near as it can), and whether the search
 * looked at everywhere it could get to (so a goal not reached is out of reach
 * for sure, not just too far to look). */
export interface Way {
  path: [number, number][] | null;
  reached: boolean;
  exhausted: boolean;
}

const OFF = 1 << 15;
const key = (i: number, j: number) => (i + OFF) * 65536 + (j + OFF);

// Is the straight line from (ax, ay) to (bx, by) clear all the way?
export function clearLine(ok: Ok, ax: number, ay: number, bx: number, by: number): boolean {
  const d = Math.hypot(bx - ax, by - ay);
  const n = Math.ceil(d);
  for (let k = 1; k <= n; k++) {
    const t = k / n;
    if (!ok(ax + (bx - ax) * t, ay + (by - ay) * t)) return false;
  }
  return true;
}

// A min-heap of node keys by score.
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

const DIRS: [number, number, number][] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

/**
 * The way from (sx, sy) to (gx, gy) as a list of points to drive to in turn,
 * the last one the goal (or, when the goal can't be reached, the nearest
 * place to it that can). Empty when the straight line is clear; null when
 * there is nowhere better to go than where it is. `cache` keeps which grid
 * cells are open from one search to the next (for the same kind of unit).
 */
export function findPath(ok: Ok, sx: number, sy: number, gx: number, gy: number, cache = new Map<number, boolean>(), opts: PathOpts = {}): [number, number][] | null {
  return findWay(ok, sx, sy, gx, gy, cache, opts).path;
}

/** findPath, saying too whether the goal can be reached. */
export function findWay(ok: Ok, sx: number, sy: number, gx: number, gy: number, cache = new Map<number, boolean>(), opts: PathOpts = {}): Way {
  const STEP = opts.step ?? DEFAULT_STEP;
  const maxNodes = opts.maxNodes ?? MAX_NODES;
  if (ok(gx, gy) && clearLine(ok, sx, sy, gx, gy)) return { path: [], reached: true, exhausted: false };
  const si = Math.round(sx / STEP);
  const sj = Math.round(sy / STEP);
  let gi = Math.round(gx / STEP);
  let gj = Math.round(gy / STEP);
  if (cache.size > 400000) cache.clear();
  const cellOk = (i: number, j: number) => {
    const k = key(i, j);
    let v = cache.get(k);
    if (v === undefined) cache.set(k, (v = ok(i * STEP, j * STEP)));
    return v;
  };
  // a goal on a cliff or in the water: aim for the nearest open cell to it
  const goalOk = ok(gx, gy);
  let exact = goalOk;
  if (!cellOk(gi, gj)) {
    exact = false;
    // (when the goal itself is open, just its cell's middle isn't, as beside
    // a wall: the nearest open cell it can be seen from, so the way ends on
    // its side of the wall)
    const look = (see: boolean) => {
      for (let r = 1; r <= 12; r++)
        for (let dj = -r; dj <= r; dj++)
          for (let di = -r; di <= r; di++) {
            if (Math.max(Math.abs(di), Math.abs(dj)) !== r || !cellOk(gi + di, gj + dj)) continue;
            if (see && !clearLine(ok, (gi + di) * STEP, (gj + dj) * STEP, gx, gy)) continue;
            return [gi + di, gj + dj];
          }
      return null;
    };
    const c = (goalOk && look(true)) || look(false);
    if (c) [gi, gj] = c;
  }
  const sk = key(si, sj);
  const gk = key(gi, gj);
  const g = new Map<number, number>([[sk, 0]]);
  const from = new Map<number, number>();
  const closed = new Set<number>();
  const open = new Heap();
  const h = (i: number, j: number) => {
    const dx = Math.abs(i - gi);
    const dy = Math.abs(j - gj);
    // (a little over the true distance: a way found much sooner, and
    // hardly any longer)
    return (Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy)) * 1.2;
  };
  open.push(sk, h(si, sj));
  let best = sk;
  let bestH = h(si, sj);
  let end = -1;
  let n = 0;
  const isOpen = (i: number, j: number) => (i === si && j === sj) || cellOk(i, j);
  while (open.size && n < maxNodes) {
    const c = open.pop();
    if (closed.has(c)) continue;
    closed.add(c);
    n++;
    if (c === gk) {
      end = c;
      break;
    }
    const ci = Math.floor(c / 65536) - OFF;
    const cj = (c % 65536) - OFF;
    const hc = h(ci, cj);
    if (hc < bestH) {
      bestH = hc;
      best = c;
    }
    const gc = g.get(c)!;
    for (const [di, dj, cost] of DIRS) {
      const ni = ci + di;
      const nj = cj + dj;
      if (!isOpen(ni, nj)) continue;
      // no cutting a corner past a blocked cell
      if (di && dj && (!isOpen(ci + di, cj) || !isOpen(ci, cj + dj))) continue;
      const nk = key(ni, nj);
      if (closed.has(nk)) continue;
      const ng = gc + cost;
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng);
        from.set(nk, c);
        open.push(nk, ng + h(ni, nj));
      }
    }
  }
  const exhausted = end < 0 && !open.size;
  if (end < 0) {
    end = best;
    exact = false;
  }
  if (end === sk) return { path: null, reached: false, exhausted };
  const cells: [number, number][] = [];
  for (let c: number | undefined = end; c !== undefined && c !== sk; c = from.get(c)) cells.push([(Math.floor(c / 65536) - OFF) * STEP, ((c % 65536) - OFF) * STEP]);
  cells.reverse();
  if (exact) cells[cells.length - 1] = [gx, gy];
  else if (end === gk && goalOk && clearLine(ok, cells[cells.length - 1][0], cells[cells.length - 1][1], gx, gy)) {
    cells.push([gx, gy]); // the goal is open, its cell's middle isn't
    exact = true;
  }
  // pull it tight: from each corner, go straight on past every point still in sight
  const out: [number, number][] = [];
  let ax = sx;
  let ay = sy;
  for (let i = 0; i < cells.length; i++) {
    const next = cells[i + 1];
    if (next && clearLine(ok, ax, ay, next[0], next[1])) continue;
    out.push(cells[i]);
    [ax, ay] = cells[i];
  }
  return { path: out, reached: exact, exhausted };
}
