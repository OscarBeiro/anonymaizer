import { expect, it } from 'vitest';
import { GALICIAN_PACK } from './gl';
it('ships Galician vocabulary without changing jurisdiction identifiers', () => {
  expect(GALICIAN_PACK.greetings).toContain('Saúdos');
  expect(GALICIAN_PACK.companyPrefixes).toContain('Deputación');
  expect(new Set(GALICIAN_PACK.stopwords).size).toBe(GALICIAN_PACK.stopwords.length);
});
