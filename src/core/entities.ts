import { NAME_PARTICLES } from './detectors';

// Honorifics that can precede a name mention without being part of it.
// Stripped the same way NAME_PARTICLES are: they carry no identity of their
// own, so they must not stop "D. Mario Prieto" and "Mario Prieto" clustering
// together.
const NAME_HONORIFICS = ['D.', 'Dª', 'D.ª', 'Sr.', 'Sra.', 'Srta.', 'Don', 'Doña'];

const stripDiacritics = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

const normalizeToken = (token: string): string => stripDiacritics(token).toLowerCase().replace(/\.$/, '');

// NAME_PARTICLES has multi-word forms ("de la", "von der") for the regex's
// sake; canonicalization works word-by-word, so it needs every individual
// word those forms are built from ("de", "la", "von", "der", …) as its own
// skip entry, or a lone "la" in "Amélie de la Tour" would count as
// name-bearing and split the cluster.
const PARTICLE_WORDS = NAME_PARTICLES.flatMap((p) => p.split(/\s+/));

const SKIP_TOKENS = new Set(
  [...PARTICLE_WORDS, ...NAME_HONORIFICS].map(normalizeToken),
);

/**
 * Reduces a NAME span's text to the set of tokens that actually carry
 * identity — accent-insensitive, case-insensitive, particles and honorifics
 * dropped, so "Ester Cuni", "Ester Cuni Peirote" and "CUNI PEIROTE ESTER" all
 * reduce to token sets that compare cleanly regardless of order, case or
 * accents.
 */
export const canonicalizeName = (name: string): Set<string> => {
  const tokens = name.split(/\s+/).filter(Boolean).map(normalizeToken).filter((t) => t && !SKIP_TOKENS.has(t));
  return new Set(tokens);
};

const isSubsetSharingAtLeastTwo = (a: Set<string>, b: Set<string>): boolean => {
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  if (small.size < 2) return false; // a single shared token is too risky to merge on
  for (const token of small) {
    if (!big.has(token)) return false;
  }
  return true;
};

/**
 * Groups NAME spellings that name the same person: one token set is a
 * subset of the other and they share at least two tokens. Sets, not
 * sequences, so word order (a permuted "CUNI PEIROTE ESTER") falls out for
 * free. Returns one array per cluster, canonical spelling first (longest,
 * then first-occurring — ties keep the earlier mention).
 */
export const clusterNames = (names: string[]): string[][] => {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    if (!seen.has(name)) {
      seen.add(name);
      unique.push(name);
    }
  }

  const tokenSets = unique.map(canonicalizeName);
  const parent = unique.map((_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const union = (a: number, b: number): void => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent[rootA] = rootB;
  };

  for (let i = 0; i < unique.length; i++) {
    for (let j = i + 1; j < unique.length; j++) {
      if (isSubsetSharingAtLeastTwo(tokenSets[i], tokenSets[j])) union(i, j);
    }
  }

  const groups = new Map<number, string[]>();
  unique.forEach((name, i) => {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(name);
  });

  return [...groups.values()].map((group) =>
    [...group].sort((a, b) => {
      if (b.length !== a.length) return b.length - a.length;
      return unique.indexOf(a) - unique.indexOf(b);
    }),
  );
};
