import { parseCategorySettings, type CategorySettings } from '../core/categories';
import type { CustomDictionaryRule, MappingSession } from '../core/types';

const SESSION_KEY = 'anonymaizer.session';
const RULES_KEY = 'anonymaizer.dictionaryRules';
const STEP_KEY = 'anonymaizer.step';
const CATEGORY_SETTINGS_KEY = 'anonymaizer.categorySettings';

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

export const newSessionId = (): string =>
  `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
