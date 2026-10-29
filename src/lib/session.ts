import { validateSnapshot } from '../core/roundTrip';
import { remembered, writerCurrent, generation } from './retention';
import { parseImportedRules } from '../core/ruleValidation';
import type { RestoreFormat } from '../core/markdownRender';
import { parseCategorySettings, type CategorySettings } from '../core/categories';
import { normalizeMoneyRange, PSEUDONYM_LANGS, type MoneyRange, type PseudonymLang } from '../core/pseudonymize';
import type { CustomDictionaryRule, MappingSession } from '../core/types';
import { parsePinnedProfile } from '../core/profileSelection';
import type { DetectionProfile } from '../core/packs/profile';

const SESSION_KEY = 'anonymaizer.session';
const RULES_KEY = 'anonymaizer.dictionaryRules';
const STEP_KEY = 'anonymaizer.step';
const CATEGORY_SETTINGS_KEY = 'anonymaizer.categorySettings';
const OUTPUT_MODE_KEY = 'anonymaizer.outputMode';
const RESTORE_FORMAT_KEY = 'anonymaizer.restoreFormat';
const MONEY_RANGE_KEY = 'anonymaizer.moneyRange';
const PSEUDONYM_LANG_KEY = 'anonymaizer.pseudonymLang';
const APP_MODE_KEY = 'anonymaizer.appMode';
export const PINNED_PROFILE_KEY = 'anonymaizer.pinnedProfile';

// L1: localStorage has a ~5 MB quota and a 1000-page PDF is 2-3 M characters,
// so a write can throw QuotaExceededError (or be blocked outright). Every save
// goes through here; the caller learns whether it stuck, and nothing throws.
const write = (key: string, value: string): boolean => {
  try {
    if (!writerCurrent()) return false;
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};
const read = (key: string): string | null => { try { return localStorage.getItem(key); } catch { return null; } };
// Read verbatim by the inline pre-paint script in index.html — rename both or neither.
export const THEME_KEY = 'anonymaizer.theme';

// Wizard position is UI state, not part of the spec §3 MappingSession data
// contract — kept under its own localStorage key.
export type WizardStep = 'ingest' | 'review' | 'restore';

export const loadStep = (): WizardStep => {
  if (!remembered('document')) return 'ingest';
  const raw = read(STEP_KEY);
  return raw === 'review' || raw === 'restore' ? raw : 'ingest';
};

export const saveStep = (step: WizardStep): void => {
  write(STEP_KEY, step);
};

// P13: which rendering 2.3 shows, copies and exports. UI state like the step.
export type OutputMode = 'placeholders' | 'realistic';

export const loadOutputMode = (): OutputMode =>
  read(OUTPUT_MODE_KEY) === 'realistic' ? 'realistic' : 'placeholders';

export const saveOutputMode = (mode: OutputMode): void => {
  write(OUTPUT_MODE_KEY, mode);
};

// How step 3.2 shows and copies the restored text. Markdown (rendered) is the
// default: it is what the AI sent.
export const loadRestoreFormat = (): RestoreFormat => {
  const v = read(RESTORE_FORMAT_KEY);
  return v === 'plain' || v === 'html' ? v : 'markdown';
};

export const saveRestoreFormat = (format: RestoreFormat): void => {
  write(RESTORE_FORMAT_KEY, format);
};

// S1: Standard is drop -> result with a Fine-tune button; Advanced is the full
// wizard. A missing or unknown value is Standard, the default for new visitors.
export type AppMode = 'standard' | 'advanced';

export const parseAppMode = (raw: string | null): AppMode => (raw === 'advanced' ? 'advanced' : 'standard');

export const loadAppMode = (): AppMode => parseAppMode(read(APP_MODE_KEY));

export const saveAppMode = (mode: AppMode): void => {
  write(APP_MODE_KEY, mode);
};

// P17: `system` follows prefers-color-scheme; light/dark override it.
export type ThemePreference = 'light' | 'dark' | 'system';

export const parseTheme = (raw: string | null): ThemePreference =>
  raw === 'light' || raw === 'dark' ? raw : 'system';

export const loadTheme = (): ThemePreference => parseTheme(read(THEME_KEY));

export const saveTheme = (theme: ThemePreference): void => {
  write(THEME_KEY, theme);
};

export const loadMoneyRange = (): MoneyRange => {
  try {
    return normalizeMoneyRange(JSON.parse(read(MONEY_RANGE_KEY) ?? 'null'));
  } catch {
    return normalizeMoneyRange(null);
  }
};

export const saveMoneyRange = (range: MoneyRange): void => {
  write(MONEY_RANGE_KEY, JSON.stringify(normalizeMoneyRange(range)));
};

// U6: which language the Realistic fake names and companies come from.
export const loadPseudonymLang = (): PseudonymLang => {
  const stored = read(PSEUDONYM_LANG_KEY);
  return PSEUDONYM_LANGS.find((l) => l === stored) ?? 'es';
};

export const savePseudonymLang = (lang: PseudonymLang): void => {
  write(PSEUDONYM_LANG_KEY, lang);
};

export const loadSession = (): MappingSession | null => {
  try {
    const raw = read(SESSION_KEY);
    if (!raw) return null;
    if (raw.length > 8_000_000) return null;
    const session = JSON.parse(raw) as MappingSession & { storageGeneration?: string | null };
    if (session.storageGeneration !== undefined && session.storageGeneration !== generation()) return null;
    if (!session || typeof session.sessionId !== 'string' || typeof session.createdAt !== 'string' ||
      !['PASTE', 'FILE'].includes(session.inputType) || !['raw_text', 'pdf', 'docx', 'odt', 'csv', 'xlsx', 'eml', 'pptx'].includes(session.originalFormat) ||
      typeof session.rawMarkdown !== 'string' || session.rawMarkdown.length > 2_000_000 || typeof session.anonymizedMarkdown !== 'string' ||
      !Array.isArray(session.mappings) || session.mappings.length > 10000 || !session.mappings.every(m => m &&
        typeof m.id === 'string' && m.id.length <= 200 && typeof m.originalText === 'string' && m.originalText.length <= 100000 && typeof m.placeholder === 'string' && m.placeholder.length <= 200 &&
        typeof m.category === 'string' && m.category.length <= 64 && typeof m.enabled === 'boolean' && typeof m.confidence === 'number' &&
        ['regex', 'ner', 'manual', 'dictionary'].includes(m.source) &&
        (m.variants === undefined || Array.isArray(m.variants) && m.variants.length <= 1000 && m.variants.every(v => typeof v === 'string' && v.length <= 100000)))) return null;
    if (new Set(session.mappings.map(m => m.placeholder)).size !== session.mappings.length) return null;
    if (session.fileName !== undefined && (typeof session.fileName !== 'string' || session.fileName.length > 1000)) return null;
    if (session.mappings.some(m => m.occurrences !== undefined && (!Array.isArray(m.occurrences) || m.occurrences.some(o => !o ||
      !Number.isSafeInteger(o.start) || !Number.isSafeInteger(o.end) || o.start < 0 || o.end <= o.start || o.end > session.rawMarkdown.length ||
      typeof o.text !== 'string' || session.rawMarkdown.slice(o.start, o.end) !== o.text)))) return null;
    if (session.coverage && (!Array.isArray(session.coverage.warnings) || !session.coverage.warnings.every(v => typeof v === 'string') ||
      !Array.isArray(session.coverage.structuralWarnings) || !session.coverage.structuralWarnings.every(v => typeof v === 'string') ||
      !['complete', 'review', 'empty', 'failed'].includes(session.coverage.status))) return null;
    if (session.tokenCounter !== undefined && (!Number.isSafeInteger(session.tokenCounter) || session.tokenCounter < 1)) return null;
    if (session.identity && (!/^[A-F0-9]{32}$/.test(session.identity.scope) || typeof session.identity.documentId !== 'string' ||
      ![session.identity.documentRevision, session.identity.policyRevision, session.identity.mappingRevision].every(n => Number.isSafeInteger(n) && n >= 0))) return null;
    if (session.snapshots) { if (!Array.isArray(session.snapshots) || session.snapshots.length > 1000) return null; session.snapshots = session.snapshots.map(validateSnapshot); }
    if (session.detectionProfile !== undefined) {
      const profile = parsePinnedProfile(JSON.stringify(session.detectionProfile));
      if (!profile) return null;
      session.detectionProfile = profile;
    }
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

/**
 * Persists the session; false when it did not fit. A failed save also drops
 * the stored copy, so a reload cannot restore an older document than the one
 * on screen.
 */
export const saveSession = (session: MappingSession): boolean => {
  if (!writerCurrent()) return false;
  if (!remembered('document')) return true;
  if (write(SESSION_KEY, JSON.stringify({ ...session, storageGeneration: generation() }))) return true;
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // nothing more to do
  }
  return false;
};

export const loadDictionaryRules = (): CustomDictionaryRule[] => {
  try {
    const raw = read(RULES_KEY);
    return raw ? parseImportedRules(raw) : [];
  } catch {
    return [];
  }
};

export const saveDictionaryRules = (rules: CustomDictionaryRule[]): void => {
  if (remembered('rules') && writerCurrent()) write(RULES_KEY, JSON.stringify(rules));
};

// P11: the user's general preference across documents, not part of the
// MappingSession. Parsing (unknown keys, bad values) lives in core.
export const loadCategorySettings = (known: readonly string[]): CategorySettings => {
  try {
    return parseCategorySettings(read(CATEGORY_SETTINGS_KEY), known);
  } catch {
    return {};
  }
};

export const saveCategorySettings = (settings: CategorySettings): void => {
  write(CATEGORY_SETTINGS_KEY, JSON.stringify(settings));
};

export const loadPinnedProfile = (): DetectionProfile | null => parsePinnedProfile(read(PINNED_PROFILE_KEY));
export const savePinnedProfile = (profile: DetectionProfile | null): boolean =>
  write(PINNED_PROFILE_KEY, JSON.stringify(profile));

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
