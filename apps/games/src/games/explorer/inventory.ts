// Stacks of items in slots, used by players, chests, houses and machines.
import { ITEMS, RECIPE, type ItemId } from './data';

export interface Slot { id: ItemId; n: number; }
export type Inv = (Slot | null)[];

export const newInv = (n: number): Inv => Array.from({ length: n }, () => null);
export const stackOf = (id: ItemId) => ITEMS[id]?.stack ?? 50;

export function count(inv: Inv, id: ItemId) {
  let n = 0;
  for (const s of inv) if (s && s.id === id) n += s.n;
  return n;
}

/** Adds what fits; returns what didn't. */
export function add(inv: Inv, id: ItemId, n: number): number {
  if (!ITEMS[id] || n <= 0) return n;
  const max = stackOf(id);
  for (const s of inv) {
    if (n <= 0) break;
    if (s && s.id === id && s.n < max) {
      const k = Math.min(n, max - s.n);
      s.n += k;
      n -= k;
    }
  }
  for (let i = 0; i < inv.length && n > 0; i++) {
    if (!inv[i]) {
      const k = Math.min(n, max);
      inv[i] = { id, n: k };
      n -= k;
    }
  }
  return n;
}
export function room(inv: Inv, id: ItemId): number {
  const max = stackOf(id);
  let r = 0;
  for (const s of inv) r += !s ? max : s.id === id ? max - s.n : 0;
  return r;
}

export function remove(inv: Inv, id: ItemId, n: number): boolean {
  if (count(inv, id) < n) return false;
  // take from the back so the hotbar keeps its stacks
  for (let i = inv.length - 1; i >= 0 && n > 0; i--) {
    const s = inv[i];
    if (s && s.id === id) {
      const k = Math.min(n, s.n);
      s.n -= k;
      n -= k;
      if (s.n <= 0) inv[i] = null;
    }
  }
  return true;
}

export function counts(inv: Inv): Map<ItemId, number> {
  const m = new Map<ItemId, number>();
  for (const s of inv) if (s) m.set(s.id, (m.get(s.id) ?? 0) + s.n);
  return m;
}

/**
 * Works out how to make `n` of a recipe from what you have, crafting the parts too (gears, circuits, pipes...).
 * Returns the crafts in order, or null if you're short. `have` is changed as if it were done.
 */
export function plan(have: Map<ItemId, number>, id: string, n: number, depth = 0): { id: string; times: number }[] | null {
  const r = RECIPE[id];
  if (!r) return null;
  const times = Math.ceil(n / r.n);
  const steps: { id: string; times: number }[] = [];
  for (const [inId, k] of r.inp) {
    const need = k * times;
    const got = have.get(inId) ?? 0;
    if (got >= need) { have.set(inId, got - need); continue; }
    if (depth >= 3 || !RECIPE[inId]) return null;
    const sub = plan(have, inId, need - got, depth + 1);
    if (!sub) return null;
    steps.push(...sub);
    const after = have.get(inId) ?? 0;
    if (after < need) return null;
    have.set(inId, after - need);
  }
  steps.push({ id, times });
  have.set(r.out, (have.get(r.out) ?? 0) + r.n * times);
  return steps;
}

/** How many of a recipe you could make right now (up to 99). */
export function craftable(inv: Inv, id: string): number {
  let lo = 0, hi = 1;
  while (hi <= 128 && plan(counts(inv), id, hi * (RECIPE[id]?.n ?? 1))) { lo = hi; hi *= 2; }
  hi = Math.min(hi, 129);
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (plan(counts(inv), id, mid * (RECIPE[id]?.n ?? 1))) lo = mid; else hi = mid;
  }
  return Math.min(99, lo);
}
