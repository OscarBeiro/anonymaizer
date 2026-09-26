import { OPERATOR, REPO_URL } from '../site';
import { SiteLinks } from './SiteLinks';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>
        AnonymAIzer v{__APP_VERSION__} · <a href={`mailto:${OPERATOR.contactEmail}`}>Contact</a> ·{' '}
        <a href={REPO_URL}>Source</a>
      </span>
      <nav className="site-footer-links" aria-label="Legal">
        <SiteLinks />
      </nav>
    </footer>
  );
}
