import { expect, it } from 'vitest';
import { DEFAULT_PROFILE, resolveProfile } from './profile';

it('keeps the default languages and jurisdiction explicit', () => {
  expect(DEFAULT_PROFILE).toEqual({ languages: ['es', 'en'], jurisdictions: ['ES'] });
});
it('resolves old language lists without inventing a jurisdiction from the language', () => {
  expect(resolveProfile(['gl'])).toEqual({ languages: ['gl'], jurisdictions: ['ES'] });
  const profile = { languages: ['pt'] as const, jurisdictions: ['PT'] };
  expect(resolveProfile(profile)).toBe(profile);
});
