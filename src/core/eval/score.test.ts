import { describe, expect, it } from 'vitest';
import { formatScorecard, parseLabelled, scoreDocument, summarize } from './score';

describe('parseLabelled', () => {
  it('strips markup and records offsets', () => {
    const doc = parseLabelled('Dona {NAME|Ana Lema}, de {LOCATION?|Lugo}.');
    expect(doc.text).toBe('Dona Ana Lema, de Lugo.');
    expect(doc.gold).toEqual([
      { start: 5, end: 13, category: 'NAME', optional: false, text: 'Ana Lema' },
      { start: 18, end: 22, category: 'LOCATION', optional: true, text: 'Lugo' },
    ]);
  });

  it('rejects unbalanced markup', () => {
    expect(() => parseLabelled('{NAME|Ana')).toThrow(/Unbalanced/);
  });
});

describe('scoreDocument', () => {
  const doc = parseLabelled('{NAME|Ana Lema} vive na {ADDRESS|rúa Nova 3, Lugo}. Concello de {LOCATION?|Lugo}.');

  it('classifies caught, partial and missed', () => {
    const name = { start: 0, end: 8, category: 'NAME' };
    const s = scoreDocument(doc, [name, { start: 29, end: 33, category: 'LOCATION' }]);
    expect(s.gold.map((g) => g.outcome)).toEqual(['caught', 'partial']);
    expect(scoreDocument(doc, []).gold.map((g) => g.outcome)).toEqual(['missed', 'missed']);
  });

  it('ignores whitespace when deciding coverage', () => {
    const split = [{ start: 0, end: 3, category: 'NAME' }, { start: 4, end: 8, category: 'NAME' }];
    expect(scoreDocument(doc, split).gold[0].outcome).toBe('caught');
  });

  it('counts unlabelled hits as over-flags but not optional ones', () => {
    const concello = doc.text.indexOf('Concello');
    const lugo = doc.text.lastIndexOf('Lugo');
    const s = scoreDocument(doc, [
      { start: concello, end: concello + 8, category: 'NAME' },
      { start: lugo, end: lugo + 4, category: 'LOCATION' },
    ]);
    expect(s.overflags).toEqual([{ start: concello, end: concello + 8, category: 'NAME', text: 'Concello' }]);
  });
});

describe('summarize', () => {
  it('totals per category and overall', () => {
    const doc = parseLabelled('{NAME|Ana} e {NAME|Xan} en {ADDRESS|rúa Nova}. Banco');
    const card = summarize([scoreDocument(doc, [
      { start: 0, end: 3, category: 'NAME' },
      { start: doc.text.indexOf('Banco'), end: doc.text.length, category: 'NAME' },
    ])]);
    expect(card.byCategory.NAME).toEqual({ total: 2, caught: 1, partial: 0, missed: 1 });
    expect(card.total).toEqual({ total: 3, caught: 1, partial: 0, missed: 2 });
    expect(card.overflags).toBe(1);
    expect(card.recall).toBeCloseTo(1 / 3);
    expect(formatScorecard(card)).toContain('ALL');
  });
});
