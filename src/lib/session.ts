import { parseCategorySettings, type CategorySettings } from '../core/categories';
import { normalizeMoneyRange, type MoneyRange } from '../core/pseudonymize';
import type { CustomDictionaryRule, MappingSession } from '../core/types';

const SESSION_KEY = 'anonymaizer.session';
const RULES_KEY = 'anonymaizer.dictionaryRules';
const STEP_KEY = 'anonymaizer.step';
const CATEGORY_SETTINGS_KEY = 'anonymaizer.categorySettings';
const OUTPUT_MODE_KEY = 'anonymaizer.outputMode';
const MONEY_RANGE_KEY = 'anonymaizer.moneyRange';
// Read verbatim by the inline pre-paint script in index.html — rename both or neither.
export const THEME_KEY = 'anonymaizer.theme';

// Wizard position is UI state, not part of the spec §3 MappingSession data
// contract — kept under its own localStorage key.
export type WizardStep = 'ingest' | 'review' | 'restore';

export const loadStep = (): WizardStep => {
  const raw = localStorage.getItem(STEP_KEY);
  return raw === 'review' || raw === 'restore' ? raw : 'ingest';
};

export const saveStep = (step: WizardStep): void => {
  localStorage.setItem(STEP_KEY, step);
};

// P13: which rendering 2.3 shows, copies and exports. UI state like the step.
export type OutputMode = 'placeholders' | 'realistic';

export const loadOutputMode = (): OutputMode =>
  localStorage.getItem(OUTPUT_MODE_KEY) === 'realistic' ? 'realistic' : 'placeholders';

export const saveOutputMode = (mode: OutputMode): void => {
  localStorage.setItem(OUTPUT_MODE_KEY, mode);
};

// P17: `system` follows prefers-color-scheme; light/dark override it.
export type ThemePreference = 'light' | 'dark' | 'system';

export const parseTheme = (raw: string | null): ThemePreference =>
  raw === 'light' || raw === 'dark' ? raw : 'system';

export const loadTheme = (): ThemePreference => parseTheme(localStorage.getItem(THEME_KEY));

export const saveTheme = (theme: ThemePreference): void => {
  localStorage.setItem(THEME_KEY, theme);
};

export const loadMoneyRange = (): MoneyRange => {
  try {
    return normalizeMoneyRange(JSON.parse(localStorage.getItem(MONEY_RANGE_KEY) ?? 'null'));
  } catch {
    return normalizeMoneyRange(null);
  }
};

export const saveMoneyRange = (range: MoneyRange): void => {
  localStorage.setItem(MONEY_RANGE_KEY, JSON.stringify(normalizeMoneyRange(range)));
};

export const loadSession = (): MappingSession | null => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as MappingSession;
    // A session saved before P7c's entity clustering has no `variants` on
    // its mappings — backfill it so applyEnabledMappings' flatMap doesn't
    // crash on an old localStorage session.
    session.mappings = session.mappings.map((m) => ({
      ...m,
      variants: m.variants?.length ? m.variants : [m.originalText],
    }));
    return session;
  } catch {
    return null;
  }
};

export const saveSession = (session: MappingSession): void => {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

export const loadDictionaryRules = (): CustomDictionaryRule[] => {
  try {
    const raw = localStorage.getItem(RULES_KEY);
    return raw ? (JSON.parse(raw) as CustomDictionaryRule[]) : [];
  } catch {
    return [];
  }
};

export const saveDictionaryRules = (rules: CustomDictionaryRule[]): void => {
  localStorage.setItem(RULES_KEY, JSON.stringify(rules));
};

// P11: the user's general preference across documents, not part of the
// MappingSession. Parsing (unknown keys, bad values) lives in core.
export const loadCategorySettings = (known: readonly string[]): CategorySettings => {
  try {
    return parseCategorySettings(localStorage.getItem(CATEGORY_SETTINGS_KEY), known);
  } catch {
    return {};
  }
};

export const saveCategorySettings = (settings: CategorySettings): void => {
  localStorage.setItem(CATEGORY_SETTINGS_KEY, JSON.stringify(settings));
};

// P18: "clear all local data". Wipes every `anonymaizer.`-prefixed key — not
// just the ones this file names — so a key added later cannot be missed. The
// privacy policy (P20) promises this in writing; session.test.ts holds it to it.
export const LOCAL_KEY_PREFIX = 'anonymaizer.';

export const clearLocalData = (storage: Storage = localStorage): void => {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(LOCAL_KEY_PREFIX)) keys.push(key);
  }
  keys.forEach((key) => storage.removeItem(key));
};

export const newSessionId = (): string =>
  `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
