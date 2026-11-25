// The planet: a million tiles each way that wraps around, made from a seed so every player builds the
// same land on their own device. Heights, biomes, trees, rocks, ore patches, oil, lakes, villages,
// bug nests, caves and mine shafts all come from here.
import { CHUNK, WORLD, WATER_LEVEL, HOMES, type Biome, type HomeId, type ItemId, type ShopKind } from './data';

/** Shortest signed distance from b to a around the world. */
export const wd = (a: number, b: number) => {
  let d = (a - b) % WORLD;
  if (d > WORLD / 2) d -= WORLD;
  else if (d < -WORLD / 2) d += WORLD;
  return d;
};
export const wrap = (a: number) => ((a % WORLD) + WORLD) % WORLD;
export const key = (x: number, z: number) => `${x},${z}`;
export const dist2 = (ax: number, az: number, bx: number, bz: number) => {
  const dx = wd(ax, bx), dz = wd(az, bz);
  return dx * dx + dz * dz;
};

export function hash(x: number, z: number, s: number): number {
  let h = (x | 0) * 374761393 + (z | 0) * 668265263 + (s | 0) * 1274126177;
  h = (h ^ (h >>> 13)) * 1103515245;
  h = h ^ (h >>> 16);
  return ((h >>> 0) % 1000003) / 1000003;
}
const smooth = (t: number) => t * t * (3 - 2 * t);
const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export type FeatureKind = 'tree' | 'pine' | 'palm' | 'cactus' | 'snowtree' | 'rock' | 'ore' | 'oil' | 'nest' | 'cave' | 'shaft' | 'flower' | 'bush' | 'pole_marker';
export interface Feature {
  kind: FeatureKind;
  ore?: ItemId;
  amount?: number;
  v: number; // 0..1 variety
}

export interface VillageBuilding {
  id: string;
  kind: 'shop' | 'house';
  shop?: ShopKind;
  home?: HomeId;
  x: number; z: number; // min corner tile
  w: number; d: number;
  h: number; // wall height
  door: [number, number]; // tile in front of the door
  color: string;
  roof: string;
}
export interface Village {
  id: string;
  name: string;
  x: number; z: number; // center tile
  y: number; // ground height
  r: number;
  buildings: VillageBuilding[];
  roads: Set<string>;
}

const VILLAGE_CELL = 800; // must divide the world size so villages wrap too
const VILLAGE_NAMES = ['Maple Hollow', 'Pinecrest', 'Sunnyvale', 'Rockford', 'Willow Bend', 'Copper Creek', 'Dusty Gulch', 'Frostby', 'Harborview', 'Oakridge', 'Riverton', 'Stonebridge', 'Elmwood', 'Cedar Falls', 'Brightwater', 'Foxglen'];
const HOUSE_COLORS = ['#e8d5b7', '#c9e4f2', '#f2c9c9', '#d6f2c9', '#f2ebc9', '#e0c9f2', '#ffffff', '#c7b299'];
const ROOF_COLORS = ['#a83a2c', '#3a5a8a', '#4a6b3a', '#6b4a2c', '#555555', '#8a3a6b'];

export const CAVE_SIZE = 48;
export type CaveCell = 0 | 1 | 2 | 3 | 4 | 5 | 6; // floor, stone, iron, copper, coal, crystal, support beam
export const CAVE_ORE: Record<number, ItemId> = { 1: 'stone', 2: 'iron_ore', 3: 'copper_ore', 4: 'coal', 5: 'crystal' };
export interface Cave { id: string; mine: boolean; cells: Uint8Array; exit: [number, number]; ex: number; ez: number; }

export class World {
  readonly seed: number;
  readonly spawnX: number;
  readonly spawnZ: number;
  private villageCache = new Map<string, Village | null>();
  private caveCache = new Map<string, Cave>();
  /** Things picked up or chopped (`x,z`), ore left in a tile, and how far each corner was dug down. */
  removed = new Set<string>();
  oreLeft = new Map<string, number>();
  dug = new Map<string, number>();
  /** Cave walls dug out: `caveId|x,z`. */
  caveDug = new Set<string>();

  constructor(seed: number) {
    this.seed = seed;
    // start near the top of the world, a little south of the North Pole, on land near a village
    let sx = 500000, sz = 4200;
    for (let i = 0; i < 400; i++) {
      const tx = 500000 + Math.round((hash(i, 1, seed) - 0.5) * 60000), tz = 3600 + Math.round(hash(i, 2, seed) * 2400);
      const b = this.baseBiome(tx, tz);
      if (b === 'plains' || (b === 'forest' && i > 200)) {
        // land all around it too
        let ok = true;
        for (let a = 0; a < 8 && ok; a++) {
          const ax = tx + Math.cos(a) * 60, az = tz + Math.sin(a) * 60;
          if (this.rawHeight(ax, az) < 1.5) ok = false;
        }
        if (ok) { sx = tx; sz = tz; break; }
      }
    }
    this.spawnX = sx;
    this.spawnZ = sz;
    // a pond near the start, so steam engines have water from day one
    this.pondX = sx - 32;
    this.pondZ = sz - 26;
  }
  private pondX = NaN;
  private pondZ = NaN;

  // ---------- noise that wraps around the world exactly ----------
  noise(x: number, z: number, scale: number, salt: number) {
    const P = Math.round(WORLD / scale);
    const fx = wrap(x) / scale, fz = wrap(z) / scale;
    const ix = Math.floor(fx), iz = Math.floor(fz);
    const tx = smooth(fx - ix), tz = smooth(fz - iz);
    const s = this.seed + salt * 7919;
    const a = hash(ix % P, iz % P, s), b = hash((ix + 1) % P, iz % P, s);
    const c = hash(ix % P, (iz + 1) % P, s), d = hash((ix + 1) % P, (iz + 1) % P, s);
    return (a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz) * 2 - 1;
  }
  fbm(x: number, z: number, scales: number[], salt: number) {
    let v = 0, amp = 1, tot = 0;
    for (let i = 0; i < scales.length; i++) {
      v += this.noise(x, z, scales[i], salt + i) * amp;
      tot += amp;
      amp *= 0.5;
    }
    return v / tot;
  }

  /** Distance from the North Pole line (z = 0). */
  latitude(z: number) {
    return Math.abs(wd(z, 0));
  }
  continent(x: number, z: number) {
    return this.fbm(x, z, [5000, 2000, 800, 250], 1) + 0.18;
  }
  mountain(x: number, z: number) {
    const r = 1 - Math.abs(this.noise(x, z, 1600, 9) * 0.7 + this.noise(x, z, 400, 10) * 0.3);
    return smoothstep(0.72, 0.93, r) * smoothstep(-0.05, 0.25, this.continent(x, z));
  }

  /** Height of the land before villages flatten it. */
  rawHeight(x: number, z: number): number {
    const c = this.continent(x, z);
    if (this.latitude(z) < 1300) {
      // the North Pole: a flat sheet of ice over the sea, a little bumpy
      return 1.2 + this.noise(x, z, 40, 30) * 0.6 + Math.max(0, this.noise(x, z, 200, 31)) * 6;
    }
    if (c < -0.12) return Math.max(-14, (c + 0.12) * 60 - 0.3);
    let h = 0.8 + (c + 0.12) * 9 + this.fbm(x, z, [125, 50, 25], 3) * 2.2;
    // hills with cliffs
    const cliffy = smoothstep(0.15, 0.45, this.noise(x, z, 500, 4));
    const hills = Math.max(0, this.noise(x, z, 250, 5)) * 14 * cliffy;
    const m = this.mountain(x, z);
    const mh = m * (26 + 22 * this.noise(x, z, 200, 6));
    let up = hills + mh;
    if (up > 0.5) {
      const step = 3;
      const t = up / step, ft = Math.floor(t), fr = t - ft;
      up = (ft + smoothstep(0.82, 1, fr)) * step;
    }
    h += up;
    // the pond near the start
    const pd = Math.hypot(wd(x, this.pondX), wd(z, this.pondZ));
    if (pd < 12) h = Math.min(h, Math.max(h * 0.4, 0.6) * smoothstep(5, 12, pd) + (pd < 8 ? -1.6 * (1 - pd / 8) - 0.2 : 0));
    // lakes
    const lake = this.noise(x, z, 400, 7);
    if (lake > 0.6 && m < 0.1 && hills < 1) h = Math.min(h, (0.6 - lake) * 40 - 0.2);
    return h;
  }

  /** Village cell lookup. */
  villageIn(cx: number, cz: number): Village | null {
    const P = WORLD / VILLAGE_CELL;
    cx = ((cx % P) + P) % P;
    cz = ((cz % P) + P) % P;
    const k = key(cx, cz);
    if (this.villageCache.has(k)) return this.villageCache.get(k)!;
    let v: Village | null = null;
    const spawnCx = Math.floor(this.spawnX / VILLAGE_CELL), spawnCz = Math.floor(this.spawnZ / VILLAGE_CELL);
    const isSpawn = cx === spawnCx && cz === spawnCz;
    if (isSpawn || hash(cx, cz, this.seed + 55) < 0.5) {
      let x = isSpawn ? this.spawnX + 34 : cx * VILLAGE_CELL + 150 + Math.floor(hash(cx, cz, this.seed + 56) * 500);
      let z = isSpawn ? this.spawnZ : cz * VILLAGE_CELL + 150 + Math.floor(hash(cx, cz, this.seed + 57) * 500);
      x = Math.round(x); z = Math.round(z);
      const y = this.rawHeight(x, z);
      const m = this.mountain(x, z);
      if (isSpawn || (y > 1.5 && m < 0.2 && this.latitude(z) > 1400)) v = this.makeVillage(cx, cz, x, z, Math.max(2, Math.min(y, 14)));
    }
    this.villageCache.set(k, v);
    return v;
  }

  private makeVillage(cx: number, cz: number, x: number, z: number, y: number): Village {
    const s = this.seed + cx * 31 + cz * 17;
    const roads = new Set<string>();
    const R = 40;
    // a main street, a cross street, and two side streets
    for (let i = -R; i <= R; i++) {
      for (let w = -1; w <= 1; w++) {
        roads.add(key(x + i, z + w));
        roads.add(key(x + w, z + i));
        if (Math.abs(i) <= 26) {
          roads.add(key(x + i, z - 18 + w));
          roads.add(key(x + i, z + 18 + w));
        }
      }
    }
    const buildings: VillageBuilding[] = [];
    const shops: ShopKind[] = ['store', 'restaurant', 'cars', 'homes', 'pets', 'police'];
    // lots along the streets: [x offset, z offset of the lot's road side, side (-1 north, 1 south)]
    const lots: [number, number, number][] = [];
    for (const rz of [-18, 0, 18]) for (const side of [-1, 1]) for (let ox = -24; ox <= 20; ox += 9) {
      if (ox > -6 && ox < 3) continue; // keep the cross street clear
      lots.push([ox, rz, side]);
    }
    let shopI = 0, homeI = 0;
    lots.forEach(([ox, rz, side], i) => {
      const nearCenter = rz === 0 && Math.abs(ox) < 18;
      const isShop = nearCenter && shopI < shops.length;
      const w = isShop ? 7 : 5 + Math.floor(hash(i, 3, s) * 2);
      const d = isShop ? 6 : 5;
      const bx = x + ox;
      const bz = side < 0 ? z + rz - 2 - d : z + rz + 3;
      const doorZ = side < 0 ? bz + d : bz - 1;
      const door: [number, number] = [bx + Math.floor(w / 2), doorZ];
      if (isShop) {
        const shop = shops[shopI++];
        const colors: Record<ShopKind, [string, string]> = {
          store: ['#f2e2b8', '#2f7d4a'], restaurant: ['#f7d0c0', '#c0392b'], cars: ['#d8dde3', '#2d5ea8'], homes: ['#efe4cf', '#7a4a2a'], pets: ['#fbe3f0', '#d04a9a'], police: ['#d0d8e8', '#1d2a5a'],
        };
        buildings.push({ id: `${cx}.${cz}.${i}`, kind: 'shop', shop, x: bx, z: bz, w, d, h: 4.5, door, color: colors[shop][0], roof: colors[shop][1] });
      } else {
        const home = HOMES[Math.min(HOMES.length - 1, Math.floor(hash(i, 4, s) * 3))].id;
        homeI++;
        buildings.push({
          id: `${cx}.${cz}.${i}`, kind: 'house', home, x: bx, z: bz, w, d, h: 3.4 + hash(i, 5, s) * 1.2, door,
          color: HOUSE_COLORS[Math.floor(hash(i, 6, s) * HOUSE_COLORS.length)], roof: ROOF_COLORS[Math.floor(hash(i, 7, s) * ROOF_COLORS.length)],
        });
      }
    });
    const name = VILLAGE_NAMES[Math.floor(hash(cx, cz, this.seed + 9) * VILLAGE_NAMES.length)];
    return { id: key(cx, cz), name, x, z, y, r: R, buildings, roads };
  }

  /** Villages whose flattened ground might reach this point. */
  villagesNear(x: number, z: number): Village[] {
    const cx = Math.floor(wrap(x) / VILLAGE_CELL), cz = Math.floor(wrap(z) / VILLAGE_CELL);
    const out: Village[] = [];
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const v = this.villageIn(cx + dx, cz + dz);
      if (v && Math.abs(wd(x, v.x)) < 70 && Math.abs(wd(z, v.z)) < 70) out.push(v);
    }
    return out;
  }
  villageAt(x: number, z: number): Village | null {
    for (const v of this.villagesNear(x, z)) if (Math.abs(wd(x, v.x)) <= v.r + 4 && Math.abs(wd(z, v.z)) <= v.r + 4) return v;
    return null;
  }

  /** Height at a tile corner, with villages flattened and digging. */
  cornerHeight(x: number, z: number): number {
    x = wrap(Math.round(x)); z = wrap(Math.round(z));
    let h = this.rawHeight(x, z);
    for (const v of this.villagesNear(x, z)) {
      const d = Math.max(Math.abs(wd(x, v.x)), Math.abs(wd(z, v.z)));
      const t = smoothstep(v.r + 14, v.r + 3, d);
      if (t > 0) h = h * (1 - t) + v.y * t;
    }
    const dd = this.dug.get(key(x, z));
    if (dd) h += dd;
    return h;
  }

  /** Smooth ground height anywhere. */
  heightAt(x: number, z: number) {
    const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
    const a = this.cornerHeight(ix, iz), b = this.cornerHeight(ix + 1, iz), c = this.cornerHeight(ix, iz + 1), d = this.cornerHeight(ix + 1, iz + 1);
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
  }
  /** Average height of a tile. */
  tileHeight(x: number, z: number) {
    return (this.cornerHeight(x, z) + this.cornerHeight(x + 1, z) + this.cornerHeight(x, z + 1) + this.cornerHeight(x + 1, z + 1)) / 4;
  }
  tileSlope(x: number, z: number) {
    const a = this.cornerHeight(x, z), b = this.cornerHeight(x + 1, z), c = this.cornerHeight(x, z + 1), d = this.cornerHeight(x + 1, z + 1);
    return Math.max(a, b, c, d) - Math.min(a, b, c, d);
  }

  temperature(x: number, z: number) {
    const lat = this.latitude(z);
    return this.noise(x, z, 1250, 20) * 0.9 + this.noise(x, z, 200, 21) * 0.15 - (lat < 9000 ? ((9000 - lat) / 9000) * 0.75 : 0);
  }
  moisture(x: number, z: number) {
    return this.noise(x, z, 1000, 22) * 0.85 + this.noise(x, z, 160, 23) * 0.2;
  }

  baseBiome(x: number, z: number): Biome {
    if (this.latitude(z) < 1300) return 'pole';
    const h = this.rawHeight(x, z);
    if (h < WATER_LEVEL) return 'ocean';
    const t = this.temperature(x, z), m = this.moisture(x, z);
    if (this.mountain(x, z) > 0.35) return t < -0.4 ? 'snow' : 'mountain';
    if (t < -0.42) return 'snow';
    if (h < 1.3 && this.continent(x, z) < 0.02) return t > 0.25 ? 'desert' : 'beach';
    if (t > 0.28 && m < 0.05) return 'desert';
    if (m > 0.08) return 'forest';
    return 'plains';
  }
  biome(x: number, z: number): Biome {
    const b = this.baseBiome(x, z);
    if (b !== 'ocean' && b !== 'pole' && this.tileHeight(Math.floor(x), Math.floor(z)) < WATER_LEVEL) return 'ocean';
    return b;
  }
  isWater(x: number, z: number) {
    if (this.latitude(z) < 1300) return false;
    return this.tileHeight(Math.floor(x), Math.floor(z)) < WATER_LEVEL - 0.05;
  }

  /** Ore patches live in 80-tile cells. Near the start there's one of each close by. */
  private orePatch(cx: number, cz: number): { x: number; z: number; r: number; ore: ItemId } | null {
    const s = this.seed + 101;
    const sx = Math.floor(this.spawnX / 80), sz = Math.floor(this.spawnZ / 80);
    const near = Math.abs(cx - sx) <= 1 && Math.abs(cz - sz) <= 1;
    if (near) {
      const order: ItemId[] = ['iron_ore', 'copper_ore', 'coal', 'stone', 'iron_ore', 'coal', 'copper_ore', 'stone', 'iron_ore'];
      const i = (cx - sx + 1) * 3 + (cz - sz + 1);
      if (i === 4) return null; // the start itself stays clear
      return { x: cx * 80 + 40, z: cz * 80 + 40, r: 7, ore: order[i] };
    }
    if (hash(cx, cz, s) > 0.42) return null;
    const r = hash(cx, cz, s + 1);
    const ore: ItemId = r < 0.33 ? 'iron_ore' : r < 0.6 ? 'copper_ore' : r < 0.82 ? 'coal' : 'stone';
    return { x: cx * 80 + 15 + Math.floor(hash(cx, cz, s + 2) * 50), z: cz * 80 + 15 + Math.floor(hash(cx, cz, s + 3) * 50), r: 5 + hash(cx, cz, s + 4) * 5, ore };
  }

  /** What's growing or lying on a tile (before anything was picked up). */
  baseFeature(x: number, z: number): Feature | null {
    x = wrap(x); z = wrap(z);
    const s = this.seed;
    // the North Pole itself
    if (x === wrap(this.spawnX) && z === 0) return { kind: 'pole_marker', v: 0 };
    const vil = this.villageAt(x, z);
    if (vil) return null;
    const b = this.baseBiome(x, z);
    if (b === 'ocean') return null;
    const th = this.tileHeight(x, z);
    if (th < WATER_LEVEL) return null;
    const slope = this.tileSlope(x, z);
    // special spots in bigger cells
    {
      const cx = Math.floor(x / 120), cz = Math.floor(z / 120);
      if (hash(cx, cz, s + 200) < 0.35) {
        const ex = cx * 120 + 10 + Math.floor(hash(cx, cz, s + 201) * 100), ez = cz * 120 + 10 + Math.floor(hash(cx, cz, s + 202) * 100);
        if (ex === x && ez === z && th > 3) return { kind: 'cave', v: hash(x, z, s + 3) };
      }
      const mx = Math.floor(x / 300), mz = Math.floor(z / 300);
      if (hash(mx, mz, s + 210) < 0.45) {
        const ex = mx * 300 + 20 + Math.floor(hash(mx, mz, s + 211) * 260), ez = mz * 300 + 20 + Math.floor(hash(mx, mz, s + 212) * 260);
        if (ex === x && ez === z && slope < 1.2) return { kind: 'shaft', v: 0 };
      }
      const ox = Math.floor(x / 160), oz = Math.floor(z / 160);
      if (hash(ox, oz, s + 220) < 0.3 || (ox === Math.floor(this.spawnX / 160) && oz === Math.floor(this.spawnZ / 160))) {
        const near = ox === Math.floor(this.spawnX / 160) && oz === Math.floor(this.spawnZ / 160);
        const ex = near ? Math.floor(this.spawnX) - 30 : ox * 160 + 10 + Math.floor(hash(ox, oz, s + 221) * 140);
        const ez = near ? Math.floor(this.spawnZ) + 28 : oz * 160 + 10 + Math.floor(hash(ox, oz, s + 222) * 140);
        for (let k = 0; k < 3; k++) if (x === ex + k * 3 && z === ez + (k % 2) * 2 && slope < 1.5) return { kind: 'oil', v: 0, amount: 100000 };
      }
      const nx = Math.floor(x / 200), nz = Math.floor(z / 200);
      if (hash(nx, nz, s + 230) < 0.35 && dist2(x, z, this.spawnX, this.spawnZ) > 220 * 220) {
        const ex = nx * 200 + 30 + Math.floor(hash(nx, nz, s + 231) * 140), ez = nz * 200 + 30 + Math.floor(hash(nx, nz, s + 232) * 140);
        const n = 2 + Math.floor(hash(nx, nz, s + 233) * 3);
        for (let k = 0; k < n; k++) {
          const a = k * 2.3 + hash(nx, nz, s + 234) * 6;
          if (x === ex + Math.round(Math.cos(a) * 5) && z === ez + Math.round(Math.sin(a) * 5) && slope < 2) return { kind: 'nest', v: k / n };
        }
      }
    }
    if (slope > 1.4) return null;
    // ore patches
    const pcx = Math.floor(x / 80), pcz = Math.floor(z / 80);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const p = this.orePatch(pcx + dx, pcz + dz);
      if (!p) continue;
      const d = Math.sqrt(dist2(x, z, p.x, p.z));
      const r = p.r * (0.8 + 0.35 * this.noise(x, z, 25, 40));
      if (d < r) return { kind: 'ore', ore: p.ore, amount: Math.round(300 + (1 - d / r) * 900), v: hash(x, z, s + 41) };
    }
    const r = hash(x, z, s + 50), v = hash(x, z, s + 51);
    const tree: Record<Biome, [FeatureKind, number]> = {
      forest: [v < 0.3 ? 'pine' : 'tree', 0.1], plains: ['tree', 0.02], desert: ['cactus', 0.012], beach: ['palm', 0.03],
      snow: ['snowtree', 0.06], mountain: ['pine', 0.04], pole: ['tree', 0], ocean: ['tree', 0],
    };
    const [tk, td] = tree[b];
    if (r < td) return { kind: tk, v };
    const rockD = b === 'mountain' ? 0.035 : b === 'desert' ? 0.014 : b === 'pole' ? 0.004 : 0.008;
    if (r < td + rockD) return { kind: 'rock', v };
    if (b === 'plains' || b === 'forest') {
      if (r < td + rockD + 0.04) return { kind: 'flower', v };
      if (r < td + rockD + 0.07) return { kind: 'bush', v };
    }
    return null;
  }

  feature(x: number, z: number): Feature | null {
    x = wrap(x); z = wrap(z);
    const k = key(x, z);
    if (this.removed.has(k)) return null;
    const f = this.baseFeature(x, z);
    if (f && f.kind === 'ore') {
      const left = this.oreLeft.get(k);
      if (left !== undefined) f.amount = left;
    }
    return f;
  }
  /** Features you bump into. */
  blocks(f: Feature | null) {
    return !!f && f.kind !== 'ore' && f.kind !== 'oil' && f.kind !== 'flower' && f.kind !== 'cave' && f.kind !== 'shaft' && f.kind !== 'bush';
  }

  isRoad(x: number, z: number) {
    const v = this.villageAt(x, z);
    return !!v && v.roads.has(key(wrap(Math.floor(x)), wrap(Math.floor(z))));
  }
  /** Village building on this tile. */
  villageBuildingAt(x: number, z: number): VillageBuilding | null {
    const v = this.villageAt(x, z);
    if (!v) return null;
    const tx = Math.floor(x), tz = Math.floor(z);
    for (const b of v.buildings) if (wd(tx, b.x) >= 0 && wd(tx, b.x) < b.w && wd(tz, b.z) >= 0 && wd(tz, b.z) < b.d) return b;
    return null;
  }

  chunkOf(x: number, z: number): [number, number] {
    return [Math.floor(wrap(x) / CHUNK), Math.floor(wrap(z) / CHUNK)];
  }

  // ---------- caves and mine shafts ----------
  cave(id: string): Cave {
    let c = this.caveCache.get(id);
    if (c) return c;
    const [kind, xs, zs] = id.split(':');
    const ex = Number(xs), ez = Number(zs);
    const mine = kind === 'm';
    const N = CAVE_SIZE;
    const s = this.seed + ex * 13 + ez * 7;
    const cells = new Uint8Array(N * N).fill(1);
    const at = (x: number, z: number) => z * N + x;
    if (mine) {
      // straight tunnels with wooden beams, in a grid, with side rooms
      for (let z = 4; z < N - 4; z += 6) for (let x = 2; x < N - 2; x++) cells[at(x, z)] = 0;
      for (let x = 4; x < N - 4; x += 8) {
        const z0 = 4 + Math.floor(hash(x, 1, s) * 6) * 0, z1 = N - 4;
        for (let z = z0; z < z1; z++) if (hash(x, z >> 3, s + 2) < 0.8) cells[at(x, z)] = 0;
      }
      for (let x = 24; x < 25; x++) for (let z = 4; z < N - 1; z++) cells[at(x, z)] = 0;
      for (let z = 4; z < N - 4; z += 6) for (let x = 2; x < N - 2; x += 4) if (cells[at(x, z)] === 0) {
        if (z > 0 && cells[at(x, z - 1)] !== 0) cells[at(x, z - 1)] = 6;
      }
    } else {
      for (let i = 0; i < N * N; i++) cells[i] = hash(i % N, Math.floor(i / N), s) < 0.47 ? 0 : 1;
      for (let it = 0; it < 4; it++) {
        const next = cells.slice();
        for (let z = 1; z < N - 1; z++) for (let x = 1; x < N - 1; x++) {
          let walls = 0;
          for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (cells[at(x + dx, z + dz)] !== 0) walls++;
          next[at(x, z)] = walls >= 5 ? 1 : 0;
        }
        cells.set(next);
      }
      // a sure way in from the exit to the middle
      let x = 24, z = N - 3;
      while (z > 20) {
        for (let dx = -1; dx <= 1; dx++) cells[at(x + dx, z)] = 0;
        z--;
        x += Math.round((hash(x, z, s + 5) - 0.5) * 2);
        x = Math.max(3, Math.min(N - 4, x));
      }
      for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) cells[at(24 + dx, 20 + dz)] = 0;
    }
    // ore in the walls; much richer than outside
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const i = at(x, z);
      if (cells[i] !== 1) continue;
      if (x === 0 || z === 0 || x === N - 1 || z === N - 1) continue;
      const r = hash(x, z, s + 9);
      const near = (dx: number, dz: number) => cells[at(x + dx, z + dz)] === 0;
      if (!(near(1, 0) || near(-1, 0) || near(0, 1) || near(0, -1)) && r > 0.02) continue;
      if (r < (mine ? 0.12 : 0.07)) cells[i] = 2;
      else if (r < (mine ? 0.22 : 0.13)) cells[i] = 3;
      else if (r < (mine ? 0.32 : 0.2)) cells[i] = 4;
      else if (r < (mine ? 0.34 : 0.25)) cells[i] = 5;
    }
    for (let z = N - 3; z < N; z++) for (let dx = -1; dx <= 1; dx++) cells[at(24 + dx, z)] = z === N - 1 ? 1 : 0;
    c = { id, mine, cells, exit: [24.5, N - 2.5], ex, ez };
    this.caveCache.set(id, c);
    return c;
  }
  caveCell(c: Cave, x: number, z: number): CaveCell {
    x = Math.floor(x); z = Math.floor(z);
    if (x < 0 || z < 0 || x >= CAVE_SIZE || z >= CAVE_SIZE) return 1;
    if (this.caveDug.has(`${c.id}|${x},${z}`)) return 0;
    return c.cells[z * CAVE_SIZE + x] as CaveCell;
  }
}
