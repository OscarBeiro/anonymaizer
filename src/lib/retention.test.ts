import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { acceptGeneration, clearRetained, setRemembered, writerCurrent } from './retention';
import { loadSession, saveDictionaryRules, saveSession } from './session';
const data = new Map<string, string>();
beforeEach(() => {
  data.clear();
  vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v), removeItem: (k: string) => data.delete(k), key: (i: number) => [...data.keys()][i] ?? null, get length() { return data.size; } });
  acceptGeneration();
});
afterEach(() => vi.unstubAllGlobals());
const session = { sessionId: 's', createdAt: '', inputType: 'PASTE' as const, originalFormat: 'raw_text' as const, rawMarkdown: 'private', anonymizedMarkdown: 'private', mappings: [] };
it('defaults to no sensitive persistence and separates dictionary consent', () => {
  saveSession(session); saveDictionaryRules([{ id: '1', termOrPattern: 'secret', isRegex: false, replacementType: 'FIXED' }]);
  expect(data.size).toBe(0);
  setRemembered('document', true); saveSession(session);
  expect(loadSession()?.rawMarkdown).toBe('private');
  expect(data.has('anonymaizer.dictionaryRules')).toBe(false);
  setRemembered('document', false); expect(data.has('anonymaizer.session')).toBe(false);
});
it('revokes suspended writers and refuses stale-generation session payloads', () => {
  setRemembered('document', true); saveSession(session);
  const old = data.get('anonymaizer.session')!;
  data.set('anonymaizer.storageGeneration', 'other-tab-cleared');
  expect(writerCurrent()).toBe(false);
  expect(saveSession(session)).toBe(false);
  data.set('anonymaizer.session', old);
  expect(loadSession()).toBeNull();
  acceptGeneration(); expect(clearRetained()).toBe(true);
  expect([...data.keys()]).toEqual(['anonymaizer.storageGeneration']);
});
it('handles blocked storage reads and writes without persisting sensitive content', () => {
  vi.stubGlobal('localStorage', { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } });
  expect(loadSession()).toBeNull(); expect(setRemembered('document', true)).toBe(false); expect(clearRetained()).toBe(false);
});
