import type { MappingItem } from './types';

// Word boundaries only where the variant's own edge is a word character:
// `\b` after "1.234,56 €" or before "(1.200 €)" can never match, which left
// every symbol-edged MONEY span unmasked. Unicode-aware, unlike `\b`.
const WORD_CHAR = /[\p{L}\p{N}_]/u;
const edgeBefore = (v: string): string => (WORD_CHAR.test(v[0] ?? '') ? '(?<![\\p{L}\\p{N}_])' : '');
const edgeAfter = (v: string): string => (WORD_CHAR.test(v.at(-1) ?? '') ? '(?![\\p{L}\\p{N}_])' : '');

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
 *
 * `render` picks what a mapping becomes — its placeholder by default; P13's
 * realistic mode passes a fake value instead, through this same path.
 */
export const applyEnabledMappings = (
  rawText: string,
  mappings: MappingItem[],
  render: (m: MappingItem) => string = (m) => m.placeholder,
): string => {
  const replacements = mappings
    .filter((m) => m.enabled)
    .flatMap((m) => {
      const placeholder = render(m);
      return m.variants.map((variant) => ({ variant, placeholder }));
    })
    .sort((a, b) => b.variant.length - a.variant.length);

  let result = rawText;
  for (const { variant, placeholder } of replacements) {
    const regex = new RegExp(`${edgeBefore(variant)}${escapeRegex(variant)}${edgeAfter(variant)}`, 'gu');
    result = result.replace(regex, () => placeholder); // literal: "$1,200" is not a backreference
  }
  return result;
};
