import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, tiltToPosition } from './tilt';

describe('tiltToPosition', () => {
  it('centres the paddle at the calibrated angle and inside the dead zone', () => {
    expect(tiltToPosition(50, 50, DEFAULT_SETTINGS)).toBe(0.5);
    expect(tiltToPosition(51.5, 50, DEFAULT_SETTINGS)).toBe(0.5);
  });

  it('moves up when the top tips away and down when it tips back', () => {
    expect(tiltToPosition(40, 50, DEFAULT_SETTINGS)).toBeLessThan(0.5);
    expect(tiltToPosition(60, 50, DEFAULT_SETTINGS)).toBeGreaterThan(0.5);
  });

  it('reaches the ends at the configured range and clamps beyond it', () => {
    expect(tiltToPosition(20, 50, DEFAULT_SETTINGS)).toBe(0);
    expect(tiltToPosition(80, 50, DEFAULT_SETTINGS)).toBe(1);
    expect(tiltToPosition(120, 50, DEFAULT_SETTINGS)).toBe(1);
  });

  it('can be inverted', () => {
    expect(tiltToPosition(40, 50, { ...DEFAULT_SETTINGS, invert: true })).toBeGreaterThan(0.5);
  });
});
