import { describe, expect, it } from 'vitest';
import { rollFromGravity, rollToSteer, DEFAULT_SETTINGS } from './tilt';
import { touchToSteer } from './touch';

describe('touch steering', () => {
  it('ignores small movements and saturates at a quarter of the width', () => {
    expect(touchToSteer(5, 400)).toBe(0);
    expect(touchToSteer(100, 400)).toBe(1);
    expect(touchToSteer(-300, 400)).toBe(-1);
    expect(touchToSteer(58, 400)).toBeCloseTo(0.5, 1);
  });
});

describe('tilt steering', () => {
  const g = 9.8;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  // Gravity as Android reports it when the phone is turned clockwise by `deg`.
  const android = (deg: number) => rollFromGravity(-g * Math.sin(rad(deg)), g * Math.cos(rad(deg)));
  // iPhone reports the same thing with both signs flipped.
  const iphone = (deg: number) => rollFromGravity(g * Math.sin(rad(deg)), -g * Math.cos(rad(deg)));

  it('steers right when the phone turns clockwise, on both platforms', () => {
    for (const read of [android, iphone]) {
      const neutral = read(0);
      expect(rollToSteer(read(20), neutral, DEFAULT_SETTINGS)).toBeGreaterThan(0.4);
      expect(rollToSteer(read(-20), neutral, DEFAULT_SETTINGS)).toBeLessThan(-0.4);
      expect(rollToSteer(read(1), neutral, DEFAULT_SETTINGS)).toBe(0);
      expect(rollToSteer(read(80), neutral, DEFAULT_SETTINGS)).toBe(1);
    }
  });

  it('works from a sideways neutral position across the 180 degree seam', () => {
    const neutral = android(178);
    expect(rollToSteer(android(-170), neutral, DEFAULT_SETTINGS)).toBeGreaterThan(0);
  });

  it('can be inverted', () => {
    const neutral = android(0);
    expect(rollToSteer(android(20), neutral, { ...DEFAULT_SETTINGS, invert: true })).toBeLessThan(0);
  });
});
