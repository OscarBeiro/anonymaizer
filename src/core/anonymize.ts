import { DEFAULT_CATEGORY_SETTINGS, isCategoryOn, type CategorySettings } from './categories';
import { applyDictionary } from './dictionary';
import { runAllDetectors } from './detectors';
import { mapNerEntitiesToSpans, type NerEntity } from './ner';
import { runDetectionPipeline, type PipelineResult } from './pipeline';
import type { CustomDictionaryRule, DetectedSpan } from './types';

// P11: a dictionary rule is skipped outright when its category is off (the
// same category applyDictionary would mint). NER can't be told to skip a
// category, so its spans are dropped by category after the model has run.
const ruleCategory = (rule: CustomDictionaryRule): string =>
  rule.replacementType === 'CATEGORY' && rule.targetCategory ? rule.targetCategory : 'CUSTOM';

const dictionarySpans = (text: string, rules: CustomDictionaryRule[], settings: CategorySettings): DetectedSpan[] =>
  applyDictionary(text, rules.filter((rule) => isCategoryOn(settings, ruleCategory(rule))));

/**
 * Orchestrates dictionary → regex candidates through the §4a ladder.
 * Dictionary spans enter at top priority, so an overlapping regex hit is
 * dropped whole rather than partially applied.
 */
export const anonymize = (
  text: string,
  rules: CustomDictionaryRule[],
  settings: CategorySettings = DEFAULT_CATEGORY_SETTINGS,
): PipelineResult => {
  const candidates = [...dictionarySpans(text, rules, settings), ...runAllDetectors(text, settings)];
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
  settings: CategorySettings = DEFAULT_CATEGORY_SETTINGS,
): PipelineResult => {
  const candidates = [
    ...dictionarySpans(text, rules, settings),
    ...runAllDetectors(text, settings),
    ...mapNerEntitiesToSpans(nerEntities).filter((span) => isCategoryOn(settings, span.category)),
  ];
  return runDetectionPipeline(text, candidates);
};
