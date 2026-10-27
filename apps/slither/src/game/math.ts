import { WORLD_H, WORLD_W } from './constants';

export interface Vec {
  x: number;
  y: number;
}

export function wrap(v: number, size: number): number {
  return ((v % size) + size) % size;
}

// Shortest signed difference on a wrapping axis.
export function wrapDelta(d: number, size: number): number {
  return d - size * Math.round(d / size);
}

export function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = wrapDelta(bx - ax, WORLD_W);
  const dy = wrapDelta(by - ay, WORLD_H);
  return dx * dx + dy * dy;
}

export function angleDiff(a: number, b: number): number {
  return wrapDelta(a - b, Math.PI * 2);
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

// Small seeded generator so tests and replays are repeatable.
export function makeRng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
