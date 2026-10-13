import { describe, expect, it } from 'vitest';
import { detectLocations } from './locations';
import { detectSpanishPostalAddressFragments } from './locations';
import { runAllDetectors } from './detectors';
import { TOGGLEABLE_CATEGORIES } from './categories';

describe('detectLocations', () => {
  it('finds common countries, cities, regions and provinces with exact source offsets', () => {
    const text = 'Office: Madrid, Galicia, Spain; branch: New York, United States.';
    expect(detectLocations(text).map(({ text: value, start, end }) => [value, text.slice(start, end)])).toEqual([
      ['Madrid', 'Madrid'],
      ['Galicia', 'Galicia'],
      ['Spain', 'Spain'],
      ['New York', 'New York'],
      ['United States', 'United States'],
    ]);
  });

  it('matches accented and Galician place names', () => {
    const text = 'Vigo e Santiago de Compostela están en A Coruña.';
    expect(detectLocations(text).map((span) => span.text)).toEqual(['Vigo', 'Santiago de Compostela', 'A Coruña']);
  });

  it('recognizes localized country names and uppercase spellings', () => {
    expect(detectLocations('Vive en España y viaja a ESTADOS UNIDOS.').map((span) => span.text))
      .toEqual(['España', 'ESTADOS UNIDOS']);
  });

  it('anchors a Spanish postal code to a known locality or an explicit label', () => {
    expect(detectSpanishPostalAddressFragments('36003 Pontevedra, Galicia, España').map((span) => span.text))
      .toEqual(['36003 Pontevedra']);
    expect(detectSpanishPostalAddressFragments('CP: 36003; unrelated 12345').map((span) => span.text))
      .toEqual(['36003']);
    expect(detectSpanishPostalAddressFragments('12345 is just a number.')).toEqual([]);
  });

  it('requires context for ambiguous names and avoids splitting a person name', () => {
    expect(detectLocations('Jordan Smith joined the team in Georgia.').map((span) => span.text)).toEqual(['Georgia']);
    expect(detectLocations('Paris called Jordan yesterday.')).toEqual([]);
    expect(detectLocations('Marín López presented the report.')).toEqual([]);
  });

  it('uses whole-name boundaries and leaves unlisted locations alone', () => {
    expect(detectLocations('The Madridista office is in an unlisted village.')).toEqual([]);
  });

  it('runs by default and can be disabled through category settings', () => {
    const text = 'Our office is in Madrid.';
    expect(runAllDetectors(text).some((span) => span.category === 'LOCATION' && span.text === 'Madrid')).toBe(true);
    expect(runAllDetectors(text, { LOCATION: false }).some((span) => span.category === 'LOCATION')).toBe(false);
    expect(TOGGLEABLE_CATEGORIES).toContain('LOCATION');
  });
});
