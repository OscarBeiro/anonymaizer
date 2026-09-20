import { describe, expect, it } from 'vitest';
import { reverseText } from './reverse';
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

describe('reverseText', () => {
  it('round-trips 100% restoration', () => {
    const mappings = [
      mapping({ placeholder: '[[NAME_001]]', originalText: 'Oscar Beiro' }),
      mapping({ placeholder: '[[EMAIL_001]]', originalText: 'oscar@example.com' }),
    ];
    const aiResponse = 'Hola [[NAME_001]], escríbeme a [[EMAIL_001]] cuando puedas.';
    expect(reverseText(aiResponse, mappings)).toBe(
      'Hola Oscar Beiro, escríbeme a oscar@example.com cuando puedas.',
    );
  });

  it.each([
    ['[[NAME_001]]', 'Oscar Beiro'],
    ['[NAME_001]', 'Oscar Beiro'],
    ['[NAME_1]', 'Oscar Beiro'],
    ['NAME_1', 'Oscar Beiro'],
    ['[NAME 1]', 'Oscar Beiro'],
    ['[Name_1]', 'Oscar Beiro'],
  ])('restores %s formatting variation', (variant, expected) => {
    const mappings = [mapping({ placeholder: '[[NAME_001]]', originalText: 'Oscar Beiro' })];
    expect(reverseText(`Hola ${variant}.`, mappings)).toBe(`Hola ${expected}.`);
  });

  it('never lets [[NAME_001]] eat [[NAME_011]]', () => {
    const mappings = [
      mapping({ placeholder: '[[NAME_001]]', originalText: 'Oscar Beiro' }),
      mapping({ placeholder: '[[NAME_011]]', originalText: 'Laura Fernández' }),
    ];
    const aiResponse = 'Asisten [[NAME_001]] y [[NAME_011]].';
    expect(reverseText(aiResponse, mappings)).toBe('Asisten Oscar Beiro y Laura Fernández.');
  });

  it('replaces every underscore in a multi-underscore placeholder (PROJECT_NAME_001)', () => {
    const mappings = [mapping({ placeholder: '[[PROJECT_NAME_001]]', originalText: 'Odyssey', category: 'PROJECT_NAME' })];
    const aiResponse = 'Ship date for PROJECT NAME 1 is Friday.';
    expect(reverseText(aiResponse, mappings)).toBe('Ship date for Odyssey is Friday.');
  });

  it('does not touch unrelated text containing "Ana" as a substring (e.g. "Análisis")', () => {
    const mappings = [mapping({ placeholder: '[[NAME_001]]', originalText: 'Ana' })];
    const aiResponse = 'El análisis de [[NAME_001]] fue positivo.';
    expect(reverseText(aiResponse, mappings)).toBe('El análisis de Ana fue positivo.');
  });

  it('skips disabled mappings', () => {
    const mappings = [mapping({ placeholder: '[[NAME_001]]', originalText: 'Oscar Beiro', enabled: false })];
    expect(reverseText('Hola [[NAME_001]].', mappings)).toBe('Hola [[NAME_001]].');
  });

  it('escapes regex metacharacters in the category name', () => {
    const mappings = [mapping({ placeholder: '[[A.B_001]]', originalText: 'secret', category: 'A.B' })];
    // A literal "." must not act as a wildcard: "AXB_001" must not match.
    expect(reverseText('[[AXB_001]] and [[A.B_001]]', mappings)).toBe('[[AXB_001]] and secret');
  });
});
