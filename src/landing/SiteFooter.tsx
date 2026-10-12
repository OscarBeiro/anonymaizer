import { t } from '../i18n';
import { BrandName } from '../components/BrandName';
import { OPERATOR, REPO_URL } from '../site';
import { Copyright } from '../components/Copyright';
import { SiteLinks } from './SiteLinks';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>
        <BrandName /> v{__APP_VERSION__} · <a href={`mailto:${OPERATOR.contactEmail}`}>{t('SiteFooter.contact')}</a> ·{' '}
        <a href={REPO_URL}>{t('SiteFooter.source')}</a> · <Copyright />
      </span>
      <nav className="site-footer-links" aria-label={t('SiteFooter.legal')}>
        <SiteLinks />
      </nav>
    </footer>
  );
}
