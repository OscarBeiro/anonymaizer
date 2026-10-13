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

it('does not run Spanish ID or name heuristics for a PT-only profile', () => {
  const spans = runAllDetectors('Paciente Mario Prieto. DNI 12345678A. Calle Mayor 12. Grupo Acme. a@b.com', undefined, pt);
  expect(spans.map(span => span.category)).toEqual(['EMAIL']);
  expect(spans[0].pack).toBe('common');
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
