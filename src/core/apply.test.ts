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
      mapping({ placeholder: '[[NAME_001]]', originalText: 'Oscar Beiro' }),
      mapping({ placeholder: '[[EMAIL_001]]', originalText: 'oscar@example.com', category: 'EMAIL' }),
    ];
    const text = 'Hola, soy Oscar Beiro. Mi correo es oscar@example.com.';
    expect(applyEnabledMappings(text, mappings)).toBe(
      'Hola, soy [[NAME_001]]. Mi correo es [[EMAIL_001]].',
    );
  });

  it('leaves a disabled mapping untouched', () => {
    const mappings = [mapping({ placeholder: '[[COMPANY_001]]', originalText: 'TICGAL', category: 'COMPANY', enabled: false })];
    expect(applyEnabledMappings('TICGAL ships this quarter.', mappings)).toBe('TICGAL ships this quarter.');
  });

  it('re-applies a mapping once toggled on', () => {
    const mappings = [mapping({ placeholder: '[[COMPANY_001]]', originalText: 'TICGAL', category: 'COMPANY', enabled: true })];
    expect(applyEnabledMappings('TICGAL ships this quarter.', mappings)).toBe('[[COMPANY_001]] ships this quarter.');
  });

  it('replaces the longer text first so it is never partially eaten by a shorter one', () => {
    const mappings = [
      mapping({ placeholder: '[[NAME_002]]', originalText: 'Ana Martínez' }),
      mapping({ placeholder: '[[NAME_001]]', originalText: 'Ana' }),
    ];
    const text = 'Ana llamó a Ana Martínez.';
    expect(applyEnabledMappings(text, mappings)).toBe('[[NAME_001]] llamó a [[NAME_002]].');
  });
});

describe('applyEnabledMappings — non-word edges', () => {
  it('masks a variant that starts or ends in a symbol (MONEY)', () => {
    const out = applyEnabledMappings('Total 1.234,56 € y pérdida (1.200 €).', [
      mapping({ placeholder: '[[MONEY_001]]', originalText: '1.234,56 €', category: 'MONEY' }),
      mapping({ placeholder: '[[MONEY_002]]', originalText: '(1.200 €)', category: 'MONEY' }),
    ]);
    expect(out).toBe('Total [[MONEY_001]] y pérdida [[MONEY_002]].');
  });

  it('still keeps word boundaries on word-edged variants, Unicode-aware', () => {
    const out = applyEnabledMappings('Ana y Análisis; Ángel y Ángeles', [
      mapping({ placeholder: '[[NAME_001]]', originalText: 'Ana' }),
      mapping({ placeholder: '[[NAME_002]]', originalText: 'Ángel' }),
    ]);
    expect(out).toBe('[[NAME_001]] y Análisis; [[NAME_002]] y Ángeles');
  });

  it('uses a custom render function and inserts "$" literally', () => {
    const out = applyEnabledMappings('Ana pagó', [mapping({ placeholder: '[[NAME_001]]', originalText: 'Ana' })], () => '$1 Eva');
    expect(out).toBe('$1 Eva pagó');
  });
});
