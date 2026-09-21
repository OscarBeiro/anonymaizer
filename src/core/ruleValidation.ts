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
 * D4: reverseText's restore regex is deliberately case-insensitive, so an
 * AI reply that echoes a placeholder in the wrong case still restores. The
 * cost is that a CATEGORY rule minting a placeholder from `targetCategory`
 * (kept verbatim, not normalized — see span.ts) is indistinguishable at
 * restore time from another rule whose category differs only in case:
 * `Custom` and `CUSTOM` both restore against the same `/custom_1/i` pattern,
 * and whichever mapping happens first in the array silently wins the other's
 * text. Rejecting the collision here, where the user is actively naming the
 * category and can see the error, is cheaper and more honest than silently
 * canonicalizing casing they chose on purpose.
 */
const findCaseCollision = (
  targetCategory: string,
  existingRules: CustomDictionaryRule[],
  excludeRuleId?: string,
): string | undefined =>
  existingRules.find(
    (r) =>
      r.id !== excludeRuleId &&
      r.replacementType === 'CATEGORY' &&
      r.targetCategory !== undefined &&
      r.targetCategory !== targetCategory &&
      r.targetCategory.toLowerCase() === targetCategory.toLowerCase(),
  )?.targetCategory;

/**
 * Validates the shape a rules editor (or an imported JSON file) hands us,
 * before it's trusted as a CustomDictionaryRule. Returns a human-readable
 * error, or null when valid.
 *
 * `existingRules` (the other rules already in the session, excluding the one
 * being edited via `excludeRuleId`) is used only to catch a case-only
 * collision between CATEGORY rules' `targetCategory` — see D4 above.
 */
export const validateRuleInput = (
  input: {
    termOrPattern: string;
    replacementType: string;
    targetCategory?: string;
    isRegex: boolean;
  },
  existingRules: CustomDictionaryRule[] = [],
  excludeRuleId?: string,
): string | null => {
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
  if (input.replacementType === 'CATEGORY' && input.targetCategory?.trim()) {
    const target = input.targetCategory.trim();
    const collidingWith = findCaseCollision(target, existingRules, excludeRuleId);
    if (collidingWith) {
      return `Category "${target}" differs only in case from existing category "${collidingWith}" — placeholders would be indistinguishable when restored.`;
    }
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
 * CustomDictionaryRule's shape, or if any two CATEGORY rules — one already
 * in the session, one newly imported, or both newly imported — collide on
 * `targetCategory` case-insensitively (D4). `existingRules` defaults to
 * empty for a standalone parse (as in the tests); the rules editor passes
 * the session's current rules so an import can't reintroduce the collision
 * the editor itself refuses to create.
 */
export const parseImportedRules = (
  json: string,
  existingRules: CustomDictionaryRule[] = [],
): CustomDictionaryRule[] => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (!Array.isArray(parsed)) throw new Error('Expected a JSON array of dictionary rules.');
  if (!parsed.every(isRule)) throw new Error('One or more rules have an invalid shape.');

  const seen = [...existingRules];
  for (const rule of parsed) {
    if (rule.replacementType === 'CATEGORY' && rule.targetCategory) {
      const collidingWith = findCaseCollision(rule.targetCategory, seen);
      if (collidingWith) {
        throw new Error(
          `Category "${rule.targetCategory}" differs only in case from existing category "${collidingWith}" — placeholders would be indistinguishable when restored.`,
        );
      }
    }
    seen.push(rule);
  }

  return parsed;
};
