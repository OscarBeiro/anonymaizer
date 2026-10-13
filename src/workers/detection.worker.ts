/// <reference lib="webworker" />
import { anonymize, anonymizeWithNer } from '../core/anonymize';
import type { CategorySettings } from '../core/categories';
import type { CustomDictionaryRule, MappingItem, DetectedSpan } from '../core/types';
import type { NerEntity } from '../core/ner';
import type { DetectionProfile } from '../core/packs/profile';
export interface DetectionRequest { requestId: number; text: string; rules: CustomDictionaryRule[]; settings: CategorySettings; entities?: NerEntity[]; manualMappings?: MappingItem[]; profile?: DetectionProfile; model?: string }
self.onmessage = (event: MessageEvent<DetectionRequest>) => {
  const r = event.data;
  try {
    if (r.text.length > 2_000_000 || r.rules.length > 1000) throw new Error('Input exceeds processing limits.');
    const manuals: DetectedSpan[] = (r.manualMappings ?? []).flatMap(m => (m.occurrences ?? []).filter(o => r.text.slice(o.start, o.end) === o.text).map(o => ({ ...o, category: m.category, confidence: m.confidence, source: 'manual' as const, rung: 0, enabled: m.enabled })));
    const result = r.entities ? anonymizeWithNer(r.text, r.rules, r.entities, r.settings, manuals, r.profile, r.model) : anonymize(r.text, r.rules, r.settings, manuals, r.profile);
    if (result.mappings.length > 10000) throw new Error('Too many detected values.');
    postMessage({ requestId: r.requestId, result });
  } catch { postMessage({ requestId: r.requestId, error: 'Detection failed. Check document size and dictionary patterns.' }); }
};
