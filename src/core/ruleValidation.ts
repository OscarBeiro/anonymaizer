import type { CustomDictionaryRule } from './types';

export const isValidRegexPattern = (pattern: string): boolean => {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validates the shape a rules editor (or an imported JSON file) hands us,
 * before it's trusted as a CustomDictionaryRule. Returns a human-readable
 * error, or null when valid.
 */
export const validateRuleInput = (input: {
  termOrPattern: string;
  replacementType: string;
  targetCategory?: string;
  isRegex: boolean;
}): string | null => {
  if (!input.termOrPattern.trim()) return 'Term or pattern is required.';
  if (input.replacementType !== 'FIXED' && input.replacementType !== 'CATEGORY') {
    return 'Replacement type must be FIXED or CATEGORY.';
  }
  if (input.replacementType === 'CATEGORY' && !input.targetCategory?.trim()) {
    return 'A target category is required for CATEGORY rules.';
  }
  if (input.isRegex && !isValidRegexPattern(input.termOrPattern)) {
    return 'Not a valid regular expression.';
  }
  return null;
};

const isRule = (value: unknown): value is CustomDictionaryRule => {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.termOrPattern === 'string' &&
    (r.replacementType === 'FIXED' || r.replacementType === 'CATEGORY') &&
    typeof r.isRegex === 'boolean' &&
    (r.targetCategory === undefined || typeof r.targetCategory === 'string') &&
    validateRuleInput({
      termOrPattern: r.termOrPattern,
      replacementType: r.replacementType,
      targetCategory: r.targetCategory as string | undefined,
      isRegex: r.isRegex,
    }) === null
  );
};

/**
 * Parses an imported JSON file's content into rules, rejecting the whole
 * import (not a partial, silently-lossy one) if anything doesn't match
 * CustomDictionaryRule's shape.
 */
export const parseImportedRules = (json: string): CustomDictionaryRule[] => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (!Array.isArray(parsed)) throw new Error('Expected a JSON array of dictionary rules.');
  if (!parsed.every(isRule)) throw new Error('One or more rules have an invalid shape.');
  return parsed;
};
