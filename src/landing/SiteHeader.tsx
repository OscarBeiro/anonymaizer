import { useEffect, useState } from 'react';
import { ThemeToggle } from '../components/ThemeToggle';
import { loadTheme, saveTheme, type ThemePreference } from '../lib/session';
import { applyTheme, watchSystemTheme } from '../lib/theme';
import { linkProps } from '../lib/router';

// The landing and About share this bar; the legal pages keep their own
// (it carries the language switch instead).
export function SiteHeader() {
  // The wizard owns the theme on /app; here the header does, with the same key.
  const [theme, setTheme] = useState<ThemePreference>(() => loadTheme());
  useEffect(() => {
    saveTheme(theme);
    applyTheme(theme);
    return watchSystemTheme(() => applyTheme(theme));
  }, [theme]);

  return (
    <header className="landing-nav">
      <a className="landing-brand" {...linkProps('/')}>
        <span className="app-mark" aria-hidden="true">A</span> AnonymAIzer
      </a>
      <nav aria-label="Main">
        <a {...linkProps('/#how')}>How it works</a>
        <a {...linkProps('/#privacy')}>How private?</a>
        <a {...linkProps('/about')}>About</a>
        <ThemeToggle theme={theme} onChange={setTheme} />
        <a {...linkProps('/app')} className="landing-nav-cta">Open the tool</a>
      </nav>
    </header>
  );
}
