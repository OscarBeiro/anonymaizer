import { describe, expect, it } from 'vitest';
import { anonymize, anonymizeWithNer } from './anonymize';
import { applyEnabledMappings } from './apply';
import type { NerEntity } from './ner';
import type { CustomDictionaryRule } from './types';

const entityFor = (text: string, source: string, entityGroup: string, score: number): NerEntity => {
  const start = source.indexOf(text);
  if (start < 0) throw new Error(`fixture text "${text}" not found in "${source}"`);
  return { entityGroup, score, start, end: start + text.length, text };
};

describe('anonymize', () => {
  it('masks the reported dotted NIF despite its incorrect check letter', () => {
    const text = 'Persona evaluada: [[NAME_001]] de identidad: 76.123.312-E ' +
      'Puesto de trabajo: [[CUSTOM_001]]T3 \\[[[JOB_001]]\\] ' +
      'Expediente de referencia: [[ID_CODE_001]] ' +
      'Profesional que informa: [[NAME_002]], Psicóloga General Sanitaria, ' +
      'colegiada [[ID_CODE_002]] Fecha de emisión: 16 de septiembre';

    const { mappings, anonymizedText } = anonymize(text, []);
    expect(mappings.find((m) => m.originalText === '76.123.312-E')).toMatchObject({
      category: 'INVALID_ID',
      placeholder: '[[INVALID_ID_001]]',
      enabled: true,
    });
    expect(anonymizedText).toContain('de identidad: [[INVALID_ID_001]]');
    expect(anonymizedText).not.toContain('76.123.312-E');
    expect(applyEnabledMappings(text, mappings)).toBe(anonymizedText);
  });

  it('a custom dictionary term overrides auto-matching', () => {
    const rules: CustomDictionaryRule[] = [
      { id: '1', termOrPattern: 'Project Alpha', replacementType: 'FIXED', isRegex: false },
    ];
    const { mappings, anonymizedText } = anonymize('El proyecto Project Alpha arranca mañana.', rules);
    expect(mappings).toHaveLength(1);
    expect(mappings[0]).toMatchObject({ category: 'CUSTOM', placeholder: '[[CUSTOM_001]]' });
    expect(anonymizedText).toBe('El proyecto [[CUSTOM_001]] arranca mañana.');
  });

  it('a dictionary term overlapping a regex hit wins the whole span', () => {
    // "Fernando Olmedo" (dictionary) sits inside the ADDRESS regex hit
    // "Rúa Fernando Olmedo 12, Pontevedra" — dictionary must win outright.
    // Once that containing address is dropped, the independent municipality
    // detection remains a LOCATION span.
    const rules: CustomDictionaryRule[] = [
      { id: '1', termOrPattern: 'Fernando Olmedo', replacementType: 'FIXED', isRegex: false },
    ];
    const { mappings, anonymizedText } = anonymize('Vivo en Rúa Fernando Olmedo 12, Pontevedra.', rules);

    expect(mappings).toHaveLength(2);
    expect(mappings[0]).toMatchObject({ category: 'CUSTOM', originalText: 'Fernando Olmedo' });
    expect(mappings[1]).toMatchObject({ category: 'LOCATION', originalText: 'Pontevedra' });
    expect(anonymizedText).toBe('Vivo en Rúa [[CUSTOM_001]] 12, [[LOCATION_001]].');
  });

  it('keeps company and address spans whole when they contain place names', () => {
    const { mappings } = anonymize('empresa Madrid S.L. en Calle Mayor 5, Madrid.', []);
    expect(mappings.map((mapping) => [mapping.category, mapping.originalText])).toEqual([
      ['COMPANY', 'Madrid S.L.'],
      ['ADDRESS', 'Calle Mayor 5, Madrid'],
    ]);
  });

  it('masks a postal code with its city and nearby region and country', () => {
    const { mappings, anonymizedText } = anonymize('36003 Pontevedra, Galicia, España ', []);
    expect(mappings.map((mapping) => [mapping.category, mapping.originalText])).toEqual([
      ['ADDRESS', '36003 Pontevedra'],
      ['LOCATION', 'Galicia'],
      ['LOCATION', 'España'],
    ]);
    expect(anonymizedText).toBe('[[ADDRESS_001]], [[LOCATION_001]], [[LOCATION_002]] ');
  });

  it('runs the deterministic + heuristic detectors when there are no rules', () => {
    const { mappings } = anonymize('Mi correo es oscar@example.com.', []);
    expect(mappings.map((m) => m.category)).toEqual(['EMAIL']);
  });
});

describe('anonymizeWithNer', () => {
  it('supersedes the ALL-CAPS COMPANY guess: the same span comes back enabled with the model\'s real confidence', () => {
    const text = 'el proveedor es TICGAL para este proyecto';
    const entities = [entityFor('TICGAL', text, 'ORG', 0.93)];

    const withoutNer = anonymize(text, []);
    expect(withoutNer.mappings[0]).toMatchObject({ confidence: 0.4, enabled: false, source: 'regex' });

    const { mappings } = anonymizeWithNer(text, [], entities);
    expect(mappings).toHaveLength(1);
    expect(mappings[0]).toMatchObject({ category: 'COMPANY', confidence: 0.93, enabled: true, source: 'ner' });
  });

  it('supersedes the NAME regex heuristic on the same span', () => {
    const text = 'Hoy hablé con Oscar Beiro sobre el proyecto.';
    const entities = [entityFor('Oscar Beiro', text, 'PER', 0.98)];

    const { mappings } = anonymizeWithNer(text, [], entities);
    const nameMappings = mappings.filter((m) => m.category === 'NAME');
    expect(nameMappings).toHaveLength(1);
    expect(nameMappings[0]).toMatchObject({ confidence: 0.98, source: 'ner' });
  });

  it('uses model LOC and GPE entities as LOCATION mappings', () => {
    const text = 'The office moved to Madrid.';
    const entities = [entityFor('Madrid', text, 'LOC', 0.97)];
    const { mappings } = anonymizeWithNer(text, [], entities);
    expect(mappings).toHaveLength(1);
    expect(mappings[0]).toMatchObject({ category: 'LOCATION', originalText: 'Madrid', source: 'ner', confidence: 0.97 });
  });

  it('still loses to a shield — the model cannot know a run of words is a statute title', () => {
    const text = 'Se aplica la Ley de Prevención de Riesgos Laborales en este caso.';
    // A hypothetical over-eager NER false positive on the same citation text.
    const entities = [entityFor('Ley de Prevención de Riesgos Laborales', text, 'ORG', 0.9)];

    const { mappings, anonymizedText } = anonymizeWithNer(text, [], entities);
    expect(mappings.some((m) => m.category === 'COMPANY')).toBe(false);
    expect(anonymizedText).toContain('Ley de Prevención de Riesgos Laborales');
  });

  it('feeds NER NAME spans into the P7c clusterer like any other NAME span', () => {
    const text = 'Firmado por Laura Ferreiro. Contacto: Laura Ferreiro Iglesias.';
    const entities = [
      entityFor('Laura Ferreiro', text, 'PER', 0.95),
      entityFor('Laura Ferreiro Iglesias', text, 'PER', 0.97),
    ];

    const { mappings } = anonymizeWithNer(text, [], entities);
    const nameMappings = mappings.filter((m) => m.category === 'NAME');
    expect(nameMappings).toHaveLength(1);
    expect(nameMappings[0].variants).toEqual(
      expect.arrayContaining(['Laura Ferreiro', 'Laura Ferreiro Iglesias']),
    );
  });
});

describe('reported postal address and company tax ID regression', () => {
  it('sanitises every supplied value by default without downloading a model', () => {
    const text = '36003 Pontevedra, Galicia, España \nCIF/NIF: ESB94165495';
    const { anonymizedText, mappings } = anonymize(text, []);
    for (const value of ['36003', 'Pontevedra', 'Galicia', 'España', 'ESB94165495']) {
      expect(anonymizedText).not.toContain(value);
    }
    expect(mappings).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: 'ADDRESS', originalText: '36003 Pontevedra', enabled: true }),
      expect.objectContaining({ category: 'LOCATION', originalText: 'Galicia', enabled: true }),
      expect.objectContaining({ category: 'LOCATION', originalText: 'España', enabled: true }),
      expect.objectContaining({ category: 'VAT_NUMBER', originalText: 'ESB94165495', enabled: true }),
    ]));
  });
});
