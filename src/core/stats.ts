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
