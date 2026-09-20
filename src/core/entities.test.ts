import { describe, expect, it } from 'vitest';
import { canonicalizeName, clusterNames } from './entities';

describe('canonicalizeName', () => {
  it('is case- and accent-insensitive', () => {
    expect(canonicalizeName('Ester Cuni')).toEqual(canonicalizeName('ESTER CUNI'));
    expect(canonicalizeName('José')).toEqual(canonicalizeName('jose'));
  });

  it('drops particles and honorifics', () => {
    expect(canonicalizeName('D. Mario Prieto')).toEqual(canonicalizeName('Mario Prieto'));
    expect(canonicalizeName('Amélie de la Tour')).toEqual(canonicalizeName('Amélie Tour'));
  });
});

describe('clusterNames', () => {
  it('merges a subset spelling into its superset (report case)', () => {
    const clusters = clusterNames(['Ester Cuni', 'Ester Cuni Peirote', 'CUNI PEIROTE ESTER']);
    expect(clusters).toHaveLength(1);
    expect(clusters[0][0]).toBe('Ester Cuni Peirote'); // canonical: longest
    expect(clusters[0]).toEqual(expect.arrayContaining(['Ester Cuni', 'Ester Cuni Peirote', 'CUNI PEIROTE ESTER']));
  });

  it('does not merge on a single shared token', () => {
    const clusters = clusterNames(['Ester Cuni', 'Ester Vidal']);
    expect(clusters).toHaveLength(2);
  });

  it('keeps unrelated names in separate clusters', () => {
    const clusters = clusterNames(['Oscar Beiro', 'Laura Ferreiro']);
    expect(clusters).toHaveLength(2);
  });

  it('dedups an exact repeat into the same cluster with one entry', () => {
    const clusters = clusterNames(['Oscar Beiro', 'Oscar Beiro']);
    expect(clusters).toEqual([['Oscar Beiro']]);
  });

  it('picks the first-occurring name as canonical when lengths tie', () => {
    const clusters = clusterNames(['Ana Söder', 'Ana Soder']); // accent-insensitive tie
    expect(clusters[0][0]).toBe('Ana Söder');
  });
});
