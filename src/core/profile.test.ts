import { expect, it } from 'vitest';
import { anonymize, anonymizeWithNer } from './anonymize';
import { runAllDetectors, runDeterministicDetectors, runHeuristicDetectors, runShieldDetectors } from './detectors';
import { runDetectionPipeline } from './pipeline';
import { CLINICAL_REPORT_FIXTURE } from './__fixtures__/clinicalReport';
import { DEFAULT_PROFILE, type DetectionProfile } from './packs/profile';
import { mapNerEntitiesToSpans } from './ner';

const pt: DetectionProfile = { languages: ['pt'], jurisdictions: ['PT'] };
const es: DetectionProfile = { languages: ['es'], jurisdictions: ['ES'] };

it('keeps the default profile compatible with existing language-array callers', () => {
  const text = 'Dear Clara Vance. DNI 12345678Z. Calle Mayor 12. Grupo Acme. 100 €';
  expect(anonymize(text, [], undefined, [], DEFAULT_PROFILE)).toEqual(anonymize(text, []));
  expect(anonymize(text, [], undefined, [], ['en', 'es'])).toEqual(anonymize(text, []));
});

it('preserves legacy mappings and substitution across the clinical fixture and mixed rules', () => {
  for (const text of [CLINICAL_REPORT_FIXTURE, 'Dear Clara Vance. Grupo Acme S.L. DNI 12345678Z. Calle Mayor 12. 2026.09.18 13:42:10. 100 €. TICGAL']) {
    const legacy = runDetectionPipeline(text, [
      ...runShieldDetectors(text), ...runDeterministicDetectors(text), ...runHeuristicDetectors(text),
    ]);
    expect(anonymize(text, [])).toEqual(legacy);
  }
});

it('does not run Spanish ID or address detectors for a PT-only profile', () => {
  const spans = runAllDetectors('Paciente Mario Prieto. DNI 12345678A. Calle Mayor 12. a@b.com', undefined, pt);
  const categories = spans.map(span => span.category);
  expect(categories).toContain('EMAIL');
  expect(categories).not.toContain('INVALID_ID');
  expect(categories).not.toContain('ADDRESS');
  expect(spans.find(span => span.category === 'EMAIL')?.pack).toBe('common');
});

it('runs the Portuguese jurisdiction: NIF, Cartão de Cidadão, phones and addresses', () => {
  const text = 'NIF 123456789. CC 00000000 0 ZZ4. Tel 912 345 678. Rua das Flores 45, 4000-123 Porto.';
  const spans = runAllDetectors(text, undefined, pt);
  expect(spans.map(span => [span.category, span.text])).toEqual(expect.arrayContaining([
    ['NIF', '123456789'], ['CARTAO_CIDADAO', '00000000 0 ZZ4'], ['PHONE', '912 345 678'],
  ]));
  expect(spans.some(span => span.category === 'ADDRESS' && span.text.startsWith('Rua das Flores'))).toBe(true);
  expect(spans.filter(span => span.pack === 'PT').length).toBeGreaterThanOrEqual(4);
});

it.each([
  ['ca', 'Estimat Joan Puig i Ferrer, de Ajuntament de Girona. Carrer Major 12. DNI 12345678Z.'],
  ['eu', 'Kaixo Mikel Etxeberria Goikoetxea, Donostiako Udala. DNI 12345678Z.'],
])('applies the Spanish jurisdiction to %s documents', (language, text) => {
  const spans = runAllDetectors(text, undefined, { languages: [language as 'ca' | 'eu'], jurisdictions: ['ES'] });
  expect(spans.map(span => span.category)).toContain('DNI');
  expect(spans.some(span => span.category === 'NAME' || span.category === 'COMPANY')).toBe(true);
});

it('keeps checksummed IDs broad while gating invalid-ID guesses by jurisdiction', () => {
  const spans = runAllDetectors('12345678Z 12345678A', undefined, pt);
  expect(spans).toEqual([expect.objectContaining({ category: 'DNI', text: '12345678Z', pack: 'ES' })]);
  expect(runAllDetectors('12345678Z', { DNI: false }, pt)).toEqual([]);
});

it('keeps language and jurisdiction independent', () => {
  const spans = runAllDetectors('Saúdos Xoán García. DNI 12345678A.', undefined, { languages: ['gl'], jurisdictions: ['ES'] });
  expect(spans).toEqual(expect.arrayContaining([
    expect.objectContaining({ category: 'INVALID_ID', pack: 'ES' }),
    expect.objectContaining({ category: 'NAME', text: 'Xoán García', packs: ['gl'] }),
  ]));
  expect(runAllDetectors('DNI 12345678A', undefined, { languages: ['es'], jurisdictions: [] })).toEqual([]);
});

it('keeps category switches above pack selection', () => {
  expect(runAllDetectors('DNI 12345678A. Juan Pérez. a@b.com', { INVALID_ID: false, NAME: false, EMAIL: false }, es)).toEqual([]);
});

it('does not turn empty English shield vocabularies into unrestricted matches', () => {
  const spans = runAllDetectors('Clara Vance. Grupo Acme. Ley Orgánica. Hacienda.', undefined, { languages: ['en'], jurisdictions: [] });
  expect(spans.some(span => span.shield)).toBe(false);
  expect(spans.some(span => span.category === 'COMPANY')).toBe(false);
  expect(spans).toContainEqual(expect.objectContaining({ category: 'NAME', text: 'Clara Vance', packs: ['en'] }));
});

it('keeps checksum-validated IDs above overlapping model spans', () => {
  const text = '12345678Z';
  const entities = [{ text, start: 0, end: text.length, entityGroup: 'PER', score: 0.99 }];
  expect(anonymizeWithNer(text, [], entities, undefined, [], es).mappings[0].category).toBe('DNI');
});

it('preserves model recall for ambiguous common-word names and unsupported rule languages', () => {
  const text = 'Amparo Paz';
  const entities = [{ text, start: 0, end: text.length, entityGroup: 'PER', score: 0.99 }];
  for (const profile of [es, pt]) {
    expect(anonymizeWithNer(text, [], entities, undefined, [], profile).mappings[0]).toMatchObject({ originalText: text, source: 'ner' });
  }
  expect(mapNerEntitiesToSpans(entities)[0].model).toBe('Xenova/bert-base-NER');
  expect(mapNerEntitiesToSpans(entities, 'custom/model')[0].model).toBe('custom/model');
});

it('does not duplicate candidates when packs are repeated', () => {
  const text = 'DNI 12345678Z. Dear Clara Vance.';
  expect(runAllDetectors(text, undefined, { languages: ['en', 'es', 'en'], jurisdictions: ['ES', 'ES'] }))
    .toEqual(runAllDetectors(text, undefined, DEFAULT_PROFILE));
});
