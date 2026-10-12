import { t } from '../i18n';
import { BrandName } from './BrandName';
import { type ReactNode, useEffect, useRef } from 'react';
import type { AppMode, ThemePreference } from '../lib/session';
import { Copyright } from './Copyright';
import { ThemeControl } from './ThemeControl';

// S4: General · Detection · Dictionary · Data & privacy · About.
export type SettingsSection = 'general' | 'detection' | 'dictionary' | 'privacy' | 'about';

const MODE_OPTIONS: () => { value: AppMode; label: string }[] = () => ([
  { value: 'standard', label: t('SettingsMenu.quick') },
  { value: 'advanced', label: t('SettingsMenu.detailed') },
]);

interface SettingsMenuProps {
  open: boolean;
  // Scrolled into view on open, for links like 2.1's "Detection settings".
  section?: SettingsSection;
  onClose: () => void;
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  defaultMode: AppMode;
  onDefaultModeChange: (mode: AppMode) => void;
  detection: ReactNode;
  dictionary: ReactNode;
  legalLinks?: ReactNode;
  onClearLocalData: () => void;
  onDeleteModel: () => void;
}

/**
 * P18: the one home for settings. A modal <dialog> rather than a hover
 * dropdown, so it works on touch; showModal() makes the rest of the page
 * inert (the focus trap) and closes on Escape. Focus goes back to whatever
 * opened it — the browser does this for showModal(), but not every engine, so
 * it is done explicitly too.
 */
export function SettingsMenu({
  open,
  section,
  onClose,
  theme,
  onThemeChange,
  defaultMode,
  onDefaultModeChange,
  detection,
  dictionary,
  legalLinks,
  onClearLocalData,
  onDeleteModel,
}: SettingsMenuProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
      if (section) dialog.querySelector(`#settings-${section}`)?.scrollIntoView({ block: 'start' });
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, section]);

  const handleClose = () => {
    onClose();
    returnFocus.current?.focus();
  };

  return (
    // onClose fires for Escape as well as dialog.close().
    <dialog
      ref={ref}
      className="settings-menu"
      aria-labelledby="settings-title"
      onClose={handleClose}
      onClick={(e) => {
        // A click on the backdrop lands on the <dialog> itself.
        if (e.target === e.currentTarget) ref.current?.close();
      }}
    >
      <div className="settings-menu-inner">
        <header className="settings-menu-header">
          <h2 id="settings-title">{t('SettingsMenu.settings')}</h2>
          <button type="button" className="settings-close" aria-label={t('SettingsMenu.close_settings')} onClick={() => ref.current?.close()}>
            ×
          </button>
        </header>

        <section id="settings-general" className="settings-section">
          <h3>{t('SettingsMenu.general')}</h3>
          <h4>{t('SettingsMenu.default_mode')}</h4>
          <div className="segmented" role="radiogroup" aria-label={t('SettingsMenu.default_mode')}>
            {MODE_OPTIONS().map((o) => (
              <label key={o.value} className={defaultMode === o.value ? 'segmented-option is-active' : 'segmented-option'}>
                <input
                  type="radio"
                  name="default-mode"
                  value={o.value}
                  checked={defaultMode === o.value}
                  onChange={() => onDefaultModeChange(o.value)}
                />
                {o.label}
              </label>
            ))}
          </div>
          <p className="settings-hint">
            {t('SettingsMenu.quick_anonymizes_a_document_in_one_step')}</p>

          <h4>{t('SettingsMenu.theme')}</h4>
          <ThemeControl theme={theme} onChange={onThemeChange} />
        </section>

        <section id="settings-detection" className="settings-section">
          <h3>{t('SettingsMenu.detection')}</h3>
          {detection}
        </section>

        <section id="settings-dictionary" className="settings-section">
          <h3>{t('SettingsMenu.dictionary')}</h3>
          {dictionary}
        </section>

        <section id="settings-privacy" className="settings-section">
          <h3>{t('SettingsMenu.data_privacy')}</h3>
          <p className="settings-hint">{t('SettingsMenu.everything_stays_in_this_browser_nothing_is')}</p>
          <button type="button" className="danger-button" onClick={onDeleteModel}>
            {t('SettingsMenu.delete_downloaded_ai_model')}</button>
          <p className="settings-hint">{t('SettingsMenu.frees_the_104_mb_model_cache_it')}</p>
          <button type="button" className="danger-button" onClick={onClearLocalData}>
            {t('SettingsMenu.clear_all_local_data')}</button>
          <p className="settings-hint">
            {t('SettingsMenu.removes_the_saved_session_rules_and_settings')}</p>
        </section>

        <section id="settings-about" className="settings-section">
          <h3>{t('SettingsMenu.about')}</h3>
          <p><BrandName /> v{__APP_VERSION__}{t('SettingsMenu.runs_entirely_in_your_browser_no_text')}</p>
          <p>
            <Copyright />
          </p>
          {legalLinks && <nav className="settings-links" aria-label={t('SettingsMenu.legal')}>{legalLinks}</nav>}
        </section>
      </div>
    </dialog>
  );
}
