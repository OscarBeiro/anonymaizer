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
// pipeline, called with the default aggregation_strategy: 'none' so we get
// one BIO-tagged prediction per token rather than per entity.
// P8sec / v2->v4: v4's TokenClassificationPipeline never sets start/end at
// all (upstream has `// TODO: Add support for start and end` — checked in
// node_modules/@huggingface/transformers), unlike v2. computeTokenOffsets
// below reconstructs them from `word` before this shape reaches
// aggregateBioTokens, so start/end stay optional here rather than required.
export interface RawNerToken {
  word: string;
  score: number;
  entity: string; // e.g. 'B-PER', 'I-PER', 'O'
  index: number;
  start?: number;
  end?: number;
}

/**
 * Reconstructs character offsets that v4 no longer provides, by walking
 * `text` left to right and matching each token's decoded `word` in order.
 * A `##`-prefixed token is a WordPiece continuation of the previous token
 * (BERT tokenizer convention) — it is expected to sit immediately after the
 * previous token's end, with no search/whitespace-skipping. A whole-word
 * token is looked up as the next occurrence of `word` at or after the
 * cursor, exact-case first.
 *
 * Exact case is tried first, and only falls back to case-insensitive if
 * that fails, because the pipeline (`ignore_labels: ['O']`, the default)
 * drops every non-entity token — there is no "works"/"at" token in between
 * to advance the cursor past them. A short single-letter token like "A" (a
 * WordPiece's first piece) will then case-insensitively match a lowercase
 * "a" inside an intervening skipped word ("at") before it ever reaches the
 * real, capitalized occurrence. Exact-case search does not have this
 * problem for a cased model like bert-base-NER; the insensitive fallback
 * only exists for a rarer case: decode() normalizing case relative to the
 * source text.
 *
 * A token whose word cannot be located is left with start/end undefined —
 * the cursor does not advance for it — so aggregateBioTokens' existing
 * "flush on missing offsets" behavior still applies, and a later duplicate
 * word is not thrown off by the miss.
 */
export const computeTokenOffsets = (tokens: RawNerToken[], text: string): RawNerToken[] => {
  const lowerText = text.toLowerCase();
  let cursor = 0;

  return tokens.map((token) => {
    const isContinuation = token.word.startsWith('##');
    const piece = isContinuation ? token.word.slice(2) : token.word;
    if (piece === '') return token;

    let start: number;
    if (isContinuation) {
      const matches = text.startsWith(piece, cursor) || lowerText.startsWith(piece.toLowerCase(), cursor);
      if (!matches) return token;
      start = cursor;
    } else {
      const idx = text.indexOf(piece, cursor);
      const idxInsensitive = idx >= 0 ? idx : lowerText.indexOf(piece.toLowerCase(), cursor);
      if (idxInsensitive < 0) return token;
      start = idxInsensitive;
    }

    const end = start + piece.length;
    cursor = end;
    return { ...token, start, end };
  });
};

/**
 * Merges consecutive BIO-tagged tokens of the same type into one entity per
 * span — a 'B-PER' starts an entity (or a bare 'I-PER' with nothing open,
 * which some models emit at a sequence boundary), a following 'I-PER'
 * extends it, and anything else (a different type, 'O', or a token with no
 * character offsets) closes it. An entity's score is the mean of its
 * tokens' scores. Pure and worker-free, same reasoning as
 * mapNerEntitiesToSpans below: testable without transformers.js.
 *
 * P8sec: bert-base-NER under v4 sometimes re-tags a `##`-prefixed WordPiece
 * continuation as a fresh 'B-' instead of 'I-' (observed live: "Acme" ->
 * B-ORG "A", B-ORG "##c", I-ORG "##me"). A `##` token is, by the tokenizer's
 * own convention, never the start of a new word, so it always extends the
 * currently open entity of the same type regardless of its own B/I prefix —
 * only a non-`##` token can start a fresh entity.
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
    const isContinuation = token.word.startsWith('##');
    if ((prefix === 'I' || isContinuation) && current && current.type === type) {
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
