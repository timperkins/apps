import { describe, expect, it } from 'vitest';
import { clearLine, findPath } from './path';

// A wall from y = -60 to y = 60 at x = 0..10, with a gap only round its ends.
const wall = (x: number, y: number) => !(x >= 0 && x <= 10 && Math.abs(y) <= 60);
// A cup open to the left: the goal inside it is reached from behind.
const cup = (x: number, y: number) => {
  const inBox = x >= -40 && x <= 40 && Math.abs(y) <= 40;
  const inside = x >= -40 && x <= 30 && Math.abs(y) <= 30;
  return !inBox || inside;
};

function walk(ok: (x: number, y: number) => boolean, sx: number, sy: number, path: [number, number][]): boolean {
  let [ax, ay] = [sx, sy];
  for (const [bx, by] of path) {
    if (!clearLine(ok, ax, ay, bx, by)) return false;
    [ax, ay] = [bx, by];
  }
  return true;
}

describe('findPath', () => {
  it('goes straight when nothing is in the way', () => {
    expect(findPath(wall, -50, 100, 50, 100)).toEqual([]);
  });

  it('goes round a wall, never through it, and ends at the goal', () => {
    const p = findPath(wall, -30, 0, 40, 0)!;
    expect(p.length).toBeGreaterThan(1);
    expect(p[p.length - 1]).toEqual([40, 0]);
    expect(walk(wall, -30, 0, p)).toBe(true);
  });

  it('finds its way into a cup from the open side', () => {
    const p = findPath(cup, 80, 0, 0, 0)!;
    expect(p[p.length - 1]).toEqual([0, 0]);
    expect(walk(cup, 80, 0, p)).toBe(true);
  });

  it('stops as near as it can to a goal inside a wall', () => {
    const p = findPath(wall, -30, 0, 5, 0)!;
    const [ex, ey] = p[p.length - 1];
    expect(wall(ex, ey)).toBe(true);
    expect(Math.hypot(ex - 5, ey)).toBeLessThan(20);
    expect(walk(wall, -30, 0, p)).toBe(true);
  });

  it('gives up cleanly on a goal sealed off', () => {
    const ring = (x: number, y: number) => {
      const r = Math.hypot(x, y);
      return r < 30 || r > 40;
    };
    const p = findPath(ring, 0, 0, 100, 0);
    // it heads for the edge of its pen nearest the goal, or nowhere
    if (p) expect(walk(ring, 0, 0, p)).toBe(true);
  });
});
