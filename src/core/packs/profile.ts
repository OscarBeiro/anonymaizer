import type { DetectedLanguage } from './languageProfiles';

/** Language context and document jurisdiction are selected independently. */
export interface DetectionProfile {
  readonly languages: readonly DetectedLanguage[];
  readonly jurisdictions: readonly string[];
}

export const DEFAULT_PROFILE: DetectionProfile = {
  languages: ['es', 'en'],
  jurisdictions: ['ES'],
};

/** Compatibility for the existing language-only API; it retains Spanish IDs. */
export const resolveProfile = (profile: DetectionProfile | readonly DetectedLanguage[]): DetectionProfile =>
  'languages' in profile ? profile : { languages: profile, jurisdictions: ['ES'] };
