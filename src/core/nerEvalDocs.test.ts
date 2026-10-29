import { describe, expect, it } from 'vitest';
import { NER_EVAL_DOCS } from './__fixtures__/nerEvalDocs';

describe('evaluation fixtures', () => {
  it('have gold spans inside their text and unique ids', () => {
    expect(new Set(NER_EVAL_DOCS.map((d) => d.id)).size).toBe(NER_EVAL_DOCS.length);
    for (const doc of NER_EVAL_DOCS) {
      expect(doc.gold.length).toBeGreaterThan(0);
      for (const gold of doc.gold) {
        expect(gold.end).toBeLessThanOrEqual(doc.text.length);
        expect(doc.text.slice(gold.start, gold.end)).not.toMatch(/\{\{|\}\}/);
      }
    }
  });

  it('keep tuning and acceptance data separate and cover ES, GL, PT, EN, CA and EU in both', () => {
    for (const split of ['tuning', 'acceptance'] as const) {
      const languages = new Set(NER_EVAL_DOCS.filter((d) => d.split === split).map((d) => d.language));
      for (const language of ['es', 'gl', 'pt', 'en', 'ca', 'eu'] as const) expect(languages.has(language), `${split}/${language}`).toBe(true);
    }
  });
});
