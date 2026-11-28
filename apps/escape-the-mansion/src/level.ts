// Builds one level: a braided maze with rooms, then places guards, dogs, lasers,
// cameras, spike traps, items and lights. Pure and deterministic per level number.
import { Rng, weighted } from './rng';
import { TILE, themeFor } from './themes';
import type { ItemKind } from './sprites';

export interface Pt {
  x: number;
  y: number;
}

export interface GuardSpec {
  route: Pt[]; // px waypoints, walked back and forth; one point = sentry
  variant: number;
}
export interface DogSpec {
  home: Pt; // px
  cells: Pt[]; // px centres of cells it wanders between
}
export interface LaserSpec {
  a: Pt; // px endpoints
  b: Pt;
  period: number;
  offset: number;
  duty: number;
}
export interface CameraSpec {
  x: number; // px of the lens
  y: number;
  base: number; // angle it faces
  sweep: number;
  speed: number;
}
export interface SpikeSpec {
  tx: number;
  ty: number;
  period: number;
  offset: number;
}
export interface ItemSpec {
  x: number;
  y: number;
  kind: ItemKind;
}

export interface LevelData {
  level: number;
  seed: number;
  w: number;
  h: number;
  grid: Uint8Array; // 1 = wall
  start: Pt; // px
  exit: Pt; // px centre of the exit cell
  exitTile: Pt; // top-left tile of the 2x2 exit
  guards: GuardSpec[];
  dogs: DogSpec[];
  lasers: LaserSpec[];
  cameras: CameraSpec[];
  spikes: SpikeSpec[];
  items: ItemSpec[];
  lights: Pt[]; // wall-face tiles with a torch/candle
  decor: Pt[]; // floor tiles with scatter
  cameo: Pt | null; // px where Jeff shows up mid-level
  pathCells: number; // length of the start-to-exit path, in cells
  final: boolean;
}

export interface Difficulty {
  cols: number;
  rows: number;
  guards: number;
  dogs: number;
  lasers: number;
  cameras: number;
  spikes: number;
  items: number;
}

export function difficulty(level: number): Difficulty {
  const L = level;
  return {
    cols: Math.min(17, 6 + Math.floor(L / 3)),
    rows: Math.min(13, 5 + Math.floor(L / 4)),
    guards: L === 1 ? 1 : Math.min(13, 1 + Math.floor(L * 0.28)),
    dogs: L < 4 ? 0 : Math.min(7, 1 + Math.floor((L - 4) / 7)),
    lasers: L < 2 ? 0 : Math.min(11, 1 + Math.floor(L / 4)),
    cameras: L < 14 ? 0 : Math.min(7, 1 + Math.floor((L - 14) / 6)),
    spikes: L < 3 ? 0 : Math.min(10, 1 + Math.floor(L / 5)),
    items: 5 + Math.floor(L / 4),
  };
}

export type ItemWeights = Record<ItemKind, number>;

const T = TILE;

export function generateLevel(level: number, weights: ItemWeights, itemScale = 1): LevelData {
  const seed = 7919 * level + 1337;
  const rng = new Rng(seed);
  const theme = themeFor(level);
  const d = difficulty(level);
  const final = level === 50;
  const C = d.cols;
  const R = d.rows;
  const W = C * 3 + 1;
  const H = R * 3 + 1;
  const grid = new Uint8Array(W * H).fill(1);
  const idx = (x: number, y: number) => y * W + x;
  const open = (x: number, y: number) => (grid[idx(x, y)] = 0);

  // links[c] bitmask: 1 right, 2 down, 4 left, 8 up
  const links = new Uint8Array(C * R);
  const cid = (cx: number, cy: number) => cy * C + cx;
  const DIRS = [
    { dx: 1, dy: 0, bit: 1, back: 4 },
    { dx: 0, dy: 1, bit: 2, back: 8 },
    { dx: -1, dy: 0, bit: 4, back: 1 },
    { dx: 0, dy: -1, bit: 8, back: 2 },
  ];
  const link = (cx: number, cy: number, di: number) => {
    const D = DIRS[di];
    links[cid(cx, cy)] |= D.bit;
    links[cid(cx + D.dx, cy + D.dy)] |= D.back;
  };

  // recursive backtracker
  const seen = new Uint8Array(C * R);
  const stack: [number, number][] = [[0, 0]];
  seen[0] = 1;
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const opts = DIRS.map((D, i) => ({ D, i })).filter(
      ({ D }) => cx + D.dx >= 0 && cy + D.dy >= 0 && cx + D.dx < C && cy + D.dy < R && !seen[cid(cx + D.dx, cy + D.dy)],
    );
    if (!opts.length) {
      stack.pop();
      continue;
    }
    const { D, i } = rng.pick(opts);
    link(cx, cy, i);
    seen[cid(cx + D.dx, cy + D.dy)] = 1;
    stack.push([cx + D.dx, cy + D.dy]);
  }

  // braid: open some dead ends into loops so there is always a way around a guard
  const braid = final ? 0.7 : theme.braid;
  for (let cy = 0; cy < R; cy++)
    for (let cx = 0; cx < C; cx++) {
      const l = links[cid(cx, cy)];
      const n = (l & 1) + ((l >> 1) & 1) + ((l >> 2) & 1) + ((l >> 3) & 1);
      if (n !== 1 || !rng.chance(braid)) continue;
      const opts = DIRS.map((D, i) => ({ D, i })).filter(
        ({ D }) => !(l & D.bit) && cx + D.dx >= 0 && cy + D.dy >= 0 && cx + D.dx < C && cy + D.dy < R,
      );
      if (opts.length) link(cx, cy, rng.pick(opts).i);
    }

  // rooms: open blocks of cells completely
  const roomCells = new Set<number>();
  for (let r = 0; r < theme.rooms + (final ? 2 : 0); r++) {
    const rw = rng.int(2, 3);
    const rh = rng.int(2, 3);
    const rx = rng.int(0, C - rw);
    const ry = rng.int(0, R - rh);
    for (let y = ry; y < ry + rh; y++)
      for (let x = rx; x < rx + rw; x++) {
        roomCells.add(cid(x, y));
        if (x < rx + rw - 1) link(x, y, 0);
        if (y < ry + rh - 1) link(x, y, 1);
      }
    for (let y = ry; y < ry + rh - 1; y++)
      for (let x = rx; x < rx + rw - 1; x++) if (rng.chance(0.75)) open(3 + x * 3, 3 + y * 3); // pillar
  }

  // carve tiles
  for (let cy = 0; cy < R; cy++)
    for (let cx = 0; cx < C; cx++) {
      const x0 = 1 + cx * 3;
      const y0 = 1 + cy * 3;
      open(x0, y0);
      open(x0 + 1, y0);
      open(x0, y0 + 1);
      open(x0 + 1, y0 + 1);
      const l = links[cid(cx, cy)];
      if (l & 1) {
        open(x0 + 2, y0);
        open(x0 + 2, y0 + 1);
      }
      if (l & 2) {
        open(x0, y0 + 2);
        open(x0 + 1, y0 + 2);
      }
    }

  // cell graph distances
  const bfsCells = (from: number) => {
    const dist = new Int32Array(C * R).fill(-1);
    const prev = new Int32Array(C * R).fill(-1);
    dist[from] = 0;
    const q = [from];
    for (let qi = 0; qi < q.length; qi++) {
      const c = q[qi];
      const cx = c % C;
      const cy = Math.floor(c / C);
      DIRS.forEach((D) => {
        if (!(links[c] & D.bit)) return;
        const n = cid(cx + D.dx, cy + D.dy);
        if (dist[n] >= 0) return;
        dist[n] = dist[c] + 1;
        prev[n] = c;
        q.push(n);
      });
    }
    return { dist, prev };
  };

  const corners = [cid(0, 0), cid(C - 1, 0), cid(0, R - 1), cid(C - 1, R - 1)];
  const startCell = rng.pick(corners);
  const { dist, prev } = bfsCells(startCell);
  let exitCell = 0;
  for (let c = 0; c < C * R; c++) if (dist[c] > dist[exitCell]) exitCell = c;
  const centre = (c: number): Pt => ({ x: (2 + (c % C) * 3) * T, y: (2 + Math.floor(c / C) * 3) * T });
  const start = centre(startCell);
  const exit = centre(exitCell);
  const exitTile = { x: 1 + (exitCell % C) * 3, y: 1 + Math.floor(exitCell / C) * 3 };

  const mainPath: number[] = [];
  for (let c = exitCell; c >= 0; c = prev[c]) mainPath.unshift(c);

  const used = new Set<number>([startCell, exitCell]);
  const farCells = (minDist: number) => {
    const out: number[] = [];
    for (let c = 0; c < C * R; c++) if (dist[c] >= minDist && c !== exitCell) out.push(c);
    return rng.shuffle(out);
  };

  // guards
  const guards: GuardSpec[] = [];
  const guardCells = farCells(level <= 2 ? 3 : 2);
  for (let g = 0; g < d.guards && guardCells.length; g++) {
    const home = guardCells.pop()!;
    const sentry = rng.chance(level < 5 ? 0.15 : 0.25);
    if (sentry) {
      guards.push({ route: [centre(home)], variant: g });
      used.add(home);
      continue;
    }
    // walk a random path away from home without coming near the start
    const { dist: gd, prev: gp } = bfsCells(home);
    const targets: number[] = [];
    for (let c = 0; c < C * R; c++) if (gd[c] >= 3 && gd[c] <= 7 && dist[c] >= 2) targets.push(c);
    if (!targets.length) {
      guards.push({ route: [centre(home)], variant: g });
      continue;
    }
    const target = rng.pick(targets);
    const route: Pt[] = [];
    let ok = true;
    for (let c = target; c >= 0; c = gp[c]) {
      if (dist[c] < 2) ok = false;
      route.unshift(centre(c));
    }
    if (!ok) {
      guards.push({ route: [centre(home)], variant: g });
      continue;
    }
    guards.push({ route, variant: g });
    used.add(home);
  }

  // dogs
  const dogs: DogSpec[] = [];
  const dogCells = farCells(4);
  for (let i = 0; i < d.dogs && dogCells.length; i++) {
    const home = dogCells.pop()!;
    const { dist: dd } = bfsCells(home);
    const cells: Pt[] = [];
    for (let c = 0; c < C * R; c++) if (dd[c] >= 0 && dd[c] <= 3 && dist[c] >= 3) cells.push(centre(c));
    dogs.push({ home: centre(home), cells });
  }

  // lasers across passages between cells
  const passages: { c: number; dir: number }[] = [];
  for (let c = 0; c < C * R; c++) {
    if (dist[c] < 2 || c === exitCell) continue;
    if (links[c] & 1 && !(roomCells.has(c) && roomCells.has(c + 1))) passages.push({ c, dir: 0 });
    if (links[c] & 2 && !(roomCells.has(c) && roomCells.has(c + C))) passages.push({ c, dir: 1 });
  }
  rng.shuffle(passages);
  const lasers: LaserSpec[] = [];
  for (let i = 0; i < d.lasers && passages.length; i++) {
    const { c, dir } = passages.pop()!;
    const cx = c % C;
    const cy = Math.floor(c / C);
    const period = 2.2 + rng.next() * 1.8 - Math.min(0.6, level * 0.012);
    const spec: LaserSpec =
      dir === 0
        ? { a: { x: (3 + cx * 3 + 0.5) * T, y: (1 + cy * 3) * T }, b: { x: (3 + cx * 3 + 0.5) * T, y: (3 + cy * 3) * T }, period, offset: rng.next() * period, duty: 0.5 + Math.min(0.15, level * 0.003) }
        : { a: { x: (1 + cx * 3) * T, y: (3 + cy * 3 + 0.5) * T }, b: { x: (3 + cx * 3) * T, y: (3 + cy * 3 + 0.5) * T }, period, offset: rng.next() * period, duty: 0.5 + Math.min(0.15, level * 0.003) };
    lasers.push(spec);
  }

  // cameras on wall faces above cells, sweeping downwards
  const cameras: CameraSpec[] = [];
  const camCells = farCells(3).filter((c) => grid[idx(1 + (c % C) * 3, Math.floor(c / C) * 3)] === 1);
  for (let i = 0; i < d.cameras && camCells.length; i++) {
    const c = camCells.pop()!;
    const tx = 1 + (c % C) * 3 + rng.int(0, 1);
    const ty = Math.floor(c / C) * 3;
    if (grid[idx(tx, ty)] !== 1) continue;
    cameras.push({ x: (tx + 0.5) * T, y: (ty + 1) * T - 4, base: Math.PI / 2, sweep: 0.9 + rng.next() * 0.3, speed: 0.5 + rng.next() * 0.4 });
  }

  // spike traps
  const spikes: SpikeSpec[] = [];
  const spikeCells = farCells(2);
  for (let i = 0; i < d.spikes && spikeCells.length; i++) {
    const c = spikeCells.pop()!;
    const period = 2.4 + rng.next() * 1.2;
    spikes.push({ tx: 1 + (c % C) * 3 + rng.int(0, 1), ty: 1 + Math.floor(c / C) * 3 + rng.int(0, 1), period, offset: rng.next() * period });
  }
  const spikeAt = new Set(spikes.map((s) => s.tx + ',' + s.ty));

  // items, with their own random stream so powerup choices don't reshuffle the maze
  const irng = new Rng(seed ^ 0x5bd1e995);
  const items: ItemSpec[] = [];
  const floorTiles: Pt[] = [];
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      if (grid[idx(x, y)] || spikeAt.has(x + ',' + y)) continue;
      const c = cid(Math.min(C - 1, Math.floor((x - 1) / 3)), Math.min(R - 1, Math.floor((y - 1) / 3)));
      if (c === exitCell) continue;
      floorTiles.push({ x, y });
    }
  irng.shuffle(floorTiles);
  // a rock right by the start, so throwing is learned straight away
  const sx = Math.floor(start.x / T);
  const sy = Math.floor(start.y / T);
  const near = floorTiles.filter((t) => Math.abs(t.x - sx) + Math.abs(t.y - sy) >= 1 && Math.abs(t.x - sx) + Math.abs(t.y - sy) <= 3);
  if (near.length) {
    const t = near[0];
    items.push({ x: (t.x + 0.5) * T, y: (t.y + 0.5) * T, kind: 'rock' });
    floorTiles.splice(floorTiles.indexOf(t), 1);
  }
  const nItems = Math.round(d.items * itemScale);
  for (let i = 0; i < nItems && floorTiles.length; i++) {
    const t = floorTiles.pop()!;
    const kind = weighted(irng, weights);
    items.push({ x: (t.x + 0.25 + irng.next() * 0.5) * T, y: (t.y + 0.3 + irng.next() * 0.5) * T, kind });
  }

  // lights on wall faces
  const lights: Pt[] = [];
  const faces: Pt[] = [];
  for (let y = 0; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (grid[idx(x, y)] && !grid[idx(x, y + 1)]) faces.push({ x, y });
  rng.shuffle(faces);
  const nLights = theme.lightKind === 'moon' || theme.lightKind === 'none' ? 0 : Math.floor((C * R) / 4);
  for (const f of faces) {
    if (lights.length >= nLights) break;
    if (lights.some((l) => Math.abs(l.x - f.x) + Math.abs(l.y - f.y) < 5)) continue;
    lights.push(f);
  }

  const decor: Pt[] = [];
  for (let i = 0; i < (C * R) / 3; i++) {
    const x = rng.int(1, W - 2);
    const y = rng.int(1, H - 2);
    if (!grid[idx(x, y)]) decor.push({ x, y });
  }

  // Jeff's mid-level cameo spot, part way along the main path
  let cameo: Pt | null = null;
  if (!final && mainPath.length > 6 && rng.chance(level % 5 === 1 ? 0.3 : 0.6)) cameo = centre(mainPath[Math.floor(mainPath.length * 0.45)]);

  return {
    level,
    seed,
    w: W,
    h: H,
    grid,
    start,
    exit,
    exitTile,
    guards,
    dogs,
    lasers,
    cameras,
    spikes,
    items,
    lights,
    decor,
    cameo,
    pathCells: mainPath.length,
    final,
  };
}

export function isWall(L: LevelData, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= L.w || ty >= L.h) return true;
  return L.grid[ty * L.w + tx] === 1;
}

/** BFS on tiles. Returns px waypoints (tile centres) from a to b, excluding a's tile. */
export function findPath(L: LevelData, ax: number, ay: number, bx: number, by: number, maxNodes = 4000): Pt[] | null {
  const sx = Math.floor(ax / T);
  const sy = Math.floor(ay / T);
  const ex = Math.floor(bx / T);
  const ey = Math.floor(by / T);
  if (isWall(L, ex, ey) || isWall(L, sx, sy)) return null;
  if (sx === ex && sy === ey) return [{ x: bx, y: by }];
  const W = L.w;
  const prev = new Int32Array(L.w * L.h).fill(-1);
  const s = sy * W + sx;
  const e = ey * W + ex;
  prev[s] = s;
  const q = [s];
  let found = false;
  for (let qi = 0; qi < q.length && qi < maxNodes; qi++) {
    const c = q[qi];
    if (c === e) {
      found = true;
      break;
    }
    const cx = c % W;
    const cy = (c - cx) / W;
    const nb = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ];
    for (const [nx, ny] of nb) {
      if (isWall(L, nx, ny)) continue;
      const n = ny * W + nx;
      if (prev[n] >= 0) continue;
      prev[n] = c;
      q.push(n);
    }
  }
  if (!found && prev[e] < 0) return null;
  const out: Pt[] = [];
  for (let c = e; c !== s; c = prev[c]) out.unshift({ x: ((c % W) + 0.5) * T, y: (Math.floor(c / W) + 0.5) * T });
  return out;
}

/** True if the straight line between two px points crosses no wall. */
export function lineOfSight(L: LevelData, x0: number, y0: number, x1: number, y1: number): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  const steps = Math.ceil(len / (T / 4));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (isWall(L, Math.floor((x0 + dx * t) / T), Math.floor((y0 + dy * t) / T))) return false;
  }
  return true;
}

/** Distance a ray travels before hitting a wall (px), capped at max. */
export function castRay(L: LevelData, x0: number, y0: number, ang: number, max: number): number {
  const step = 4;
  const cx = Math.cos(ang);
  const cy = Math.sin(ang);
  for (let d = 0; d < max; d += step) {
    if (isWall(L, Math.floor((x0 + cx * d) / T), Math.floor((y0 + cy * d) / T))) return d;
  }
  return max;
}
