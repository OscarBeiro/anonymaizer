import { describe, expect, it } from 'vitest';
import { applyDictionary } from './dictionary';
import type { CustomDictionaryRule } from './types';

describe('applyDictionary', () => {
  it('resolves a FIXED literal term to a CUSTOM span', () => {
    const rules: CustomDictionaryRule[] = [
      { id: '1', termOrPattern: 'Project Alpha', replacementType: 'FIXED', isRegex: false },
    ];
    const spans = applyDictionary('We discussed Project Alpha yesterday.', rules);
    expect(spans).toHaveLength(1);
    expect(spans[0]).toMatchObject({ text: 'Project Alpha', category: 'CUSTOM', source: 'dictionary' });
  });

  it('resolves a CATEGORY term to its target category', () => {
    const rules: CustomDictionaryRule[] = [
      { id: '1', termOrPattern: 'TICGAL', replacementType: 'CATEGORY', targetCategory: 'PROJECT_NAME', isRegex: false },
    ];
    const spans = applyDictionary('TICGAL ships this quarter.', rules);
    expect(spans[0]).toMatchObject({ category: 'PROJECT_NAME' });
  });

  it('supports a regex term', () => {
    const rules: CustomDictionaryRule[] = [
      { id: '1', termOrPattern: 'PRJ-\\d+', replacementType: 'FIXED', isRegex: true },
    ];
    const spans = applyDictionary('ticket PRJ-1234 is open', rules);
    expect(spans[0]?.text).toBe('PRJ-1234');
  });

  it('escapes regex metacharacters in a literal term', () => {
    const rules: CustomDictionaryRule[] = [
      { id: '1', termOrPattern: 'a.b(c)', replacementType: 'FIXED', isRegex: false },
    ];
    expect(applyDictionary('a.b(c) present, aXbYc) absent', rules)).toHaveLength(1);
  });

  it('matches every occurrence of a literal term', () => {
    const rules: CustomDictionaryRule[] = [
      { id: '1', termOrPattern: 'Alpha', replacementType: 'FIXED', isRegex: false },
    ];
    const spans = applyDictionary('Alpha, Alpha, Alpha', rules);
    expect(spans).toHaveLength(3);
  });
});
