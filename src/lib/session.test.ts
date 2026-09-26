import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadTheme, parseTheme, saveTheme, THEME_KEY } from './session';

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
