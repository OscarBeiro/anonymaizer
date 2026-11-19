// Manual edits to the mapping list in the review step: split a clustered
// entry into one per spelling, merge several into one. Pure (rule 4).
//
// Both must carry `occurrences` along. applyEnabledMappings replaces by
// occurrence when every mapping has them, so an entry that loses its
// positions is silently left in clear: merging two names used to keep only
// the first one's positions, and the second reappeared in the sanitized text.
import type { MappingItem } from './types';

// The next free counter for a category, so a split mints an id/placeholder
// that cannot collide with one auto-detection already used.
const nextCounter = (mappings: readonly MappingItem[], category: string): number => {
  const used = mappings
    .filter((m) => m.category === category)
    .map((m) => Number(m.id.slice(m.id.lastIndexOf('_') + 1)))
    .filter((n) => !Number.isNaN(n));
  return (used.length ? Math.max(...used) : 0) + 1;
};

/**
 * One mapping per surface spelling of a clustered entry (P7c override). With
 * positions, each new entry takes the occurrences written that way; a variant
 * that never appears as written (a reordered "Vidal, Anxo") gets no entry.
 * Returns the same array when there is nothing to split.
 */
export const splitMapping = (mappings: MappingItem[], id: string): MappingItem[] => {
  const target = mappings.find((m) => m.id === id);
  if (!target || target.variants.length <= 1) return mappings;

  const groups: { text: string; occurrences?: MappingItem['occurrences'] }[] = [];
  if (target.occurrences === undefined) {
    groups.push(...target.variants.map((text) => ({ text })));
  } else {
    const spellings = [...target.variants, ...target.occurrences.map((o) => o.text)];
    for (const text of new Set(spellings)) {
      const occurrences = target.occurrences.filter((o) => o.text === text);
      if (occurrences.length) groups.push({ text, occurrences });
    }
    if (groups.length <= 1) return mappings;
  }

  let counter = nextCounter(mappings, target.category);
  const split: MappingItem[] = groups.map(({ text, occurrences }) => ({
    id: `${target.category}_${counter}`,
    placeholder: `[[${target.category}_${String(counter++).padStart(3, '0')}]]`,
    originalText: text,
    category: target.category,
    confidence: target.confidence,
    source: target.source,
    enabled: target.enabled,
    variants: [text],
    ...(occurrences ? { occurrences } : {}),
  }));
  return [...mappings.filter((m) => m.id !== id), ...split];
};

/**
 * Folds two or more same-category mappings into the first, keeping every
 * variant and every occurrence. The longest variant becomes canonical, as in
 * entities.ts. If any merged entry has no positions the result has none
 * either, which sends applyEnabledMappings down its text-search path rather
 * than leaving that entry's text in clear.
 */
export const mergeMappings = (mappings: MappingItem[], ids: readonly string[]): MappingItem[] => {
  const targets = mappings.filter((m) => ids.includes(m.id));
  if (targets.length < 2) return mappings;
  if (targets.some((t) => t.category !== targets[0].category)) return mappings;

  const variants = [...new Set(targets.flatMap((t) => t.variants))].sort((a, b) => b.length - a.length);
  const occurrences = targets.every((t) => t.occurrences !== undefined)
    ? targets.flatMap((t) => t.occurrences!).sort((a, b) => a.start - b.start)
    : undefined;
  const merged: MappingItem = { ...targets[0], originalText: variants[0], variants, occurrences };
  return [...mappings.filter((m) => !ids.includes(m.id)), merged];
};
