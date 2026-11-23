import { describe, expect, it } from 'vitest';
import { STICK_RADIUS, stickValue } from './stick';

describe('stickValue', () => {
  it('ignores tiny movements', () => {
    expect(stickValue(3, 2, 'xy')).toEqual({ x: 0, y: 0 });
  });
  it('reaches full at the rim', () => {
    const v = stickValue(STICK_RADIUS, 0, 'xy');
    expect(v.x).toBeCloseTo(1);
    expect(v.y).toBeCloseTo(0);
  });
  it('drops the vertical part for boats', () => {
    const v = stickValue(STICK_RADIUS, STICK_RADIUS, 'x');
    expect(v).toEqual({ x: 1, y: 0 });
  });
});
