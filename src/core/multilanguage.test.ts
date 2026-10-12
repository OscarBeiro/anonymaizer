import { expect, it } from 'vitest';
import { anonymize } from './anonymize';
import { DEFAULT_CATEGORY_SETTINGS } from './categories';
it('peels Galician greetings, preserves original offsets, and retains Spanish ID detection', () => {
  const raw = 'Saúdos Xoán García. DNI 12345678Z. Boas Tardes.';
  const result = anonymize(raw, [], DEFAULT_CATEGORY_SETTINGS, [], ['gl']);
  const person = result.mappings.find(m => m.category === 'NAME');
  expect(person?.originalText).toBe('Xoán García');
  expect(raw.slice(person!.occurrences![0].start, person!.occurrences![0].end)).toBe('Xoán García');
  expect(result.mappings.some(m => m.category === 'DNI' && m.originalText === '12345678Z')).toBe(true);
  expect(result.anonymizedText).not.toContain('Xoán García');
  expect(result.anonymizedText).toContain('Saúdos');
});
it('adds Galician institution prefixes without changing the legacy default detector profile', () => {
  const raw = 'Colabora coa Deputación Provincial de Pontevedra.';
  const gl = anonymize(raw, [], DEFAULT_CATEGORY_SETTINGS, [], ['gl']);
  expect(gl.mappings.some(m => m.category === 'COMPANY' && m.originalText.startsWith('Deputación'))).toBe(true);
  expect(anonymize(raw, [], DEFAULT_CATEGORY_SETTINGS, [], ['en', 'es'])).toEqual(anonymize(raw, []));
});
