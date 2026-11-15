// The land of Survivle: 10,000 × 10,000 tiles, made from a seed one 32 × 32 chunk at a time as you
// explore, so only the part near you is ever in memory. Heights are whole "levels" so cliffs are crisp.

export const SIZE = 10000;
export const CX = 5000;
export const CY = 5000;
export const START_X = 5000.5;
export const START_Y = 5600.5;
const ROAD_END = 615;
/** Height of the castle floor. */
export const FLOOR_H = 5;
/** The Dark Beast's room is every tile within this many tiles (square) of the castle centre. */
export const ROOM_R = 10;
export const CHUNK = 32;

export const enum G { Grass = 0, Forest, Sand, Water, Rock, Snow, Dirt, Path, Bridge, Gloom, Stone, Floor, Dark, Roof, Farm }
export const enum T { None = 0, Oak, Pine, Bush }

export const tH = (v: number) => v & 255;
export const tG = (v: number) => (v >> 8) & 255;
export const tT = (v: number) => (v >> 16) & 255;
const pack = (h: number, g: number, t: number) => h | (g << 8) | (t << 16);
const OOB = pack(0, G.Water, 0);

export function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function smooth(t: number) {
  return t * t * (3 - 2 * t);
}

function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = smooth(x - xi), yf = smooth(y - yi);
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}

function fbm(x: number, y: number, seed: number, oct: number): number {
  let v = 0, amp = 0.5, f = 1, total = 0;
  for (let i = 0; i < oct; i++) {
    v += valueNoise(x * f, y * f, seed + i * 101) * amp;
    total += amp;
    amp *= 0.5;
    f *= 2;
  }
  return v / total;
}

export const castleR = (x: number, y: number) => Math.max(Math.abs(Math.floor(x) - CX), Math.abs(Math.floor(y) - CY));
export const inRoom = (x: number, y: number) => castleR(x, y) <= ROOM_R;
export function isDoor(x: number, y: number) {
  const dx = x - CX, dy = y - CY;
  return (dy === 11 || dy === 12) && Math.abs(dx) <= 1;
}
const onPath = (dx: number, dy: number) => Math.abs(dx) <= 1 && dy > 34 && dy < ROAD_END;
const inCamp = (x: number, y: number) => Math.abs(x - 5000) <= 8 && Math.abs(y - 5600) <= 8;

/** Two villages where you can get a job. */
export const VILLAGES = [
  { name: 'Willowby', x: 5090, y: 5650 },
  { name: 'Stonebrook', x: 4400, y: 5150 },
];
export const VILLAGE_R = 20;
/** Houses: top-left corner offsets from the village centre, each 4 × 4 tiles. */
const HOUSES = [[-15, -15], [-7, -16], [5, -15], [12, -12], [-16, -5], [-16, 6], [-12, 13], [7, 13], [14, 4]];
/** The farm field, relative to the village centre. */
export const FARM = { x0: 4, y0: 2, w: 7, h: 6 };
/** Job board and bakery oven, relative to the village centre. */
export const BOARD = { x: 0, y: -3 };
export const OVEN = { x: -4, y: 2 };

export function villageAt(x: number, y: number): number {
  for (let i = 0; i < VILLAGES.length; i++) {
    const v = VILLAGES[i];
    if (Math.max(Math.abs(x - v.x), Math.abs(y - v.y)) <= VILLAGE_R) return i;
  }
  return -1;
}

/** The four corner lairs, one mini boss each. */
export const LAIRS = [
  { x: 350, y: 350, ground: G.Snow },
  { x: SIZE - 350, y: 350, ground: G.Dirt },
  { x: 350, y: SIZE - 350, ground: G.Forest },
  { x: SIZE - 350, y: SIZE - 350, ground: G.Rock },
];
export const LAIR_R = 16;

function lairDist(x: number, y: number) {
  let d = 1e9;
  for (const l of LAIRS) d = Math.min(d, Math.max(Math.abs(x - l.x), Math.abs(y - l.y)));
  return d;
}

function villageDist(x: number, y: number) {
  let d = 1e9;
  for (const v of VILLAGES) d = Math.min(d, Math.max(Math.abs(x - v.x), Math.abs(y - v.y)));
  return d;
}

function castleTile(dx: number, dy: number, r: number): number {
  const F = FLOOR_H;
  if (r >= 30) {
    if (dy >= 30 && Math.abs(dx) <= 2) return pack(F, G.Floor, 0); // the gate
    if (r <= 32) return pack(F + (Math.abs(dx) >= 29 && Math.abs(dy) >= 29 ? 8 : 5), G.Stone, 0);
    return pack(F, G.Gloom, 0);
  }
  if (r >= 11 && r <= 12) {
    if (dy >= 11 && Math.abs(dx) <= 1) return pack(F, G.Floor, 0); // the keep's door
    return pack(F + 4, G.Stone, 0);
  }
  if (r <= ROOM_R) return pack(F, G.Dark, 0);
  // courtyard, with a few pillars
  if (((Math.abs(dx) === 20 && Math.abs(dy) % 5 === 0) || (Math.abs(dy) === 20 && Math.abs(dx) % 5 === 0)) && !(dy > 0 && Math.abs(dx) <= 2))
    return pack(F + 3, G.Stone, 0);
  return pack(F, G.Floor, 0);
}

/** One tile, straight from the seed (no chopped trees, no sealed doors). */
export function gen(x: number, y: number, seed: number): number {
  if (x < 1 || y < 1 || x >= SIZE - 1 || y >= SIZE - 1) return OOB;
  const dx = x - CX, dy = y - CY;
  const r = Math.max(Math.abs(dx), Math.abs(dy));
  if (r <= 34) return castleTile(dx, dy, r);
  const path = onPath(dx, dy);
  const vd = villageDist(x, y);
  const ld = lairDist(x, y);
  const camp = inCamp(x, y) || vd <= VILLAGE_R || ld <= LAIR_R + 2;
  const n = fbm(x / 260, y / 260, seed, 4);
  const m = fbm(x / 70, y / 70, seed + 7, 3);
  if (n < 0.36 && r >= 140) {
    if (path && dx === 0) return pack(1, G.Bridge, 0); // a narrow, one-tile bridge
    if (!camp && vd > VILLAGE_R + 2 && ld > 45) return pack(0, G.Water, 0);
  }
  let h = 1 + Math.floor(Math.max(0, n - 0.36) * 22);
  // cliffs and plateaus, ramping down to the road and the starting camp so those stay open
  let lift = 0;
  if (m > 0.6) lift += 4 + Math.floor((m - 0.6) * 25);
  if (m > 0.7) lift += 3;
  if (lift) {
    let k = 1;
    if (dy > 34 && dy < ROAD_END) k = Math.min(k, Math.max(0, (Math.abs(dx) - 1) / 7));
    const cd = Math.max(Math.abs(x - 5000), Math.abs(y - 5600));
    k = Math.min(k, Math.max(0, (cd - 8) / 12));
    k = Math.min(k, Math.max(0, (vd - VILLAGE_R) / 12));
    k = Math.min(k, Math.max(0, (ld - LAIR_R) / 14));
    h += Math.round(lift * k);
  }
  if (r < 140) {
    const k = Math.max(0, (r - 90) / 50);
    h = Math.round(FLOOR_H + (h - FLOOR_H) * k);
  }
  if (ld <= LAIR_R) {
    const l = LAIRS.find((q) => Math.max(Math.abs(x - q.x), Math.abs(y - q.y)) <= LAIR_R)!;
    const ring = Math.max(Math.abs(x - l.x), Math.abs(y - l.y));
    return pack(h, ring === LAIR_R ? G.Stone : l.ground, 0);
  }
  const vi = vd <= VILLAGE_R ? villageAt(x, y) : -1;
  if (vi >= 0) {
    const lx = x - VILLAGES[vi].x, ly = y - VILLAGES[vi].y;
    if (HOUSES.some(([hx, hy]) => lx >= hx && lx < hx + 4 && ly >= hy && ly < hy + 4)) return pack(h + 3, G.Roof, 0);
    if (lx >= FARM.x0 && lx < FARM.x0 + FARM.w && ly >= FARM.y0 && ly < FARM.y0 + FARM.h) return pack(h, G.Farm, 0);
    if (Math.max(Math.abs(lx), Math.abs(ly)) <= 5 || lx === 0 || ly === 0) return pack(h, G.Path, 0);
    return pack(h, G.Grass, hash(x, y, seed + 3) < 0.04 ? T.Bush : 0);
  }
  let g: number;
  if (path) g = G.Path;
  else if (r < 110) g = G.Gloom;
  else if (n < 0.385 && !camp) g = G.Sand;
  else if (h >= 17) g = G.Snow;
  else if (m > 0.7) g = G.Rock;
  else {
    const f = fbm(x / 40, y / 40, seed + 13, 2);
    g = f > 0.58 ? G.Forest : f < 0.3 ? G.Dirt : G.Grass;
  }
  let t = 0;
  if (!path && !camp && g !== G.Sand && r >= 100) {
    const hv = hash(x, y, seed + 99);
    const dens = g === G.Forest ? 0.26 : g === G.Snow ? 0.04 : g === G.Rock ? 0.015 : g === G.Gloom ? 0.01 : 0.022;
    if (hv < dens) t = h >= 11 || g === G.Snow || hash(x, y, seed + 5) < 0.35 ? T.Pine : T.Oak;
    else if (hv < dens + 0.03 && g !== G.Snow && g !== G.Rock) t = T.Bush;
  }
  return pack(h, g, t);
}

export const blocksMove = (v: number) => {
  const t = tT(v);
  return t === T.Oak || t === T.Pine;
};

export class World {
  seed: number;
  chunks = new Map<number, Uint32Array>();
  chopped = new Set<number>();
  sealed = false;

  constructor(seed: number) {
    this.seed = seed;
  }

  private chunk(cx: number, cy: number): Uint32Array {
    const key = cx * 1024 + cy;
    let c = this.chunks.get(key);
    if (!c) {
      c = new Uint32Array(CHUNK * CHUNK);
      const x0 = cx * CHUNK, y0 = cy * CHUNK;
      for (let j = 0; j < CHUNK; j++) for (let i = 0; i < CHUNK; i++) c[j * CHUNK + i] = gen(x0 + i, y0 + j, this.seed);
      this.chunks.set(key, c);
    }
    return c;
  }

  /** Packed tile at whole tile coordinates. */
  tile(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return OOB;
    let v = this.chunk(x >> 5, y >> 5)[(y & 31) * CHUNK + (x & 31)];
    if (v >> 16 && this.chopped.has(x * SIZE + y)) v &= 0xffff;
    if (this.sealed && isDoor(x, y)) v = pack(FLOOR_H + 4, G.Stone, 0);
    return v;
  }

  /** Height of the ground under a point. */
  heightAt(fx: number, fy: number): number {
    return tH(this.tile(Math.floor(fx), Math.floor(fy)));
  }

  /** Forget chunks far from (px, py) so memory stays small on a huge map. */
  prune(px: number, py: number) {
    if (this.chunks.size < 700) return;
    const pcx = px >> 5, pcy = py >> 5;
    for (const key of this.chunks.keys()) {
      const cx = Math.floor(key / 1024), cy = key % 1024;
      if (Math.abs(cx - pcx) > 10 || Math.abs(cy - pcy) > 10) this.chunks.delete(key);
    }
  }
}

/** A glowing challenge rock in the 250 × 250 region (rx, ry), or null. Same answer every time for a seed. */
export function stoneIn(rx: number, ry: number, world: World): { x: number; y: number } | null {
  const s = world.seed;
  if (rx === 19 && ry === 22) return { x: 4993, y: 5594 }; // one right by the starting camp
  if (hash(rx, ry, s + 41) > 0.75) return null;
  const x = rx * 250 + 30 + Math.floor(hash(rx, ry, s + 31) * 190);
  const y = ry * 250 + 30 + Math.floor(hash(rx, ry, s + 37) * 190);
  if (castleR(x, y) < 150 || villageDist(x, y) < VILLAGE_R + 6) return null;
  const v = world.tile(x, y);
  if (tG(v) === G.Water || blocksMove(v)) return null;
  return { x, y };
}
