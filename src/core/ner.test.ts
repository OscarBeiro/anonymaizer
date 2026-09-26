import { describe, expect, it } from 'vitest';
import { aggregateBioTokens, computeTokenOffsets, mapNerEntitiesToSpans, NER_CONFIDENCE_THRESHOLD, type NerEntity, type RawNerToken } from './ner';
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

  // Live bug 2026-09-26: "Souto" split as "So" + "##uto", the continuation
  // tagged O, and the entity ended mid-word ("Daniel Couso So"), beating the
  // regex's correct full-name span in arbitration.
  it('never ends an entity mid-word when a continuation piece is tagged O', () => {
    const text = 'con Daniel Couso Souto ayer';
    const tokens: RawNerToken[] = [
      { word: 'Daniel', score: 0.99, entity: 'B-PER', index: 0, start: 4, end: 10 },
      { word: 'Couso', score: 0.98, entity: 'I-PER', index: 1, start: 11, end: 16 },
      { word: 'So', score: 0.9, entity: 'I-PER', index: 2, start: 17, end: 19 },
      { word: '##uto', score: 0.6, entity: 'O', index: 3, start: 19, end: 22 },
      { word: 'ayer', score: 0.99, entity: 'O', index: 4, start: 23, end: 27 },
    ];
    const entities = aggregateBioTokens(tokens, text);
    expect(entities).toHaveLength(1);
    expect(entities[0]).toMatchObject({ start: 4, end: 22, text: 'Daniel Couso Souto' });
  });

  it('never starts an entity mid-word either', () => {
    const text = 'Souto firmó';
    const tokens: RawNerToken[] = [
      { word: 'So', score: 0.5, entity: 'O', index: 0, start: 0, end: 2 },
      { word: '##uto', score: 0.9, entity: 'B-PER', index: 1, start: 2, end: 5 },
    ];
    expect(aggregateBioTokens(tokens, text)[0]).toMatchObject({ start: 0, end: 5, text: 'Souto' });
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

  it('extends onto a "##" continuation even when the model re-tags it as a fresh B-', () => {
    // Observed live against bert-base-NER under transformers.js v4: "Acme"
    // came back as B-ORG "A", B-ORG "##c", I-ORG "##me" — a `##` token can
    // never start a new word, so it must still merge.
    const text = 'Acme Corp';
    const tokens: RawNerToken[] = [
      { word: 'A', score: 0.99, entity: 'B-ORG', index: 0, start: 0, end: 1 },
      { word: '##c', score: 0.9, entity: 'B-ORG', index: 1, start: 1, end: 2 },
      { word: '##me', score: 0.99, entity: 'I-ORG', index: 2, start: 2, end: 4 },
      { word: 'Corp', score: 0.99, entity: 'I-ORG', index: 3, start: 5, end: 9 },
    ];
    const entities = aggregateBioTokens(tokens, text);
    expect(entities).toHaveLength(1);
    expect(entities[0]).toMatchObject({ entityGroup: 'ORG', start: 0, end: 9, text: 'Acme Corp' });
  });
});

describe('mapNerEntitiesToSpans', () => {
  // D6: a one-letter or initials-only entity ("G", "G.", "J. M.") is never a
  // maskable name on its own; masking it only leaves noise in the output.
  it.each(['G', 'G.', 'J. M.'])('drops the initials-only entity %s', (text) => {
    const entities: NerEntity[] = [{ entityGroup: 'PER', score: 0.95, start: 0, end: text.length, text }];
    expect(mapNerEntitiesToSpans(entities)).toEqual([]);
  });

  it('keeps a short but real name', () => {
    const entities: NerEntity[] = [{ entityGroup: 'PER', score: 0.95, start: 0, end: 3, text: 'Ana' }];
    expect(mapNerEntitiesToSpans(entities)).toHaveLength(1);
  });

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

describe('computeTokenOffsets', () => {
  // transformers.js v4's TokenClassificationPipeline stopped returning
  // start/end at all (upstream TODO) — this reconstructs them from `word`
  // by walking the original text in order, so aggregateBioTokens keeps
  // working unmodified against real model output.
  it('assigns offsets to plain whole-word tokens in sequence', () => {
    const text = 'John Smith works at Acme';
    const tokens: RawNerToken[] = [
      { word: 'John', score: 0.99, entity: 'B-PER', index: 0 },
      { word: 'Smith', score: 0.99, entity: 'I-PER', index: 1 },
      { word: 'works', score: 0.9, entity: 'O', index: 2 },
    ];
    const withOffsets = computeTokenOffsets(tokens, text);
    expect(withOffsets[0]).toMatchObject({ start: 0, end: 4 });
    expect(withOffsets[1]).toMatchObject({ start: 5, end: 10 });
    expect(withOffsets[2]).toMatchObject({ start: 11, end: 16 });
  });

  it('merges a "##" wordpiece continuation onto the immediately preceding offset', () => {
    const text = 'Acme Corp';
    const tokens: RawNerToken[] = [
      { word: 'A', score: 0.9, entity: 'B-ORG', index: 0 },
      { word: '##c', score: 0.9, entity: 'B-ORG', index: 1 },
      { word: '##me', score: 0.9, entity: 'I-ORG', index: 2 },
      { word: 'Corp', score: 0.9, entity: 'I-ORG', index: 3 },
    ];
    const withOffsets = computeTokenOffsets(tokens, text);
    expect(withOffsets).toMatchObject([
      { start: 0, end: 1 },
      { start: 1, end: 2 },
      { start: 2, end: 4 },
      { start: 5, end: 9 },
    ]);
  });

  it('round-trips through aggregateBioTokens to produce a whole entity', () => {
    const text = 'John Smith works at Acme Corp and his email is john.smith@example.com.';
    const tokens: RawNerToken[] = [
      { word: 'John', score: 0.999, entity: 'B-PER', index: 0 },
      { word: 'Smith', score: 0.999, entity: 'I-PER', index: 1 },
      { word: 'works', score: 0.99, entity: 'O', index: 2 },
      { word: 'at', score: 0.99, entity: 'O', index: 3 },
      { word: 'A', score: 0.999, entity: 'B-ORG', index: 4 },
      { word: '##c', score: 0.9, entity: 'B-ORG', index: 5 },
      { word: '##me', score: 0.999, entity: 'I-ORG', index: 6 },
      { word: 'Corp', score: 0.999, entity: 'I-ORG', index: 7 },
    ];
    const entities = aggregateBioTokens(computeTokenOffsets(tokens, text), text);
    expect(entities).toMatchObject([
      { entityGroup: 'PER', text: 'John Smith' },
      { entityGroup: 'ORG', text: 'Acme Corp' },
    ]);
  });

  it('leaves a token unresolved (no start/end) when its word cannot be found from the cursor', () => {
    const text = 'John Smith';
    const tokens: RawNerToken[] = [
      { word: 'John', score: 0.9, entity: 'B-PER', index: 0 },
      { word: 'Xyz', score: 0.9, entity: 'I-PER', index: 1 },
    ];
    const withOffsets = computeTokenOffsets(tokens, text);
    expect(withOffsets[0]).toMatchObject({ start: 0, end: 4 });
    expect(withOffsets[1].start).toBeUndefined();
    expect(withOffsets[1].end).toBeUndefined();
  });

  it('skips a same-letter, wrong-case match in an intervening dropped word (real model quirk)', () => {
    // ignore_labels: ['O'] (the pipeline default) drops non-entity tokens
    // entirely, so there is no token for "works"/"at" to advance the
    // cursor past them — a naive case-insensitive search for "A" would
    // otherwise match the "a" inside "at" before reaching "Acme".
    const text = 'John Smith works at Acme Corp';
    const tokens: RawNerToken[] = [
      { word: 'John', score: 0.99, entity: 'B-PER', index: 0 },
      { word: 'Smith', score: 0.99, entity: 'I-PER', index: 1 },
      { word: 'A', score: 0.99, entity: 'B-ORG', index: 2 },
      { word: '##c', score: 0.9, entity: 'B-ORG', index: 3 },
      { word: '##me', score: 0.99, entity: 'I-ORG', index: 4 },
      { word: 'Corp', score: 0.99, entity: 'I-ORG', index: 5 },
    ];
    const withOffsets = computeTokenOffsets(tokens, text);
    expect(withOffsets[2]).toMatchObject({ start: 20, end: 21 });
    const entities = aggregateBioTokens(withOffsets, text);
    expect(entities).toMatchObject([
      { entityGroup: 'PER', text: 'John Smith' },
      { entityGroup: 'ORG', text: 'Acme Corp' },
    ]);
  });

  it('matches case-insensitively, since decode() can differ in case from the source text', () => {
    const text = 'MARIA GARCIA';
    const tokens: RawNerToken[] = [{ word: 'Maria', score: 0.9, entity: 'B-PER', index: 0 }];
    expect(computeTokenOffsets(tokens, text)[0]).toMatchObject({ start: 0, end: 5 });
  });

  it('does not regress the cursor when a token is skipped, so a later duplicate word still resolves', () => {
    const text = 'Smith met Smith';
    const tokens: RawNerToken[] = [
      { word: 'Smith', score: 0.9, entity: 'B-PER', index: 0 },
      { word: 'Nope', score: 0.9, entity: 'O', index: 1 },
      { word: 'Smith', score: 0.9, entity: 'B-PER', index: 2 },
    ];
    const withOffsets = computeTokenOffsets(tokens, text);
    expect(withOffsets[0]).toMatchObject({ start: 0, end: 5 });
    expect(withOffsets[2]).toMatchObject({ start: 10, end: 15 });
  });
});
