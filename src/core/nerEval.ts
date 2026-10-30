// P39 evaluation metrics, pure and model-free: a document with gold spans, a
// set of predicted spans, and the numbers M06-01 gate C asks for. Sensitive
// characters are what matter for masking; exact spans and false merges show
// how much human review a configuration costs.

export interface GoldSpan {
  start: number;
  end: number;
  category: string;
}

export interface PredictedSpan {
  start: number;
  end: number;
}

export interface EvalDocument {
  id: string;
  language: 'es' | 'gl' | 'pt' | 'en' | 'ca' | 'eu';
  kind: string;
  /** Threshold tuning may use 'tuning' only; acceptance numbers come from 'acceptance'. */
  split: 'tuning' | 'acceptance';
  text: string;
  gold: GoldSpan[];
}

const MARKUP = /\{\{([A-Z_]+)\|([^}]*)\}\}/g;

/** `{{NAME|María Pérez}}` marks a gold span; the markup is removed from the text. */
export const parseAnnotated = (annotated: string): { text: string; gold: GoldSpan[] } => {
  let text = '';
  let last = 0;
  const gold: GoldSpan[] = [];
  for (const match of annotated.matchAll(MARKUP)) {
    text += annotated.slice(last, match.index);
    gold.push({ start: text.length, end: text.length + match[2].length, category: match[1] });
    text += match[2];
    last = match.index + match[0].length;
  }
  text += annotated.slice(last);
  return { text, gold };
};

export interface DocumentScore {
  sensitiveChars: number;
  maskedSensitiveChars: number;
  goldSpans: number;
  exactSpans: number;
  predictedSpans: number;
  /** Predicted spans that touch two or more gold spans. */
  falseMerges: number;
  /** Predicted characters outside every gold span. */
  extraChars: number;
  maskedChars: number;
  totalChars: number;
  /** Gold spans with at least one character left unmasked. */
  unmasked: { text: string; category: string }[];
  perCategory: Record<string, { sensitiveChars: number; maskedSensitiveChars: number; goldSpans: number; unmaskedSpans: number }>;
}

const covered = (spans: readonly PredictedSpan[], at: number): boolean => spans.some((span) => span.start <= at && at < span.end);

export const scoreDocument = (doc: Pick<EvalDocument, 'text' | 'gold'>, predicted: readonly PredictedSpan[]): DocumentScore => {
  const score: DocumentScore = {
    sensitiveChars: 0, maskedSensitiveChars: 0, goldSpans: doc.gold.length, exactSpans: 0,
    predictedSpans: predicted.length, falseMerges: 0, extraChars: 0, maskedChars: 0,
    totalChars: doc.text.length, unmasked: [], perCategory: {},
  };
  const inGold = new Uint8Array(doc.text.length);
  for (const gold of doc.gold) {
    const bucket = (score.perCategory[gold.category] ??= { sensitiveChars: 0, maskedSensitiveChars: 0, goldSpans: 0, unmaskedSpans: 0 });
    bucket.goldSpans++;
    let missed = false;
    for (let at = gold.start; at < gold.end; at++) {
      inGold[at] = 1;
      if (/\s/u.test(doc.text[at])) continue;
      score.sensitiveChars++; bucket.sensitiveChars++;
      if (covered(predicted, at)) { score.maskedSensitiveChars++; bucket.maskedSensitiveChars++; } else missed = true;
    }
    if (missed) { score.unmasked.push({ text: doc.text.slice(gold.start, gold.end), category: gold.category }); bucket.unmaskedSpans++; }
    if (predicted.some((span) => span.start === gold.start && span.end === gold.end)) score.exactSpans++;
  }
  for (const span of predicted) {
    if (doc.gold.filter((gold) => gold.start < span.end && span.start < gold.end).length >= 2) score.falseMerges++;
    for (let at = span.start; at < span.end; at++) {
      if (/\s/u.test(doc.text[at])) continue;
      score.maskedChars++;
      if (!inGold[at]) score.extraChars++;
    }
  }
  return score;
};

export interface AggregateScore {
  documents: number;
  sensitiveCharRecall: number;
  exactSpanRecall: number;
  /** Share of predicted spans that exactly match a gold span. */
  exactSpanPrecision: number;
  falseMerges: number;
  unmaskedSpans: number;
  extraCharShare: number;
  reviewItems: number;
  unmasked: { text: string; category: string }[];
  perCategoryRecall: Record<string, number>;
}

const ratio = (num: number, den: number): number => (den === 0 ? 1 : num / den);

export const aggregateScores = (scores: readonly DocumentScore[]): AggregateScore => {
  const sum = (pick: (score: DocumentScore) => number): number => scores.reduce((total, score) => total + pick(score), 0);
  const categories = new Map<string, { sensitive: number; masked: number }>();
  for (const score of scores) {
    for (const [category, bucket] of Object.entries(score.perCategory)) {
      const entry = categories.get(category) ?? { sensitive: 0, masked: 0 };
      entry.sensitive += bucket.sensitiveChars; entry.masked += bucket.maskedSensitiveChars;
      categories.set(category, entry);
    }
  }
  const exact = sum((score) => score.exactSpans);
  return {
    documents: scores.length,
    sensitiveCharRecall: ratio(sum((score) => score.maskedSensitiveChars), sum((score) => score.sensitiveChars)),
    exactSpanRecall: ratio(exact, sum((score) => score.goldSpans)),
    exactSpanPrecision: ratio(exact, sum((score) => score.predictedSpans)),
    falseMerges: sum((score) => score.falseMerges),
    unmaskedSpans: sum((score) => score.unmasked.length),
    extraCharShare: sum((score) => score.extraChars) / Math.max(1, sum((score) => score.maskedChars)),
    reviewItems: sum((score) => score.predictedSpans),
    unmasked: scores.flatMap((score) => score.unmasked),
    perCategoryRecall: Object.fromEntries([...categories].map(([category, entry]) => [category, ratio(entry.masked, entry.sensitive)])),
  };
};
