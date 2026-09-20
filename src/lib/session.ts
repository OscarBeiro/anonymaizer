import type { CustomDictionaryRule, MappingSession } from '../core/types';

const SESSION_KEY = 'anonymaizer.session';
const RULES_KEY = 'anonymaizer.dictionaryRules';

export const loadSession = (): MappingSession | null => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as MappingSession) : null;
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

export const newSessionId = (): string =>
  `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
