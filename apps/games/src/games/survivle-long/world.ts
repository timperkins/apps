// The land of Survivle (Long Edition): 10,000 × 10,000 tiles, made from a seed one 32 × 32 chunk at a time as you
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
export const ROOM_R = 30;
/** The whole castle (room, keep walls, courtyard, outer wall, gloom) fits in this square radius. */
export const CASTLE_R = 54;
/** Low walls in the Dark Beast's room to hide behind: [x, y, horizontal] from the centre, 5 tiles long. */
export const BARRICADES: [number, number, boolean][] = [
  [-22, -22, true], [22, -22, true], [-22, 22, true], [22, 22, true],
  [-11, -22, false], [11, -22, false], [-11, 22, false], [11, 22, false],
  [-22, -10, false], [22, -10, false], [-22, 10, false], [22, 10, false],
  [-12, -12, true], [12, -12, true], [-12, 12, true], [12, 12, true],
  [0, -16, true], [-16, 0, false], [16, 0, false], [0, 17, true],
];
const barricadeAt = (dx: number, dy: number) =>
  BARRICADES.some(([bx, by, h]) => (h ? dy === by && dx >= bx - 2 && dx <= bx + 2 : dx === bx && dy >= by - 2 && dy <= by + 2));
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
  return (dy === ROOM_R + 1 || dy === ROOM_R + 2) && Math.abs(dx) <= 1;
}
const onPath = (dx: number, dy: number) => Math.abs(dx) <= 1 && dy > CASTLE_R && dy < ROAD_END;
const inCamp = (x: number, y: number) => Math.abs(x - 5000) <= 8 && Math.abs(y - 5600) <= 8;

/** Every village there can be: two to start, and one more for each friend in a co-op game. */
const ALL_VILLAGES = [
  { name: 'Willowby', x: 5060, y: 5640 },
  { name: 'Stonebrook', x: 4936, y: 5652 },
  { name: 'Fernhollow', x: 5130, y: 5560 },
  { name: 'Ashford', x: 4870, y: 5560 },
  { name: 'Mossgate', x: 5070, y: 5740 },
  { name: 'Pebbleton', x: 4935, y: 5745 },
  { name: 'Brightwater', x: 5160, y: 5670 },
  { name: 'Oakridge', x: 4840, y: 5680 },
];
/** The villages in this game right now. */
export const VILLAGES = ALL_VILLAGES.slice(0, 2);
export const MAX_VILLAGES = ALL_VILLAGES.length;

/** Change how many villages there are (co-op adds one per friend) and rebuild the land around them. */
export function setVillageCount(n: number, world?: World) {
  n = Math.max(2, Math.min(ALL_VILLAGES.length, n));
  if (n === VILLAGES.length) return false;
  VILLAGES.length = 0;
  VILLAGES.push(...ALL_VILLAGES.slice(0, n));
  if (world) {
    world.chunks.clear();
    world.version++;
  }
  return true;
}
export const VILLAGE_R = 20;
/** Houses: top-left corner offsets from the village centre, each 4 × 4 tiles. */
const HOUSES = [[-15, -15], [-7, -16], [5, -15], [12, -12], [-16, -5], [-16, 6], [-12, 13], [7, 13], [14, 4]];
/** The farm field, relative to the village centre. */
export const FARM = { x0: 4, y0: 2, w: 7, h: 6 };
/** Job board and bakery oven, relative to the village centre. */
export const BOARD = { x: 0, y: -3 };
export const OVEN = { x: -4, y: 2 };
/** The grocery store's stall and the spot where shoppers stand. */
export const STORE = { x: -8, y: -8 };

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
/** Warp pads at the starting camp, one to each lair, and a pad in each lair back to camp. */
export const WARPS = [
  { x: 4994, y: 5606 },
  { x: 4998, y: 5607 },
  { x: 5002, y: 5607 },
  { x: 5006, y: 5606 },
];
export const lairPad = (i: number) => ({ x: LAIRS[i].x, y: LAIRS[i].y + 11 });

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
  const W = CASTLE_R - 4; // outer wall
  if (r >= W) {
    if (dy >= W && Math.abs(dx) <= 2) return pack(F, G.Floor, 0); // the gate
    if (r <= W + 2) return pack(F + (Math.abs(dx) >= W - 1 && Math.abs(dy) >= W - 1 ? 8 : 5), G.Stone, 0);
    return pack(F, G.Gloom, 0);
  }
  if (r === ROOM_R + 1 || r === ROOM_R + 2) {
    if (dy > ROOM_R && Math.abs(dx) <= 1) return pack(F, G.Floor, 0); // the keep's door
    return pack(F + 4, G.Stone, 0);
  }
  if (r <= ROOM_R) return pack(barricadeAt(dx, dy) ? F + 2 : F, barricadeAt(dx, dy) ? G.Stone : G.Dark, 0);
  // courtyard, with a few pillars
  const P = ROOM_R + 10;
  if (((Math.abs(dx) === P && Math.abs(dy) % 5 === 0) || (Math.abs(dy) === P && Math.abs(dx) % 5 === 0)) && !(dy > 0 && Math.abs(dx) <= 2))
    return pack(F + 3, G.Stone, 0);
  return pack(F, G.Floor, 0);
}

// ---------- Long Edition: places out in the world ----------

/** Where the Sword of Light waits in a ring of trees. */
export const GROVE = { x: 5310, y: 5870 };
export const GROVE_R = 9;

export const enum S { Camp = 1, Shrine, Tower, Spring, Ore }
export interface Site {
  kind: S;
  x: number;
  y: number;
  /** Flat ground within this many tiles of the middle. */
  r: number;
  key: number;
  /** Bigger camps have a captain. */
  big: boolean;
}
export const SITE_REGION = 160;
const siteCache = new Map<number, Site | null>();
let siteSeed = -1;

/** The one place (camp, shrine, tower, spring or ore rocks) in this 160 × 160 region, or null. */
export function siteIn(rx: number, ry: number, seed: number): Site | null {
  if (seed !== siteSeed) {
    siteCache.clear();
    siteSeed = seed;
  }
  const key = rx * 1000 + ry;
  if (siteCache.has(key)) return siteCache.get(key)!;
  let site: Site | null = null;
  const roll = hash(rx + 7919, ry - 3301, seed + 501);
  if (roll < 0.78 && rx >= 0 && ry >= 0) {
    const k = hash(ry * 3 + 104729, rx * 5 - 1299709, seed + 17);
    const kind = k < 0.36 ? S.Camp : k < 0.6 ? S.Shrine : k < 0.76 ? S.Ore : k < 0.88 ? S.Spring : S.Tower;
    const r = kind === S.Camp ? 7 : kind === S.Tower || kind === S.Ore ? 2 : 3;
    const x = rx * SITE_REGION + 20 + Math.floor(hash(rx - 15485863, ry + 32452843, seed + 3) * 120);
    const y = ry * SITE_REGION + 20 + Math.floor(hash(ry + 49979687, rx - 67867967, seed + 11) * 120);
    const cd = Math.max(Math.abs(x - 5000), Math.abs(y - 5600));
    const ok = x > 40 && y > 40 && x < SIZE - 40 && y < SIZE - 40 && castleR(x, y) > 170 && villageDist(x, y) > VILLAGE_R + 15
      && lairDist(x, y) > LAIR_R + 20 && cd > 30 && !(Math.abs(x - CX) < 14 && y > CY && y < CY + ROAD_END + 10)
      && Math.max(Math.abs(x - GROVE.x), Math.abs(y - GROVE.y)) > 30 && tG(baseGen(x, y, seed)) !== G.Water;
    if (ok) site = { kind, x, y, r, key, big: kind === S.Camp && cd > 450 && hash(rx * 7 + 86028121, ry * 11 - 2, seed + 23) < 0.35 };
  }
  siteCache.set(key, site);
  return site;
}

/** Every place within `R` tiles of (x, y). */
export function sitesNear(x: number, y: number, R: number, seed: number): Site[] {
  const out: Site[] = [];
  const r0x = Math.floor((x - R) / SITE_REGION), r1x = Math.floor((x + R) / SITE_REGION);
  const r0y = Math.floor((y - R) / SITE_REGION), r1y = Math.floor((y + R) / SITE_REGION);
  for (let ry = r0y; ry <= r1y; ry++)
    for (let rx = r0x; rx <= r1x; rx++) {
      const s = siteIn(rx, ry, seed);
      if (s && Math.abs(s.x - x) <= R && Math.abs(s.y - y) <= R) out.push(s);
    }
  return out;
}

/** Things standing in a raider camp, as offsets from its middle. */
export const CAMP_SPEARS: [number, number][] = [[-2, -2], [2, -2], [-2, 2], [2, 2]];
export const CAMP_TENTS: [number, number][] = [[-5, -1], [4, -4], [1, 5]];
export const ORE_ROCKS: [number, number][] = [[-1, 0], [1, -1], [0, 1]];

/** One tile, straight from the seed (no chopped trees, no sealed doors). */
export function gen(x: number, y: number, seed: number): number {
  if (x < 1 || y < 1 || x >= SIZE - 1 || y >= SIZE - 1) return OOB;
  const gd = Math.max(Math.abs(x - GROVE.x), Math.abs(y - GROVE.y));
  if (gd <= GROVE_R + 2) {
    const h = tH(baseGen(GROVE.x, GROVE.y, seed));
    const gap = y > GROVE.y && Math.abs(x - GROVE.x) <= 1; // the way in, from the south
    if (gd <= GROVE_R) return pack(h, gd <= 1 ? G.Stone : G.Grass, 0);
    return pack(h, G.Forest, gap ? 0 : T.Oak);
  }
  const site = siteIn(Math.floor(x / SITE_REGION), Math.floor(y / SITE_REGION), seed);
  if (site) {
    const sd = Math.max(Math.abs(x - site.x), Math.abs(y - site.y));
    if (sd <= site.r) {
      const h = tH(baseGen(site.x, site.y, seed));
      if (site.kind === S.Tower && sd === 0) return pack(h + 9, G.Stone, 0);
      const g = site.kind === S.Camp ? G.Dirt : site.kind === S.Ore ? G.Rock : site.kind === S.Spring ? G.Grass : G.Stone;
      return pack(h, g, 0);
    }
  }
  return baseGen(x, y, seed);
}

/** The land before any places are added. */
function baseGen(x: number, y: number, seed: number): number {
  if (x < 1 || y < 1 || x >= SIZE - 1 || y >= SIZE - 1) return OOB;
  const dx = x - CX, dy = y - CY;
  const r = Math.max(Math.abs(dx), Math.abs(dy));
  if (r <= CASTLE_R) return castleTile(dx, dy, r);
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
    if (dy > CASTLE_R && dy < ROAD_END) k = Math.min(k, Math.max(0, (Math.abs(dx) - 1) / 7));
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
    const nearStore = Math.max(Math.abs(lx - STORE.x), Math.abs(ly - STORE.y)) <= 3;
    return pack(h, G.Grass, hash(x, y, seed + 3) < 0.04 && !nearStore ? T.Bush : 0);
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
  /** Goes up when the land changes (a new village), so maps get redrawn. */
  version = 0;

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
