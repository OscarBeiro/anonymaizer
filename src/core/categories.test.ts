import { describe, expect, it } from 'vitest';
import { anonymize, anonymizeWithNer } from './anonymize';
import {
  DEFAULT_CATEGORY_SETTINGS,
  TOGGLEABLE_CATEGORIES,
  isCategoryOn,
  parseCategorySettings,
  toggleableCategories,
  type CategorySettings,
} from './categories';
import { runAllDetectors } from './detectors';
import type { CustomDictionaryRule } from './types';

const TEXT =
  'Escribe a Mario Prieto Casal en mario@ticgal.com o al 612 345 678. DNI 45678912S. ' +
  'Según el artículo 5 de la Ley 39/2015, el Sr. Director firma el 12/03/2025.';

const allOff: CategorySettings = Object.fromEntries(TOGGLEABLE_CATEGORIES.map((c) => [c, false]));
const categoriesOf = (settings?: CategorySettings) => new Set(runAllDetectors(TEXT, settings).map((s) => s.category));

describe('DEFAULT_CATEGORY_SETTINGS', () => {
  it('keeps INVALID_ID and the acronym guesses on, and lists no shield', () => {
    expect(DEFAULT_CATEGORY_SETTINGS.INVALID_ID).toBe(true);
    expect(DEFAULT_CATEGORY_SETTINGS.COMPANY_ACRONYM).toBe(true);
    expect(TOGGLEABLE_CATEGORIES).not.toContain('SHIELD');
  });
});

describe('runAllDetectors with category settings', () => {
  it('a category switched off contributes no spans', () => {
    expect(categoriesOf()).toContain('EMAIL');
    expect(categoriesOf({ EMAIL: false })).not.toContain('EMAIL');
  });

  it('switching off NAME does not affect EMAIL', () => {
    const cats = categoriesOf({ NAME: false });
    expect(cats).not.toContain('NAME');
    expect(cats).toContain('EMAIL');
    expect(cats).toContain('PHONE');
  });

  it('shields still fire with every toggle off', () => {
    const spans = runAllDetectors(TEXT, allOff);
    expect(spans.length).toBeGreaterThan(0);
    expect(spans.every((s) => s.shield)).toBe(true);
  });

  it('COMPANY off also stops the acronym guesses; COMPANY_ACRONYM off stops only those', () => {
    const text = 'Firmamos con TICGAL y con Acme Soluciones S.L. ayer.';
    const acronyms = (settings?: CategorySettings) =>
      runAllDetectors(text, settings).filter((s) => s.text === 'TICGAL');
    expect(acronyms()).toHaveLength(1);
    expect(acronyms({ COMPANY_ACRONYM: false })).toHaveLength(0);
    expect(runAllDetectors(text, { COMPANY_ACRONYM: false }).some((s) => s.category === 'COMPANY')).toBe(true);
    expect(runAllDetectors(text, { COMPANY: false }).some((s) => s.category === 'COMPANY')).toBe(false);
  });

  it('INVALID_ID and DNI toggle independently', () => {
    const text = 'DNI 45678912S y otro 45678912A.';
    const cats = (settings?: CategorySettings) => runAllDetectors(text, settings).map((s) => s.category).sort();
    expect(cats()).toEqual(['DNI', 'INVALID_ID']);
    expect(cats({ INVALID_ID: false })).toEqual(['DNI']);
    expect(cats({ DNI: false })).toEqual(['INVALID_ID']);
  });
});

describe('anonymize with category settings', () => {
  const rules: CustomDictionaryRule[] = [
    { id: '1', termOrPattern: 'Proyecto Alfa', replacementType: 'CATEGORY', targetCategory: 'PROJECT_NAME', isRegex: false },
    { id: '2', termOrPattern: 'Beta', replacementType: 'FIXED', isRegex: false },
  ];
  const text = 'Proyecto Alfa y Beta, contacto mario@ticgal.com';

  it('skips dictionary rules whose category is switched off', () => {
    const cats = (s?: CategorySettings) => anonymize(text, rules, s).mappings.map((m) => m.category).sort();
    expect(cats()).toEqual(['CUSTOM', 'EMAIL', 'PROJECT_NAME']);
    expect(cats({ PROJECT_NAME: false })).toEqual(['CUSTOM', 'EMAIL']);
    expect(cats({ CUSTOM: false })).toEqual(['EMAIL', 'PROJECT_NAME']);
  });

  it('drops NER entities of a switched-off category', () => {
    const source = 'Hablé con Lucía ayer.';
    const start = source.indexOf('Lucía');
    const entities = [{ entityGroup: 'PER', score: 0.99, start, end: start + 5, text: 'Lucía' }];
    expect(anonymizeWithNer(source, [], entities).mappings.map((m) => m.category)).toContain('NAME');
    expect(anonymizeWithNer(source, [], entities, { NAME: false }).mappings).toHaveLength(0);
  });
});

describe('toggleableCategories', () => {
  it('is the built-ins plus each distinct CATEGORY rule target, built-ins first', () => {
    const rules: CustomDictionaryRule[] = [
      { id: '1', termOrPattern: 'a', replacementType: 'CATEGORY', targetCategory: 'PROJECT_NAME', isRegex: false },
      { id: '2', termOrPattern: 'b', replacementType: 'CATEGORY', targetCategory: 'PROJECT_NAME', isRegex: false },
      { id: '3', termOrPattern: 'c', replacementType: 'CATEGORY', targetCategory: 'EMAIL', isRegex: false },
      { id: '4', termOrPattern: 'd', replacementType: 'FIXED', isRegex: false },
    ];
    expect(toggleableCategories(rules)).toEqual([...TOGGLEABLE_CATEGORIES, 'PROJECT_NAME']);
  });
});

describe('parseCategorySettings', () => {
  const known = [...TOGGLEABLE_CATEGORIES, 'PROJECT_NAME'];

  it('round-trips what was saved', () => {
    const saved: CategorySettings = { NAME: false, PROJECT_NAME: false, EMAIL: true };
    expect(parseCategorySettings(JSON.stringify(saved), known)).toEqual(saved);
  });

  it('ignores a key naming a category that no longer exists, and non-boolean values', () => {
    expect(parseCategorySettings(JSON.stringify({ GONE: false, NAME: 'no', EMAIL: false }), known)).toEqual({ EMAIL: false });
  });

  it('leaves a missing key to its default', () => {
    const settings = parseCategorySettings(JSON.stringify({ NAME: false }), known);
    expect(isCategoryOn(settings, 'EMAIL')).toBe(true);
    expect(isCategoryOn(settings, 'PROJECT_NAME')).toBe(true);
    expect(isCategoryOn(settings, 'NAME')).toBe(false);
  });

  it('returns an empty map for nothing stored or garbage', () => {
    expect(parseCategorySettings(null, known)).toEqual({});
    expect(parseCategorySettings('{not json', known)).toEqual({});
    expect(parseCategorySettings('[1,2]', known)).toEqual({});
  });
});
