import { describe, expect, it } from 'vitest';
import { countByCategory, summarizeMappings } from './stats';
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

describe('summarizeMappings', () => {
  it('returns zeros and no categories for an empty session', () => {
    expect(summarizeMappings([])).toEqual({ enabled: 0, disabled: 0, byCategory: [] });
  });

  it('splits enabled from disabled and counts categories over enabled mappings only', () => {
    const mappings = [
      mapping('NAME', 'a'),
      mapping('NAME', 'b'),
      { ...mapping('EMAIL', 'c'), enabled: false },
      mapping('COMPANY', 'd'),
    ];
    expect(summarizeMappings(mappings)).toEqual({
      enabled: 3,
      disabled: 1,
      byCategory: [
        { category: 'NAME', count: 2 },
        { category: 'COMPANY', count: 1 },
      ],
    });
  });

  it('drops a category whose mappings are all unticked', () => {
    const mappings = [{ ...mapping('EMAIL', 'a'), enabled: false }];
    expect(summarizeMappings(mappings)).toEqual({ enabled: 0, disabled: 1, byCategory: [] });
  });
});
