import { applySpans, arbitrateSpans, buildMappings } from './span';
import type { DetectedSpan, MappingItem } from './types';

export interface PipelineResult {
  mappings: MappingItem[];
  anonymizedText: string;
}

/**
 * §4a end to end: arbitrate candidate spans, drop shields (they exist only to
 * keep other detectors off their text — never minted, never applied), dedup
 * the rest into mappings, then substitute right-to-left using each accepted
 * span's minted placeholder. Spans whose mapping starts disabled (the
 * ALL-CAPS COMPANY guess) are left untouched in the text — they're offered
 * for review, not applied silently.
 */
export const runDetectionPipeline = (text: string, candidates: DetectedSpan[]): PipelineResult => {
  const accepted = arbitrateSpans(candidates).filter((span) => !span.shield);
  const mappings = buildMappings(accepted);

  // Keyed by every variant, not just the canonical originalText — a
  // clustered NAME mapping (P7c) must still match the span for each of its
  // surface spellings.
  const enabledTexts = new Set(mappings.filter((m) => m.enabled).flatMap((m) => m.variants));
  const spansToApply = accepted.filter((span) => enabledTexts.has(span.text));

  const placeholderByText = new Map(mappings.flatMap((m) => m.variants.map((v) => [v, m.placeholder] as const)));
  const anonymizedText = applySpans(text, spansToApply, (span) => placeholderByText.get(span.text)!);

  return { mappings, anonymizedText };
};
