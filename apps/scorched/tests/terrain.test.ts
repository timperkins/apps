import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { TERRAIN_TYPES, Terrain } from '../src/core/terrain';

const flat = (w: number, h: number, top: number) => Terrain.fromHeights(new Array(w).fill(top), w, h);

describe('Terrain', () => {
  it.each(TERRAIN_TYPES)('generates %s ground inside the playable band', (type) => {
    const t = Terrain.generate(type, new Rng(123), 640, 360);
    for (let x = 0; x < 640; x++) {
      const top = t.surfaceY(x);
      expect(top).toBeGreaterThan(360 * 0.2);
      expect(top).toBeLessThan(360);
    }
  });

  it('is reproducible from a seed', () => {
    const a = Terrain.generate('mountains', new Rng(9), 640, 360);
    const b = Terrain.generate('mountains', new Rng(9), 640, 360);
    expect(a.mask).toEqual(b.mask);
  });

  it('carves a crater', () => {
    const t = flat(100, 100, 50);
    t.carve(50, 50, 10);
    expect(t.isSolid(50, 55)).toBe(false);
    expect(t.surfaceY(50)).toBeGreaterThanOrEqual(59);
    expect(t.surfaceY(20)).toBe(50);
  });

  it('drops floating dirt until it lands', () => {
    const t = flat(100, 100, 80);
    t.addCircle(50, 30, 5);
    expect(t.settled).toBe(false);
    t.settleAll();
    expect(t.settled).toBe(true);
    expect(t.isSolid(50, 30)).toBe(false);
    expect(t.surfaceY(50)).toBeLessThan(80);
    expect(t.surfaceY(50)).toBeGreaterThan(65);
  });

  it('treats below the map as solid bedrock', () => {
    const t = new Terrain(10, 10);
    expect(t.isSolid(5, 10)).toBe(true);
    expect(t.isSolid(-1, 5)).toBe(false);
  });
});
