import { describe, expect, it } from 'vitest';
import { getNerModel, modelTotalBytes, NER_MODELS, NYM_LABEL_MAP } from './nerModels';
import { NER_EVAL_DOCS } from './__fixtures__/nerEvalDocs';
import { mapNerEntitiesToSpans, type NerEntity } from './ner';

describe('model registry', () => {
  it('maps or explicitly ignores every label of every model', () => {
    for (const model of NER_MODELS) {
      for (const label of model.labels) {
        expect(model.labelMap[label], `${model.id}: ${label}`).toBeDefined();
      }
      for (const label of Object.keys(model.labelMap)) {
        expect(model.labels.includes(label) || model.id === 'bert-base-ner', `${model.id} maps unknown ${label}`).toBe(true);
      }
    }
  });

  it('gives every ignored label a reason', () => {
    for (const policy of Object.values(NYM_LABEL_MAP)) {
      if ('ignored' in policy) expect(policy.ignored.length).toBeGreaterThan(10);
    }
  });

  it('pins every non-default model to a commit and keeps experimental ones out of default', () => {
    for (const model of NER_MODELS.filter((m) => m.id !== 'bert-base-ner')) {
      expect(model.revision).toMatch(/^[0-9a-f]{40}$/);
      expect(model.status).toBe('experimental');
    }
    expect(NER_MODELS.filter((m) => m.status === 'default')).toHaveLength(1);
  });

  it('totals the complete download, tokenizer included', () => {
    expect(modelTotalBytes(getNerModel('nym-pii-small')!)).toBe(151_127_134);
  });

  it('claims tested languages only where the evaluation fixtures have documents', () => {
    const covered = new Set(NER_EVAL_DOCS.map((doc) => doc.language));
    for (const model of NER_MODELS) for (const language of model.languages.tested) expect(covered.has(language as never)).toBe(true);
  });
});

describe('nym labels become spans', () => {
  const entity = (entityGroup: string, start: number, end: number, text: string): NerEntity => ({ entityGroup, score: 0.95, start, end, text });
  const text = 'María Fernández López, Calle Mayor 12, Madrid';

  it('keeps a city as LOCATION, not ADDRESS, and joins a given name with its surname', () => {
    const spans = mapNerEntitiesToSpans([
      entity('GIVEN_NAME', 0, 5, 'María'), entity('SURNAME', 6, 21, 'Fernández López'),
      entity('STREET_ADDRESS', 23, 37, 'Calle Mayor 12'), entity('CITY', 39, 45, 'Madrid'),
    ], 'nym', NYM_LABEL_MAP, {}, text);
    expect(spans.map((s) => [s.category, s.text])).toEqual([
      ['NAME', 'María Fernández López'], ['ADDRESS', 'Calle Mayor 12'], ['LOCATION', 'Madrid'],
    ]);
  });

  it('does not let an ignored label vanish into a category', () => {
    expect(mapNerEntitiesToSpans([entity('GENDER', 0, 5, 'mujer')], 'nym', NYM_LABEL_MAP)).toEqual([]);
  });

  it('keeps digit-only identifiers that the letter rule would drop', () => {
    expect(mapNerEntitiesToSpans([entity('ZIP_CODE', 0, 5, '28001')], 'nym', NYM_LABEL_MAP).map((s) => s.category)).toEqual(['ADDRESS']);
    expect(mapNerEntitiesToSpans([entity('GOVERNMENT_ID', 0, 9, '12345678Z')], 'nym', NYM_LABEL_MAP).map((s) => s.category)).toEqual(['ID_CODE']);
  });

  it('applies a per-model threshold per category', () => {
    const low = { ...entity('PASSWORD', 0, 8, 'hunter22'), score: 0.6 };
    expect(mapNerEntitiesToSpans([low], 'nym', NYM_LABEL_MAP, { SECRET: 0.5 })[0].enabled).toBe(true);
    expect(mapNerEntitiesToSpans([low], 'nym', NYM_LABEL_MAP)[0].enabled).toBe(false);
  });
});
