import { linkProps } from '../lib/router';
import { SiteFooter } from './SiteFooter';
import './landing.css';

// P19 stub; P20 writes the content.
export default function LegalPage({ page }: { page: 'privacy' | 'cookies' | 'terms' }) {
  return (
    <div className="landing">
      <header className="landing-nav">
        <a className="landing-brand" {...linkProps('/')}>
          <span className="app-mark" aria-hidden="true">A</span> AnonymAIzer
        </a>
      </header>
      <main className="legal">
        <h1>{page}</h1>
      </main>
      <SiteFooter />
    </div>
  );
}
