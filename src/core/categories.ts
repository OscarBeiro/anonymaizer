import type { CustomDictionaryRule } from './types';

// P11: which categories run *at all*, before detection — a coarser, earlier
// gate than the per-row `enabled` checkbox, which stays.
//
// Keys are categories, plus one pseudo-category: COMPANY_ACRONYM, the
// ALL-CAPS COMPANY guess. It shares COMPANY's category but is its own
// detector, so it gets its own switch. It defaults **on**: the guesses keep
// arriving unticked (`enabled: false`) exactly as before P11; the switch lets
// a user stop them appearing at all.
//
// Shields (category SHIELD) are deliberately absent: a shield only stops a
// false positive, so switching one off can make detection worse, never more
// thorough. REGEX is absent too — it is in KnownCategory but nothing emits it
// (a dictionary regex rule mints CUSTOM or its target category).
export type CategorySettings = Record<string, boolean>;

export const COMPANY_ACRONYM = 'COMPANY_ACRONYM';

export const TOGGLEABLE_CATEGORIES = [
  'NAME',
  'COMPANY',
  COMPANY_ACRONYM,
  'EMAIL',
  'PHONE',
  'ADDRESS',
  'DNI',
  'NIE',
  'INVALID_ID',
  'IBAN',
  'CREDIT_CARD',
  'MASKED_ID',
  'ID_CODE',
  'CUSTOM',
] as const;

export const DEFAULT_CATEGORY_SETTINGS: CategorySettings = Object.fromEntries(
  TOGGLEABLE_CATEGORIES.map((c) => [c, true]),
);

/** A category absent from the map takes its default; an unknown one (a new rule target) is on. */
export const isCategoryOn = (settings: CategorySettings, category: string): boolean =>
  settings[category] ?? DEFAULT_CATEGORY_SETTINGS[category] ?? true;

/** The built-ins, then each distinct CATEGORY rule target not already listed — built at render time. */
export const toggleableCategories = (rules: CustomDictionaryRule[]): string[] => {
  const list: string[] = [...TOGGLEABLE_CATEGORIES];
  for (const rule of rules) {
    const target = rule.replacementType === 'CATEGORY' ? rule.targetCategory : undefined;
    if (target && !list.includes(target)) list.push(target);
  }
  return list;
};

/**
 * Stored settings back to a map: keys not in `known` and non-boolean values
 * are dropped, missing keys are left out (so they take their default and a
 * future category is on without a migration). Garbage parses to `{}`.
 */
export const parseCategorySettings = (raw: string | null, known: readonly string[]): CategorySettings => {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
  return Object.fromEntries(
    Object.entries(parsed).filter(([key, value]) => known.includes(key) && typeof value === 'boolean'),
  );
};
