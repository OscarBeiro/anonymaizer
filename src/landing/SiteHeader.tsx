import { LanguagePicker } from '../components/LanguagePicker';
import { t } from '../i18n';
import { BrandName } from '../components/BrandName';
import { BetaBadge } from '../components/BetaBadge';
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
        <span className="app-mark" aria-hidden="true">A</span> <BrandName /> <BetaBadge />
      </a>
      <nav aria-label={t('SiteHeader.main')}>
        <a {...linkProps('/#how')}>{t('SiteHeader.how_it_works')}</a>
        <a {...linkProps('/#privacy')}>{t('SiteHeader.how_private')}</a>
        <a {...linkProps('/about')}>{t('SiteHeader.about')}</a>
        <LanguagePicker />
        <ThemeToggle theme={theme} onChange={setTheme} />
        <a {...linkProps('/app')} className="landing-nav-cta">{t('SiteHeader.open_the_tool')}</a>
      </nav>
    </header>
  );
}
