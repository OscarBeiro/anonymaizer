import { describe, expect, it } from 'vitest';
import { aggregateScores, parseAnnotated, scoreDocument } from './nerEval';

describe('parseAnnotated', () => {
  it('strips the markup and records offsets in the clean text', () => {
    const { text, gold } = parseAnnotated('Hola {{NAME|María Pérez}}, vive en {{LOCATION|Vigo}}.');
    expect(text).toBe('Hola María Pérez, vive en Vigo.');
    expect(gold.map((g) => text.slice(g.start, g.end))).toEqual(['María Pérez', 'Vigo']);
    expect(gold.map((g) => g.category)).toEqual(['NAME', 'LOCATION']);
  });
});

describe('scoreDocument', () => {
  const { text, gold } = parseAnnotated('{{NAME|Ana Vidal}} y {{NAME|Luis Mora}} viven en {{LOCATION|Lugo}}.');

  it('counts sensitive characters and exact spans', () => {
    const score = scoreDocument({ text, gold }, [{ start: 0, end: 9 }, { start: 12, end: 21 }, { start: 31, end: 35 }]);
    expect(score).toMatchObject({ sensitiveChars: 20, maskedSensitiveChars: 20, exactSpans: 3, falseMerges: 0, extraChars: 0 });
    expect(score.unmasked).toEqual([]);
  });

  it('reports a partially masked span as unmasked', () => {
    const score = scoreDocument({ text, gold }, [{ start: 0, end: 3 }]);
    expect(score.unmasked.map((u) => u.text)).toContain('Ana Vidal');
  });

  it('flags a span swallowing two gold spans as a false merge and counts the extra characters', () => {
    const score = scoreDocument({ text, gold }, [{ start: 0, end: 21 }]);
    expect(score.falseMerges).toBe(1);
    expect(score.extraChars).toBe(1);
  });
});

describe('aggregateScores', () => {
  it('computes recall per category without letting a pooled score hide a category', () => {
    const a = parseAnnotated('{{NAME|Ana Vidal}} {{ID|12345678Z}}');
    const score = scoreDocument(a, [{ start: 0, end: 9 }]);
    const total = aggregateScores([score]);
    expect(total.perCategoryRecall).toEqual({ NAME: 1, ID: 0 });
    expect(total.sensitiveCharRecall).toBeCloseTo(8 / 17, 5);
  });
});
