import { JURISDICTION_PACKS } from './detectors';
import type { CategorySettings } from './categories';
import { resolveLocale } from './locale';
import type { LanguageDetection } from './langDetect';
import { LANGUAGE_PROFILES, type DetectedLanguage } from './packs/languageProfiles';
import type { DetectionProfile } from './packs/profile';

export type PinnedProfile = DetectionProfile;

const supportedLanguages = Object.keys(LANGUAGE_PROFILES) as DetectedLanguage[];
const supportedJurisdictions = Object.keys(JURISDICTION_PACKS);

/** Parse persisted pack choices, discarding IDs that this build does not know. */
export const parsePinnedProfile = (raw: string | null): DetectionProfile | null => {
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
  const value = parsed as Record<string, unknown>;
  if (!Array.isArray(value.languages) || !Array.isArray(value.jurisdictions)) return null;
  return {
    languages: [...new Set(value.languages.filter((id): id is DetectedLanguage =>
      typeof id === 'string' && supportedLanguages.includes(id as DetectedLanguage)))],
    jurisdictions: [...new Set(value.jurisdictions.filter((id): id is string =>
      typeof id === 'string' && supportedJurisdictions.includes(id)))],
  };
};

/** Combine detected and pinned language suggestions, then infer available jurisdictions. */
export const suggestProfile = (
  detection: LanguageDetection,
  pinned: DetectionProfile | null,
  uiLocale: string,
): DetectionProfile => {
  const detected = [...new Set(detection.languages)];
  const pinnedLanguages = [...new Set(pinned?.languages ?? [])];
  let languages: DetectedLanguage[];
  if (detected.length) languages = [...new Set([...detected, ...pinnedLanguages])];
  else if (pinnedLanguages.length) languages = pinnedLanguages;
  else languages = [resolveLocale(uiLocale, supportedLanguages) as DetectedLanguage];

  const defaults = Object.values(JURISDICTION_PACKS)
    .filter(pack => pack.defaultLanguages.some(language => languages.includes(language)))
    .map(pack => pack.id);
  return {
    languages,
    jurisdictions: [...new Set([...defaults, ...(pinned?.jurisdictions ?? [])])]
      .filter(id => supportedJurisdictions.includes(id)),
  };
};

/** Turn on newly added jurisdiction preset categories without changing other switches. */
export const enableJurisdictionPresets = (
  settings: CategorySettings,
  previous: DetectionProfile,
  next: DetectionProfile,
): CategorySettings => {
  const previouslySelected = new Set(previous.jurisdictions);
  const added = next.jurisdictions.filter(id => !previouslySelected.has(id));
  const result = { ...settings };
  for (const id of added) {
    for (const category of JURISDICTION_PACKS[id]?.categoryPreset ?? []) result[category] = true;
  }
  return result;
};
