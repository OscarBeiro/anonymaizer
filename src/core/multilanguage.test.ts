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

// M06-02: Galician institutions, laws, headings and ordinals are not people;
// later mentions of a person are.
const galician = (raw: string) => anonymize(raw, [], DEFAULT_CATEGORY_SETTINGS, [], ['gl', 'es']);
it.each([
  'Departamento de Servizos Sociais',
  'Está escolarizado no CEIP Rosalía de Castro.',
  'O pagamento farase na Caixa Rural Galega.',
  'Revisión no Centro de Saúde de Conxo.',
  'inscrita no Rexistro da Propiedade nº 2 de Vigo',
  'segundo a Lei de Enxuizamento Criminal',
  'CONTRATO DE ARRENDAMENTO DE VIVENDA',
  'ACTA DA XUNTA ORDINARIA DA COMUNIDADE DE PROPIETARIOS',
])('hides nothing personal in %j', (raw) => {
  const result = galician(raw);
  expect(result.mappings.filter(m => ['NAME', 'ID_CODE'].includes(m.category))).toEqual([]);
});

it('hides later mentions of a person and honorific forms', () => {
  const raw = 'Paciente: Antía Varela Souto.\nDurante o ingreso a Antía evoluciona ben. Revisión co Dr. Suárez.';
  const result = galician(raw);
  expect(result.anonymizedText).not.toMatch(/Antía|Suárez/);
});

it('reads a numbered clause and a mid-sentence colon correctly', () => {
  expect(galician('EXPOÑEN\n\nI. Que o local é axeitado.').mappings.filter(m => m.category === 'NAME')).toEqual([]);
  const en = anonymize('Please update the contact for Tom Ellis: his partner.', [], DEFAULT_CATEGORY_SETTINGS, [], ['en']);
  expect(en.anonymizedText).not.toContain('Tom Ellis');
});

it('does not take later mentions from a name candidate that lost to a shield', () => {
  // "Rosalía de Castro" inside the school name is not a person: the school is
  // shielded, so a later "Castro" stays, while the real person is still hidden.
  const raw = 'A alumna Uxía Lema Castiñeira asiste ao CEIP Rosalía de Castro.\nO barrio de Castro queda preto. Uxía chega ás nove.';
  const result = anonymize(raw, [], DEFAULT_CATEGORY_SETTINGS, [], ['gl', 'es']);
  expect(result.anonymizedText).toContain('CEIP Rosalía de Castro');
  expect(result.anonymizedText).toContain('barrio de Castro');
  expect(result.anonymizedText).not.toMatch(/Uxía/);
});
