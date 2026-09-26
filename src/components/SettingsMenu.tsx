import { type ReactNode, useEffect, useRef } from 'react';
import type { ThemePreference } from '../lib/session';
import { ThemeControl } from './ThemeControl';

export type SettingsSection = 'language' | 'theme' | 'detection' | 'dictionary' | 'about';

interface SettingsMenuProps {
  open: boolean;
  // Scrolled into view on open, for links like 2.1's "Detection settings".
  section?: SettingsSection;
  onClose: () => void;
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  detection: ReactNode;
  dictionary: ReactNode;
  legalLinks?: ReactNode;
  onClearLocalData: () => void;
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
  detection,
  dictionary,
  legalLinks,
  onClearLocalData,
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

        <section id="settings-language" className="settings-section">
          <h3>Language</h3>
          {/* M4b P14/P15 (the t() layer and locales) are deferred; this slot
              gets the locale selector plus "follow browser" when they land. */}
          <select disabled aria-label="Language" value="en">
            <option value="en">English</option>
          </select>
          <p className="settings-hint">More languages are on the way.</p>
        </section>

        <section id="settings-theme" className="settings-section">
          <h3>Theme</h3>
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

        <section id="settings-about" className="settings-section">
          <h3>About</h3>
          <p>AnonymAIzer v{__APP_VERSION__}. Runs entirely in your browser — no text is uploaded.</p>
          {legalLinks && <nav className="settings-links" aria-label="Legal">{legalLinks}</nav>}
          <button type="button" className="danger-button" onClick={onClearLocalData}>
            Clear all local data
          </button>
          <p className="settings-hint">
            Removes the saved session, rules and settings from this browser, and the downloaded AI model.
          </p>
        </section>
      </div>
    </dialog>
  );
}
