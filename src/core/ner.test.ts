import { describe, expect, it } from 'vitest';
import { aggregateBioTokens, mapNerEntitiesToSpans, NER_CONFIDENCE_THRESHOLD, type NerEntity, type RawNerToken } from './ner';
import { RUNG } from './types';

describe('aggregateBioTokens', () => {
  it('merges a B-/I- run of the same type into one entity', () => {
    const text = 'Clara Vance works here';
    const tokens: RawNerToken[] = [
      { word: 'Clara', score: 0.99, entity: 'B-PER', index: 0, start: 0, end: 5 },
      { word: 'Vance', score: 0.97, entity: 'I-PER', index: 1, start: 6, end: 11 },
      { word: 'works', score: 0.99, entity: 'O', index: 2, start: 12, end: 17 },
    ];
    const entities = aggregateBioTokens(tokens, text);
    expect(entities).toHaveLength(1);
    expect(entities[0]).toMatchObject({ entityGroup: 'PER', start: 0, end: 11, text: 'Clara Vance' });
    expect(entities[0].score).toBeCloseTo(0.98, 5);
  });

  it('starts a new entity on a new B- even of the same type with no O between', () => {
    const text = 'Ana Beatriz';
    const tokens: RawNerToken[] = [
      { word: 'Ana', score: 0.9, entity: 'B-PER', index: 0, start: 0, end: 3 },
      { word: 'Beatriz', score: 0.9, entity: 'B-PER', index: 1, start: 4, end: 11 },
    ];
    const entities = aggregateBioTokens(tokens, text);
    expect(entities).toHaveLength(2);
  });

  it('closes an entity on a token missing character offsets', () => {
    const text = 'Clara';
    const tokens: RawNerToken[] = [
      { word: 'Clara', score: 0.9, entity: 'B-PER', index: 0, start: 0, end: 5 },
      { word: '[SEP]', score: 0.5, entity: 'O', index: 1 },
    ];
    expect(aggregateBioTokens(tokens, text)).toHaveLength(1);
  });

  it('ignores O tokens entirely', () => {
    const tokens: RawNerToken[] = [{ word: 'the', score: 0.9, entity: 'O', index: 0, start: 0, end: 3 }];
    expect(aggregateBioTokens(tokens, 'the cat')).toHaveLength(0);
  });
});

describe('mapNerEntitiesToSpans', () => {
  it('maps a PER entity to a NAME span', () => {
    const entities: NerEntity[] = [
      { entityGroup: 'PER', score: 0.97, start: 10, end: 21, text: 'Clara Vance' },
    ];
    const spans = mapNerEntitiesToSpans(entities);
    expect(spans).toEqual([
      { start: 10, end: 21, category: 'NAME', text: 'Clara Vance', confidence: 0.97, source: 'ner', rung: RUNG.NER, enabled: true },
    ]);
  });

  it('maps an ORG entity to a COMPANY span', () => {
    const entities: NerEntity[] = [
      { entityGroup: 'ORG', score: 0.91, start: 0, end: 6, text: 'Acme' },
    ];
    const spans = mapNerEntitiesToSpans(entities);
    expect(spans[0]).toMatchObject({ category: 'COMPANY', source: 'ner' });
  });

  it('flags (disables) a hit below the confidence threshold instead of dropping it', () => {
    const entities: NerEntity[] = [
      { entityGroup: 'PER', score: 0.5, start: 0, end: 5, text: 'Mario' },
    ];
    const spans = mapNerEntitiesToSpans(entities);
    expect(spans).toHaveLength(1);
    expect(spans[0].enabled).toBe(false);
  });

  it('enables a hit exactly at the threshold', () => {
    const entities: NerEntity[] = [
      { entityGroup: 'PER', score: NER_CONFIDENCE_THRESHOLD, start: 0, end: 5, text: 'Mario' },
    ];
    expect(mapNerEntitiesToSpans(entities)[0].enabled).toBe(true);
  });

  it('drops an entity group with no category home (LOC, MISC)', () => {
    const entities: NerEntity[] = [
      { entityGroup: 'LOC', score: 0.99, start: 0, end: 6, text: 'Madrid' },
      { entityGroup: 'MISC', score: 0.99, start: 10, end: 15, text: 'Fiesta' },
    ];
    expect(mapNerEntitiesToSpans(entities)).toHaveLength(0);
  });
});
