import { describe, expect, it } from 'vitest';
import { CODE_ALPHABET, isValidCode, normalizeCode, randomCode } from './codes';

describe('room codes', () => {
  it('uses 20 consonants and no vowels', () => {
    expect(CODE_ALPHABET).toHaveLength(20);
    expect(CODE_ALPHABET).not.toMatch(/[AEIOUY]/);
  });

  it('generates valid 4-letter codes', () => {
    for (let i = 0; i < 200; i++) expect(isValidCode(randomCode())).toBe(true);
    expect(randomCode(() => 0)).toBe('BBBB');
    expect(randomCode(() => 0.999)).toBe('ZZZZ');
  });

  it('normalizes typed input', () => {
    expect(normalizeCode(' bc-df9g ')).toBe('BCDF');
    expect(isValidCode('ABCD')).toBe(false);
  });
});
