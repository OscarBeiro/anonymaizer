import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearLocalData,
  LOCAL_KEY_PREFIX,
  loadAppMode,
  loadRestoreFormat,
  saveRestoreFormat,
  parseAppMode,
  saveAppMode,
  loadTheme,
  parseTheme,
  saveCategorySettings,
  saveDictionaryRules,
  saveMoneyRange,
  saveOutputMode,
  saveSession,
  saveStep,
  saveTheme,
  THEME_KEY,
} from './session';

const memoryStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
};

describe('theme preference', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it('defaults to system', () => {
    expect(loadTheme()).toBe('system');
  });

  it('round-trips each state', () => {
    for (const t of ['light', 'dark', 'system'] as const) {
      saveTheme(t);
      expect(loadTheme()).toBe(t);
    }
  });

  it('tolerates a stored value that is not one of the three', () => {
    localStorage.setItem(THEME_KEY, 'solarized');
    expect(loadTheme()).toBe('system');
    expect(parseTheme('"dark"')).toBe('system');
    expect(parseTheme(null)).toBe('system');
  });
});

describe('app mode', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it('defaults to standard on a first visit', () => {
    expect(loadAppMode()).toBe('standard');
  });

  it('round-trips both modes', () => {
    for (const m of ['advanced', 'standard'] as const) {
      saveAppMode(m);
      expect(loadAppMode()).toBe(m);
    }
  });

  it('falls back to standard on a corrupt value', () => {
    localStorage.setItem('anonymaizer.appMode', 'expert');
    expect(loadAppMode()).toBe('standard');
    expect(parseAppMode('"advanced"')).toBe('standard');
  });
});

describe('restore format', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it('defaults to markdown, round-trips, and rejects junk', () => {
    expect(loadRestoreFormat()).toBe('markdown');
    for (const f of ['plain', 'html', 'markdown'] as const) {
      saveRestoreFormat(f);
      expect(loadRestoreFormat()).toBe(f);
    }
    localStorage.setItem('anonymaizer.restoreFormat', 'pdf');
    expect(loadRestoreFormat()).toBe('markdown');
  });
});

describe('clearLocalData', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it('leaves no anonymaizer.-prefixed key behind, and nothing else touched', () => {
    saveSession({
      sessionId: 's',
      createdAt: '',
      inputType: 'PASTE',
      originalFormat: 'raw_text',
      mappings: [],
      rawMarkdown: 'x',
      anonymizedMarkdown: 'x',
    });
    saveDictionaryRules([]);
    saveStep('review');
    saveCategorySettings({});
    saveOutputMode('realistic');
    saveMoneyRange({ min: 5, max: 10 });
    saveTheme('dark');
    saveAppMode('advanced');
    localStorage.setItem('anonymaizer.someFutureKey', '1');
    localStorage.setItem('other-app', 'keep');

    clearLocalData();

    const left = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i));
    expect(left.filter((k) => k?.startsWith(LOCAL_KEY_PREFIX))).toEqual([]);
    expect(left).toEqual(['other-app']);
  });
});
