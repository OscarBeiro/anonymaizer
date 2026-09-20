import { applyDictionary } from './dictionary';
import { runAllDetectors } from './detectors';
import { runDetectionPipeline, type PipelineResult } from './pipeline';
import type { CustomDictionaryRule } from './types';

/**
 * Orchestrates dictionary → regex candidates through the §4a ladder.
 * Dictionary spans enter at top priority, so an overlapping regex hit is
 * dropped whole rather than partially applied.
 */
export const anonymize = (text: string, rules: CustomDictionaryRule[]): PipelineResult => {
  const candidates = [...applyDictionary(text, rules), ...runAllDetectors(text)];
  return runDetectionPipeline(text, candidates);
};
