import { applySpans, arbitrateSpans, buildMappings } from './span';
import type { DetectedSpan, MappingItem } from './types';

export interface PipelineResult {
  mappings: MappingItem[];
  anonymizedText: string;
}

/**
 * §4a end to end: arbitrate candidate spans, dedup into mappings, then
 * substitute right-to-left using each accepted span's minted placeholder.
 */
export const runDetectionPipeline = (text: string, candidates: DetectedSpan[]): PipelineResult => {
  const accepted = arbitrateSpans(candidates);
  const mappings = buildMappings(accepted);

  const placeholderByText = new Map(mappings.map((m) => [m.originalText, m.placeholder]));
  const anonymizedText = applySpans(text, accepted, (span) => placeholderByText.get(span.text)!);

  return { mappings, anonymizedText };
};
