import { describe, expect, it } from 'vitest';
import { anonymize, anonymizeWithNer } from './anonymize';
import type { NerEntity } from './ner';
import type { CustomDictionaryRule } from './types';

const entityFor = (text: string, source: string, entityGroup: string, score: number): NerEntity => {
  const start = source.indexOf(text);
  if (start < 0) throw new Error(`fixture text "${text}" not found in "${source}"`);
  return { entityGroup, score, start, end: start + text.length, text };
};

describe('anonymize', () => {
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
    // "Rúa Fernando Olmedo 12, Pontevedra" — dictionary must win outright,
    // dropping the ADDRESS candidate entirely rather than truncating it.
    const rules: CustomDictionaryRule[] = [
      { id: '1', termOrPattern: 'Fernando Olmedo', replacementType: 'FIXED', isRegex: false },
    ];
    const { mappings, anonymizedText } = anonymize('Vivo en Rúa Fernando Olmedo 12, Pontevedra.', rules);

    expect(mappings).toHaveLength(1);
    expect(mappings[0]).toMatchObject({ category: 'CUSTOM', originalText: 'Fernando Olmedo' });
    expect(anonymizedText).toBe('Vivo en Rúa [[CUSTOM_001]] 12, Pontevedra.');
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
