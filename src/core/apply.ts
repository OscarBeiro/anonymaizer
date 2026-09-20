import type { MappingItem } from './types';

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Recomputes the anonymized text from scratch given the current enabled
 * state of each mapping. MappingItem deliberately carries no offsets (§3),
 * so a UI toggle can't replay the original span substitution — instead this
 * does a literal, global replace of every enabled mapping's variants (P7c: a
 * clustered NAME has more than one surface spelling, each of which must be
 * replaced), sorted by length descending across all variants of all mappings
 * together (same collision-avoidance principle as the reversal engine) so a
 * shorter accepted text can never eat part of a longer one.
 *
 * Word-boundaried for the same reason reverseText is: an unbounded global
 * replace of "Ana" would also rewrite it inside "Análisis".
 */
export const applyEnabledMappings = (rawText: string, mappings: MappingItem[]): string => {
  const replacements = mappings
    .filter((m) => m.enabled)
    .flatMap((m) => m.variants.map((variant) => ({ variant, placeholder: m.placeholder })))
    .sort((a, b) => b.variant.length - a.variant.length);

  let result = rawText;
  for (const { variant, placeholder } of replacements) {
    const regex = new RegExp(`\\b${escapeRegex(variant)}\\b`, 'g');
    result = result.replace(regex, placeholder);
  }
  return result;
};
