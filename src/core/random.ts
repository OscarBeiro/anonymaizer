// P13: seeded randomness for the realistic output mode. Math.random is not
// acceptable there — the same document must render the same fake data every
// time it is opened, so everything is derived from the session id.

/** mulberry32: a tiny, fast 32-bit PRNG. Returns floats in [0, 1). */
export const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** FNV-1a over the parts, NUL-joined so ("ab","c") and ("a","bc") differ. */
export const hashSeed = (...parts: string[]): number => {
  let h = 0x811c9dc5;
  const s = parts.join('\u0000');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

export const pick = <T>(rng: () => number, pool: readonly T[]): T => pool[Math.floor(rng() * pool.length)];
