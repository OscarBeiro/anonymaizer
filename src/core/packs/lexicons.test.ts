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

  it('returns no heuristic vocabulary for a language without a pack', () => {
    const fr = languageLexicon(['fr']);
    for (const value of Object.values(fr)) {
      expect(value).toEqual(typeof value === 'string' ? '' : []);
    }
  });

  it.each([
    ['pt', 'Segunda', 'Rua', 'Lda'],
    ['ca', 'Dilluns', 'Carrer', 'SCCL'],
    ['eu', 'Astelehena', 'Kalea', 'Udala'],
  ])('ships real %s vocabulary without Spanish weekday or street words', (language, weekday, street, suffix) => {
    const lexicon = languageLexicon([language]);
    expect(lexicon.stopwords).toContain(weekday);
    expect(lexicon.streetKeywords).toContain(street);
    expect([...lexicon.companySuffixes, ...lexicon.companyPrefixes].join('|')).toContain(suffix);
    expect(lexicon.stopwords).not.toContain('Lunes');
  });

  it('adds Galician company prefixes and vocabulary for Galician', () => {
    const gl = languageLexicon(['gl']);
    expect(gl.companyPrefixes).toContain('Xunta');
    expect(gl.companyPrefixes).toContain('Deputación');
    expect(gl.stopwords).toContain('Saúdos');
  });
});
