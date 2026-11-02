// A* over the cell grid, 8 directions without cutting corners. Returns world points
// (cell centres), with straight runs collapsed, ending exactly at the target point.
import { isBlocked, type Grid } from './layout';

export interface Point {
  x: number;
  z: number;
}

export function findPath(g: Grid, from: Point, to: Point): Point[] | null {
  const sx = Math.floor(from.x) - g.x0, sz = Math.floor(from.z) - g.z0;
  const tx = Math.floor(to.x) - g.x0, tz = Math.floor(to.z) - g.z0;
  const inside = (x: number, z: number) => x >= 0 && z >= 0 && x < g.w && z < g.h;
  if (!inside(tx, tz) || g.blocked[tz * g.w + tx]) return null;
  if (!inside(sx, sz)) return null;
  if (sx === tx && sz === tz) return [{ ...to }];

  const n = g.w * g.h;
  const gScore = new Float32Array(n).fill(Infinity);
  const came = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const heap = new MinHeap();
  const start = sz * g.w + sx, goal = tz * g.w + tx;
  gScore[start] = 0;
  heap.push(start, h(sx, sz));

  function h(x: number, z: number) {
    const dx = Math.abs(x - tx), dz = Math.abs(z - tz);
    return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
  }
  const free = (x: number, z: number) => inside(x, z) && !g.blocked[z * g.w + x];

  while (heap.size) {
    const cur = heap.pop();
    if (cur === goal) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cx = cur % g.w, cz = (cur - cx) / g.w;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = cx + dx, nz = cz + dz;
        // the start cell may be blocked (e.g. standing in a doorway edge); allow leaving it
        if (!free(nx, nz)) continue;
        if (dx && dz && (!free(cx + dx, cz) || !free(cx, cz + dz))) continue;
        const ni = nz * g.w + nx;
        const cost = gScore[cur] + (dx && dz ? Math.SQRT2 : 1);
        if (cost < gScore[ni]) {
          gScore[ni] = cost;
          came[ni] = cur;
          heap.push(ni, cost + h(nx, nz));
        }
      }
    }
  }
  if (came[goal] === -1) return null;

  const cells: number[] = [];
  for (let c = goal; c !== start; c = came[c]) cells.push(c);
  cells.reverse();
  const pts: Point[] = [];
  let prevDir = '';
  let prev = start;
  for (let k = 0; k < cells.length; k++) {
    const c = cells[k];
    const dir = `${(c % g.w) - (prev % g.w)},${Math.floor(c / g.w) - Math.floor(prev / g.w)}`;
    if (dir === prevDir && pts.length) pts.pop();
    pts.push({ x: (c % g.w) + g.x0 + 0.5, z: Math.floor(c / g.w) + g.z0 + 0.5 });
    prevDir = dir;
    prev = c;
  }
  pts[pts.length - 1] = { ...to };
  return pts;
}

export function cellFree(g: Grid, p: Point) {
  return !isBlocked(g, p.x, p.z);
}

class MinHeap {
  private ids: number[] = [];
  private keys: number[] = [];
  get size() {
    return this.ids.length;
  }
  push(id: number, key: number) {
    this.ids.push(id);
    this.keys.push(key);
    let i = this.ids.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[p] <= this.keys[i]) break;
      this.swap(i, p);
      i = p;
    }
  }
  pop(): number {
    const top = this.ids[0];
    const lastId = this.ids.pop()!, lastKey = this.keys.pop()!;
    if (this.ids.length) {
      this.ids[0] = lastId;
      this.keys[0] = lastKey;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < this.ids.length && this.keys[l] < this.keys[m]) m = l;
        if (r < this.ids.length && this.keys[r] < this.keys[m]) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }
  private swap(a: number, b: number) {
    [this.ids[a], this.ids[b]] = [this.ids[b], this.ids[a]];
    [this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]];
  }
}
