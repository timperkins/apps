import { describe, expect, it, beforeAll } from 'vitest';
import { copMultiplier, screenDirToWorld, toScreen } from '../src/iso';
import { T, buildBank, buildCity, tileAt, walkable } from '../src/map';

beforeAll(() => {
  // Game code touches localStorage/AudioContext only through main.ts, so nothing to stub here.
});

describe('iso', () => {
  it('turns screen-up into world up-left', () => {
    const w = screenDirToWorld(0, -1);
    expect(w.x).toBeCloseTo(-Math.SQRT1_2);
    expect(w.y).toBeCloseTo(-Math.SQRT1_2);
  });
  it('round trips a world direction through the screen', () => {
    const s = toScreen(1, 0);
    const w = screenDirToWorld(s.sx, s.sy);
    expect(w.x).toBeCloseTo(1);
    expect(w.y).toBeCloseTo(0);
  });
});

describe('cops get tougher', () => {
  it('is 25% harder every 10 minutes', () => {
    expect(copMultiplier(0)).toBe(1);
    expect(copMultiplier(599)).toBe(1);
    expect(copMultiplier(600)).toBe(1.25);
    expect(copMultiplier(1200)).toBeCloseTo(1.5625);
  });
});

describe('maps', () => {
  it('has a bank, shop, car lot and home door in the city', () => {
    const m = buildCity();
    const places = new Set(m.places.values());
    for (const p of ['bank', 'shop', 'lot', 'home']) expect(places.has(p)).toBe(true);
    const s = m.spawns.player[0];
    expect(walkable(tileAt(m, s.x, s.y), false)).toBe(true);
  });

  it('connects the lobby vent to the vault room through the ducts', () => {
    const m = buildBank();
    const grates: [number, number][] = [];
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.tiles[y * m.w + x] === T.Grate) grates.push([x, y]);
    expect(grates.length).toBe(2);
    // flood fill through vent tiles from the first grate
    const seen = new Set<number>();
    const stack = [grates[0]];
    while (stack.length) {
      const [x, y] = stack.pop()!;
      const i = y * m.w + x;
      if (seen.has(i) || !walkable(tileAt(m, x, y), true)) continue;
      seen.add(i);
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    const [gx, gy] = grates[1];
    expect(seen.has(gy * m.w + gx)).toBe(true);
  });

  it('keeps the vault behind a wall you cannot walk through', () => {
    const m = buildBank();
    const entry = m.spawns.entry[0];
    const seen = new Set<number>();
    const stack: [number, number][] = [[Math.floor(entry.x), Math.floor(entry.y)]];
    while (stack.length) {
      const [x, y] = stack.pop()!;
      const i = y * m.w + x;
      if (seen.has(i) || !walkable(tileAt(m, x, y), false)) continue;
      seen.add(i);
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    // the vault room floor (row 3) is not reachable on foot without unlocking the door
    expect(seen.has(3 * m.w + 5)).toBe(false);
  });
});
