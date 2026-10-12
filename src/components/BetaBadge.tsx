import { t } from '../i18n';
export const BetaBadge = () => (
  <span
    className="beta-badge"
    aria-label={t('BetaBadge.beta_still_in_development')}
    title={t('BetaBadge.still_in_development')}
  >
    Beta
  </span>
);
