// Terrain, resources and trees. Generated from a seed; resources and trees change as they are mined.

export const WORLD = 256;

export const enum Ground { Grass = 0, Dry = 1, Dirt = 2, Sand = 3, Water = 4 }
export const enum Res { None = 0, Owen = 1, Copper = 2, Coal = 3, Stone = 4 }

export const RES_ITEM = ['', 'owen-ore', 'copper-ore', 'coal', 'stone'] as const;
export const RES_NAME = ['', 'Owen ore', 'Copper ore', 'Coal', 'Stone'];

function hash(x: number, y: number, seed: number): number {
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

export function fbm(x: number, y: number, seed: number, oct = 4): number {
  let v = 0, amp = 0.5, f = 1, total = 0;
  for (let i = 0; i < oct; i++) {
    v += valueNoise(x * f, y * f, seed + i * 101) * amp;
    total += amp;
    amp *= 0.5;
    f *= 2;
  }
  return v / total;
}

export class World {
  seed: number;
  ground = new Uint8Array(WORLD * WORLD);
  res = new Uint8Array(WORLD * WORLD);
  amount = new Uint32Array(WORLD * WORLD);
  tree = new Uint8Array(WORLD * WORLD); // 0 none, 1..4 variant
  /** Bumped when ground-cache chunks must redraw (a tile was depleted). */
  dirtyChunks = new Set<number>();
  /** Set by multiplayer hosts to learn which tiles were mined. */
  changed: Set<number> | null = null;

  constructor(seed: number) {
    this.seed = seed;
    this.generate();
  }

  idx(x: number, y: number) {
    return y * WORLD + x;
  }

  inside(x: number, y: number) {
    return x >= 0 && y >= 0 && x < WORLD && y < WORLD;
  }

  rand(x: number, y: number, k = 0) {
    return hash(x, y, this.seed + 7919 * k);
  }

  private generate() {
    const s = this.seed;
    const c = WORLD / 2;
    for (let y = 0; y < WORLD; y++) {
      for (let x = 0; x < WORLD; x++) {
        const i = this.idx(x, y);
        const d = Math.hypot(x - c, y - c);
        const edge = Math.min(x, y, WORLD - 1 - x, WORLD - 1 - y);
        let w = fbm(x / 28, y / 28, s + 11);
        if (d < 22) w -= (22 - d) / 30; // keep the start dry
        if (edge < 3) w = 1;
        const m = fbm(x / 18, y / 18, s + 23);
        let g: Ground = Ground.Grass;
        if (w > 0.7) g = Ground.Water;
        else if (w > 0.66) g = Ground.Sand;
        else if (m > 0.62) g = Ground.Dirt;
        else if (m > 0.52) g = Ground.Dry;
        this.ground[i] = g;
        if (g !== Ground.Water) {
          const f = fbm(x / 14, y / 14, s + 37);
          const r = hash(x, y, s + 3);
          const forest = f > 0.6 ? 0.45 : f > 0.52 ? 0.08 : 0.006;
          if (d > 7 && r < forest) this.tree[i] = 1 + Math.floor(hash(x, y, s + 5) * 4);
        }
      }
    }
    // Starting patches, then more scattered further out.
    const start: [Res, number, number, number][] = [
      [Res.Owen, 14, -5, 7],
      [Res.Copper, -14, -3, 6],
      [Res.Coal, 3, 13, 5.5],
      [Res.Stone, -10, 12, 4.5],
    ];
    for (const [r, dx, dy, rad] of start) this.patch(r, c + dx, c + dy, rad, 900);
    const kinds = [Res.Owen, Res.Copper, Res.Coal, Res.Stone, Res.Owen, Res.Copper];
    let k = 0;
    for (let tries = 0; tries < 400 && k < 26; tries++) {
      const px = 10 + Math.floor(hash(tries, 1, s + 91) * (WORLD - 20));
      const py = 10 + Math.floor(hash(tries, 2, s + 91) * (WORLD - 20));
      const d = Math.hypot(px - c, py - c);
      if (d < 40) continue;
      if (this.ground[this.idx(px, py)] === Ground.Water) continue;
      const kind = kinds[k % kinds.length];
      this.patch(kind, px, py, 5 + hash(tries, 3, s + 91) * 6, 900 + d * 25);
      k++;
    }
  }

  private patch(kind: Res, cx: number, cy: number, rad: number, rich: number) {
    const s = this.seed + kind * 13;
    for (let y = Math.floor(cy - rad * 1.6); y <= cy + rad * 1.6; y++) {
      for (let x = Math.floor(cx - rad * 1.6); x <= cx + rad * 1.6; x++) {
        if (!this.inside(x, y)) continue;
        const i = this.idx(x, y);
        if (this.ground[i] === Ground.Water) continue;
        const d = Math.hypot(x - cx, y - cy) / rad;
        const n = fbm(x / 4, y / 4, s) * 0.8;
        const v = 1 - d + (n - 0.4);
        if (v <= 0) continue;
        this.res[i] = kind;
        this.amount[i] = Math.max(50, Math.floor(rich * (0.4 + v * 1.6)));
        this.tree[i] = 0;
      }
    }
  }

  /** Removes one unit of resource; returns true if any was there. */
  mineRes(x: number, y: number): boolean {
    const i = this.idx(x, y);
    if (!this.res[i] || !this.amount[i]) return false;
    this.amount[i]--;
    this.changed?.add(i);
    if (this.amount[i] === 0) {
      this.res[i] = Res.None;
      this.dirtyChunks.add(((y >> 5) << 8) | (x >> 5));
    }
    return true;
  }

  walkable(x: number, y: number) {
    if (!this.inside(x, y)) return false;
    const i = this.idx(x, y);
    return this.ground[i] !== Ground.Water && !this.tree[i];
  }

  buildable(x: number, y: number) {
    return this.walkable(x, y);
  }

  serialize() {
    return {
      seed: this.seed,
      res: b64(this.res),
      amount: b64(new Uint8Array(this.amount.buffer)),
      tree: b64(this.tree),
    };
  }

  static load(data: { seed: number; res: string; amount: string; tree: string }): World {
    const w = new World(data.seed);
    w.res.set(unb64(data.res));
    w.amount.set(new Uint32Array(unb64(data.amount).buffer));
    w.tree.set(unb64(data.tree));
    return w;
  }
}

function b64(a: Uint8Array): string {
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < a.length; i += CH) s += String.fromCharCode(...a.subarray(i, i + CH));
  return btoa(s);
}

function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
