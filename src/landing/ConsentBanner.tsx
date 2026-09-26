import { useEffect, useState } from 'react';
import { startAnalytics, stopAnalytics } from '../lib/analytics';
import { loadConsent, saveConsent, type ConsentDecision } from '../lib/consent';
import { OPEN_CONSENT_EVENT } from '../lib/consentBus';
import { linkProps } from '../lib/router';

/**
 * P21: prior, explicit, granular consent (LSSI-CE art. 22.2, AEPD cookie
 * guide). Nothing loads before Accept; Reject is exactly as prominent; no
 * pre-ticked box; closing is not consent (there is no close button — a choice
 * is required, but the page stays usable underneath). Mounted only when
 * isPublicDeployment() — see Root.tsx.
 */
export function ConsentBanner() {
  const [decision, setDecision] = useState<ConsentDecision | null>(loadConsent);
  const [open, setOpen] = useState(decision === null);
  const [customizing, setCustomizing] = useState(false);
  const [analyticsChoice, setAnalyticsChoice] = useState(decision?.analytics ?? false);

  // A stored accept from an earlier visit (under the current policy version).
  useEffect(() => {
    if (decision?.analytics) startAnalytics();
    // Only the decision found at mount; later accepts start analytics directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The cookie policy's "Change cookie settings" reopens the banner.
  useEffect(() => {
    const reopen = () => {
      setAnalyticsChoice(loadConsent()?.analytics ?? false);
      setCustomizing(true);
      setOpen(true);
    };
    window.addEventListener(OPEN_CONSENT_EVENT, reopen);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, reopen);
  }, []);

  const decide = (analytics: boolean) => {
    const wasOn = decision?.analytics ?? false;
    setDecision(saveConsent(analytics));
    setOpen(false);
    setCustomizing(false);
    if (analytics) startAnalytics();
    else if (wasOn) stopAnalytics();
  };

  if (!open) return null;

  return (
    <section className="consent-banner" role="dialog" aria-labelledby="consent-title" aria-live="polite">
      <h2 id="consent-title">Cookies for analytics?</h2>
      <p>
        We'd like to count visits with Google Analytics and Metricool, which set cookies. They would see page views
        only — never the text or files you anonymize, which never leave this tab. The tool works the same whether
        you accept or not. <a {...linkProps('/cookies')}>Cookie policy</a>
      </p>
      {customizing && (
        <label className="consent-option">
          <input type="checkbox" checked={analyticsChoice} onChange={(e) => setAnalyticsChoice(e.target.checked)} />
          <span>
            <strong>Analytics</strong> — Google Analytics 4 and Metricool, page views only
          </span>
        </label>
      )}
      <div className="consent-actions">
        {customizing ? (
          <button type="button" className="consent-button" onClick={() => decide(analyticsChoice)}>
            Save choice
          </button>
        ) : (
          <>
            <button type="button" className="consent-button" onClick={() => decide(false)}>
              Reject
            </button>
            <button type="button" className="consent-button" onClick={() => decide(true)}>
              Accept
            </button>
            <button type="button" className="consent-link" onClick={() => setCustomizing(true)}>
              Choose
            </button>
          </>
        )}
      </div>
    </section>
  );
}
