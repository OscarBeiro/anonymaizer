import { LanguagePicker } from '../components/LanguagePicker';
import { t, getLocale, setLanguagePreference, useLocale } from '../i18n';
import { BrandName } from '../components/BrandName';
import { BetaBadge } from '../components/BetaBadge';
import { useEffect, useState, useRef } from 'react';
import { linkProps } from '../lib/router';
import { Cookies } from '../legal/cookies';
import { LEGAL_LAST_UPDATED, type LegalLang, type LegalPageId } from '../legal/meta';
import { Privacy } from '../legal/privacy';
import { Terms } from '../legal/terms';
import { SiteFooter } from './SiteFooter';
import './landing.css';

const PAGES = { privacy: Privacy, cookies: Cookies, terms: Terms };

// ?lang= wins (so a Spanish link stays Spanish), then the browser language.
const initialLang = (): LegalLang => {
  const param = new URLSearchParams(window.location.search).get('lang');
  if (param === 'es' || param === 'en' || param === 'gl') return param;
  return getLocale() as LegalLang;
};

// P20: one layout for the three legal pages, in Spanish and English.
export default function LegalPage({ page }: { page: LegalPageId }) {
  const [lang, setLang] = useState<LegalLang>(initialLang);
  const locale = useLocale();
  const lastLocale = useRef(locale);
  useEffect(() => {
    if (lastLocale.current === locale) return;
    lastLocale.current = locale;
    setLang(locale as LegalLang);
    const url = new URL(window.location.href);
    url.searchParams.delete('lang');
    window.history.replaceState(null, '', url);
  }, [locale]);
  const Content = PAGES[page];

  useEffect(() => {
    document.documentElement.lang = lang;
    return () => {
      document.documentElement.lang = getLocale();
    };
  }, [lang]);

  const switchLang = (next: LegalLang) => {
    if (next !== 'es') setLanguagePreference(next);
    setLang(next);
    const url = new URL(window.location.href);
    url.searchParams.set('lang', next);
    window.history.replaceState(null, '', url);
  };

  return (
    <div className="landing">
      <header className="landing-nav">
        <a className="landing-brand" {...linkProps('/')}>
          <span className="app-mark" aria-hidden="true">A</span> <BrandName /> <BetaBadge />
        </a>
        <nav aria-label={lang === 'es' ? 'Idioma' : 'Language'}>
          <LanguagePicker />
          <button type="button" className="legal-lang" aria-pressed={lang === 'es'} onClick={() => switchLang('es')}>
            Español
          </button>
          <button type="button" className="legal-lang" aria-pressed={lang === 'en'} onClick={() => switchLang('en')}>
            {t('LegalPage.english')}</button>
        </nav>
      </header>
      <main className="legal">
        <Content lang={lang} />
        <p className="legal-updated">
          {lang === 'es' ? 'Última actualización' : t('LegalPage.last_updated', {}, lang)}: <time dateTime={LEGAL_LAST_UPDATED}>{LEGAL_LAST_UPDATED}</time>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
