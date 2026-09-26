import { useEffect, useState } from 'react';
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
  if (param === 'es' || param === 'en') return param;
  return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en';
};

// P20: one layout for the three legal pages, in Spanish and English.
export default function LegalPage({ page }: { page: LegalPageId }) {
  const [lang, setLang] = useState<LegalLang>(initialLang);
  const Content = PAGES[page];

  useEffect(() => {
    document.documentElement.lang = lang;
    return () => {
      document.documentElement.lang = 'en';
    };
  }, [lang]);

  const switchLang = (next: LegalLang) => {
    setLang(next);
    const url = new URL(window.location.href);
    url.searchParams.set('lang', next);
    window.history.replaceState(null, '', url);
  };

  return (
    <div className="landing">
      <header className="landing-nav">
        <a className="landing-brand" {...linkProps('/')}>
          <span className="app-mark" aria-hidden="true">A</span> AnonymAIzer
        </a>
        <nav aria-label={lang === 'es' ? 'Idioma' : 'Language'}>
          <button type="button" className="legal-lang" aria-pressed={lang === 'es'} onClick={() => switchLang('es')}>
            Español
          </button>
          <button type="button" className="legal-lang" aria-pressed={lang === 'en'} onClick={() => switchLang('en')}>
            English
          </button>
        </nav>
      </header>
      <main className="legal">
        <Content lang={lang} />
        <p className="legal-updated">
          {lang === 'es' ? 'Última actualización' : 'Last updated'}: <time dateTime={LEGAL_LAST_UPDATED}>{LEGAL_LAST_UPDATED}</time>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
