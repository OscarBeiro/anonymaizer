import { describe, expect, it } from 'vitest';
import { languageLexicon, LEGACY_LEXICON } from './lexicons';

describe('detector language lexicons', () => {
  it('preserves the legacy default arrays and regex strings exactly', () => {
    expect(languageLexicon(['en', 'es'])).toEqual(LEGACY_LEXICON);
    expect(languageLexicon(['en', 'es'])).toBe(LEGACY_LEXICON);
    expect(LEGACY_LEXICON.companySuffixes).toEqual([
      'S\\.L\\.U\\.', 'S\\.A\\.U\\.', 'S\\.Coop\\.', 'S\\.L\\.', 'S\\.A\\.', 'SLU', 'SAU', 'SCP', 'SL', 'SA',
      'Inc\\.', 'Inc', 'Ltd\\.', 'Ltd', 'LLC', 'LLP', 'Corp\\.', 'Corp', 'PLC', 'GmbH', 'AG', 'mbH', 'BV', 'NV', 'SAS', 'SARL', 'Lda', 'Ltda', 'Oy', 'AB', 'A\\/S', 'Pty',
    ]);
    expect(LEGACY_LEXICON.legalContinuation).toBe('(?:de|del|la|las|los|y|\\p{Lu}\\p{L}*|\\d+(?:\\/(?:\\d+|CE|UE))*)');
    expect(LEGACY_LEXICON.institutionContinuation).toBe('(?:de|del|la|las|los|\\p{Lu}\\p{L}*|\\d+)');
  });

  it('keeps Spanish vocabulary out of English-only heuristics', () => {
    const en = languageLexicon(['en']);
    expect(en.companyPrefixes).not.toContain('Grupo');
    expect(en.stopwords).not.toContain('Saludos');
    expect(en.streetKeywords).toEqual(['Street', 'Avenue', 'Road', 'Rd']);
    expect(en.streetKeywords).not.toContain('Calle');
  });

  it('returns no heuristic vocabulary for unsupported Portuguese', () => {
    const pt = languageLexicon(['pt']);
    for (const value of Object.values(pt)) {
      expect(value).toEqual(typeof value === 'string' ? '' : []);
    }
  });

  it('adds Galician company prefixes and vocabulary for Galician', () => {
    const gl = languageLexicon(['gl']);
    expect(gl.companyPrefixes).toContain('Xunta');
    expect(gl.companyPrefixes).toContain('Deputación');
    expect(gl.stopwords).toContain('Saúdos');
  });
});
