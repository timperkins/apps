// The land of Emberwild: generated from a seed, then changed by mining and building.
import { B, BEACONS, BLOCKS, G, WORLD, isWater } from './data';

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2(x: number, y: number, s: number) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(x: number, y: number, s: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}

function fbm(x: number, y: number, s: number, oct = 4) {
  let sum = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += valueNoise(x * f, y * f, s + i * 17) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

export interface Poi {
  x: number;
  y: number;
}
export interface ChestPoi extends Poi {
  opened: boolean;
  dist: number;
}
export interface BeaconPoi extends Poi {
  id: string;
  lit: boolean;
  given: Record<string, number>;
}

export class World {
  readonly W = WORLD;
  ground = new Uint8Array(WORLD * WORLD);
  block = new Uint8Array(WORLD * WORLD);
  fog = new Uint8Array(WORLD * WORLD);
  changed = new Set<number>();
  /** Called with the tile index whenever a tile changes after the world is made (co-op sends these on). */
  onChange: (i: number) => void = () => {};
  home: Poi = { x: WORLD / 2, y: WORLD / 2 };
  beacons: BeaconPoi[] = [];
  stones: (Poi & { found: boolean })[] = [];
  chests: ChestPoi[] = [];

  constructor(public seed: number) {
    this.generate();
  }

  idx(x: number, y: number) {
    return y * this.W + x;
  }
  inside(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.W && y < this.W;
  }
  g(x: number, y: number) {
    return this.inside(x, y) ? this.ground[y * this.W + x] : G.DEEP;
  }
  b(x: number, y: number) {
    return this.inside(x, y) ? this.block[y * this.W + x] : B.NONE;
  }
  setB(x: number, y: number, v: number) {
    if (!this.inside(x, y)) return;
    const i = this.idx(x, y);
    this.block[i] = v;
    this.changed.add(i);
    this.onChange(i);
  }
  setG(x: number, y: number, v: number) {
    if (!this.inside(x, y)) return;
    const i = this.idx(x, y);
    this.ground[i] = v;
    this.changed.add(i);
    this.onChange(i);
  }
  solidBlock(x: number, y: number) {
    const b = this.b(x, y);
    return b !== B.NONE && BLOCKS[b].solid;
  }
  biomeName(x: number, y: number) {
    const g = this.g(x, y);
    if (isWater(g)) return 'Lake';
    if (g === G.SNOW) return 'Snowy peaks';
    if (g === G.SAND) return 'Desert';
    if (g === G.FOREST) return 'Deep forest';
    if (g === G.RUIN) return 'Old ruins';
    if (g === G.ROCKY || (g >= G.V_COAL && g <= G.V_CRYSTAL)) return 'Highlands';
    return 'Meadows';
  }

  private generate() {
    const W = this.W, s = this.seed, R = rng(s);
    const cx = W / 2, cy = W / 2;
    const bump = (x: number, y: number, bx: number, by: number, r: number) => {
      const d2 = ((x - bx) ** 2 + (y - by) ** 2) / (r * r);
      return Math.exp(-d2);
    };
    const grove = BEACONS[1], meadow = BEACONS[0];
    for (let y = 0; y < W; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const d = Math.hypot(x - cx, y - cy) / (W / 2);
        let h = fbm(x / 46, y / 46, s) * 0.9 + 0.08;
        h -= Math.max(0, d - 0.78) * 4;
        const fb = bump(x, y, cx, cy, 16);
        h = h * (1 - fb) + 0.05 * fb; // a flat, dry start
        const m = fbm(x / 55, y / 55, s + 101) + bump(x, y, cx + grove.dx, cy + grove.dy, 34) * 0.9 - bump(x, y, cx + meadow.dx, cy + meadow.dy, 22) * 0.8;
        const t = (y / W - 0.5) * 1.9 + fbm(x / 70, y / 70, s + 202) * 0.45;
        const r = hash2(x, y, s + 9);
        let g: number = G.GRASS, b: number = B.NONE;
        if (h < -0.28) g = G.DEEP;
        else if (h < -0.13) g = G.WATER;
        else if (h > 0.34) {
          g = t < -0.32 ? G.SNOW : G.ROCKY;
          b = r < 0.82 ? (t < -0.32 ? B.SNOWROCK : B.ROCK) : B.NONE;
        } else if (t < -0.34) {
          g = G.SNOW;
          b = r < 0.13 ? B.PINE : r < 0.15 ? B.SNOWROCK : B.NONE;
        } else if (t > 0.42) {
          g = G.SAND;
          b = r < 0.025 ? B.CACTUS : r < 0.035 ? B.ROCK : r < 0.042 && h < -0.04 ? B.PALM : B.NONE;
        } else if (h < -0.07) {
          g = G.SAND;
          b = r < 0.02 ? B.PALM : B.NONE;
        } else if (m > 0.12) {
          g = G.FOREST;
          b = r < 0.3 ? (hash2(x, y, s + 3) < 0.6 ? B.TREE : B.PINE) : r < 0.33 ? B.MUSHROOM : r < 0.36 ? B.BUSH : r < 0.37 ? B.ROCK : B.NONE;
        } else {
          b = r < 0.035 ? B.TREE : r < 0.05 ? B.BUSH : r < 0.062 ? B.ROCK : B.NONE;
        }
        this.ground[i] = g;
        this.block[i] = b;
      }
    }

    // ore patches
    const patch = (px: number, py: number, kind: 'coal' | 'copper' | 'iron' | 'crystal', rad: number) => {
      const vein = { coal: G.V_COAL, copper: G.V_COPPER, iron: G.V_IRON, crystal: G.V_CRYSTAL }[kind];
      const blk = { coal: B.COAL, copper: B.COPPER, iron: B.IRON, crystal: B.CRYSTAL }[kind];
      for (let y = py - rad; y <= py + rad; y++)
        for (let x = px - rad; x <= px + rad; x++) {
          if (!this.inside(x, y) || isWater(this.ground[y * W + x])) continue;
          const dd = Math.hypot(x - px, y - py) + hash2(x, y, s + 44) * 1.4;
          if (dd > rad) continue;
          this.ground[y * W + x] = vein;
          this.block[y * W + x] = hash2(x, y, s + 45) < 0.8 ? blk : B.NONE;
        }
    };
    const kinds: ['coal' | 'copper' | 'iron' | 'crystal', number][] = [['coal', 34], ['copper', 28], ['iron', 28], ['crystal', 14]];
    for (const [k, n] of kinds) {
      let placed = 0, tries = 0;
      while (placed < n && tries++ < 4000) {
        const x = Math.floor(R() * W), y = Math.floor(R() * W);
        const g = this.ground[y * W + x];
        if (isWater(g) || Math.hypot(x - cx, y - cy) < 20) continue;
        if (k === 'crystal' && g !== G.SNOW && !(g === G.ROCKY && R() < 0.25)) continue;
        patch(x, y, k, 2 + Math.floor(R() * 3));
        placed++;
      }
    }

    // the starting meadow: cleared, with a little of everything nearby
    for (let y = cy - 7; y <= cy + 7; y++)
      for (let x = cx - 7; x <= cx + 7; x++) {
        if (Math.hypot(x - cx, y - cy) > 7) continue;
        this.ground[y * W + x] = G.GRASS;
        this.block[y * W + x] = B.NONE;
      }
    patch(cx + 11, cy - 7, 'coal', 2);
    patch(cx - 12, cy + 8, 'copper', 2);
    patch(cx + 14, cy + 11, 'iron', 2);
    patch(cx - 6, cy - 16, 'iron', 3);
    patch(cx + 20, cy - 2, 'copper', 3);
    for (let k = 0; k < 40; k++) {
      const a = R() * Math.PI * 2, dist = 8 + R() * 12;
      const x = Math.round(cx + Math.cos(a) * dist), y = Math.round(cy + Math.sin(a) * dist);
      if (this.block[y * W + x] === B.NONE && this.ground[y * W + x] === G.GRASS) this.block[y * W + x] = k % 3 === 0 ? B.ROCK : B.TREE;
    }
    for (let k = 0; k < 5; k++) this.block[(cy + 3 + (k % 2)) * W + cx - 5 + k] = B.BUSH;

    // beacons, ringed by old walls
    for (const def of BEACONS) {
      const p = this.findLand(cx + def.dx, cy + def.dy);
      for (let y = p.y - 7; y <= p.y + 7; y++)
        for (let x = p.x - 7; x <= p.x + 7; x++) {
          if (!this.inside(x, y)) continue;
          const dd = Math.hypot(x - p.x, y - p.y);
          const i = y * W + x;
          if (dd <= 4.6) {
            this.ground[i] = G.RUIN;
            this.block[i] = B.NONE;
          } else if (dd <= 5.6) {
            if (isWater(this.ground[i])) this.ground[i] = G.RUIN;
            const gap = Math.abs(x - p.x) <= 1 || Math.abs(y - p.y) <= 1;
            this.block[i] = gap || hash2(x, y, s) < 0.25 ? B.NONE : B.RUINWALL;
          } else if (dd <= 7 && this.block[i] !== B.NONE && hash2(x, y, s + 1) < 0.5) this.block[i] = B.NONE;
        }
      this.beacons.push({ id: def.id, x: p.x, y: p.y, lit: false, given: {} });
    }

    // waystones
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2 + R() * 0.4, dist = 40 + (k % 3) * 30 + R() * 10;
      const p = this.findLand(Math.round(cx + Math.cos(a) * dist), Math.round(cy + Math.sin(a) * dist));
      this.clear(p.x, p.y, 1);
      this.stones.push({ x: p.x, y: p.y, found: false });
    }

    // treasure chests
    let tries = 0;
    while (this.chests.length < 48 && tries++ < 5000) {
      const x = Math.floor(R() * W), y = Math.floor(R() * W);
      const g = this.ground[y * W + x];
      const dist = Math.hypot(x - cx, y - cy);
      if (isWater(g) || g === G.RUIN || dist < 14) continue;
      if (this.chests.some((c) => Math.abs(c.x - x) + Math.abs(c.y - y) < 18)) continue;
      this.block[y * W + x] = B.NONE;
      this.chests.push({ x, y, opened: false, dist });
    }
  }

  clear(x: number, y: number, r: number) {
    for (let yy = y - r; yy <= y + r; yy++)
      for (let xx = x - r; xx <= x + r; xx++) {
        if (!this.inside(xx, yy)) continue;
        const i = yy * this.W + xx;
        if (this.block[i] !== B.RUINWALL) this.block[i] = B.NONE;
        if (isWater(this.ground[i])) this.ground[i] = G.GRASS;
        this.onChange(i);
      }
  }

  findLand(x: number, y: number): Poi {
    for (let r = 0; r < 60; r++)
      for (let a = 0; a < Math.max(1, r * 8); a++) {
        const t = (a / Math.max(1, r * 8)) * Math.PI * 2;
        const xx = Math.round(x + Math.cos(t) * r), yy = Math.round(y + Math.sin(t) * r);
        if (!this.inside(xx, yy)) continue;
        let ok = true;
        for (let dy = -2; dy <= 2 && ok; dy++) for (let dx = -2; dx <= 2 && ok; dx++) if (isWater(this.g(xx + dx, yy + dy))) ok = false;
        if (ok) return { x: xx, y: yy };
      }
    return { x, y };
  }

  reveal(px: number, py: number, r: number) {
    const x0 = Math.max(0, Math.floor(px - r)), x1 = Math.min(this.W - 1, Math.ceil(px + r));
    const y0 = Math.max(0, Math.floor(py - r)), y1 = Math.min(this.W - 1, Math.ceil(py + r));
    const r2 = r * r;
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) if ((x - px) ** 2 + (y - py) ** 2 <= r2) this.fog[y * this.W + x] = 1;
  }

  // ---- save helpers ----
  diff(): number[] {
    const out: number[] = [];
    for (const i of this.changed) out.push(i, this.ground[i], this.block[i]);
    return out;
  }
  applyDiff(d: number[]) {
    for (let k = 0; k + 2 < d.length; k += 3) {
      this.ground[d[k]] = d[k + 1];
      this.block[d[k]] = d[k + 2];
      this.changed.add(d[k]);
    }
  }
  fogString() {
    // run lengths of alternating 0/1, starting with 0
    const out: number[] = [];
    let cur = 0, run = 0;
    for (let i = 0; i < this.fog.length; i++) {
      if (this.fog[i] === cur) run++;
      else {
        out.push(run);
        cur = this.fog[i];
        run = 1;
      }
    }
    out.push(run);
    return out.join(',');
  }
  loadFog(s: string) {
    let i = 0, cur = 0;
    for (const part of s.split(',')) {
      const n = +part || 0;
      if (cur) this.fog.fill(1, i, Math.min(this.fog.length, i + n));
      i += n;
      cur ^= 1;
    }
  }
}
