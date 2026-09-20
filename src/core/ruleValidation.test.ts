import { describe, expect, it } from 'vitest';
import { isValidRegexPattern, parseImportedRules, validateRuleInput } from './ruleValidation';

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
});
