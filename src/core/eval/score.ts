// M06-02: detection-quality scoring. Pure (rule 4): no fs, no DOM.
//
// A labelled document is plain text with inline markup:
//   {NAME|María Fernández}   personal data that must be hidden
//   {LOCATION?|Lugo}         optional: hiding it or not are both acceptable
// Unlabelled text that gets hidden anyway counts as an over-flag.
//
// Scoring is leak-oriented: a gold span is "caught" only when every
// non-space character of it is covered by an applied placeholder; partly
// covered still leaks part of the value.

export interface GoldSpan {
  start: number;
  end: number;
  category: string;
  optional: boolean;
  text: string;
}

export interface PredictedSpan {
  start: number;
  end: number;
  category: string;
}

export interface LabelledDocument {
  text: string;
  gold: GoldSpan[];
}

export type Outcome = 'caught' | 'partial' | 'missed';

export interface DocumentScore {
  /** Required gold spans with their outcome. */
  gold: (GoldSpan & { outcome: Outcome })[];
  /** Predicted spans overlapping no gold span (required or optional). */
  overflags: (PredictedSpan & { text: string })[];
}

export interface CategoryScore {
  total: number;
  caught: number;
  partial: number;
  missed: number;
}

export interface Scorecard {
  byCategory: Record<string, CategoryScore>;
  /** Over-flags counted by the predicted category. */
  overflagsByCategory: Record<string, number>;
  total: CategoryScore;
  overflags: number;
  /** caught / total, 0..1 (1 when there is nothing to catch). */
  recall: number;
}

const MARKUP = /\{([A-Z_]+)(\?)?\|([^{}]+)\}/g;

export const parseLabelled = (markup: string): LabelledDocument => {
  const gold: GoldSpan[] = [];
  let text = '';
  let last = 0;
  for (const m of markup.matchAll(MARKUP)) {
    text += markup.slice(last, m.index);
    const start = text.length;
    text += m[3];
    gold.push({ start, end: text.length, category: m[1], optional: m[2] === '?', text: m[3] });
    last = m.index + m[0].length;
  }
  text += markup.slice(last);
  if (/[{}]/.test(text)) throw new Error(`Unbalanced markup near: ${text.slice(text.search(/[{}]/), text.search(/[{}]/) + 40)}`);
  return { text, gold };
};

const overlaps = (a: { start: number; end: number }, b: { start: number; end: number }) => a.start < b.end && b.start < a.end;

export const scoreDocument = (doc: LabelledDocument, predicted: readonly PredictedSpan[]): DocumentScore => {
  const covered = new Uint8Array(doc.text.length);
  for (const p of predicted) covered.fill(1, Math.max(0, p.start), Math.min(doc.text.length, p.end));

  const gold = doc.gold.filter((g) => !g.optional).map((g) => {
    let need = 0;
    let have = 0;
    for (let i = g.start; i < g.end; i++) {
      if (/\s/.test(doc.text[i])) continue;
      need++;
      have += covered[i];
    }
    const outcome: Outcome = have === need ? 'caught' : have === 0 ? 'missed' : 'partial';
    return { ...g, outcome };
  });

  const overflags = predicted
    .filter((p) => !doc.gold.some((g) => overlaps(p, g)))
    .map((p) => ({ ...p, text: doc.text.slice(p.start, p.end) }));

  return { gold, overflags };
};

const emptyScore = (): CategoryScore => ({ total: 0, caught: 0, partial: 0, missed: 0 });

export const summarize = (scores: readonly DocumentScore[]): Scorecard => {
  const byCategory: Record<string, CategoryScore> = {};
  const overflagsByCategory: Record<string, number> = {};
  const total = emptyScore();
  let overflags = 0;
  for (const s of scores) {
    for (const g of s.gold) {
      const c = (byCategory[g.category] ??= emptyScore());
      for (const target of [c, total]) {
        target.total++;
        target[g.outcome]++;
      }
    }
    for (const o of s.overflags) {
      overflagsByCategory[o.category] = (overflagsByCategory[o.category] ?? 0) + 1;
      overflags++;
    }
  }
  return { byCategory, overflagsByCategory, total, overflags, recall: total.total ? total.caught / total.total : 1 };
};

const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : '—');

/** A plain-text table for test output and the dev changelog. */
export const formatScorecard = (card: Scorecard): string => {
  const rows = Object.entries(card.byCategory).sort(([a], [b]) => a.localeCompare(b));
  const lines = ['category        total caught partial missed recall over-flags'];
  for (const [cat, c] of [...rows, ['ALL', card.total] as const]) {
    const over = cat === 'ALL' ? card.overflags : (card.overflagsByCategory[cat] ?? 0);
    lines.push(`${cat.padEnd(15)} ${String(c.total).padStart(5)} ${String(c.caught).padStart(6)} ${String(c.partial).padStart(7)} ${String(c.missed).padStart(6)} ${pct(c.caught, c.total).padStart(6)} ${String(over).padStart(10)}`);
  }
  const extra = Object.entries(card.overflagsByCategory).filter(([cat]) => !card.byCategory[cat]);
  for (const [cat, n] of extra) lines.push(`${cat.padEnd(15)} ${'—'.padStart(5)} ${''.padStart(6)} ${''.padStart(7)} ${''.padStart(6)} ${''.padStart(6)} ${String(n).padStart(10)}`);
  return lines.join('\n');
};
