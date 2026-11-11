import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { acceptGeneration, clearRetained, setRemembered, writerCurrent } from './retention';
import { loadDictionaryRules, loadSession, loadStep, saveDictionaryRules, saveSession, saveStep } from './session';
const data = new Map<string, string>();
beforeEach(() => {
  data.clear();
  vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v), removeItem: (k: string) => data.delete(k), key: (i: number) => [...data.keys()][i] ?? null, get length() { return data.size; } });
  acceptGeneration();
});
afterEach(() => vi.unstubAllGlobals());
const session = { sessionId: 's', createdAt: '', inputType: 'PASTE' as const, originalFormat: 'raw_text' as const, rawMarkdown: 'private', anonymizedMarkdown: 'private', mappings: [] };
it('saves the document and the rules by default, and each can be turned off on its own', () => {
  const rules = [{ id: '1', termOrPattern: 'secret', isRegex: false, replacementType: 'FIXED' as const }];
  saveSession(session); saveDictionaryRules(rules);
  expect(loadSession()?.rawMarkdown).toBe('private');
  expect(loadDictionaryRules()).toEqual(rules);
  expect(loadStep()).toBe('ingest');
  saveStep('review'); expect(loadStep()).toBe('review');

  // Turning the document off deletes it and stops further saves; rules stay.
  expect(setRemembered('document', false)).toBe(true);
  expect(data.has('anonymaizer.session')).toBe(false);
  expect(saveSession(session)).toBe(true);
  expect(data.has('anonymaizer.session')).toBe(false);
  expect(loadStep()).toBe('ingest');
  expect(loadDictionaryRules()).toEqual(rules);

  expect(setRemembered('rules', false)).toBe(true);
  saveDictionaryRules(rules);
  expect(data.has('anonymaizer.dictionaryRules')).toBe(false);

  setRemembered('document', true); saveSession(session);
  expect(loadSession()?.rawMarkdown).toBe('private');
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
