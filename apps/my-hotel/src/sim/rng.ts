// Small seeded random number generator (mulberry32). The state is a plain number so it
// saves with the rest of the hotel and a reload continues the same sequence.
export function nextRandom(state: { seed: number }): number {
  let t = (state.seed = (state.seed + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randomInt(state: { seed: number }, min: number, max: number): number {
  return min + Math.floor(nextRandom(state) * (max - min + 1));
}

export function pick<T>(state: { seed: number }, items: readonly T[]): T {
  return items[Math.floor(nextRandom(state) * items.length)];
}
