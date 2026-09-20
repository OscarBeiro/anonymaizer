import type { MappingItem } from './types';

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Recomputes the anonymized text from scratch given the current enabled
 * state of each mapping. MappingItem deliberately carries no offsets (§3),
 * so a UI toggle can't replay the original span substitution — instead this
 * does a literal, global replace of each enabled mapping's originalText,
 * sorted by originalText length descending (same collision-avoidance
 * principle as the reversal engine) so a shorter accepted text can never eat
 * part of a longer one.
 *
 * Word-boundaried for the same reason reverseText is: an unbounded global
 * replace of "Ana" would also rewrite it inside "Análisis".
 */
export const applyEnabledMappings = (rawText: string, mappings: MappingItem[]): string => {
  const enabled = [...mappings]
    .filter((m) => m.enabled)
    .sort((a, b) => b.originalText.length - a.originalText.length);

  let result = rawText;
  for (const item of enabled) {
    const regex = new RegExp(`\\b${escapeRegex(item.originalText)}\\b`, 'g');
    result = result.replace(regex, item.placeholder);
  }
  return result;
};
