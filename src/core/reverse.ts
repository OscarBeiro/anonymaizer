import type { MappingItem } from './types';

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Diverges from spec §5 on purpose (see docs/plans "Two spec traps"):
 * - replaceAll underscores, not just the first (`.replace('_', …)` breaks
 *   PROJECT_NAME_1).
 * - the token is escaped for regex metacharacters before building the
 *   flexible pattern.
 * - sorts by **placeholder** length descending, not originalText length, so
 *   [NAME_1] can never eat [NAME_11].
 *
 * Lossy on purpose for a clustered NAME mapping (P7c): every placeholder
 * restores originalText, which is the cluster's canonical spelling — a
 * document that said "Ester Cuni" in one place and "Ester Cuni Peirote" in
 * another comes back with the canonical spelling in both. That's the
 * accepted cost of one-person-one-placeholder.
 */
export const reverseText = (aiResponse: string, mappings: MappingItem[]): string => {
  let restored = aiResponse;

  const activeMappings = [...mappings]
    .filter((m) => m.enabled)
    .sort((a, b) => b.placeholder.length - a.placeholder.length);

  for (const item of activeMappings) {
    const tokenRaw = item.placeholder.replace(/[[\]]/g, '');
    const flexibleToken = escapeRegex(tokenRaw).replace(/_/g, '[\\s_]?');
    const flexibleRegex = new RegExp(`\\[?\\b${flexibleToken}\\b\\]?`, 'gi');

    restored = restored.replace(flexibleRegex, item.originalText);
  }

  return restored;
};
