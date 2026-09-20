import { applyDictionary } from './dictionary';
import { runAllDetectors } from './detectors';
import { mapNerEntitiesToSpans, type NerEntity } from './ner';
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

/**
 * P7d: same orchestration, plus NER spans from the opt-in worker
 * (src/workers/ner.worker.ts). Takes already-run entities rather than
 * running the model itself, so this — the part that actually decides how
 * NER results are merged into the §4a ladder — is fully unit-testable
 * without ever loading transformers.js or an ONNX model.
 */
export const anonymizeWithNer = (
  text: string,
  rules: CustomDictionaryRule[],
  nerEntities: NerEntity[],
): PipelineResult => {
  const candidates = [
    ...applyDictionary(text, rules),
    ...runAllDetectors(text),
    ...mapNerEntitiesToSpans(nerEntities),
  ];
  return runDetectionPipeline(text, candidates);
};
