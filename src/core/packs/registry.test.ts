import { expect, it } from 'vitest';
import { LANGUAGE_PACKS } from './registry';
import { LANGUAGE_PROFILES } from './languageProfiles';

it('registers implemented rule languages separately from suggestion profiles', () => {
  expect(Object.keys(LANGUAGE_PACKS)).toEqual(['en', 'es', 'gl']);
  expect(LANGUAGE_PACKS.pt).toBeUndefined();
  for (const pack of Object.values(LANGUAGE_PACKS)) {
    expect(pack.profileWords).toEqual(LANGUAGE_PROFILES[pack.id].profileWords);
    expect(pack.stopwords).toEqual(pack.lexicon.stopwords);
  }
});
