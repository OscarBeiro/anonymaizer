import { describe, expect, it } from 'vitest';
import { isValidRegexPattern, parseImportedRules, validateRuleInput } from './ruleValidation';
import type { CustomDictionaryRule } from './types';

describe('isValidRegexPattern', () => {
  it('accepts a valid pattern', () => {
    expect(isValidRegexPattern('PRJ-\\d+')).toBe(true);
  });

  it('rejects an invalid pattern', () => {
    expect(isValidRegexPattern('[unclosed')).toBe(false);
  });
});

describe('validateRuleInput', () => {
  const base = { termOrPattern: 'Project Alpha', replacementType: 'FIXED', isRegex: false };

  it('accepts a valid FIXED literal rule', () => {
    expect(validateRuleInput(base)).toBeNull();
  });

  it('requires a non-empty term', () => {
    expect(validateRuleInput({ ...base, termOrPattern: '  ' })).toMatch(/required/i);
  });

  it('requires a target category for CATEGORY rules', () => {
    expect(validateRuleInput({ ...base, replacementType: 'CATEGORY' })).toMatch(/category/i);
  });

  it('accepts a CATEGORY rule with a target category', () => {
    expect(validateRuleInput({ ...base, replacementType: 'CATEGORY', targetCategory: 'PROJECT_NAME' })).toBeNull();
  });

  it('rejects an invalid regex pattern when isRegex is true', () => {
    expect(validateRuleInput({ ...base, termOrPattern: '[unclosed', isRegex: true })).toMatch(/regular expression/i);
  });

  it('rejects an unknown replacement type', () => {
    expect(validateRuleInput({ ...base, replacementType: 'BOGUS' })).toMatch(/FIXED or CATEGORY/);
  });

  describe('D4 — case-only category collisions', () => {
    const existing: CustomDictionaryRule[] = [
      { id: 'r1', termOrPattern: 'Acme', replacementType: 'CATEGORY', targetCategory: 'Custom', isRegex: false },
    ];

    it('rejects a new rule whose category differs only in case from an existing one', () => {
      const result = validateRuleInput(
        { ...base, replacementType: 'CATEGORY', targetCategory: 'CUSTOM' },
        existing,
      );
      expect(result).toMatch(/differs only in case/i);
      expect(result).toContain('CUSTOM');
      expect(result).toContain('Custom');
    });

    it('accepts a new rule whose category matches an existing one exactly', () => {
      const result = validateRuleInput(
        { ...base, replacementType: 'CATEGORY', targetCategory: 'Custom' },
        existing,
      );
      expect(result).toBeNull();
    });

    it('accepts a distinct category with no collision', () => {
      const result = validateRuleInput(
        { ...base, replacementType: 'CATEGORY', targetCategory: 'PROJECT_NAME' },
        existing,
      );
      expect(result).toBeNull();
    });

    it('does not flag a rule against itself when editing (excludeRuleId)', () => {
      const result = validateRuleInput(
        { ...base, replacementType: 'CATEGORY', targetCategory: 'Custom' },
        existing,
        'r1',
      );
      expect(result).toBeNull();
    });

    it('ignores FIXED rules when checking for category collisions', () => {
      const fixedOnly: CustomDictionaryRule[] = [
        { id: 'r2', termOrPattern: 'Beta', replacementType: 'FIXED', isRegex: false },
      ];
      const result = validateRuleInput(
        { ...base, replacementType: 'CATEGORY', targetCategory: 'CUSTOM' },
        fixedOnly,
      );
      expect(result).toBeNull();
    });
  });
});

describe('parseImportedRules', () => {
  it('parses a valid rules array', () => {
    const json = JSON.stringify([
      { id: '1', termOrPattern: 'Alpha', replacementType: 'FIXED', isRegex: false },
    ]);
    expect(parseImportedRules(json)).toHaveLength(1);
  });

  it('rejects invalid JSON', () => {
    expect(() => parseImportedRules('{not json')).toThrow(/JSON/);
  });

  it('rejects a non-array payload', () => {
    expect(() => parseImportedRules('{"a":1}')).toThrow(/array/i);
  });

  it('rejects the whole import if any rule has an invalid shape', () => {
    const json = JSON.stringify([
      { id: '1', termOrPattern: 'Alpha', replacementType: 'FIXED', isRegex: false },
      { id: '2', termOrPattern: '', replacementType: 'FIXED', isRegex: false },
    ]);
    expect(() => parseImportedRules(json)).toThrow(/invalid shape/i);
  });

  describe('D4 — case-only category collisions', () => {
    it('rejects an import where two of its own rules collide only in case', () => {
      const json = JSON.stringify([
        { id: '1', termOrPattern: 'Alpha', replacementType: 'CATEGORY', targetCategory: 'Custom', isRegex: false },
        { id: '2', termOrPattern: 'Beta', replacementType: 'CATEGORY', targetCategory: 'CUSTOM', isRegex: false },
      ]);
      expect(() => parseImportedRules(json)).toThrow(/differs only in case/i);
    });

    it('rejects an import that collides with a rule already in the session', () => {
      const existing: CustomDictionaryRule[] = [
        { id: 'r1', termOrPattern: 'Acme', replacementType: 'CATEGORY', targetCategory: 'Custom', isRegex: false },
      ];
      const json = JSON.stringify([
        { id: '1', termOrPattern: 'Alpha', replacementType: 'CATEGORY', targetCategory: 'CUSTOM', isRegex: false },
      ]);
      expect(() => parseImportedRules(json, existing)).toThrow(/differs only in case/i);
    });

    it('accepts an import with distinct categories', () => {
      const json = JSON.stringify([
        { id: '1', termOrPattern: 'Alpha', replacementType: 'CATEGORY', targetCategory: 'Custom', isRegex: false },
        { id: '2', termOrPattern: 'Beta', replacementType: 'CATEGORY', targetCategory: 'PROJECT_NAME', isRegex: false },
      ]);
      expect(parseImportedRules(json)).toHaveLength(2);
    });
  });
});
