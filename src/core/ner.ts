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
  // toLowerCase can change a string's length (e.g. 'İ'); only trust the
  // case-insensitive copy when offsets still line up with the source.
  const lowerText = text.toLowerCase().length === text.length ? text.toLowerCase() : text;
  let cursor = 0;
  let previousIndex = Number.NEGATIVE_INFINITY;

  return tokens.map((token) => {
    const isContinuation = token.word.startsWith('##');
    // Sentencepiece-family tokenizers mark a word start with a leading space or
    // '▁' instead of marking continuations with '##'.
    const piece = isContinuation ? token.word.slice(2) : token.word.replace(/^[\s\u2581]+/u, '');
    if (piece === '') {
      // A whitespace-only token: give it the whitespace it stands for, so an
      // entity that spans it (a street and its number) is not cut in two.
      if (token.word === '') return token;
      let end = cursor;
      while (end < text.length && /\s/u.test(text[end]) && end - cursor < token.word.length) end++;
      if (end === cursor) return token;
      const spanned = { ...token, start: cursor, end };
      cursor = end;
      previousIndex = token.index;
      return spanned;
    }

    // The previous token sits at the previous index, so this one follows it
    // directly (after whitespace only): never search past text that holds
    // another token, which is what pointed a repeated word at its first copy.
    const contiguous = token.index === previousIndex + 1;
    previousIndex = token.index;
    let start = -1;
    if (contiguous) {
      let at = cursor;
      if (!isContinuation) while (at < text.length && /\s/u.test(text[at])) at++;
      if (text.startsWith(piece, at) || lowerText.startsWith(piece.toLowerCase(), at)) start = at;
    }
    if (start < 0) {
      // No adjacent token to anchor on (dropped words, or a decode that does
      // not match the source): search forward from the cursor.
      if (isContinuation) {
        const matches = text.startsWith(piece, cursor) || lowerText.startsWith(piece.toLowerCase(), cursor);
        if (!matches) return token;
        start = cursor;
      } else {
        const idx = text.indexOf(piece, cursor);
        start = idx >= 0 ? idx : lowerText.indexOf(piece.toLowerCase(), cursor);
        if (start < 0) return token;
      }
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
const WORD_CHAR = /[\p{L}\p{M}\p{N}]/u;

export const aggregateBioTokens = (tokens: RawNerToken[], text: string): NerEntity[] => {
  const entities: NerEntity[] = [];
  let current: { type: string; start: number; end: number; scores: number[] } | null = null;
  let previousIndex = Number.NEGATIVE_INFINITY;

  const flush = (): void => {
    if (!current) return;
    // A word is never half a name: snap both edges out to word boundaries, so
    // a continuation piece the model tagged O ("So" + "##uto" -> "So") can't
    // leave a truncated span that outranks the regex's full one in arbitration.
    while (current.start > 0 && WORD_CHAR.test(text[current.start - 1])) current.start--;
    while (current.end < text.length && WORD_CHAR.test(text[current.end])) current.end++;
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
      previousIndex = token.index;
      continue;
    }
    const isContinuation = token.word.startsWith('##');
    // Tokens the pipeline dropped (non-entity words) leave a hole in the
    // indices: an I- tag after a hole is a new entity, not a continuation.
    const adjacent = token.index === previousIndex + 1;
    previousIndex = token.index;
    if ((prefix === 'I' || isContinuation) && current && current.type === type && adjacent) {
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

// What a model's label type means to the anonymizer. A label is either mapped
// to a category or explicitly ignored, with the reason; a label in neither
// list is a bug (see nerModels.test.ts), never a silent drop.
export type NerLabelPolicy = { category: string } | { ignored: string };
export type NerLabelMap = Readonly<Record<string, NerLabelPolicy>>;

// PER, ORG and LOC/GPE have category homes. MISC remains unmapped because it
// combines unrelated entity kinds without a useful anonymization category.
export const BERT_LABEL_MAP: NerLabelMap = {
  PER: { category: 'NAME' },
  ORG: { category: 'COMPANY' },
  LOC: { category: 'LOCATION' },
  GPE: { category: 'LOCATION' },
  MISC: { ignored: 'mixes unrelated entity kinds' },
};

// Categories whose neighbours form one thing: "María" + "Fernández López",
// "Calle Mayor" + "12". Joined only across plain whitespace.
const JOINABLE_CATEGORIES = new Set(['NAME', 'ADDRESS']);

/**
 * Turns raw NER output into §4a candidate spans. Pure and model-free — takes
 * already-run entities, so it can be tested (and is tested) without ever
 * loading transformers.js or an ONNX model.
 *
 * `thresholds` lets a model set its own confidence cut per category; the
 * default is the one 0.8 the BERT model was tuned with.
 */
export const mapNerEntitiesToSpans = (
  entities: NerEntity[],
  model = 'Xenova/bert-base-NER',
  labelMap: NerLabelMap = BERT_LABEL_MAP,
  thresholds: Readonly<Record<string, number>> = {},
  text?: string,
): DetectedSpan[] => {
  const spans = entities.flatMap((entity): DetectedSpan[] => {
    const policy = labelMap[entity.entityGroup];
    if (!policy || !('category' in policy)) return [];
    const category = policy.category;
    // D6: "G", "G.", "J. M." — no word of two or more letters, so nothing a
    // placeholder could meaningfully stand for. Digit-led codes are exempt.
    if (category === 'NAME' || category === 'COMPANY' || category === 'LOCATION') {
      if (!/\p{L}{2,}/u.test(entity.text)) return [];
    }
    const threshold = thresholds[category] ?? NER_CONFIDENCE_THRESHOLD;
    const confident = entity.score >= threshold;
    return [{
      start: entity.start,
      end: entity.end,
      category,
      text: entity.text,
      confidence: entity.score,
      source: 'ner',
      model,
      // Below the threshold the hit starts disabled, and its rung keeps it
      // from displacing an enabled heuristic it merely overlaps.
      rung: confident ? RUNG.NER : RUNG.NER_LOW,
      enabled: confident,
    }];
  });
  return text === undefined ? spans : joinAdjacentSpans(spans, text);
};

const joinAdjacentSpans = (spans: DetectedSpan[], text: string): DetectedSpan[] => {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const joined: DetectedSpan[] = [];
  for (const span of sorted) {
    const last = joined[joined.length - 1];
    if (last && JOINABLE_CATEGORIES.has(span.category) && last.category === span.category
        && last.enabled === span.enabled && /^[ \t]*$/u.test(text.slice(last.end, span.start))) {
      last.end = span.end;
      last.text = text.slice(last.start, last.end);
      last.confidence = Math.min(last.confidence, span.confidence);
    } else joined.push({ ...span });
  }
  return joined;
};
