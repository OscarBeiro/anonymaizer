import { useSyncExternalStore } from 'react';
import { resolveLocale, resolvePreferredLocale } from './core/locale';
import source from './locales/en.json';

// Bundled at build time: switching languages never downloads anything.
const modules = import.meta.glob<{ default: Record<string, string> }>('./locales/*.json', { eager: true });
const catalogs = Object.fromEntries(Object.entries(modules).map(([path, module]) => [path.split('/').pop()!.replace('.json', ''), module.default]));
export const UI_LOCALES = Object.keys(catalogs).sort();
export const LANGUAGE_NAMES: Record<string, string> = { en: 'English', gl: 'Galego' };
export type TranslationKey = keyof typeof source;
export type LanguagePreference = 'auto' | string;
export const LANGUAGE_STORAGE_KEY = 'anonymaizer.uiLanguage';
const listeners = new Set<() => void>();
const browserLanguages = () => typeof navigator === 'undefined' ? ['en'] : navigator.languages?.length ? navigator.languages : [navigator.language];
export function loadLanguagePreference(): LanguagePreference {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return saved && UI_LOCALES.includes(saved) ? saved : 'auto';
  } catch { return 'auto'; }
}
let preference = loadLanguagePreference();
const detect = () => preference === 'auto' ? resolvePreferredLocale(browserLanguages(), UI_LOCALES) : resolveLocale(preference, UI_LOCALES);
let locale = detect();
const publish = () => {
  locale = detect();
  if (typeof document !== 'undefined') document.documentElement.lang = locale.replace(/_/g, '-');
  document.documentElement.dir = 'ltr';
  listeners.forEach(listener => listener());
};
export function setLanguagePreference(next: LanguagePreference) {
  preference = next === 'auto' || UI_LOCALES.includes(next) ? next : 'auto';
  try {
    if (preference === 'auto') localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    else localStorage.setItem(LANGUAGE_STORAGE_KEY, preference);
  } catch { /* Still switch in memory when browser storage is unavailable. */ }
  publish();
}
export const getLocale = () => locale;
export const getLanguagePreference = () => preference;
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function useLocale() { return useSyncExternalStore(subscribe, getLocale, () => 'en'); }
export function useLanguagePreference() { return useSyncExternalStore(subscribe, getLanguagePreference, () => 'auto'); }
export function t(key: TranslationKey, params: Record<string, string | number> = {}, language = locale): string {
  const text = catalogs[language]?.[key] || source[key];
  return text.replace(/\{(\w+)\}/g, (token, name: string) => Object.hasOwn(params, name) ? String(params[name]) : token);
}
if (typeof window !== 'undefined') {
  window.addEventListener('languagechange', () => { if (preference === 'auto') publish(); });
  window.addEventListener('storage', event => { if (event.key === LANGUAGE_STORAGE_KEY || event.key === null) { preference = loadLanguagePreference(); publish(); } });
  publish();
}

export function categoryLabel(category: string): string {
  const key = `category.${category}`;
  return Object.hasOwn(source, key) ? t(key as TranslationKey) : category;
}
