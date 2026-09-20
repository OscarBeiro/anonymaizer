import { describe, expect, it } from 'vitest';
import { countByCategory } from './stats';
import type { MappingItem } from './types';

const mapping = (category: string, id: string): MappingItem => ({
  id,
  originalText: id,
  placeholder: `[[${category}_001]]`,
  category,
  confidence: 1,
  source: 'regex',
  enabled: true,
  variants: [id],
});

describe('countByCategory', () => {
  it('returns an empty list for no mappings', () => {
    expect(countByCategory([])).toEqual([]);
  });

  it('counts one mapping per category, sorted by count descending', () => {
    const mappings = [
      mapping('NAME', 'a'),
      mapping('NAME', 'b'),
      mapping('EMAIL', 'c'),
      mapping('COMPANY', 'd'),
      mapping('COMPANY', 'e'),
      mapping('COMPANY', 'f'),
    ];
    expect(countByCategory(mappings)).toEqual([
      { category: 'COMPANY', count: 3 },
      { category: 'NAME', count: 2 },
      { category: 'EMAIL', count: 1 },
    ]);
  });

  it('breaks a count tie alphabetically by category', () => {
    const mappings = [mapping('NAME', 'a'), mapping('EMAIL', 'b')];
    expect(countByCategory(mappings)).toEqual([
      { category: 'EMAIL', count: 1 },
      { category: 'NAME', count: 1 },
    ]);
  });

  it('counts a clustered NAME mapping once, not per variant', () => {
    const clustered: MappingItem = { ...mapping('NAME', 'a'), variants: ['Ester Cuni', 'Ester Cuni Peirote'] };
    expect(countByCategory([clustered])).toEqual([{ category: 'NAME', count: 1 }]);
  });
});
