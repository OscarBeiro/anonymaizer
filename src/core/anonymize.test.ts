import { describe, expect, it } from 'vitest';
import { anonymize } from './anonymize';
import type { CustomDictionaryRule } from './types';

describe('anonymize', () => {
  it('a custom dictionary term overrides auto-matching', () => {
    const rules: CustomDictionaryRule[] = [
      { id: '1', termOrPattern: 'Project Alpha', replacementType: 'FIXED', isRegex: false },
    ];
    const { mappings, anonymizedText } = anonymize('El proyecto Project Alpha arranca mañana.', rules);
    expect(mappings).toHaveLength(1);
    expect(mappings[0]).toMatchObject({ category: 'CUSTOM', placeholder: '[CUSTOM_1]' });
    expect(anonymizedText).toBe('El proyecto [CUSTOM_1] arranca mañana.');
  });

  it('a dictionary term overlapping a regex hit wins the whole span', () => {
    // "Fernando Olmedo" (dictionary) sits inside the ADDRESS regex hit
    // "Rúa Fernando Olmedo 12, Pontevedra" — dictionary must win outright,
    // dropping the ADDRESS candidate entirely rather than truncating it.
    const rules: CustomDictionaryRule[] = [
      { id: '1', termOrPattern: 'Fernando Olmedo', replacementType: 'FIXED', isRegex: false },
    ];
    const { mappings, anonymizedText } = anonymize('Vivo en Rúa Fernando Olmedo 12, Pontevedra.', rules);

    expect(mappings).toHaveLength(1);
    expect(mappings[0]).toMatchObject({ category: 'CUSTOM', originalText: 'Fernando Olmedo' });
    expect(anonymizedText).toBe('Vivo en Rúa [CUSTOM_1] 12, Pontevedra.');
  });

  it('runs the deterministic + heuristic detectors when there are no rules', () => {
    const { mappings } = anonymize('Mi correo es oscar@example.com.', []);
    expect(mappings.map((m) => m.category)).toEqual(['EMAIL']);
  });
});
