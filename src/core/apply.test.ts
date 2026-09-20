import { describe, expect, it } from 'vitest';
import { applyEnabledMappings } from './apply';
import type { MappingItem } from './types';

const mapping = (partial: Partial<MappingItem> & Pick<MappingItem, 'placeholder' | 'originalText'>): MappingItem => ({
  id: partial.placeholder,
  category: 'NAME',
  confidence: 1,
  source: 'regex',
  enabled: true,
  variants: [partial.originalText],
  ...partial,
});

describe('applyEnabledMappings', () => {
  it('substitutes every enabled mapping', () => {
    const mappings = [
      mapping({ placeholder: '[NAME_1]', originalText: 'Oscar Beiro' }),
      mapping({ placeholder: '[EMAIL_1]', originalText: 'oscar@example.com', category: 'EMAIL' }),
    ];
    const text = 'Hola, soy Oscar Beiro. Mi correo es oscar@example.com.';
    expect(applyEnabledMappings(text, mappings)).toBe(
      'Hola, soy [NAME_1]. Mi correo es [EMAIL_1].',
    );
  });

  it('leaves a disabled mapping untouched', () => {
    const mappings = [mapping({ placeholder: '[COMPANY_1]', originalText: 'TICGAL', category: 'COMPANY', enabled: false })];
    expect(applyEnabledMappings('TICGAL ships this quarter.', mappings)).toBe('TICGAL ships this quarter.');
  });

  it('re-applies a mapping once toggled on', () => {
    const mappings = [mapping({ placeholder: '[COMPANY_1]', originalText: 'TICGAL', category: 'COMPANY', enabled: true })];
    expect(applyEnabledMappings('TICGAL ships this quarter.', mappings)).toBe('[COMPANY_1] ships this quarter.');
  });

  it('replaces the longer text first so it is never partially eaten by a shorter one', () => {
    const mappings = [
      mapping({ placeholder: '[NAME_2]', originalText: 'Ana Martínez' }),
      mapping({ placeholder: '[NAME_1]', originalText: 'Ana' }),
    ];
    const text = 'Ana llamó a Ana Martínez.';
    expect(applyEnabledMappings(text, mappings)).toBe('[NAME_1] llamó a [NAME_2].');
  });
});
