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
 * §4a step 4: dedup accepted spans by exact originalText, minting one
 * MappingItem + placeholder per distinct text, counters starting at 1 in
 * order of first occurrence.
 */
export const buildMappings = (spans: DetectedSpan[]): MappingItem[] => {
  const byOffset = [...spans].sort((a, b) => a.start - b.start);
  const counters = new Map<Category, number>();
  const byText = new Map<string, MappingItem>();
  const order: MappingItem[] = [];

  for (const span of byOffset) {
    const existing = byText.get(span.text);
    if (existing) continue;

    const count = (counters.get(span.category) ?? 0) + 1;
    counters.set(span.category, count);

    const item: MappingItem = {
      id: `${span.category}_${count}`,
      originalText: span.text,
      placeholder: `[${span.category}_${count}]`,
      category: span.category,
      confidence: span.confidence,
      source: span.source,
      enabled: true,
    };
    byText.set(span.text, item);
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
