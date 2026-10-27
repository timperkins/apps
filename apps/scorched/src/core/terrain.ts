import type { TerrainType } from './config';
import type { Rng } from './rng';

export type ConcreteTerrain = Exclude<TerrainType, 'random'>;
export const TERRAIN_TYPES: ConcreteTerrain[] = ['hills', 'mountains', 'canyons', 'flat'];

/**
 * Destructible ground stored as a solid/empty mask, one byte per pixel.
 * Row 0 is the top of the screen. Everything below the bottom row counts as bedrock.
 * The map wraps around, so columns off either side are read from the other.
 */
export class Terrain {
  readonly mask: Uint8Array;
  /** Bumped on every change so the renderer knows when to redraw. */
  version = 0;
  private dirtyMin = Infinity;
  private dirtyMax = -Infinity;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.mask = new Uint8Array(width * height);
  }

  static fromHeights(heights: ArrayLike<number>, width: number, height: number): Terrain {
    const t = new Terrain(width, height);
    for (let x = 0; x < width; x++) {
      const top = Math.max(0, Math.min(height, Math.round(heights[x])));
      for (let y = top; y < height; y++) t.mask[y * width + x] = 1;
    }
    return t;
  }

  static generate(type: ConcreteTerrain, rng: Rng, width: number, height: number): Terrain {
    return Terrain.fromHeights(generateHeights(type, rng, width, height), width, height);
  }

  isSolid(x: number, y: number): boolean {
    const xi = this.col(x);
    const yi = Math.floor(y);
    if (yi >= this.height) return true;
    if (yi < 0) return false;
    return this.mask[yi * this.width + xi] === 1;
  }

  /** First solid row in a column, or `height` if the column is empty. */
  surfaceY(x: number): number {
    const xi = this.col(x);
    for (let y = 0; y < this.height; y++) {
      if (this.mask[y * this.width + xi]) return y;
    }
    return this.height;
  }

  /** Removes a disc of dirt. Returns the number of pixels removed. */
  carve(cx: number, cy: number, r: number): number {
    return this.paintCircle(cx, cy, r, 0);
  }

  /** Adds a disc of dirt. */
  addCircle(cx: number, cy: number, r: number): number {
    return this.paintCircle(cx, cy, r, 1);
  }

  /** Makes the ground level at `y` across [x0, x1], used for tank pads. */
  flatten(x0: number, x1: number, y: number): void {
    const top = Math.max(0, Math.min(this.height, Math.round(y)));
    for (let xx = Math.floor(x0); xx <= Math.ceil(x1); xx++) {
      const x = this.col(xx);
      for (let yy = 0; yy < this.height; yy++) this.mask[yy * this.width + x] = yy >= top ? 1 : 0;
    }
    this.version++;
  }

  /** True when no loose dirt is waiting to fall. */
  get settled(): boolean {
    return this.dirtyMax < this.dirtyMin;
  }

  /**
   * Moves every unsupported pixel in the dirty columns down by one row.
   * Returns true if anything moved; once nothing moves the ground is settled.
   */
  settleStep(): boolean {
    if (this.settled) return false;
    const { width: w, height: h, mask } = this;
    let moved = false;
    let newMin = Infinity;
    let newMax = -Infinity;
    for (let x = this.dirtyMin; x <= this.dirtyMax; x++) {
      let colMoved = false;
      for (let y = h - 2; y >= 0; y--) {
        const i = y * w + x;
        if (mask[i] && !mask[i + w]) {
          mask[i] = 0;
          mask[i + w] = 1;
          colMoved = true;
        }
      }
      if (colMoved) {
        moved = true;
        if (x < newMin) newMin = x;
        if (x > newMax) newMax = x;
      }
    }
    this.dirtyMin = newMin;
    this.dirtyMax = newMax;
    if (moved) this.version++;
    return moved;
  }

  /** Drops all loose dirt immediately. */
  settleAll(): void {
    while (this.settleStep()) {
      /* keep going */
    }
  }

  /** The stored column for x, wrapping around the sides. */
  private col(x: number): number {
    const w = this.width;
    return ((Math.floor(x) % w) + w) % w;
  }

  private paintCircle(cx: number, cy: number, r: number, value: 0 | 1): number {
    const { width: w, height: h, mask } = this;
    const x0 = Math.floor(cx - r);
    const x1 = Math.ceil(cx + r);
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(h - 1, Math.ceil(cy + r));
    const r2 = r * r;
    let changed = 0;
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - cy;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        if (dx * dx + dy * dy > r2) continue;
        const i = y * w + this.col(x);
        if (mask[i] !== value) {
          mask[i] = value;
          changed++;
        }
      }
    }
    if (changed > 0) {
      // A circle over the edge dirties columns on both sides.
      if (x0 < 0 || x1 >= w) this.markDirty(0, w - 1);
      else this.markDirty(x0, x1);
      this.version++;
    }
    return changed;
  }

  private markDirty(x0: number, x1: number): void {
    this.dirtyMin = Math.min(this.dirtyMin, x0);
    this.dirtyMax = Math.max(this.dirtyMax, x1);
  }
}

/** Surface height (row of the first dirt pixel) for each column. */
export function generateHeights(type: ConcreteTerrain, rng: Rng, width: number, height: number): Float32Array {
  const out = new Float32Array(width);
  const minTop = height * 0.28;
  const maxTop = height - 14;

  if (type === 'flat') {
    const base = height * rng.range(0.6, 0.75);
    for (let x = 0; x < width; x++) out[x] = base + Math.sin(x / 37) * 1.5;
    return out;
  }

  const params = {
    hills: { base: 0.62, rough: 0.45, decay: 0.5, smooth: 6 },
    mountains: { base: 0.58, rough: 1.1, decay: 0.56, smooth: 1 },
    canyons: { base: 0.52, rough: 0.9, decay: 0.55, smooth: 1 },
  }[type];

  const n = 1025;
  const raw = new Float32Array(n);
  raw[0] = height * (params.base + rng.range(-0.1, 0.1));
  raw[n - 1] = height * (params.base + rng.range(-0.1, 0.1));
  let rough = height * params.rough;
  for (let step = n - 1; step > 1; step >>= 1) {
    for (let i = 0; i + step < n; i += step) {
      const mid = i + step / 2;
      raw[mid] = (raw[i] + raw[i + step]) / 2 + rng.range(-0.5, 0.5) * rough;
    }
    rough *= params.decay;
  }

  for (let x = 0; x < width; x++) {
    const f = (x / (width - 1)) * (n - 1);
    const i = Math.min(n - 2, Math.floor(f));
    out[x] = raw[i] + (raw[i + 1] - raw[i]) * (f - i);
  }

  if (params.smooth > 1) boxBlur(out, params.smooth);

  if (type === 'canyons') {
    // Terrace into mesas with sheer drops.
    const stepH = 26;
    for (let x = 0; x < width; x++) out[x] = Math.round(out[x] / stepH) * stepH;
    boxBlur(out, 2);
  }

  // Fit the heights into the playable band.
  let lo = Infinity;
  let hi = -Infinity;
  for (let x = 0; x < width; x++) {
    lo = Math.min(lo, out[x]);
    hi = Math.max(hi, out[x]);
  }
  if (hi - lo > maxTop - minTop) {
    const scale = (maxTop - minTop) / (hi - lo);
    for (let x = 0; x < width; x++) out[x] = minTop + (out[x] - lo) * scale;
  } else {
    const shift = lo < minTop ? minTop - lo : hi > maxTop ? maxTop - hi : 0;
    for (let x = 0; x < width; x++) out[x] += shift;
  }
  return out;
}

function boxBlur(a: Float32Array, radius: number): void {
  const copy = Float32Array.from(a);
  for (let i = 0; i < a.length; i++) {
    let sum = 0;
    let count = 0;
    for (let k = -radius; k <= radius; k++) {
      const j = i + k;
      if (j >= 0 && j < a.length) {
        sum += copy[j];
        count++;
      }
    }
    a[i] = sum / count;
  }
}
