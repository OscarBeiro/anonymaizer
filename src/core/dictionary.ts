import { RUNG, type CustomDictionaryRule, type DetectedSpan } from './types';

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Tier 1: resolves each rule to spans over `text` so dictionary matches enter
 * the §4a ladder at top priority instead of being string-replaced ahead of
 * detection.
 */
export const applyDictionary = (text: string, rules: CustomDictionaryRule[]): DetectedSpan[] => {
  const spans: DetectedSpan[] = [];

  for (const rule of rules) {
    const pattern = rule.isRegex ? rule.termOrPattern : escapeRegex(rule.termOrPattern);
    const regex = new RegExp(pattern, 'gu');
    const category = rule.replacementType === 'CATEGORY' && rule.targetCategory
      ? rule.targetCategory
      : 'CUSTOM';

    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      if (match[0].length === 0) {
        regex.lastIndex++;
        continue;
      }
      spans.push({
        start: match.index,
        end: match.index + match[0].length,
        category,
        text: match[0],
        confidence: 1,
        source: 'dictionary',
        rung: RUNG.DICTIONARY,
      });
    }
  }

  return spans;
};
