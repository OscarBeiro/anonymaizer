import { RUNG, type DetectedSpan } from './types';

// One token-classification result from the worker's pipeline() call, using
// transformers.js' aggregation_strategy: 'simple' shape. Kept minimal and
// framework-free so this file never imports transformers.js — the
// model only ever runs in src/workers/ner.worker.ts.
export interface NerEntity {
  entityGroup: string; // 'PER' | 'ORG' | 'LOC' | 'MISC' | ...
  score: number;
  start: number;
  end: number;
  text: string;
}

// Below this, a hit is still offered (so it's visible for manual review) but
// starts disabled — the same convention the ALL-CAPS COMPANY guess (P1b)
// already uses for a low-confidence heuristic.
export const NER_CONFIDENCE_THRESHOLD = 0.8;

// One raw per-token result from transformers.js' token-classification
// pipeline (this installed version has no aggregation_strategy option, so
// the model returns one BIO-tagged prediction per token, not per entity).
export interface RawNerToken {
  word: string;
  score: number;
  entity: string; // e.g. 'B-PER', 'I-PER', 'O'
  index: number;
  start?: number;
  end?: number;
}

/**
 * Merges consecutive BIO-tagged tokens of the same type into one entity per
 * span — a 'B-PER' starts an entity (or a bare 'I-PER' with nothing open,
 * which some models emit at a sequence boundary), a following 'I-PER'
 * extends it, and anything else (a different type, 'O', or a token with no
 * character offsets) closes it. An entity's score is the mean of its
 * tokens' scores. Pure and worker-free, same reasoning as
 * mapNerEntitiesToSpans below: testable without transformers.js.
 */
export const aggregateBioTokens = (tokens: RawNerToken[], text: string): NerEntity[] => {
  const entities: NerEntity[] = [];
  let current: { type: string; start: number; end: number; scores: number[] } | null = null;

  const flush = (): void => {
    if (!current) return;
    entities.push({
      entityGroup: current.type,
      score: current.scores.reduce((a, b) => a + b, 0) / current.scores.length,
      start: current.start,
      end: current.end,
      text: text.slice(current.start, current.end),
    });
    current = null;
  };

  for (const token of tokens) {
    const dash = token.entity.indexOf('-');
    const prefix = dash < 0 ? null : token.entity.slice(0, dash);
    const type = dash < 0 ? null : token.entity.slice(dash + 1);

    if (token.start === undefined || token.end === undefined || !type) {
      flush();
      continue;
    }
    if (prefix === 'I' && current && current.type === type) {
      current.end = token.end;
      current.scores.push(token.score);
    } else {
      flush();
      current = { type, start: token.start, end: token.end, scores: [token.score] };
    }
  }
  flush();

  return entities;
};

// Only PER and ORG map onto this app's categories — they're what the two
// heuristics NER is meant to supersede (NAME regex, ALL-CAPS COMPANY guess)
// actually detect. LOC/MISC have no P1b heuristic equivalent to supersede and
// no clear category home yet, so they're left for the ladder's other
// detectors (ADDRESS, dictionary rules) rather than guessed at here.
const ENTITY_GROUP_TO_CATEGORY: Record<string, 'NAME' | 'COMPANY' | undefined> = {
  PER: 'NAME',
  ORG: 'COMPANY',
};

/**
 * Turns raw NER output into §4a candidate spans. Pure and model-free — takes
 * already-run entities, so it can be tested (and is tested) without ever
 * loading transformers.js or an ONNX model.
 */
export const mapNerEntitiesToSpans = (entities: NerEntity[]): DetectedSpan[] =>
  entities.flatMap((entity) => {
    const category = ENTITY_GROUP_TO_CATEGORY[entity.entityGroup];
    if (!category) return [];
    return [{
      start: entity.start,
      end: entity.end,
      category,
      text: entity.text,
      confidence: entity.score,
      source: 'ner',
      rung: RUNG.NER,
      enabled: entity.score >= NER_CONFIDENCE_THRESHOLD,
    }];
  });
