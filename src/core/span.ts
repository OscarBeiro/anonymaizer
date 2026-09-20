import { clusterNames } from './entities';
import type { Category, DetectedSpan, MappingItem } from './types';

const overlaps = (a: DetectedSpan, b: DetectedSpan): boolean =>
  a.start < b.end && b.start < a.end;

/**
 * §4a arbitration: rung ascending, longest span wins within a rung, ties
 * broken by start offset. Any candidate overlapping an already-accepted span
 * is dropped whole — never truncated.
 */
export const arbitrateSpans = (candidates: DetectedSpan[]): DetectedSpan[] => {
  const sorted = [...candidates].sort((a, b) => {
    if (a.rung !== b.rung) return a.rung - b.rung;
    const lenA = a.end - a.start;
    const lenB = b.end - b.start;
    if (lenA !== lenB) return lenB - lenA;
    return a.start - b.start;
  });

  const accepted: DetectedSpan[] = [];
  for (const candidate of sorted) {
    if (accepted.some((s) => overlaps(s, candidate))) continue;
    accepted.push(candidate);
  }
  return accepted;
};

/**
 * §4a step 4: dedup accepted spans by originalText, minting one MappingItem +
 * placeholder per distinct text, counters starting at 1 in order of first
 * occurrence.
 *
 * NAME is the one category where "distinct text" isn't exact-string: P7c
 * clusters spellings of the same person ("Ester Cuni" / "Ester Cuni
 * Peirote" / "CUNI PEIROTE ESTER") behind a shared canonical text before the
 * usual dedup runs, so they mint one placeholder, not three. Every other
 * category is unaffected — its dedup key is still the literal span text.
 */
export const buildMappings = (spans: DetectedSpan[]): MappingItem[] => {
  const byOffset = [...spans].sort((a, b) => a.start - b.start);

  const nameTexts: string[] = [];
  for (const span of byOffset) {
    if (span.category === 'NAME' && !nameTexts.includes(span.text)) nameTexts.push(span.text);
  }
  const canonicalOf = new Map<string, string>();
  const variantsOf = new Map<string, string[]>();
  for (const cluster of clusterNames(nameTexts)) {
    const [canonical] = cluster;
    variantsOf.set(canonical, cluster);
    for (const variant of cluster) canonicalOf.set(variant, canonical);
  }

  const dedupKeyFor = (span: DetectedSpan): string =>
    span.category === 'NAME' ? canonicalOf.get(span.text)! : span.text;

  const counters = new Map<Category, number>();
  const byKey = new Map<string, MappingItem>();
  const order: MappingItem[] = [];

  for (const span of byOffset) {
    const key = dedupKeyFor(span);
    const existing = byKey.get(key);
    if (existing) continue;

    const count = (counters.get(span.category) ?? 0) + 1;
    counters.set(span.category, count);

    const item: MappingItem = {
      id: `${span.category}_${count}`,
      originalText: key,
      placeholder: `[${span.category}_${count}]`,
      category: span.category,
      confidence: span.confidence,
      source: span.source,
      enabled: span.enabled ?? true,
      variants: variantsOf.get(key) ?? [span.text],
    };
    byKey.set(key, item);
    order.push(item);
  }

  return order;
};

/**
 * §4a step 5: substitute accepted spans right-to-left by offset so earlier
 * offsets stay valid as later ones are rewritten.
 */
export const applySpans = (
  text: string,
  spans: DetectedSpan[],
  placeholderFor: (span: DetectedSpan) => string,
): string => {
  const rightToLeft = [...spans].sort((a, b) => b.start - a.start);
  let result = text;
  for (const span of rightToLeft) {
    result = result.slice(0, span.start) + placeholderFor(span) + result.slice(span.end);
  }
  return result;
};
