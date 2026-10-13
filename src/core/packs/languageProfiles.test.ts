import { expect, it } from 'vitest';
import { LANGUAGE_PROFILES } from './languageProfiles';

it.each(Object.entries(LANGUAGE_PROFILES))('%s profiles contain distinct, normalized words and stateless hints', (_lang, profile) => {
  expect(new Set(profile.profileWords).size).toBe(profile.profileWords.length);
  for (const word of profile.profileWords) {
    expect(word).toBe(word.normalize('NFC').toLowerCase());
    expect(word).toMatch(/^\p{L}+$/u);
  }
  for (const hint of profile.characterHints) {
    expect(hint.global).toBe(false);
    expect(hint.sticky).toBe(false);
  }
});
