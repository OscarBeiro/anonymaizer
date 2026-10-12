const GENERATION = 'anonymaizer.storageGeneration';
const DOCUMENT = 'anonymaizer.rememberDocument';
const RULES = 'anonymaizer.rememberRules';
const get = (key: string): string | null => { try { return localStorage.getItem(key); } catch { return null; } };
export const remembered = (kind: 'document' | 'rules'): boolean => get(kind === 'document' ? DOCUMENT : RULES) === 'true';
export const generation = (): string | null => get(GENERATION);
// Every sensitive writer captures its generation at module startup. A tab that
// missed an event still fails closed before its next write.
let writerGeneration = generation();
export const writerCurrent = (): boolean => generation() === writerGeneration;
export const acceptGeneration = (): void => { writerGeneration = generation(); };
export const setRemembered = (kind: 'document' | 'rules', enabled: boolean): boolean => {
  if (!writerCurrent()) return false;
  try {
    localStorage.setItem(kind === 'document' ? DOCUMENT : RULES, String(enabled));
    if (!enabled) localStorage.removeItem(kind === 'document' ? 'anonymaizer.session' : 'anonymaizer.dictionaryRules');
    return true;
  } catch { return false; }
};
export const clearRetained = (): boolean => {
  try {
    const next = crypto.randomUUID();
    localStorage.setItem(GENERATION, next); // revoke writers before deletion
    const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i));
    for (const key of keys) if (key?.startsWith('anonymaizer.') && key !== GENERATION) localStorage.removeItem(key);
    writerGeneration = next;
    return true;
  } catch { return false; }
};
export const legacyRetentionPresent = (): boolean => !remembered('document') && get('anonymaizer.session') !== null;
