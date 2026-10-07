import { type ReactNode, useEffect, useRef } from 'react';
import type { AppMode, ThemePreference } from '../lib/session';
import { Copyright } from './Copyright';
import { ThemeControl } from './ThemeControl';

// S4: General · Detection · Dictionary · Data & privacy · About.
export type SettingsSection = 'general' | 'detection' | 'dictionary' | 'privacy' | 'about';

const MODE_OPTIONS: { value: AppMode; label: string }[] = [
  { value: 'standard', label: 'Quick' },
  { value: 'advanced', label: 'Detailed' },
];

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
          <h2 id="settings-title">Settings</h2>
          <button type="button" className="settings-close" aria-label="Close settings" onClick={() => ref.current?.close()}>
            ×
          </button>
        </header>

        <section id="settings-general" className="settings-section">
          <h3>General</h3>
          <h4>Default mode</h4>
          <div className="segmented" role="radiogroup" aria-label="Default mode">
            {MODE_OPTIONS.map((o) => (
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
            Quick anonymizes a document in one step; Detailed lets you review every item. Fine-tune is always
            available from the quick result.
          </p>

          <h4>Language</h4>
          {/* M6 P14 (the t() layer and locales) is pending; this slot gets the
              locale selector plus "follow browser" when it lands. */}
          <select disabled aria-label="Language" value="en">
            <option value="en">English</option>
          </select>
          <p className="settings-hint">More languages are on the way.</p>

          <h4>Theme</h4>
          <ThemeControl theme={theme} onChange={onThemeChange} />
        </section>

        <section id="settings-detection" className="settings-section">
          <h3>Detection</h3>
          {detection}
        </section>

        <section id="settings-dictionary" className="settings-section">
          <h3>Dictionary</h3>
          {dictionary}
        </section>

        <section id="settings-privacy" className="settings-section">
          <h3>Data &amp; privacy</h3>
          <p className="settings-hint">Everything stays in this browser. Nothing is uploaded.</p>
          <button type="button" className="danger-button" onClick={onDeleteModel}>
            Delete downloaded AI model
          </button>
          <p className="settings-hint">Frees the ~104 MB model cache. It is downloaded again if you turn AI detection back on.</p>
          <button type="button" className="danger-button" onClick={onClearLocalData}>
            Clear all local data
          </button>
          <p className="settings-hint">
            Removes the saved session, rules and settings from this browser, and the downloaded AI model.
          </p>
        </section>

        <section id="settings-about" className="settings-section">
          <h3>About</h3>
          <p>AnonymAIzer v{__APP_VERSION__}. Runs entirely in your browser — no text is uploaded.</p>
          <p>
            <Copyright />
          </p>
          {legalLinks && <nav className="settings-links" aria-label="Legal">{legalLinks}</nav>}
        </section>
      </div>
    </dialog>
  );
}
