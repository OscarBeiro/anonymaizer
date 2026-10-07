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
  loadPseudonymLang,
  savePseudonymLang,
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

describe('pseudonym language (U6)', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it('defaults to es, round-trips en, and falls back on garbage', () => {
    expect(loadPseudonymLang()).toBe('es');
    savePseudonymLang('en');
    expect(loadPseudonymLang()).toBe('en');
    localStorage.setItem('anonymaizer.pseudonymLang', 'klingon');
    expect(loadPseudonymLang()).toBe('es');
  });
});

describe('storage quota (L1)', () => {
  const session = {
    sessionId: 's',
    createdAt: '',
    inputType: 'PASTE' as const,
    originalFormat: 'raw_text' as const,
    mappings: [],
    rawMarkdown: 'x',
    anonymizedMarkdown: 'x',
  };
  const quotaStorage = () => {
    const base = memoryStorage();
    return {
      ...base,
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError');
      },
    };
  };
  afterEach(() => vi.unstubAllGlobals());

  it('saveSession reports false and does not throw when the quota is exceeded', () => {
    vi.stubGlobal('localStorage', quotaStorage());
    expect(saveSession(session)).toBe(false);
  });

  it('a failed save drops the stale stored copy', () => {
    const store = memoryStorage();
    store.setItem('anonymaizer.session', '{"old":true}');
    vi.stubGlobal('localStorage', { ...store, setItem: () => { throw new Error('full'); } });
    expect(saveSession(session)).toBe(false);
    expect(store.getItem('anonymaizer.session')).toBeNull();
  });

  it('the small settings savers do not throw either', () => {
    vi.stubGlobal('localStorage', quotaStorage());
    expect(() => {
      saveStep('review');
      saveOutputMode('realistic');
      saveDictionaryRules([]);
      saveCategorySettings({});
      saveTheme('dark');
    }).not.toThrow();
  });

  it('saveSession reports true on success', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    expect(saveSession(session)).toBe(true);
  });
});
