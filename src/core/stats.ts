import type { MappingItem } from './types';

export interface CategoryCount {
  category: string;
  count: number;
}

// Counts every mapping (placeholder), not every occurrence in the text —
// one clustered NAME mapping (P7c) counts once, matching what the
// Placeholders table shows, not a raw text-search hit count.
export const countByCategory = (mappings: MappingItem[]): CategoryCount[] =>
  [...mappings.reduce((acc, m) => acc.set(m.category, (acc.get(m.category) ?? 0) + 1), new Map<string, number>())]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));

export interface MappingSummary {
  enabled: number;
  disabled: number;
  // Enabled mappings only — an unticked mapping isn't masked in the output.
  byCategory: CategoryCount[];
}

export const summarizeMappings = (mappings: MappingItem[]): MappingSummary => {
  const enabled = mappings.filter((m) => m.enabled);
  return { enabled: enabled.length, disabled: mappings.length - enabled.length, byCategory: countByCategory(enabled) };
};
