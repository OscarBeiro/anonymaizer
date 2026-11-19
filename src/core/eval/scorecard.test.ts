import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { anonymize } from '../anonymize';
import { autoDetectionProfile } from '../langDetect';
import { CORPUS } from './corpus';
import { formatScorecard, parseLabelled, scoreDocument, summarize, type DocumentScore, type PredictedSpan } from './score';

// M06-02: the detection scorecard. Runs the rules-only pipeline exactly as the
// app does with the model off (same automatic language profile) over the labelled corpus, prints the table to
// report.txt and fails if any language's caught count drops or its
// over-flag count rises compared with baseline.json (a ratchet).
// After an improvement: EVAL_UPDATE=1 npx vitest run src/core/eval
const BASELINE = join(__dirname, 'baseline.json');
const REPORT = join(__dirname, 'report.txt');

interface Baseline { [lang: string]: { caught: number; total: number; overflags: number } }

const run = (markup: string): { score: DocumentScore } => {
  const doc = parseLabelled(markup);
  // The same profile App.tsx passes.
  const { mappings } = anonymize(doc.text, [], undefined, [], autoDetectionProfile(doc.text));
  const predicted: PredictedSpan[] = mappings
    .filter((m) => m.enabled !== false)
    .flatMap((m) => (m.occurrences ?? []).map((o) => ({ start: o.start, end: o.end, category: m.category })));
  return { score: scoreDocument(doc, predicted) };
};

describe('detection scorecard (M06-02)', () => {
  const results = CORPUS.map((d) => ({ ...d, ...run(d.markup) }));
  const langs = [...new Set(CORPUS.map((d) => d.lang))];
  const cards = Object.fromEntries(langs.map((l) => [l, summarize(results.filter((r) => r.lang === l).map((r) => r.score))]));

  const report = [
    ...langs.map((l) => `## ${l}\n${formatScorecard(cards[l])}`),
    ['## Leaks (required values not fully hidden)',
      ...results.flatMap((r) => r.score.gold.filter((g) => g.outcome !== 'caught').map((g) => `${r.id}  ${g.category} ${g.outcome}: ${JSON.stringify(g.text)}`))].join('\n'),
    ['## Over-flags (hidden but not personal)',
      ...results.flatMap((r) => r.score.overflags.map((o) => `${r.id}  ${o.category}: ${JSON.stringify(o.text)}`))].join('\n'),
  ].join('\n\n');
  writeFileSync(REPORT, `${report}\n`);

  const current: Baseline = Object.fromEntries(langs.map((l) => [l, { caught: cards[l].total.caught, total: cards[l].total.total, overflags: cards[l].overflags }]));
  if (process.env.EVAL_UPDATE === '1' || !existsSync(BASELINE)) writeFileSync(BASELINE, `${JSON.stringify(current, null, 2)}\n`);
  const baseline: Baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));

  it.each(langs)('%s does not regress against the baseline', (lang) => {
    const b = baseline[lang];
    expect(current[lang].total, 'corpus changed: rerun with EVAL_UPDATE=1').toBe(b.total);
    expect(current[lang].caught).toBeGreaterThanOrEqual(b.caught);
    expect(current[lang].overflags).toBeLessThanOrEqual(b.overflags);
  });
});
