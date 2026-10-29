import { useId, type ReactNode } from 'react';
import { t, type TranslationKey } from '../i18n';
import type { LanguageDetection } from '../core/langDetect';
import type { DetectionProfile } from '../core/packs/profile';
import { LANGUAGE_PROFILES, type DetectedLanguage } from '../core/packs/languageProfiles';
import { JURISDICTION_PACKS } from '../core/detectors';
import { LANGUAGE_PACKS } from '../core/packs/registry';
import './LanguageRegionSetup.css';

const languageCodes = Object.keys(LANGUAGE_PROFILES) as DetectedLanguage[];
const jurisdictionCodes = Object.keys(JURISDICTION_PACKS);
const supportedLanguages = new Set(Object.keys(LANGUAGE_PACKS));

export interface LanguageRegionSetupProps {
  detection: LanguageDetection;
  profile: DetectionProfile;
  pinned: DetectionProfile | null;
  onChange: (profile: DetectionProfile) => void;
  onPin: () => void;
  onClearPins: () => void;
  onUseSuggestions: () => void;
  modelTier?: ReactNode;
}

export function LanguageRegionSetup({
  detection, profile, pinned, onChange, onPin, onClearPins, onUseSuggestions, modelTier,
}: LanguageRegionSetupProps) {
  const headingId = useId();
  const unsupportedSelected = profile.languages.some(language => !supportedLanguages.has(language));
  const detectedLabel = detection.status === 'undetermined'
    ? t('LanguageRegion.detection_undetermined')
    : detection.languages.length
      ? detection.languages.map(language => t(`LanguageRegion.language_${language}` as TranslationKey)).join(' / ')
      : t('LanguageRegion.detection_undetermined');

  const toggleLanguage = (language: DetectedLanguage, checked: boolean) => {
    const languages = checked
      ? [...profile.languages, language]
      : profile.languages.filter(item => item !== language);
    onChange({ ...profile, languages });
  };

  const toggleJurisdiction = (jurisdiction: string, checked: boolean) => {
    const jurisdictions = checked
      ? [...profile.jurisdictions, jurisdiction]
      : profile.jurisdictions.filter(item => item !== jurisdiction);
    onChange({ ...profile, jurisdictions });
  };

  return (
    <section className="language-region-setup" aria-labelledby={headingId}>
      <header className="language-region-heading">
        <div>
          <h2 id={headingId}>{t('LanguageRegion.heading')}</h2>
          <p className="language-region-detected"><strong>{t('LanguageRegion.detected_label')}</strong> {detectedLabel}</p>
        </div>
        {modelTier && <div className="language-region-model-tier">{modelTier}</div>}
      </header>

      <p className="language-region-explanation">{t('LanguageRegion.language_region_explanation')}</p>

      <fieldset className="language-region-fieldset">
        <legend>{t('LanguageRegion.languages_legend')}</legend>
        <div className="language-region-chips">
          {languageCodes.map(language => {
            const selected = profile.languages.includes(language);
            const isSupported = supportedLanguages.has(language);
            const isPinned = Boolean(pinned?.languages.includes(language));
            return (
              <label key={language} className={`language-region-chip${selected ? ' is-selected' : ''}${!isSupported ? ' is-unsupported' : ''}`}>
                <input
                  type="checkbox"
                  checked={selected}
                  disabled={!isSupported}
                  onChange={event => toggleLanguage(language, event.currentTarget.checked)}
                />
                <span>{t(`LanguageRegion.language_${language}` as TranslationKey)}</span>
                {!isSupported && <small>{t('LanguageRegion.no_language_rules')}</small>}
                {isPinned && <span className="language-region-pinned">{t('LanguageRegion.pinned_badge')}</span>}
              </label>
            );
          })}
        </div>
      </fieldset>

      {unsupportedSelected && <p className="language-region-warning" role="status">{t('LanguageRegion.unsupported_warning')}</p>}

      <p className="language-region-region-hint">{t('LanguageRegion.region_hint')}</p>
      <fieldset className="language-region-fieldset">
        <legend>{t('LanguageRegion.regions_legend')}</legend>
        <div className="language-region-chips">
          {jurisdictionCodes.map(jurisdiction => {
            const selected = profile.jurisdictions.includes(jurisdiction);
            const isPinned = Boolean(pinned?.jurisdictions.includes(jurisdiction));
            return (
              <label key={jurisdiction} className={`language-region-chip${selected ? ' is-selected' : ''}`}>
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={event => toggleJurisdiction(jurisdiction, event.currentTarget.checked)}
                />
                <span>{t(`LanguageRegion.region_${jurisdiction.toLowerCase()}` as TranslationKey)}</span>
                <small>{t('LanguageRegion.enabled_identity_checks')}</small>
                {isPinned && <span className="language-region-pinned">{t('LanguageRegion.pinned_badge')}</span>}
              </label>
            );
          })}
        </div>
      </fieldset>

      <p className="language-region-pin-hint">{t('LanguageRegion.pin_helper')}</p>
      <div className="language-region-actions">
        <button type="button" onClick={onUseSuggestions}>{t('LanguageRegion.use_suggestions')}</button>
        <button type="button" onClick={onPin}>{t('LanguageRegion.pin_selected')}</button>
        {pinned && <button type="button" onClick={onClearPins}>{t('LanguageRegion.clear_pinned')}</button>}
      </div>
    </section>
  );
}
