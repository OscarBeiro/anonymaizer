// P21: the only code that talks to an analytics host. Imported dynamically,
// and only behind __ANALYTICS_ENABLED__ — see analytics.ts for the gates and
// for what may never be sent. IDs come from the deploy environment.

type Gtag = (...args: unknown[]) => void;
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
    beTracker?: { t: (opts: { hash: string }) => void };
  }
}

const GA_ID = import.meta.env.VITE_GA4_ID;
const METRICOOL_HASH = import.meta.env.VITE_METRICOOL_HASH;

let loaded = false;

const addScript = (src: string, onload?: () => void) => {
  const s = document.createElement('script');
  s.async = true;
  s.src = src;
  if (onload) s.onload = onload;
  document.head.appendChild(s);
};

export const load = (initialPath: string): void => {
  if (loaded) return;
  loaded = true;

  if (GA_ID) {
    window.dataLayer = window.dataLayer ?? [];
    // gtag must push the `arguments` object itself, not an array.
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
    // Consent Mode v2: everything denied by default, then only analytics
    // storage granted — this code only runs after the user accepted.
    window.gtag('consent', 'default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
    });
    window.gtag('consent', 'update', { analytics_storage: 'granted' });
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, {
      anonymize_ip: true,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      send_page_view: false,
    });
    pageView(initialPath);
    addScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`);
  }

  if (METRICOOL_HASH) {
    addScript('https://tracker.metricool.com/resources/be.js', () => window.beTracker?.t({ hash: METRICOOL_HASH }));
  }
};

// The route path only — no query string, no title, nothing from the page.
export const pageView = (path: string): void => {
  window.gtag?.('event', 'page_view', { page_path: path, page_location: `${window.location.origin}${path}` });
};
