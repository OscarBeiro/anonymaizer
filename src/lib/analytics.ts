// P21: consent-gated analytics, public hosted deployment only.
//
// THE PROMISE THE PRODUCT RESTS ON: analytics never sees the wizard's content.
// Page views (the route path, nothing else) and nothing more — never the
// pasted text, never a file name, never a detected entity, never a count of
// them. Do not add an event that carries any of those; the privacy policy
// (src/legal/privacy.tsx) says so in writing.
//
// Two independent gates, both required (CLAUDE.md hard rule 2):
// - build time: __ANALYTICS_ENABLED__ is false unless the deploy workflow sets
//   ANONYMAIZER_ANALYTICS=1, and always false in the portable build. When it
//   is false the loader module below is never imported, so the output holds
//   no analytics code at all (the deploy workflow greps for it).
// - run time: https and the production hostname exactly — file://, localhost,
//   a LAN IP, a preview URL or a lookalike domain all refuse.

export interface LocationLike {
  protocol: string;
  hostname: string;
}

const productionHost = (): string => {
  try {
    return new URL(import.meta.env.VITE_SITE_ORIGIN).hostname;
  } catch {
    return '';
  }
};

export const isPublicDeploymentAt = (loc: LocationLike, buildEnabled: boolean, prodHost: string): boolean =>
  buildEnabled && prodHost !== '' && loc.protocol === 'https:' && loc.hostname === prodHost;

const buildEnabled = typeof __ANALYTICS_ENABLED__ !== 'undefined' && __ANALYTICS_ENABLED__;

export const isPublicDeployment = (): boolean =>
  buildEnabled && typeof location !== 'undefined' && isPublicDeploymentAt(location, buildEnabled, productionHost());

type Loader = typeof import('./analyticsLoader');
let loader: Promise<Loader> | null = null;

// Called only after an explicit accept.
export const startAnalytics = (): void => {
  if (!__ANALYTICS_ENABLED__ || !isPublicDeployment()) return;
  loader ??= import('./analyticsLoader');
  void loader.then((l) => l.load(window.location.pathname));
};

export const trackPageView = (path: string): void => {
  if (!__ANALYTICS_ENABLED__ || !loader) return;
  void loader.then((l) => l.pageView(path));
};

// Reject after accept: scripts already running cannot be unloaded, so delete
// the cookies we can reach and reload into a page that loads nothing.
export const stopAnalytics = (): void => {
  const host = window.location.hostname;
  const domains = ['', host, `.${host}`, `.${host.split('.').slice(-2).join('.')}`];
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=')[0].trim();
    if (!name.startsWith('_ga')) continue;
    for (const d of domains) {
      document.cookie = `${name}=; Max-Age=0; path=/${d ? `; domain=${d}` : ''}`;
    }
  }
  if (loader) window.location.reload();
};
