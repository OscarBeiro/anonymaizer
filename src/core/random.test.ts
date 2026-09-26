import { describe, expect, it } from 'vitest';
import { hashSeed, mulberry32 } from './random';

describe('mulberry32', () => {
  it('is deterministic for a seed and stays in [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 50 }, () => a());
    const seqB = Array.from({ length: 50 }, () => b());
    expect(seqA).toEqual(seqB);
    expect(seqA.every((x) => x >= 0 && x < 1)).toBe(true);
  });

  it('differs between seeds', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe('hashSeed', () => {
  it('is stable and distinguishes its parts', () => {
    expect(hashSeed('abc', 'x')).toBe(hashSeed('abc', 'x'));
    expect(hashSeed('abc', 'x')).not.toBe(hashSeed('abc', 'y'));
    expect(hashSeed('ab', 'cx')).not.toBe(hashSeed('abc', 'x'));
  });
});
