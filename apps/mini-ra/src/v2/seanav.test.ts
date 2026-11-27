import { describe, expect, it } from 'vitest';
import { SeaNav } from './seanav';

// A 40 by 20 cell map, 8 screen pixels to a cell (it wraps round, both ways):
// sea everywhere but two walls of land, down column 20 with a gap in it
// (rows 8 to 11) and down column 0 with a gap (rows 14 to 17), and a lake cut
// off inside a ring of land in the corner.
const NW = 40;
const NH = 20;
const wet = (i: number, j: number) => {
  if (i === 20 && (j < 8 || j > 11)) return false;
  if (i === 0 && (j < 14 || j > 17)) return false;
  if (i >= 2 && i <= 8 && j >= 2 && j <= 8) return !(i === 2 || i === 8 || j === 2 || j === 8);
  return true;
};
const nav = () => new SeaNav(NW, NH, NW * 8, NH * 8, wet);
const px = (i: number, j: number): [number, number] => [(i + 0.5) * 8, (j + 0.5) * 8];

describe('SeaNav', () => {
  it('knows which stretches of water join up', () => {
    const n = nav();
    expect(n.joined(0, ...px(12, 4), ...px(30, 4))).toBe(true); // through the gap
    expect(n.joined(0, ...px(12, 4), ...px(5, 5))).toBe(false); // the lake
    expect(n.joined(0, ...px(5, 5), ...px(6, 6))).toBe(true);
  });

  it('finds the way through the gap and ends on the goal', () => {
    const n = nav();
    const [gx, gy] = px(30, 4);
    const p = n.path(0, ...px(12, 4), gx, gy)!;
    expect(p).not.toBeNull();
    expect(p[p.length - 1]).toEqual([gx, gy]);
    // it bends through the gap rows on the way
    expect(p.some(([, y]) => y >= 8 * 8 && y <= 12 * 8)).toBe(true);
  });

  it('wraps round the edge of the map', () => {
    const n = nav();
    // from near the right edge to near the left: the short way is across the edge
    const p = n.path(0, ...px(38, 15), ...px(1, 15))!;
    expect(p).not.toBeNull();
    const [lx] = p[p.length - 1];
    expect(lx).toBeGreaterThan(NW * 8); // the goal on the next copy over
  });

  it('keeps a big ship out of a gap too narrow for it', () => {
    const n = nav();
    // the gaps are 4 cells tall; a ship keeping far off the shore can't pass
    expect(n.joined(40, ...px(12, 10), ...px(30, 10))).toBe(false);
    expect(n.path(40, ...px(12, 10), ...px(30, 10))).toBeNull();
  });
});
