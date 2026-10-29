import { describe, expect, it } from 'vitest';
import type { NerEntity } from './ner';
import { nerCoverage, offsetNerEntities, planNerWindows, reconcileNerEntities } from './nerWindows';

// One token per whitespace-separated word, like a word-level tokenizer.
const words = (chunk: string): number => chunk.split(/\s+/u).filter(Boolean).length;

describe('planNerWindows', () => {
  it('returns one window when the text fits', () => {
    expect(planNerWindows('one two three', words, { maxTokens: 10 })).toEqual([{ start: 0, end: 13 }]);
  });

  it('keeps every window inside the token budget and covers the whole text', () => {
    const text = Array.from({ length: 1200 }, (_, i) => `w${i}`).join(' ');
    const windows = planNerWindows(text, words, { maxTokens: 100, overlapChars: 40 });
    expect(windows.length).toBeGreaterThan(10);
    for (const { start, end } of windows) expect(words(text.slice(start, end))).toBeLessThanOrEqual(100);
    expect(nerCoverage(text.length, windows)).toMatchObject({ complete: true, coveredChars: text.length });
    expect(windows[windows.length - 1].end).toBe(text.length);
  });

  it('puts sentinels before, after and at the tail of the old 512-token limit inside a window', () => {
    const filler = Array.from({ length: 700 }, () => 'x').join(' ');
    const text = `HEAD ${filler} TAIL`;
    const windows = planNerWindows(text, words, { maxTokens: 510, overlapChars: 60 });
    const holds = (needle: string) => windows.some(({ start, end }) => text.slice(start, end).includes(needle));
    expect(holds('HEAD')).toBe(true);
    expect(holds('TAIL')).toBe(true);
    expect(windows.length).toBeGreaterThan(1);
  });

  it('overlaps consecutive windows so a boundary entity is whole in one of them', () => {
    const text = Array.from({ length: 300 }, (_, i) => `w${i}`).join(' ');
    const windows = planNerWindows(text, words, { maxTokens: 50, overlapChars: 30 });
    for (let i = 1; i < windows.length; i++) expect(windows[i].start).toBeLessThan(windows[i - 1].end);
  });

  it('makes progress on text without whitespace', () => {
    const windows = planNerWindows('x'.repeat(1000), (chunk) => Math.ceil(chunk.length / 10), { maxTokens: 20, overlapChars: 5 });
    expect(nerCoverage(1000, windows).complete).toBe(true);
  });

  it('returns no windows for empty text', () => {
    expect(planNerWindows('', words, { maxTokens: 5 })).toEqual([]);
  });
});

describe('nerCoverage', () => {
  it('reports a gap as incomplete', () => {
    expect(nerCoverage(100, [{ start: 0, end: 40 }, { start: 60, end: 100 }])).toMatchObject({ coveredChars: 80, complete: false });
  });
});

describe('reconcileNerEntities', () => {
  const text = 'Maria Garcia Lopez lives in Madrid';
  const entity = (start: number, end: number, entityGroup: string, score: number): NerEntity =>
    ({ entityGroup, score, start, end, text: text.slice(start, end) });

  it('unites overlapping same-group hits from adjacent windows', () => {
    const result = reconcileNerEntities(text, [entity(0, 12, 'PER', 0.9), entity(6, 18, 'PER', 0.95)]);
    expect(result).toEqual([entity(0, 18, 'PER', 0.95)]);
  });

  it('collapses an exact duplicate seen in two windows', () => {
    expect(reconcileNerEntities(text, [entity(28, 34, 'LOC', 0.9), entity(28, 34, 'LOC', 0.9)])).toHaveLength(1);
  });

  it('keeps the more confident of conflicting groups', () => {
    const result = reconcileNerEntities(text, [entity(0, 5, 'ORG', 0.7), entity(0, 12, 'PER', 0.9)]);
    expect(result.map((item) => item.entityGroup)).toEqual(['PER']);
  });

  it('is deterministic regardless of input order', () => {
    const a = [entity(0, 12, 'PER', 0.9), entity(6, 18, 'PER', 0.95), entity(28, 34, 'LOC', 0.9)];
    expect(reconcileNerEntities(text, [...a].reverse())).toEqual(reconcileNerEntities(text, a));
  });
});

describe('offsetNerEntities', () => {
  it('shifts to document offsets', () => {
    expect(offsetNerEntities([{ entityGroup: 'PER', score: 1, start: 1, end: 3, text: 'ab' }], 10)[0]).toMatchObject({ start: 11, end: 13 });
  });
});
