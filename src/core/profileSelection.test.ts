import { describe, expect, it } from 'vitest';
import { enableJurisdictionPresets, parsePinnedProfile, suggestProfile } from './profileSelection';
import type { LanguageDetection } from './langDetect';
import type { DetectionProfile } from './packs/profile';

const detection = (languages: LanguageDetection['languages']): LanguageDetection => ({
  status: languages.length > 1 ? 'mixed' : languages.length ? 'detected' : 'undetermined',
  languages,
  ranked: [],
  paragraphs: [],
});

describe('parsePinnedProfile', () => {
  it.each([null, '{bad', '[]', '{}', '{"languages":[],"jurisdictions":"ES"}', '{"languages":null,"jurisdictions":[]}'])('rejects malformed storage %s', raw => {
    expect(parsePinnedProfile(raw)).toBeNull();
  });

  it('filters unknown IDs, deduplicates entries, and accepts explicit empty arrays', () => {
    expect(parsePinnedProfile('{"languages":["es","es","xx",3],"jurisdictions":["ES","ES","PT",null]}'))
      .toEqual({ languages: ['es'], jurisdictions: ['ES'] });
    expect(parsePinnedProfile('{"languages":[],"jurisdictions":[]}'))
      .toEqual({ languages: [], jurisdictions: [] });
  });
});

describe('suggestProfile', () => {
  it('combines mixed language detections and pins while deriving jurisdiction defaults', () => {
    expect(suggestProfile(detection(['es', 'pt']), null, 'en'))
      .toEqual({ languages: ['es', 'pt'], jurisdictions: ['ES'] });
    expect(suggestProfile(detection(['es', 'pt']), { languages: ['en'], jurisdictions: [] }, 'en'))
      .toEqual({ languages: ['es', 'pt', 'en'], jurisdictions: ['ES'] });
  });

  it('maps Galician to ES jurisdiction and Portuguese alone to no jurisdiction', () => {
    expect(suggestProfile(detection(['gl']), null, 'pt')).toEqual({ languages: ['gl'], jurisdictions: ['ES'] });
    expect(suggestProfile(detection(['pt']), null, 'es')).toEqual({ languages: ['pt'], jurisdictions: [] });
  });

  it('uses detected languages, then pins, then locale for undetermined text', () => {
    expect(suggestProfile(detection([]), { languages: ['pt'], jurisdictions: [] }, 'es'))
      .toEqual({ languages: ['pt'], jurisdictions: [] });
    expect(suggestProfile(detection([]), { languages: [], jurisdictions: [] }, 'gl-ES'))
      .toEqual({ languages: ['gl'], jurisdictions: ['ES'] });
  });

  it('unions explicit jurisdiction pins with inferred defaults, including after explicit empty arrays', () => {
    expect(suggestProfile(detection(['es']), { languages: [], jurisdictions: [] }, 'en'))
      .toEqual({ languages: ['es'], jurisdictions: ['ES'] });
  });
});

describe('enableJurisdictionPresets', () => {
  const empty: DetectionProfile = { languages: [], jurisdictions: [] };
  const es: DetectionProfile = { languages: ['es'], jurisdictions: ['ES'] };

  it('enables only categories from newly selected jurisdictions, preserving existing choices', () => {
    const settings = { DNI: false, EMAIL: false, PHONE: false, CUSTOM: true };
    expect(enableJurisdictionPresets(settings, empty, es)).toEqual({
      DNI: true, EMAIL: false, PHONE: true, CUSTOM: true,
      NIE: true, INVALID_ID: true, MASKED_ID: true, ID_CODE: true, ADDRESS: true,
    });
    expect(enableJurisdictionPresets(settings, es, es)).toEqual(settings);
  });

  it('does not overwrite settings or apply presets when jurisdictions are removed', () => {
    const settings = { DNI: false, EMAIL: false };
    expect(enableJurisdictionPresets(settings, es, empty)).toEqual(settings);
  });
});
